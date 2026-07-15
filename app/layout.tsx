import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import LiffProvider from "@/components/LiffProvider";

export const metadata: Metadata = {
    title: "ระบบตรวจสอบคุณภาพน้ำ | Water Quality Monitoring",
    description: "ระบบตรวจสอบและบันทึกข้อมูลคุณภาพน้ำทะเลชายฝั่ง ผ่าน LINE LIFF",
    keywords: "คุณภาพน้ำ, water quality, ตรวจสอบน้ำ, LINE LIFF, ประมง",
};

export const viewport: Viewport = {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: "cover",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="th" suppressHydrationWarning={true}>
            <head>
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
              try {
                if (localStorage.getItem('theme') === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `,
                    }}
                />
            </head>
            <body>
                <LiffProvider>
                    <main className="min-h-screen lg:pl-50 pb-[calc(72px+env(safe-area-inset-bottom))] lg:pb-0">{children}</main>
                    <Navbar />
                </LiffProvider>
            </body>
        </html>
    );
}
