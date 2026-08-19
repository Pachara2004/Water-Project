import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import LiffProvider from "@/components/LiffProvider";
import DevRoleSwitcher from "@/components/DevRoleSwitcher";
import { Smartphone } from "lucide-react";

export const metadata: Metadata = {
    title: "ระบบตรวจสอบคุณภาพน้ำ | Water Quality TestKit",
    description: "ระบบตรวจสอบและบันทึกข้อมูลคุณภาพน้ำทะเลชายฝั่ง ผ่าน LINE LIFF",
    keywords: "คุณภาพน้ำ, water quality, ตรวจสอบน้ำ, LINE LIFF, ประมง",
    other: {
        "color-scheme": "light dark",
        "supported-color-schemes": "light dark",
    },
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
    themeColor: [
        { media: "(prefers-color-scheme: light)", color: "#eff7f9" },
        { media: "(prefers-color-scheme: dark)", color: "#0b0f17" },
    ],
};

// Component แจ้งเตือนเมื่อเปิดแนวนอนบนอุปกรณ์พกพา
function OrientationGuard() {
    return (
        <aside
            aria-label="orientation-warning"
            className="hidden max-lg:landscape:flex fixed inset-0 z-99999 bg-slate-950/95 text-white flex-col items-center justify-center p-6 text-center backdrop-blur-md select-none"
        >
            <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center mb-4 animate-bounce">
                <Smartphone size={32} className="rotate-90 text-primary" />
            </div>
            <h2 className="text-lg font-bold">กรุณาใช้งานในแนวตั้ง</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-xs leading-relaxed">ระบบถูกออกแบบมาสำหรับการแสดงผลในแนวตั้งเพื่อความถูกต้องของการแสดงผลแผนที่และข้อมูล</p>
        </aside>
    );
}

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="th" suppressHydrationWarning>
            <head>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
              try {
                var localTheme = localStorage.getItem('theme');
                var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                var isDark = localTheme === 'dark' || (!localTheme && systemDark);
                
                if (isDark) {
                  document.documentElement.classList.add('dark');
                  document.documentElement.style.colorScheme = 'dark';
                } else {
                  document.documentElement.classList.remove('dark');
                  document.documentElement.style.colorScheme = 'light';
                }
              } catch (_) {}
            `,
                    }}
                />
            </head>
            <body className="overscroll-none bg-surface-muted text-text-primary" suppressHydrationWarning>
                {/* ดักจับและบังคับหน้าจอแนวตั้งเฉพาะหน้าจอมือถือ/แท็บเล็ต */}
                <OrientationGuard />

                <LiffProvider>
                    <main className="min-h-screen lg:pl-50 lg:pb-0!" style={{ paddingBottom: "calc(88px + env(safe-area-inset-bottom))" }}>
                        {children}
                    </main>
                    <Navbar />
                    <DevRoleSwitcher />
                </LiffProvider>
            </body>
        </html>
    );
}
