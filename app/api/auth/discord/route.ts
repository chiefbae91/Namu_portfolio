import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const origin = new URL(req.url).origin;
  const params = new URLSearchParams({
    client_id: process.env.DISCORD_CLIENT_ID!,
    redirect_uri: `${origin}/api/auth/discord/callback`,
    response_type: 'code',
    scope: 'identify guilds.members.read',
  });
  return NextResponse.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
}
