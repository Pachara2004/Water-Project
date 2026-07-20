"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import liff from "@line/liff";
import { useAppStore } from "@/lib/store";
import { confirmDialog } from "@/lib/swal";
import { useToast } from "@/components/useToast";
import { MapPin, MapPinPlus, MapPinned, Building2, Save, ShieldAlert, Plus, Pencil, Trash2, X, Check, Search, FileText, ArrowLeft } from "lucide-react"; /* prettier-ignore */

const MapView = dynamic(() => import("@/components/map/MapView"), {
    ssr: false,
    loading: () => (
        <div className="w-full h-full bg-surface-subtle flex items-center justify-center border border-border rounded-2xl">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
    ),
});

interface LocationItem {
    id: number;
    name: string;
    organization: string;
    lat: number;
    lng: number;
}

export default function AdminLocationsPage() {
    const { currentUser } = useAppStore();
    const router = useRouter();
    const { showToast, toastElement } = useToast();

    // Create form
    const [name, setName] = useState("");
    const [organization, setOrganization] = useState("");
    const [customOrg, setCustomOrg] = useState("");
    const [pickedPosition, setPickedPosition] = useState<{
        lat: number;
        lng: number;
    } | null>(null);
    const [saving, setSaving] = useState(false);

    // Organization combobox
    const [orgSearch, setOrgSearch] = useState("");
    const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);

    // List
    const [locations, setLocations] = useState<LocationItem[]>([]);
    const [stationSearch, setStationSearch] = useState("");

    // Edit modal
    const [editingLoc, setEditingLoc] = useState<LocationItem | null>(null);
    const [editName, setEditName] = useState("");
    const [editOrg, setEditOrg] = useState("");
    const [editSaving, setEditSaving] = useState(false);

    // Delete loading state
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const fetchLocations = useCallback(async (silent = false) => {
        try {
            const res = await fetch("/api/locations");
            const data = await res.json();

            if (Array.isArray(data)) {
                const mapped = data.map((l: any) => ({
                    id: l.id,
                    name: l.name,
                    organization: l.organization,
                    lat: l.lat,
                    lng: l.lng,
                }));
                setLocations(mapped);
            } else {
                setLocations([]);
            }
        } catch (err) {
            console.error("Failed to fetch locations:", err);
        }
    }, []);

    useEffect(() => {
        if (currentUser?.role === "admin") {
            fetchLocations();
        }
    }, [currentUser?.role, fetchLocations]);

    const getOrgValue = () => {
        return organization === "CUSTOM" ? customOrg.trim() : organization;
    };

    const handleSubmit = async () => {
        const orgVal = getOrgValue();
        const stationName = name.trim();
        if (!stationName || !pickedPosition || !orgVal || !currentUser) return;

        const confirmed = await confirmDialog({
            title: "ยืนยันเพิ่มสถานี?",
            text: `เพิ่มสถานี "${stationName}" ลงในระบบ`,
            confirmText: "เพิ่มสถานี",
            tone: "primary",
        });
        if (!confirmed) return;

        setSaving(true);
        try {
            const res = await fetch("/api/locations", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${liff.getAccessToken()}`,
                },
                body: JSON.stringify({
                    name: stationName,
                    organization: orgVal,
                    lat: pickedPosition.lat,
                    lng: pickedPosition.lng,
                }),
            });

            if (res.ok) {
                setName("");
                setPickedPosition(null);
                setOrganization("");
                setCustomOrg("");
                setOrgSearch("");
                fetchLocations(true);
                showToast(`เพิ่มสถานี "${stationName}" เรียบร้อยแล้ว`, "success");
            }
        } catch (err) {
            console.error("Failed to create location:", err);
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = async () => {
        const editedName = editName.trim();
        if (!editingLoc || !editedName || !editOrg.trim() || !currentUser) return;

        const confirmed = await confirmDialog({
            title: "ยืนยันแก้ไขสถานี?",
            text: `บันทึกการแก้ไขข้อมูลสถานี "${editedName}"`,
            confirmText: "บันทึก",
            tone: "warning",
        });
        if (!confirmed) return;

        setEditSaving(true);
        try {
            const res = await fetch("/api/locations", {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${liff.getAccessToken()}`,
                },
                body: JSON.stringify({
                    id: editingLoc.id,
                    name: editedName,
                    organization: editOrg.trim(),
                }),
            });
            if (res.ok) {
                setEditingLoc(null);
                fetchLocations(true);
                showToast(`อัปเดตข้อมูลสถานี "${editedName}" แล้ว`, "success");
            }
        } catch (err) {
            console.error("Failed to update location:", err);
        } finally {
            setEditSaving(false);
        }
    };

    const handleDelete = async (loc: LocationItem) => {
        if (!currentUser) return;

        const confirmed = await confirmDialog({
            title: "ยืนยันลบสถานี?",
            text: `ลบสถานี "${loc.name}" พร้อมผลข้อมูลประวัติทิ้งถาวร — ไม่สามารถย้อนกลับได้`,
            confirmText: "ลบสถานี",
            tone: "danger",
        });
        if (!confirmed) return;

        setDeletingId(loc.id);
        try {
            const res = await fetch(`/api/locations?id=${loc.id}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${liff.getAccessToken()}`,
                },
            });
            if (res.ok) {
                fetchLocations(true);
                showToast(`ลบสถานี "${loc.name}" ออกจากระบบแล้ว`, "danger");
            }
        } catch (err) {
            console.error("Failed to delete location:", err);
        } finally {
            setDeletingId(null);
        }
    };

    const openEdit = (loc: LocationItem) => {
        setEditingLoc(loc);
        setEditName(loc.name);
        setEditOrg(loc.organization);
    };

    if (!currentUser || currentUser.role !== "admin") {
        return (
            <div className="flex flex-col items-center justify-center min-h-dvh px-6 text-center w-full max-w-lg mx-auto bg-surface-muted border-x border-border">
                <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-3xl flex items-center justify-center mb-4 border border-red-500/20">
                    <ShieldAlert size={28} className="animate-pulse" />
                </div>
                <h1 className="font-display text-base font-normal text-text-primary mb-1">สิทธิ์การเข้าถึงถูกจำกัด</h1>
                <p className="text-xs text-text-secondary mb-6 max-w-[80%] mx-auto leading-relaxed">หน้าการกำหนดค่าพิกัดพ้นกรอบการจัดการทั่วไป สำหรับผู้ดูแลระบบสูงสุด (System Admin) เท่านั้น</p>
                <button
                    onClick={() => router.push("/map")}
                    className="w-full max-w-50 py-3.5 bg-primary hover:bg-navy-dark text-white font-semibold rounded-2xl text-xs uppercase tracking-wider shadow-sm transition-colors cursor-pointer"
                >
                    กลับไปหน้าแผนที่
                </button>
            </div>
        );
    }

    const uniqueOrgs = Array.from(new Set(locations.map((l) => l.organization).filter(Boolean)));
    const stationKeyword = stationSearch.trim().toLowerCase();
    const filteredLocations = stationKeyword
        ? locations.filter((loc) => loc.name.toLowerCase().includes(stationKeyword) || loc.organization.toLowerCase().includes(stationKeyword))
        : locations;

    const orgKeyword = orgSearch.trim().toLowerCase();
    const orgOptions = orgKeyword ? uniqueOrgs.filter((org) => org.toLowerCase().includes(orgKeyword)) : uniqueOrgs;

    return (
        <div className="min-h-dvh w-full bg-bg pb-5 antialiased transition-colors duration-300">
            <div className="bg-surface border-b border-border px-4 py-1 flex items-center justify-between sticky top-0 z-10">
                <button onClick={() => router.back()} className="flex items-center gap-1.5 text-xs text-secondary min-h-11">
                    <ArrowLeft size={16} /> <span>ย้อนกลับ</span>
                </button>
                <div className="text-center">
                    <h1 className="text-sm font-semibold text-primary">จัดการจุดตรวจวัดน้ำ</h1>
                </div>
                <div className="w-15" />
            </div>
            {/* คุมขนาด Content Wrapper ให้กางกว้าง max-w-xl เท่าหน้าคอลเลกเตอร์ */}
            <div className="w-full max-w-xl mx-auto px-4 space-y-5 pt-6">
                {/* ─── ส่วนฟอร์มเพิ่มสถานีใหม่ (Add New Form Card) ─── */}
                <div className="relative w-full bg-surface rounded-2xl p-5 border border-border space-y-5">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 bg-primary-light text-primary rounded-full flex items-center justify-center shrink-0 mt-0.5">
                            <MapPinPlus size={18} />
                        </div>
                        <div className="transition-colors duration-300">
                            <h1 className="text-lg font-bold text-text-primary leading-tight">
                                ตั้งค่าจุดตรวจ<span className="text-primary">สถานี</span>
                            </h1>
                            <p className="text-text-secondary text-xs leading-relaxed mt-1">กำหนดตำแหน่งพิกัดจุดเก็บตัวอย่างน้ำเพื่อการวิเคราะห์ทางวิทยาศาสตร์ร่วมกับแผนที่ระบบ</p>
                        </div>
                    </div>
                    <div className="space-y-4">
                        {/* Input ชื่อสถานที่ */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-text-primary block uppercase tracking-wide">ชื่อจุดเก็บตัวอย่าง</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="เช่น หาดจอมเทียน ชลบุรี"
                                className="w-full px-4 py-3 bg-surface-subtle border border-border text-text-primary rounded-xl text-xs placeholder:text-text-muted/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none min-h-11 font-semibold"
                            />
                        </div>

                        {/* Dropdown หน่วยงาน */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-text-primary block uppercase tracking-wide">หน่วยงานที่รับผิดชอบ</label>
                            <div className="relative" onClick={(e) => e.stopPropagation()}>
                                <input
                                    type="text"
                                    value={orgSearch}
                                    onChange={(e) => {
                                        setOrgSearch(e.target.value);
                                        setOrgDropdownOpen(true);
                                    }}
                                    onFocus={() => setOrgDropdownOpen(true)}
                                    placeholder="ค้นหาหรือเลือกหน่วยงาน"
                                    className="w-full pl-4 pr-4 py-3 bg-surface-subtle border border-border text-text-primary rounded-xl text-xs placeholder:text-text-muted/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none min-h-11 font-semibold"
                                />

                                {orgDropdownOpen && (
                                    <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 bg-surface border border-border rounded-xl shadow-xl py-1.5 max-h-52 overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150">
                                        {orgOptions.map((org) => (
                                            <button
                                                key={org}
                                                type="button"
                                                onClick={() => {
                                                    setOrganization(org);
                                                    setOrgSearch(org);
                                                    setCustomOrg("");
                                                    setOrgDropdownOpen(false);
                                                }}
                                                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-text-primary hover:bg-surface-subtle transition-colors text-left cursor-pointer"
                                            >
                                                <Building2 size={13} className="text-text-muted shrink-0" />
                                                {org}
                                            </button>
                                        ))}
                                        {orgOptions.length === 0 && <p className="px-4 py-2 text-xs text-text-muted">ไม่พบหน่วยงานที่ค้นหา</p>}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setOrganization("CUSTOM");
                                                setOrgSearch("");
                                                setOrgDropdownOpen(false);
                                            }}
                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-primary hover:bg-primary-light transition-colors text-left cursor-pointer border-t border-border mt-1"
                                        >
                                            <Plus size={13} className="shrink-0" />
                                            เพิ่มหน่วยงานใหม่...
                                        </button>
                                    </div>
                                )}
                            </div>

                            {organization === "CUSTOM" && (
                                <input
                                    type="text"
                                    value={customOrg}
                                    onChange={(e) => setCustomOrg(e.target.value)}
                                    placeholder="พิมพ์ชื่อหน่วยงานใหม่..."
                                    className="w-full mt-2 px-4 py-3 bg-primary-light border border-primary/10 text-text-primary rounded-xl text-xs placeholder:text-text-muted/30 focus:border-primary transition-all outline-none min-h-11 font-semibold"
                                />
                            )}
                        </div>

                        {/* แผนที่ปักหมุด */}
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-text-primary flex items-center gap-1.5 uppercase tracking-wide">
                                <MapPin size={13} className="text-text-secondary" />
                                ปักหมุดภูมิศาสตร์บนแผนที่
                            </label>
                            <div className="w-full h-52 rounded-xl overflow-hidden border border-border bg-surface-subtle relative z-0">
                                <MapView mode="picker" onLocationPick={(lat, lng) => setPickedPosition({ lat, lng })} pickedPosition={pickedPosition} />
                            </div>

                            {pickedPosition ? (
                                <div className="flex items-center gap-1.5 text-xs font-bold text-text-secondary bg-surface-subtle border border-border py-1.5 px-3 rounded-md w-fit mt-2">
                                    <MapPinned size={12} className="text-text-muted" />
                                    LAT: {pickedPosition.lat.toFixed(6)} , LNG: {pickedPosition.lng.toFixed(6)}
                                </div>
                            ) : (
                                <p className="text-xs text-text-muted italic mt-1.5">*กรุณาแตะเลือกบนแผนที่เพื่อกําหนดพิกัดภูมิศาสตร์</p>
                            )}
                        </div>

                        {/* ปุ่มบันทึกสถานี */}
                        <button
                            onClick={handleSubmit}
                            disabled={!name.trim() || !pickedPosition || !getOrgValue() || saving || (organization === "CUSTOM" && !customOrg.trim())}
                            className="w-full mt-4 py-3 min-h-11 bg-primary hover:bg-primary/95 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer shadow-xs disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed"
                        >
                            {saving ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>กำลังบันทึกข้อมูล...</span>
                                </>
                            ) : (
                                <>
                                    <Save size={14} />
                                    <span>เพิ่มสถานีตรวจวัด</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* ─── ส่วนแสดงรายการประวัติสถานีที่มีอยู่ (Saved Stations Card) ─── */}
                <div className="relative w-full bg-surface rounded-2xl p-4 border border-border space-y-4">
                    <div className="flex items-center justify-between pt-1 px-1">
                        <div className="inline-flex items-center gap-1.5">
                            <FileText size={18} className="text-primary" />
                            <h2 className="text-sm text-primary font-bold tracking-wider uppercase">สถานีตรวจวัดในระบบ</h2>
                        </div>
                        <span className="text-xs font-bold text-primary  px-2.5 py-1">{locations.length} สถานี</span>
                    </div>

                    {/* ช่องค้นหาสถานีสไตล์เดียวกับหน้ารายการน้ำ */}
                    <div className="relative w-full flex items-center bg-surface-subtle border border-border rounded-xl px-4 transition-all">
                        <input
                            type="text"
                            value={stationSearch}
                            onChange={(e) => setStationSearch(e.target.value)}
                            placeholder="ค้นหาสถานีหรือหน่วยงาน..."
                            className="w-full py-3 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-muted font-semibold"
                        />
                        <Search size={16} className="text-text-muted ml-2" />
                    </div>

                    {/* รายชื่อสถานีแมตช์สไตล์แบบการ์ดประมวลผล */}
                    <div className="flex flex-col gap-3 pt-2">
                        {filteredLocations.map((loc) => (
                            <div
                                key={loc.id}
                                className="bg-surface rounded-2xl p-3.5 border border-border flex items-center justify-between gap-4 transition-all hover:scale-[1.005] duration-150 min-w-0"
                            >
                                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                                    <div className="flex-1 min-w-0 text-left">
                                        <div className="gap-2 flex">
                                            <MapPin size={16} />
                                            <h4 className="font-bold text-sm text-text-primary truncate">{loc.name}</h4>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-text-secondary font-medium">
                                            <div className="flex items-center gap-2 min-w-0 max-w-35 sm:max-w-none">
                                                <Building2 size={16} className="text-secondary shrink-0" />
                                                <span className="truncate font-semibold text-secondary">{loc.organization}</span>
                                            </div>
                                            <span className="text-text-muted/30 hidden sm:inline">•</span>
                                            <span className="text-text-muted text-xs bg-surface-subtle px-1.5 py-0.5 rounded-md border border-border font-mono font-semibold">
                                                {loc.lat.toFixed(4)} , {loc.lng.toFixed(4)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* กลุ่มปุ่มจัดการด้านขวามือสไตล์ Rounded-xl กระชับ */}
                                <div className="flex gap-2 shrink-0">
                                    <button
                                        onClick={() => openEdit(loc)}
                                        className="w-9 h-9 bg-surface-subtle hover:bg-primary-light border border-border hover:border-primary/20 rounded-xl flex items-center justify-center transition-all cursor-pointer group active:scale-[0.95]"
                                    >
                                        <Pencil size={16} className="text-text-muted group-hover:text-primary" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(loc)}
                                        disabled={deletingId === loc.id}
                                        className="w-9 h-9 bg-surface-subtle hover:bg-red-500/10 border border-border hover:border-red-500/30 rounded-xl flex items-center justify-center transition-all cursor-pointer group active:scale-[0.95] disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {deletingId === loc.id ? (
                                            <div className="w-3.5 h-3.5 border-2 border-red-500 border-t-transparent rounded-xl animate-spin" />
                                        ) : (
                                            <Trash2 size={16} className="text-text-muted group-hover:text-red-500" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ─── EDIT PROFILE DRAWER (MODAL) ─── */}
            {editingLoc && (
                <>
                    <div className="fixed inset-0 bg-black/40 z-1000 backdrop-blur-xs transition-opacity" onClick={() => setEditingLoc(null)} />
                    <div
                        className="fixed bottom-0 left-0 right-0 z-1001 bg-surface rounded-t-4xl border-t border-border max-w-lg mx-auto px-6 pt-6 space-y-6 animate-slide-up transition-colors duration-300"
                        style={{
                            paddingBottom: "calc(88px + env(safe-area-inset-bottom))",
                        }}
                    >
                        <div className="w-10 h-1 bg-border rounded-full mx-auto mb-5 pointer-events-none" />

                        <div className="flex items-center justify-between mb-7">
                            <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">แก้ไขข้อมูลสถานีตรวจ</h3>
                            <button
                                onClick={() => setEditingLoc(null)}
                                className="w-8 h-8 bg-surface-subtle border border-border rounded-full flex items-center justify-center hover:bg-surface-muted transition-colors active:scale-[0.92] cursor-pointer"
                            >
                                <X size={14} className="text-text-secondary" />
                            </button>
                        </div>

                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-text-primary uppercase tracking-wide block">ชื่อสถานีตรวจ</label>
                                <input
                                    type="text"
                                    value={editName}
                                    onChange={(e) => setEditName(e.target.value)}
                                    className="w-full px-4 py-3 bg-surface-subtle border border-border text-text-primary rounded-xl text-xs focus:border-primary outline-none min-h-11 font-semibold"
                                />
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-bold text-text-primary uppercase tracking-wide block">หน่วยงานหลัก</label>
                                <div className="relative">
                                    <select
                                        value={uniqueOrgs.includes(editOrg) ? editOrg : "CUSTOM"}
                                        onChange={(e) => {
                                            if (e.target.value !== "CUSTOM") {
                                                setEditOrg(e.target.value);
                                            } else {
                                                setEditOrg("");
                                            }
                                        }}
                                        className="w-full px-4 py-3 bg-surface-subtle border border-border text-text-primary rounded-xl text-xs focus:border-primary outline-none min-h-11 appearance-none cursor-pointer font-semibold"
                                    >
                                        {uniqueOrgs.map((org) => (
                                            <option key={org} value={org}>
                                                {org}
                                            </option>
                                        ))}
                                        <option value="CUSTOM">+ เพิ่มหน่วยงานใหม่...</option>
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted text-xs">▼</div>
                                </div>

                                {!uniqueOrgs.includes(editOrg) && (
                                    <input
                                        type="text"
                                        value={editOrg}
                                        onChange={(e) => setEditOrg(e.target.value)}
                                        placeholder="พิมพ์ชื่อหน่วยงานใหม่..."
                                        className="w-full mt-2 px-4 py-3 bg-primary-light border border-primary/10 text-text-primary rounded-xl text-xs placeholder:text-text-muted/30 focus:border-primary transition-all outline-none min-h-11 font-semibold animate-fade-in"
                                    />
                                )}
                            </div>

                            <button
                                onClick={handleEdit}
                                disabled={editSaving || !editName.trim() || !editOrg.trim()}
                                className="w-full mt-2 py-4 min-h-13 bg-primary hover:bg-navy-dark text-white font-semibold rounded-2xl text-xs uppercase tracking-wider transition-all duration-300 disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-2.5 shadow-sm cursor-pointer active:scale-[0.98]"
                            >
                                {editSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check size={14} />}
                                <span>บันทึกข้อมูลการแก้ไข</span>
                            </button>
                        </div>
                    </div>
                </>
            )}

            {toastElement}
        </div>
    );
}
