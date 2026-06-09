import type { Metadata, Viewport } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';
import RoleToggle from '@/components/RoleToggle';
import LiffProvider from '@/components/LiffProvider';
import ThemeToggle from '@/components/ThemeToggle';

export const metadata: Metadata = {
  title: 'ระบบตรวจสอบคุณภาพน้ำ | Water Quality Monitoring',
  description: 'ระบบตรวจสอบและบันทึกข้อมูลคุณภาพน้ำทะเลชายฝั่ง ผ่าน LINE LIFF',
  keywords: 'คุณภาพน้ำ, water quality, ตรวจสอบน้ำ, LINE LIFF, ประมง',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
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
        <LiffProvider>
          {/* Mobile/tablet: bottom-left corner */}
          <div className="lg:hidden fixed bottom-[calc(96px+env(safe-area-inset-bottom))] left-4 z-[900] flex items-center gap-2 pointer-events-auto">
            <ThemeToggle />
            <RoleToggle />
          </div>
          {/* Desktop: top-right corner */}
          <div className="hidden lg:flex fixed top-4 right-4 z-[900] items-center gap-2 pointer-events-auto">
            <ThemeToggle />
            <RoleToggle />
          </div>
          <main className="min-h-screen min-h-[100dvh] lg:pl-[80px]" style={{ paddingBottom: 'calc(72px + env(safe-area-inset-bottom))' }}>
            {/* On desktop, reset padding bottom via CSS in pages or handle globally */}
            <style>{`
              @media (min-width: 1024px) {
                main { padding-bottom: 0 !important; }
              }
            `}</style>
            {children}
          </main>
          <Navbar />
        </LiffProvider>
      </body>
    </html>
  );
}
