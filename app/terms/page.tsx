"use client";

import { useRouter } from "next/navigation";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import TermsMobile from "./termsMobile";
import TermsDesktop from "./termsDesktop";

// หน้าข้อตกลงการใช้งานและนโยบายความเป็นส่วนตัว — อยู่นอก /manage เพื่อให้เปิดอ่านได้โดยไม่ต้องล็อกอิน
// (LINE User Data Policy กำหนดให้ผู้ใช้เข้าถึงนโยบายได้ตลอดเวลา ไม่ใช่เฉพาะตอนสมัคร)
export default function TermsPage() {
    const router = useRouter();
    const isMobile = useMediaQuery("(max-width: 767px)");

    // เปิดจาก URL ตรงหรือลิงก์ภายนอกจะไม่มีประวัติให้ย้อน → กลับหน้าแรกแทน
    const handleBack = () => {
        if (window.history.length > 1) router.back();
        else router.push("/");
    };

    return isMobile ? <TermsMobile onBack={handleBack} /> : <TermsDesktop onBack={handleBack} />;
}
