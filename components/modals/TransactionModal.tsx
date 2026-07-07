'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { Account, Transaction, Currency, CsvPreviewRow, LotInfo, LotSelection, TaxLotMethod } from '@/lib/types';
import { formatPriceInput, parsePriceInput } from '@/lib/format';
import DatePickerInput from '@/components/DatePickerInput';
import TickerTypeahead from '@/components/TickerTypeahead';

interface Props {
  accounts: Account[];
  currency: Currency;
  editingTx: Transaction | null;
  onSubmit: (data: any) => Promise<void>;
  onClose: () => void;
  onImported?: () => void;
  prefillTicker?: string;
  prefillAccountId?: string | number;
  tickerSuggestions?: string[];
}

const TX_TYPES = [
  { value: 'buy', label: 'Buy' },
  { value: 'sell', label: 'Sell' },
  { value: 'dividend', label: 'Dividend' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'split', label: 'Split' },
  { value: 'consolidation', label: 'Reverse Split' },
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
  ticker: string; accountId: string | number; sellQty: number; sellPrice: number;
  method: TaxLotMethod; onMethodChange: (m: TaxLotMethod) => void;
  specificSelections: Record<string | number, string>; onSpecificChange: (id: string | number, v: string) => void;
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
    const lot = lots.find(l=>l.id===id);
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

// ─── CSV type helpers ─────────────────────────────────────────────
const CSV_TYPE_LABEL: Record<string, string> = {
  buy: 'Buy', sell: 'Sell', dividend: 'Dividend', cash: 'Cash',
  transfer_deposit: 'Deposit', transfer_withdraw: 'Withdraw', skip: 'Skip',
};
const CSV_TYPE_COLOR: Record<string, string> = {
  buy: 'var(--green)', sell: 'var(--red)', dividend: 'var(--color-dividend)',
  cash: 'var(--color-cash)', transfer_deposit: 'var(--green)', transfer_withdraw: 'var(--red)',
  skip: 'var(--muted)',
};
const CSV_FORMAT_LABEL: Record<string, string> = {
  ib: 'Interactive Brokers', robinhood: 'Robinhood', webull: 'Webull', new: 'Generic', fidelity: 'Fidelity',
};

// ─── Modal ────────────────────────────────────────────────────────
export default function TransactionModal({ accounts, currency, editingTx, onSubmit, onClose, onImported, prefillTicker, prefillAccountId, tickerSuggestions = [] }: Props) {
  const visible = accounts.filter(a => !a.hidden);
  const sym = SYM[currency];
  const isEditing = !!editingTx;

  // ── mode ──────────────────────────────────────────────────────
  const [mode, setMode] = useState<'manual' | 'csv'>('manual');

  // ── manual form state ─────────────────────────────────────────
  const [type, setType] = useState('buy');
  const [accountId, setAccountId] = useState<string | number>(visible[0]?.id ?? '');
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
  const [specificSelections, setSpecificSelections] = useState<Record<string | number, string>>({});
  const [transferDir, setTransferDir] = useState<'DEPOSIT' | 'WITHDRAW'>('DEPOSIT');
  const [loading, setLoading] = useState(false);
  const [dateError, setDateError] = useState('');

  // ── CSV import state ──────────────────────────────────────────
  const csvFileRef = useRef<HTMLInputElement>(null);
  const [csvPreview, setCsvPreview] = useState<CsvPreviewRow[] | null>(null);
  const [csvTotal, setCsvTotal] = useState(0);
  const [csvFormat, setCsvFormat] = useState('');
  const [csvNeedsTicker, setCsvNeedsTicker] = useState(false);
  const [csvTicker, setCsvTicker] = useState('');
  const [csvError, setCsvError] = useState('');
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvResult, setCsvResult] = useState<{ imported: number } | null>(null);

  // ── Load editing tx ───────────────────────────────────────────
  const skipSpecificResetRef = useRef(false);
  useEffect(() => {
    skipSpecificResetRef.current = true;
    if (editingTx) {
      if (editingTx.type === 'transfer_deposit' || editingTx.type === 'transfer_withdraw') {
        setType('transfer');
        setTransferDir(editingTx.type === 'transfer_deposit' ? 'DEPOSIT' : 'WITHDRAW');
      } else {
        setType(editingTx.type);
      }
      setAccountId(editingTx.account_id);
      setTicker(editingTx.ticker);
      setDate(ymdToDisplay(editingTx.date));
      setQty(editingTx.quantity > 0 ? String(editingTx.quantity) : '');
      setPrice(editingTx.price > 0 ? formatPriceInput(String(editingTx.price)) : '');
      setFee(editingTx.fee > 0 ? formatPriceInput(String(editingTx.fee)) : '');
      setNotes(editingTx.notes || '');
      if (editingTx.type === 'dividend' && editingTx.reinvest_id) {
        setReinvest(true);
        setReinvestQty(editingTx.reinvest_qty ? String(editingTx.reinvest_qty) : '');
        setReinvestPrice(editingTx.reinvest_price ? formatPriceInput(String(editingTx.reinvest_price)) : '');
      } else {
        setReinvest(false); setReinvestQty(''); setReinvestPrice('');
      }
      if (editingTx.type === 'sell') {
        const method = editingTx.lot_method ?? 'average_cost';
        setLotMethod(method);
        setSpecificSelections(method === 'specific' && editingTx.lot_assignments
          ? Object.fromEntries(editingTx.lot_assignments.map(a => [a.buy_tx_id, String(a.quantity)]))
          : {});
      } else {
        setLotMethod('average_cost'); setSpecificSelections({});
      }
    } else {
      setType('buy'); setTicker(prefillTicker ?? ''); setDate(todayStr());
      setQty(''); setPrice(''); setFee(''); setNotes('');
      setReinvest(false); setReinvestQty(''); setReinvestPrice('');
      setLotMethod('average_cost'); setSpecificSelections({}); setTransferDir('DEPOSIT');
      if (prefillAccountId) setAccountId(prefillAccountId);
      else if (visible.length > 0) setAccountId(visible[0].id);
    }
  }, [editingTx]);

  useEffect(() => {
    if (skipSpecificResetRef.current) { skipSpecificResetRef.current = false; return; }
    setSpecificSelections({});
  }, [ticker, accountId, lotMethod]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // ── CSV helpers ───────────────────────────────────────────────
  const buildCsvFd = (tickerVal: string, action?: string) => {
    const fd = new FormData();
    fd.append('file', csvFileRef.current!.files![0]);
    fd.append('account_id', String(accountId));
    if (tickerVal) fd.append('ticker', tickerVal);
    if (action) fd.append('action', action);
    return fd;
  };

  const fetchCsvPreview = async (tickerVal: string) => {
    if (!csvFileRef.current?.files?.[0]) return;
    setCsvError(''); setCsvPreview(null); setCsvResult(null);
    try {
      const res = await fetch('/api/csv-import', { method: 'POST', body: buildCsvFd(tickerVal) });
      const data = await res.json();
      if (data.error === 'ticker_required') { setCsvNeedsTicker(true); setCsvFormat('new'); return; }
      if (data.error) { setCsvError(data.error); return; }
      setCsvFormat(data.format || '');
      setCsvNeedsTicker(false);
      setCsvPreview(data.preview);
      setCsvTotal(data.total);
    } catch { setCsvError('Failed to parse file'); }
  };

  const handleCsvFileChange = async () => {
    setCsvTicker(''); setCsvNeedsTicker(false); setCsvFormat('');
    setCsvPreview(null); setCsvResult(null); setCsvError('');
    await fetchCsvPreview('');
  };

  const handleCsvImport = async () => {
    if (!csvFileRef.current?.files?.[0]) return;
    setCsvImporting(true);
    try {
      const res = await fetch('/api/csv-import', { method: 'POST', body: buildCsvFd(csvTicker, 'import') });
      const data = await res.json();
      setCsvResult(data);
      onImported?.();
    } catch { setCsvError('Import failed'); }
    finally { setCsvImporting(false); }
  };

  // ── Manual form submit ────────────────────────────────────────
  const doSave = async (): Promise<boolean> => {
    if (!isValidDate(date)) { setDateError('날짜 형식: MM/DD/YYYY'); return false; }

    if (type === 'sell' && lotMethod === 'specific') {
      const selQty = Object.values(specificSelections).reduce((s,v) => s+(parseFloat(v)||0), 0);
      if (Math.abs(selQty - (parseFloat(qty)||0)) > 0.0001) {
        alert(`선택 수량(${selQty})이 매도 수량(${qty})과 다릅니다.`);
        return false;
      }
    }

    setLoading(true);
    try {
      const ymd = displayToYmd(date);

      if (type === 'split' || type === 'consolidation') {
        const ratio = parseFloat(qty || '0');
        if (ratio <= 1) { alert('Ratio must be greater than 1 (e.g. enter 2 for a 2:1 split)'); return false; }
        await onSubmit({ account_id: accountId, date: ymd, ticker: ticker.toUpperCase(), type, quantity: ratio, price: 0, fee: 0, notes: '' });
      } else if (type === 'transfer') {
        await onSubmit({
          account_id: accountId, date: ymd,
          type: transferDir === 'DEPOSIT' ? 'transfer_deposit' : 'transfer_withdraw',
          price: parsePriceInput(price), notes,
        });
      } else {
        const lot_assignments = type==='sell' && lotMethod==='specific'
          ? Object.entries(specificSelections)
              .filter(([,v]) => parseFloat(v)>0)
              .map(([id,v]) => ({ buy_tx_id: id, quantity: parseFloat(v) }))
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
      return true;
    } catch { return false; }
    finally { setLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await doSave()) onClose();
  };

  const handleSaveAndAdd = async () => {
    if (await doSave()) {
      setQty(''); setPrice(''); setFee(''); setNotes('');
      setReinvest(false); setReinvestQty(''); setReinvestPrice('');
      setLotMethod('average_cost'); setSpecificSelections({});
    }
  };

  const sellQtyNum = parseFloat(qty||'0');
  const csvImportable = csvPreview?.filter(r => !r.skip && !r.duplicate) ?? [];

  // Dividend and DIVIDEND_REINVEST are not editable
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
      <div className="modal" style={{ maxWidth: mode === 'csv' ? 900 : 640 }} onClick={e => e.stopPropagation()}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: 16 }}>
          <h2 style={{ margin:0, fontSize:17, fontWeight:700 }}>
            {isEditing
              ? (editingTx!.type === 'transfer_deposit' || editingTx!.type === 'transfer_withdraw')
                ? 'Edit Transfer'
                : `Edit Trade #${editingTx!.id}`
              : 'Add Trading History'}
          </h2>
          <button type="button" onClick={onClose} style={{ background:'none', color:'var(--muted)', padding:4 }}>
            <X size={18} />
          </button>
        </div>

        {/* ── Mode tabs (add-only) ────────────────────────────────── */}
        {!isEditing && (
          <div style={{ display:'flex', gap:6, marginBottom:20, borderBottom:'1px solid var(--border)', paddingBottom:12 }}>
            {(['manual','csv'] as const).map(m => (
              <button key={m} type="button"
                onClick={() => setMode(m)}
                style={{ padding:'5px 14px', fontSize:13, fontWeight:500, borderRadius:6,
                  background: mode===m ? 'var(--accent)' : 'transparent',
                  color: mode===m ? 'white' : 'var(--muted)',
                  border: mode===m ? 'none' : '1px solid var(--border)' }}>
                {m === 'manual' ? 'Manual' : 'Import CSV'}
              </button>
            ))}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            CSV IMPORT MODE
        ══════════════════════════════════════════════════════════ */}
        {mode === 'csv' && (
          <div>
            {/* Account + file picker row */}
            <div style={{ display:'flex', gap:12, marginBottom:16, alignItems:'flex-end', flexWrap:'wrap' }}>
              <div className="form-group">
                <label>Account</label>
                <select value={accountId} onChange={e => setAccountId(e.target.value)} style={{ minWidth:160 }}>
                  {visible.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>&nbsp;</label>
                <label style={{ cursor:'pointer', display:'inline-flex', alignItems:'center', gap:8,
                  background:'var(--accent)', color:'white', padding:'7px 14px', borderRadius:6, fontWeight:500 }}>
                  <Upload size={15} /> CSV 선택
                  <input ref={csvFileRef} type="file" accept=".csv" style={{ display:'none' }} onChange={handleCsvFileChange} />
                </label>
              </div>
              {csvNeedsTicker && (
                <>
                  <div className="form-group">
                    <label>Symbol</label>
                    <input type="text" value={csvTicker} onChange={e => setCsvTicker(e.target.value.toUpperCase())}
                      placeholder="AAPL" style={{ width:90 }}
                      onKeyDown={e => { if (e.key === 'Enter' && csvTicker) fetchCsvPreview(csvTicker); }} />
                  </div>
                  <div className="form-group">
                    <label>&nbsp;</label>
                    <button className="btn-primary" onClick={() => fetchCsvPreview(csvTicker)}
                      disabled={!csvTicker} style={{ padding:'7px 14px' }}>Preview</button>
                  </div>
                </>
              )}
              {csvFormat && (
                <div className="form-group">
                  <label>&nbsp;</label>
                  <span style={{ fontSize:11, background:'var(--border)', color:'var(--muted)', padding:'4px 10px', borderRadius:10, fontWeight:500, display:'inline-block' }}>
                    {CSV_FORMAT_LABEL[csvFormat] ?? csvFormat}
                  </span>
                </div>
              )}
            </div>

            {csvNeedsTicker && !csvTicker && (
              <div style={{ color:'var(--color-gold-commodity)', marginBottom:12, fontSize:13, display:'flex', alignItems:'center', gap:6 }}>
                <AlertCircle size={14} /> This format has no symbol info. Enter a symbol and click Preview.
              </div>
            )}

            {csvError && (
              <div style={{ color:'var(--red)', marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
                <AlertCircle size={15} /> {csvError}
              </div>
            )}

            {csvResult ? (
              <div style={{ color:'var(--green)', marginBottom:20, display:'flex', alignItems:'center', gap:6 }}>
                <CheckCircle size={15} /> {csvResult.imported} records imported
              </div>
            ) : csvPreview ? (
              <>
                <div style={{ marginBottom:8, color:'var(--muted)', fontSize:13 }}>
                  Total: {csvTotal} · Import: {csvImportable.length} · Duplicate: {csvPreview.filter(r=>r.duplicate).length} · Skipped: {csvPreview.filter(r=>r.skip).length}
                </div>
                <div style={{ maxHeight:320, overflowY:'auto', marginBottom:16, border:'1px solid var(--border)', borderRadius:8 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th><th>Symbol</th><th>Type</th>
                        <th style={{ textAlign:'right' }}>Qty</th>
                        <th style={{ textAlign:'right' }}>Price</th>
                        <th style={{ textAlign:'right' }}>Fee</th>
                        <th>Notes</th><th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvPreview.map((r,i) => (
                        <tr key={i} style={{ opacity: r.skip||r.duplicate ? 0.4 : 1 }}>
                          <td>{r.date}</td>
                          <td>{r.ticker}</td>
                          <td><span style={{ color: CSV_TYPE_COLOR[r.type] ?? 'var(--muted)', fontWeight:500 }}>{CSV_TYPE_LABEL[r.type] ?? r.type}</span></td>
                          <td style={{ textAlign:'right' }}>{r.quantity>0 ? r.quantity : '-'}</td>
                          <td style={{ textAlign:'right' }}>{r.price>0 ? `$${r.price.toFixed(2)}` : '-'}</td>
                          <td style={{ textAlign:'right' }}>{r.fee>0 ? `$${r.fee.toFixed(2)}` : '-'}</td>
                          <td style={{ maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', color:'var(--muted)', fontSize:12 }}>{r.notes}</td>
                          <td>
                            {r.duplicate && <span style={{ fontSize:11, color:'var(--color-gold-commodity)' }}>Duplicate</span>}
                            {r.skip && <span style={{ fontSize:11, color:'var(--muted)' }}>Skipped</span>}
                            {!r.duplicate && !r.skip && <span style={{ fontSize:11, color:'var(--green)' }}>✓</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : null}

            {/* CSV footer */}
            <div style={{ display:'flex', justifyContent:'flex-end', gap:10, paddingTop:16, borderTop:'1px solid var(--border)' }}>
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
              {csvPreview && !csvResult && (
                <button className="btn-primary" onClick={handleCsvImport}
                  disabled={csvImporting || csvImportable.length === 0}>
                  {csvImporting ? 'Importing...' : `Import ${csvImportable.length}`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            MANUAL ENTRY MODE
        ══════════════════════════════════════════════════════════ */}
        {mode === 'manual' && (
          <form onSubmit={handleSubmit}>
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
                  <select value={accountId} onChange={e => setAccountId(e.target.value)} style={{ width:'100%' }}>
                    {visible.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                {type !== 'transfer' && (
                  <div className="form-group" style={{ flex:1 }}>
                    <label>Symbol</label>
                    {prefillTicker ? (
                      <input value={ticker} readOnly style={{ width:'100%', opacity:0.7 }} />
                    ) : (
                      <TickerTypeahead
                        value={ticker}
                        onChange={val => setTicker(val.toUpperCase())}
                        suggestions={tickerSuggestions}
                        placeholder="Type ticker to search"
                        style={{ width:'100%' }}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Row: Date + fields */}
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
                      style={{ width:160 }}>
                      <option value="DEPOSIT">Deposit</option>
                      <option value="WITHDRAW">Withdraw</option>
                    </select>
                  </div>
                )}

                {(type === 'split' || type === 'consolidation') && (
                  <div className="form-group">
                    <label>Ratio</label>
                    <input value={qty} onChange={e => setQty(e.target.value)}
                      type="number" step="any" min="1.0001"
                      placeholder={type === 'split' ? '2  (2:1 split)' : '10  (1:10 reverse)'}
                      style={{ width:160 }} required />
                  </div>
                )}

                {type !== 'transfer' && type !== 'dividend' && type !== 'split' && type !== 'consolidation' && (
                  <div className="form-group">
                    <label>Shares</label>
                    <input value={qty} onChange={e => setQty(e.target.value)}
                      type="number" step="any" min="0" placeholder="0" style={{ width:90 }} />
                  </div>
                )}

                {type !== 'split' && type !== 'consolidation' && (
                  <div className="form-group">
                    <label>{type==='transfer'?`Amount (${sym})`:type==='dividend'?`Dividend (${sym})`:`Price (${sym})`}</label>
                    <input value={price} onChange={e => setPrice(formatPriceInput(e.target.value))}
                      type="text" inputMode="decimal" placeholder="0.00" style={{ width:110 }} required />
                  </div>
                )}

                {type !== 'transfer' && type !== 'split' && type !== 'consolidation' && (
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
                  placeholder="Trade notes (optional)" rows={2}
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
              {!isEditing && (
                <button type="button" className="btn-secondary" disabled={loading} onClick={handleSaveAndAdd}>
                  {loading ? 'Saving...' : 'Save & Add Another'}
                </button>
              )}
              <button type="submit" className="btn-primary" disabled={loading} style={{ minWidth:90 }}>
                {loading ? 'Saving...' : isEditing ? 'Update' : 'Save'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}
