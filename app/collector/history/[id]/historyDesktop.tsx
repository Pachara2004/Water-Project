"use client";

import { ArrowLeft, Calendar, MapPin, User, FlaskConical, Thermometer, CloudRain, Waves } from "lucide-react";
import StatusBadge from "@/components/map/StatusBadge";
import { ImageZone } from "@/components/submit/ImageZone";
import { ResultsPanel } from "@/components/submit/ResultsPanel";
import { StandardsComparison } from "@/components/StandardsComparison";
import { getWeatherConditionLabel } from "@/lib/weather";

export default function CollectorHistoryDetailDesktop(props: any) {
    const {
        sample,
        mockSubmitHook,
        resultEntries,
        collectorFullName,
        locationComparisonRows,
        isEditing,
        locationDropdownRef,
        locationSearch,
        setLocationSearch,
        setLocationDropdownOpen,
        locationDropdownOpen,
        filteredLocations,
        isLocationValid,
        setEditData,
        editData,
        formatDateTime,
        router,
    } = props;

    const HistoryMetaBlocks = () => (
        <div className="space-y-4">
            <section className="rounded-xl bg-card-general border border-border p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                    <span className="text-xs text-primary font-medium">ข้อมูลจุดตรวจวัด</span>
                    <StatusBadge status={sample.status} size="md" />
                </div>
                {isEditing ? (
                    <div ref={locationDropdownRef} className="relative mt-2">
                        <input
                            type="text"
                            value={locationSearch}
                            placeholder="พิมพ์เพื่อค้นหาจุดตรวจ..."
                            onChange={(e) => {
                                setLocationSearch(e.target.value);
                                setLocationDropdownOpen(true);
                                setEditData((p: any) => ({ ...p, locationId: "" }));
                            }}
                            onFocus={() => setLocationDropdownOpen(true)}
                            className={`w-full text-xs bg-surface-subtle border rounded-lg px-3 py-2.5 outline-hidden ${locationSearch && !isLocationValid ? "border-red-400" : "border-border focus:border-teal-500"}`}
                        />
                        {locationDropdownOpen && filteredLocations.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-xl shadow-lg z-50 max-h-40 overflow-y-auto">
                                {filteredLocations.map((loc: any) => (
                                    <button
                                        key={loc.id}
                                        onClick={() => {
                                            setEditData((p: any) => ({ ...p, locationId: String(loc.id) }));
                                            setLocationSearch(loc.name);
                                            setLocationDropdownOpen(false);
                                        }}
                                        className="w-full text-left px-4 py-2 text-xs hover:bg-surface-subtle border-b border-border last:border-0 cursor-pointer"
                                    >
                                        <span className="block font-medium">{loc.name}</span>
                                        <span className="text-xs text-text-muted">{loc.agency}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex items-start gap-2 text-xs pt-1 p-1">
                        <MapPin size={24} className="text-text-safe mt-0.5 shrink-0" />
                        <div>
                            <p className="font-medium text-text text-sm">{sample.location.stationName}</p>
                            <p className="text-xs text-text-muted mt-0.5">{sample.location.governingAgency}</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 gap-3">
                    <div className="flex items-center gap-2 text-xs text-text-secondary bg-card-general border border-border rounded-xl px-4 py-3">
                        <Calendar size={20} className="text-secondary shrink-0" />
                        {isEditing ? (
                            <input
                                title="input"
                                type="datetime-local"
                                value={editData.collectionTime}
                                onChange={(e) => setEditData((p: any) => ({ ...p, collectionTime: e.target.value }))}
                                className="flex-1 font-medium text-text bg-transparent text-xs outline-hidden"
                            />
                        ) : (
                            <span className="font-medium">{formatDateTime(sample.collectionTime)}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-secondary bg-card-general border border-border rounded-xl px-4 py-3">
                        <User size={20} className="text-secondary shrink-0" />
                        <span className="font-medium truncate">{collectorFullName}</span>
                    </div>
                </div>

                {/* ปริมาณออกซิเจนละลายน้ำ — คอมเมนต์ซ่อนการแสดงผลไว้ชั่วคราว
                <div className="bg-surface-subtle border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between gap-2 w-full">
                        <div className="flex items-center gap-2">
                            <FlaskConical size={20} className="text-secondary shrink-0" />
                            <p className="text-xs font-medium text-secondary">ปริมาณออกซิเจนละลายน้ำ</p>
                        </div>
                        {isEditing ? (
                            <input
                                type="number"
                                step="0.01"
                                value={editData.oxygen}
                                onChange={(e) => setEditData((p: any) => ({ ...p, oxygen: e.target.value }))}
                                placeholder="ไม่ได้ระบุ"
                                className="flex-1 text-xs font-medium text-text bg-transparent text-right outline-hidden px-2"
                            />
                        ) : (
                            <span className="text-xs font-medium text-text ml-auto pr-2">{sample.dissolvedOxygen === null ? "-" : sample.dissolvedOxygen.toFixed(2)}</span>
                        )}
                        <span className="text-xs font-medium shrink-0">mg/L</span>
                    </div>
                </div>
                */}

                <div className="grid grid-cols-1 gap-2">
                    <div className="bg-surface-subtle border border-border rounded-xl p-3.5 text-center">
                        <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-2">
                                <Thermometer size={18} className="text-secondary shrink-0" />
                                <p className="text-xs font-medium text-secondary">อุณหภูมิ</p>
                            </div>
                            <p className="text-xs font-medium text-text">{sample.airTemperature === null ? "-" : `${sample.airTemperature.toFixed(1)} °C`}</p>
                        </div>
                    </div>
                    <div className="bg-surface-subtle border border-border rounded-xl p-3.5 text-center">
                        <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-2">
                                <CloudRain size={18} className="text-secondary shrink-0" />
                                <p className="text-xs font-medium text-secondary">ปริมาณฝน</p>
                            </div>
                            <p className="text-xs font-medium text-text">{sample.rainAccumulation === null ? "-" : `${sample.rainAccumulation.toFixed(1)} mm`}</p>
                        </div>
                    </div>
                    <div className="bg-surface-subtle border border-border rounded-xl p-3.5 text-center">
                        <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-2">
                                <Waves size={18} className="text-secondary shrink-0" />
                                <p className="text-xs font-medium text-secondary">สภาพอากาศ</p>
                            </div>
                            <p className="text-xs font-bmedium text-text truncate">{getWeatherConditionLabel(sample.weatherCondCode ?? undefined)}</p>
                        </div>
                    </div>
                </div>
            </section>

            {sample.locationStatus && sample.latestByParameter && sample.latestByParameter.length > 0 && (
                <section className="rounded-xl bg-card-general border border-border p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                        <span className="text-xs text-primary font-medium">ผลประเมินของสถานที่ ณ วันที่บันทึกนี้</span>
                        <StatusBadge status={sample.locationStatus} size="md" />
                    </div>

                    <div className="space-y-2">
                        {sample.latestByParameter.map((m: any) => (
                            <div key={m.parameterId} className="flex items-center justify-between text-xs bg-surface-subtle border border-border rounded-md p-3">
                                <span className="font-medium text-text uppercase">{m.parameterName || "-"}</span>
                                <div className="flex items-center gap-3">
                                    <span className="font-medium text-text">{m.value.toFixed(2)} mg/L</span>
                                    <span className="text-xs text-text-muted">{formatDateTime(m.collectedAt)}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <StandardsComparison compact title="การผ่านเกณฑ์แบ่งตามประเภทการใช้งาน" rows={locationComparisonRows} />
                </section>
            )}
        </div>
    );

    return (
        <div className="min-h-dvh w-full bg-bg pb-12 antialiased transition-colors duration-300">
            {/* ── Top Navigation Header ── */}
            <header className="bg-card-general border-b border-border sticky top-0 z-20">
                <div className="w-full px-4 h-13 flex items-center justify-between relative">
                    {/* ฝั่งซ้าย: ปุ่มย้อนกลับ */}
                    <div className="flex items-center gap-3 z-10">
                        <button
                            onClick={() => router.push("/collector")}
                            className="flex items-center gap-2 text-xs font-medium text-text hover:text-primary px-2.5 py-1.5 rounded-lg hover:bg-surface-subtle transition-all cursor-pointer"
                        >
                            <ArrowLeft size={16} />
                            <span>ย้อนกลับ</span>
                        </button>
                    </div>

                    {/* ตรงกลาง: หัวข้อ (อยู่ตรงกลางของ Header เสมอ) */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <h1 className="text-sm font-medium text-text pointer-events-auto">{sample?.sessionGroup ? sample.sessionGroup : "รายละเอียดประวัติการตรวจสอบ"}</h1>
                    </div>

                    {/* ฝั่งขวา: Spacer เพื่อความสมดุล */}
                    <div className="w-20" />
                </div>
            </header>

            {/* ── Main Layout (2 Columns Page Flow) ── */}
            <main className="w-full mx-auto p-4">
                <div className="grid grid-cols-12 gap-4 items-start">
                    {/* LEFT COLUMN: Summary & Metadata (4 Columns) */}
                    <aside className="col-span-12 lg:col-span-4 space-y-4">
                        {/* Sample ID & Chemical Summary Card */}
                        <div className="bg-card-general border border-border rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between border-b border-border pb-2">
                                <div className="flex flex-col">
                                    <span className="text-xs text-text-muted uppercase">SessionGroup CODE</span>
                                    <span className="text-xs font-medium text-text">{sample?.sessionGroup ? sample.sessionGroup : "รายละเอียดประวัติการตรวจสอบ"}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-xs text-text-muted uppercase mb-0.5 ">ผลประเมิน</span>
                                    <StatusBadge status={sample.status} size="sm" />
                                    <div className="flex flex-col items-end text-center mt-0.5 shrink-0">
                                        {sample.reviewStatus === "PENDING" && (
                                            <span className="inline-flex items-center w-20 text-xs font-semibold text-text-warning bg-bg-warning border border-border-warning p-1 justify-center rounded-md whitespace-nowrap">
                                                รอตรวจสอบ
                                            </span>
                                        )}
                                        {sample.reviewStatus === "REJECTED" && (
                                            <span className="inline-flex items-center w-20 text-xs font-semibold text-red-600 bg-red-100 border border-red-200 p-1 justify-center rounded-md whitespace-nowrap">
                                                ถูกปฏิเสธ
                                            </span>
                                        )}
                                        {sample.reviewStatus === "EDITED_APPROVED" && (
                                            <span className="inline-flex items-center w-30 text-xs font-semibold text-teal-700 bg-teal-50 border border-teal-200 p-1 justify-center rounded-md whitespace-nowrap">
                                                อนุมัติ (มีการแก้ไข)
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {/* ฝั่งขวา: Badge สถานะ ขยับไปชิดขวาสุดเสมอ */}
                            </div>

                            {sample.reviewNote && (
                                <div className="bg-red-50/50 border border-red-100 rounded-lg p-3 my-2">
                                    <h3 className="text-[11px] font-semibold text-red-700 mb-1 uppercase tracking-wider">บันทึกจากผู้ตรวจสอบ / เหตุผล</h3>
                                    <p className="text-xs text-red-600 whitespace-pre-wrap leading-relaxed">{sample.reviewNote}</p>
                                </div>
                            )}

                            <div className="pt-1 space-y-2">
                                <p className="text-xs uppercase text-text font-medium">สารที่ตรวจพบ</p>
                                {resultEntries.map(({ key, param, measurement }: any) => (
                                    <div key={key} className="flex justify-between items-center p-3 rounded-md bg-surface-subtle border border-border/50 text-xs">
                                        <span className="text-text-muted uppercase font-medium">
                                            {param.name}
                                            {measurement.isDuplicateSubstance && <span className="ml-1 text-amber-600">•ซ้ำ</span>}
                                        </span>
                                        <div className="flex flex-col items-end gap-1">
                                            {measurement.originalValue !== undefined && measurement.originalValue !== null && measurement.originalValue !== measurement.concentrated ? (
                                                <>
                                                    <div className="flex items-center gap-1.5 text-[11px] text-text-muted">
                                                        <span>ค่าที่ส่ง:</span>
                                                        <span className="line-through decoration-red-400">
                                                            {measurement.originalValue.toFixed(2)} mg/L
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-[11px]">
                                                        <span className="text-teal-700 font-medium">แก้ไขเป็น:</span>
                                                        <span className="font-bold text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded-md">
                                                            {measurement.concentrated.toFixed(2)} mg/L
                                                        </span>
                                                    </div>
                                                </>
                                            ) : (
                                                <span className="font-medium text-text text-sm">
                                                    {measurement.concentrated.toFixed(2)} <span className="text-xs text-text-muted font-mediuml">mg/L</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>



                        {/* Location & Context Detail Component */}
                        <HistoryMetaBlocks />
                    </aside>

                    {/* RIGHT COLUMN: Image Zones & Results Panel (8 Columns) */}
                    <section className="col-span-12 lg:col-span-8 space-y-4">
                        {resultEntries.map(({ key, param, measurement }: any) => (
                            <div key={key} className="bg-card-general border border-border rounded-xl p-4">
                                <ImageZone
                                    param={param}
                                    step="results"
                                    preview={mockSubmitHook.imagePreviews[key] || measurement?.imageUrl || measurement?.imagePath || measurement?.plotUrl}
                                    plotFile={mockSubmitHook.imagePlotFiles[key]}
                                    measurement={measurement}
                                    onImageFilesChange={() => {}}
                                    onNearestLocationsUpdate={() => {}}
                                    allLocations={[]}
                                    setIsRecommending={() => {}}
                                    isHistoryView={true}
                                />
                            </div>
                        ))}

                        <div className="bg-card-general border border-border rounded-xl p-4">
                            <ResultsPanel {...mockSubmitHook} />
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
