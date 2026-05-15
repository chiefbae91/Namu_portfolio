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
          Centralize your portfolio management
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
          Track your portfolio, trading history, and hints — all in one place.
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
        Get Started →
      </button>
    </div>
  );
}
