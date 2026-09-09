"use client";

import { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

/**
 * แถบแบ่งหน้ากลาง ใช้ร่วมกันทุกหน้าที่ดึงข้อมูลแบบแบ่งหน้าจาก API
 *
 * เลขหน้ามาจากฝั่ง server (lib/pagination.ts) ไม่ใช่การตัดอาเรย์ในเบราว์เซอร์
 *
 * การซ่อนมีสองระดับ ห้ามยุบเป็นเงื่อนไขเดียว:
 * - totalPages === 0 (ไม่พบผลลัพธ์เลย) ซ่อนทั้งแถบ
 * - totalPages === 1 ซ่อนเฉพาะแถวเลขหน้า แต่ยังต้องโชว์ดรอปดาวน์ "แถวต่อหน้า" ไว้
 *   ไม่งั้นผู้ใช้ที่เลือก 30 แถวจนเหลือหน้าเดียวจะไม่มีทางเปลี่ยนกลับเป็น 10 ได้อีก
 */

/** ตัวเลือกจำนวนแถวต่อหน้า — ทุกค่าต้องไม่เกิน MAX_PAGE_SIZE ใน lib/pagination.ts */
const DEFAULT_PAGE_SIZE_OPTIONS = [10, 15, 20, 30];

interface PaginationBarProps {
    page: number;
    totalPages: number;
    onPageChange: (p: number) => void;
    /** ส่งคู่กับ onPageSizeChange เท่านั้น — ขาดตัวใดตัวหนึ่งดรอปดาวน์จะไม่ถูก render */
    pageSize?: number;
    onPageSizeChange?: (size: number) => void;
    pageSizeOptions?: number[];
}

function range(start: number, end: number): number[] {
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

/**
 * สร้างรายการปุ่มเลขหน้า โดยคงหน้าแรกกับหน้าสุดท้ายไว้เสมอและแทนช่วงที่ข้ามด้วย "…"
 *
 * siblings = จำนวนหน้าที่ขนาบข้างหน้าปัจจุบัน (จอกว้างใช้ 1 จอแคบใช้ 0)
 * เมื่อหน้าปัจจุบันอยู่ชิดต้นหรือชิดท้าย ฝั่งนั้นจะไม่มี "…" และยืดจำนวนเลขออกไปแทน
 * เพื่อให้จำนวนช่องคงที่ ไม่กระตุกตอนกดเปลี่ยนหน้า
 */
function buildPageItems(page: number, totalPages: number, siblings: number): (number | "ellipsis")[] {
    // first + last + current + siblings สองข้าง + "…" สองอัน
    const maxSlots = siblings * 2 + 5;
    if (totalPages <= maxSlots) return range(1, totalPages);

    const left = Math.max(page - siblings, 1);
    const right = Math.min(page + siblings, totalPages);

    // ชิดขอบพอดี (เหลือช่องว่างแค่หน้าเดียว) ไม่ต้องใส่ "…" เพราะกินที่เท่ากับเลขจริง
    const showLeftEllipsis = left > 2;
    const showRightEllipsis = right < totalPages - 1;

    if (!showLeftEllipsis && showRightEllipsis) {
        return [...range(1, siblings * 2 + 3), "ellipsis", totalPages];
    }
    if (showLeftEllipsis && !showRightEllipsis) {
        return [1, "ellipsis", ...range(totalPages - (siblings * 2 + 2), totalPages)];
    }
    return [1, "ellipsis", ...range(left, right), "ellipsis", totalPages];
}

/**
 * สไตล์ปุ่มทุกตัวในแถบ — ตั้งใจไม่ใส่ display utility (inline-flex/flex/hidden) ไว้ในนี้
 *
 * ถ้าใส่ไว้ ปุ่มที่ต้องซ่อนบนจอแคบจะกลายเป็น `hidden sm:inline-flex` + `inline-flex` บน element เดียวกัน
 * = display ระดับฐานสองตัวชนกัน ซึ่ง Tailwind ตัดสินด้วยลำดับใน CSS ที่ generate ออกมา
 * ไม่ใช่ลำดับที่เขียนใน className → `inline-flex` ชนะ `hidden` และปุ่มโผล่บนมือถือจนแถบล้นจอ
 * ผู้เรียกจึงต้องเติม display เองทุกจุด (ดูการใช้งานด้านล่าง)
 */
const boxClass =
    "items-center justify-center h-10 min-w-10 sm:h-9 sm:min-w-9 px-1.5 shrink-0 rounded-xl border border-border bg-card-general text-text text-xs font-medium transition-all hover:bg-surface-subtle disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-card-general active:scale-95 cursor-pointer";

/** แถวปุ่มเลขหน้าหนึ่งชุด — render สองชุดแล้วสลับด้วย CSS แทน useMediaQuery เพื่อไม่ให้กระพริบตอน hydrate */
function PageNumbers({
    page,
    totalPages,
    siblings,
    onPageChange,
    className,
}: {
    page: number;
    totalPages: number;
    siblings: number;
    onPageChange: (p: number) => void;
    className: string;
}) {
    return (
        <div className={className}>
            {buildPageItems(page, totalPages, siblings).map((item, i) =>
                item === "ellipsis" ? (
                    <span key={`gap-${i}`} className="inline-flex items-center justify-center h-10 w-8 sm:h-9 text-xs text-text-muted select-none">
                        …
                    </span>
                ) : (
                    <button
                        key={item}
                        onClick={() => onPageChange(item)}
                        aria-label={`ไปหน้า ${item}`}
                        aria-current={item === page ? "page" : undefined}
                        className={item === page ? `inline-flex ${boxClass} bg-primary border-primary text-white font-bold hover:bg-primary` : `inline-flex ${boxClass}`}
                    >
                        {item}
                    </button>
                ),
            )}
        </div>
    );
}

export default function PaginationBar({ page, totalPages, onPageChange, pageSize, onPageSizeChange, pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS }: PaginationBarProps) {
    // ช่องกรอกเลขหน้าถือค่าดิบระหว่างพิมพ์ (ให้ลบจนว่างได้) แล้วค่อย commit ตอน Enter หรือ blur
    const [pageDraft, setPageDraft] = useState(String(page));

    /* ซิงก์ช่องกรอกเมื่อหน้าถูกเปลี่ยนจากทางอื่น (กดปุ่มเลขหน้า หรือตัวกรองดีดกลับหน้า 1)
       ปรับ state ระหว่าง render ตามแนวทางของ React ไม่ใช่ useEffect — ค่าใหม่ทันใน render รอบเดียวกัน
       จึงไม่มีจังหวะที่ช่องกรอกโชว์เลขหน้าเก่าค้างให้เห็น (react.dev/learn/you-might-not-need-an-effect) */
    const [syncedPage, setSyncedPage] = useState(page);
    if (syncedPage !== page) {
        setSyncedPage(page);
        setPageDraft(String(page));
    }

    if (totalPages === 0) return null;

    const showPageNumbers = totalPages > 1;
    const showPageSize = pageSize !== undefined && onPageSizeChange !== undefined;

    // เลขนอกช่วงหรือกรอกมั่ว = ดีดกลับค่าปัจจุบัน ไม่ยิง API ด้วยหน้าที่ไม่มีจริง
    const commitPageDraft = () => {
        const parsed = Number(pageDraft);
        if (!Number.isFinite(parsed) || parsed < 1 || parsed > totalPages) {
            setPageDraft(String(page));
            return;
        }
        const next = Math.floor(parsed);
        if (next !== page) onPageChange(next);
        else setPageDraft(String(page));
    };

    return (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border pt-4 mt-2 select-none">
            {/* จอแคบ: ห่อโซนซ้าย+ขวาไว้บรรทัดเดียวกันใต้แถวเลข — sm:contents คลายกล่องทิ้งให้ลูกกลับไปเรียงในแถวหลัก */}
            <div className="order-2 flex items-center justify-between gap-3 sm:contents">
                <div className="flex items-center gap-2 text-xs text-text-muted font-medium sm:order-1">
                    <span>หน้า</span>
                    <input
                        type="text"
                        inputMode="numeric"
                        value={pageDraft}
                        onChange={(e) => setPageDraft(e.target.value)}
                        onBlur={commitPageDraft}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") setPageDraft(String(page));
                        }}
                        aria-label="กระโดดไปหน้าที่ระบุ"
                        className="h-10 sm:h-9 w-14 text-center rounded-xl border border-border bg-card-general text-text text-xs font-semibold outline-none focus:border-primary transition-colors"
                    />
                    <span>
                        จาก <span className="font-bold text-text">{totalPages}</span>
                    </span>
                </div>

                {showPageSize && (
                    <label className="flex items-center gap-2 text-xs text-text-muted font-medium sm:order-3">
                        <span className="whitespace-nowrap">แถวต่อหน้า</span>
                        <span className="relative">
                            <select
                                value={pageSize}
                                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                                className="h-10 sm:h-9 pl-3 pr-8 rounded-xl border border-border bg-card-general text-text text-xs font-semibold outline-none focus:border-primary appearance-none cursor-pointer transition-colors"
                            >
                                {pageSizeOptions.map((size) => (
                                    <option key={size} value={size}>
                                        {size}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={14} strokeWidth={2.5} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                        </span>
                    </label>
                )}
            </div>

            {showPageNumbers && (
                <div className="order-1 flex items-center justify-center gap-1 sm:gap-1.5 sm:order-2">
                    {/* หน้าแรก/หน้าสุดท้ายซ่อนบนจอแคบ — ปุ่มเยอะเกินและทับหน้าที่ของเลข 1 กับเลขหน้าสุดท้ายอยู่แล้ว */}
                    <button disabled={page <= 1} onClick={() => onPageChange(1)} aria-label="ไปหน้าแรก" className={`hidden sm:inline-flex ${boxClass}`}>
                        <ChevronsLeft size={15} strokeWidth={2.5} />
                    </button>
                    <button disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="หน้าก่อนหน้า" className={`inline-flex ${boxClass}`}>
                        <ChevronLeft size={15} strokeWidth={2.5} />
                    </button>

                    <PageNumbers page={page} totalPages={totalPages} siblings={1} onPageChange={onPageChange} className="hidden sm:flex items-center gap-1.5" />
                    <PageNumbers page={page} totalPages={totalPages} siblings={0} onPageChange={onPageChange} className="flex sm:hidden items-center gap-1" />

                    <button disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="หน้าถัดไป" className={`inline-flex ${boxClass}`}>
                        <ChevronRight size={15} strokeWidth={2.5} />
                    </button>
                    <button disabled={page >= totalPages} onClick={() => onPageChange(totalPages)} aria-label="ไปหน้าสุดท้าย" className={`hidden sm:inline-flex ${boxClass}`}>
                        <ChevronsRight size={15} strokeWidth={2.5} />
                    </button>
                </div>
            )}
        </div>
    );
}
