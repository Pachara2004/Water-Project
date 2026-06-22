"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useAppStore } from "@/lib/store";
import { getOrganizationLabel } from "@/lib/standards";
import {
  MapPin,
  Building2,
  Save,
  ShieldAlert,
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  ArrowLeft,
  RefreshCw,
  Layers,
} from "lucide-react";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-surface-subtle flex items-center justify-center border border-border rounded-2xl">
      <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  ),
});

interface LocationItem {
  id: string;
  name: string;
  organization: string;
  lat: number;
  lng: number;
  createdAt: string;
}

export default function AdminLocationsPage() {
  const { currentUser } = useAppStore();
  const router = useRouter();

  // Create form
  const [name, setName] = useState("");
  const [organization, setOrganization] = useState(""); // เปลี่ยนจาก 'FISHERY' เป็นค่าว่าง
  const [customOrg, setCustomOrg] = useState("");
  const [pickedPosition, setPickedPosition] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // List
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [filterOrg, setFilterOrg] = useState("ALL");
  const [isLoading, setIsLoading] = useState(true);

  // Edit modal
  const [editingLoc, setEditingLoc] = useState<LocationItem | null>(null);
  const [editName, setEditName] = useState("");
  const [editOrg, setEditOrg] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchLocations = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/locations");
      const data = await res.json();
      setLocations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch locations:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentUser?.role === "ADMIN") {
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
    if (!name.trim() || !pickedPosition || !orgVal) return;

    setSaving(true);
    setSuccess(false);

    try {
      const res = await fetch("/api/locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
        setOrganization(""); // รีเซ็ตกลับเป็นค่าว่าง
        setCustomOrg("");
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
    if (!editingLoc || !editName.trim() || !editOrg.trim()) return;

    setEditSaving(true);
    try {
      const res = await fetch("/api/locations", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
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

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/locations?id=${id}`, { method: "DELETE" });
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

  // Role gate
  if (!currentUser || currentUser.role !== "ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center min-h-dvh px-6 text-center w-full max-w-lg mx-auto bg-surface-muted border-x border-border">
        <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-3xl flex items-center justify-center mb-4 border border-red-500/20">
          <ShieldAlert size={28} className="animate-pulse" />
        </div>
        <h1 className="font-display text-xl font-normal text-text-primary mb-1">
          สิทธิ์การเข้าถึงถูกจำกัด
        </h1>
        <p className="text-xs text-text-secondary mb-6 max-w-[80%] mx-auto leading-relaxed">
          หน้าการกำหนดค่าพิกัดพ้นกรอบการจัดการทั่วไป สำหรับผู้ดูแลระบบสูงสุด
          (System Admin) เท่านั้น
        </p>
        <button
          onClick={() => router.push("/map")}
          className="w-full max-w-[200px] py-3.5 bg-primary hover:bg-navy-dark text-white font-bold rounded-2xl text-xs uppercase tracking-wider shadow-sm transition-colors cursor-pointer"
        >
          กลับไปหน้าแผนที่
        </button>
      </div>
    );
  }

  const filteredLocations = locations.filter(
    (loc) => filterOrg === "ALL" || loc.organization === filterOrg,
  );

  // Get unique orgs for filter and form (Dynamic from Database)
  const uniqueOrgs = Array.from(
    new Set(locations.map((l) => l.organization).filter(Boolean)),
  );

  return (
    <div className="min-h-dvh w-full bg-surface-muted pb-[120px] relative transition-colors duration-300 overflow-hidden">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12">
        {/* Header */}
        <div className="bg-surface px-6 sm:px-8 pt-10 sm:pt-16 pb-6 sm:pb-10 mb-6 sm:mb-10 border-b border-border transition-colors duration-300">
          <button
            onClick={() => router.push("/admin")}
            className="flex items-center gap-2 text-xs font-bold text-text-muted hover:text-primary transition-colors mb-5 group cursor-pointer"
          >
            <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform duration-200" />
            Admin Panel
          </button>
          <h1 className="font-display text-2xl font-bold text-text-primary tracking-wide leading-tight">
            ตั้งค่าจุดตรวจ{" "}
            <span className="font-display text-primary">สถานีชายฝั่ง</span>
          </h1>
          <p className="text-text-secondary text-xs mt-4 leading-loose">
            กำหนดตำแหน่งพิกัดจุดเก็บตัวอย่างน้ำเพื่อการวิเคราะห์ทางวิทยาศาสตร์ร่วมกับแผนที่ระบบ
          </p>
        </div>

        <div className="px-4 sm:px-6 space-y-6 sm:space-y-10">
          {/* ══════════ SECTION 1: ADD NEW ══════════ */}
          <section className="bg-surface rounded-3xl p-5 sm:p-8 border border-border shadow-md space-y-6 sm:space-y-8 transition-all duration-300 relative overflow-hidden">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-8 h-8 bg-primary-light text-primary rounded-xl flex items-center justify-center border border-border">
                <Plus size={16} />
              </div>
              <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider ">
                Register New Station
              </h2>
            </div>

            <div className="space-y-7">
              {/* Name */}
              <div className="space-y-4">
                <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider block ">
                  ชื่อจุดเก็บตัวอย่างชายฝั่ง
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="เช่น หาดพัทยาเหนือ จุดตรวจที่ 1"
                  className="w-full px-5 py-3.5 bg-surface-subtle border border-border text-text-primary rounded-2xl text-xs placeholder:text-text-muted/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none min-h-[48px]"
                />
              </div>

              {/* Organization */}
              <div className="space-y-4">
                <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider block flex items-center gap-1.5 ">
                  <Building2 size={12} className="text-text-muted" />
                  หน่วยงานหลักผู้ดูแล (Authority)
                </label>
                <div className="relative">
                  <select
                    value={organization}
                    onChange={(e) => {
                      setOrganization(e.target.value);
                      if (e.target.value !== "CUSTOM") setCustomOrg("");
                    }}
                    className={`w-full px-5 py-3.5 bg-surface-subtle border border-border text-text-primary rounded-2xl text-xs focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all outline-none cursor-pointer min-h-[48px] appearance-none ${!organization && "text-text-muted/50"}`}
                  >
                    <option value="" disabled>
                      -- โปรดเลือกหน่วยงาน --
                    </option>
                    {uniqueOrgs.map((org) => (
                      <option key={org} value={org}>
                        {getOrganizationLabel(org)}
                      </option>
                    ))}
                    <option value="CUSTOM">+ เพิ่มหน่วยงานใหม่...</option>
                  </select>
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted text-xs">
                    ▼
                  </div>
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
              <div className="space-y-4">
                <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider block flex items-center gap-1.5 ">
                  <MapPin size={12} className="text-text-muted" />
                  ปักหมุดตำแหน่งพิกัด (Tap on Map)
                </label>
                <div className="w-full h-52 rounded-2xl overflow-hidden border border-border bg-surface-subtle relative">
                  <MapView
                    mode="picker"
                    onLocationPick={(lat, lng) =>
                      setPickedPosition({ lat, lng })
                    }
                    pickedPosition={pickedPosition}
                  />
                </div>

                {pickedPosition ? (
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-primary bg-primary-light border border-primary/10 py-2 px-4 rounded-full w-fit tracking-wider mt-2.5">
                    <Layers size={11} className="animate-pulse" />
                    LAT: {pickedPosition.lat.toFixed(6)} , LNG:{" "}
                    {pickedPosition.lng.toFixed(6)}
                  </div>
                ) : (
                  <p className="text-[9px] font-semibold text-text-muted italic mt-1.5">
                    *กรุณาแตะเลือกบนแผนที่เพื่อกําหนดพิกัดทางภูมิศาสตร์
                  </p>
                )}
              </div>

              {/* Success Prompt */}
              {success && (
                <div className="px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-emerald-600 dark:text-emerald-400 font-bold text-center flex items-center justify-center gap-1.5 animate-fade-in">
                  <Check size={14} className="text-emerald-500" />
                  บันทึกตำแหน่งสถานีตรวจวัดเรียบร้อยแล้ว
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={
                  !name.trim() ||
                  !pickedPosition ||
                  !getOrgValue() ||
                  saving ||
                  (organization === "CUSTOM" && !customOrg.trim())
                }
                className="w-full mt-6 py-4 min-h-[56px] bg-primary hover:bg-navy-dark text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all duration-300 disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-2.5 shadow-sm cursor-pointer"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    กำลังบันทึกสถานีใหม่...
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    เพิ่มสถานีตรวจวัดเข้าระบบ
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
                <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider ">
                  Saved Stations
                </h2>
              </div>
              <span className="text-[9px] font-bold text-primary bg-primary-light border border-primary/10 px-2.5 py-1 rounded-full uppercase tracking-wider ">
                {filteredLocations.length} Stations
              </span>
            </div>

            {/* Filter */}
            <div className="relative">
              <select
                value={filterOrg}
                onChange={(e) => setFilterOrg(e.target.value)}
                className="w-full text-xs px-5 py-3.5 min-h-[48px] bg-surface border border-border text-text-primary rounded-2xl outline-none cursor-pointer focus:border-primary transition-all appearance-none"
              >
                <option value="ALL">📋 แสดงจุดของทุกหน่วยงาน</option>
                {uniqueOrgs.map((org) => (
                  <option key={org} value={org}>
                    🏢 {getOrganizationLabel(org)}
                  </option>
                ))}
              </select>
              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted text-xs">
                ▼
              </div>
            </div>

            {/* Location List */}
            <div className="space-y-5">
              {isLoading ? (
                <div className="bg-surface rounded-3xl p-10 text-center border border-border flex flex-col items-center justify-center gap-3">
                  <RefreshCw size={22} className="animate-spin text-primary" />
                  <span className="text-xs text-text-muted font-bold">
                    กำลังดาวน์โหลดข้อมูลสถานี...
                  </span>
                </div>
              ) : filteredLocations.length === 0 ? (
                <div className="bg-surface rounded-3xl p-10 text-center border border-border shadow-sm">
                  <div className="w-14 h-14 bg-surface-subtle border border-border rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <MapPin size={20} className="text-text-muted" />
                  </div>
                  <p className="text-xs font-bold text-text-muted">
                    ไม่พบสถานีตรวจวัดตามตัวกรองนี้
                  </p>
                </div>
              ) : (
                filteredLocations.map((loc) => (
                  <div
                    key={loc.id}
                    className="bg-surface rounded-2xl border border-border shadow-md overflow-hidden transition-all hover:scale-[1.01] duration-200"
                  >
                    {/* Delete confirmation */}
                    {deletingId === loc.id ? (
                      <div className="p-6 bg-red-500/5 border-b border-red-500/10 space-y-5">
                        <p className="text-xs font-bold text-danger">
                          ⚠️ ลบสถานี &quot;{loc.name}&quot;
                          พร้อมผลข้อมูลประวัติทิ้งถาวร?
                        </p>
                        <div className="flex gap-3">
                          <button
                            onClick={() => handleDelete(loc.id)}
                            disabled={deleting}
                            className="flex-1 py-2 min-h-[48px] bg-danger text-white rounded-xl text-xs font-bold active:scale-[0.96] transition-all disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                          >
                            {deleting ? (
                              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Trash2 size={12} />
                            )}
                            ยืนยันลบ
                          </button>
                          <button
                            onClick={() => setDeletingId(null)}
                            className="flex-1 py-2 min-h-[48px] bg-surface text-text-primary rounded-xl text-xs font-bold border border-border hover:bg-surface-subtle active:scale-[0.96] transition-all cursor-pointer"
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
                          <h3 className="text-xs sm:text-sm font-bold text-text-primary truncate">
                            {loc.name}
                          </h3>
                          <div className="flex items-center gap-1.5 sm:gap-2 mt-2 text-[9px] sm:text-xs text-text-secondary">
                            <Building2
                              size={10}
                              className="text-text-muted flex-shrink-0"
                            />
                            <span className="font-bold truncate max-w-[110px] sm:max-w-none">
                              {getOrganizationLabel(loc.organization)}
                            </span>
                            <span className="text-text-muted/30">•</span>
                            <span className="text-text-muted text-[8px] sm:text-[9px] bg-surface-subtle px-1.5 py-0.5 rounded border border-border">
                              {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2 sm:gap-3 flex-shrink-0">
                          <button
                            onClick={() => openEdit(loc)}
                            className="w-8 h-8 sm:w-10 sm:h-10 min-h-[32px] min-w-[32px] sm:min-h-[40px] sm:min-w-[40px] bg-surface-subtle hover:bg-primary-light border border-border hover:border-primary/20 rounded-xl flex items-center justify-center transition-all cursor-pointer group active:scale-[0.95]"
                          >
                            <Pencil
                              size={13}
                              className="text-text-muted group-hover:text-primary sm:size-[14px]"
                            />
                          </button>
                          <button
                            onClick={() => setDeletingId(loc.id)}
                            className="w-8 h-8 sm:w-10 sm:h-10 min-h-[32px] min-w-[32px] sm:min-h-[40px] sm:min-w-[40px] bg-surface-subtle hover:bg-red-500/10 border border-border hover:border-red-500/30 rounded-xl flex items-center justify-center transition-all cursor-pointer group active:scale-[0.95]"
                          >
                            <Trash2
                              size={13}
                              className="text-text-muted group-hover:text-red-500 sm:size-[14px]"
                            />
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
            <div
              className="fixed inset-0 bg-black/40 z-[800] backdrop-blur-xs transition-opacity"
              onClick={() => setEditingLoc(null)}
            />
            <div
              className="fixed bottom-0 left-0 right-0 z-[801] bg-surface rounded-t-[32px] shadow-2xl border-t border-border max-w-lg mx-auto px-8 pt-8 space-y-8 animate-slide-up transition-colors duration-300"
              style={{
                paddingBottom: "calc(56px + env(safe-area-inset-bottom))",
              }}
            >
              <div className="w-12 h-1 bg-border rounded-full mx-auto mb-6 pointer-events-none" />

              <div className="flex items-center justify-between mb-7">
                <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider ">
                  Edit Station Properties
                </h3>
                <button
                  onClick={() => setEditingLoc(null)}
                  className="w-8 h-8 bg-surface-subtle border border-border rounded-full flex items-center justify-center hover:bg-surface-muted transition-colors active:scale-[0.92] cursor-pointer"
                >
                  <X size={14} className="text-text-secondary" />
                </button>
              </div>

              <div className="space-y-7">
                <div className="space-y-3">
                  <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider block ">
                    ชื่อสถานีตรวจ
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-5 py-4 bg-surface-subtle border border-border text-text-primary rounded-2xl text-xs focus:border-primary outline-none min-h-[52px]"
                  />
                </div>

                <div className="space-y-3">
                  <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider block ">
                    หน่วยงานหลัก
                  </label>

                  <div className="relative">
                    <select
                      value={uniqueOrgs.includes(editOrg) ? editOrg : "CUSTOM"}
                      onChange={(e) => {
                        if (e.target.value !== "CUSTOM") {
                          setEditOrg(e.target.value);
                        } else {
                          setEditOrg(""); // เคลียร์ค่าเพื่อเปิดช่องให้พิมพ์ใหม่
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
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-text-muted text-xs">
                      ▼
                    </div>
                  </div>

                  {/* จะแสดงช่องพิมพ์ก็ต่อเมื่อเลือก CUSTOM หรือพิมพ์ค่าแปลกๆ เข้าไป */}
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
                  className="w-full mt-6 py-4 min-h-[56px] bg-primary hover:bg-navy-dark text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all duration-300 disabled:opacity-40 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-2.5 shadow-sm cursor-pointer"
                >
                  {editSaving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  บันทึกข้อมูลการแก้ไข
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
