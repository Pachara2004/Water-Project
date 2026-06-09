'use client';

import { useAppStore } from '@/lib/store';
import { Sun, Moon } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function ThemeToggle() {
  const { theme, toggleTheme } = useAppStore();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by waiting until mounted
  useEffect(() => {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
      useAppStore.getState().setTheme('dark');
    } else {
      useAppStore.getState().setTheme('light');
    }

    const timer = setTimeout(() => {
      setMounted(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) {
    return (
      <div className="w-10 h-10 rounded-full bg-surface border border-border opacity-50 flex items-center justify-center" />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-90 hover:scale-105 shadow-md bg-surface text-text-primary border border-border relative overflow-hidden"
      aria-label="Toggle Light/Dark Theme"
      title={theme === 'light' ? 'เปิดโหมดมืด (Dark Mode)' : 'เปิดโหมดสว่าง (Light Mode)'}
    >
      <div
        className={`transition-all duration-500 absolute flex items-center justify-center ${
          theme === 'dark'
            ? 'rotate-0 opacity-100 scale-100'
            : 'rotate-90 opacity-0 scale-50 pointer-events-none'
        }`}
      >
        <Sun size={20} className="text-amber-500 fill-amber-500/20" />
      </div>
      <div
        className={`transition-all duration-500 absolute flex items-center justify-center ${
          theme === 'light'
            ? 'rotate-0 opacity-100 scale-100'
            : '-rotate-90 opacity-0 scale-50 pointer-events-none'
        }`}
      >
        <Moon size={20} className="text-indigo-600 fill-indigo-600/10" />
      </div>
    </button>
  );
}
