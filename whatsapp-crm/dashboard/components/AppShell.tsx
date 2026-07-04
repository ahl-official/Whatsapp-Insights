'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAskPage = pathname === '/ask';

  if (isAskPage) {
    return <>{children}</>;
  }

  return (
    <>
      <nav className="nav">
        <span className="nav-brand">WhatsApp CRM</span>
        <div className="nav-links">
          <Link href="/ask">💬 Ask AI</Link>
          <Link href="/logs">📡 Live Feed</Link>
          <Link href="/">Overview</Link>
          <Link href="/agents">Agents</Link>
          <Link href="/customers">Customers</Link>
          <Link href="/search">Search</Link>
        </div>
      </nav>
      <main className="main">{children}</main>
    </>
  );
}
