import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Namu Portfolio',
  description: 'Investment portfolio tracker',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
