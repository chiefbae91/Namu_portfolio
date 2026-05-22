'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Settings, RefreshCw, LogOut, LogIn, HelpCircle } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase';
import { Account, AccountBreakdown, AccountType, ExchangeRates, HintAlert, HintNotification, PortfolioPosition, SummaryData, Transaction, TradingHint, WatchlistQuote } from '@/lib/types';
import StockPortfolio from '@/components/tabs/StockPortfolio';
import TransactionHistory from '@/components/tabs/TransactionHistory';
import TradingHints from '@/components/tabs/TradingHints';
import TransactionModal from '@/components/modals/TransactionModal';
import AccountSettingsModal from '@/components/modals/AccountSettingsModal';
import AccountHistoryModal from '@/components/modals/AccountHistoryModal';
import TradeAnalysisModal from '@/components/modals/TradeAnalysisModal';
import TradingHintModal from '@/components/modals/TradingHintModal';
import SummaryCards from '@/components/SummaryCards';
import AccountBanner from '@/components/AccountBanner';
import ThemeToggle from '@/components/ThemeToggle';
import PriceAlertToasts, { PriceAlert } from '@/components/PriceAlertToasts';
import AlertBell from '@/components/AlertBell';

const TRANSFER_PREFIX = 'tf-';

export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountTypes, setAccountTypes] = useState<AccountType[]>([]);
  const [accountFilter, setAccountFilter] = useState<string>(''); // '' = all, '1,2,3' = subset
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [watchlistQuotes, setWatchlistQuotes] = useState<WatchlistQuote[]>([]);
  const [watchlistAdding, setWatchlistAdding] = useState(false);
  const [watchlistInput, setWatchlistInput] = useState('');
  const [rates, setRates] = useState<ExchangeRates>({ USD: 1, KRW: 1380, KRW_PREV: 1380, EUR: 0.92, DXY: 104, DXY_PREV: 104, WTI: 78, WTI_PREV: 78, GOLD: 2300, GOLD_PREV: 2300, ES: 5800, ES_PREV: 5800, ES_MARKET_STATE: 'REGULAR', ES_EXT_PRICE: null, ES_EXT_CHG_PCT: null, T5Y: 4.25, T5Y_PREV: 4.25, T10Y: 4.50, T10Y_PREV: 4.50, T30Y: 4.75, T30Y_PREV: 4.75 });
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
  const [hintAlerts, setHintAlerts] = useState<HintAlert[]>([]);
  const [hintNotifications, setHintNotifications] = useState<HintNotification[]>([]);

  const fetchTradingHints = useCallback(async () => {
    const res = await fetch('/api/trading-hints');
    setTradingHints(await res.json());
    setHintRefreshTrigger(t => t + 1);
  }, []);

  const fetchHintAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts');
      if (res.ok) setHintAlerts(await res.json());
    } catch {}
  }, []);

  const fetchHintNotifications = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts/notifications');
      if (res.ok) setHintNotifications(await res.json());
    } catch {}
  }, []);

  const runCheckPrices = useCallback(async () => {
    try {
      const res = await fetch('/api/check-prices', { method: 'POST' });
      if (res.ok) {
        const { triggered } = await res.json();
        if (triggered?.length > 0) fetchHintNotifications();
      }
    } catch {}
  }, [fetchHintNotifications]);

  const fetchWatchlistQuotes = useCallback(async (tickers: string[]) => {
    if (tickers.length === 0) { setWatchlistQuotes([]); return; }
    try {
      const res = await fetch(`/api/quotes?tickers=${tickers.join(',')}`);
      if (res.ok) setWatchlistQuotes(await res.json());
    } catch {}
  }, []);

  const fetchAccounts = useCallback(async () => {
    const res = await fetch('/api/accounts');
    setAccounts(await res.json());
    setAccountsLoaded(true);
  }, []);

  const fetchAccountTypes = useCallback(async () => {
    const res = await fetch('/api/account-types');
    if (res.ok) setAccountTypes(await res.json());
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
      id: `${TRANSFER_PREFIX}${tf.id}`,
      account_id: tf.account_id,
      account_name: tf.account_name,
      date: tf.date,
      ticker: '',
      type: tf.type === 'DEPOSIT' ? 'transfer_deposit' : 'transfer_withdraw',
      quantity: 0,
      price: tf.amount,
      fee: 0,
      currency: 'USD',
      notes: tf.note ?? '',
    }));

    const combined = [...txs, ...transfers]
      .sort((a, b) => b.date.localeCompare(a.date) || String(b.id).localeCompare(String(a.id)));
    setTransactions(combined);
  }, [accountFilter]);

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email ?? null);
        fetchAccounts();
        fetchAccountTypes();
        fetchHintAlerts();
        fetchHintNotifications();
        runCheckPrices();
        fetch('/api/settings?key=app_name')
          .then(r => r.json())
          .then(d => { if (d.value) { setAppName(d.value); document.title = d.value; } });
      } else {
        setAccountsLoaded(true);
      }
    });
    fetchRates(); fetchTradingHints();
    try {
      const stored = localStorage.getItem('namu_watchlist');
      if (stored) {
        const tickers: string[] = JSON.parse(stored);
        setWatchlist(tickers);
        fetchWatchlistQuotes(tickers);
      }
    } catch {}
  }, []);

  // Auto-refresh rates every 5 minutes
  useEffect(() => {
    const id = setInterval(fetchRates, 300_000);
    return () => clearInterval(id);
  }, [fetchRates]);

  // Auto-refresh watchlist quotes every 5 minutes
  useEffect(() => {
    const id = setInterval(() => fetchWatchlistQuotes(watchlist), 300_000);
    return () => clearInterval(id);
  }, [fetchWatchlistQuotes, watchlist]);

  // Auto-refresh portfolio prices every 60s (silent, no loading spinner)
  useEffect(() => {
    if (!userEmail) return;
    const id = setInterval(() => fetchPortfolio(false), 60_000);
    return () => clearInterval(id);
  }, [fetchPortfolio, userEmail]);

  useEffect(() => {
    if (!userEmail) return;
    fetchPortfolio(); fetchTransactions();
  }, [accountFilter, userEmail]);

  const refreshAll = () => { fetchPortfolio(); fetchTransactions(); };

  const alertedHintIds = new Set(
    hintAlerts.filter(a => a.active).map(a => a.hint_id)
  );

  const handleToggleAlert = async (hint: TradingHint) => {
    const hintPricesRaw = hint.price;
    const pricesStr = Array.isArray(hintPricesRaw)
      ? hintPricesRaw.join(' ')
      : hintPricesRaw != null ? String(hintPricesRaw) : '';
    await fetch('/api/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hint_id: hint.id, ticker: hint.ticker, hint_type: hint.type, hint_prices: pricesStr }),
    });
    fetchHintAlerts();
  };

  const handleDismissNotification = async (id: string) => {
    setHintNotifications(prev => prev.filter(n => n.id !== id));
    await fetch(`/api/alerts/notifications/${id}`, { method: 'DELETE' }).catch(() => {});
  };

  const handleMarkAllNotificationsRead = async () => {
    setHintNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await fetch('/api/alerts/notifications', { method: 'PATCH' }).catch(() => {});
  };

  const handleAccountSelect = (id: string) => {
    setAccountFilter(id);
    localStorage.setItem('namu_account_filter', id);
  };

  // Restore saved account filter after accounts load
  useEffect(() => {
    if (!accountsLoaded) return;
    const saved = localStorage.getItem('namu_account_filter') ?? '';
    if (!saved) return;
    if (visibleAccounts.some(a => String(a.id) === saved)) {
      setAccountFilter(saved);
    } else {
      localStorage.removeItem('namu_account_filter');
    }
  }, [accountsLoaded]);

  const handleTransactionSubmit = async (data: any) => {
    if (data.type === 'transfer_deposit' || data.type === 'transfer_withdraw') {
      const cfType = data.type === 'transfer_deposit' ? 'DEPOSIT' : 'WITHDRAW';
      if (editingTx) {
        const tfId = String(editingTx.id).slice(TRANSFER_PREFIX.length);
        await fetch(`/api/transfers/${tfId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account_id: data.account_id, amount: data.price, date: data.date, type: cfType, notes: data.notes }),
        });
        setEditingTx(null);
      } else {
        await fetch('/api/transfers', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ account_id: data.account_id, date: data.date, amount: data.price, type: cfType, notes: data.notes }),
        });
      }
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

  const deleteOne = (id: string | number) => {
    if (typeof id === 'string' && id.startsWith(TRANSFER_PREFIX)) {
      return fetch(`/api/transfers/${id.slice(TRANSFER_PREFIX.length)}`, { method: 'DELETE' });
    }
    return fetch(`/api/transactions/${id}`, { method: 'DELETE' });
  };

  const handleDeleteTx = async (id: string | number) => {
    await deleteOne(id);
    refreshAll();
  };

  const handleDeleteMany = async (ids: (string | number)[]) => {
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

  const handleAddType = async (name: string, color: string) => {
    const res = await fetch('/api/account-types', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, color }) });
    if (!res.ok) throw new Error('failed');
    await fetchAccountTypes();
  };

  const handleRenameType = async (id: string | number, name: string, color: string) => {
    const res = await fetch(`/api/account-types/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, color }) });
    if (!res.ok) throw new Error('failed');
    await fetchAccountTypes();
  };

  const handleDeleteType = async (id: string | number) => {
    await fetch(`/api/account-types/${id}`, { method: 'DELETE' });
    await Promise.all([fetchAccountTypes(), fetchAccounts()]);
  };

  const handleAssignType = async (accountId: string | number, typeId: string | number | null) => {
    await fetch(`/api/accounts/${accountId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type_id: typeId }) });
    await fetchAccounts();
  };

  const addToWatchlist = (ticker: string) => {
    const t = ticker.trim().toUpperCase();
    if (!t || watchlist.includes(t)) return;
    const next = [...watchlist, t];
    setWatchlist(next);
    localStorage.setItem('namu_watchlist', JSON.stringify(next));
    fetchWatchlistQuotes(next);
  };

  const removeFromWatchlist = (ticker: string) => {
    const next = watchlist.filter(t => t !== ticker);
    setWatchlist(next);
    localStorage.setItem('namu_watchlist', JSON.stringify(next));
    setWatchlistQuotes(prev => prev.filter(q => q.ticker !== ticker));
  };

  const visibleAccounts = accounts.filter(a => !a.hidden);

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

        {!!userEmail && (
          <button onClick={() => setAccountSettingsOpen(true)}
            style={{ background: 'var(--border)', color: 'var(--muted)', padding: '6px 10px' }}
            title="Manage Accounts"><Settings size={15} /></button>
        )}

        <div className="mobile-hide" style={{ flex: 1 }} />

        <div className="mobile-hide" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)' }}>USD</span>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={showKrw} onChange={e => setShowKrw(e.target.checked)}
              style={{ cursor: 'pointer', accentColor: 'var(--color-krw)' }} />
            <span style={{ fontSize: 12, color: showKrw ? 'var(--color-krw)' : 'var(--muted)', fontWeight: showKrw ? 600 : 400 }}>
              KRW
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer', userSelect: 'none' }}>
            <input type="checkbox" checked={showEur} onChange={e => setShowEur(e.target.checked)}
              style={{ cursor: 'pointer', accentColor: 'var(--color-eur)' }} />
            <span style={{ fontSize: 12, color: showEur ? 'var(--color-eur)' : 'var(--muted)', fontWeight: showEur ? 600 : 400 }}>
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

{userEmail && (
          <span className="mobile-hide" style={{ fontSize: 11, color: 'var(--muted)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {userEmail}
          </span>
        )}

        <ThemeToggle />

        {!!userEmail && (
          <AlertBell
            alerts={hintAlerts}
            notifications={hintNotifications}
            onMarkAllRead={handleMarkAllNotificationsRead}
            onDismiss={handleDismissNotification}
            onDeactivateAlert={async (alertId) => {
              await fetch(`/api/alerts/${alertId}`, { method: 'DELETE' });
              fetchHintAlerts();
            }}
            onTickerClick={ticker => { setAnalysisInitialTab('hints'); setAnalysisTicker(ticker); }}
          />
        )}

        <Link
          href="/guide"
          title="User Guide"
          target="_blank"
          style={{ background: 'none', color: 'var(--muted)', padding: '6px 8px', display: 'flex', alignItems: 'center' }}
        >
          <HelpCircle size={15} />
        </Link>

        {userEmail ? (
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
        ) : (
          <Link href="/login" title="Sign in"
            style={{ background: 'none', color: 'var(--muted)', padding: '6px 8px', display: 'flex', alignItems: 'center' }}>
            <LogIn size={15} />
          </Link>
        )}
      </div>

      {/* Account Tab Bar */}
      {accountsLoaded && visibleAccounts.length > 0 && (() => {
        const filterSorted = accountFilter.split(',').filter(Boolean).sort().join(',');
        const typeTabsToShow = accountTypes.filter(t =>
          visibleAccounts.some(a => String(a.type_id) === String(t.id))
        );
        const tabStyle = (isActive: boolean, accentColor?: string): React.CSSProperties => ({
          padding: '10px 14px',
          fontSize: 13,
          fontWeight: isActive ? 700 : 400,
          color: isActive ? (accentColor ?? 'var(--accent)') : 'var(--muted)',
          background: 'none',
          border: 'none',
          borderBottom: isActive ? `2px solid ${accentColor ?? 'var(--accent)'}` : '2px solid transparent',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          transition: 'color 0.15s',
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        });
        const sep = <div style={{ width: 1, height: 18, background: 'var(--border)', alignSelf: 'center', margin: '0 2px', flexShrink: 0 }} />;
        return (
          <div style={{
            background: 'var(--header-bg)',
            borderBottom: '1px solid var(--border)',
            padding: '0 12px',
            display: 'flex',
            alignItems: 'stretch',
            overflowX: 'auto',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          } as React.CSSProperties}>
            {/* All */}
            <button onClick={() => handleAccountSelect('')} style={tabStyle(accountFilter === '')}>
              All Accounts
            </button>

            {/* Type tabs */}
            {typeTabsToShow.length > 0 && sep}
            {typeTabsToShow.map(t => {
              const ids = visibleAccounts
                .filter(a => String(a.type_id) === String(t.id))
                .map(a => String(a.id)).sort().join(',');
              const isActive = filterSorted === ids;
              return (
                <button key={`type-${t.id}`} onClick={() => handleAccountSelect(ids)} style={tabStyle(isActive, t.color)}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: t.color, flexShrink: 0 }} />
                  {t.name}
                </button>
              );
            })}

            {/* Individual account tabs */}
            {sep}
            {visibleAccounts.map(acct => {
              const isActive = accountFilter === String(acct.id);
              return (
                <button key={String(acct.id)} onClick={() => handleAccountSelect(String(acct.id))} style={tabStyle(isActive)}>
                  {acct.name}
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* Onboarding banner — only when no accounts */}
      {accountsLoaded && accounts.length === 0 && !!userEmail && (
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
              const ms = rates.ES_MARKET_STATE;
              const isExt = ms === 'PRE' || ms === 'POST' || ms === 'POSTPOST';
              const extPrice = rates.ES_EXT_PRICE;
              const extPct = rates.ES_EXT_CHG_PCT;
              const extColor = extPct != null ? (extPct >= 0 ? 'var(--green)' : 'var(--red)') : 'var(--muted)';
              const badgeColor = ms === 'PRE' ? '#f59e0b' : '#818cf8';
              return (
                <div onClick={() => { setAnalysisInitialTab('history'); setAnalysisTicker('ES=F'); }} style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap', cursor: 'pointer' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.05em' }}>ES</span>
                  {isExt && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: badgeColor, border: `1px solid ${badgeColor}`, borderRadius: 3, padding: '0 3px', letterSpacing: '0.04em', lineHeight: '14px' }}>
                      {ms === 'PRE' ? 'PRE' : 'POST'}
                    </span>
                  )}
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                    {(isExt && extPrice != null ? extPrice : rates.ES).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  {isExt && extPrice != null ? (
                    <span style={{ fontSize: 11, fontWeight: 600, color: extColor, fontVariantNumeric: 'tabular-nums' }}>
                      {extPct != null ? `${extPct >= 0 ? '+' : ''}${extPct.toFixed(2)}%` : ''}
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 600, color: esColor, fontVariantNumeric: 'tabular-nums' }}>
                      {esChange >= 0 ? '+' : ''}{esChange.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({esChange >= 0 ? '+' : ''}{esChangePct.toFixed(2)}%)
                    </span>
                  )}
                </div>
              );
            })()}
            {(() => {
              const chg = rates.WTI - rates.WTI_PREV;
              const pct = rates.WTI_PREV !== 0 ? (chg / rates.WTI_PREV) * 100 : 0;
              const col = chg >= 0 ? 'var(--green)' : 'var(--red)';
              return (<>
                <div className="market-sep" style={{ width: 1, height: 20, background: 'var(--border)' }} />
                <div onClick={() => { setAnalysisInitialTab('history'); setAnalysisTicker('CL=F'); }} style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap', cursor: 'pointer' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.05em' }}>WTI</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-oil)', fontVariantNumeric: 'tabular-nums' }}>
                    ${rates.WTI.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: col, fontVariantNumeric: 'tabular-nums' }}>
                    {chg >= 0 ? '+' : ''}{chg.toFixed(2)} ({chg >= 0 ? '+' : ''}{pct.toFixed(2)}%)
                  </span>
                </div>
              </>);
            })()}
            {(() => {
              const chg = rates.GOLD - rates.GOLD_PREV;
              const pct = rates.GOLD_PREV !== 0 ? (chg / rates.GOLD_PREV) * 100 : 0;
              const col = chg >= 0 ? 'var(--green)' : 'var(--red)';
              return (<>
                <div className="market-sep" style={{ width: 1, height: 20, background: 'var(--border)' }} />
                <div onClick={() => { setAnalysisInitialTab('history'); setAnalysisTicker('GC=F'); }} style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap', cursor: 'pointer' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.05em' }}>GOLD</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-gold-commodity)', fontVariantNumeric: 'tabular-nums' }}>
                    ${rates.GOLD.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: col, fontVariantNumeric: 'tabular-nums' }}>
                    {chg >= 0 ? '+' : ''}{chg.toFixed(2)} ({chg >= 0 ? '+' : ''}{pct.toFixed(2)}%)
                  </span>
                </div>
              </>);
            })()}
            {(() => {
              const chg = rates.DXY - rates.DXY_PREV;
              const pct = rates.DXY_PREV !== 0 ? (chg / rates.DXY_PREV) * 100 : 0;
              const col = chg >= 0 ? 'var(--green)' : 'var(--red)';
              return (<>
                <div className="market-sep" style={{ width: 1, height: 20, background: 'var(--border)' }} />
                <div onClick={() => { setAnalysisInitialTab('history'); setAnalysisTicker('DX-Y.NYB'); }} style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap', cursor: 'pointer' }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.05em' }}>DXY</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                    {rates.DXY.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: col, fontVariantNumeric: 'tabular-nums' }}>
                    {chg >= 0 ? '+' : ''}{chg.toFixed(2)} ({chg >= 0 ? '+' : ''}{pct.toFixed(2)}%)
                  </span>
                </div>
              </>);
            })()}
            {showKrw && (() => {
              const chg = rates.KRW - rates.KRW_PREV;
              const pct = rates.KRW_PREV !== 0 ? (chg / rates.KRW_PREV) * 100 : 0;
              const col = chg >= 0 ? 'var(--red)' : 'var(--green)';
              return (<>
                <div className="market-sep" style={{ width: 1, height: 20, background: 'var(--border)' }} />
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-krw)', fontVariantNumeric: 'tabular-nums' }}>
                    ₩{Math.round(rates.KRW).toLocaleString('en-US')}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 500 }}>/USD</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: col, fontVariantNumeric: 'tabular-nums' }}>
                    {chg >= 0 ? '+' : ''}{Math.round(chg)} ({chg >= 0 ? '+' : ''}{pct.toFixed(2)}%)
                  </span>
                </div>
              </>);
            })()}
            {showEur && <div className="market-sep" style={{ width: 1, height: 20, background: 'var(--border)' }} />}
            {showEur && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-eur)', fontVariantNumeric: 'tabular-nums' }}>
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
              { label: '5Y',  value: rates.T5Y,  prev: rates.T5Y_PREV,  ticker: '^FVX' },
              { label: '10Y', value: rates.T10Y, prev: rates.T10Y_PREV, ticker: '^TNX' },
              { label: '30Y', value: rates.T30Y, prev: rates.T30Y_PREV, ticker: '^TYX' },
            ] as const).map(({ label, value, prev, ticker }, i) => {
              const chg = value - prev;
              const col = chg >= 0 ? 'var(--green)' : 'var(--red)';
              return (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {i > 0 && <div className="market-sep" style={{ width: 1, height: 16, background: 'var(--border)', marginRight: 16 }} />}
                  <div
                    onClick={() => { setAnalysisInitialTab('history'); setAnalysisTicker(ticker); }}
                    style={{ display: 'flex', alignItems: 'baseline', gap: 4, cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)' }}>{label}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-bond)', fontVariantNumeric: 'tabular-nums' }}>
                      {value.toFixed(2)}%
                    </span>
                    <span style={{ fontSize: 11, fontWeight: 600, color: col, fontVariantNumeric: 'tabular-nums' }}>
                      {chg >= 0 ? '+' : ''}{chg.toFixed(3)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Row 3: Watchlist */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '6px 16px', borderTop: '1px solid var(--border)', flexWrap: 'wrap', minHeight: 34 }}>
            {watchlistQuotes.map(q => {
              const change = q.price - q.prevClose;
              const changePct = q.prevClose > 0 ? (change / q.prevClose) * 100 : 0;
              const isExt = q.marketState === 'PRE' || q.marketState === 'POST' || q.marketState === 'POSTPOST';
              const displayPrice = isExt && q.extPrice != null ? q.extPrice : q.price;
              const displayPct = isExt && q.extChangePct != null ? q.extChangePct : changePct;
              const pctColor = displayPct >= 0 ? 'var(--green)' : 'var(--red)';
              const badgeColor = q.marketState === 'PRE' ? '#f59e0b' : '#818cf8';
              return (
                <div key={q.ticker} style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.05em' }}>{q.ticker}</span>
                  {isExt && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: badgeColor, border: `1px solid ${badgeColor}`, borderRadius: 3, padding: '0 3px', lineHeight: '14px' }}>
                      {q.marketState === 'PRE' ? 'PRE' : 'POST'}
                    </span>
                  )}
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
                    {q.error ? '—' : `$${displayPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </span>
                  {!q.error && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: pctColor, fontVariantNumeric: 'tabular-nums' }}>
                      {displayPct >= 0 ? '+' : ''}{displayPct.toFixed(2)}%
                    </span>
                  )}
                  <button onClick={() => removeFromWatchlist(q.ticker)}
                    style={{ background: 'none', color: 'var(--muted)', padding: '0 2px', fontSize: 13, lineHeight: 1, opacity: 0.6 }}
                    title={`Remove ${q.ticker}`}>×</button>
                </div>
              );
            })}
            {watchlistAdding ? (
              <input autoFocus value={watchlistInput}
                onChange={e => setWatchlistInput(e.target.value.toUpperCase())}
                onKeyDown={e => {
                  if (e.key === 'Enter') { addToWatchlist(watchlistInput); setWatchlistInput(''); setWatchlistAdding(false); }
                  if (e.key === 'Escape') { setWatchlistAdding(false); setWatchlistInput(''); }
                }}
                onBlur={() => { if (watchlistInput) addToWatchlist(watchlistInput); setWatchlistAdding(false); setWatchlistInput(''); }}
                placeholder="AAPL"
                style={{ width: 64, fontSize: 12, padding: '2px 6px', borderRadius: 4 }} />
            ) : (
              <button onClick={() => setWatchlistAdding(true)}
                style={{ fontSize: 11, color: 'var(--muted)', background: 'none', padding: '1px 4px', opacity: 0.7 }}>
                + Add
              </button>
            )}
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
                onAddHint={!!userEmail ? () => { setEditingHint(null); setTradingHintOpen(true); } : undefined}
                isLoggedIn={!!userEmail}
                alertedHintIds={alertedHintIds}
                onToggleAlert={!!userEmail ? handleToggleAlert : undefined}
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
                  onAddHint={!!userEmail ? () => { setEditingHint(null); setTradingHintOpen(true); } : undefined}
                  isLoggedIn={!!userEmail}
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
          onImported={refreshAll}
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
          accountTypes={accountTypes}
          onClose={() => setAccountSettingsOpen(false)}
          onAddAccount={handleAddAccount}
          onRename={handleRenameAccount}
          onToggleHidden={handleToggleHidden}
          onDelete={handleDeleteAccount}
          onAddType={handleAddType}
          onRenameType={handleRenameType}
          onDeleteType={handleDeleteType}
          onAssignType={handleAssignType}
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
