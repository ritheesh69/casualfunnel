import type { Metadata } from 'next';
import './globals.css';
import Nav from '@/components/Nav';

export const metadata: Metadata = {
  title: 'CausalFunnel Analytics',
  description: 'Sessions and click heatmaps collected by the CausalFunnel tracker.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas font-sans text-ink">
        <Nav />
        <main className="mx-auto max-w-6xl px-5 pb-16 pt-8">{children}</main>
      </body>
    </html>
  );
}
