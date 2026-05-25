'use client';
import { useState } from 'react';
import { X, Trash2, EyeOff, Eye, Edit2, Check, Sun, Moon } from 'lucide-react';
import { Account, AccountType } from '@/lib/types';

export type DateFormat = 'MM/DD/YY' | 'YYYY/MM/DD';

const COLOR_PALETTE = [
  '#6366f1', '#3b82f6', '#10b981', '#14b8a6',
  '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899',
];

interface Props {
  accounts: Account[];
  accountTypes: AccountType[];
  onClose: () => void;
  onAddAccount: (name: string) => Promise<void>;
  onRename: (id: string | number, name: string) => Promise<void>;
  onToggleHidden: (id: string | number, hidden: boolean) => Promise<void>;
  onDelete: (id: string | number) => Promise<void>;
  onAddType: (name: string, color: string) => Promise<void>;
  onRenameType: (id: string | number, name: string, color: string) => Promise<void>;
  onDeleteType: (id: string | number) => Promise<void>;
  onAssignType: (accountId: string | number, typeId: string | number | null) => Promise<void>;
  showKrw: boolean;
  setShowKrw: (v: boolean) => void;
  showEur: boolean;
  setShowEur: (v: boolean) => void;
  dateFormat: DateFormat;
  setDateFormat: (v: DateFormat) => void;
  theme: 'dark' | 'light';
  setTheme: (v: 'dark' | 'light') => void;
}

export default function AccountSettingsModal({
  accounts, accountTypes, onClose,
  onAddAccount, onRename, onToggleHidden, onDelete,
  onAddType, onRenameType, onDeleteType, onAssignType,
  showKrw, setShowKrw, showEur, setShowEur,
  dateFormat, setDateFormat, theme, setTheme,
}: Props) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editName, setEditName] = useState('');
  const [error, setError] = useState('');

  const [newTypeName, setNewTypeName] = useState('');
  const [newTypeColor, setNewTypeColor] = useState(COLOR_PALETTE[0]);
  const [editingTypeId, setEditingTypeId] = useState<string | number | null>(null);
  const [editTypeName, setEditTypeName] = useState('');
  const [editTypeColor, setEditTypeColor] = useState(COLOR_PALETTE[0]);
  const [typeError, setTypeError] = useState('');

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

  const handleAddType = async () => {
    if (!newTypeName.trim()) return;
    try { await onAddType(newTypeName.trim(), newTypeColor); setNewTypeName(''); setNewTypeColor(COLOR_PALETTE[0]); setTypeError(''); }
    catch { setTypeError('Type name already exists.'); }
  };

  const handleRenameType = async (id: string | number) => {
    if (!editTypeName.trim()) return;
    try { await onRenameType(id, editTypeName.trim(), editTypeColor); setEditingTypeId(null); setTypeError(''); }
    catch { setTypeError('Type name already exists.'); }
  };

  const handleDeleteType = async (id: string | number, name: string) => {
    if (!confirm(`Delete type "${name}"? It will be removed from all accounts.`)) return;
    await onDeleteType(id);
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: 'var(--muted)',
    letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 14,
  };

  const settingRow: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14,
  };

  const settingLabel: React.CSSProperties = {
    fontSize: 13, color: 'var(--text)', minWidth: 110, flexShrink: 0,
  };

  const segmentBtn = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '5px 14px', fontSize: 12, fontWeight: 600, borderRadius: 6,
    background: active ? 'var(--accent)' : 'var(--border)',
    color: active ? 'white' : 'var(--muted)',
    border: 'none', cursor: 'pointer', transition: 'all 0.15s',
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 680, width: '100%' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Settings</h2>
          <button onClick={onClose} style={{ background: 'none', color: 'var(--muted)' }}><X size={18} /></button>
        </div>

        {/* ── Local Settings ── */}
        <div style={sectionLabel as React.CSSProperties}>Local Settings</div>

        {/* Date Format */}
        <div style={settingRow}>
          <span style={settingLabel}>Date Format</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['MM/DD/YY', 'YYYY/MM/DD'] as DateFormat[]).map(fmt => (
              <button key={fmt} onClick={() => setDateFormat(fmt)} style={segmentBtn(dateFormat === fmt)}>
                {fmt}
              </button>
            ))}
          </div>
        </div>

        {/* Currency */}
        <div style={settingRow}>
          <span style={settingLabel}>Currency</span>
          <div style={{ display: 'flex', gap: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={showKrw} onChange={e => setShowKrw(e.target.checked)}
                style={{ cursor: 'pointer', accentColor: 'var(--color-krw)', width: 15, height: 15 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: showKrw ? 'var(--color-krw)' : 'var(--muted)' }}>KRW</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', userSelect: 'none' }}>
              <input type="checkbox" checked={showEur} onChange={e => setShowEur(e.target.checked)}
                style={{ cursor: 'pointer', accentColor: 'var(--color-eur)', width: 15, height: 15 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: showEur ? 'var(--color-eur)' : 'var(--muted)' }}>EUR</span>
            </label>
          </div>
        </div>

        {/* Theme */}
        <div style={{ ...settingRow, marginBottom: 24 }}>
          <span style={settingLabel}>Theme</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setTheme('light')} style={segmentBtn(theme === 'light')}>
              <Sun size={13} /> Day
            </button>
            <button onClick={() => setTheme('dark')} style={segmentBtn(theme === 'dark')}>
              <Moon size={13} /> Night
            </button>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', marginBottom: 24 }} />

        {/* ── Account Settings ── */}
        <div style={sectionLabel as React.CSSProperties}>Account Settings</div>

        {/* Account Types */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 10 }}>Account Types</div>
          {typeError && <div style={{ color: 'var(--red)', marginBottom: 8, fontSize: 13 }}>{typeError}</div>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
            {accountTypes.map(t => (
              <div key={t.id} className="card" style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                {editingTypeId === t.id ? (
                  <>
                    <ColorPicker value={editTypeColor} onChange={setEditTypeColor} />
                    <input value={editTypeName} onChange={e => setEditTypeName(e.target.value)}
                      style={{ flex: 1, fontSize: 13 }} onKeyDown={e => e.key === 'Enter' && handleRenameType(t.id)} autoFocus />
                    <button className="btn-primary btn-sm" onClick={() => handleRenameType(t.id)}><Check size={13} /></button>
                    <button className="btn-secondary btn-sm" onClick={() => setEditingTypeId(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{t.name}</span>
                    <button style={{ background: 'none', color: 'var(--muted)', padding: 3 }}
                      onClick={() => { setEditingTypeId(t.id); setEditTypeName(t.name); setEditTypeColor(t.color); }}>
                      <Edit2 size={13} />
                    </button>
                    <button style={{ background: 'none', color: 'var(--red)', padding: 3 }}
                      onClick={() => handleDeleteType(t.id, t.name)}>
                      <Trash2 size={13} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <ColorPicker value={newTypeColor} onChange={setNewTypeColor} />
            <input value={newTypeName} onChange={e => setNewTypeName(e.target.value)}
              placeholder="New type name" style={{ flex: 1, fontSize: 13 }}
              onKeyDown={e => e.key === 'Enter' && handleAddType()} />
            <button className="btn-primary btn-sm" onClick={handleAddType}>Add</button>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border)', marginBottom: 20 }} />

        {/* Accounts */}
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', marginBottom: 10 }}>Accounts</div>
        {error && <div style={{ color: 'var(--red)', marginBottom: 8, fontSize: 13 }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {accounts.map(acc => (
            <div key={acc.id} className="card" style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
              {editingId === acc.id ? (
                <>
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    style={{ flex: 1 }} onKeyDown={e => e.key === 'Enter' && handleRename(acc.id)} autoFocus />
                  <button className="btn-primary btn-sm" onClick={() => handleRename(acc.id)}><Check size={14} /></button>
                  <button className="btn-secondary btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                </>
              ) : (
                <>
                  <span style={{ flex: 1, fontWeight: 500, fontSize: 14, opacity: acc.hidden ? 0.4 : 1 }}>{acc.name}</span>
                  {!!acc.hidden && <span style={{ fontSize: 10, color: 'var(--muted)', background: 'var(--border)', padding: '2px 5px', borderRadius: 4 }}>Hidden</span>}
                  <TypeBadge
                    accountTypes={accountTypes}
                    typeId={acc.type_id ?? null}
                    onChange={typeId => onAssignType(acc.id, typeId)}
                  />
                  <button style={{ background: 'none', color: 'var(--muted)', padding: 3 }}
                    onClick={() => { setEditingId(acc.id); setEditName(acc.name); }}><Edit2 size={13} /></button>
                  <button style={{ background: 'none', color: 'var(--muted)', padding: 3 }}
                    onClick={() => onToggleHidden(acc.id, !acc.hidden)}
                    title={acc.hidden ? 'Show' : 'Hide'}>
                    {acc.hidden ? <Eye size={13} /> : <EyeOff size={13} />}
                  </button>
                  <button style={{ background: 'none', color: 'var(--red)', padding: 3 }}
                    onClick={() => handleDelete(acc.id, acc.name)}><Trash2 size={13} /></button>
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

      </div>
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
      {COLOR_PALETTE.map(c => (
        <button key={c} onClick={() => onChange(c)} style={{
          width: 16, height: 16, borderRadius: '50%', background: c, border: 'none', padding: 0, cursor: 'pointer',
          outline: value === c ? `2px solid var(--text)` : 'none', outlineOffset: 1,
        }} />
      ))}
    </div>
  );
}

function TypeBadge({ accountTypes, typeId, onChange }: {
  accountTypes: AccountType[];
  typeId: string | number | null;
  onChange: (id: string | number | null) => void;
}) {
  const current = accountTypes.find(t => String(t.id) === String(typeId));
  return (
    <select
      value={typeId != null ? String(typeId) : ''}
      onChange={e => onChange(e.target.value || null)}
      style={{
        fontSize: 11, padding: '2px 6px', borderRadius: 4, cursor: 'pointer',
        border: current ? `1px solid ${current.color}` : '1px solid var(--border)',
        color: current ? current.color : 'var(--muted)',
        background: 'var(--surface)', fontWeight: 600, minWidth: 0,
      }}
    >
      <option value="">— None</option>
      {accountTypes.map(t => (
        <option key={t.id} value={String(t.id)}>{t.name}</option>
      ))}
    </select>
  );
}
