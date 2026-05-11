'use client';
import { useRef, useState } from 'react';
import { X, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import { Account, CsvPreviewRow } from '@/lib/types';

interface Props {
  accounts: Account[];
  onClose: () => void;
  onImported: () => void;
}

export default function CsvImportModal({ accounts, onClose, onImported }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [accountId, setAccountId] = useState<number>(accounts[0]?.id ?? 0);
  const [preview, setPreview] = useState<CsvPreviewRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number } | null>(null);
  const [error, setError] = useState('');

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(''); setPreview(null); setResult(null);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('account_id', String(accountId));
    try {
      const res = await fetch('/api/csv-import', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setPreview(data.preview);
      setTotal(data.total);
    } catch { setError('파일 파싱 실패'); }
  };

  const handleImport = async () => {
    if (!fileRef.current?.files?.[0]) return;
    setImporting(true);
    const fd = new FormData();
    fd.append('file', fileRef.current.files[0]);
    fd.append('account_id', String(accountId));
    fd.append('action', 'import');
    try {
      const res = await fetch('/api/csv-import', { method: 'POST', body: fd });
      const data = await res.json();
      setResult(data);
      onImported();
    } catch { setError('임포트 실패'); }
    finally { setImporting(false); }
  };

  const typeLabel = (t: string) => ({ buy: '매수', sell: '매도', dividend: '배당', cash: '현금', skip: '건너뜀', unknown: '미지원' })[t] ?? t;
  const typeColor = (t: string) => ({ buy: 'var(--green)', sell: 'var(--red)', dividend: '#f59e0b', cash: '#60a5fa', skip: 'var(--muted)' })[t] ?? 'var(--muted)';

  const importable = preview?.filter(r => !r.skip && !r.duplicate) ?? [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 860 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>CSV 임포트 (Robinhood)</h2>
          <button onClick={onClose} style={{ background: 'none', color: 'var(--muted)' }}><X size={18} /></button>
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div className="form-group">
            <label>계좌</label>
            <select value={accountId} onChange={e => setAccountId(Number(e.target.value))} style={{ minWidth: 160 }}>
              {accounts.filter(a => !a.hidden).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          <div className="form-group" style={{ justifyContent: 'flex-end' }}>
            <label>&nbsp;</label>
            <label style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--accent)', color: 'white', padding: '7px 14px', borderRadius: 6, fontWeight: 500 }}>
              <Upload size={15} /> CSV 선택
              <input ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileChange} />
            </label>
          </div>
        </div>

        {error && <div style={{ color: 'var(--red)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}><AlertCircle size={15}/> {error}</div>}

        {result && (
          <div style={{ color: 'var(--green)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle size={15}/> {result.imported}건 임포트 완료
          </div>
        )}

        {preview && !result && (
          <>
            <div style={{ marginBottom: 12, color: 'var(--muted)', fontSize: 13 }}>
              총 {total}건 · 임포트 대상 {importable.length}건 · 중복 {preview.filter(r => r.duplicate).length}건 · 건너뜀 {preview.filter(r => r.skip).length}건
            </div>
            <div style={{ maxHeight: 340, overflowY: 'auto', marginBottom: 16, border: '1px solid var(--border)', borderRadius: 8 }}>
              <table>
                <thead>
                  <tr><th>날짜</th><th>종목</th><th>유형</th><th>수량</th><th>단가</th><th>메모</th><th>상태</th></tr>
                </thead>
                <tbody>
                  {preview.map((r, i) => (
                    <tr key={i} style={{ opacity: r.skip || r.duplicate ? 0.4 : 1 }}>
                      <td>{r.date}</td>
                      <td>{r.ticker}</td>
                      <td><span style={{ color: typeColor(r.type), fontWeight: 500 }}>{typeLabel(r.type)}</span></td>
                      <td>{r.quantity || '-'}</td>
                      <td>{r.price ? `$${r.price.toFixed(2)}` : '-'}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--muted)', fontSize: 12 }}>{r.notes}</td>
                      <td>
                        {r.duplicate && <span style={{ fontSize: 11, color: '#f59e0b' }}>중복</span>}
                        {r.skip && <span style={{ fontSize: 11, color: 'var(--muted)' }}>건너뜀</span>}
                        {!r.duplicate && !r.skip && <span style={{ fontSize: 11, color: 'var(--green)' }}>✓</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn-secondary" onClick={onClose}>취소</button>
              <button className="btn-primary" onClick={handleImport} disabled={importing || importable.length === 0}>
                {importing ? '임포트 중...' : `${importable.length}건 임포트`}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
