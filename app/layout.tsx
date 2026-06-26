import type { Metadata, Viewport } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import LiffProvider from "@/components/LiffProvider";

// สเปก Metadata ยึดอยู่ฝั่ง Server Component ได้อย่างถูกต้อง ไร้ปัญหา Error
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
        <html lang="th" suppressHydrationWarning>
            <head>
                {/* สคริปต์ดักตรวจจับ Theme ดำเนินการผ่าน dangerouslySetInnerHTML ได้ปกติบน Server Component */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
              try {
                if (localStorage.getItem('theme') === 'dark' || (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
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
                {/* LiffProvider และ Navbar ซึ่งเป็น Client Component ด้านในจะสามารถทำงานได้ตามปกติ */}
                <LiffProvider>
                    <main className="min-h-screen min-h-[100dvh] lg:pl-50 pb-[calc(72px+env(safe-area-inset-bottom))] lg:pb-0">{children}</main>
                    <Navbar />
                </LiffProvider>
            </body>
        </html>
    );
}
