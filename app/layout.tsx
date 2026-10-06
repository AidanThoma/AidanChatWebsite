import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'HumanChat',
  description: 'Human-powered chat support for anonymous users and admins.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
