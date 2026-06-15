import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const isPublic =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/auth/discord-verify' ||
    pathname === '/auth/discord-denied' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/trading-hints') ||
    pathname.startsWith('/api/exchange-rates') ||
    pathname.startsWith('/api/cron') ||
    pathname.startsWith('/api/news') ||
    pathname.startsWith('/api/translate') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico';

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (user && pathname === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  // Discord verification check for authenticated users
  // Set DISCORD_VERIFY_ENABLED=false to bypass
  if (user && !isPublic && process.env.DISCORD_VERIFY_ENABLED === 'true') {
    const { data: profile } = await supabase
      .from('profiles')
      .select('discord_verified, discord_verified_at')
      .eq('id', user.id)
      .single();

    const verifiedAt = profile?.discord_verified_at ? new Date(profile.discord_verified_at) : null;
    const isExpired = !verifiedAt || Date.now() - verifiedAt.getTime() > 30 * 24 * 60 * 60 * 1000;

    if (!profile?.discord_verified || isExpired) {
      const url = request.nextUrl.clone();
      url.pathname = '/auth/discord-verify';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
