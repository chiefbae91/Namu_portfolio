'use client';
import { useRef, useState } from 'react';
import { X, Calendar } from 'lucide-react';

const HINT_TYPES = [
  { value: 'resistance',      label: '벽 (Resistance)' },
  { value: 'support',         label: '지지 (Support)' },
  { value: 'supply_level',    label: '매물대 (Supply Level)' },
  { value: 'short_target',    label: '단기 목표 주가 (Short-term Target)' },
  { value: 'long_target',     label: '장기 목표 주가 (Long-term Target)' },
  { value: 'buy_stop',        label: '매수 중지 (Buy Stop)' },
  { value: 'trailing_supply', label: '추격 매물대 (Trailing Supply)' },
  { value: 'note_only',       label: 'Note Only' },
];

function todayFormatted() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${mm}/${dd}/${d.getFullYear()}`;
}

function mmddyyyyToISO(s: string) {
  const [mm, dd, yyyy] = s.split('/');
  return `${yyyy}-${mm?.padStart(2, '0')}-${dd?.padStart(2, '0')}`;
}

function isoToMMDDYYYY(s: string) {
  const [yyyy, mm, dd] = s.split('-');
  return `${mm}/${dd}/${yyyy}`;
}

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Roll Saturday → Friday, Sunday → Friday (previous)
function toWeekday(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d); // local time, no UTC shift
  const day = dt.getDay();
  if (day === 6) dt.setDate(dt.getDate() - 1);
  else if (day === 0) dt.setDate(dt.getDate() - 2);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function sanitizeISO(isoDate: string): string {
  const today = todayISO();
  return toWeekday(isoDate > today ? today : isoDate);
}

function fmtPrice(raw: string) {
  const n = parseFloat(raw.replace(/,/g, ''));
  if (isNaN(n)) return raw;
  const [int, dec = ''] = n.toFixed(2).split('.');
  return int.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + dec;
}

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export default function TradingHintModal({ onClose, onSaved }: Props) {
  const [ticker, setTicker] = useState('');
  const [hintDate, setHintDate] = useState(todayFormatted());
  const [type, setType] = useState('');
  const [priceStr, setPriceStr] = useState('');
  const [currentPriceStr, setCurrentPriceStr] = useState('');
  const [priceFetching, setPriceFetching] = useState(false);
  const [priceError, setPriceError] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dateInputRef = useRef<HTMLInputElement>(null);

  const isBuyStop = type === 'buy_stop';
  const isNoteOnly = type === 'note_only';
  const priceDisabled = isBuyStop || isNoteOnly;
  const cpDisabled = isNoteOnly;

  const fetchPrice = async (t: string, d: string) => {
    if (!t.trim() || !/^\d{2}\/\d{2}\/\d{4}$/.test(d) || cpDisabled) return;
    setPriceFetching(true);
    setPriceError('');
    try {
      const res = await fetch(`/api/historical-price?ticker=${encodeURIComponent(t.trim())}&date=${mmddyyyyToISO(d)}`);
      const data = await res.json();
      if (data.error) setPriceError('No price data for this date');
      else if (data.price > 0) setCurrentPriceStr(fmtPrice(String(data.price)));
    } catch { setPriceError('Failed to fetch price'); }
    finally { setPriceFetching(false); }
  };

  const handleSave = async () => {
    if (!ticker.trim()) { setError('Ticker is required'); return; }
    if (!hintDate.trim()) { setError('Date is required'); return; }
    if (!type) { setError('Type is required'); return; }
    const price = priceDisabled ? null : (parseFloat(priceStr.replace(/,/g, '')) || null);
    const current_price = cpDisabled ? null : (parseFloat(currentPriceStr.replace(/,/g, '')) || null);
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/trading-hints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticker: ticker.trim().toUpperCase(),
          hint_date: mmddyyyyToISO(hintDate),
          type,
          price,
          current_price,
          note: note.trim() || null,
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const cpLabel = hintDate === todayFormatted() ? 'Current Price' : `${hintDate} Price`;

  const disabledStyle: React.CSSProperties = {
    width: '100%', background: 'var(--border)', color: 'var(--muted)', cursor: 'not-allowed',
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Trading Hint</h2>
          <button onClick={onClose} style={{ background: 'none', color: 'var(--muted)' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Ticker */}
          <div className="form-group">
            <label>Ticker <span style={{ color: 'var(--red)' }}>*</span></label>
            <input
              type="text"
              value={ticker}
              onChange={e => setTicker(e.target.value.toUpperCase())}
              onBlur={() => fetchPrice(ticker, hintDate)}
              style={{ width: '100%' }}
              autoFocus
            />
          </div>

          {/* Hint Date */}
          <div className="form-group">
            <label>Hint Date <span style={{ color: 'var(--red)' }}>*</span></label>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <input
                type="text"
                value={hintDate}
                onChange={e => setHintDate(e.target.value)}
                onBlur={e => {
                  const val = e.target.value;
                  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(val)) return;
                  const sanitized = sanitizeISO(mmddyyyyToISO(val));
                  const formatted = isoToMMDDYYYY(sanitized);
                  if (formatted !== val) setHintDate(formatted);
                  fetchPrice(ticker, formatted);
                }}
                style={{ flex: 1 }}
              />
              <button
                type="button"
                onClick={() => dateInputRef.current?.showPicker?.()}
                style={{ background: 'var(--border)', color: 'var(--muted)', padding: '6px 10px', borderRadius: 6, flexShrink: 0 }}
                title="Pick date"
              >
                <Calendar size={15} />
              </button>
              <input
                ref={dateInputRef}
                type="date"
                max={todayISO()}
                style={{ display: 'none' }}
                onChange={e => {
                  if (!e.target.value) return;
                  const formatted = isoToMMDDYYYY(sanitizeISO(e.target.value));
                  setHintDate(formatted);
                  fetchPrice(ticker, formatted);
                }}
              />
            </div>
          </div>

          {/* Type */}
          <div className="form-group">
            <label>Type <span style={{ color: 'var(--red)' }}>*</span></label>
            <select value={type} onChange={e => setType(e.target.value)} style={{ width: '100%' }}>
              <option value="">Select type...</option>
              {HINT_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {/* Price */}
          <div className="form-group">
            <label>Price</label>
            <input
              type="text"
              value={priceDisabled ? '' : priceStr}
              onChange={e => setPriceStr(e.target.value)}
              onBlur={() => { if (!priceDisabled && priceStr) setPriceStr(fmtPrice(priceStr)); }}
              disabled={priceDisabled}
              style={priceDisabled ? disabledStyle : { width: '100%' }}
            />
          </div>

          {/* Current Price */}
          <div className="form-group">
            <label>
              {cpLabel}
              {priceFetching && <span style={{ color: 'var(--muted)', fontSize: 11, marginLeft: 6 }}>Fetching price...</span>}
            </label>
            <input
              type="text"
              value={cpDisabled ? '' : currentPriceStr}
              onChange={e => { setCurrentPriceStr(e.target.value); setPriceError(''); }}
              onBlur={() => { if (!cpDisabled && currentPriceStr) setCurrentPriceStr(fmtPrice(currentPriceStr)); }}
              disabled={cpDisabled}
              style={cpDisabled ? disabledStyle : { width: '100%' }}
            />
            {priceError && (
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 3 }}>{priceError}</div>
            )}
          </div>

          {/* Note */}
          <div className="form-group">
            <label>Note</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }}
            />
          </div>

          {error && <div style={{ color: 'var(--red)', fontSize: 13 }}>{error}</div>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
