import { create } from "zustand";

export type UserRole = "admin" | "officer" | "collector" | "guest";

export interface CurrentUser {
    id: number;
    lineUniqueId: string;
    lineProfileName: string;
    firstName: string | null;
    lastName: string | null;
    phoneNumber: string | null;
    role: UserRole;
}

interface AppState {
    currentUser: CurrentUser | null;
    theme: "light" | "dark";
    setRole: (role: UserRole) => void;
    setUser: (user: CurrentUser | null) => void;
    toggleTheme: () => void;
    setTheme: (theme: "light" | "dark") => void;
}

export const useAppStore = create<AppState>((set) => ({
    currentUser: null,
    theme: "light",

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
