'use client';
import { useCallback, useEffect, useState } from 'react';
import { Settings, FileUp, PlusCircle, RefreshCw } from 'lucide-react';
import { Account, AccountBreakdown, ExchangeRates, PortfolioPosition, SummaryData, Transaction } from '@/lib/types';
import StockPortfolio from '@/components/tabs/StockPortfolio';
import TransactionHistory from '@/components/tabs/TransactionHistory';
import TransactionModal from '@/components/modals/TransactionModal';
import AccountSettingsModal from '@/components/modals/AccountSettingsModal';
import TradeAnalysisModal from '@/components/modals/TradeAnalysisModal';
import CsvImportModal from '@/components/modals/CsvImportModal';
import SummaryCards from '@/components/SummaryCards';

const TRANSFER_OFFSET = 1_000_000;

export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [rates, setRates] = useState<ExchangeRates>({ USD: 1, KRW: 1380, EUR: 0.92 });
  const [showKrw, setShowKrw] = useState(false);
  const [showEur, setShowEur] = useState(false);
  const [activeTab, setActiveTab] = useState<'portfolio' | 'history'>('portfolio');
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<SummaryData>({ cash: 0, stock: 0, options_pnl: 0, total: 0 });
  const [accountBreakdown, setAccountBreakdown] = useState<AccountBreakdown[]>([]);
  const [txModalOpen, setTxModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [analysisTicker, setAnalysisTicker] = useState<string | null>(null);
  const [txPrefill, setTxPrefill] = useState<{ ticker: string; accountId: number } | null>(null);
  const [historyDeepLink, setHistoryDeepLink] = useState<{ ticker: string; id: number } | null>(null);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [portfolioLoading, setPortfolioLoading] = useState(false);
  const [ratesUpdatedAt, setRatesUpdatedAt] = useState<Date | null>(null);
  const [ratesRefreshing, setRatesRefreshing] = useState(false);

  const fetchAccounts = useCallback(async () => {
    const res = await fetch('/api/accounts');
    setAccounts(await res.json());
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
    const q = selectedAccountId !== 'all' ? `?account_id=${selectedAccountId}` : '';
    try {
      const res = await fetch(`/api/portfolio${q}`);
      if (!res.ok) {
        const text = await res.text();
        console.error('Portfolio API error:', res.status, text);
        return;
      }
      const data = await res.json();
      setPositions(data.positions || []);
      const stock = data.stock_value ?? 0;
      const cash = data.cash ?? 0;
      setSummary({ cash, stock, options_pnl: 0, total: cash + stock });
      setAccountBreakdown(data.account_breakdown || []);
    } catch (err) {
      console.error('fetchPortfolio failed:', err);
    } finally { if (showLoader) setPortfolioLoading(false); }
  }, [selectedAccountId]);

  const fetchTransactions = useCallback(async () => {
    const q = selectedAccountId !== 'all' ? `?account_id=${selectedAccountId}` : '';
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
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    setTransactions(combined);
  }, [selectedAccountId]);

  useEffect(() => { fetchAccounts(); fetchRates(); }, []);

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

  useEffect(() => { fetchPortfolio(); fetchTransactions(); }, [selectedAccountId]);

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

  return (
    <div style={{ minHeight: '100vh', padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--accent)', marginRight: 8 }}>Namu Portfolio</h1>

        <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)} style={{ minWidth: 140 }}>
          <option value="all">All Accounts</option>
          {visibleAccounts.map(a => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
        </select>
        <button onClick={() => setAccountSettingsOpen(true)}
          style={{ background: 'var(--border)', color: 'var(--muted)', padding: '6px 10px' }}
          title="Manage Accounts"><Settings size={15} /></button>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
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

        <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 8, alignItems: 'center' }}>
          {showKrw && <span>₩{Math.round(rates.KRW).toLocaleString('en-US')}/USD</span>}
          {showEur && <span>€{rates.EUR.toFixed(4)}/USD</span>}
          {ratesUpdatedAt && (
            <span style={{ opacity: 0.5, fontSize: 10 }}>
              {ratesUpdatedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/New_York', timeZoneName: 'short' })}
            </span>
          )}
          <button
            onClick={fetchRates}
            title="Refresh Rates"
            style={{ background: 'none', color: 'var(--muted)', padding: 2, display: 'flex', alignItems: 'center' }}
          >
            <RefreshCw size={11} style={{ animation: ratesRefreshing ? 'spin 0.6s linear infinite' : 'none' }} />
          </button>
        </div>

        <button onClick={() => { setEditingTx(null); setTxModalOpen(true); }}
          style={{ background: 'var(--accent)', color: 'white', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600 }}>
          <PlusCircle size={15} /> Add Trade
        </button>

        <button onClick={() => setCsvImportOpen(true)}
          style={{ background: 'var(--border)', color: 'var(--muted)', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
          <FileUp size={14} /> CSV Import
        </button>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 20px 0' }}>
        {/* Summary Cards */}
        <SummaryCards
          cash={summary.cash}
          stockValue={summary.stock}
          accountBreakdown={accountBreakdown}
          krwRate={rates.KRW}
          eurRate={rates.EUR}
          showKrw={showKrw}
          showEur={showEur}
          loading={portfolioLoading}
        />

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {([['portfolio', 'Portfolio'], ['history', 'Trading History']] as const).map(([tab, label]) => (
            <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="card" style={{ marginBottom: 20, overflowX: 'auto' }}>
          {activeTab === 'portfolio' && (
            <StockPortfolio positions={positions} currency="USD" rates={rates} onTickerClick={setAnalysisTicker} />
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
            />
          )}
        </div>

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
      {analysisTicker && (
        <TradeAnalysisModal
          ticker={analysisTicker}
          currency="USD"
          rates={rates}
          onClose={() => setAnalysisTicker(null)}
          onAddTransaction={() => handleAddTransactionFromAnalysis(analysisTicker)}
          onShowHistory={handleShowHistoryForTicker}
        />
      )}
      {csvImportOpen && (
        <CsvImportModal accounts={accounts} onClose={() => setCsvImportOpen(false)} onImported={() => { refreshAll(); setCsvImportOpen(false); }} />
      )}
    </div>
  );
}
