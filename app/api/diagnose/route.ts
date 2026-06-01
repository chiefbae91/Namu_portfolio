import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getAuthUser, unauthorized } from '@/lib/auth';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorized();

  const supabase = getAdminClient();
  const userId = user.id;

  // ── transactions 전체 현황 ────────────────────────────────────────
  const { data: allTx, error: allTxErr } = await supabase
    .from('transactions')
    .select('id, user_id, account_id, ticker, type, transaction_date')
    .limit(10000);

  const totalRows = allTx?.length ?? 0;

  // user_id별 카운트
  const userCounts: Record<string, number> = {};
  for (const tx of allTx ?? []) {
    const uid = tx.user_id ?? 'NULL';
    userCounts[uid] = (userCounts[uid] ?? 0) + 1;
  }

  // 현재 user 거래수
  const myTxRows = (allTx ?? []).filter(tx => tx.user_id === userId);
  const myTxCount = myTxRows.length;

  // type별 카운트 (현재 user)
  const typeCounts: Record<string, number> = {};
  for (const tx of myTxRows) {
    const t = String(tx.type ?? 'null');
    typeCounts[t] = (typeCounts[t] ?? 0) + 1;
  }

  // 현재 user 계좌별 거래수
  const accountTxCounts: Record<string, number> = {};
  for (const tx of myTxRows) {
    const a = String(tx.account_id ?? 'null');
    accountTxCounts[a] = (accountTxCounts[a] ?? 0) + 1;
  }

  // ticker별 거래수 (상위 10)
  const tickerCounts: Record<string, number> = {};
  for (const tx of myTxRows) {
    const ti = tx.ticker ?? '';
    tickerCounts[ti] = (tickerCounts[ti] ?? 0) + 1;
  }
  const topTickers = Object.entries(tickerCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // ── accounts 현황 ──────────────────────────────────────────────
  const { data: allAccounts } = await supabase
    .from('accounts')
    .select('id, name, user_id, hidden')
    .limit(500);

  const myAccounts = (allAccounts ?? []).filter((a: Record<string, unknown>) => a.user_id === userId);
  const foreignAccounts = (allAccounts ?? []).filter((a: Record<string, unknown>) => a.user_id !== userId);

  // ── trading_hints 현황 ──────────────────────────────────────────
  const { data: hints } = await supabase
    .from('trading_hints')
    .select('id, created_by')
    .limit(2000);

  const hintUserCounts: Record<string, number> = {};
  for (const h of hints ?? []) {
    const uid = (h as Record<string, unknown>).created_by as string ?? 'NULL';
    hintUserCounts[uid] = (hintUserCounts[uid] ?? 0) + 1;
  }

  return NextResponse.json({
    currentUser: {
      id: userId,
      email: user.email,
    },
    transactions: {
      totalInTable: totalRows,
      myCount: myTxCount,
      userIdBreakdown: userCounts,
      typeBreakdown: typeCounts,
      accountBreakdown: accountTxCounts,
      topTickers,
      fetchError: allTxErr?.message ?? null,
    },
    accounts: {
      myCount: myAccounts.length,
      myAccounts: myAccounts.map((a: Record<string, unknown>) => ({ id: a.id, name: a.name, hidden: a.hidden })),
      foreignCount: foreignAccounts.length,
    },
    tradingHints: {
      userIdBreakdown: hintUserCounts,
    },
    diagnosis: buildDiagnosis(userId, myTxCount, userCounts, totalRows),
  });
}

function buildDiagnosis(
  userId: string,
  myTxCount: number,
  userCounts: Record<string, number>,
  total: number
): string[] {
  const msgs: string[] = [];

  if (total === 0) {
    msgs.push('❌ transactions 테이블에 데이터가 전혀 없습니다. Supabase에 거래를 먼저 추가하거나 CSV 임포트가 필요합니다.');
    return msgs;
  }

  if (myTxCount === 0) {
    msgs.push(`❌ 현재 user_id(${userId.slice(0, 8)}…)로 된 거래가 없습니다.`);
    const others = Object.entries(userCounts).filter(([uid]) => uid !== userId);
    if (others.length > 0) {
      msgs.push(`⚠️ 다른 user_id로 저장된 거래 ${total}건이 있습니다: ${others.map(([uid, n]) => `${uid.slice(0, 8)}…(${n}건)`).join(', ')}`);
      msgs.push('🔧 해결: POST /api/admin/migrate 를 호출하면 모든 거래를 현재 user_id로 업데이트합니다.');
    }
  } else {
    msgs.push(`✅ 현재 user_id로 ${myTxCount}건의 거래가 있습니다.`);
    const nullCount = userCounts['NULL'] ?? 0;
    if (nullCount > 0) {
      msgs.push(`⚠️ user_id가 NULL인 거래 ${nullCount}건이 있습니다. POST /api/admin/migrate 로 수정 가능합니다.`);
    }
  }

  return msgs;
}
