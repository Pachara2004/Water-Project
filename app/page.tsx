/**
 * @file app/page.tsx
 * @project Water Monitoring Project
 * @module App / Root
 * @description
 * หน้าแรกของแอป redirect ไป /map ทันที เพราะแผนที่คือหน้าหลักของระบบ
 *
 * Root route; immediately redirects to /map, the app's primary screen.
 *
 * @author Pachara Paisrisakul (พชร ไพศรีสกุล, Pachara2004)
 * @created 2026-06-09
 * @version 1.0.0
 *
 * @lastModified 2026-06-26 13:47
 * @lastModifiedBy Pachara Paisrisakul
 *
 * @changelog
 * - 2026-06-09 09:09 by Pachara P. - สร้างพร้อมโครงระบบ
 *
 * @notes Server Component ใช้ redirect() ของ next/navigation
 * @license Private / Proprietary
 */

import { redirect } from "next/navigation";

/** redirect ไป /map เสมอ ไม่ render อะไร */
export default function Home() {
    redirect("/map");
}
