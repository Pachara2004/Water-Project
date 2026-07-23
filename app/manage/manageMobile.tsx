"use client";

import type { CurrentUser } from "@/lib/store";
import type { useRouter } from "next/navigation";
import liff from "@line/liff";
import { ChevronRight, LogOut } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import GpsAutoTrackToggle from "@/components/GpsAutoTrackToggle";
import { adminMenus, MenuBoxDisable, EditProfileDrawer, ProfileCard } from "@/components/manage/manageHelpers";

export interface ManagePageProps {
    currentUser: CurrentUser | null | undefined;
    isAdmin: boolean;
    pendingCounts: { reviewPendingCount: number; rolePendingCount: number };
    showEdit: boolean;
    setShowEdit: (v: boolean) => void;
    handleLogout: () => void;
    router: ReturnType<typeof useRouter>;
    showToast: (message: string, variant?: "success" | "danger") => void;
    toastElement: React.ReactNode;
}

export default function ManageMobile({ currentUser, isAdmin, pendingCounts, showEdit, setShowEdit, handleLogout, router, showToast, toastElement }: ManagePageProps) {
    return (
        <div className="min-h-dvh w-full bg-bg transition-colors duration-75">
            <div className="w-full max-w-2xl mx-auto px-4">
                <div className="pt-8 pb-1 mb-1 p-1">
                    <h1 className="font-display text-2xl font-semibold text-text ">
                        บัญชี <span className="text-primary">ของฉัน</span>
                    </h1>
                </div>

                {currentUser ? (
                    <div className="mb-2">
                        <ProfileCard onEdit={() => setShowEdit(true)} />
                    </div>
                ) : (
                    <div className="mb-2 bg-card-general rounded-xl border border-border p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                        <button
                            onClick={() => liff.login()}
                            className="w-full sm:w-auto min-w-50 h-11 flex items-center bg-[#06C755] text-white rounded-md overflow-hidden active:opacity-90 transition-opacity cursor-pointer font-sans"
                        >
                            <div className="h-full w-12 flex items-center justify-center bg-black/10 shrink-0">
                                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                                    <path d="M24 10.304c0-5.691-5.383-10.304-12-10.304s-12 4.613-12 10.304c0 5.101 4.272 9.351 10.05 10.198.391.084.922.258 1.057.592.12.301.079.77.038 1.074l-.165 1.002c-.05.303-.243 1.186 1.047.646 1.291-.54 6.969-4.103 9.485-7.026 1.834-2.022 2.488-3.954 2.488-5.494z" />
                                </svg>
                            </div>

                            <div className="flex-1 text-center pr-12 text-sm font-bold tracking-wide">เข้าสู่ระบบด้วย LINE</div>
                        </button>
                    </div>
                )}

                <div className="space-y-2">
                    <div className="p-1 flex flex-wrap justify-between items-center gap-y-2 gap-x-4">
                        <p className="text-sm font-semibold text-primary mt-1">เมนูการจัดการ</p>
                        {/* flex-wrap ที่แถวนอก: จอแคบให้ปุ่มตกลงบรรทัดใหม่ทั้งคู่ ดีกว่าบีบจนข้อความล้น */}
                        <div className="shrink-0 mt-1 flex items-center gap-2">
                            <ThemeToggle showLabel />
                            <GpsAutoTrackToggle />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2 items-stretch">
                        {isAdmin &&
                            adminMenus.map((menu) => {
                                const Icon = menu.icon;
                                const pendingCount = menu.countKey ? pendingCounts[menu.countKey] : 0;
                                return (
                                    <button
                                        key={menu.href}
                                        onClick={() => menu.available && router.push(menu.href)}
                                        disabled={MenuBoxDisable(menu.available)}
                                        className={`w-full h-full group flex items-start gap-4 p-4 bg-card-general rounded-2xl border border-border transition-all duration-75 text-left
    ${menu.available ? "hover:border-primary/30 hover:scale-[1.01] cursor-pointer active:scale-[0.99]" : "opacity-50 cursor-not-allowed"}`}
                                    >
                                        <div className={`flex items-center justify-center shrink-0 self-center transition-transform duration-200 ${menu.available ? "group-hover:scale-105" : ""}`}>
                                            <Icon size={24} />
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="text-sm font-semibold text-text-primary truncate">{menu.label}</h3>
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

                                        <ChevronRight
                                            size={18}
                                            className={`shrink-0 self-center transition-all duration-75 ${menu.available ? "text-secondary group-hover:text-primary group-hover:translate-x-0.5" : "text-text-muted/30"}`}
                                        />
                                    </button>
                                );
                            })}

                        {currentUser && (
                            <>
                                <div className="w-full border-t mt-3" />
                                <button
                                    onClick={handleLogout}
                                    className="w-full group flex items-center gap-4 p-4 bg-danger mt-1 rounded-2xl border border-border hover:border-red-500/30 hover:scale-[1.01] active:scale-[0.99] transition-all duration-75 text-left cursor-pointer"
                                >
                                    <div className="flex items-center justify-center shrink-0 text-white transition-transform duration-200 group-hover:scale-105">
                                        <LogOut size={24} />
                                    </div>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-semibold text-white truncate">ออกจากระบบ</h3>
                                        </div>
                                    </div>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {showEdit && <EditProfileDrawer onClose={() => setShowEdit(false)} showToast={showToast} />}
            {toastElement}
        </div>
    );
}
