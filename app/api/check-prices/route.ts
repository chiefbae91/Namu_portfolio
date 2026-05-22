import { NextResponse } from 'next/server';
import { getAdminClient } from '@/lib/supabase-admin';
import { getAuthUser, unauthorized } from '@/lib/auth';

const TYPE_LABELS: Record<string, string> = {
  resistance:      '벽 (Resistance)',
  support:         '지지',
  supply_level:    '매물대',
  faded_supply:    '흐린 매물대',
  last_buy_zone:   '마지막 매물대',
  short_target:    '단기 목표주가',
  long_target:     '장기 목표주가',
  buy_stop:        '매수 중지',
  trailing_supply: '추격 매물대',
  accumulation:    '매집 자리',
  note_only:       '메모',
};

async function fetchCurrentPrice(ticker: string): Promise<number | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=1d`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
  } catch { return null; }
}

function parsePrices(raw: string): number[] {
  return raw.trim().split(/[\s,]+/)
    .map(s => parseFloat(s.replace(/,/g, '')))
    .filter(n => !isNaN(n) && n > 0);
}

export async function POST() {
  const user = await getAuthUser();
  if (!user) return unauthorized();
  const supabase = getAdminClient();

  // Load all active alerts for this user
  const { data: alerts } = await supabase
    .from('price_alerts')
    .select('*')
    .eq('user_id', user.id)
    .eq('active', true);

  if (!alerts || alerts.length === 0) return NextResponse.json({ triggered: [] });

  // Fetch prices for unique tickers in parallel
  const tickers = [...new Set(alerts.map((a: any) => a.ticker as string))];
  const priceEntries = await Promise.all(tickers.map(async t => [t, await fetchCurrentPrice(t)] as [string, number | null]));
  const priceMap: Record<string, number | null> = Object.fromEntries(priceEntries);

  // 벽, 단기 목표, 장기 목표 → trigger when price reaches or exceeds hint price
  const UPWARD_TYPES = new Set(['resistance', 'short_target', 'long_target']);

  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const newNotifications: any[] = [];
  const alertsToSetTriggered: string[] = [];
  const alertsToResetTriggered: string[] = [];

  for (const alert of alerts as any[]) {
    const currentPrice = priceMap[alert.ticker];
    if (currentPrice == null) continue;

    const prices = parsePrices(alert.hint_prices);
    if (prices.length === 0) continue;

    const isUpward = UPWARD_TYPES.has(alert.hint_type);
    const typeLabel = TYPE_LABELS[alert.hint_type] ?? alert.hint_type;

    if (isUpward) {
      const crossedPrices = prices.filter(p => currentPrice >= p);
      const allBelow = prices.every(p => currentPrice < p);

      if (!alert.triggered && crossedPrices.length > 0) {
        for (const hintPrice of crossedPrices) {
          newNotifications.push({
            user_id: user.id,
            ticker: alert.ticker,
            hint_type: alert.hint_type,
            hint_price: hintPrice,
            current_price: currentPrice,
            message: `📈 ${alert.ticker} ${typeLabel} $${fmt(hintPrice)} 위 도달 (현재가 $${fmt(currentPrice)})`,
          });
        }
        alertsToSetTriggered.push(alert.id);
      } else if (alert.triggered && allBelow) {
        alertsToResetTriggered.push(alert.id);
      }
    } else {
      const crossedPrices = prices.filter(p => currentPrice <= p);
      const allAbove = prices.every(p => currentPrice > p);

      if (!alert.triggered && crossedPrices.length > 0) {
        for (const hintPrice of crossedPrices) {
          newNotifications.push({
            user_id: user.id,
            ticker: alert.ticker,
            hint_type: alert.hint_type,
            hint_price: hintPrice,
            current_price: currentPrice,
            message: `📉 ${alert.ticker} ${typeLabel} $${fmt(hintPrice)} 아래 도달 (현재가 $${fmt(currentPrice)})`,
          });
        }
        alertsToSetTriggered.push(alert.id);
      } else if (alert.triggered && allAbove) {
        alertsToResetTriggered.push(alert.id);
      }
    }
  }

  // Batch write notifications
  if (newNotifications.length > 0) {
    await supabase.from('hint_notifications').insert(newNotifications);
  }

  // Update triggered flags
  if (alertsToSetTriggered.length > 0) {
    await supabase
      .from('price_alerts')
      .update({ triggered: true, triggered_at: new Date().toISOString() })
      .in('id', alertsToSetTriggered);
  }
  if (alertsToResetTriggered.length > 0) {
    await supabase
      .from('price_alerts')
      .update({ triggered: false, triggered_at: null })
      .in('id', alertsToResetTriggered);
  }

  // Return newly created notifications for immediate display
  return NextResponse.json({ triggered: newNotifications });
}
