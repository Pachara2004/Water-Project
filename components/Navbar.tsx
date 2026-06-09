'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Map, Send, Settings, Sparkles, BarChart2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';

export default function Navbar() {
  const pathname = usePathname();
  const { currentUser } = useAppStore();

  const getNavItems = () => {
    const items = [{ href: '/map', label: 'แผนที่', icon: Map }];

    if (!currentUser) return items;

    if (currentUser.role === 'COLLECTOR' || currentUser.role === 'ADMIN') {
      items.push({ href: '/collector', label: 'ประวัติส่ง', icon: Send });
    }

    if (currentUser.role === 'COLLECTOR' || currentUser.role === 'EXECUTIVE' || currentUser.role === 'ADMIN') {
      items.push({ href: '/executive', label: 'แดชบอร์ด', icon: BarChart2 });
    }

    if (currentUser.role === 'ADMIN') {
      items.push({ href: '/admin/locations', label: 'จัดการ', icon: Settings });
    }

    if (currentUser.role === 'USER') {
      items.push({ href: '/upgrade', label: 'อัปเกรด', icon: Sparkles });
    }

    return items;
  };

  const navItems = getNavItems();

  return (
    <>
      {/* ── Mobile / Tablet: docked bottom bar ─────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 w-full z-[950] bg-surface/90 backdrop-blur-xl border-t border-border/80 shadow-sm transition-all duration-300" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center justify-around h-[72px] px-2 max-w-md mx-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex flex-col items-center justify-center w-20 h-13 rounded-2xl transition-all duration-300 relative active:scale-[0.93] ${
                  isActive ? 'text-white' : 'text-text-muted hover:text-text-primary'
                }`}
              >
                {isActive && (
                  <div className="absolute inset-0 bg-primary rounded-2xl -z-10 shadow-sm animate-fade-in" />
                )}
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2.5 : 2}
                  className={`transition-transform duration-300 ${isActive ? '-translate-y-0.5' : 'group-hover:-translate-y-0.5'}`}
                />
                <span className={`text-[10px] mt-1.5 transition-all duration-300 ${isActive ? 'font-black' : 'font-medium'}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── Desktop: left sidebar ──────────────────────────────────────── */}
      <nav className="hidden lg:flex fixed left-0 top-0 h-full w-[80px] z-[950] flex-col items-center py-8 gap-3
                      bg-surface/90 backdrop-blur-xl border-r border-border/80 shadow-sm transition-colors duration-300">

        {/* Logo mark */}
        <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-sm mb-6 flex-shrink-0">
          <span className="text-white font-bold text-sm tracking-widest">WQ</span>
        </div>

        <div className="flex flex-col items-center gap-1 flex-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                className={`group relative flex flex-col items-center justify-center w-14 h-14 rounded-2xl transition-all duration-300 active:scale-[0.93] ${
                  isActive
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-text-muted hover:bg-surface-subtle hover:text-text-primary'
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                {/* Tooltip */}
                <div className="absolute left-[calc(100%+8px)] top-1/2 -translate-y-1/2 bg-foreground text-background text-xs font-bold px-3 py-1.5 rounded-xl whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 shadow-lg">
                  {item.label}
                </div>
              </Link>
            );
          })}
        </div>

        {/* Bottom spacer */}
        <div className="h-16" />
      </nav>
    </>
  );
}
