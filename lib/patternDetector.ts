export interface OHLCCandle {
  open: number;
  high: number;
  low: number;
  close: number;
  date: string;
}

export interface DetectedPattern {
  name: string;
  signal: 'Bullish' | 'Bearish' | 'Neutral';
  confidence: number;
  targetPrice: number | null;
  neckline: number | null;
  startDate: string;
  endDate: string;
  description: string;
}

function findPeaks(arr: number[], win = 3): number[] {
  const peaks: number[] = [];
  for (let i = win; i < arr.length - win; i++) {
    let ok = true;
    for (let j = 1; j <= win; j++) {
      if (arr[i - j] >= arr[i] || arr[i + j] >= arr[i]) { ok = false; break; }
    }
    if (ok) peaks.push(i);
  }
  return peaks;
}

function findTroughs(arr: number[], win = 3): number[] {
  const troughs: number[] = [];
  for (let i = win; i < arr.length - win; i++) {
    let ok = true;
    for (let j = 1; j <= win; j++) {
      if (arr[i - j] <= arr[i] || arr[i + j] <= arr[i]) { ok = false; break; }
    }
    if (ok) troughs.push(i);
  }
  return troughs;
}

function linReg(y: number[]): { slope: number; intercept: number } {
  const n = y.length;
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sx += i; sy += y[i]; sxy += i * y[i]; sxx += i * i; }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return { slope: 0, intercept: sy / n };
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

// ── Double Top ────────────────────────────────────────────────────────────────

function detectDoubleTop(candles: OHLCCandle[]): DetectedPattern | null {
  if (candles.length < 15) return null;
  const highs = candles.map(c => c.high);
  const lows  = candles.map(c => c.low);
  const peaks = findPeaks(highs, 3);
  if (peaks.length < 2) return null;

  for (let pi = peaks.length - 1; pi >= 1; pi--) {
    const p2 = peaks[pi], p1 = peaks[pi - 1];
    if (p2 - p1 < 5) continue;

    const h1 = highs[p1], h2 = highs[p2];
    const sim = Math.abs(h1 - h2) / Math.max(h1, h2);
    if (sim > 0.04) continue;

    let neckline = Infinity;
    for (let i = p1 + 1; i < p2; i++) if (lows[i] < neckline) neckline = lows[i];

    const avg = (h1 + h2) / 2;
    if ((avg - neckline) / avg < 0.03) continue;

    return {
      name: 'Double Top',
      signal: 'Bearish',
      confidence: clamp(Math.round(82 - sim * 1000), 52, 92),
      targetPrice: neckline - (avg - neckline),
      neckline,
      startDate: candles[p1].date,
      endDate: candles[p2].date,
      description: '두 개의 유사한 고점이 형성되어 하락 반전을 시사합니다.',
    };
  }
  return null;
}

// ── Double Bottom ─────────────────────────────────────────────────────────────

function detectDoubleBottom(candles: OHLCCandle[]): DetectedPattern | null {
  if (candles.length < 15) return null;
  const lows  = candles.map(c => c.low);
  const highs = candles.map(c => c.high);
  const troughs = findTroughs(lows, 3);
  if (troughs.length < 2) return null;

  for (let ti = troughs.length - 1; ti >= 1; ti--) {
    const t2 = troughs[ti], t1 = troughs[ti - 1];
    if (t2 - t1 < 5) continue;

    const l1 = lows[t1], l2 = lows[t2];
    const sim = Math.abs(l1 - l2) / Math.min(l1, l2);
    if (sim > 0.04) continue;

    let neckline = -Infinity;
    for (let i = t1 + 1; i < t2; i++) if (highs[i] > neckline) neckline = highs[i];

    const avg = (l1 + l2) / 2;
    if ((neckline - avg) / avg < 0.03) continue;

    return {
      name: 'Double Bottom',
      signal: 'Bullish',
      confidence: clamp(Math.round(82 - sim * 1000), 52, 92),
      targetPrice: neckline + (neckline - avg),
      neckline,
      startDate: candles[t1].date,
      endDate: candles[t2].date,
      description: '두 개의 유사한 저점이 형성되어 상승 반전을 시사합니다.',
    };
  }
  return null;
}

// ── Head & Shoulders ──────────────────────────────────────────────────────────

function detectHeadAndShoulders(candles: OHLCCandle[]): DetectedPattern | null {
  if (candles.length < 20) return null;
  const highs = candles.map(c => c.high);
  const lows  = candles.map(c => c.low);
  const peaks = findPeaks(highs, 3);
  if (peaks.length < 3) return null;

  for (let pi = peaks.length - 1; pi >= 2; pi--) {
    const rs = peaks[pi], hd = peaks[pi - 1], ls = peaks[pi - 2];
    const lsH = highs[ls], head = highs[hd], rsH = highs[rs];

    if (head <= lsH || head <= rsH) continue;
    const sim = Math.abs(lsH - rsH) / Math.max(lsH, rsH);
    if (sim > 0.06) continue;

    let t1 = Infinity, t2 = Infinity;
    for (let i = ls + 1; i < hd; i++) if (lows[i] < t1) t1 = lows[i];
    for (let i = hd + 1; i < rs; i++) if (lows[i] < t2) t2 = lows[i];
    const neckline = (t1 + t2) / 2;
    if ((head - neckline) / head < 0.03) continue;

    return {
      name: 'Head & Shoulders',
      signal: 'Bearish',
      confidence: clamp(Math.round(85 - sim * 500), 55, 93),
      targetPrice: neckline - (head - neckline),
      neckline,
      startDate: candles[ls].date,
      endDate: candles[rs].date,
      description: '헤드앤숄더: 중앙 고점(헤드)이 양쪽 고점(숄더)보다 높습니다.',
    };
  }
  return null;
}

// ── Inverse Head & Shoulders ──────────────────────────────────────────────────

function detectInverseHS(candles: OHLCCandle[]): DetectedPattern | null {
  if (candles.length < 20) return null;
  const lows  = candles.map(c => c.low);
  const highs = candles.map(c => c.high);
  const troughs = findTroughs(lows, 3);
  if (troughs.length < 3) return null;

  for (let ti = troughs.length - 1; ti >= 2; ti--) {
    const rs = troughs[ti], hd = troughs[ti - 1], ls = troughs[ti - 2];
    const lsL = lows[ls], head = lows[hd], rsL = lows[rs];

    if (head >= lsL || head >= rsL) continue;
    const sim = Math.abs(lsL - rsL) / Math.min(lsL, rsL);
    if (sim > 0.06) continue;

    let t1 = -Infinity, t2 = -Infinity;
    for (let i = ls + 1; i < hd; i++) if (highs[i] > t1) t1 = highs[i];
    for (let i = hd + 1; i < rs; i++) if (highs[i] > t2) t2 = highs[i];
    const neckline = (t1 + t2) / 2;
    if ((neckline - head) / neckline < 0.03) continue;

    return {
      name: 'Inverse Head & Shoulders',
      signal: 'Bullish',
      confidence: clamp(Math.round(85 - sim * 500), 55, 93),
      targetPrice: neckline + (neckline - head),
      neckline,
      startDate: candles[ls].date,
      endDate: candles[rs].date,
      description: '역헤드앤숄더: 중앙 저점(헤드)이 양쪽 저점(숄더)보다 낮습니다.',
    };
  }
  return null;
}

// ── Triangle patterns ─────────────────────────────────────────────────────────

function detectTriangles(candles: OHLCCandle[]): DetectedPattern[] {
  const n = Math.min(candles.length, 30);
  if (n < 15) return [];

  const sub = candles.slice(-n);
  const subHighs = sub.map(c => c.high);
  const subLows  = sub.map(c => c.low);
  const startDate = sub[0].date;
  const endDate   = sub[sub.length - 1].date;

  const rH = linReg(subHighs);
  const rL = linReg(subLows);

  const avgH = subHighs.reduce((a, b) => a + b) / subHighs.length;
  const avgL = subLows.reduce((a, b) => a + b)  / subLows.length;

  const slopeH = rH.slope / avgH * 100; // normalised % per candle
  const slopeL = rL.slope / avgL * 100;

  const patternHeight = Math.max(...subHighs) - Math.min(...subLows);
  const currentHigh   = subHighs[subHighs.length - 1];
  const currentLow    = subLows[subLows.length - 1];

  const results: DetectedPattern[] = [];

  if (Math.abs(slopeH) < 0.12 && slopeL > 0.12) {
    results.push({
      name: 'Ascending Triangle',
      signal: 'Bullish',
      confidence: 65,
      targetPrice: currentHigh + patternHeight * 0.7,
      neckline: currentHigh,
      startDate,
      endDate,
      description: '수평 저항과 상승 지지선으로 구성된 상승 삼각형입니다.',
    });
  } else if (slopeH < -0.12 && Math.abs(slopeL) < 0.12) {
    results.push({
      name: 'Descending Triangle',
      signal: 'Bearish',
      confidence: 65,
      targetPrice: currentLow - patternHeight * 0.7,
      neckline: currentLow,
      startDate,
      endDate,
      description: '수평 지지와 하락 저항선으로 구성된 하락 삼각형입니다.',
    });
  } else if (slopeH < -0.08 && slopeL > 0.08) {
    results.push({
      name: 'Symmetrical Triangle',
      signal: 'Neutral',
      confidence: 60,
      targetPrice: null,
      neckline: null,
      startDate,
      endDate,
      description: '수렴하는 고점·저점 추세선. 방향 돌파 시 강한 움직임이 예상됩니다.',
    });
  }

  return results;
}

// ── Bull Flag ─────────────────────────────────────────────────────────────────

function detectBullFlag(candles: OHLCCandle[]): DetectedPattern | null {
  if (candles.length < 15) return null;
  const closes = candles.map(c => c.close);
  const n      = closes.length;

  const poleEnd   = Math.floor(n * 0.60);
  const poleStart = Math.max(0, poleEnd - 10);

  const poleGain = (closes[poleEnd] - closes[poleStart]) / closes[poleStart];
  if (poleGain < 0.08) return null;

  const flagSlice = closes.slice(poleEnd);
  const flagReg   = linReg(flagSlice);
  if (flagReg.slope > 0) return null;

  const flagDrop = Math.abs((closes[n - 1] - closes[poleEnd]) / closes[poleEnd]);
  if (flagDrop > 0.08) return null;

  const poleHeight = closes[poleEnd] - closes[poleStart];
  return {
    name: 'Bull Flag',
    signal: 'Bullish',
    confidence: clamp(Math.round(60 + poleGain * 200), 60, 88),
    targetPrice: closes[n - 1] + poleHeight,
    neckline: Math.max(...candles.slice(poleEnd).map(c => c.high)),
    startDate: candles[poleStart].date,
    endDate:   candles[n - 1].date,
    description: '강한 상승 기둥(Flagpole) 이후 소폭 조정(Flag)이 나타나는 강세 지속 패턴입니다.',
  };
}

// ── Cup & Handle ──────────────────────────────────────────────────────────────

function detectCupAndHandle(candles: OHLCCandle[]): DetectedPattern | null {
  if (candles.length < 25) return null;
  const closes = candles.map(c => c.close);
  const n      = closes.length;

  const cupEnd = Math.floor(n * 0.70);

  const rimSim = Math.abs(closes[0] - closes[cupEnd]) / Math.max(closes[0], closes[cupEnd]);
  if (rimSim > 0.08) return null;

  let cupBottom = Infinity;
  for (let i = 0; i <= cupEnd; i++) if (closes[i] < cupBottom) cupBottom = closes[i];

  const rim      = Math.max(closes[0], closes[cupEnd]);
  const cupDepth = (rim - cupBottom) / rim;
  if (cupDepth < 0.08 || cupDepth > 0.35) return null;

  const handleSlice = closes.slice(cupEnd);
  const handleReg   = linReg(handleSlice);
  if (handleReg.slope > 0) return null;

  const handleDrop = Math.abs((closes[n - 1] - closes[cupEnd]) / closes[cupEnd]);
  if (handleDrop > 0.08) return null;

  return {
    name: 'Cup & Handle',
    signal: 'Bullish',
    confidence: clamp(Math.round(65 + (1 - rimSim / 0.08) * 15), 55, 88),
    targetPrice: rim + (rim - cupBottom),
    neckline: rim,
    startDate: candles[0].date,
    endDate:   candles[n - 1].date,
    description: 'U자형 컵과 소폭 핸들 조정으로 구성된 강세 지속 패턴입니다.',
  };
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function detectPatterns(candles: OHLCCandle[]): DetectedPattern[] {
  if (candles.length < 15) return [];

  // Analyse most-recent 60 candles
  const data = candles.slice(-60);
  const results: DetectedPattern[] = [];

  const dt  = detectDoubleTop(data);        if (dt)  results.push(dt);
  const db  = detectDoubleBottom(data);     if (db)  results.push(db);
  const hs  = detectHeadAndShoulders(data); if (hs)  results.push(hs);
  const ihs = detectInverseHS(data);        if (ihs) results.push(ihs);
  results.push(...detectTriangles(data));
  const bf  = detectBullFlag(data);         if (bf)  results.push(bf);
  const cup = detectCupAndHandle(data);     if (cup) results.push(cup);

  return results.sort((a, b) => b.confidence - a.confidence);
}
