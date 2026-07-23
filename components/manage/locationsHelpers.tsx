"use client";

import { Building2, MapPin, Pencil, Trash2, Check } from "lucide-react";
import Popup from "@/components/Popup";

export interface LocationItem {
    id: number;
    name: string;
    organization: string;
    lat: number;
    lng: number;
}

export function StationListRow({ loc, deletingId, onEdit, onDelete }: { loc: LocationItem; deletingId: number | null; onEdit: (loc: LocationItem) => void; onDelete: (loc: LocationItem) => void }) {
    return (
        <div className="bg-surface rounded-2xl p-3.5 border border-border flex items-center justify-between gap-4 transition-all hover:scale-[1.005] duration-150 min-w-0">
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
    );
}

export function LocationEditDrawer({
    editName,
    setEditName,
    editOrg,
    setEditOrg,
    editSaving,
    uniqueOrgs,
    onClose,
    onSave,
}: {
    editName: string;
    setEditName: (v: string) => void;
    editOrg: string;
    setEditOrg: (v: string) => void;
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
