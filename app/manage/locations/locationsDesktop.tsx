"use client";

import { MapPin, MapPinPlus, MapPinned, Building2, Save, Plus, Search, FileText, ArrowLeft } from "lucide-react";
import { StationListRow, LocationEditDrawer } from "@/components/manage/locationsHelpers";
import type { LocationsPageProps } from "./locationsMobile";

// Desktop = ขยาย layout เดิมของ mobile ให้เต็มจอ — เรียงการ์ดแนวตั้งเหมือน mobile (ฟอร์มบน รายการล่าง)
// แต่ข้างในการ์ดฟอร์มจัดฟิลด์ไว้ซ้าย/แผนที่ไว้ขวา ใช้พื้นที่กว้างของจอแทนการบีบเป็นคอลัมน์เดียวยาว
// ไม่เปลี่ยน logic/handler — ใช้ state ชุดเดียวกับ locationsMobile ที่มาจาก page.tsx
export default function LocationsDesktop(props: LocationsPageProps) {
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
        <div className="min-h-dvh w-full bg-bg pb-8 antialiased transition-colors duration-300">
            <div className="bg-surface border-b border-border px-8 h-13 flex items-center justify-between sticky top-0 z-10">
                <button onClick={() => router.back()} className="flex items-center gap-1.5 text-xs text-text min-h-11">
                    <ArrowLeft size={16} /> <span>ย้อนกลับ</span>
                </button>
                <div className="text-center">
                    <h1 className="text-sm font-semibold text-primary">จัดการจุดตรวจวัดน้ำ</h1>
                </div>
                <div className="w-15" />
            </div>

            <div className="w-full max-w-[1600px] mx-auto px-8 pt-8 space-y-5">
                {/* ─── ส่วนฟอร์มเพิ่มสถานีใหม่ (Add New Form Card) — ฟิลด์ซ้าย/แผนที่ขวา ─── */}
                <div className="bg-surface rounded-2xl p-6 border border-border">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-primary-light text-primary rounded-xl flex items-center justify-center shrink-0">
                            <MapPinPlus size={20} />
                        </div>
                        <div className="transition-colors duration-300">
                            <h1 className="text-lg font-bold text-text-primary leading-tight">
                                ตั้งค่าจุดตรวจ<span className="text-primary">สถานี</span>
                            </h1>
                            <p className="text-text-secondary text-xs leading-relaxed mt-1">กำหนดตำแหน่งพิกัดจุดเก็บตัวอย่างน้ำเพื่อการวิเคราะห์ทางวิทยาศาสตร์ร่วมกับแผนที่ระบบ</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-12 gap-6 mt-6 pt-6 border-t border-border">
                        {/* ฝั่งซ้าย: ฟิลด์กรอกข้อมูลทั้งหมด */}
                        <div className="col-span-12 lg:col-span-5 flex flex-col gap-4 h-full">
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

                            {pickedPosition ? (
                                <div className="flex items-center gap-1.5 text-xs font-bold text-text-secondary bg-surface-subtle border border-border w-fit py-1.5 px-3 rounded-md">
                                    <MapPinned size={12} className="text-text-muted" />
                                    LAT: {pickedPosition.lat.toFixed(6)} , LNG: {pickedPosition.lng.toFixed(6)}
                                </div>
                            ) : (
                                <p className="text-xs text-text-muted italic">*กรุณาแตะเลือกบนแผนที่เพื่อกําหนดพิกัดภูมิศาสตร์</p>
                            )}

                            {/* ปุ่มบันทึกสถานี */}
                            <button
                                onClick={handleSubmit}
                                disabled={!name.trim() || !pickedPosition || !getOrgValue() || saving || (organization === "CUSTOM" && !customOrg.trim())}
                                className="w-full mt-auto py-3 min-h-11 bg-primary hover:bg-primary/95 text-white font-bold rounded-xl text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer shadow-xs disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed shrink-0"
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

                        {/* ฝั่งขวา: แผนที่ปักหมุด — สูงเต็มคอลัมน์ให้จับตำแหน่งง่ายขึ้นบนจอกว้าง */}
                        <div className="col-span-12 lg:col-span-7 flex flex-col gap-2 h-full">
                            <label className="text-xs font-bold text-text-primary flex items-center gap-1.5 uppercase tracking-wide shrink-0">
                                <MapPin size={13} className="text-text-secondary" />
                                ปักหมุดภูมิศาสตร์บนแผนที่
                            </label>
                            <div className="w-full flex-1 min-h-100 rounded-xl overflow-hidden border border-border bg-surface-subtle relative z-0">
                                <MapView mode="picker" onLocationPick={(lat, lng) => setPickedPosition({ lat, lng })} pickedPosition={pickedPosition} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* ─── ส่วนแสดงรายการประวัติสถานีที่มีอยู่ (Saved Stations Card) ─── */}
                <div className="bg-surface rounded-2xl p-5 border border-border space-y-4">
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

                    {/* รายชื่อสถานีแบบหลายคอลัมน์ ใช้พื้นที่กว้างของจอ */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 pt-2">
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
