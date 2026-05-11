'use client';
import { useCallback, useEffect, useState } from 'react';
import { Settings, FileUp } from 'lucide-react';
import { Account, Currency, ExchangeRates, OptionPosition, PortfolioPosition, SummaryData, Transaction } from '@/lib/types';
import StockPortfolio from '@/components/tabs/StockPortfolio';
import TransactionHistory from '@/components/tabs/TransactionHistory';
import OptionsPositions from '@/components/tabs/OptionsPositions';
import TransactionForm from '@/components/TransactionForm';
import AccountSettingsModal from '@/components/modals/AccountSettingsModal';
import TradeAnalysisModal from '@/components/modals/TradeAnalysisModal';
import CsvImportModal from '@/components/modals/CsvImportModal';

const SYMBOLS: Record<Currency, string> = { USD: '$', KRW: '₩', EUR: '€' };

export default function Home() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('all');
  const [currency, setCurrency] = useState<Currency>('USD');
  const [rates, setRates] = useState<ExchangeRates>({ USD: 1, KRW: 1380, EUR: 0.92 });
  const [activeTab, setActiveTab] = useState<'portfolio' | 'history' | 'options'>('portfolio');
  const [positions, setPositions] = useState<PortfolioPosition[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [options, setOptions] = useState<OptionPosition[]>([]);
  const [summary, setSummary] = useState<SummaryData>({ cash: 0, stock: 0, options_pnl: 0, total: 0 });
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [analysisTicker, setAnalysisTicker] = useState<string | null>(null);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [csvImportOpen, setCsvImportOpen] = useState(false);
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  const fetchAccounts = useCallback(async () => {
    const res = await fetch('/api/accounts');
    const data: Account[] = await res.json();
    setAccounts(data);
  }, []);

  const fetchRates = useCallback(async () => {
    const res = await fetch('/api/exchange-rates');
    const data = await res.json();
    setRates(data);
  }, []);

  const fetchPortfolio = useCallback(async () => {
    setPortfolioLoading(true);
    const q = selectedAccountId !== 'all' ? `?account_id=${selectedAccountId}` : '';
    try {
      const res = await fetch(`/api/portfolio${q}`);
      const data = await res.json();
      setPositions(data.positions || []);
      const stock = data.stock_value ?? 0;
      const cash = data.cash ?? 0;
      setSummary(prev => ({ ...prev, cash, stock, total: cash + stock + prev.options_pnl }));
    } finally { setPortfolioLoading(false); }
  }, [selectedAccountId]);

  const fetchTransactions = useCallback(async () => {
    const q = selectedAccountId !== 'all' ? `?account_id=${selectedAccountId}` : '';
    const res = await fetch(`/api/transactions${q}`);
    const data: Transaction[] = await res.json();
    setTransactions(data);
  }, [selectedAccountId]);

  const fetchOptions = useCallback(async () => {
    const q = selectedAccountId !== 'all' ? `?account_id=${selectedAccountId}` : '';
    const res = await fetch(`/api/options${q}`);
    const data: OptionPosition[] = await res.json();
    setOptions(data);
    const pnl = data.reduce((s, o) => s + (o.realized_pnl ?? 0), 0);
    setSummary(prev => ({ ...prev, options_pnl: pnl, total: prev.cash + prev.stock + pnl }));
  }, [selectedAccountId]);

  useEffect(() => { fetchAccounts(); fetchRates(); }, []);
  useEffect(() => { fetchPortfolio(); fetchTransactions(); fetchOptions(); }, [selectedAccountId]);

  const refreshAll = () => { fetchPortfolio(); fetchTransactions(); fetchOptions(); };

  const handleTransactionSubmit = async (data: any) => {
    const isEdit = !!editingTx;
    if (data.is_option) {
      const { is_option, ...optionData } = data;
      await fetch('/api/options', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(optionData) });
    } else if (isEdit) {
      await fetch(`/api/transactions/${editingTx!.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
      setEditingTx(null);
    } else {
      await fetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    }
    refreshAll();
  };

  const handleDeleteTx = async (id: number) => {
    if (!confirm('이 거래를 삭제하시겠습니까?')) return;
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
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
  const conv = (usd: number) => usd * rates[currency];
  const fmt = (usd: number) => {
    const v = conv(usd);
    const sym = SYMBOLS[currency];
    if (currency === 'KRW') return `${sym}${Math.round(v).toLocaleString()}`;
    return `${sym}${v.toFixed(2)}`;
  };

  return (
    <div style={{ minHeight: '100vh', padding: '0 0 40px' }}>
      {/* Header */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: 'var(--accent)', marginRight: 8 }}>Namu Portfolio</h1>

        {/* Account selector */}
        <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)} style={{ minWidth: 140 }}>
          <option value="all">전체 계좌</option>
          {visibleAccounts.map(a => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
        </select>
        <button onClick={() => setAccountSettingsOpen(true)}
          style={{ background: 'var(--border)', color: 'var(--muted)', padding: '6px 10px' }}
          title="계좌 관리"><Settings size={15} /></button>

        <div style={{ flex: 1 }} />

        {/* Exchange rates */}
        <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', gap: 10 }}>
          <span>1 USD = ₩{rates.KRW.toLocaleString()}</span>
          <span>1 USD = €{rates.EUR.toFixed(4)}</span>
        </div>

        {/* Currency selector */}
        <div style={{ display: 'flex', gap: 2 }}>
          {(['USD', 'KRW', 'EUR'] as Currency[]).map(c => (
            <button key={c} onClick={() => setCurrency(c)}
              style={{ padding: '5px 10px', background: currency === c ? 'var(--accent)' : 'var(--border)', color: currency === c ? 'white' : 'var(--muted)', fontWeight: 500, fontSize: 12 }}>
              {c}
            </button>
          ))}
        </div>

        {/* CSV Import */}
        <button onClick={() => setCsvImportOpen(true)}
          style={{ background: 'var(--border)', color: 'var(--muted)', padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
          <FileUp size={14} /> CSV 임포트
        </button>
      </div>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '20px 20px 0' }}>
        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
          {[
            { label: '현금', value: summary.cash, color: '#60a5fa' },
            { label: '주식 평가금액', value: summary.stock, color: 'var(--accent)', loading: portfolioLoading },
            { label: '옵션 실현P&L', value: summary.options_pnl, color: summary.options_pnl >= 0 ? 'var(--green)' : 'var(--red)' },
            { label: '총자산', value: summary.cash + summary.stock, color: '#e2e8f0' },
          ].map(card => (
            <div key={card.label} className="card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>{card.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>
                {card.loading ? <span style={{ fontSize: 14, color: 'var(--muted)' }}>로딩중...</span> : fmt(card.value)}
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
          {([['portfolio', '주식포트폴리오'], ['history', '거래히스토리'], ['options', '옵션포지션']] as const).map(([tab, label]) => (
            <button key={tab} className={`tab ${activeTab === tab ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
              {label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="card" style={{ marginBottom: 20, overflowX: 'auto' }}>
          {activeTab === 'portfolio' && (
            <StockPortfolio positions={positions} currency={currency} rates={rates} onTickerClick={setAnalysisTicker} />
          )}
          {activeTab === 'history' && (
            <TransactionHistory transactions={transactions} currency={currency} rates={rates}
              onEdit={tx => { setEditingTx(tx); }}
              onDelete={handleDeleteTx} />
          )}
          {activeTab === 'options' && (
            <OptionsPositions options={options} currency={currency} rates={rates} />
          )}
        </div>

        {/* Transaction Form */}
        <TransactionForm
          accounts={accounts}
          currency={currency}
          editingTx={editingTx}
          onSubmit={handleTransactionSubmit}
          onCancelEdit={() => setEditingTx(null)}
        />
      </div>

      {/* Modals */}
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
        <TradeAnalysisModal ticker={analysisTicker} onClose={() => setAnalysisTicker(null)} />
      )}
      {csvImportOpen && (
        <CsvImportModal accounts={accounts} onClose={() => setCsvImportOpen(false)} onImported={() => { refreshAll(); setCsvImportOpen(false); }} />
      )}
    </div>
  );
}
