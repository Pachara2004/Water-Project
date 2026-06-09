import { create } from 'zustand';

export type UserRole = 'ADMIN' | 'COLLECTOR' | 'GENERAL' | 'EXECUTIVE';

export interface CurrentUser {
  id: string; // UUID primary key
  lineId: string; // LINE Unique ID
  name: string;
  role: UserRole;
  phone?: string | null; // PII contact information
}

interface AppState {
  currentUser: CurrentUser | null;
  theme: 'light' | 'dark';
  setRole: (role: UserRole) => void;
  setUser: (user: CurrentUser | null) => void;
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentUser: null, // Start as null until LIFF/Auth resolves
  theme: 'light',
  setRole: (role) =>
    set((state) => ({
      currentUser: state.currentUser ? { ...state.currentUser, role } : null,
    })),
  setUser: (user) => set({ currentUser: user }),
  toggleTheme: () =>
    set((state) => {
      const nextTheme = state.theme === 'light' ? 'dark' : 'light';
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', nextTheme);
        if (nextTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
      return { theme: nextTheme };
    }),
  setTheme: (theme) =>
    set(() => {
      if (typeof window !== 'undefined') {
        localStorage.setItem('theme', theme);
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
      return { theme };
    }),
}));
