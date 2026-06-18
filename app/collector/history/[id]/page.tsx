'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import StatusBadge from '@/components/StatusBadge';
import { evaluateAllStandards, LOCATION_TYPE_LABELS } from '@/lib/standards';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  CloudRain,
  FlaskConical,
  MapPin,
  ShieldCheck,
  ShieldX,
  Thermometer,
  User,
  Waves,
} from 'lucide-react';

type WaterStatus = 'SAFE' | 'WARNING' | 'DANGER';

interface SampleDetail {
  id: string;
  collectorId: string;
  locationId: string;
  collectionTime: string;
  uploadedAt: string;
  ammonia: number;
  phosphate: number;
  oxygen: number | null;
  temperature: number | null;
  rainVolume: number | null;
  weatherCondition: number | null;
  status: WaterStatus;
  imageUrl: string | null;
  location: {
    id: string;
    name: string;
    agency: string;
    lat: number;
    lon: number;
  };
  collector: {
    id: string;
    name: string;
  };
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

function formatDateTime(value: string) {
  return new Date(value).toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatWeatherCondition(code: number | null) {
  if (code === null) return 'ไม่พบข้อมูลสภาพอากาศ';
  return WEATHER_CONDITIONS[code] || `สภาพอากาศรหัส ${code}`;
}

function getValueColor(status: WaterStatus) {
  if (status === 'DANGER') return 'text-red-600 dark:text-red-400';
  if (status === 'WARNING') return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
}

export default function CollectorHistoryDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { currentUser } = useAppStore();
  const [sample, setSample] = useState<SampleDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role !== 'COLLECTOR' && currentUser.role !== 'ADMIN') {
      router.push('/map');
    }
  }, [currentUser, router]);

  useEffect(() => {
    let cancelled = false;

    async function fetchSample() {
      if (!currentUser) return;
      if (currentUser.role !== 'COLLECTOR' && currentUser.role !== 'ADMIN') return;
      if (!params.id) return;

      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`/api/samples/${params.id}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || 'ไม่สามารถดึงข้อมูลประวัติได้');
        }

        if (!cancelled) setSample(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
          setSample(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSample();

    return () => {
      cancelled = true;
    };
  }, [currentUser, params.id]);

  const standardsEvaluation = useMemo(() => {
    if (!sample) return [];
    return Object.entries(evaluateAllStandards(sample.phosphate, sample.ammonia)).map(
      ([type, passed]) => ({
        type,
        label: LOCATION_TYPE_LABELS[type as keyof typeof LOCATION_TYPE_LABELS] || type,
        passed,
      }),
    );
  }, [sample]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-surface-muted px-5 sm:px-8 lg:px-12 py-6 sm:py-10">
        <div className="w-full max-w-3xl mx-auto space-y-5">
          <div className="h-20 rounded-3xl bg-surface border border-border shadow-sm animate-pulse" />
          <div className="h-44 rounded-3xl bg-surface border border-border shadow-sm animate-pulse" />
          <div className="grid grid-cols-2 gap-4">
            <div className="h-32 rounded-2xl bg-surface border border-border shadow-sm animate-pulse" />
            <div className="h-32 rounded-2xl bg-surface border border-border shadow-sm animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !sample) {
    return (
      <div className="min-h-dvh bg-surface-muted px-5 sm:px-8 lg:px-12 py-8">
        <div className="max-w-xl mx-auto bg-surface border border-border rounded-3xl p-6 text-center shadow-sm">
          <div className="w-14 h-14 bg-surface-subtle rounded-2xl border border-border flex items-center justify-center mx-auto mb-4">
            <FlaskConical size={22} className="text-text-muted" />
          </div>
          <h1 className="text-base font-black text-text-primary mb-2">ไม่พบข้อมูลประวัติ</h1>
          <p className="text-xs text-text-secondary leading-relaxed mb-5">
            {error || 'รายการประวัติที่เลือกอาจถูกลบหรือไม่มีอยู่ในระบบ'}
          </p>
          <button
            onClick={() => router.push('/collector')}
            className="px-5 py-3 min-h-[44px] rounded-2xl bg-primary text-white text-xs font-bold transition-all active:scale-[0.97] cursor-pointer"
          >
            กลับไปหน้าประวัติ
          </button>
        </div>
      </div>
    );
  }

  const valueColor = getValueColor(sample.status);

  return (
    <div className="min-h-dvh w-full bg-surface-muted pb-10 transition-colors duration-300">
      <div className="w-full max-w-3xl mx-auto px-5 sm:px-8 lg:px-0 py-6 sm:py-10 space-y-5">
        <div className="bg-surface px-5 py-5 sm:px-6 rounded-3xl border border-border shadow-sm">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary active:scale-95 text-xs font-bold mb-5 transition-all bg-surface-subtle border border-border py-1.5 px-3.5 rounded-full w-fit cursor-pointer"
          >
            <ArrowLeft size={13} />
            ย้อนกลับ
          </button>

          <div className="flex items-center justify-between gap-3 rounded-2xl bg-surface-subtle border border-border px-4 py-3">
            <div className="flex items-center gap-2 min-w-0">
              <MapPin size={14} className="text-primary flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[9px] font-mono font-black uppercase tracking-[0.14em] text-text-muted">
                  ประวัติผู้เก็บตัวอย่าง
                </p>
                <h1 className="text-sm sm:text-base font-black text-text-primary truncate">
                  {sample.location.name}
                </h1>
              </div>
            </div>
            <StatusBadge status={sample.status} size="sm" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
            <div className="flex items-center gap-2 text-xs text-text-secondary bg-surface border border-border rounded-2xl px-4 py-3">
              <Calendar size={13} className="text-primary" />
              <span className="font-bold">{formatDateTime(sample.collectionTime)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-text-secondary bg-surface border border-border rounded-2xl px-4 py-3">
              <User size={13} className="text-primary" />
              <span className="font-bold truncate">{sample.collector.name}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-text-secondary bg-surface border border-border rounded-2xl px-4 py-3">
              <Clock size={13} className="text-primary" />
              <span className="font-bold">{formatDateTime(sample.uploadedAt)}</span>
            </div>
          </div>
        </div>

        {sample.imageUrl && (
          <div className="bg-surface rounded-3xl shadow-sm border border-border overflow-hidden p-2">
            <img
              src={sample.imageUrl}
              alt="ภาพตัวอย่างน้ำ"
              className="w-full h-52 sm:h-72 object-cover rounded-2xl bg-surface-subtle"
            />
          </div>
        )}

        <div className="bg-surface rounded-3xl shadow-sm border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center">
              <CheckCircle2 size={13} />
            </div>
            <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">
              Overall Analysis Results
            </h2>
          </div>
          <div className="bg-surface-subtle border border-border rounded-2xl p-5 text-center">
            <span className="font-mono text-[9px] font-bold text-text-muted uppercase tracking-wider mb-2.5 block">
              สถานะคุณภาพน้ำโดยรวม
            </span>
            <div className="inline-flex">
              <StatusBadge status={sample.status} size="lg" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-surface rounded-2xl p-5 shadow-sm border border-border flex flex-col justify-between min-h-32">
            <div className="flex items-center gap-1.5 mb-3">
              <div className="bg-primary-light p-1.5 rounded-xl border border-primary/10">
                <FlaskConical size={13} className="text-primary" />
              </div>
              <div className="font-mono text-[9px] font-bold text-text-muted uppercase tracking-wider">
                Phosphate
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <div className={`text-2xl sm:text-3xl font-black ${valueColor}`}>
                {sample.phosphate.toFixed(3)}
              </div>
              <span className="font-mono text-[9px] font-bold text-text-muted">mg/L</span>
            </div>
          </div>

          <div className="bg-surface rounded-2xl p-5 shadow-sm border border-border flex flex-col justify-between min-h-32">
            <div className="flex items-center gap-1.5 mb-3">
              <div className="bg-purple-50 dark:bg-purple-950/20 p-1.5 rounded-xl border border-purple-100/10">
                <FlaskConical size={13} className="text-purple-500" />
              </div>
              <div className="font-mono text-[9px] font-bold text-text-muted uppercase tracking-wider">
                Ammonia
              </div>
            </div>
            <div className="flex items-baseline gap-1">
              <div className={`text-2xl sm:text-3xl font-black ${valueColor}`}>
                {sample.ammonia.toFixed(3)}
              </div>
              <span className="font-mono text-[9px] font-bold text-text-muted">mg/L</span>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-3xl shadow-sm border border-border p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-6 h-6 bg-primary-light text-primary rounded-xl flex items-center justify-center border border-primary/10">
              <FlaskConical size={13} />
            </div>
            <h2 className="text-xs font-bold text-text-primary uppercase tracking-wider font-mono">
              Optional Meteorological Inputs
            </h2>
          </div>

          <div className="space-y-3">
            <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider block">
              ปริมาณออกซิเจนละลายน้ำ (Dissolved Oxygen - DO)
            </label>
            <div className="flex items-center justify-between gap-3 w-full px-5 py-3.5 bg-surface-subtle border border-border text-text-primary rounded-2xl min-h-[48px]">
              <span className={`text-sm font-black ${sample.oxygen === null ? 'text-text-muted' : 'text-text-primary'}`}>
                {sample.oxygen === null ? 'ไม่ได้ระบุ' : sample.oxygen.toFixed(2)}
              </span>
              <span className="font-mono text-[9px] font-bold text-text-muted">mL/L</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="bg-surface-subtle border border-border rounded-2xl p-4">
                <div className="flex items-center gap-2 text-[9px] text-text-muted font-black uppercase tracking-wider">
                  <Thermometer size={12} className="text-primary" />
                  Temperature
                </div>
                <p className="text-sm font-black text-text-primary mt-2">
                  {sample.temperature === null ? '-' : `${sample.temperature.toFixed(1)} C`}
                </p>
              </div>
              <div className="bg-surface-subtle border border-border rounded-2xl p-4">
                <div className="flex items-center gap-2 text-[9px] text-text-muted font-black uppercase tracking-wider">
                  <CloudRain size={12} className="text-primary" />
                  Rain
                </div>
                <p className="text-sm font-black text-text-primary mt-2">
                  {sample.rainVolume === null ? '-' : `${sample.rainVolume.toFixed(1)} mm`}
                </p>
              </div>
              <div className="bg-surface-subtle border border-border rounded-2xl p-4">
                <div className="flex items-center gap-2 text-[9px] text-text-muted font-black uppercase tracking-wider">
                  <Waves size={12} className="text-primary" />
                  Weather
                </div>
                <p className="text-xs font-black text-text-primary mt-2 truncate" title={formatWeatherCondition(sample.weatherCondition)}>
                  {formatWeatherCondition(sample.weatherCondition)}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-3xl shadow-sm border border-border p-5">
          <h3 className="text-xs font-bold text-text-secondary mb-4 flex items-center gap-2">
            <ShieldCheck size={15} className="text-primary" />
            การประเมินเทียบเกณฑ์มาตรฐานคุณภาพน้ำทะเล
          </h3>
          <div className="grid grid-cols-1 gap-2.5">
            {standardsEvaluation.map((std) => (
              <div
                key={std.type}
                className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold border transition-all ${
                  std.passed
                    ? 'bg-emerald-50/40 dark:bg-emerald-950/15 text-emerald-800 dark:text-emerald-300 border-emerald-500/20 shadow-sm'
                    : 'bg-red-50/40 dark:bg-red-950/15 text-red-800 dark:text-red-300 border-red-500/20 shadow-sm'
                }`}
              >
                {std.passed ? (
                  <ShieldCheck size={15} className="text-emerald-500 flex-shrink-0" />
                ) : (
                  <ShieldX size={15} className="text-red-500 flex-shrink-0" />
                )}
                <span className="flex-1 truncate">{std.label}</span>
                <span
                  className={`font-mono text-[9px] font-black px-2 py-0.5 rounded-lg border flex-shrink-0 ${
                    std.passed
                      ? 'bg-emerald-100/70 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200/50 dark:border-emerald-800/30'
                      : 'bg-red-100/70 dark:bg-red-950/40 text-red-600 dark:text-red-400 border-red-200/50 dark:border-red-800/30'
                  }`}
                >
                  {std.passed ? 'ปลอดภัย' : 'ไม่ผ่าน'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
