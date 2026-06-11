'use client';

import { X, MapPin, Building2, Calendar, FlaskConical, ShieldCheck, ShieldX, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useRef, useEffect } from 'react';
import StatusBadge from './StatusBadge';
import { getOrganizationLabel, evaluateAllStandards, LOCATION_TYPE_LABELS } from '@/lib/standards';
import TimeSeriesChart, { TimeSeriesDataPoint } from './TimeSeriesChart';
import { useAppStore } from '@/lib/store';

export interface BottomSheetLocation {
  id: string;
  name: string;
  organization: string;
  type?: string;
  lat: number;
  lng: number;
  latestSample: {
    id: string;
    status: 'SAFE' | 'WARNING' | 'DANGER';
    phosphateVal: number | null;
    ammoniaVal: number | null;
    collectedAt: string;
    oxygen?: number | null;
    temperature?: number | null;
    rainVolume?: number | null;
    weatherCondition?: number | null;
    collector?: {
      id: string;
      name: string;
      phone: string | null;
    } | null;
  } | null;
  recentSamples?: {
    id: string;
    status: 'SAFE' | 'WARNING' | 'DANGER';
    phosphateVal: number | null;
    ammoniaVal: number | null;
    collectedAt: string;
    oxygen?: number | null;
    temperature?: number | null;
    rainVolume?: number | null;
    weatherCondition?: number | null;
    collector?: {
      id: string;
      name: string;
      phone: string | null;
    } | null;
  }[];
}

interface BottomSheetProps {
  location: BottomSheetLocation | null;
  onClose: () => void;
}

const WEATHER_CONDITIONS: Record<number, string> = {
  1: 'ท้องฟ้าแจ่มใส (Clear)',
  2: 'มีเมฆบางส่วน (Partly cloudy)',
  3: 'เมฆเป็นส่วนมาก (Cloudy)',
  4: 'มีเมฆมาก (Overcast)',
  5: 'ฝนตกเล็กน้อย (Light rain)',
  6: 'ฝนปานกลาง (Moderate rain)',
  7: 'ฝนตกหนัก (Heavy rain)',
  8: 'ฝนฟ้าคะนอง (Thunderstorm)',
  9: 'อากาศหนาวจัด (Very cold)',
  10: 'อากาศหนาว (Cold)',
  11: 'อากาศเย็น (Cool)',
  12: 'อากาศร้อนจัด (Very hot)',
};

function getWeatherConditionLabel(code: number | null | undefined): string {
  if (code === null || code === undefined) return 'ไม่พบข้อมูลสภาพอากาศ';
  return WEATHER_CONDITIONS[code] || `สภาพอากาศรหัส ${code}`;
}

export default function BottomSheet({ location, onClose }: BottomSheetProps) {
  const router = useRouter();
  const { currentUser } = useAppStore();
  const [sheetHeight, setSheetHeight] = useState<'collapsed' | 'half' | 'full'>('half');
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(0);
  const [currentDragY, setCurrentDragY] = useState(0);
  const sheetRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Height constants
  const HEIGHTS = {
    collapsed: 88,
    half: typeof window !== 'undefined' ? Math.min(window.innerHeight * 0.45, 400) : 180,
    full: typeof window !== 'undefined' ? Math.min(window.innerHeight * 0.85, 700) : 300,
  };

  // Get current height in px
  const getCurrentHeight = (): number => {
    if (sheetHeight === 'collapsed') return HEIGHTS.collapsed;
    if (sheetHeight === 'half') return HEIGHTS.half;
    return HEIGHTS.full;
  };

  // Calculate which snap point is nearest
  const getNearestSnapPoint = (height: number): 'collapsed' | 'half' | 'full' => {
    const distances = {
      collapsed: Math.abs(height - HEIGHTS.collapsed),
      half: Math.abs(height - HEIGHTS.half),
      full: Math.abs(height - HEIGHTS.full),
    };
    
    const nearest = Object.keys(distances).reduce((a, b) => 
      distances[a as keyof typeof distances] < distances[b as keyof typeof distances] ? a : b
    ) as 'collapsed' | 'half' | 'full';
    
    return nearest;
  };

  // Handle drag start
  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    setIsDragging(true);
    setDragStart(clientY);
    setCurrentDragY(clientY);
  };

  // Handle drag move - sheet follows finger smoothly
  const handleDragMove = (clientY: number) => {
    if (!isDragging) return;
    
    setCurrentDragY(clientY);
    const delta = dragStart - clientY; // positive = dragging up
    const baseHeight = getCurrentHeight();
    const newHeight = baseHeight + delta; // Add delta to increase height when dragging up
    
    // Clamp height between collapsed and full
    const clampedHeight = Math.max(HEIGHTS.collapsed, Math.min(HEIGHTS.full, newHeight));
    
    if (sheetRef.current) {
      sheetRef.current.style.height = `${clampedHeight}px`;
      sheetRef.current.style.transition = 'none';
    }
  };

  // Handle drag end - snap to next point based on drag direction
  const handleDragEnd = () => {
    if (!isDragging) return;
    
    const delta = dragStart - currentDragY; // positive = dragging up
    const threshold = 10; // minimum movement to trigger next point
    
    let nextPoint: 'collapsed' | 'half' | 'full' = sheetHeight;
    
    if (Math.abs(delta) > threshold) {
      if (delta > 0) {
        // Dragging up → go to next higher point
        if (sheetHeight === 'collapsed') nextPoint = 'half';
        else if (sheetHeight === 'half') nextPoint = 'full';
      } else {
        // Dragging down → go to next lower point
        if (sheetHeight === 'full') nextPoint = 'half';
        else if (sheetHeight === 'half') nextPoint = 'collapsed';
      }
    }
    
    setIsDragging(false);
    setSheetHeight(nextPoint);
  };

  // Apply smooth transition when snap animation should occur
  useEffect(() => {
    if (!isDragging && sheetRef.current) {
      sheetRef.current.style.transition = 'height 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
      sheetRef.current.style.height = `${getCurrentHeight()}px`;
    }
  }, [sheetHeight, isDragging]);

  if (!location) return null;

  // 🔐 PII PRIVACY MATRIX: Determine what to show for collector info based on role
  const renderCollectorInfo = () => {
    if (!latest?.collector) return null;
    
    const { name: colName, phone: colPhone, id: colId } = latest.collector;
    const role = currentUser?.role;

    // 1. GENERAL/PUBLIC users or not logged in: Hide collector details completely
    if (!currentUser || role === 'GENERAL') {
      return null;
    }

    // 2. ADMIN: Full Name + Contact Number
    if (role === 'ADMIN') {
      return (
        <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col gap-1 mt-4">
          <span className="text-[9px] font-black text-text-muted uppercase tracking-wider block">ผู้บันทึกข้อมูล (ADMIN ACCESS)</span>
          <p className="text-xs font-bold text-text-primary mt-1">{colName}</p>
          <p className="text-xs font-semibold text-primary font-mono">{colPhone || 'ไม่มีเบอร์โทรศัพท์'}</p>
        </div>
      );
    }

    // 3. COLLECTOR: Own Phone/Name only, other collectors anonymized
    if (role === 'COLLECTOR') {
      const isSelf = colId === currentUser.id;
      if (isSelf) {
        return (
          <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col gap-1 mt-4">
            <span className="text-[9px] font-black text-text-muted uppercase tracking-wider block">ผู้บันทึกข้อมูล (ข้อมูลของคุณเอง)</span>
            <p className="text-xs font-bold text-text-primary mt-1">{colName}</p>
            <p className="text-xs font-semibold text-primary font-mono">{colPhone || 'ไม่มีเบอร์โทรศัพท์'}</p>
          </div>
        );
      } else {
        const anonymizedName = colName.length > 0 ? `${colName[0]}***` : '***';
        return (
          <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col gap-1 mt-4">
            <span className="text-[9px] font-black text-text-muted uppercase tracking-wider block">ผู้บันทึกข้อมูล (ผู้ใช้รายอื่น)</span>
            <p className="text-xs font-bold text-text-primary mt-1">{anonymizedName}</p>
            <p className="text-[10px] text-text-muted italic">เบอร์โทรศัพท์ถูกปกปิดตามความคุ้มครองข้อมูลส่วนบุคคล (PDPA)</p>
          </div>
        );
      }
    }

    // 4. EXECUTIVE: Anonymized name, hide phone
    if (role === 'EXECUTIVE') {
      const anonymizedName = colName.length > 0 ? `${colName[0]}***` : '***';
      return (
        <div className="bg-surface border border-border rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col gap-1 mt-4">
          <span className="text-[9px] font-black text-text-muted uppercase tracking-wider block">ผู้บันทึกข้อมูล (ข้อมูลอนามัย)</span>
          <p className="text-xs font-bold text-text-primary mt-1">{anonymizedName}</p>
          <p className="text-[10px] text-text-muted italic">ข้อมูลส่วนบุคคลได้รับการปกปิดเพื่อความปลอดภัยของข้อมูล</p>
        </div>
      );
    }

    return null;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const chartData: TimeSeriesDataPoint[] = location.recentSamples
    ?.filter(s => new Date(s.collectedAt) >= oneWeekAgo)
    .map(sample => ({
      date: new Date(sample.collectedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }),
      phosphate: sample.phosphateVal ?? 0,
      ammonia: sample.ammoniaVal ?? 0,
    })) || [];

  const samplesArr = location.recentSamples || [];
  const latest = location.latestSample;
  const prev = samplesArr.length > 1 ? samplesArr[samplesArr.length - 2] : null;

  const po4Diff = prev && latest?.phosphateVal !== null && prev.phosphateVal !== null ? ((latest?.phosphateVal ?? 0) - (prev.phosphateVal ?? 0)) : 0;
  const nh3Diff = prev && latest?.ammoniaVal !== null && prev.ammoniaVal !== null ? ((latest?.ammoniaVal ?? 0) - (prev.ammoniaVal ?? 0)) : 0;

  const statusCounts = samplesArr.reduce((acc, curr) => {
    acc[curr.status] = (acc[curr.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const modeStatus = Object.keys(statusCounts).length > 0
    ? Object.keys(statusCounts).reduce((a, b) => statusCounts[a] > statusCounts[b] ? a : b, 'SAFE')
    : null;

  const standardsEval = latest ? evaluateAllStandards(latest.phosphateVal, latest.ammoniaVal) : null;

  /* ─── Shared scrollable content ─────────────────────────────────────── */
  const renderContent = () => (
    <div className="flex-1">

      {/* Location header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="p-3 bg-primary-light text-primary border border-primary/10 rounded-2xl flex-shrink-0">
          <MapPin size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-black text-text-primary text-base sm:text-lg leading-tight truncate">
            {location.name}
          </h3>
          <div className="flex items-center gap-2 mt-2 text-text-secondary text-xs">
            <Building2 size={12} className="text-text-muted" />
            <span className="font-bold">{getOrganizationLabel(location.organization)}</span>
          </div>
        </div>
      </div>

      {latest ? (
        <div className="space-y-5">
          {/* Status + Date */}
          <div className="bg-surface-subtle border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-[9px] font-black text-text-muted uppercase tracking-wider">ผลวิเคราะห์ล่าสุด</span>
              <StatusBadge status={latest.status as 'SAFE' | 'WARNING' | 'DANGER'} size="sm" />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <Calendar size={12} />
              <span className="font-semibold">{formatDate(latest.collectedAt)}</span>
            </div>
          </div>

          {/* 🔐 PII Collector Privacy Card */}
          {renderCollectorInfo()}

          {/* Chemical values */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface rounded-2xl p-6 border border-border shadow-sm flex flex-col justify-between hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-primary-light p-1.5 rounded-lg border border-primary/10">
                  <FlaskConical size={12} className="text-primary" />
                </div>
                <span className="text-[9px] font-black text-text-muted uppercase tracking-wider">Phosphate</span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl font-black text-text-primary">{latest.phosphateVal?.toFixed(3) ?? '-'}</span>
                <span className="text-[10px] text-text-muted font-bold">mg/L</span>
              </div>
              {prev && po4Diff !== 0 && (
                <div className={`flex items-center gap-1 mt-2 text-[10px] font-black ${po4Diff > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                  {po4Diff > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {po4Diff > 0 ? '+' : ''}{po4Diff.toFixed(3)}
                </div>
              )}
            </div>

            <div className="bg-surface rounded-2xl p-6 border border-border shadow-sm flex flex-col justify-between hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-primary-light p-1.5 rounded-lg border border-primary/10">
                  <FlaskConical size={12} className="text-primary" />
                </div>
                <span className="text-[9px] font-black text-text-muted uppercase tracking-wider">Ammonia</span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl font-black text-text-primary">{latest.ammoniaVal?.toFixed(3) ?? '-'}</span>
                <span className="text-[10px] text-text-muted font-bold">mg/L</span>
              </div>
              {prev && nh3Diff !== 0 && (
                <div className={`flex items-center gap-1 mt-2 text-[10px] font-black ${nh3Diff > 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                  {nh3Diff > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                  {nh3Diff > 0 ? '+' : ''}{nh3Diff.toFixed(3)}
                </div>
              )}
            </div>
          </div>

          {/* Dissolved Oxygen Card (DO) */}
          {latest.oxygen !== null && latest.oxygen !== undefined && (
            <div className="bg-surface rounded-2xl p-6 border border-border shadow-sm flex flex-col justify-between hover:scale-[1.02] active:scale-[0.98] transition-all duration-300">
              <div className="flex items-center gap-2 mb-4">
                <div className="bg-blue-500/10 p-1.5 rounded-lg border border-blue-500/10">
                  <FlaskConical size={12} className="text-blue-500" />
                </div>
                <span className="text-[9px] font-black text-text-muted uppercase tracking-wider block">Dissolved Oxygen (DO) - ค่าออกซิเจนละลายน้ำ</span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-2">
                <span className="text-2xl font-black text-text-primary">{latest.oxygen.toFixed(2)}</span>
                <span className="text-[10px] text-text-muted font-bold">mL/L</span>
              </div>
            </div>
          )}

          {/* Weather Details (TMD NWP Forecast) */}
          {(latest.temperature !== null || latest.rainVolume !== null || latest.weatherCondition !== null) && (
            <div className="bg-surface border border-border rounded-2xl p-6 shadow-sm">
              <h4 className="text-[9px] font-black text-text-muted uppercase tracking-wider mb-4">
                สภาพอากาศขณะเก็บตัวอย่าง (TMD NWP Forecast)
              </h4>
              <div className="grid grid-cols-3 gap-3 text-center">
                {latest.temperature !== null && latest.temperature !== undefined && (
                  <div className="bg-surface-subtle p-3 rounded-xl border border-border">
                    <span className="text-[8px] font-bold text-text-muted block uppercase">อุณหภูมิ</span>
                    <span className="text-xs font-black text-text-primary mt-1 block">{latest.temperature.toFixed(1)}°C</span>
                  </div>
                )}
                {latest.rainVolume !== null && latest.rainVolume !== undefined && (
                  <div className="bg-surface-subtle p-3 rounded-xl border border-border">
                    <span className="text-[8px] font-bold text-text-muted block uppercase">ปริมาณฝน</span>
                    <span className="text-xs font-black text-text-primary mt-1 block">{latest.rainVolume.toFixed(1)} mm</span>
                  </div>
                )}
                {latest.weatherCondition !== null && latest.weatherCondition !== undefined && (
                  <div className="bg-surface-subtle p-3 rounded-xl border border-border">
                    <span className="text-[8px] font-bold text-text-muted block uppercase">สภาพอากาศ</span>
                    <span className="text-[10px] font-black text-text-primary mt-1 block truncate" title={getWeatherConditionLabel(latest.weatherCondition)}>
                      {latest.weatherCondition === 1 ? 'Clear' : latest.weatherCondition === 8 ? 'Thunderstorm' : latest.weatherCondition <= 4 ? 'Cloudy' : 'Rainy'}
                    </span>
                  </div>
                )}
              </div>
              {latest.weatherCondition !== null && latest.weatherCondition !== undefined && (
                <p className="text-[9px] text-text-secondary mt-3 font-semibold text-center">
                  รายละเอียด: {getWeatherConditionLabel(latest.weatherCondition)}
                </p>
              )}
            </div>
          )}

          {modeStatus && samplesArr.length > 1 && (
            <div className="flex items-center justify-center gap-2 py-1 text-xs text-text-secondary">
              <Minus size={12} className="text-border" />
              <span className="font-bold">สถานะพบบ่อยสุด:</span>
              <StatusBadge status={modeStatus as 'SAFE' | 'WARNING' | 'DANGER'} size="sm" />
              <Minus size={12} className="text-border" />
            </div>
          )}

          {standardsEval && (
            <div className="bg-surface-subtle border border-border rounded-2xl p-6">
              <h4 className="text-[9px] font-black text-text-muted mb-4 uppercase tracking-wider">
                การผ่านเกณฑ์แบ่งตามประเภทการใช้งาน
              </h4>
              <div className="grid grid-cols-1 gap-3">
                {Object.entries(standardsEval).map(([type, passed]) => (
                  <div
                    key={type}
                    className={`flex items-center gap-3.5 text-xs font-bold px-4 py-3 rounded-xl border ${
                      passed
                        ? 'bg-emerald-500/5 text-emerald-700 dark:text-emerald-300 border-emerald-500/10'
                        : 'bg-red-500/5 text-red-700 dark:text-red-300 border-red-500/10'
                    }`}
                  >
                    {passed ? <ShieldCheck size={14} className="text-emerald-500 flex-shrink-0" /> : <ShieldX size={14} className="text-red-500 flex-shrink-0" />}
                    <span className="flex-1 truncate">{LOCATION_TYPE_LABELS[type as keyof typeof LOCATION_TYPE_LABELS]}</span>
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded border ${
                      passed
                        ? 'bg-emerald-100/70 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/30'
                        : 'bg-red-100/70 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200/50 dark:border-red-800/30'
                    }`}>
                      {passed ? 'ผ่าน' : 'ไม่ผ่าน'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {chartData.length > 0 && (
            <div className="bg-surface rounded-2xl p-6 border border-border shadow-sm">
              <h4 className="text-[9px] font-black text-text-muted uppercase tracking-wider mb-4 px-1">แนวโน้มค่าสารเคมี (WEEKLY TREND)</h4>
              <TimeSeriesChart data={chartData} />
            </div>
          )}

          {samplesArr.length > 0 && (
            <div className="bg-surface-subtle border border-border rounded-2xl p-6">
              <h4 className="text-[9px] font-black text-text-muted uppercase tracking-wider mb-4">บันทึกประวัติย้อนหลัง</h4>
              <div className="space-y-3">
                {[...samplesArr].reverse().slice(0, 3).map((s, idx) => (
                  <div key={idx} className="flex justify-between items-center text-xs bg-surface border border-border px-4 py-3 rounded-xl">
                    <span className="text-text-secondary font-bold">{new Date(s.collectedAt).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}</span>
                    <div className="flex items-center gap-4">
                      <span className="text-[9px] text-text-muted font-mono bg-surface-subtle px-1.5 py-0.5 border border-border rounded">P: {s.phosphateVal?.toFixed(2) || '-'} | A: {s.ammoniaVal?.toFixed(2) || '-'}</span>
                      <StatusBadge status={s.status} size="sm" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="w-14 h-14 bg-surface-subtle border border-border rounded-2xl flex items-center justify-center mx-auto mb-3">
            <FlaskConical size={24} className="text-text-muted" />
          </div>
          <p className="text-xs font-bold text-text-muted">ยังไม่พบประวัติผลการวิเคราะห์ในพิกัดนี้</p>
        </div>
      )}

      {(currentUser && (currentUser.role === 'ADMIN' || currentUser.role === 'COLLECTOR')) && (
        <div className="mt-8">
          <button
            onClick={() => router.push(`/submit?locationId=${location.id}`)}
            className="w-full py-4 min-h-[48px] bg-primary hover:bg-navy-dark active:scale-[0.97] text-white font-bold rounded-2xl text-xs sm:text-sm uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <FlaskConical size={15} />
            ส่งผลตรวจสารเคมีจุดนี้
          </button>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Backdrop removed - show map throughout */}
      <div
        className="hidden"
        onClick={onClose}
      />

      {/* ── Mobile: bottom sheet ──────────────────────────────────────── */}
      <div
        ref={sheetRef}
        className="sm:hidden fixed left-0 right-0 z-[1000] bg-surface rounded-t-[32px] border-t border-border shadow-2xl flex flex-col"
        style={{
          bottom: `calc(72px + env(safe-area-inset-bottom))`,
          height: `${getCurrentHeight()}px`,
          maxHeight: '85vh',
          touchAction: 'none',
          transition: isDragging ? 'none' : 'all 0.3s ease-out',
        }}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onTouchEnd={handleDragEnd}
        onMouseMove={(e) => handleDragMove(e.clientY)}
        onTouchMove={(e) => handleDragMove(e.touches[0].clientY)}
      >
        {/* Handle + Close */}
        <div
          className="bottom-sheet-header flex items-center justify-between px-6 pt-4 pb-3 flex-shrink-0 select-none"
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          <div className="w-8" />
          <div className="bottom-sheet-handle w-12 h-8 flex items-center justify-center cursor-grab active:cursor-grabbing rounded-full hover:bg-border/20 transition-colors"
               onMouseDown={handleDragStart}
               onTouchStart={handleDragStart}>
            <div className="w-10 h-1.5 rounded-full bg-border transition-all" />
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-subtle hover:bg-surface-muted flex items-center justify-center border border-border transition-colors active:scale-90 cursor-pointer"
          >
            <X size={14} className="text-text-secondary" />
          </button>
        </div>
        <div
          ref={contentRef}
          className="flex-1 flex flex-col overflow-y-auto scrollbar-none px-6 pb-4 pointer-events-auto"
          style={{
            paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
          }}
        >
          {renderContent()}
        </div>
      </div>

      {/* ── Tablet / Desktop: right-side panel ───────────────────────── */}
      <div className="hidden sm:flex fixed top-0 right-0 h-full z-[1000]
                      w-[400px] lg:w-[440px]
                      bg-surface border-l border-border shadow-2xl
                      flex-col animate-slide-in-right transition-colors duration-300"
           style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {/* Panel header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0 border-b border-border">
          <span className="text-xs font-black text-text-muted uppercase tracking-widest">ข้อมูลสถานี</span>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-surface-subtle hover:bg-surface-muted flex items-center justify-center border border-border transition-colors active:scale-90 cursor-pointer"
          >
            <X size={15} className="text-text-secondary" />
          </button>
        </div>
        <div className="flex-1 flex flex-col overflow-hidden px-6 pt-5">
          {renderContent()}
        </div>
      </div>
    </>
  );
}
