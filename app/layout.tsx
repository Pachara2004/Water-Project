import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import LiffProvider from "@/components/LiffProvider";
import DevRoleSwitcher from "@/components/DevRoleSwitcher";

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
