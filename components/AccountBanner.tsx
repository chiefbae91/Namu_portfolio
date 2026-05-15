'use client';

interface Props {
  onOpenAccounts: () => void;
}

export default function AccountBanner({ onOpenAccounts }: Props) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #4338ca 0%, #6366f1 50%, #7c3aed 100%)',
      padding: '20px 24px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      flexWrap: 'wrap',
    }}>
      <div>
        <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'white', lineHeight: 1.4 }}>
          당신의 모든 계좌를 여기서 중앙 관리 하세요
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
          투자 포트폴리오, 거래 내역, 매매 힌트를 한 곳에서 관리하세요.
        </p>
      </div>
      <button
        onClick={onOpenAccounts}
        style={{
          background: 'white',
          color: '#4338ca',
          padding: '10px 22px',
          fontWeight: 700,
          fontSize: 14,
          borderRadius: 8,
          whiteSpace: 'nowrap',
          flexShrink: 0,
          boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
        }}
      >
        계좌 관리 시작 →
      </button>
    </div>
  );
}
