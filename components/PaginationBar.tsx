"use client";

import { ArrowLeft, ArrowRight, ArrowRight } from "lucide-react";

/**
 * แถบแบ่งหน้ากลาง ใช้ร่วมกันทุกหน้าที่ดึงข้อมูลแบบแบ่งหน้าจาก API
 *
 * เลขหน้ามาจากฝั่ง server (lib/pagination.ts) ไม่ใช่การตัดอาเรย์ในเบราว์เซอร์
 * ซ่อนตัวเองเมื่อมีหน้าเดียวหรือไม่มีผลลัพธ์เลย
 */
export default function PaginationBar({ page, totalPages, onPageChange }: { page: number; totalPages: number; onPageChange: (p: number) => void }) {
    if (totalPages <= 1) return null;

    return (
        <div className="flex items-center justify-between border-t border-border pt-4 select-none">
            <div className="text-xs text-text-muted font-medium">
                หน้า <span className="font-medium text-text">{page}</span> จาก <span className="font-medium text-text">{totalPages}</span>
            </div>
            <div className="flex items-center gap-2">
                <button
                    disabled={page <= 1}
                    onClick={() => onPageChange(page - 1)}
                    className="inline-flex items-center gap-1.5 p-2 text-xs font-medium rounded-xl border border-border bg-card-general text-text hover:bg-surface-subtle disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                    <ArrowLeft size={15} strokeWidth={2.5} className="text-text shrink-0" />
                    ก่อนหน้า
                </button>
                <button
                    disabled={page >= totalPages}
                    onClick={() => onPageChange(page + 1)}
                    className="inline-flex items-center gap-1.5 p-2 text-xs font-medium rounded-xl border border-border bg-card-general text-text hover:bg-surface-subtle disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                    ถัดไป
                    <ArrowRight size={15} strokeWidth={2.5} className="text-text shrink-0" />
                </button>
            </div>
        </div>
    );
}
