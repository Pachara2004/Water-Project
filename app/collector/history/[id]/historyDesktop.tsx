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
            <section className="rounded-xl bg-card-general overflow-hidden border border-border p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-border pb-2">
                    <span className="text-xs text-primary font-bold">ข้อมูลจุดตรวจวัด</span>
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
                            className={`w-full text-xs bg-surface-subtle border rounded-lg px-3 py-2.5 outline-none ${locationSearch && !isLocationValid ? "border-red-400" : "border-border focus:border-teal-500"}`}
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
                                        className="w-full text-left px-4 py-2 text-xs hover:bg-surface-subtle border-b last:border-0"
                                    >
                                        <span className="block font-bold">{loc.name}</span>
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
                            <p className="font-bold text-text text-sm">{sample.location.stationName}</p>
                            <p className="text-xs text-text-muted mt-0.5">{sample.location.governingAgency}</p>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center gap-2 text-xs text-text-secondary bg-card-general border border-border rounded-xl px-4 py-3">
                        <Calendar size={24} className="text-secondary shrink-0" />
                        {isEditing ? (
                            <input
                                title="input"
                                type="datetime-local"
                                value={editData.collectionTime}
                                onChange={(e) => setEditData((p: any) => ({ ...p, collectionTime: e.target.value }))}
                                className="flex-1 font-bold text-text-primary bg-transparent text-xs"
                            />
                        ) : (
                            <span className="font-bold">{formatDateTime(sample.collectionTime)}</span>
                        )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-text-secondary bg-card-general border border-border rounded-xl px-4 py-3">
                        <User size={24} className="text-secondary" />
                        <span className="font-bold truncate">{collectorFullName}</span>
                    </div>
                </div>
                <div className="bg-surface-subtle border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between gap-2 w-full">
                        <div className="flex items-center gap-2">
                            <FlaskConical size={24} className="text-secondary" />
                            <p className="text-xs font-bold text-secondary">ปริมาณออกซิเจนละลายน้ำ</p>
                        </div>
                        {isEditing ? (
                            <input
                                type="number"
                                step="0.01"
                                value={editData.oxygen}
                                onChange={(e) => setEditData((p: any) => ({ ...p, oxygen: e.target.value }))}
                                placeholder="ไม่ได้ระบุ"
                                className="flex-1 text-xs font-bold text-text bg-transparent text-right outline-none px-2"
                            />
                        ) : (
                            <span className="text-xs font-bold text-text ml-auto pr-2">{sample.dissolvedOxygen === null ? "-" : sample.dissolvedOxygen.toFixed(2)}</span>
                        )}
                        <span className="text-xs font-bold shrink-0">mg/L</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                    <div className="bg-surface-subtle border border-border rounded-xl p-4 text-center">
                        <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-2">
                                <Thermometer size={24} className="text-secondary" />
                                <p className="text-xs font-bold text-secondary">อุณหภูมิ</p>
                            </div>
                            <p className="text-sm font-bold text-text">{sample.airTemperature === null ? "-" : `${sample.airTemperature.toFixed(1)} °C`}</p>
                        </div>
                    </div>
                    <div className="bg-surface-subtle border border-border rounded-xl p-4 text-center">
                        <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-2">
                                <CloudRain size={24} className="text-secondary" />
                                <p className="text-xs font-bold text-secondary">ปริมาณฝน</p>
                            </div>
                            <p className="text-sm font-bold text-text-primary">{sample.rainAccumulation === null ? "-" : `${sample.rainAccumulation.toFixed(1)} mm`}</p>
                        </div>
                    </div>
                    <div className="bg-surface-subtle border border-border rounded-xl p-4 text-center">
                        <div className="flex items-center justify-between gap-1">
                            <div className="flex items-center gap-2">
                                <Waves size={24} className="text-secondary" />
                                <p className="text-xs font-bold text-secondary">สภาพอากาศ</p>
                            </div>
                            <p className="text-sm font-bold text-text truncate">{getWeatherConditionLabel(sample.weatherCondCode ?? undefined)}</p>
                        </div>
                    </div>
                </div>
            </section>

            {sample.locationStatus && sample.latestByParameter && sample.latestByParameter.length > 0 && (
                <section className="rounded-xl bg-card-general overflow-hidden border border-border p-6 space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-primary font-bold">ผลประเมินของสถานที่ ณ วันที่บันทึกนี้</span>
                        </div>
                        <StatusBadge status={sample.locationStatus} size="md" />
                    </div>

                    <div className="space-y-2">
                        {sample.latestByParameter.map((m: any) => (
                            <div key={m.parameterId} className="flex items-center justify-between text-xs bg-surface-subtle border border-border rounded-xl px-4 py-2.5">
                                <span className="font-bold text-text uppercase">{m.parameterName || "-"}</span>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-text">{m.value.toFixed(3)} mg/L</span>
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
        <div className="min-h-dvh w-full bg-surface-muted pb-5 antialiased transition-colors duration-300">
            <div className="bg-surface border-b border-border px-4 py-1 flex items-center justify-between sticky top-0 z-10">
                <button onClick={() => router.push("/collector")} className="flex items-center gap-1.5 text-xs text-secondary min-h-11">
                    <ArrowLeft size={16} /> <span>ย้อนกลับ</span>
                </button>
                <div className="text-center">
                    {sample?.sessionGroup ? (
                        <div className="flex flex-col items-center">
                            <h1 className="text-sm font-semibold text-secondary">{sample.sessionGroup}</h1>
                        </div>
                    ) : (
                        <h1 className="text-sm font-semibold text-primary">รายละเอียดประวัติการตรวจสอบ</h1>
                    )}
                </div>
                <div className="w-15" />
            </div>

            <div className="m-4">
                <div className="bg-surface border border-border rounded-xl overflow-hidden flex min-h-150">
                    <aside className="w-50 border-r border-border bg-surface flex flex-col p-4 shrink-0">
                        <p className="font-mono text-xs uppercase tracking-widest text-text-muted mb-2">ประวัติการตรวจ</p>
                        <div className="space-y-2 py-2 border-b">
                            <div className="flex flex-col">
                                <span className="text-xs text-text-muted font-mono">Sample ID</span>
                                <span className="text-xs font-bold">#{sample.id}</span>
                            </div>
                            <div className="flex flex-col mt-1.5">
                                <span className="text-xs text-text-muted font-mono">ผลประเมิน</span>
                                <div className="w-fit mt-1">
                                    <StatusBadge status={sample.status} size="sm" />
                                </div>
                            </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
                            <p className="font-mono textxs uppercase tracking-widest text-text-muted">Chemical Summary</p>
                            {resultEntries.map(({ key, param, measurement }: any) => (
                                <div key={key} className="flex justify-between items-center py-0.5">
                                    <span className="font-mono text-xs text-text-muted uppercase">
                                        {param.name}
                                        {measurement.isDuplicateSubstance && <span className="ml-1 text-amber-600">•ซ้ำ</span>}
                                    </span>
                                    <span className="text-xs font-bold text-text-primary text-right">
                                        {measurement.concentrated.toFixed(3)} <span className="text-xs text-text-muted font-normal">mg/L</span>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </aside>

                    <div className="flex flex-col flex-1 border-r border-border p-4 gap-4 max-h-[75vh] overflow-y-auto">
                        <HistoryMetaBlocks />
                    </div>

                    <div className="flex flex-col flex-1 p-4 gap-4 max-h-[75vh] overflow-y-auto">
                        {resultEntries.map(({ key, param, measurement }: any) => (
                            <ImageZone
                                key={key}
                                param={param}
                                step={mockSubmitHook.step}
                                preview={mockSubmitHook.imagePreviews[key]}
                                plotFile={mockSubmitHook.imagePlotFiles[key]}
                                measurement={measurement}
                                onImageFilesChange={() => {}}
                                onNearestLocationsUpdate={() => {}}
                                allLocations={[]}
                                setIsRecommending={() => {}}
                            />
                        ))}
                        <ResultsPanel {...mockSubmitHook} />
                    </div>
                </div>
            </div>
        </div>
    );
}
