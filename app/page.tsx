'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Settings, FileUp, RefreshCw, LogOut, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { Account, AccountBreakdown, ExchangeRates, PortfolioPosition, SummaryData, Transaction, TradingHint } from '@/lib/types';
import StockPortfolio from '@/components/tabs/StockPortfolio';
import TransactionHistory from '@/components/tabs/TransactionHistory';
import TradingHints from '@/components/tabs/TradingHints';
import TransactionModal from '@/components/modals/TransactionModal';
import AccountSettingsModal from '@/components/modals/AccountSettingsModal';
import AccountHistoryModal from '@/components/modals/AccountHistoryModal';
import TradeAnalysisModal from '@/components/modals/TradeAnalysisModal';
import CsvImportModal from '@/components/modals/CsvImportModal';
import TradingHintModal from '@/components/modals/TradingHintModal';
import SummaryCards from '@/components/SummaryCards';
import AccountBanner from '@/components/AccountBanner';
import ThemeToggle from '@/components/ThemeToggle';
import PriceAlertToasts, { PriceAlert } from '@/components/PriceAlertToasts';

const TRANSFER_OFFSET = 1_000_000;

export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountFilter, setAccountFilter] = useState<string>(''); // '' = all, '1,2,3' = subset
  const [accountDropdownOpen, setAccountDropdownOpen] = useState(false);
  const accountDropdownRef = useRef<HTMLDivElement>(null);
  const [rates, setRates] = useState<ExchangeRates>({ USD: 1, KRW: 1380, EUR: 0.92, DXY: 104, WTI: 78, GOLD: 2300, ES: 5800, ES_PREV: 5800, T5Y: 4.25, T10Y: 4.50, T30Y: 4.75 });
  const [showKrw, setShowKrw] = useState(true);
  const [showEur, setShowEur] = useState(false);
  const [activeTab, setActiveTab] = useState<'portfolio' | 'history' | 'hints'>('portfolio');
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<SummaryData>({ cash: 0, stock: 0, options_pnl: 0, total: 0 });
  const [accountBreakdown, setAccountBreakdown] = useState<AccountBreakdown[]>([]);
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [analysisTicker, setAnalysisTicker] = useState<string | null>(null);
  const [historyAccount, setHistoryAccount] = useState<{ id: string | number; name: string } | null>(null);
  const [txPrefill, setTxPrefill] = useState<{ ticker: string; accountId: string | number } | null>(null);
  const [historyDeepLink, setHistoryDeepLink] = useState<{ ticker: string; id: number } | null>(null);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [tradingHintOpen, setTradingHintOpen] = useState(false);
  const [editingHint, setEditingHint] = useState<TradingHint | null>(null);
  const [hintPrefillTicker, setHintPrefillTicker] = useState<string | null>(null);
  const [tradingHints, setTradingHints] = useState<TradingHint[]>([]);
  const [analysisInitialTab, setAnalysisInitialTab] = useState<'history' | 'hints'>('history');
  const [hintRefreshTrigger, setHintRefreshTrigger] = useState(0);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<Date | null>(null);
  const [ratesRefreshing, setRatesRefreshing] = useState(false);
  const [appName, setAppName] = useState('Namu Portfolio');
  const [appNameEditing, setAppNameEditing] = useState(false);
  const [appNameInput, setAppNameInput] = useState('');
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const alertStateRef = useRef<Record<string, 'up' | 'down' | null>>({});
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [accountsLoaded, setAccountsLoaded] = useState(false);

  const fetchTradingHints = useCallback(async () => {
    const res = await fetch('/api/trading-hints');
    setTradingHints(await res.json());
    setHintRefreshTrigger(t => t + 1);
  }, []);

  const fetchAccounts = useCallback(async () => {
    const res = await fetch('/api/accounts');
    setAccounts(await res.json());
    setAccountsLoaded(true);
  }, []);

  const fetchRates = useCallback(async () => {
    try {
      setRatesRefreshing(true);
      const res = await fetch('/api/exchange-rates');
      setRates(await res.json());
      setRatesUpdatedAt(new Date());
    } finally {
      setRatesRefreshing(false);
    }
  }, []);

  const fetchPortfolio = useCallback(async (showLoader = true) => {
    if (showLoader) setPortfolioLoading(true);
    const q = accountFilter ? `?account_ids=${accountFilter}` : '';
    try {
      const res = await fetch(`/api/portfolio${q}`);
      if (!res.ok) {
        const text = await res.text();
        console.error('Portfolio API error:', res.status, text);
        return;
      }
      const data = await res.json();
      const newPositions: PortfolioPosition[] = data.positions || [];
      setPositions(newPositions);

      // Check 5% threshold crossings for price alerts
      let nextId = Date.now();
      const triggered: PriceAlert[] = [];
      for (const pos of newPositions) {
        if (!pos.prev_close || pos.prev_close === 0) continue;
        const changePct = (pos.current_price - pos.prev_close) / pos.prev_close * 100;
        const prev = alertStateRef.current[pos.ticker] ?? null;
        if (changePct >= 5 && prev !== 'up') {
          triggered.push({ id: nextId++, ticker: pos.ticker, changePct, direction: 'up' });
          alertStateRef.current[pos.ticker] = 'up';
        } else if (changePct <= -5 && prev !== 'down') {
          triggered.push({ id: nextId++, ticker: pos.ticker, changePct, direction: 'down' });
          alertStateRef.current[pos.ticker] = 'down';
        } else if (changePct > -5 && changePct < 5) {
          alertStateRef.current[pos.ticker] = null;
        }
      }
      if (triggered.length > 0) setPriceAlerts(prev => [...prev, ...triggered]);

      const stock = data.stock_value ?? 0;
      const cash = data.cash ?? 0;
      setSummary({ cash, stock, options_pnl: 0, total: cash + stock });
      setAccountBreakdown(data.account_breakdown || []);
    } catch (err) {
      console.error('fetchPortfolio failed:', err);
    } finally { if (showLoader) setPortfolioLoading(false); }
  }, [accountFilter]);

  const fetchTransactions = useCallback(async () => {
    const q = accountFilter ? `?account_ids=${accountFilter}` : '';
    const [txRes, tfRes] = await Promise.all([
      fetch(`/api/transactions${q}`),
      fetch(`/api/transfers${q}`),
    ]);
    const txs: Transaction[] = await txRes.json();
    const tfs: any[] = await tfRes.json();

    const transfers: Transaction[] = tfs.map(tf => ({
      id: TRANSFER_OFFSET + tf.id,
      account_id: tf.account_id,
      account_name: tf.account_name,
      date: tf.date,
      ticker: '',
      type: tf.type === 'DEPOSIT' ? 'transfer_deposit' : 'transfer_withdraw',
      quantity: 0,
      price: tf.amount,
      fee: 0,
      currency: 'USD',
      notes: tf.description,
    }));

    const combined = [...txs, ...transfers]
      .sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));
    setTransactions(combined);
  }, [accountFilter]);

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) { window.location.href = '/login'; return; }
      setUserEmail(user.email ?? null);
    });
    fetchAccounts(); fetchRates(); fetchTradingHints();
    fetch('/api/settings?key=app_name')
      .then(r => r.json())
      .then(d => { if (d.value) { setAppName(d.value); document.title = d.value; } });
  }, []);

  // Auto-refresh rates every 5 minutes
  useEffect(() => {
    const id = setInterval(fetchRates, 300_000);
    return () => clearInterval(id);
  }, [fetchRates]);

  // Auto-refresh portfolio prices every 60s (silent, no loading spinner)
  useEffect(() => {
    const id = setInterval(() => fetchPortfolio(false), 60_000);
    return () => clearInterval(id);
  }, [fetchPortfolio]);

  useEffect(() => { fetchPortfolio(); fetchTransactions(); }, [accountFilter]);

  // Close account dropdown on outside click
  useEffect(() => {
    if (!accountDropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (accountDropdownRef.current && !accountDropdownRef.current.contains(e.target as Node))
        setAccountDropdownOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [accountDropdownOpen]);

  const refreshAll = () => { fetchPortfolio(); fetchTransactions(); };

  const handleTransactionSubmit = async (data: any) => {
    if (data.type === 'transfer_deposit' || data.type === 'transfer_withdraw') {
      await fetch('/api/transfers', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_id: data.account_id,
          date: data.date,
          amount: data.price,
          type: data.type === 'transfer_deposit' ? 'DEPOSIT' : 'WITHDRAW',
          description: data.notes,
        }),
      });
    } else if (editingTx) {
      await fetch(`/api/transactions/${editingTx.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
      setEditingTx(null);
    } else {
      await fetch('/api/transactions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
    }
    refreshAll();
  };

  const openEditModal = (tx: Transaction) => {
    setEditingTx(tx);
    setTxModalOpen(true);
  };

  const closeTransactionModal = () => {
    setTxModalOpen(false);
    setEditingTx(null);
    setTxPrefill(null);
  };

  const handleDeleteHint = async (id: number) => {
    await fetch(`/api/trading-hints/${id}`, { method: 'DELETE' });
    fetchTradingHints();
  };

  const handleEditHint = (hint: TradingHint) => {
    setEditingHint(hint);
    setTradingHintOpen(true);
  };

  const closeTradingHintModal = () => {
    setTradingHintOpen(false);
    setEditingHint(null);
    setHintPrefillTicker(null);
  };

  const handleAddHintFromAnalysis = (ticker: string) => {
    setEditingHint(null);
    setHintPrefillTicker(ticker);
    setTradingHintOpen(true);
  };

  const handleShowHistoryForTicker = (ticker: string) => {
    setAnalysisTicker(null);
    setActiveTab('history');
    setHistoryDeepLink({ ticker, id: Date.now() });
  };

  const handleAddTransactionFromAnalysis = (ticker: string) => {
    const lastTx = transactions.find(t => t.ticker === ticker);
    setTxPrefill({ ticker, accountId: lastTx?.account_id ?? visibleAccounts[0]?.id ?? 0 });
    setAnalysisTicker(null);
    setEditingTx(null);
    setTxModalOpen(true);
  };

  const deleteOne = (id: number) => {
    if (id >= TRANSFER_OFFSET) {
      return fetch(`/api/transfers/${id - TRANSFER_OFFSET}`, { method: 'DELETE' });
    }
    return fetch(`/api/transactions/${id}`, { method: 'DELETE' });
  };

  const handleDeleteTx = async (id: number) => {
    await deleteOne(id);
    refreshAll();
  };

  const handleDeleteMany = async (ids: number[]) => {
    await Promise.all(ids.map(deleteOne));
    refreshAll();
  };

  const handleAddAccount = async (name: string) => {
    const res = await fetch('/api/accounts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    if (!res.ok) throw new Error('failed');
    await fetchAccounts();
  };

  const handleRenameAccount = async (id: number, name: string) => {
    const res = await fetch(`/api/accounts/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    if (!res.ok) throw new Error('failed');
    await fetchAccounts();
  };

  const handleToggleHidden = async (id: number, hidden: boolean) => {
    await fetch(`/api/accounts/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hidden }) });
    await fetchAccounts();
    refreshAll();
  };

  const handleDeleteAccount = async (id: number) => {
    const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('failed');
    await fetchAccounts();
  };

  const visibleAccounts = accounts.filter(a => !a.hidden);
  const checkedIds: Set<string | number> = accountFilter === ''
    ? new Set(visibleAccounts.map(a => a.id))
    : new Set(accountFilter.split(','));
  const allChecked = visibleAccounts.every(a => checkedIds.has(a.id));

  return (
    <div style={{ minHeight: '100vh', padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <img src="/logo.svg" alt="Namu Portfolio logo" style={{ width: 36, height: 36, flexShrink: 0 }} />
        {appNameEditing ? (
          <input
            autoFocus
            value={appNameInput}
            onChange={e => setAppNameInput(e.target.value)}
            onBlur={async () => {
              const name = appNameInput.trim() || appName;
              setAppName(name);
              document.title = name;
              setAppNameEditing(false);
              await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: 'app_name', value: name }) });
            }}
            onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') { setAppNameEditing(false); } }}
            className="mobile-app-name"
            style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', background: 'transparent', border: 'none', borderBottom: '2px solid var(--accent)', outline: 'none', marginRight: 8, width: Math.max(120, appNameInput.length * 11) }}
          />
        ) : (
          <h1
            title="Click to rename"
            onClick={() => { setAppNameInput(appName); setAppNameEditing(true); }}
            className="mobile-app-name"
            style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--accent)', marginRight: 8, cursor: 'pointer' }}
          >{appName}</h1>
        )}

        <div ref={accountDropdownRef} className="mobile-hide" style={{ position: 'relative' }}>
          <button
            onClick={() => setAccountDropdownOpen(o => !o)}
            style={{ minWidth: 160, padding: '6px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 13 }}
          >
            <span>
              {allChecked ? 'All Accounts' : checkedIds.size === 1
                ? visibleAccounts.find(a => checkedIds.has(a.id))?.name ?? '1 Account'
                : `${checkedIds.size} Accounts`}
            </span>
            <ChevronDown size={13} style={{ flexShrink: 0, transform: accountDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>
          {accountDropdownOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, minWidth: 200, boxShadow: '0 4px 16px rgba(0,0,0,0.4)', padding: '4px 0' }}>
              {visibleAccounts.map(a => (
                <label key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={checkedIds.has(a.id)}
                    style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
                    onChange={e => {
                      const next = new Set(checkedIds);
                      if (e.target.checked) next.add(a.id); else next.delete(a.id);
                      if (next.size === 0) {
                        alert('At least one account must be selected.');
                        return;
                      }
                      const nowAll = visibleAccounts.every(acc => next.has(acc.id));
                      setAccountFilter(nowAll ? '' : [...next].sort().join(','));
                    }}
                  />
                  {a.name}
                </label>
              ))}
            </div>
          )}
        </div>
        <button className="mobile-hide" onClick={() => setAccountSettingsOpen(true)}
          style={{ background: 'var(--border)', color: 'var(--muted)', padding: '6px 10px' }}
          title="Manage Accounts"><Settings size={15} /></button>

        <div className="mobile-hide" style={{ flex: 1 }} />

        <div className="mobile-hide" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>USD</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={showKrw} onChange={e => setShowKrw(e.target.checked)}
              style={{ cursor: 'pointer', accentColor: '#fbbf24' }} />
            <span style={{ fontSize: 12, color: showKrw ? '#fbbf24' : 'var(--muted)', fontWeight: showKrw ? 600 : 400 }}>
              KRW
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={showEur} onChange={e => setShowEur(e.target.checked)}
              style={{ cursor: 'pointer', accentColor: '#34d399' }} />
            <span style={{ fontSize: 12, color: showEur ? '#34d399' : 'var(--muted)', fontWeight: showEur ? 600 : 400 }}>
              EUR
            </span>
          </label>
        </div>

        <button
          onClick={fetchRates}
          title="Refresh Rates"
          style={{ background: 'none', color: 'var(--muted)', padding: 2, display: 'flex', alignItems: 'center' }}
        >
          <RefreshCw size={13} style={{ animation: ratesRefreshing ? 'spin 0.6s linear infinite' : 'none' }} />
        </button>

        <button className="mobile-hide" onClick={() => setCsvImportOpen(true)}
          style={{ background: 'var(--border)', color: 'var(--muted)', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
          <FileUp size={14} /> CSV Import
        </button>

        {userEmail && (
          <span className="mobile-hide" style={{ fontSize: 11, color: 'var(--muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {userEmail}
          </span>
        )}

        <ThemeToggle />

        <Link
          href="/guide"
          title="User Guide"
          target="_blank"
          style={{ background: 'none', color: 'var(--muted)', padding: '6px 8px', display: 'flex', alignItems: 'center' }}
        >
          <HelpCircle size={15} />
        </Link>

        <button
          onClick={async () => {
            await createClient().auth.signOut();
            window.location.href = '/login';
          }}
          title="Sign out"
          style={{ background: 'none', color: 'var(--muted)', padding: '6px 8px', display: 'flex', alignItems: 'center' }}
        >
          <LogOut size={15} />
        </button>
      </div>

      {/* Mobile-only: account dropdown + settings below header */}
      <div className="mobile-only-flex" style={{ background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', padding: '8px 14px', gap: 8, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <button
            onClick={() => setAccountDropdownOpen(o => !o)}
            style={{ width: '100%', padding: '8px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 13 }}
          >
            <span>
              {allChecked ? 'All Accounts' : checkedIds.size === 1
                ? visibleAccounts.find(a => checkedIds.has(a.id))?.name ?? '1 Account'
                : `${checkedIds.size} Accounts`}
            </span>
            <ChevronDown size={13} style={{ flexShrink: 0, transform: accountDropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>
          {accountDropdownOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 200, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, minWidth: 200, width: '100%', boxShadow: '0 4px 16px rgba(0,0,0,0.4)', padding: '4px 0' }}>
              {visibleAccounts.map(a => (
                <label key={`mob-${a.id}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="checkbox"
                    checked={checkedIds.has(a.id)}
                    style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
                    onChange={e => {
                      const next = new Set(checkedIds);
                      if (e.target.checked) next.add(a.id); else next.delete(a.id);
                      if (next.size === 0) { alert('At least one account must be selected.'); return; }
                      const nowAll = visibleAccounts.every(acc => next.has(acc.id));
                      setAccountFilter(nowAll ? '' : [...next].sort().join(','));
                    }}
                  />
                  {a.name}
                </label>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => setAccountSettingsOpen(true)}
          style={{ background: 'var(--border)', color: 'var(--muted)', padding: '8px 10px', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 6 }}
          title="Manage Accounts"><Settings size={15} /></button>
      </div>

      {/* Onboarding banner — only when no accounts */}
      {accountsLoaded && accounts.length === 0 && (
        <AccountBanner onOpenAccounts={() => setAccountSettingsOpen(true)} />
      )}

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 20px 0' }}>
        {/* Market Data Bar */}
        <div style={{ marginBottom: 16, background: 'var(--surface)', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
          {/* Row 1: Futures / Commodities / FX */}
          <div className="market-row-1" style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '8px 16px', borderBottom: '1px solid var(--border)' }}>
            {(() => {
              const esChange = rates.ES - rates.ES_PREV;
              const esChangePct = rates.ES_PREV !== 0 ? (esChange / rates.ES_PREV) * 100 : 0;
              const esColor = esChange >= 0 ? 'var(--green)' : 'var(--red)';
              return (
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.05em' }}>ES</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                    {rates.ES.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: esColor, fontVariantNumeric: 'tabular-nums' }}>
                    {esChange >= 0 ? '+' : ''}{esChange.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({esChange >= 0 ? '+' : ''}{esChangePct.toFixed(2)}%)
                  </span>
                </div>
              );
            })()}
            <div className="market-sep" style={{ width: 1, height: 20, background: 'var(--border)' }} />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.05em' }}>WTI</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#fb923c', fontVariantNumeric: 'tabular-nums' }}>
                ${rates.WTI.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="market-sep" style={{ width: 1, height: 20, background: 'var(--border)' }} />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.05em' }}>GOLD</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#f59e0b', fontVariantNumeric: 'tabular-nums' }}>
                ${rates.GOLD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="market-sep" style={{ width: 1, height: 20, background: 'var(--border)' }} />
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.05em' }}>DXY</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                {rates.DXY.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {showKrw && <div className="market-sep" style={{ width: 1, height: 20, background: 'var(--border)' }} />}
            {showKrw && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#fbbf24', fontVariantNumeric: 'tabular-nums' }}>
                  ₩{Math.round(rates.KRW).toLocaleString('en-US')}
                </span>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>/USD</span>
              </div>
            )}
            {showEur && <div className="market-sep" style={{ width: 1, height: 20, background: 'var(--border)' }} />}
            {showEur && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#34d399', fontVariantNumeric: 'tabular-nums' }}>
                  €{rates.EUR.toFixed(4)}
                </span>
                <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>/USD</span>
              </div>
            )}
            {ratesUpdatedAt && (
              <span className="mobile-hide" style={{ fontSize: 10, color: 'var(--muted)', opacity: 0.6, marginLeft: 'auto' }}>
                {ratesUpdatedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' })}
              </span>
            )}
          </div>

          {/* Row 2: US Treasury Yields */}
          <div className="market-row-2" style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '6px 16px' }}>
            <span className="market-treasury-label" style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.05em' }}>US TREASURY</span>
            <div className="market-sep" style={{ width: 1, height: 16, background: 'var(--border)' }} />
            {([
              { label: '5Y', value: rates.T5Y },
              { label: '10Y', value: rates.T10Y },
              { label: '30Y', value: rates.T30Y },
            ] as const).map(({ label, value }, i) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                {i > 0 && <div className="market-sep" style={{ width: 1, height: 16, background: 'var(--border)', marginRight: 16 }} />}
                <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)' }}>{label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#a78bfa', fontVariantNumeric: 'tabular-nums' }}>
                  {value.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Summary Cards — hidden when no accounts */}
        {accountsLoaded && accounts.length > 0 && (
          <SummaryCards
            cash={summary.cash}
            stockValue={summary.stock}
            prevCloseStockValue={positions.reduce((sum, p) => sum + p.prev_close * p.quantity, 0)}
            accountBreakdown={accountBreakdown}
            krwRate={rates.KRW}
            eurRate={rates.EUR}
            showKrw={showKrw}
            showEur={showEur}
            loading={portfolioLoading}
            accountFilter={accountFilter}
            onAccountClick={(id, name) => setHistoryAccount({ id, name })}
          />
        )}

        {accountsLoaded && accounts.length === 0 ? (
          <>
            {/* Only show Trading Hints tab */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              <button className="tab active">Trading Hint</button>
            </div>
            <div className="card" style={{ marginBottom: 20, overflowX: 'auto' }}>
              <TradingHints
                hints={tradingHints}
                onEdit={handleEditHint}
                onDelete={handleDeleteHint}
                onSymbolClick={ticker => { setAnalysisInitialTab('hints'); setAnalysisTicker(ticker); }}
                onAddHint={() => { setEditingHint(null); setTradingHintOpen(true); }}
              />
            </div>
          </>
        ) : (
          <>
            {/* Tabs */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {([['portfolio', 'Portfolio'], ['history', 'Trading History'], ['hints', 'Trading Hint']] as const).map(([tab, label]) => (
                <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
                  {label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="card" style={{ marginBottom: 20, overflowX: 'auto' }}>
              {activeTab === 'portfolio' && (
                <StockPortfolio positions={positions} currency="USD" rates={rates} onTickerClick={ticker => { setAnalysisInitialTab('history'); setAnalysisTicker(ticker); }} />
              )}
              {activeTab === 'history' && (
                <TransactionHistory
                  transactions={transactions}
                  currency="USD"
                  rates={rates}
                  onEdit={openEditModal}
                  onDelete={handleDeleteTx}
                  onDeleteMany={handleDeleteMany}
                  deepLink={historyDeepLink}
                  onAddTradingHistory={() => { setEditingTx(null); setTxModalOpen(true); }}
                  onTickerClick={ticker => { setAnalysisInitialTab('history'); setAnalysisTicker(ticker); }}
                />
              )}
              {activeTab === 'hints' && (
                <TradingHints
                  hints={tradingHints}
                  onEdit={handleEditHint}
                  onDelete={handleDeleteHint}
                  onSymbolClick={ticker => { setAnalysisInitialTab('hints'); setAnalysisTicker(ticker); }}
                  onAddHint={() => { setEditingHint(null); setTradingHintOpen(true); }}
                />
              )}
            </div>
          </>
        )}

      </div>

      {txModalOpen && (
        <TransactionModal
          accounts={accounts}
          currency="USD"
          editingTx={editingTx}
          onSubmit={handleTransactionSubmit}
          onClose={closeTransactionModal}
          prefillTicker={txPrefill?.ticker}
          prefillAccountId={txPrefill?.accountId}
          tickerSuggestions={[...new Set([
            ...positions.map(p => p.ticker),
            ...transactions.map(t => t.ticker).filter(Boolean),
          ])].sort()}
        />
      )}

      {accountSettingsOpen && (
        <AccountSettingsModal
          accounts={accounts}
          onClose={() => setAccountSettingsOpen(false)}
          onAddAccount={handleAddAccount}
          onRename={handleRenameAccount}
          onToggleHidden={handleToggleHidden}
          onDelete={handleDeleteAccount}
        />
      )}
      {historyAccount && (
        <AccountHistoryModal
          accountId={historyAccount.id}
          accountName={historyAccount.name}
          onClose={() => setHistoryAccount(null)}
        />
      )}
      {analysisTicker && (
        <TradeAnalysisModal
          ticker={analysisTicker}
          currency="USD"
          rates={rates}
          onClose={() => { setAnalysisTicker(null); setAnalysisInitialTab('history'); }}
          onAddTransaction={() => handleAddTransactionFromAnalysis(analysisTicker)}
          onShowHistory={handleShowHistoryForTicker}
          initialTab={analysisInitialTab}
          hintRefreshTrigger={hintRefreshTrigger}
          onAddHint={handleAddHintFromAnalysis}
          onEditHint={handleEditHint}
          onDeleteHint={handleDeleteHint}
        />
      )}
      {csvImportOpen && (
        <CsvImportModal accounts={accounts} onClose={() => setCsvImportOpen(false)} onImported={() => { refreshAll(); setCsvImportOpen(false); }} />
      )}
      {tradingHintOpen && (
        <TradingHintModal
          editingHint={editingHint}
          prefillTicker={hintPrefillTicker}
          tickerSuggestions={[...new Set(tradingHints.map(h => h.ticker))].sort()}
          onClose={closeTradingHintModal}
          onSaved={fetchTradingHints}
        />
      )}
      <PriceAlertToasts
        alerts={priceAlerts}
        onDismiss={id => setPriceAlerts(prev => prev.filter(a => a.id !== id))}
      />
    </div>
  );
}
