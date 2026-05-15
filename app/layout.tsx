import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Namu Portfolio',
  description: 'Investment portfolio tracker',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* Apply saved theme before first paint to prevent flash */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{if(localStorage.getItem('theme')==='light')document.documentElement.classList.add('light');}catch(e){}})();` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
