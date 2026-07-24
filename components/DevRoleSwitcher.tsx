"use client";

import { useState, useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { User, Shield, Eye, ShieldAlert, ChevronRight, Sun, Moon } from "lucide-react";
import { refreshNavDots } from "@/lib/navEvents";

type Role = "guest" | "collector" | "officer" | "admin";

export default function DevRoleSwitcher() {
    const { currentUser, theme, toggleTheme } = useAppStore();
    const [isOpen, setIsOpen] = useState(false);

    const roles: { id: Role; label: string; icon: any; color: string }[] = [
        { id: "guest", label: "Guest (ทั่วไป)", icon: Eye, color: "text-gray-500 bg-gray-100 dark:bg-zinc-800" },
        { id: "officer", label: "Officer (เจ้าหน้าที่)", icon: User, color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30" },
        { id: "collector", label: "Collector (ผู้เก็บตัวอย่าง)", icon: Shield, color: "text-purple-600 bg-purple-50 dark:bg-purple-950/30" },
        { id: "admin", label: "Admin (ผู้ดูแลระบบ)", icon: ShieldAlert, color: "text-red-600 bg-red-50 dark:bg-red-950/30" },
    ];

    const changeRole = async (roleId: Role) => {
        if (!currentUser) return;

        useAppStore.setState({
            currentUser: {
                ...currentUser,
                role: roleId,
                fullName: `Test ${roleId.toUpperCase()}`,
            },
        });

        try {
            await fetch("/api/dev/switch-role", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ userId: currentUser.id, roleName: roleId }),
            });
        } catch (e) {
            console.error("Failed to sync role to DB:", e);
        }

        setIsOpen(false);

        if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("storage"));
            try {
                refreshNavDots?.();
            } catch (e) {
                console.error("DevRoleSwitcher: Cannot refresh nav dots", e);
            }
        }
    };

    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    const isDark = theme === "dark";

    return (
        <div className="fixed inset-y-0 left-0 z-9999 pointer-events-none select-none flex items-center">
            {/* 🌫️ 1. ฉากหลังล่องหนเต็มจอเพื่อแตะพื้นที่อื่นแล้วปิดเมนู */}
            {isOpen && <div className="pointer-events-auto fixed inset-0 bg-transparent" onClick={() => setIsOpen(false)} />}

            {/* 📍 2. เส้นขีดสัมผัสขอบจอ (Edge Handle Trigger) */}
            {!isOpen && (
                <div
                    onClick={() => setIsOpen(true)}
                    className="pointer-events-auto w-2.5 h-25 bg-secondary/50 rounded-r-md cursor-pointer flex items-center justify-center transition-all"
                    style={{ WebkitTapHighlightColor: "transparent" }}
                >
                    <ChevronRight size={14} className="text-white -ml-0.5" />
                </div>
            )}

            {/* 📋 3. แผงเมนูบทบาทสไตล์มินิมอล + ปุ่มสลับธีม */}
            <div
                className={`pointer-events-auto fixed inset-y-0 left-2 my-auto h-fit w-14 bg-card-summary border border-white/10 py-3 px-1.5 flex flex-col gap-2 rounded-2xl transition-all duration-300 ease-out z-10 ${
                    isOpen ? "translate-x-0 opacity-100 scale-100" : "-translate-x-20 opacity-0 scale-95 pointer-events-none"
                }`}
            >
                {/* รายการปุ่มสิทธิ์ทรงไอคอนสี่เหลี่ยมมน */}
                <div className="flex flex-col gap-2">
                    {roles.map((r) => {
                        const Icon = r.icon;
                        const isCurrent = currentUser?.role === r.id;

                        return (
                            <button
                                key={r.id}
                                onClick={() => changeRole(r.id)}
                                title={r.label}
                                className={`w-11 h-11 rounded-xl flex items-center justify-center transition-all border active:scale-[0.90] cursor-pointer relative group ${
                                    isCurrent ? "bg-white text-card-summary border-white shadow-md font-bold" : "bg-card-summary text-white/80 border-white/10 hover:bg-white/10 hover:text-white"
                                }`}
                            >
                                <Icon size={18} />
                                {isCurrent && <div className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-card-summary border border-white animate-pulse" />}
                            </button>
                        );
                    })}
                </div>

                {/* 🌟 เส้นกั้นแบ่งโซน */}
                <div className="w-8 h-[1px] bg-white/15 mx-auto my-0.5" />

                {/* 🌟 ปุ่มสลับ Theme Mode (Dark/Light) */}
                <button
                    onClick={toggleTheme}
                    title={isDark ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"}
                    className="w-11 h-11 rounded-xl flex items-center justify-center transition-all border border-white/10 bg-card-summary text-white/80 hover:bg-white/10 hover:text-white active:scale-[0.90] cursor-pointer relative overflow-hidden"
                >
                    {isDark ? <Sun size={18} className="text-amber-400 fill-amber-400/20" /> : <Moon size={18} className="text-indigo-300 fill-indigo-300/20" />}
                </button>
            </div>
        </div>
    );
}
