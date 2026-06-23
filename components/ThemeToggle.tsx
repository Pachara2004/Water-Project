'use client';

import { useAppStore } from '@/lib/store';
import { Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function ThemeToggle({ showLabel = false }: { showLabel?: boolean }) {
  const { theme, toggleTheme } = useAppStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
      useAppStore.getState().setTheme('dark');
    } else {
      useAppStore.getState().setTheme('light');
    }

    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) {
    return (
      <div className={`bg-surface border border-border opacity-50 flex items-center justify-center ${showLabel ? 'h-10 px-4 rounded-2xl gap-2' : 'w-10 h-10 rounded-full'}`} />
    );
  }

  const isDark = theme === 'dark';

  if (showLabel) {
    return (
      <button
        onClick={toggleTheme}
        className="flex items-center gap-2.5 h-10 px-4 rounded-2xl bg-surface border border-border text-text-primary shadow-sm hover:border-primary/30 hover:shadow-md transition-all duration-300 active:scale-[0.96] cursor-pointer relative overflow-hidden"
        aria-label="Toggle Light/Dark Theme"
      >
        {/* Icon */}
        <div className="relative w-4 h-4 flex-shrink-0">
          <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${isDark ? 'rotate-0 opacity-100 scale-100' : 'rotate-90 opacity-0 scale-50'}`}>
            <Sun size={16} className="text-amber-500 fill-amber-500/20" />
          </div>
          <div className={`absolute inset-0 flex items-center justify-center transition-all duration-500 ${!isDark ? 'rotate-0 opacity-100 scale-100' : '-rotate-90 opacity-0 scale-50'}`}>
            <Moon size={16} className="text-indigo-500 fill-indigo-500/10" />
          </div>
        </div>

        {/* Label */}
        <span className="text-xs font-bold text-text-secondary whitespace-nowrap">
          {isDark ? 'โหมดสว่าง' : 'โหมดมืด'}
        </span>
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-90 hover:scale-105 shadow-md bg-surface text-text-primary border border-border relative overflow-hidden cursor-pointer"
      aria-label="Toggle Light/Dark Theme"
      title={isDark ? 'เปิดโหมดสว่าง (Light Mode)' : 'เปิดโหมดมืด (Dark Mode)'}
    >
      <div className={`transition-all duration-500 absolute flex items-center justify-center ${isDark ? 'rotate-0 opacity-100 scale-100' : 'rotate-90 opacity-0 scale-50 pointer-events-none'}`}>
        <Sun size={20} className="text-amber-500 fill-amber-500/20" />
      </div>
      <div className={`transition-all duration-500 absolute flex items-center justify-center ${!isDark ? 'rotate-0 opacity-100 scale-100' : '-rotate-90 opacity-0 scale-50 pointer-events-none'}`}>
        <Moon size={20} className="text-indigo-600 fill-indigo-600/10" />
      </div>
    </button>
  );
}
