import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getAdminClient } from '@/lib/supabase-admin';
import { getUserDiscordRoles } from '@/lib/discord';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/discord-denied?message=${encodeURIComponent('Discord 인증이 취소되었습니다.')}`);
  }

  // Get current Supabase session
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(list) { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(`${origin}/login`);
  }

  // Exchange code for Discord access token
  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID!,
      client_secret: process.env.DISCORD_CLIENT_SECRET!,
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${origin}/api/auth/discord/callback`,
    }),
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    console.error('Discord token exchange failed:', err);
    return NextResponse.redirect(`${origin}/auth/discord-denied?message=${encodeURIComponent('Discord 인증 처리 중 오류가 발생했습니다.')}`);
  }

  const { access_token } = await tokenRes.json();

  // Get Discord user ID
  const userRes = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!userRes.ok) {
    return NextResponse.redirect(`${origin}/auth/discord-denied?message=${encodeURIComponent('Discord 유저 정보를 가져올 수 없습니다.')}`);
  }

  const discordUser = await userRes.json();
  const discordId: string = discordUser.id;

  // Check guild roles via bot
  const roleCheck = await getUserDiscordRoles(discordId);

  // Update profiles table (service role bypasses RLS)
  await getAdminClient().from('profiles').upsert({
    id: user.id,
    discord_id: discordId,
    discord_roles: roleCheck.roles,
    discord_verified: roleCheck.hasPermission,
    discord_verified_at: roleCheck.hasPermission ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  });

  if (!roleCheck.hasPermission) {
    return NextResponse.redirect(
      `${origin}/auth/discord-denied?message=${encodeURIComponent(roleCheck.message)}`
    );
  }

  return NextResponse.redirect(`${origin}/`);
}
