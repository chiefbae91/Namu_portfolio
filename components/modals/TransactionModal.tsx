'use client';
import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Account, Transaction, Currency, LotInfo, LotSelection, TaxLotMethod } from '@/lib/types';
import { formatPriceInput, parsePriceInput } from '@/lib/format';
import DatePickerInput from '@/components/DatePickerInput';

interface Props {
  accounts: Account[];
  currency: Currency;
  editingTx: Transaction | null;
  onSubmit: (data: any) => Promise<void>;
  onClose: () => void;
  prefillTicker?: string;
  prefillAccountId?: number;
}

const TX_TYPES = [
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
  { value: 'dividend', label: 'Dividend' },
  { value: 'transfer', label: 'Transfer' },
];

const LOT_METHODS: { value: TaxLotMethod; label: string }[] = [
  { value: 'average_cost', label: 'Average Cost' },
  { value: 'fifo', label: 'FIFO' },
  { value: 'lifo', label: 'LIFO' },
  { value: 'specific', label: 'Specific Lot' },
];

const SYM: Record<Currency, string> = { USD: '$', KRW: '₩', EUR: '€' };

function todayStr() {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;
}
function ymdToDisplay(ymd: string) {
  const p = ymd?.split('-');
  return p?.length === 3 ? `${p[1]}/${p[2]}/${p[0]}` : (ymd ?? '');
}
function displayToYmd(disp: string) {
  const p = disp.replace(/\s/g,'').split('/');
  return p.length === 3 ? `${p[2]}-${p[0].padStart(2,'0')}-${p[1].padStart(2,'0')}` : disp;
}
function isValidDate(d: string) {
  const p = d.split('/');
  if (p.length !== 3) return false;
  const [m, day, y] = p.map(Number);
  return !!(m && day && y && y>=1900 && y<=2100 && m>=1 && m<=12 && day>=1 && day<=31);
}

// ─── Tax Lot Panel ────────────────────────────────────────────────
function TaxLotPanel({ ticker, accountId, sellQty, sellPrice, method, onMethodChange, specificSelections, onSpecificChange, currency }: {
  ticker: string; accountId: number; sellQty: number; sellPrice: number;
  method: TaxLotMethod; onMethodChange: (m: TaxLotMethod) => void;
  specificSelections: Record<number, string>; onSpecificChange: (id: number, v: string) => void;
  currency: Currency;
}) {
  const [lots, setLots] = useState<LotInfo[]>([]);
  const [autoSelected, setAutoSelected] = useState<LotSelection[]>([]);
  const [costPerShare, setCostPerShare] = useState(0);
  const [avgCostAll, setAvgCostAll] = useState(0);
  const sym = SYM[currency];
  const fmtAmt = (v: number) => `${sym}${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const fetchLots = useCallback(async () => {
    if (!ticker || !accountId) return;
    const q = new URLSearchParams({ ticker, account_id: String(accountId), sell_qty: String(sellQty||0), method });
    const res = await fetch(`/api/lots?${q}`);
    const data = await res.json();
    setLots(data.lots || []); setAutoSelected(data.selected || []);
    setCostPerShare(data.cost_per_share || 0); setAvgCostAll(data.avg_cost_all || 0);
  }, [ticker, accountId, sellQty, method]);

  useEffect(() => { fetchLots(); }, [fetchLots]);

  const specificQty = Object.values(specificSelections).reduce((s,v) => s+(parseFloat(v)||0), 0);
  const specificCost = Object.entries(specificSelections).reduce((s,[id,v]) => {
    const lot = lots.find(l=>l.id===Number(id));
    return s + (lot ? (parseFloat(v)||0)*lot.price : 0);
  }, 0);
  const activeCps = method==='specific' ? (specificQty>0 ? specificCost/specificQty : 0) : costPerShare;
  const activeCost = method==='specific' ? specificCost : activeCps*(sellQty||0);
  const pnl = sellQty>0 && sellPrice>0 ? sellPrice*sellQty - activeCost : null;

  if (!ticker) return null;
  if (lots.length === 0) return (
    <div style={{ fontSize:12, color:'var(--muted)', marginTop:10 }}>No lots found</div>
  );

  return (
    <div style={{ marginTop:14, padding:14, background:'rgba(99,102,241,0.06)', borderRadius:8, border:'1px solid rgba(99,102,241,0.18)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:10, flexWrap:'wrap' }}>
        <span style={{ fontSize:12, color:'var(--muted)' }}>Tax Lot</span>
        {LOT_METHODS.map(m => (
          <button key={m.value} type="button" onClick={() => onMethodChange(m.value)}
            style={{ padding:'3px 9px', fontSize:11, fontWeight:500, borderRadius:4,
              background: method===m.value ? 'var(--accent)' : 'var(--border)',
              color: method===m.value ? 'white' : 'var(--muted)' }}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div style={{ display:'flex', gap:16, flexWrap:'wrap', marginBottom: method==='specific' ? 10 : 0 }}>
        <span style={{ fontSize:12, color:'var(--muted)' }}>Avg Cost All: <strong style={{ color:'var(--text)' }}>{fmtAmt(avgCostAll)}</strong></span>
        {activeCps > 0 && method !== 'specific' && (
          <span style={{ fontSize:12, color:'var(--muted)' }}>Selected Cost: <strong style={{ color:'var(--text)' }}>{fmtAmt(activeCps)}/sh</strong></span>
        )}
        {method==='specific' && specificQty>0 && (
          <span style={{ fontSize:12, color:'var(--muted)' }}>Selected Cost: <strong style={{ color:'var(--text)' }}>{fmtAmt(activeCps)}/sh</strong></span>
        )}
        {pnl !== null && (
          <span style={{ fontSize:12, color:'var(--muted)' }}>Est. P&amp;L:{' '}
            <strong style={{ color: pnl>=0 ? 'var(--green)' : 'var(--red)' }}>
              {pnl>=0?'+':''}{fmtAmt(pnl)}
              {activeCost>0 ? ` (${((pnl/activeCost)*100).toFixed(1)}%)` : ''}
            </strong>
          </span>
        )}
      </div>

      {/* FIFO/LIFO preview */}
      {(method==='fifo'||method==='lifo') && autoSelected.length>0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
          {autoSelected.map((sel,i) => {
            const lot = lots.find(l=>l.id===sel.buy_tx_id);
            if (!lot) return null;
            return (
              <div key={i} style={{ display:'flex', gap:12, fontSize:12, background:'rgba(99,102,241,0.1)', padding:'4px 10px', borderRadius:4 }}>
                <span style={{ color:'var(--muted)' }}>{lot.date}</span>
                <span>{sel.quantity}주 @ {fmtAmt(sel.price)}</span>
                <span style={{ marginLeft:'auto', color:'var(--accent)' }}>{fmtAmt(sel.quantity*sel.price)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Specific Lot table */}
      {method==='specific' && (
        <>
          <table style={{ width:'100%' }}>
            <thead>
              <tr>
                {['Date','Price','Remaining','Sell Qty','Cost'].map(h => (
                  <th key={h} style={{ fontSize:11, color:'var(--muted)', padding:'4px 6px', borderBottom:'1px solid var(--border)', textAlign: h==='Date' ? 'left' : 'right' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lots.map(lot => {
                const useQty = parseFloat(specificSelections[lot.id]||'0')||0;
                return (
                  <tr key={lot.id} style={{ background: useQty>0 ? 'rgba(99,102,241,0.08)' : 'transparent' }}>
                    <td style={{ fontSize:12, padding:'4px 6px', color:'var(--muted)' }}>{lot.date}</td>
                    <td style={{ fontSize:12, padding:'4px 6px', textAlign:'right' }}>{fmtAmt(lot.price)}</td>
                    <td style={{ fontSize:12, padding:'4px 6px', textAlign:'right' }}>{lot.remaining}</td>
                    <td style={{ padding:'3px 6px', textAlign:'right' }}>
                      <input type="number" step="any" min="0" max={lot.remaining}
                        value={specificSelections[lot.id]||''}
                        onChange={e => onSpecificChange(lot.id, e.target.value)}
                        style={{ width:72, textAlign:'right', padding:'2px 6px', fontSize:12 }} placeholder="0" />
                    </td>
                    <td style={{ fontSize:12, padding:'4px 6px', textAlign:'right', color: useQty>0?'var(--accent)':'var(--muted)' }}>
                      {useQty>0 ? fmtAmt(useQty*lot.price) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sellQty>0 && (
            <div style={{ textAlign:'right', fontSize:12, marginTop:6 }}>
              Selected: <strong style={{ color: specificQty===sellQty?'var(--green)':specificQty>sellQty?'var(--red)':'var(--text)' }}>
                {specificQty}
              </strong> / {sellQty} sh
              {specificQty>sellQty && <span style={{ color:'var(--red)', marginLeft:6 }}>Exceeded</span>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────
export default function TransactionModal({ accounts, currency, editingTx, onSubmit, onClose, prefillTicker, prefillAccountId }: Props) {
  const visible = accounts.filter(a => !a.hidden);
  const sym = SYM[currency];
  const isEditing = !!editingTx;

  const [type, setType] = useState('buy');
  const [accountId, setAccountId] = useState<number>(visible[0]?.id ?? 0);
  const [ticker, setTicker] = useState('');
  const [date, setDate] = useState(todayStr());
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [fee, setFee] = useState('');
  const [notes, setNotes] = useState('');
  const [reinvest, setReinvest] = useState(false);
  const [reinvestQty, setReinvestQty] = useState('');
  const [reinvestPrice, setReinvestPrice] = useState('');
  const [lotMethod, setLotMethod] = useState<TaxLotMethod>('average_cost');
  const [specificSelections, setSpecificSelections] = useState<Record<number, string>>({});
  const [transferDir, setTransferDir] = useState<'DEPOSIT' | 'WITHDRAW'>('DEPOSIT');
  const [loading, setLoading] = useState(false);
  const [dateError, setDateError] = useState('');

  // Load editing tx
  useEffect(() => {
    if (editingTx) {
      setType(editingTx.type);
      setAccountId(editingTx.account_id);
      setTicker(editingTx.ticker);
      setDate(ymdToDisplay(editingTx.date));
      setQty(editingTx.quantity > 0 ? String(editingTx.quantity) : '');
      setPrice(editingTx.price > 0 ? formatPriceInput(String(editingTx.price)) : '');
      setFee(editingTx.fee > 0 ? formatPriceInput(String(editingTx.fee)) : '');
      setNotes(editingTx.notes || '');
      // Pre-populate reinvest if this dividend has a linked reinvest record
      if (editingTx.type === 'dividend' && editingTx.reinvest_id) {
        setReinvest(true);
        setReinvestQty(editingTx.reinvest_qty ? String(editingTx.reinvest_qty) : '');
        setReinvestPrice(editingTx.reinvest_price ? formatPriceInput(String(editingTx.reinvest_price)) : '');
      } else {
        setReinvest(false);
        setReinvestQty('');
        setReinvestPrice('');
      }
    } else {
      setType('buy'); setTicker(prefillTicker ?? ''); setDate(todayStr());
      setQty(''); setPrice(''); setFee(''); setNotes('');
      setReinvest(false); setReinvestQty(''); setReinvestPrice('');
      setLotMethod('average_cost'); setSpecificSelections({}); setTransferDir('DEPOSIT');
      if (prefillAccountId) {
        setAccountId(prefillAccountId);
      } else if (visible.length > 0) {
        setAccountId(visible[0].id);
      }
    }
  }, [editingTx]);

  // Reset specific selections on ticker/account/method change
  useEffect(() => { setSpecificSelections({}); }, [ticker, accountId, lotMethod]);

  // ESC to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValidDate(date)) { setDateError('날짜 형식: MM/DD/YYYY'); return; }

    if (type === 'sell' && lotMethod === 'specific') {
      const selQty = Object.values(specificSelections).reduce((s,v) => s+(parseFloat(v)||0), 0);
      if (Math.abs(selQty - (parseFloat(qty)||0)) > 0.0001) {
        alert(`선택 수량(${selQty})이 매도 수량(${qty})과 다릅니다.`);
        return;
      }
    }

    setLoading(true);
    try {
      const ymd = displayToYmd(date);

      if (type === 'transfer') {
        await onSubmit({
          account_id: accountId, date: ymd,
          type: transferDir === 'DEPOSIT' ? 'transfer_deposit' : 'transfer_withdraw',
          price: parsePriceInput(price),
          notes,
        });
      } else {
        const lot_assignments = type==='sell' && lotMethod==='specific'
          ? Object.entries(specificSelections)
              .filter(([,v]) => parseFloat(v)>0)
              .map(([id,v]) => ({ buy_tx_id: Number(id), quantity: parseFloat(v) }))
          : undefined;

        await onSubmit({
          account_id: accountId, date: ymd,
          ticker: ticker.toUpperCase(),
          type, quantity: parseFloat(qty||'0'), price: parsePriceInput(price),
          fee: parsePriceInput(fee), notes,
          lot_method: type==='sell' ? lotMethod : undefined,
          lot_assignments,
          reinvest: type==='dividend' ? reinvest : false,
          reinvest_qty: reinvest ? parseFloat(reinvestQty||'0') : 0,
          reinvest_price: reinvest ? parsePriceInput(reinvestPrice) : 0,
          reinvest_id: isEditing && type==='dividend' ? (editingTx?.reinvest_id ?? null) : undefined,
        });
      }
      onClose();
    } finally { setLoading(false); }
  };

  const sellQtyNum = parseFloat(qty||'0');

  // Dividend and DIVIDEND_REINVEST are not editable via this modal
  if (isEditing && (editingTx!.type === 'dividend' || editingTx!.subtype === 'DIVIDEND_REINVEST')) {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal" style={{ maxWidth: 400, textAlign: 'center' }} onClick={e => e.stopPropagation()}>
          <h3 style={{ margin: '0 0 10px', fontSize: 16 }}>Not Editable</h3>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 20px' }}>
            Dividend and dividend reinvest trades cannot be edited directly.<br />
            Please delete and re-enter.
          </p>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          {/* Header */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
            <h2 style={{ margin:0, fontSize:17, fontWeight:700 }}>
              {isEditing ? `Edit Trade #${editingTx!.id}` : 'Add Trade'}
            </h2>
            <button type="button" onClick={onClose} style={{ background:'none', color:'var(--muted)', padding:4 }}>
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {/* Type selector */}
            <div className="form-group">
              <label>Type</label>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {TX_TYPES.map(t => (
                  <button key={t.value} type="button"
                    onClick={() => { setType(t.value); setReinvest(false); setLotMethod('average_cost'); }}
                    style={{ padding:'6px 14px', fontWeight:500, fontSize:13, borderRadius:6,
                      background: type===t.value ? 'var(--accent)' : 'var(--border)',
                      color: type===t.value ? 'white' : 'var(--muted)' }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Row: Account + Ticker */}
            <div className="form-row">
              <div className="form-group" style={{ flex:1 }}>
                <label>Account</label>
                <select value={accountId} onChange={e => setAccountId(Number(e.target.value))} style={{ width:'100%' }}>
                  {visible.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              {type !== 'transfer' && (
                <div className="form-group" style={{ flex:1 }}>
                  <label>Symbol</label>
                  <input value={ticker} onChange={e => !prefillTicker && setTicker(e.target.value.toUpperCase())}
                    placeholder="AAPL" style={{ width:'100%', opacity: prefillTicker ? 0.7 : 1 }}
                    readOnly={!!prefillTicker} required />
                </div>
              )}
            </div>

            {/* Row: Date + Qty + Price + Fee */}
            <div className="form-row">
              <div className="form-group">
                <label>Date</label>
                <DatePickerInput
                  value={date}
                  onChange={val => { setDate(val); setDateError(isValidDate(val) ? '' : 'Format: MM/DD/YYYY'); }}
                  error={dateError}
                />
              </div>

              {type === 'transfer' && (
                <div className="form-group">
                  <label>Direction</label>
                  <select value={transferDir} onChange={e => setTransferDir(e.target.value as 'DEPOSIT' | 'WITHDRAW')}
                    style={{ width: 160 }}>
                    <option value="DEPOSIT">Deposit</option>
                    <option value="WITHDRAW">Withdraw</option>
                  </select>
                </div>
              )}

              {type !== 'transfer' && type !== 'dividend' && (
                <div className="form-group">
                  <label>Shares</label>
                  <input value={qty} onChange={e => setQty(e.target.value)}
                    type="number" step="any" min="0" placeholder="0" style={{ width:90 }} />
                </div>
              )}

              <div className="form-group">
                <label>{type==='transfer'?`Amount (${sym})`:type==='dividend'?`Dividend (${sym})`:`Price (${sym})`}</label>
                <input value={price} onChange={e => setPrice(formatPriceInput(e.target.value))}
                  type="text" inputMode="decimal" placeholder="0.00" style={{ width:110 }} required />
              </div>

              {type !== 'transfer' && (
                <div className="form-group">
                  <label>Fee ({sym})</label>
                  <input value={fee} onChange={e => setFee(formatPriceInput(e.target.value))}
                    type="text" inputMode="decimal" placeholder="0" style={{ width:90 }} />
                </div>
              )}
            </div>

            {/* Note */}
            <div className="form-group">
              <label>Note</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="Trade notes (optional)"
                rows={2}
                style={{ width:'100%', resize:'vertical', fontFamily:'inherit', fontSize:13 }} />
            </div>

            {/* Tax Lot (sell only) */}
            {type==='sell' && !isEditing && ticker && (
              <TaxLotPanel
                ticker={ticker} accountId={accountId}
                sellQty={sellQtyNum} sellPrice={parseFloat(price||'0')}
                method={lotMethod} onMethodChange={m => { setLotMethod(m); setSpecificSelections({}); }}
                specificSelections={specificSelections} onSpecificChange={(id,v) => setSpecificSelections(p => ({...p,[id]:v}))}
                currency={currency}
              />
            )}

            {/* Dividend reinvestment */}
            {type==='dividend' && (
              <div style={{ padding:12, background:'rgba(99,102,241,0.08)', borderRadius:8, border:'1px solid rgba(99,102,241,0.2)' }}>
                <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
                  <input type="checkbox" checked={reinvest} onChange={e => setReinvest(e.target.checked)} />
                  <span style={{ fontSize:13, fontWeight:500 }}>Reinvest Dividend</span>
                </label>
                {reinvest && (
                  <div className="form-row" style={{ marginTop:10 }}>
                    <div className="form-group">
                      <label>Reinvest Shares</label>
                      <input value={reinvestQty} onChange={e => setReinvestQty(e.target.value)}
                        type="number" step="any" min="0" placeholder="0" style={{ width:90 }} required />
                    </div>
                    <div className="form-group">
                      <label>Reinvest Price ({sym})</label>
                      <input value={reinvestPrice} onChange={e => setReinvestPrice(formatPriceInput(e.target.value))}
                        type="text" inputMode="decimal" placeholder="0.00" style={{ width:110 }} required />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ display:'flex', justifyContent:'flex-end', gap:10, marginTop:24, paddingTop:16, borderTop:'1px solid var(--border)' }}>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading} style={{ minWidth:90 }}>
              {loading ? 'Saving...' : isEditing ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
