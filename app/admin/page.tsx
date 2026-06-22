"use client";

import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import {
  MapPin,
  ShieldAlert,
  ChevronRight,
  Shield,
  Users,
  Activity,
} from "lucide-react";

const adminMenus = [
  {
    href: "/admin/locations",
    icon: MapPin,
    label: "จัดการสถานีตรวจวัด",
    description: "เพิ่ม แก้ไข หรือลบจุดเก็บตัวอย่างน้ำบนแผนที่",
    badge: "Locations",
    color: "bg-primary-light text-primary border-primary/10",
    iconBg: "bg-primary text-white",
    available: true,
  },
  {
    href: "/admin/users",
    icon: Users,
    label: "จัดการผู้ใช้งาน",
    description: "กำหนดสิทธิ์และบทบาทของผู้ใช้ในระบบ",
    badge: "Users",
    color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
    iconBg: "bg-blue-500 text-white",
    available: true,
  },
  {
    href: "/admin/reports",
    icon: Activity,
    label: "รายงานระบบ",
    description: "ดูสถานะและบันทึกกิจกรรมทั้งหมดในระบบ",
    badge: "Reports",
    color: "bg-surface-subtle text-text-muted border-border",
    iconBg: "bg-surface text-text-muted border border-border",
    available: false,
  },
];

export default function AdminPage() {
  const { currentUser } = useAppStore();
  const router = useRouter();

  if (!currentUser || currentUser.role !== "ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh px-6 text-center w-full max-w-lg mx-auto bg-surface-muted border-x border-border">
        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-3xl flex items-center justify-center mb-4 border border-red-500/20">
          <ShieldAlert size={28} className="animate-pulse" />
        </div>
        <h1 className="font-display text-xl font-normal text-text-primary mb-1">
          สิทธิ์การเข้าถึงถูกจำกัด
        </h1>
        <p className="text-xs text-text-secondary mb-6 max-w-[80%] mx-auto leading-relaxed">
          หน้านี้สำหรับผู้ดูแลระบบ (System Admin) เท่านั้น
        </p>
        <button
          onClick={() => router.push("/map")}
          className="w-full max-w-[200px] py-3.5 bg-primary hover:bg-navy-dark text-white font-bold rounded-2xl text-xs uppercase tracking-wider shadow-sm transition-colors cursor-pointer"
        >
          กลับไปหน้าแผนที่
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-dvh w-full bg-surface-muted pb-[120px] transition-colors duration-300">
      <div className="w-full max-w-2xl mx-auto px-4 sm:px-8">

        {/* Header */}
        <div className="pt-10 sm:pt-16 pb-8 sm:pb-10 border-b border-border mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center shadow-sm flex-shrink-0">
              <Shield size={22} className="text-white" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-text-primary leading-tight">
                Admin{" "}
                <span className="text-primary">Panel</span>
              </h1>
              <p className="text-xs text-text-secondary mt-0.5">
                ศูนย์ควบคุมระบบตรวจวัดคุณภาพน้ำ
              </p>
            </div>
          </div>

          {/* Role badge */}
          <div className="flex items-center gap-2 mt-4">
            <span className="inline-flex items-center gap-1.5 text-[9px] font-bold text-primary bg-primary-light border border-primary/10 px-3 py-1.5 rounded-full uppercase tracking-wider">
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              System Administrator
            </span>
          </div>
        </div>

        {/* Menu Section */}
        <div className="space-y-3">
          <p className="text-[9px] font-bold text-text-muted uppercase tracking-wider px-1 mb-5">
            เมนูการจัดการ
          </p>

          {adminMenus.map((menu) => {
            const Icon = menu.icon;
            return (
              <button
                key={menu.href}
                onClick={() => menu.available && router.push(menu.href)}
                disabled={!menu.available}
                className={`w-full group flex items-center gap-4 p-5 sm:p-6 bg-surface rounded-2xl border border-border shadow-sm transition-all duration-200 text-left
                  ${menu.available
                    ? "hover:border-primary/30 hover:shadow-md hover:scale-[1.01] cursor-pointer active:scale-[0.99]"
                    : "opacity-50 cursor-not-allowed"
                  }`}
              >
                {/* Icon */}
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 ${menu.iconBg} ${menu.available ? "group-hover:scale-105" : ""}`}
                >
                  <Icon size={20} />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-bold text-text-primary truncate">
                      {menu.label}
                    </h3>
                    {!menu.available && (
                      <span className="text-[8px] font-bold text-text-muted bg-surface-subtle border border-border px-2 py-0.5 rounded-full uppercase tracking-wider flex-shrink-0">
                        เร็วๆ นี้
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    {menu.description}
                  </p>
                  {menu.available && (
                    <span className={`inline-block mt-2 text-[9px] font-bold px-2.5 py-1 rounded-full border uppercase tracking-wider ${menu.color}`}>
                      {menu.badge}
                    </span>
                  )}
                </div>

                {/* Arrow */}
                <ChevronRight
                  size={16}
                  className={`flex-shrink-0 transition-all duration-200 ${
                    menu.available
                      ? "text-text-muted group-hover:text-primary group-hover:translate-x-0.5"
                      : "text-text-muted/30"
                  }`}
                />
              </button>
            );
          })}
        </div>

        {/* Footer note */}
        <div className="mt-10 p-4 bg-surface rounded-2xl border border-border flex items-start gap-3">
          <ShieldAlert size={14} className="text-text-muted flex-shrink-0 mt-0.5" />
          <p className="text-[10px] text-text-muted leading-relaxed">
            การเปลี่ยนแปลงใดๆ ในหน้านี้จะมีผลต่อข้อมูลระบบทันที
            กรุณาดำเนินการด้วยความระมัดระวัง
          </p>
        </div>
      </div>
    </div>
  );
}
