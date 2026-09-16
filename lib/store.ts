/**
 * @file lib/store.ts
 * @project Water Monitoring Project
 * @module Client / State Management (Zustand)
 * @description
 * [TH] Global State Store ของแอปพลิเคชันฝั่งไคลเอนต์ พัฒนาด้วย Zustand
 * จัดเก็บข้อมูลผู้ใช้ปัจจุบัน (`currentUser`), บทบาทสิทธิ์ (`UserRole`), ธีมการแสดงผล (`theme` light/dark พร้อม sync localStorage)
 * และสถานะการรอการยินยอมเงื่อนไขข้อตกลง (`pendingTermsLogin`)
 *
 * [EN] Global client-side application state store powered by Zustand.
 * Manages active user profile (`currentUser`), RBAC role (`UserRole`), theme settings (`theme` synced with localStorage and HTML root),
 * and terms gatekeeping status (`pendingTermsLogin`).
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-06-09
 * @modified 2026-09-15
 * @version 1.4.0
 * @license Proprietary
 *
 * @see {@link /lib/lineAuth.ts} ระบบยืนยันตัวตนและการจัดการข้อตกลง
 *
 * @contributors
 * - Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) - ออกแบบ Store ตั้งต้น (Auth, Theme, Navigation)
 * - Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - เพิ่มการรองรับ Terms Gatekeeping (`pendingTermsLogin`)
 *
 * @lastModified 2026-09-15
 * @lastModifiedBy Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 *
 * @changelog
 * - 2026-09-15 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - feat: ต้องยอมรับข้อตกลงก่อนระบบจะเก็บ LINE uid
 * - 2026-07-22 by Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856) - fix: แก้สีปฏิทิน
 * - 2026-06-30 by Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) - refactor: comment
 * - 2026-06-26 by Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) - refactor: .ใช้ prettierrc ส่วนกลาง
 * - 2026-06-25 by Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004) - Dev petch (#20)
 */

import { create } from "zustand";

/**
 * [TH] บทบาทสิทธิ์ของผู้ใช้ในระบบ
 * [EN] Role identifiers recognized in the application
 */
export type UserRole = "admin" | "officer" | "collector" | "guest";

/**
 * [TH] ข้อมูลของผู้ใช้งานที่เข้าสู่ระบบอยู่ในปัจจุบัน
 * [EN] Represents the authenticated user profile in the client session
 */
export interface CurrentUser {
    /** [TH] รหัสประจำตัวผู้ใช้ในฐานข้อมูล | [EN] Internal database user ID */
    id: number;
    /** [TH] LINE Unique Identifier (UID) | [EN] Official LINE user identifier */
    lineUniqueId: string;
    /** [TH] ชื่อที่แสดงผลบนโปรไฟล์ LINE | [EN] LINE display name */
    lineProfileName: string;
    /** [TH] ชื่อจริงของผู้ใช้ (หากกรอกข้อมูลแล้ว) | [EN] First name */
    firstName: string | null;
    /** [TH] นามสกุลจริงของผู้ใช้ (หากกรอกข้อมูลแล้ว) | [EN] Last name */
    lastName: string | null;
    /** [TH] หมายเลขโทรศัพท์ติดต่อ (หากระบุไว้) | [EN] Phone number */
    phoneNumber: string | null;
    /** [TH] บทบาทสิทธิ์การใช้งาน | [EN] User role */
    role: UserRole;
}

/**
 * [TH] โครงสร้างสถานะและฟังก์ชันแอ็กชันของ Zustand App Store
 * [EN] State and action signatures for the Zustand application store
 */
export interface AppState {
    /** [TH] ข้อมูลผู้ใช้งานปัจจุบัน หรือ null หากยังไม่ได้ล็อกอิน | [EN] Current authenticated user or null */
    currentUser: CurrentUser | null;
    /** [TH] ธีมของแอปพลิเคชัน ('light' หรือ 'dark') | [EN] Color theme mode ('light' | 'dark') */
    theme: "light" | "dark";
    /** [TH] อัปเดตบทบาทของผู้ใช้ปัจจุบันชั่วคราว | [EN] Updates current user role */
    setRole: (role: UserRole) => void;
    /** [TH] กำหนดหรือล้างข้อมูลผู้ใช้ปัจจุบัน | [EN] Sets or clears current user */
    setUser: (user: CurrentUser | null) => void;
    /** [TH] สลับธีมระหว่าง Light และ Dark | [EN] Toggles between light and dark themes */
    toggleTheme: () => void;
    /** [TH] กำหนดธีมที่ระบุโดยตรง | [EN] Sets explicit color theme */
    setTheme: (theme: "light" | "dark") => void;
    // LIFF ล็อกอินแล้วแต่ยังต้องยอมรับข้อตกลงก่อน (ดู lib/lineAuth.ts)
    // "new" = ยังไม่มีบัญชี (uid ยังไม่ถูกเก็บ), "existing" = มีบัญชีแต่ยังไม่ยอมรับฉบับปัจจุบัน, null = ไม่ต้อง
    /** [TH] สถานะการรอการยินยอมเงื่อนไข ('new', 'existing', หรือ null) | [EN] Pending terms gate condition */
    pendingTermsLogin: "new" | "existing" | null;
    /** [TH] กำหนดสถานะการรอการยินยอมเงื่อนไข | [EN] Sets pending terms gate state */
    setPendingTermsLogin: (pending: "new" | "existing" | null) => void;
}

/**
 * [TH] Custom Hook สำหรับเข้าถึงและจัดการ Global State ของระบบผ่าน Zustand
 * [EN] Zustand custom hook for accessing and dispatching global application state
 *
 * @example
 * const { currentUser, theme, toggleTheme } = useAppStore();
 */
export const useAppStore = create<AppState>((set) => ({
    currentUser: null,
    theme: "light",
    pendingTermsLogin: null,
    setPendingTermsLogin: (pending) => set({ pendingTermsLogin: pending }),

    // สลับบทบาทผู้ใช้งานชั่วคราว (ใช้ในหน้าจัดการสมาชิกของ Admin)
    setRole: (role) =>
        set((state) => ({
            currentUser: state.currentUser ? { ...state.currentUser, role } : null,
        })),

    // เซ็ตข้อมูลและอัปโหลด Payload ลงสู่สถานะคลังสโตร์หลัก
    setUser: (user) => set({ currentUser: user }),

    toggleTheme: () =>
        set((state) => {
            const nextTheme = state.theme === "light" ? "dark" : "light";
            if (typeof window !== "undefined") {
                localStorage.setItem("theme", nextTheme);
                document.documentElement.classList.toggle("dark", nextTheme === "dark");
                document.documentElement.style.colorScheme = nextTheme
            }
            return { theme: nextTheme };
        }),

    setTheme: (theme) =>
        set(() => {
            if (typeof window !== "undefined") {
                localStorage.setItem("theme", theme);
                document.documentElement.classList.toggle("dark", theme === "dark");
                document.documentElement.style.colorScheme = theme;
            }
            return { theme };
        }),
}));
