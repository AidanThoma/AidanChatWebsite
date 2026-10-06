import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ThomaGPT',
  description: 'A human-powered chat experience.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
