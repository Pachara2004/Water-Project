"use client";

import liff from "@line/liff";
import { ChevronRight, LogOut } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import GpsAutoTrackToggle from "@/components/GpsAutoTrackToggle";
import { adminMenus, MenuBoxDisable, EditProfileDrawer, ProfileCard } from "@/components/manage/manageHelpers";
import type { ManagePageProps } from "./manageMobile";

// Desktop = ขยาย layout เดิมของ mobile ให้เต็มจอ (container กว้างขึ้น, เมนูจาก stack แนวตั้งเป็นกริดหลายคอลัมน์)
// ไม่เปลี่ยน logic/handler — ใช้ props ชุดเดียวกับ manageMobile ที่มาจาก page.tsx
export default function ManageDesktop({ currentUser, isAdmin, pendingCounts, showEdit, setShowEdit, handleLogout, router, showToast, toastElement }: ManagePageProps) {
    return (
        <div className="min-h-dvh w-full bg-bg transition-colors duration-75">
            <div className="w-full max-w-[1600px] mx-auto px-8">
                <div className="pt-8 pb-1 mb-1 p-1">
                    <h1 className="font-display text-2xl font-semibold text-text ">
                        บัญชี <span className="text-primary">ของฉัน</span>
                    </h1>
                </div>

                {currentUser ? (
                    <div className="mb-4 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-stretch">
                        <ProfileCard onEdit={() => setShowEdit(true)} />
                        {/* Desktop: รวม toggle การตั้งค่าไว้ในการ์ดมีป้ายกำกับ ไม่ให้ลอยเดี่ยวๆ ไม่มีบริบทแบบก่อนหน้า */}
                        <div className="bg-card-general rounded-2xl border border-border p-4 flex flex-col gap-3 lg:w-56 shrink-0">
                            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">การตั้งค่าด่วน</p>
                            <div className="flex flex-col gap-2 items-stretch [&>button]:w-full [&>button]:justify-start">
                                <ThemeToggle showLabel />
                                <GpsAutoTrackToggle />
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="mb-4 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 items-stretch">
                        <div className="bg-card-general rounded-xl border border-border p-4 flex items-center">
                            <button
                                onClick={() => liff.login()}
                                className="w-auto min-w-50 h-11 flex items-center bg-[#06C755] text-white rounded-md overflow-hidden active:opacity-90 transition-opacity cursor-pointer font-sans"
                            >
                                <div className="h-full w-12 flex items-center justify-center bg-black/10 shrink-0">
                                    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                                        <path d="M24 10.304c0-5.691-5.383-10.304-12-10.304s-12 4.613-12 10.304c0 5.101 4.272 9.351 10.05 10.198.391.084.922.258 1.057.592.12.301.079.77.038 1.074l-.165 1.002c-.05.303-.243 1.186 1.047.646 1.291-.54 6.969-4.103 9.485-7.026 1.834-2.022 2.488-3.954 2.488-5.494z" />
                                    </svg>
                                </div>

                                <div className="flex-1 text-center pr-12 text-sm font-bold tracking-wide">เข้าสู่ระบบด้วย LINE</div>
                            </button>
                        </div>
                        <div className="bg-card-general rounded-2xl border border-border p-4 flex flex-col gap-3 lg:w-56 shrink-0">
                            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">การตั้งค่าด่วน</p>
                            <div className="flex flex-col gap-2 items-stretch [&>button]:w-full [&>button]:justify-start">
                                <ThemeToggle showLabel />
                                <GpsAutoTrackToggle />
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    <div className="p-1">
                        <p className="text-sm font-semibold text-primary mt-1">เมนูการจัดการ</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
                        {isAdmin &&
                            adminMenus.map((menu) => {
                                const Icon = menu.icon;
                                const pendingCount = menu.countKey ? pendingCounts[menu.countKey] : 0;
                                return (
                                    <button
                                        key={menu.href}
                                        onClick={() => menu.available && router.push(menu.href)}
                                        disabled={MenuBoxDisable(menu.available)}
                                        className={`w-full h-full group flex flex-col items-start gap-4 p-6 bg-card-general rounded-2xl border border-border transition-all duration-150 text-left
    ${menu.available ? "hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5 cursor-pointer active:translate-y-0" : "opacity-50 cursor-not-allowed"}`}
                                    >
                                        <div className="flex items-center justify-between w-full">
                                            <div
                                                className={`flex items-center justify-center shrink-0 w-12 h-12 rounded-xl transition-transform duration-200 ${menu.iconBg} ${menu.available ? "group-hover:scale-105" : ""}`}
                                            >
                                                <Icon size={22} />
                                            </div>
                                            <ChevronRight
                                                size={18}
                                                className={`shrink-0 transition-all duration-150 ${menu.available ? "text-secondary group-hover:text-primary group-hover:translate-x-1" : "text-text-muted/30"}`}
                                            />
                                        </div>

                                        <div className="flex-1 min-w-0 w-full">
                                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                                <h3 className="text-base font-semibold text-text-primary">{menu.label}</h3>
                                                {!menu.available && (
                                                    <span className="text-xs font-semibold text-text-muted bg-card-general border border-border px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                                                        เร็วๆ นี้
                                                    </span>
                                                )}
                                                {pendingCount > 0 && (
                                                    <span className="text-xs font-bold text-text-danger bg-bg-danger border border-border-danger px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0">
                                                        {pendingCount} รายการ
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-text-secondary leading-relaxed">{menu.description}</p>
                                        </div>
                                    </button>
                                );
                            })}
                    </div>

                    {currentUser && (
                        <div className="pt-4 mt-2 border-t border-border flex justify-end">
                            {/* Desktop: ปุ่มออกจากระบบเป็น ghost/outline ขนาดพอดี ไม่ให้เด่นข่มเมนูหลักเหมือนแท่งแดงเต็มความกว้างแบบ mobile */}
                            <button
                                onClick={handleLogout}
                                className="group inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border text-text-secondary hover:text-white hover:bg-danger hover:border-danger transition-all duration-150 cursor-pointer"
                            >
                                <LogOut size={16} />
                                <span className="text-sm font-semibold">ออกจากระบบ</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {showEdit && <EditProfileDrawer onClose={() => setShowEdit(false)} showToast={showToast} />}
            {toastElement}
        </div>
    );
}
