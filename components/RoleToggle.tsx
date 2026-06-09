'use client';

import { useAppStore, UserRole } from '@/lib/store';
import { Shield, User } from 'lucide-react';

export default function RoleToggle() {
  const { currentUser, setRole } = useAppStore();

  const toggleRole = () => {
    if (!currentUser) return;
    const newRole: UserRole = currentUser.role === 'ADMIN' ? 'USER' : 'ADMIN';
    setRole(newRole);
  };

  if (!currentUser) return null;

  return (
    <div className="relative group">
      <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-white font-black px-1.5 py-0.5 rounded-sm uppercase shadow-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
        Mockup Only
      </div>
      <button
        onClick={toggleRole}
        className={`flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full font-bold transition-all duration-300 shadow-sm border border-dashed ${
          currentUser.role === 'ADMIN'
            ? 'bg-blue-50/80 border-blue-300 text-blue-700 hover:shadow-md'
            : 'bg-surface-subtle border-border text-text-secondary hover:shadow-md'
        }`}
        title="สลับสิทธิ์ผู้ใช้ (สำหรับทดสอบ)"
      >
        {currentUser.role === 'ADMIN' ? (
          <span className="text-sm sm:text-xs uppercase">Admin</span>
        ) : (
          <span className="text-sm sm:text-xs uppercase">User</span>
        )}
      </button>
    </div>
  );
}
