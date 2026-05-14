import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
  // 1. 현재 로그인 유저 확인
  const cookieStore = await cookies();
  const authClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = user.id;

  // 2. Service role 클라이언트 (RLS 우회)
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results: Record<string, { updated: number | null; error: string | null }> = {};

  // 3. 각 테이블 UPDATE
  // trading_hints: created_by 컬럼
  {
    const { error, count } = await admin
      .from('trading_hints')
      .update({ created_by: userId })
      .neq('created_by', userId);
    results.trading_hints = { updated: count, error: error?.message ?? null };
  }

  // accounts: user_id 컬럼
  {
    const { error, count } = await admin
      .from('accounts')
      .update({ user_id: userId })
      .neq('user_id', userId);
    results.accounts = { updated: count, error: error?.message ?? null };
  }

  // transactions: user_id 컬럼
  {
    const { error, count } = await admin
      .from('transactions')
      .update({ user_id: userId })
      .neq('user_id', userId);
    results.transactions = { updated: count, error: error?.message ?? null };
  }

  // cash_flow: user_id 컬럼
  {
    const { error, count } = await admin
      .from('cash_flow')
      .update({ user_id: userId })
      .neq('user_id', userId);
    results.cash_flow = { updated: count, error: error?.message ?? null };
  }

  return NextResponse.json({ userId, results });
}
