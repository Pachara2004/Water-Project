"use client";

import type { ComponentType } from "react";
import type { useRouter } from "next/navigation";
import { MapPin, MapPinPlus, MapPinned, Building2, Save, Plus, Search, FileText, ArrowLeft } from "lucide-react";
import { type LocationItem, StationListRow, LocationEditDrawer } from "@/components/manage/locationsHelpers";

type PickedPosition = { lat: number; lng: number } | null;

export interface LocationsPageProps {
    router: ReturnType<typeof useRouter>;
    MapView: ComponentType<{ mode?: "explorer" | "picker"; onLocationPick?: (lat: number, lng: number) => void; pickedPosition?: PickedPosition }>;
    toastElement: React.ReactNode;
    // create form
    name: string;
    setName: (v: string) => void;
    organization: string;
    customOrg: string;
    setCustomOrg: (v: string) => void;
    pickedPosition: PickedPosition;
    setPickedPosition: (v: PickedPosition) => void;
    saving: boolean;
    orgSearch: string;
    setOrgSearch: (v: string) => void;
    orgDropdownOpen: boolean;
    setOrgDropdownOpen: (v: boolean) => void;
    inputLat: string;
    inputLng: string;
    placeSearch: string;
    placeResults: any[];
    isSearchingPlace: boolean;
    showPlaceDropdown: boolean;
    handleSearchPlace: (query: string) => void;
    handleSelectPlace: (place: any) => void;
    handleManualCoordsChange: (lat: string, lng: string) => void;
    getOrgValue: () => string;
    handleSubmit: () => void;
    setOrganization: (v: string) => void;
    // list
    locations: LocationItem[];
    stationSearch: string;
    setStationSearch: (v: string) => void;
    filteredLocations: LocationItem[];
    uniqueOrgs: string[];
    orgOptions: string[];
    deletingId: number | null;
    openEdit: (loc: LocationItem) => void;
    handleDelete: (loc: LocationItem) => void;
    // edit drawer
    editingLoc: LocationItem | null;
    setEditingLoc: (v: LocationItem | null) => void;
    editName: string;
    setEditName: (v: string) => void;
    editOrg: string;
    setEditOrg: (v: string) => void;
    editSaving: boolean;
    handleEdit: () => void;
}

export default function LocationsMobile(props: LocationsPageProps) {
    const {
        router,
        MapView,
        toastElement,
        name,
        setName,
        organization,
        setOrganization,
        customOrg,
        setCustomOrg,
        pickedPosition,
        setPickedPosition,
        saving,
        orgSearch,
        setOrgSearch,
        orgDropdownOpen,
        setOrgDropdownOpen,
        inputLat,
        inputLng,
        placeSearch,
        placeResults,
        isSearchingPlace,
        showPlaceDropdown,
        handleSearchPlace,
        handleSelectPlace,
        handleManualCoordsChange,
        getOrgValue,
        handleSubmit,
        locations,
        stationSearch,
        setStationSearch,
        filteredLocations,
        uniqueOrgs,
        orgOptions,
        deletingId,
        openEdit,
        handleDelete,
        editingLoc,
        setEditingLoc,
        editName,
        setEditName,
        editOrg,
        setEditOrg,
        editSaving,
        handleEdit,
    } = props;

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
                        {/* 🌟 โซนค้นหาสถานที่ & กรอกพิกัด Lat/Lng ด้วยตนเอง */}
                        <div className="space-y-3 pt-2 border-t border-border">
                            {/* 1. ช่องค้นหาชื่อสถานที่ (OSM Nominatim) */}
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-text-primary flex items-center gap-1.5 uppercase tracking-wide">
                                    <Search size={13} className="text-primary" />
                                    ค้นหาสถานที่ใกล้เคียง
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={placeSearch}
                                        onChange={(e) => handleSearchPlace(e.target.value)}
                                        placeholder="พิมพ์ชื่อชายหาด, วัด, หรือสถานที่..."
                                        className="w-full pl-9 pr-8 py-2.5 bg-surface-subtle border border-border text-text-primary rounded-xl text-xs outline-none focus:border-primary font-semibold"
                                    />
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                                    {isSearchingPlace && (
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    )}

                                    {/* Dropdown ผลลัพธ์จากการค้นหา */}
                                    {showPlaceDropdown && placeResults.length > 0 && (
                                        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-40 bg-surface border border-border rounded-xl shadow-xl py-1 max-h-56 overflow-y-auto">
                                            {placeResults.map((place) => (
                                                <button
                                                    key={place.place_id}
                                                    type="button"
                                                    onClick={() => handleSelectPlace(place)}
                                                    className="w-full flex items-start gap-2 px-3 py-2 text-xs text-text-primary hover:bg-surface-subtle text-left border-b border-border/50 last:border-0 cursor-pointer"
                                                >
                                                    <MapPin size={13} className="text-primary shrink-0 mt-0.5" />
                                                    <span className="line-clamp-2">{place.display_name}</span>
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 2. ช่องกรอก Lat / Lng แบบพิมพ์เอง */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs font-bold text-text uppercase tracking-wider block mb-1">LATITUDE</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={inputLat}
                                        onChange={(e) => handleManualCoordsChange(e.target.value, inputLng)}
                                        placeholder="เช่น 12.8791"
                                        className="w-full px-3 py-2 bg-surface-subtle border border-border text-text-primary rounded-lg text-xs font-mono font-semibold focus:border-primary outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-text uppercase tracking-wider block mb-1">LONGITUDE</label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={inputLng}
                                        onChange={(e) => handleManualCoordsChange(inputLat, e.target.value)}
                                        placeholder="เช่น 100.8872"
                                        className="w-full px-3 py-2 bg-surface-subtle border border-border text-text-primary rounded-lg text-xs font-mono font-semibold focus:border-primary outline-none"
                                    />
                                </div>
                            </div>
                        </div>
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
                            <div className="w-full h-104 rounded-xl overflow-hidden border border-border bg-surface-subtle relative z-0">
                                <MapView mode="picker" onLocationPick={(lat, lng) => setPickedPosition({ lat, lng })} pickedPosition={pickedPosition} />
                            </div>

                            {pickedPosition ? (
                                <div className="flex items-center gap-1.5 text-xs font-bold text-text-secondary justify-center  py-1.5 px-3 rounded-md w-fit mt-2">
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
                            <StationListRow key={loc.id} loc={loc} deletingId={deletingId} onEdit={openEdit} onDelete={handleDelete} />
                        ))}
                    </div>
                </div>
            </div>

            {/* ─── EDIT STATION DRAWER (MODAL) ─── */}
            {editingLoc && (
                <LocationEditDrawer
                    editName={editName}
                    setEditName={setEditName}
                    editOrg={editOrg}
                    setEditOrg={setEditOrg}
                    editSaving={editSaving}
                    uniqueOrgs={uniqueOrgs}
                    onClose={() => setEditingLoc(null)}
                    onSave={handleEdit}
                />
            )}

            {toastElement}
        </div>
    );
}
