'use client';
import { useCallback, useEffect, useState } from 'react';
import { RotateCcw, Info } from 'lucide-react';
import DatePickerInput from '@/components/DatePickerInput';
import { Account, Transaction, Currency, LotInfo, LotSelection, TaxLotMethod } from '@/lib/types';

interface Props {
  accounts: Account[];
  currency: Currency;
  editingTx: Transaction | null;
  onSubmit: (data: any) => Promise<void>;
  onCancelEdit: () => void;
}

const TX_TYPES = [
  { value: 'buy', label: '주식매수' },
  { value: 'sell', label: '주식매도' },
  { value: 'dividend', label: '배당' },
  { value: 'cash', label: '현금' },
  { value: 'split', label: '주식분할' },
  { value: 'consolidation', label: '주식병합' },
];

const LOT_METHODS: { value: TaxLotMethod; label: string }[] = [
  { value: 'average_cost', label: 'Average Cost' },
  { value: 'fifo', label: 'FIFO (선입선출)' },
  { value: 'lifo', label: 'LIFO (후입선출)' },
  { value: 'specific', label: 'Specific Lot' },
];

const CURRENCY_SYMBOLS: Record<Currency, string> = { USD: '$', KRW: '₩', EUR: '€' };

function todayStr() {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;
}

function ymdToDisplay(ymd: string) {
  if (!ymd) return '';
  const p = ymd.split('-');
  return p.length === 3 ? `${p[1]}/${p[2]}/${p[0]}` : ymd;
}

function displayToYmd(disp: string): string {
  const p = disp.replace(/\s/g, '').split('/');
  return p.length === 3 ? `${p[2]}-${p[0].padStart(2,'0')}-${p[1].padStart(2,'0')}` : disp;
}

function isValidDate(disp: string): boolean {
  const p = disp.split('/');
  if (p.length !== 3) return false;
  const [m, d, y] = p.map(Number);
  return !!(m && d && y && y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31);
}

// ─── Tax Lot Panel ────────────────────────────────────────────────
interface TaxLotPanelProps {
  ticker: string;
  accountId: string | number;
  sellQty: number;
  sellPrice: number;
  method: TaxLotMethod;
  onMethodChange: (m: TaxLotMethod) => void;
  specificSelections: Record<string | number, string>;
  onSpecificChange: (lotId: string | number, qty: string) => void;
  currency: Currency;
}

function TaxLotPanel({
  ticker, accountId, sellQty, sellPrice, method, onMethodChange,
  specificSelections, onSpecificChange, currency,
}: TaxLotPanelProps) {
  const [lots, setLots] = useState<LotInfo[]>([]);
  const [autoSelected, setAutoSelected] = useState<LotSelection[]>([]);
  const [costPerShare, setCostPerShare] = useState(0);
  const [avgCostAll, setAvgCostAll] = useState(0);
  const [loading, setLoading] = useState(false);
  const sym = CURRENCY_SYMBOLS[currency];

  const fetchLots = useCallback(async () => {
    if (!ticker || !accountId) return;
    setLoading(true);
    const q = new URLSearchParams({
      ticker,
      account_id: String(accountId),
      sell_qty: String(sellQty || 0),
      method,
    });
    try {
      const res = await fetch(`/api/lots?${q}`);
      const data = await res.json();
      setLots(data.lots || []);
      setAutoSelected(data.selected || []);
      setCostPerShare(data.cost_per_share || 0);
      setAvgCostAll(data.avg_cost_all || 0);
    } finally { setLoading(false); }
  }, [ticker, accountId, sellQty, method]);

  useEffect(() => { fetchLots(); }, [fetchLots]);

  // Specific lot total
  const specificTotal = Object.entries(specificSelections)
    .reduce((s, [lotId, qtyStr]) => {
      const lot = lots.find(l => l.id === Number(lotId));
      return s + (lot ? (parseFloat(qtyStr) || 0) * lot.price : 0);
    }, 0);
  const specificQty = Object.values(specificSelections).reduce((s, v) => s + (parseFloat(v) || 0), 0);
  const specificCostPerShare = specificQty > 0 ? specificTotal / specificQty : 0;

  const activeCostPerShare = method === 'specific' ? specificCostPerShare : costPerShare;
  const activeTotalCost = method === 'specific' ? specificTotal : activeCostPerShare * (sellQty || 0);
  const pnl = sellQty > 0 && sellPrice > 0 ? sellPrice * sellQty - activeTotalCost : null;

  if (loading && lots.length === 0) {
    return (
      <div style={{ padding: '10px 0', color: 'var(--muted)', fontSize: 12 }}>
        로트 정보 로딩 중...
      </div>
    );
  }

  if (lots.length === 0 && !loading) {
    return (
      <div style={{ padding: '10px 0', color: 'var(--red)', fontSize: 12 }}>
        {ticker ? `${ticker} 보유 로트 없음` : '종목을 입력하세요'}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 14, padding: 14, background: 'rgba(99,102,241,0.06)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.18)' }}>
      {/* Method selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12, color: 'var(--muted)', whiteSpace: 'nowrap' }}>Tax Lot 방식</label>
        <div style={{ display: 'flex', gap: 4 }}>
          {LOT_METHODS.map(m => (
            <button key={m.value} type="button"
              onClick={() => onMethodChange(m.value)}
              style={{
                padding: '4px 10px', fontSize: 12, fontWeight: 500,
                background: method === m.value ? 'var(--accent)' : 'var(--border)',
                color: method === m.value ? 'white' : 'var(--muted)',
                borderRadius: 4,
              }}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary bar */}
      {activeCostPerShare > 0 && (
        <div style={{ display: 'flex', gap: 20, marginBottom: method === 'specific' ? 12 : 0, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--muted)' }}>
            평균단가 (전체): <strong style={{ color: 'var(--text)' }}>{sym}{avgCostAll.toFixed(2)}</strong>
          </span>
          {method !== 'specific' && (
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              선택 로트 원가: <strong style={{ color: 'var(--text)' }}>{sym}{activeCostPerShare.toFixed(2)}/주</strong>
            </span>
          )}
          {method === 'specific' && specificQty > 0 && (
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              선택 원가: <strong style={{ color: 'var(--text)' }}>{sym}{specificCostPerShare.toFixed(2)}/주</strong>
            </span>
          )}
          {pnl !== null && (
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              예상 손익:{' '}
              <strong style={{ color: pnl >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {pnl >= 0 ? '+' : ''}{sym}{pnl.toFixed(2)}
                {activeTotalCost > 0 ? ` (${((pnl / activeTotalCost) * 100).toFixed(1)}%)` : ''}
              </strong>
            </span>
          )}
        </div>
      )}

      {/* FIFO / LIFO auto-selection preview */}
      {(method === 'fifo' || method === 'lifo') && autoSelected.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>자동 선택 로트:</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {autoSelected.map((sel, i) => {
              const lot = lots.find(l => l.id === sel.buy_tx_id);
              if (!lot) return null;
              return (
                <div key={i} style={{ display: 'flex', gap: 12, fontSize: 12, background: 'rgba(99,102,241,0.1)', padding: '5px 10px', borderRadius: 4 }}>
                  <span style={{ color: 'var(--muted)' }}>{lot.date}</span>
                  <span>{sel.quantity.toLocaleString()}주</span>
                  <span style={{ color: 'var(--muted)' }}>@ {sym}{sel.price.toFixed(2)}</span>
                  <span style={{ marginLeft: 'auto', color: 'var(--accent)' }}>
                    원가 {sym}{(sel.quantity * sel.price).toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Specific Lot picker */}
      {method === 'specific' && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', marginTop: 4 }}>
            <thead>
              <tr>
                <th style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', textAlign: 'left', padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>매입일</th>
                <th style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', textAlign: 'right', padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>단가</th>
                <th style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', textAlign: 'right', padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>잔여 수량</th>
                <th style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', textAlign: 'right', padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>매도 수량</th>
                <th style={{ fontSize: 11, fontWeight: 500, color: 'var(--muted)', textAlign: 'right', padding: '4px 8px', borderBottom: '1px solid var(--border)' }}>원가</th>
              </tr>
            </thead>
            <tbody>
              {lots.map(lot => {
                const useQty = parseFloat(specificSelections[lot.id] || '0') || 0;
                return (
                  <tr key={lot.id} style={{ background: useQty > 0 ? 'rgba(99,102,241,0.08)' : 'transparent' }}>
                    <td style={{ fontSize: 12, padding: '5px 8px', color: 'var(--muted)' }}>{lot.date}</td>
                    <td style={{ fontSize: 12, padding: '5px 8px', textAlign: 'right' }}>{sym}{lot.price.toFixed(2)}</td>
                    <td style={{ fontSize: 12, padding: '5px 8px', textAlign: 'right' }}>
                      {lot.remaining.toLocaleString()}
                    </td>
                    <td style={{ padding: '4px 8px', textAlign: 'right' }}>
                      <input
                        type="number" step="any" min="0" max={lot.remaining}
                        value={specificSelections[lot.id] || ''}
                        onChange={e => onSpecificChange(lot.id, e.target.value)}
                        style={{ width: 80, textAlign: 'right', padding: '3px 6px', fontSize: 12 }}
                        placeholder="0"
                      />
                    </td>
                    <td style={{ fontSize: 12, padding: '5px 8px', textAlign: 'right', color: useQty > 0 ? 'var(--accent)' : 'var(--muted)' }}>
                      {useQty > 0 ? `${sym}${(useQty * lot.price).toFixed(2)}` : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {/* Qty validation */}
          {sellQty > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, textAlign: 'right' }}>
              선택: <strong style={{ color: specificQty === sellQty ? 'var(--green)' : specificQty > sellQty ? 'var(--red)' : 'var(--text)' }}>
                {specificQty}
              </strong> / {sellQty}주
              {specificQty > sellQty && <span style={{ color: 'var(--red)', marginLeft: 6 }}>초과</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Form ────────────────────────────────────────────────────
export default function TransactionForm({ accounts, currency, editingTx, onSubmit, onCancelEdit }: Props) {
  const visibleAccounts = accounts.filter(a => !a.hidden);

  const [type, setType] = useState('buy');
  const [accountId, setAccountId] = useState<string | number>(visibleAccounts[0]?.id ?? '');
  const [ticker, setTicker] = useState('');
  const [date, setDate] = useState(todayStr());
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [fee, setFee] = useState('');
  const [notes, setNotes] = useState('');
  const [reinvest, setReinvest] = useState(false);
  const [reinvestQty, setReinvestQty] = useState('');
  const [reinvestPrice, setReinvestPrice] = useState('');
  const [optionType, setOptionType] = useState('call');
  const [optionAction, setOptionAction] = useState('sell');
  const [strike, setStrike] = useState('');
  const [expiry, setExpiry] = useState('');
  const [loading, setLoading] = useState(false);
  const [dateError, setDateError] = useState('');

  // Tax lot state (sell only)
  const [lotMethod, setLotMethod] = useState<TaxLotMethod>('average_cost');
  const [specificSelections, setSpecificSelections] = useState<Record<string | number, string>>({});

  useEffect(() => {
    if (editingTx) {
      setType(editingTx.type);
      setAccountId(editingTx.account_id);
      setTicker(editingTx.ticker);
      setDate(ymdToDisplay(editingTx.date));
      setQty(editingTx.quantity > 0 ? String(editingTx.quantity) : '');
      setPrice(editingTx.price > 0 ? String(editingTx.price) : '');
      setFee(editingTx.fee > 0 ? String(editingTx.fee) : '');
      setNotes(editingTx.notes || '');
    }
  }, [editingTx]);

  useEffect(() => {
    if (!editingTx && visibleAccounts.length > 0) setAccountId(visibleAccounts[0].id);
  }, [accounts]);

  // Reset specific selections when ticker/account/method changes
  useEffect(() => { setSpecificSelections({}); }, [ticker, accountId, lotMethod]);

  const reset = () => {
    setType('buy'); setTicker(''); setDate(todayStr());
    setQty(''); setPrice(''); setFee(''); setNotes('');
    setReinvest(false); setReinvestQty(''); setReinvestPrice('');
    setStrike(''); setExpiry(''); setDateError('');
    setLotMethod('average_cost'); setSpecificSelections({});
    if (visibleAccounts.length > 0) setAccountId(visibleAccounts[0].id);
  };

  const handleSpecificChange = (lotId: number, val: string) => {
    setSpecificSelections(prev => ({ ...prev, [lotId]: val }));
  };

  const validateDate = (val: string) => {
    setDateError(isValidDate(val) ? '' : '날짜 형식: MM/DD/YYYY');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidDate(date)) { setDateError('날짜 형식: MM/DD/YYYY'); return; }

    if (type === 'sell' && lotMethod === 'specific') {
      const selectedQty = Object.values(specificSelections).reduce((s, v) => s + (parseFloat(v) || 0), 0);
      const sellQtyNum = parseFloat(qty || '0');
      if (Math.abs(selectedQty - sellQtyNum) > 0.0001) {
        alert(`선택 수량(${selectedQty})이 매도 수량(${sellQtyNum})과 다릅니다.`);
        return;
      }
    }

    if ((type === 'split' || type === 'consolidation') && parseFloat(qty || '0') <= 1) {
      alert('비율은 1보다 큰 숫자여야 합니다. (예: 2:1 분할이면 2 입력)');
      return;
    }

    setLoading(true);
    try {
      const ymd = displayToYmd(date);
      if (type === 'split' || type === 'consolidation') {
        await onSubmit({
          account_id: accountId, date: ymd,
          ticker: ticker.toUpperCase(),
          type, quantity: parseFloat(qty), price: 0, fee: 0, notes: '',
        });
        if (!editingTx) reset();
        return;
      }
      if (type === 'option') {
        await onSubmit({
          account_id: accountId, date: ymd, ticker: ticker.toUpperCase(),
          type: 'option', option_type: optionType, action: optionAction,
          strike: parseFloat(strike), expiry, quantity: parseInt(qty || '1'),
          premium: parseFloat(price || '0'), fee: parseFloat(fee || '0'),
          is_option: true,
        });
      } else {
        const lot_assignments = type === 'sell' && lotMethod === 'specific'
          ? Object.entries(specificSelections)
              .filter(([, v]) => parseFloat(v) > 0)
              .map(([id, v]) => ({ buy_tx_id: Number(id), quantity: parseFloat(v) }))
          : undefined;

        await onSubmit({
          account_id: accountId, date: ymd,
          ticker: type === 'cash' ? '' : ticker.toUpperCase(),
          type, quantity: parseFloat(qty || '0'), price: parseFloat(price || '0'),
          fee: parseFloat(fee || '0'), notes,
          lot_method: type === 'sell' ? lotMethod : undefined,
          lot_assignments,
          reinvest: type === 'dividend' ? reinvest : false,
          reinvest_qty: reinvest ? parseFloat(reinvestQty || '0') : 0,
          reinvest_price: reinvest ? parseFloat(reinvestPrice || '0') : 0,
        });
      }
      if (!editingTx) reset();
    } finally { setLoading(false); }
  };

  const sym = CURRENCY_SYMBOLS[currency];
  const isEditing = !!editingTx;
  const sellQtyNum = parseFloat(qty || '0');

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
          {isEditing ? `✏️ 수정 중 #${editingTx?.id}` : '거래 입력'}
        </h3>
        {isEditing && (
          <button className="btn-secondary btn-sm" onClick={onCancelEdit} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <RotateCcw size={12} /> 취소
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-row" style={{ rowGap: 12 }}>
          {/* Type */}
          <div className="form-group">
            <label>거래유형</label>
            <select value={type} onChange={e => { setType(e.target.value); setReinvest(false); setLotMethod('average_cost'); }} style={{ minWidth: 100 }}>
              {TX_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Account */}
          <div className="form-group">
            <label>계좌</label>
            <select value={accountId} onChange={e => setAccountId(e.target.value)} style={{ minWidth: 130 }}>
              {visibleAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          {/* Ticker */}
          {type !== 'cash' && (
            <div className="form-group">
              <label>종목</label>
              <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())}
                placeholder="AAPL" style={{ width: 90 }} required />
            </div>
          )}

          {/* Date */}
          <div className="form-group">
            <label>날짜</label>
            <DatePickerInput
              value={date}
              onChange={val => { setDate(val); validateDate(val); }}
              error={dateError}
            />
          </div>

          {/* Ratio (split / consolidation) */}
          {(type === 'split' || type === 'consolidation') && (
            <div className="form-group">
              <label>{type === 'split' ? '분할 비율' : '병합 비율'}</label>
              <input value={qty} onChange={e => setQty(e.target.value)}
                type="number" step="any" min="1.0001" placeholder={type === 'split' ? '2 (2:1)' : '10 (1:10)'}
                style={{ width: 100 }} required title="1보다 큰 숫자 입력 (예: 2:1 분할이면 2)" />
            </div>
          )}

          {/* Quantity */}
          {type !== 'cash' && type !== 'dividend' && type !== 'split' && type !== 'consolidation' && (
            <div className="form-group">
              <label>수량{type === 'option' ? ' (계약)' : ''}</label>
              <input value={qty} onChange={e => setQty(e.target.value)}
                type="number" step="any" min="0" placeholder="0" style={{ width: 80 }} />
            </div>
          )}

          {/* Price */}
          {type !== 'split' && type !== 'consolidation' && (
            <div className="form-group">
              <label>
                {type === 'cash' ? `금액 (${sym})` : type === 'dividend' ? `배당금 (${sym})` : type === 'option' ? `프리미엄 (${sym})` : `단가 (${sym})`}
              </label>
              <input value={price} onChange={e => setPrice(e.target.value)}
                type="number" step="any" min="0" placeholder="0.00" style={{ width: 100 }} />
            </div>
          )}

          {/* Fee */}
          {type !== 'cash' && type !== 'split' && type !== 'consolidation' && (
            <div className="form-group">
              <label>수수료 ({sym})</label>
              <input value={fee} onChange={e => setFee(e.target.value)}
                type="number" step="any" min="0" placeholder="0" style={{ width: 80 }} />
            </div>
          )}

          {/* Option-specific fields */}
          {type === 'option' && (
            <>
              <div className="form-group">
                <label>유형</label>
                <select value={optionType} onChange={e => setOptionType(e.target.value)} style={{ width: 80 }}>
                  <option value="call">Call</option>
                  <option value="put">Put</option>
                </select>
              </div>
              <div className="form-group">
                <label>방향</label>
                <select value={optionAction} onChange={e => setOptionAction(e.target.value)} style={{ width: 80 }}>
                  <option value="sell">STO</option>
                  <option value="buy">BTO</option>
                </select>
              </div>
              <div className="form-group">
                <label>행사가</label>
                <input value={strike} onChange={e => setStrike(e.target.value)}
                  type="number" step="any" placeholder="0" style={{ width: 80 }} />
              </div>
              <div className="form-group">
                <label>만기 (YYYY-MM-DD)</label>
                <input value={expiry} onChange={e => setExpiry(e.target.value)}
                  placeholder="2025-01-17" style={{ width: 120 }} />
              </div>
            </>
          )}

          {/* Submit */}
          <div className="form-group" style={{ justifyContent: 'flex-end' }}>
            <label>&nbsp;</label>
            <button type="submit" className="btn-primary" disabled={loading} style={{ minWidth: 80 }}>
              {loading ? '처리중...' : isEditing ? '업데이트' : '저장'}
            </button>
          </div>
        </div>

        {/* Tax Lot Panel — sell only */}
        {type === 'sell' && !isEditing && ticker && (
          <TaxLotPanel
            ticker={ticker}
            accountId={accountId}
            sellQty={sellQtyNum}
            sellPrice={parseFloat(price || '0')}
            method={lotMethod}
            onMethodChange={m => { setLotMethod(m); setSpecificSelections({}); }}
            specificSelections={specificSelections}
            onSpecificChange={handleSpecificChange}
            currency={currency}
          />
        )}

        {/* Dividend reinvestment */}
        {type === 'dividend' && (
          <div style={{ marginTop: 12, padding: 12, background: 'rgba(99,102,241,0.08)', borderRadius: 8, border: '1px solid rgba(99,102,241,0.2)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: reinvest ? 10 : 0 }}>
              <input type="checkbox" checked={reinvest} onChange={e => setReinvest(e.target.checked)} />
              <span style={{ fontSize: 13, fontWeight: 500 }}>배당 재투자</span>
            </label>
            {reinvest && (
              <div className="form-row" style={{ marginTop: 8 }}>
                <div className="form-group">
                  <label>재투자 수량</label>
                  <input value={reinvestQty} onChange={e => setReinvestQty(e.target.value)}
                    type="number" step="any" min="0" placeholder="0" style={{ width: 80 }} required />
                </div>
                <div className="form-group">
                  <label>재투자 단가 ({sym})</label>
                  <input value={reinvestPrice} onChange={e => setReinvestPrice(e.target.value)}
                    type="number" step="any" min="0" placeholder="0.00" style={{ width: 100 }} required />
                </div>
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
