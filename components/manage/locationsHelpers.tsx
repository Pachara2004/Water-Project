"use client";

import { Building2, Pencil, Trash2, Check } from "lucide-react";
import Popup from "@/components/Popup";

import { ThaiAddressSelector } from "./ThaiAddressSelector";

export interface LocationItem {
    id: number;
    name: string;
    organization: string;
    lat: number;
    lng: number;
    province?: string | null;
    district?: string | null;
    subdistrict?: string | null;
    zipcode?: string | null;
}

function MapThumbnail({ lat, lng }: { lat: number; lng: number }) {
    const zoom = 11;
    const n = Math.pow(2, zoom);
    const exactX = ((lng + 180) / 360) * n;
    const latRad = (lat * Math.PI) / 180;
    const exactY = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;
    
    const x = Math.floor(exactX);
    const y = Math.floor(exactY);

    const pixelX = (exactX - x) * 256;
    const pixelY = (exactY - y) * 256;

    // เพื่อให้หมุดอยู่ตรงกลางเป๊ะ และไม่มีขอบขาว เราจะโหลดรูป Tile 4 รูป (2x2 grid) มาต่อกันอัตโนมัติ
    const xDir = pixelX < 128 ? -1 : 1;
    const yDir = pixelY < 128 ? -1 : 1;

    const getTileUrl = (zx: number, zy: number) => `https://a.tile.openstreetmap.org/${zoom}/${zx}/${zy}.png`;

    const tiles = [
        { url: getTileUrl(x, y), dx: 0, dy: 0 },
        { url: getTileUrl(x + xDir, y), dx: xDir * 256, dy: 0 },
        { url: getTileUrl(x, y + yDir), dx: 0, dy: yDir * 256 },
        { url: getTileUrl(x + xDir, y + yDir), dx: xDir * 256, dy: yDir * 256 },
    ];

    const offsetX = pixelX - 128;
    const offsetY = pixelY - 128;

    return (
        <div 
            className="w-24 shrink-0 relative bg-surface-subtle border-r border-primary overflow-hidden shadow-[inset_0_0_12px_rgba(0,0,0,0.08)] after:absolute after:inset-0 after:shadow-[inset_0_0_12px_rgba(0,0,0,0.08)] after:pointer-events-none"
            style={{
                backgroundImage: tiles.map(t => `url(${t.url})`).join(", "),
                backgroundPosition: tiles.map(t => `calc(50% - ${offsetX - t.dx}px) calc(50% - ${offsetY - t.dy}px)`).join(", "),
                backgroundRepeat: "no-repeat, no-repeat, no-repeat, no-repeat",
                backgroundSize: "256px 256px, 256px 256px, 256px 256px, 256px 256px"
            }}
        >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full border-2 border-white shadow-sm box-content" />
        </div>
    );
}

export function StationListRow({ loc, deletingId, onEdit, onDelete }: { loc: LocationItem; deletingId: number | null; onEdit: (loc: LocationItem) => void; onDelete: (loc: LocationItem) => void }) {
    return (
        <div className="bg-card-general rounded-xl border-2 border-border  flex items-stretch transition-all hover:scale-[1.005] duration-150 min-w-0 overflow-hidden">
            <MapThumbnail lat={loc.lat} lng={loc.lng} />
            
            <div className="flex items-center justify-between gap-4 p-4 min-w-0 flex-1">
                <div className="flex-1 min-w-0 text-left">
                    <div className="gap-2 flex items-center">
                        <h4 className="font-semibold text-sm text-text-primary truncate">{loc.name}</h4>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-xs text-text-secondary font-medium">
                        <div className="flex items-center gap-2 min-w-0 max-w-35 sm:max-w-none">
                            <Building2 size={16} className="text-secondary shrink-0" />
                            <span className="truncate font-semibold text-secondary">{loc.organization}</span>
                        </div>
                        {loc.province && (
                            <>
                                <span className="text-text-muted/30 hidden sm:inline">•</span>
                                <span className="text-text-muted text-xs truncate">
                                    {loc.district && `อ.${loc.district}, `}จ.{loc.province}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                {/* กลุ่มปุ่มจัดการด้านขวามือสไตล์ Rounded-xl กระชับ */}
                <div className="flex gap-2 shrink-0">
                <button
                    onClick={() => onEdit(loc)}
                    className="w-9 h-9 bg-surface-subtle hover:bg-primary-light border border-border hover:border-primary/20 rounded-xl flex items-center justify-center transition-all cursor-pointer group active:scale-[0.95]"
                >
                    <Pencil size={16} className="text-text-muted group-hover:text-primary" />
                </button>
                <button
                    onClick={() => onDelete(loc)}
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
        </div>
    );
}

export function LocationEditDrawer({
    editName,
    setEditName,
    editOrg,
    setEditOrg,
    editProvince,
    setEditProvince,
    editDistrict,
    setEditDistrict,
    editSubdistrict,
    setEditSubdistrict,
    editZipcode,
    setEditZipcode,
    editSaving,
    uniqueOrgs,
    onClose,
    onSave,
}: {
    editName: string;
    setEditName: (v: string) => void;
    editOrg: string;
    setEditOrg: (v: string) => void;
    editProvince: string;
    setEditProvince: (v: string) => void;
    editDistrict: string;
    setEditDistrict: (v: string) => void;
    editSubdistrict: string;
    setEditSubdistrict: (v: string) => void;
    editZipcode: string;
    setEditZipcode: (v: string) => void;
    editSaving: boolean;
    uniqueOrgs: string[];
    onClose: () => void;
    onSave: () => void;
}) {
    return (
        <Popup title="แก้ไขข้อมูลสถานีตรวจ" onClose={onClose}>
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

                    <ThaiAddressSelector 
                        province={editProvince} setProvince={setEditProvince}
                        district={editDistrict} setDistrict={setEditDistrict}
                        subdistrict={editSubdistrict} setSubdistrict={setEditSubdistrict}
                        zipcode={editZipcode} setZipcode={setEditZipcode}
                    />

                    <button
                        onClick={onSave}
                        disabled={editSaving || !editName.trim() || !editOrg.trim()}
                        className="w-full mt-2 py-4 min-h-13 bg-primary hover:bg-navy-dark text-white font-semibold rounded-2xl text-xs uppercase tracking-wider transition-all duration-300 disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-2.5 shadow-sm cursor-pointer active:scale-[0.98]"
                    >
                        {editSaving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Check size={14} />}
                        <span>บันทึกข้อมูลการแก้ไข</span>
                    </button>
                </div>
        </Popup>
    );
}
