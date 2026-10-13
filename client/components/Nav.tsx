'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { List, MousePointerClick } from 'lucide-react';

const links = [
  { href: '/', label: 'Sessions', Icon: List },
  { href: '/heatmap', label: 'Heatmap', Icon: MousePointerClick },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-x-8 gap-y-2 px-5 pt-4">
        <p className="pb-3 text-[15px] font-semibold tracking-tight">CausalFunnel Analytics</p>
        <nav aria-label="Main" className="flex gap-6">
          {links.map(({ href, label, Icon }) => {
            const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`-mb-px flex items-center gap-2 border-b-2 pb-3 text-sm ${
                  active ? 'border-accent font-medium text-ink' : 'border-transparent text-muted'
                }`}
              >
                <Icon size={16} strokeWidth={1.75} aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
