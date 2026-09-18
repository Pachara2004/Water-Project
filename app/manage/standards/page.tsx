/**
 * @file app/manage/standards/page.tsx
 * @project Water Monitoring Project
 * @module App / Manage / Standards
 * @description
 * หน้าจัดการเกณฑ์มาตรฐานคุณภาพน้ำ (/manage/standards, admin เท่านั้น) เจ้าของ state ทั้งหมด:
 * โหลดตารางเกณฑ์ปัจจุบัน แก้ค่า maxValue ทีละช่อง บันทึกเป็นเวอร์ชันใหม่พร้อมเหตุผล
 * และดูประวัติเวอร์ชันย้อนหลัง เลือก view ตามจอ
 *
 * Admin standards management: owns the draft/version state and picks the desktop or mobile view.
 *
 * @author Nopparut Udomlert (นพรัตน อุดมเลิศ, Nop856)
 * @created 2026-09-18
 * @version 1.0.0
 *
 * @auth admin เท่านั้น ยิง API ด้วย LIFF access token
 * @client-side
 * @license Private / Proprietary
 */

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import liff from "@line/liff";
import { confirmDialog, alertError } from "@/lib/swal";
import { useToast } from "@/components/useToast";
import { useAppStore } from "@/lib/store";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import type { StandardSnapshotRow } from "@/lib/standards";
import { cellKey, type StandardsLocationType, type StandardsParameter, type StandardCell, type StandardVersionItem, type NewLocationTypeInput } from "@/components/manage/standardsHelpers";
import StandardsMobile from "./standardsMobile";
import StandardsDesktop from "./standardsDesktop";

/** แท็บของหน้า */
export type StandardsTab = "edit" | "history";

/** ผลจาก GET /api/standards */
interface StandardsPayload {
    locationTypes: StandardsLocationType[];
    parameters: StandardsParameter[];
    standards: StandardCell[];
    currentVersion: { id: number; version: number; createdAt: string } | null;
    pendingReviewCount: number;
}

/** เจ้าของ state หน้าจัดการเกณฑ์ เลือก view ตามจอ */
export default function AdminStandardsPage() {
    const { currentUser } = useAppStore();
    const router = useRouter();
    const isMobile = useMediaQuery("(max-width: 767px)");
    const { showToast, toastElement } = useToast();

    const [tab, setTab] = useState<StandardsTab>("edit");
    const [data, setData] = useState<StandardsPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    // ค่าที่แอดมินพิมพ์ในแต่ละช่อง เก็บเป็น string เพื่อให้พิมพ์ทศนิยมค้างได้
    const [draftByKey, setDraftByKey] = useState<Map<string, string>>(new Map());
    const [note, setNote] = useState("");

    const [versions, setVersions] = useState<StandardVersionItem[]>([]);
    const [versionsLoading, setVersionsLoading] = useState(true);
    const snapshotCache = useRef<Map<number, StandardSnapshotRow[]>>(new Map());

    const authHeaders = () => ({ Authorization: `Bearer ${liff.getAccessToken()}` });

    // ไม่ set loading ตอนเริ่ม: โหลดครั้งแรกใช้ค่าเริ่มต้น true อยู่แล้ว ส่วนโหลดซ้ำหลังบันทึกให้ตารางเดิมค้างไว้แทนสปินเนอร์
    const fetchStandards = useCallback(async () => {
        try {
            const res = await fetch("/api/standards", { headers: authHeaders() });
            const json = await res.json();
            if (!res.ok) {
                showToast(json.error || "โหลดเกณฑ์ไม่สำเร็จ", "danger");
                return;
            }
            setData(json);
            setDraftByKey(new Map());
            setNote("");
        } catch (e) {
            console.error(e);
            showToast("โหลดเกณฑ์ไม่สำเร็จ", "danger");
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    const fetchVersions = useCallback(async () => {
        try {
            const res = await fetch("/api/standards/versions", { headers: authHeaders() });
            const json = await res.json();
            if (res.ok && Array.isArray(json)) setVersions(json);
        } catch (e) {
            console.error(e);
        } finally {
            setVersionsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (currentUser?.role === "admin") {
            fetchStandards();
            fetchVersions();
        }
    }, [currentUser?.role, fetchStandards, fetchVersions]);

    const currentByKey = useMemo(() => new Map((data?.standards ?? []).map((s) => [cellKey(s.locationTypeId, s.parameterId), s.maxValue])), [data]);

    /** เฉพาะช่องที่ค่าต่างจากปัจจุบัน (หรือยังไม่มีเกณฑ์) และเป็นตัวเลขที่ใช้ได้ */
    const changes = useMemo(() => {
        const out: StandardCell[] = [];
        for (const [key, raw] of draftByKey) {
            const current = currentByKey.get(key);
            const value = Number(raw);
            if (raw.trim() === "" || !Number.isFinite(value) || value <= 0 || value === current) continue;
            const [locationTypeId, parameterId] = key.split(":").map(Number);
            out.push({ locationTypeId, parameterId, maxValue: value });
        }
        return out;
    }, [draftByKey, currentByKey]);

    /** มีช่องที่พิมพ์ค่าใช้ไม่ได้ (ว่าง / ไม่ใช่ตัวเลข / ≤ 0) ช่องที่ยังไม่มีเกณฑ์ปล่อยว่างได้ */
    const hasInvalid = useMemo(() => {
        for (const [key, raw] of draftByKey) {
            if (!currentByKey.has(key) && raw.trim() === "") continue;
            const value = Number(raw);
            if (raw.trim() === "" || !Number.isFinite(value) || value <= 0) return true;
        }
        return false;
    }, [draftByKey, currentByKey]);

    const setDraft = (key: string, value: string) => {
        setDraftByKey((prev) => {
            const next = new Map(prev);
            next.set(key, value);
            return next;
        });
    };

    const resetDraft = () => {
        setDraftByKey(new Map());
        setNote("");
    };

    const handleSave = async () => {
        if (changes.length === 0 || hasInvalid || saving) return;
        if (!note.trim()) {
            alertError("กรุณาระบุเหตุผล", "ต้องบอกเหตุผลในการแก้เกณฑ์เพื่อบันทึกไว้ในประวัติเวอร์ชัน");
            return;
        }

        const pending = data?.pendingReviewCount ?? 0;
        const confirmed = await confirmDialog({
            title: "ยืนยันบันทึกเกณฑ์ใหม่?",
            text:
                `แก้ไขค่าเกณฑ์ ${changes.length} ช่อง ` +
                (pending > 0 ? ` — คำร้องที่ค้างตรวจ ${pending} รายการจะยังถูกตัดสินด้วยเกณฑ์เดิม` : ""),
            confirmText: "บันทึก",
            tone: "warning",
        });
        if (!confirmed) return;

        setSaving(true);
        try {
            const res = await fetch("/api/standards", {
                method: "PUT",
                headers: { "Content-Type": "application/json", ...authHeaders() },
                body: JSON.stringify({ changes, note: note.trim() }),
            });
            const json = await res.json();
            if (!res.ok) {
                showToast(json.error || "บันทึกไม่สำเร็จ", "danger");
                return;
            }
            if (json.version) {
                showToast(`บันทึกเกณฑ์เวอร์ชัน ${json.version.version} สำเร็จ`, "success");
            } else {
                showToast("ไม่มีค่าที่เปลี่ยน จึงไม่สร้างเวอร์ชันใหม่", "success");
            }
            snapshotCache.current.clear();
            await Promise.all([fetchStandards(), fetchVersions()]);
        } catch (e) {
            console.error(e);
            showToast("บันทึกไม่สำเร็จ", "danger");
        } finally {
            setSaving(false);
        }
    };

    const [typeMutating, setTypeMutating] = useState(false);

    /** เพิ่มประเภทแหล่งน้ำพร้อมเกณฑ์ เกิดเวอร์ชันใหม่ทันที ถ้ามีค่าที่แก้ค้างอยู่จะถามก่อนเพราะโหลดตารางใหม่แล้ว draft หาย */
    const handleAddType = async (input: NewLocationTypeInput): Promise<boolean> => {
        if (typeMutating) return false;
        if (changes.length > 0) {
            const ok = await confirmDialog({ title: "มีค่าที่ยังไม่บันทึก", text: "การเพิ่มประเภทจะโหลดตารางใหม่ ค่าที่แก้ค้างไว้จะหายไป ดำเนินการต่อหรือไม่?", confirmText: "ดำเนินการต่อ", tone: "warning" });
            if (!ok) return false;
        }
        const confirmed = await confirmDialog({
            title: `เพิ่มประเภท "${input.labelTh}"?`,
            text: "จะสร้างประเภทพร้อมค่าเกณฑ์และบันทึกเป็นเวอร์ชันใหม่ทันที",
            confirmText: "เพิ่ม",
            tone: "warning",
        });
        if (!confirmed) return false;
        setTypeMutating(true);
        try {
            const res = await fetch("/api/standards/location-types", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeaders() },
                body: JSON.stringify(input),
            });
            const json = await res.json();
            if (!res.ok) {
                showToast(json.error || "เพิ่มประเภทไม่สำเร็จ", "danger");
                return false;
            }
            showToast(`เพิ่มประเภท ${json.type.labelTh} แล้ว บันทึกเป็นเวอร์ชัน ${json.version.version}`, "success");
            snapshotCache.current.clear();
            await Promise.all([fetchStandards(), fetchVersions()]);
            return true;
        } catch (e) {
            console.error(e);
            showToast("เพิ่มประเภทไม่สำเร็จ", "danger");
            return false;
        } finally {
            setTypeMutating(false);
        }
    };

    /** ลบประเภทแหล่งน้ำพร้อมเกณฑ์ของมัน ระบบจะบันทึกเวอร์ชันใหม่ให้เองถ้ามีเกณฑ์ถูกลบ */
    const handleDeleteType = async (type: StandardsLocationType) => {
        if (typeMutating) return;
        const hasStandards = (data?.standards ?? []).some((s) => s.locationTypeId === type.id);
        const confirmed = await confirmDialog({
            title: `ลบประเภท "${type.labelTh}"?`,
            text:
                (hasStandards ? "เกณฑ์ของประเภทนี้จะถูกลบและบันทึกเป็นเวอร์ชันใหม่ " : "") +
                (changes.length > 0 ? "ค่าที่แก้ค้างไว้จะหายไป " : "") +
                "ประวัติเวอร์ชันเก่ายังแสดงประเภทนี้ได้ตามปกติ",
            confirmText: "ลบ",
            tone: "danger",
        });
        if (!confirmed) return;
        setTypeMutating(true);
        try {
            const res = await fetch(`/api/standards/location-types/${type.id}`, { method: "DELETE", headers: authHeaders() });
            const json = await res.json();
            if (!res.ok) {
                showToast(json.error || "ลบประเภทไม่สำเร็จ", "danger");
                return;
            }
            showToast(json.version ? `ลบประเภท ${type.labelTh} แล้ว บันทึกเป็นเวอร์ชัน ${json.version.version}` : `ลบประเภท ${type.labelTh} แล้ว`, "success");
            snapshotCache.current.clear();
            await Promise.all([fetchStandards(), fetchVersions()]);
        } catch (e) {
            console.error(e);
            showToast("ลบประเภทไม่สำเร็จ", "danger");
        } finally {
            setTypeMutating(false);
        }
    };

    /** snapshot ของเวอร์ชัน cache ไว้ต่อ id เพราะเวอร์ชันไม่เปลี่ยนหลังสร้าง */
    const loadSnapshot = useCallback(async (id: number): Promise<StandardSnapshotRow[] | null> => {
        const cached = snapshotCache.current.get(id);
        if (cached) return cached;
        try {
            const res = await fetch(`/api/standards/versions/${id}`, { headers: authHeaders() });
            const json = await res.json();
            if (!res.ok || !Array.isArray(json.snapshot)) return null;
            snapshotCache.current.set(id, json.snapshot);
            return json.snapshot;
        } catch (e) {
            console.error(e);
            return null;
        }
    }, []);

    const hasAccess = currentUser && currentUser.role === "admin";
    useEffect(() => {
        if (!hasAccess) {
            router.replace("/map");
        }
    }, [hasAccess, router]);

    if (!hasAccess) {
        return null;
    }

    const props = {
        router,
        toastElement,
        tab,
        setTab,
        loading,
        saving,
        locationTypes: data?.locationTypes ?? [],
        parameters: data?.parameters ?? [],
        currentByKey,
        draftByKey,
        setDraft,
        resetDraft,
        changes,
        hasInvalid,
        note,
        setNote,
        currentVersion: data?.currentVersion ?? null,
        pendingReviewCount: data?.pendingReviewCount ?? 0,
        handleSave,
        typeMutating,
        handleAddType,
        handleDeleteType,
        versions,
        versionsLoading,
        loadSnapshot,
    };

    return isMobile ? <StandardsMobile {...props} /> : <StandardsDesktop {...props} />;
}
