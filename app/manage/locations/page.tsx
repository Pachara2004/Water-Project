"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import liff from "@line/liff";
import { useAppStore } from "@/lib/store";
import { getOrganizationLabel } from "@/lib/standards";
import { MapPin, MapPinPlus, MapPinned, Building2, Save, ShieldAlert, Plus, Pencil, Trash2, X, Check, ArrowLeft, RefreshCw, Search } from "lucide-react";

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

    // Create form
    const [name, setName] = useState("");
    const [organization, setOrganization] = useState("");
    const [customOrg, setCustomOrg] = useState("");
    const [pickedPosition, setPickedPosition] = useState<{
        lat: number;
        lng: number;
    } | null>(null);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    // Organization combobox (ค้นหา/กรอง dropdown หน่วยงานที่มีอยู่)
    const [orgSearch, setOrgSearch] = useState("");
    const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);

    // List
    const [locations, setLocations] = useState<LocationItem[]>([]);
    const [stationSearch, setStationSearch] = useState("");
    const [isLoading, setIsLoading] = useState(true);

    // Edit modal
    const [editingLoc, setEditingLoc] = useState<LocationItem | null>(null);
    const [editName, setEditName] = useState("");
    const [editOrg, setEditOrg] = useState("");
    const [editSaving, setEditSaving] = useState(false);

    // Delete confirmation
    const [deletingId, setDeletingId] = useState<number | null>(null); // 🔢 ปรับประเภทเป็น number
    const [deleting, setDeleting] = useState(false);

    const fetchLocations = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch("/api/locations");
            const data = await res.json();

            // โหลดแมปตัวแปรจาก Expressive Snake Case หลังบ้านเข้าหาโครงสร้างฝั่ง UI คอร์หลัก
            if (Array.isArray(data)) {
                const mapped = data.map((l: any) => ({
                    id: l.id,
                    name: l.name, // จากคีย์แมปฝั่ง API หลังบ้านที่แปลงเป็น name แล้ว
                    organization: l.organization, // จากคีย์แมปฝั่ง API หลังบ้านที่แปลงเป็น organization แล้ว
                    lat: l.lat,
                    lng: l.lng,
                }));
                setLocations(mapped);
            } else {
                setLocations([]);
            }
        } catch (err) {
            console.error("Failed to fetch locations:", err);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        // ตรวจเช็กสิทธิ์ Gate ระบบความปลอดภัยพิมพ์เล็กของบอส
        if (currentUser?.role === "admin") {
            const timer = setTimeout(() => {
                fetchLocations();
            }, 0);
            return () => clearTimeout(timer);
        }
    }, [currentUser?.role, fetchLocations]);

    const getOrgValue = () => {
        return organization === "CUSTOM" ? customOrg.trim() : organization;
    };

    const handleSubmit = async () => {
        const orgVal = getOrgValue();
        if (!name.trim() || !pickedPosition || !orgVal || !currentUser) return;

        setSaving(true);
        setSuccess(false);

        try {
            const res = await fetch("/api/locations", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${liff.getAccessToken()}`,
                },
                body: JSON.stringify({
                    name: name.trim(),
                    organization: orgVal,
                    lat: pickedPosition.lat,
                    lng: pickedPosition.lng,
                }),
            });

            if (res.ok) {
                setSuccess(true);
                setName("");
                setPickedPosition(null);
                setOrganization("");
                setCustomOrg("");
                setOrgSearch("");
                fetchLocations();
                setTimeout(() => setSuccess(false), 3000);
            }
        } catch (err) {
            console.error("Failed to create location:", err);
        } finally {
            setSaving(false);
        }
    };

    const handleEdit = async () => {
        if (!editingLoc || !editName.trim() || !editOrg.trim() || !currentUser) return;
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
                    name: editName.trim(),
                    organization: editOrg.trim(),
                }),
            });
            if (res.ok) {
                setEditingLoc(null);
                fetchLocations();
            }
        } catch (err) {
            console.error("Failed to update location:", err);
        } finally {
            setEditSaving(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!currentUser) return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/locations?id=${id}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${liff.getAccessToken()}`,
                },
            });
            if (res.ok) {
                setDeletingId(null);
                fetchLocations();
            }
        } catch (err) {
            console.error("Failed to delete location:", err);
        } finally {
            setDeleting(false);
        }
    };

    const openEdit = (loc: LocationItem) => {
        setEditingLoc(loc);
        setEditName(loc.name);
        setEditOrg(loc.organization);
    };

    // Role Security Gate (เปรียบเทียบสิทธิ์ตัวพิมพ์เล็ก)
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
                    className="w-full max-w-[200px] py-3.5 bg-primary hover:bg-navy-dark text-white font-semibold rounded-2xl text-xs uppercase tracking-wider shadow-sm transition-colors cursor-pointer"
                >
                    กลับไปหน้าแผนที่
                </button>
            </div>
        );
    }

    const uniqueOrgs = Array.from(new Set(locations.map((l) => l.organization).filter(Boolean)));

    const stationKeyword = stationSearch.trim().toLowerCase();
    const filteredLocations = stationKeyword
        ? locations.filter((loc) => loc.name.toLowerCase().includes(stationKeyword) || getOrganizationLabel(loc.organization).toLowerCase().includes(stationKeyword))
        : locations;

    const orgKeyword = orgSearch.trim().toLowerCase();
    const orgOptions = orgKeyword ? uniqueOrgs.filter((org) => getOrganizationLabel(org).toLowerCase().includes(orgKeyword)) : uniqueOrgs;

    return (
        <div className="min-h-dvh w-full bg-surface-muted pb-[120px] relative transition-colors duration-300 overflow-hidden" onClick={() => orgDropdownOpen && setOrgDropdownOpen(false)}>
            <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12 pt-10 sm:pt-16">
                <button onClick={() => router.push("/manage")} className="flex items-center gap-2 text-xs font-semibold text-text-muted hover:text-primary transition-colors mb-5 group cursor-pointer">
                    <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform duration-200" />
                    Admin Panel
                </button>

                {/* Header card */}
                <div className="bg-surface rounded-3xl border border-border shadow-sm p-6 sm:p-8 mb-6 sm:mb-10 transition-colors duration-300">
                    <h1 className="font-display text-lg font-bold text-text-primary leading-tight">
                        ตั้งค่าจุดตรวจ <span className="font-display text-primary">สถานีชายฝั่ง</span>
                    </h1>
                    <p className="text-text-secondary text-xs mt-2 leading-relaxed">กำหนดตำแหน่งพิกัดจุดเก็บตัวอย่างน้ำเพื่อการวิเคราะห์ทางวิทยาศาสตร์ร่วมกับแผนที่ระบบ</p>
                </div>

                <div className="space-y-6 sm:space-y-10">
                    {/* ══════════ SECTION 1: ADD NEW ══════════ */}
                    <section className="bg-surface rounded-3xl p-5 sm:p-8 border border-border shadow-md space-y-6 sm:space-y-8 transition-all duration-300 relative overflow-hidden">
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-primary-light text-primary rounded-full flex items-center justify-center flex-shrink-0">
                                <MapPinPlus size={16} />
                            </div>
                            <h2 className="text-sm font-bold text-text-primary">Add checkpoint stations</h2>
                        </div>

                        <div className="space-y-5">
                            {/* Name */}
                            <div className="space-y-2.5">
                                <label className="text-sm font-bold text-text-primary block">ชื่อจุดเก็บตัวอย่าง</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="เช่น หาดจอมเทียน ชลบุรี ป้อมที่ 1"
                                    className="w-full px-5 py-3.5 bg-surface-subtle border border-border text-text-primary rounded-2xl text-xs placeholder:text-text-muted/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none min-h-[48px]"
                                />
                            </div>

                            {/* Organization — ค้นหา/กรอง dropdown หน่วยงานที่มีอยู่ */}
                            <div className="space-y-2.5">
                                <label className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                                    <Building2 size={14} className="text-text-secondary" />
                                    หน่วยงานที่รับผิดชอบ
                                </label>
                                <div className="relative" onClick={(e) => e.stopPropagation()}>
                                    <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                                    <input
                                        type="text"
                                        value={orgSearch}
                                        onChange={(e) => {
                                            setOrgSearch(e.target.value);
                                            setOrgDropdownOpen(true);
                                        }}
                                        onFocus={() => setOrgDropdownOpen(true)}
                                        placeholder="ค้นหาหน่วยงาน"
                                        className="w-full pl-10 pr-4 py-3.5 bg-surface-subtle border border-border text-text-primary rounded-2xl text-xs placeholder:text-text-muted/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none min-h-[48px]"
                                    />

                                    {orgDropdownOpen && (
                                        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 bg-surface border border-border rounded-2xl shadow-xl py-2 max-h-56 overflow-y-auto animate-fade-in">
                                            {orgOptions.map((org) => (
                                                <button
                                                    key={org}
                                                    type="button"
                                                    onClick={() => {
                                                        setOrganization(org);
                                                        setOrgSearch(getOrganizationLabel(org));
                                                        setCustomOrg("");
                                                        setOrgDropdownOpen(false);
                                                    }}
                                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-text-primary hover:bg-surface-subtle transition-colors text-left cursor-pointer"
                                                >
                                                    <Building2 size={12} className="text-text-muted flex-shrink-0" />
                                                    {getOrganizationLabel(org)}
                                                </button>
                                            ))}
                                            {orgOptions.length === 0 && <p className="px-4 py-2.5 text-xs text-text-muted">ไม่พบหน่วยงานที่ค้นหา</p>}
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setOrganization("CUSTOM");
                                                    setOrgSearch("");
                                                    setOrgDropdownOpen(false);
                                                }}
                                                className="w-full flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-primary hover:bg-primary-light transition-colors text-left cursor-pointer border-t border-border mt-1 pt-2.5"
                                            >
                                                <Plus size={12} className="flex-shrink-0" />
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
                                        className="w-full mt-2 px-5 py-3.5 bg-primary-light border border-primary/10 text-text-primary rounded-2xl text-xs placeholder:text-text-muted/30 focus:border-primary transition-all outline-none min-h-[48px]"
                                    />
                                )}
                            </div>

                            {/* Mini Map */}
                            <div className="space-y-2.5">
                                <label className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                                    <MapPin size={14} className="text-text-secondary" />
                                    ปักหมุดบนแผนที่
                                </label>
                                {/* z-0 สร้าง stacking context ครอบ z-index ภายในของ Leaflet (400-1000) ไม่ให้ทับ dropdown ด้านบน */}
                                <div className="w-full h-52 rounded-2xl overflow-hidden border border-border bg-surface-subtle relative z-0">
                                    <MapView mode="picker" onLocationPick={(lat, lng) => setPickedPosition({ lat, lng })} pickedPosition={pickedPosition} />
                                </div>

                                {pickedPosition ? (
                                    <div className="flex items-center gap-1.5 text-xs font-semibold text-text-secondary bg-surface-subtle border border-border py-2 px-4 rounded-full w-fit mt-2.5">
                                        <MapPinned size={12} className="text-text-muted" />
                                        LAT: {pickedPosition.lat.toFixed(6)} , LNG: {pickedPosition.lng.toFixed(6)}
                                    </div>
                                ) : (
                                    <p className="text-xs text-text-muted italic mt-1.5">*กรุณาแตะเลือกบนแผนที่เพื่อกําหนดพิกัดทางภูมิศาสตร์</p>
                                )}
                            </div>

                            {success && (
                                <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-emerald-600 dark:text-emerald-400 font-semibold text-center flex items-center justify-center gap-1.5 animate-fade-in">
                                    <Check size={14} className="text-emerald-500" />
                                    บันทึกตำแหน่งสถานีตรวจวัดเรียบร้อยแล้ว
                                </div>
                            )}

                            {/* Submit Button */}
                            <button
                                onClick={handleSubmit}
                                disabled={!name.trim() || !pickedPosition || !getOrgValue() || saving || (organization === "CUSTOM" && !customOrg.trim())}
                                className="w-full mt-6 py-4 min-h-[56px] bg-primary hover:bg-navy-dark text-white font-semibold rounded-2xl text-xs uppercase tracking-wider transition-all duration-300 disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-2.5 shadow-sm cursor-pointer"
                            >
                                {saving ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                        กำลังบันทึกสถานีใหม่...
                                    </>
                                ) : (
                                    <>
                                        <Save size={14} />
                                        เพิ่มสถานีตรวจวัด
                                    </>
                                )}
                            </button>
                        </div>
                    </section>

                    {/* ══════════ SECTION 2: EXISTING ══════════ */}
                    <section className="space-y-7">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3.5">
                                <div className="w-8 h-8 bg-foreground text-background rounded-xl flex items-center justify-center">
                                    <MapPin size={15} />
                                </div>
                                <h2 className="text-xs font-semibold text-text-primary uppercase tracking-wider ">Saved stations</h2>
                            </div>
                            <span className="text-[9px] font-semibold text-primary bg-primary-light border border-primary/10 px-2.5 py-1 rounded-full uppercase tracking-wider ">
                                {locations.length} Stations
                            </span>
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                            <input
                                type="text"
                                value={stationSearch}
                                onChange={(e) => setStationSearch(e.target.value)}
                                placeholder="ค้นหาสถานีหรือหน่วยงานที่รับผิดชอบ"
                                className="w-full pl-10 pr-4 py-3.5 min-h-[48px] bg-surface border border-border text-text-primary rounded-2xl text-xs placeholder:text-text-muted/50 outline-none cursor-text focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                            />
                        </div>

                        {/* Location List */}
                        <div className="space-y-5">
                            {isLoading ? (
                                <div className="bg-surface rounded-3xl p-10 text-center border border-border flex flex-col items-center justify-center gap-3">
                                    <RefreshCw size={22} className="animate-spin text-primary" />
                                    <span className="text-xs text-text-muted font-semibold">กำลังดาวน์โหลดข้อมูลสถานี...</span>
                                </div>
                            ) : filteredLocations.length === 0 ? (
                                <div className="bg-surface rounded-3xl p-10 text-center border border-border shadow-sm">
                                    <div className="w-14 h-14 bg-surface-subtle border border-border rounded-2xl flex items-center justify-center mx-auto mb-4">
                                        <MapPin size={20} className="text-text-muted" />
                                    </div>
                                    <p className="text-xs font-semibold text-text-muted">ไม่พบสถานีตรวจวัดตามตัวกรองนี้</p>
                                </div>
                            ) : (
                                filteredLocations.map((loc) => (
                                    <div key={loc.id} className="bg-surface rounded-2xl border border-border shadow-md overflow-hidden transition-all hover:scale-[1.01] duration-200">
                                        {deletingId === loc.id ? (
                                            <div className="p-6 bg-red-500/5 border-b border-red-500/10 space-y-5">
                                                <p className="text-xs font-semibold text-danger">
                                                    ลบสถานี &quot;{loc.name}
                                                    &quot; พร้อมผลข้อมูลประวัติทิ้งถาวร?
                                                </p>
                                                <div className="flex gap-3">
                                                    <button
                                                        onClick={() => handleDelete(loc.id)}
                                                        disabled={deleting}
                                                        className="flex-1 py-2 min-h-[48px] bg-danger text-white rounded-xl text-xs font-semibold active:scale-[0.96] transition-all disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                                                    >
                                                        {deleting ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Trash2 size={12} />}
                                                        <span>ยืนยันลบ</span>
                                                    </button>
                                                    <button
                                                        onClick={() => setDeletingId(null)}
                                                        className="flex-1 py-2 min-h-[48px] bg-surface text-text-primary rounded-xl text-xs font-semibold border border-border hover:bg-surface-subtle active:scale-[0.96] transition-all cursor-pointer"
                                                    >
                                                        ยกเลิก
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-4 sm:p-5 flex items-center gap-3 sm:gap-5">
                                                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary-light text-primary border border-primary/10 rounded-xl flex items-center justify-center flex-shrink-0">
                                                    <MapPin size={15} className="sm:size-[16px]" />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-xs sm:text-sm font-semibold text-text-primary truncate">{loc.name}</h3>
                                                    <div className="flex items-center gap-1.5 sm:gap-2 mt-2 text-[9px] sm:text-xs text-text-secondary">
                                                        <Building2 size={10} className="text-text-muted flex-shrink-0" />
                                                        <span className="font-semibold truncate max-w-[110px] sm:max-w-none">{getOrganizationLabel(loc.organization)}</span>
                                                        <span className="text-text-muted/30">•</span>
                                                        <span className="text-text-muted text-[8px] sm:text-[9px] bg-surface-subtle px-1.5 py-0.5 rounded border border-border">
                                                            {loc.lat.toFixed(4)} , {loc.lng.toFixed(4)}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex gap-2 sm:gap-3 flex-shrink-0">
                                                    <button
                                                        onClick={() => openEdit(loc)}
                                                        className="w-8 h-8 sm:w-10 sm:h-10 min-h-[32px] min-w-[32px] sm:min-h-[40px] sm:min-w-[40px] bg-surface-subtle hover:bg-primary-light border border-border hover:border-primary/20 rounded-xl flex items-center justify-center transition-all cursor-pointer group active:scale-[0.95]"
                                                    >
                                                        <Pencil size={13} className="text-text-muted group-hover:text-primary sm:size-[14px]" />
                                                    </button>
                                                    <button
                                                        onClick={() => setDeletingId(loc.id)}
                                                        className="w-8 h-8 sm:w-10 sm:h-10 min-h-[32px] min-w-[32px] sm:min-h-[40px] sm:min-w-[40px] bg-surface-subtle hover:bg-red-500/10 border border-border hover:border-red-500/30 rounded-xl flex items-center justify-center transition-all cursor-pointer group active:scale-[0.95]"
                                                    >
                                                        <Trash2 size={13} className="text-text-muted group-hover:text-red-500 sm:size-[14px]" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                </div>

                {/* ══════════ EDIT DRAWER (MODAL) ══════════ */}
                {editingLoc && (
                    <>
                        <div className="fixed inset-0 bg-black/40 z-[800] backdrop-blur-xs transition-opacity" onClick={() => setEditingLoc(null)} />
                        <div
                            className="fixed bottom-0 left-0 right-0 z-[801] bg-surface rounded-t-[32px] shadow-2xl border-t border-border max-w-lg mx-auto px-8 pt-8 space-y-8 animate-slide-up transition-colors duration-300"
                            style={{
                                paddingBottom: "calc(56px + env(safe-area-inset-bottom))",
                            }}
                        >
                            <div className="w-12 h-1 bg-border rounded-full mx-auto mb-6 pointer-events-none" />

                            <div className="flex items-center justify-between mb-7">
                                <h3 className="text-xs font-semibold text-text-primary uppercase tracking-wider ">Edit Station Properties</h3>
                                <button
                                    onClick={() => setEditingLoc(null)}
                                    className="w-8 h-8 bg-surface-subtle border border-border rounded-full flex items-center justify-center hover:bg-surface-muted transition-colors active:scale-[0.92] cursor-pointer"
                                >
                                    <X size={14} className="text-text-secondary" />
                                </button>
                            </div>

                            <div className="space-y-7">
                                <div className="space-y-3">
                                    <label className="text-[9px] font-semibold text-text-muted uppercase tracking-wider block ">ชื่อสถานีตรวจ</label>
                                    <input
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        className="w-full px-5 py-4 bg-surface-subtle border border-border text-text-primary rounded-2xl text-xs focus:border-primary outline-none min-h-[52px]"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="text-[9px] font-semibold text-text-muted uppercase tracking-wider block ">หน่วยงานหลัก</label>
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
                                            className="w-full px-5 py-4 bg-surface-subtle border border-border text-text-primary rounded-2xl text-xs focus:border-primary outline-none min-h-[52px] appearance-none cursor-pointer"
                                        >
                                            {uniqueOrgs.map((org) => (
                                                <option key={org} value={org}>
                                                    {getOrganizationLabel(org)}
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
                                            className="w-full mt-2 px-5 py-4 bg-primary-light border border-primary/10 text-text-primary rounded-2xl text-xs placeholder:text-text-muted/30 focus:border-primary transition-all outline-none min-h-[52px] animate-fade-in"
                                        />
                                    )}
                                </div>

                                <button
                                    onClick={handleEdit}
                                    disabled={editSaving || !editName.trim() || !editOrg.trim()}
                                    className="w-full mt-6 py-4 min-h-[56px] bg-primary hover:bg-navy-dark text-white font-semibold rounded-2xl text-xs uppercase tracking-wider transition-all duration-300 disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-2.5 shadow-sm cursor-pointer"
                                >
                                    {editSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check size={14} />}
                                    <span>บันทึกข้อมูลการแก้ไข</span>
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
