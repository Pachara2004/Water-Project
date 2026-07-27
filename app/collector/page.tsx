"use client";

import { useEffect } from "react";
import { useAppStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useCollectorFilters } from "@/lib/hooks/useCollectorFilters";

import CollectorMobile from "./collectorMobile";
import CollectorDesktop from "./collectorDesktop";

export default function CollectorDashboardPage() {
    const { currentUser } = useAppStore();
    const router = useRouter();
    const isMobile = useMediaQuery("(max-width: 767px)");

    // officer (ผู้บริหาร) ไม่มีสิทธิ์หน้านี้ — ดูภาพรวมได้ที่ /dashboard เท่านั้น
    // ต้องคำนวณตอน render ไม่ใช่ใน useEffect เพราะ effect ทำงานหลัง paint แรก
    // ถ้าเช็คใน effect อย่างเดียว คนไม่มีสิทธิ์จะเห็นเนื้อหาแวบหนึ่งก่อนโดนเด้งออก
    const isAllowed = !currentUser || currentUser.role === "collector" || currentUser.role === "admin";

    useEffect(() => {
        if (!isAllowed) router.push("/map");
    }, [isAllowed, router]);

    // ส่ง currentUser เป็น null เมื่อไม่มีสิทธิ์ เพื่อให้ hook ข้ามการยิง /api/samples ที่ยังไงก็ได้ 403
    const filterState = useCollectorFilters({ currentUser: isAllowed ? currentUser : null });

    if (!isAllowed) return null;

    return isMobile ? <CollectorMobile {...filterState} /> : <CollectorDesktop {...filterState} />;
}
