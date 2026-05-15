'use client';
import { useState } from 'react';
import { X, Trash2, EyeOff, Eye, Edit2, Check } from 'lucide-react';
import { Account } from '@/lib/types';
import { getLabelMap, setLabelMap } from '@/lib/accountLabelMap';

interface Props {
  accounts: Account[];
  onClose: () => void;
  onAddAccount: (name: string) => Promise<void>;
  onRename: (id: string | number, name: string) => Promise<void>;
  onToggleHidden: (id: string | number, hidden: boolean) => Promise<void>;
  onDelete: (id: string | number) => Promise<void>;
}

export default function AccountSettingsModal({ accounts, onClose, onAddAccount, onRename, onToggleHidden, onDelete }: Props) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');
  const [showLegacy, setShowLegacy] = useState(false);
  const [legacyGroups, setLegacyGroups] = useState<{ label: string; tickers: string[] }[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>(getLabelMap);

  const loadLegacyGroups = async () => {
    const res = await fetch('/api/transactions');
    const txs: any[] = await res.json();
    const groups: Record<string, Set<string>> = {};
    for (const tx of txs) {
      if (/^Acct \d+$/i.test(tx.account_name ?? '')) {
        if (!groups[tx.account_name]) groups[tx.account_name] = new Set();
        if (tx.ticker) groups[tx.account_name].add(tx.ticker);
      }
    }
    const sorted = Object.entries(groups)
      .map(([label, tickers]) => ({ label, tickers: [...tickers].slice(0, 4) }))
      .sort((a, b) => a.label.localeCompare(b.label));
    setLegacyGroups(sorted);
    setShowLegacy(true);
  };

  const saveMapping = () => {
    setLabelMap(mapping);
    setShowLegacy(false);
  };

  const visibleNames = accounts.filter(a => !a.hidden).map(a => a.name);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try { await onAddAccount(newName.trim()); setNewName(''); setError(''); }
    catch { setError('Account name already exists.'); }
  };

  const handleRename = async (id: string | number) => {
    if (!editName.trim()) return;
    try { await onRename(id, editName.trim()); setEditingId(null); setError(''); }
    catch { setError('Account name already exists.'); }
  };

  const handleDelete = async (id: string | number, name: string) => {
    if (!confirm(`Delete account "${name}"?`)) return;
    try { await onDelete(id); }
    catch { setError('Cannot delete an account with transactions. Set it to Hidden instead.'); }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>⚙️ Account Management</h2>
          <button onClick={onClose} style={{ background: 'none', color: 'var(--muted)' }}><X size={18} /></button>
        </div>

        {error && <div style={{ color: 'var(--red)', marginBottom: 12, fontSize: 13 }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {accounts.map(acc => (
            <div key={acc.id} className="card" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              {editingId === acc.id ? (
                <>
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && handleRename(acc.id)} autoFocus />
                  <button className="btn-primary btn-sm" onClick={() => handleRename(acc.id)}><Check size={14} /></button>
                  <button className="btn-secondary btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontWeight: 500, opacity: acc.hidden ? 0.4 : 1 }}>{acc.name}</span>
                  {!!acc.hidden && <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--border)', padding: '2px 6px', borderRadius: 4 }}>Hidden</span>}
                  <button style={{ background: 'none', color: 'var(--muted)', padding: 4 }}
                    onClick={() => { setEditingId(acc.id); setEditName(acc.name); }}><Edit2 size={14} /></button>
                  <button style={{ background: 'none', color: 'var(--muted)', padding: 4 }}
                    onClick={() => onToggleHidden(acc.id, !acc.hidden)}
                    title={acc.hidden ? 'Show' : 'Hide'}>
                    {acc.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                  </button>
                  <button style={{ background: 'none', color: 'var(--red)', padding: 4 }}
                    onClick={() => handleDelete(acc.id, acc.name)}><Trash2 size={14} /></button>
                </>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New account name"
            style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && handleAdd()} />
          <button className="btn-primary" onClick={handleAdd}>Add</button>
        </div>

        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          {!showLegacy ? (
            <button className="btn-secondary btn-sm" onClick={loadLegacyGroups} style={{ fontSize: 12 }}>
              Map Legacy Accounts…
            </button>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Map Legacy Accounts</div>
              {legacyGroups.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--muted)' }}>No legacy accounts found.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {legacyGroups.map(grp => (
                    <div key={grp.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ minWidth: 56, fontWeight: 600, fontSize: 13 }}>{grp.label}</span>
                      <span style={{ fontSize: 11, color: 'var(--muted)', flex: 1 }}>
                        {grp.tickers.join(', ')}{grp.tickers.length >= 4 ? '…' : ''}
                      </span>
                      <select
                        value={mapping[grp.label] ?? ''}
                        onChange={e => setMapping(prev => ({ ...prev, [grp.label]: e.target.value }))}
                        style={{ minWidth: 140 }}
                      >
                        <option value="">Keep as {grp.label}</option>
                        {visibleNames.map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn-primary btn-sm" onClick={saveMapping}>Save Mapping</button>
                <button className="btn-secondary btn-sm" onClick={() => setShowLegacy(false)}>Cancel</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
