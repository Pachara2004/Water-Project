/**
 * @file LiffBackground.tsx
 * @project Water Monitoring Project
 * @module UI / Layout
 * @description
 * พื้นหลังคลื่นสีฟ้าแบบ SVG เต็มจอ ตรึงอยู่หลังเนื้อหา (z-index ติดลบ) ไม่รับ pointer event
 * ใช้เป็นฉากหลังของหน้า LiffProvider (ขั้นตอนโหลด/ลงทะเบียน) และหน้าข้อตกลง TermsGate
 *
 * Full-screen decorative SVG wave background pinned behind page content.
 * Shared by the LiffProvider loading/onboarding screens and the TermsGate dialog.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-08-27
 * @version 1.0.0
 *
 * @lastModified 2026-08-27 09:00
 * @lastModifiedBy Pachara Paisrisakul
 *
 * @changelog
 * - 2026-08-27 09:00 by Pachara P. - แยกพื้นหลังออกจาก LiffProvider เป็นคอมโพเนนต์เดี่ยว
 *
 * @client-side ไม่มี hook/state จึงใช้ได้ทั้ง Server และ Client Component
 * @license Private / Proprietary
 */

/**
 * ฉากหลังคลื่นสีฟ้าแบบตกแต่ง ไม่รับ props
 *
 * @returns กล่อง `fixed inset-0` ที่บรรจุ SVG คลื่น 4 ชั้น
 */
export default function LiffBackground() {
    return (
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none select-none bg-[#f0f4fc]">
            <svg viewBox="0 0 200 200" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <clipPath id="squareClip">
                        <rect width="200" height="200" />
                    </clipPath>
                </defs>

                <g clipPath="url(#squareClip)">
                    <rect width="200" height="200" fill="#f0f4fc" />
                    <g transform="rotate(-15 100 100)">
                        <path d="M-50,90 C 20,0 120,150 250,70 L250,250 L-50,250 Z" fill="#aecbfa" />
                        <path d="M-50,130 C 20,40 120,190 250,110 L250,250 L-50,250 Z" fill="#669df6" />
                        <path d="M-50,170 C 20,80 120,230 250,150 L250,250 L-50,250 Z" fill="#4285f4" />
                        <path d="M-50,210 C 20,120 120,270 250,190 L250,250 L-50,250 Z" fill="#1a73e8" />
                    </g>
                </g>
            </svg>
        </div>
    );
}
