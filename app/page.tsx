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

/** redirect ไป /map เสมอ พร้อมส่งต่อ query params (เช่น code, state สำหรับ LIFF OAuth) */
export default async function Home({ searchParams }: { searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined> }) {
    const resolvedParams = searchParams ? await searchParams : {};
    const queryString = new URLSearchParams();
    for (const [key, value] of Object.entries(resolvedParams)) {
        if (typeof value === "string") {
            queryString.set(key, value);
        } else if (Array.isArray(value)) {
            value.forEach((v) => queryString.append(key, v));
        }
    }
    const qs = queryString.toString();
    redirect(qs ? `/map?${qs}` : "/map");
}

