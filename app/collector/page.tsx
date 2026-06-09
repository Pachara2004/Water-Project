'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { Camera, FileText, FlaskConical, MapPin, Calendar } from 'lucide-react';
import StatusBadge from '@/components/StatusBadge';

interface CollectorSample {
  id: string;
  locationId: string;
  status: 'SAFE' | 'WARNING' | 'DANGER';
  collectedAt: string | Date;
  collectedBy: string;
  imageUrl?: string | null;
  phosphateVal?: number | null;
  ammoniaVal?: number | null;
  location?: {
    id: string;
    name: string;
    organization: string;
  } | null;
}

export default function CollectorDashboard() {
  const { currentUser } = useAppStore();
  const router = useRouter();
  const [samples, setSamples] = useState<CollectorSample[]>([]);
  const [loading, setLoading] = useState(true);
  const [showOnlyMine, setShowOnlyMine] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role !== 'COLLECTOR' && currentUser.role !== 'ADMIN') {
      router.push('/map');
      return;
    }

    fetch('/api/samples')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          const mapped = data.map((s: {
            id: string;
            locationId: string;
            status: 'SAFE' | 'WARNING' | 'DANGER';
            collectionTime: string;
            collectorId: string;
            imageUrl?: string | null;
            phosphate?: number | null;
            ammonia?: number | null;
            location?: {
              name: string;
              agency: string;
            } | null;
          }) => ({
            id: s.id,
            locationId: s.locationId,
            status: s.status,
            collectedAt: s.collectionTime,
            collectedBy: s.collectorId,
            imageUrl: s.imageUrl,
            phosphateVal: s.phosphate,
            ammoniaVal: s.ammonia,
            location: s.location ? {
              id: s.locationId,
              name: s.location.name,
              organization: s.location.agency
            } : null
          }));
          setSamples(mapped);
        } else {
          setSamples([]);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [currentUser, router]);

  if (loading) {
    return (
      <div className="min-h-dvh bg-surface-muted pb-10 w-full p-5 sm:p-8 space-y-6">
        <div className="w-full h-56 rounded-3xl shimmer border border-border" />
        <div className="w-1/2 h-6 rounded-lg shimmer border border-border mt-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="w-full h-24 rounded-2xl bg-surface shimmer border border-border flex p-4 gap-4">
              <div className="w-16 h-16 rounded-xl bg-surface-subtle flex-shrink-0" />
              <div className="flex-1 space-y-2 mt-1">
                <div className="w-1/3 h-4 bg-surface-subtle rounded-md" />
                <div className="w-2/3 h-5 bg-surface-subtle rounded-md" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const mySamples = samples.filter((s) => s.collectedBy === currentUser?.id);

  return (
    <div className="min-h-dvh w-full bg-surface-muted pb-10
                    relative transition-colors duration-300">

      {/* Centred content wrapper — background fills full-width, content stays readable */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12">

      {/* Header */}
      <div className="pt-6 sm:pt-10 pb-4">
        <div className="relative w-full rounded-3xl overflow-hidden bg-surface text-text-primary
                        p-8 sm:p-10 shadow-sm border border-border transition-all duration-300">

          <div className="relative flex items-center justify-between mb-6 sm:mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-subtle px-3.5 py-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              <span className="font-mono text-[9px] sm:text-[10px] uppercase tracking-[0.15em] text-text-secondary font-bold">
                Collector Hub
              </span>
            </div>
            <div className="flex items-center gap-1.5 bg-surface-subtle px-3 py-1 rounded-full border border-border">
              <span className="text-[9px] text-text-muted font-bold uppercase tracking-wider">ส่งแล้ว</span>
              <span className="text-sm font-black text-text-primary">{mySamples.length} ครั้ง</span>
            </div>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-wide leading-tight mb-3 text-text-primary">
            ศูนย์ข้อมูล <span className="text-primary font-bold">ผู้เก็บตัวอย่างน้ำ</span>
          </h1>
          <p className="text-text-secondary text-xs sm:text-sm max-w-[90%] leading-loose mb-8 sm:mb-10">
            อัปโหลดและรายงานผลการวิเคราะห์คุณภาพน้ำทะเลชายฝั่ง
          </p>

          <button
            onClick={() => router.push('/submit')}
            className="w-full sm:w-auto py-4 px-8 min-h-[52px]
                       bg-primary hover:bg-navy-dark text-white
                       font-bold rounded-2xl flex items-center justify-center gap-2.5
                       shadow-sm transition-all duration-300 cursor-pointer group text-sm sm:text-base"
          >
            <Camera size={17} className="transition-transform group-hover:rotate-12 group-hover:scale-110" />
            ถ่ายรูปส่งตัวอย่างใหม่
          </button>
        </div>
      </div>

      {/* History list */}
      <div className="px-5 sm:px-8 mt-8 sm:mt-10 space-y-6 sm:space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-1">
          <div className="inline-flex items-center gap-2">
            <FileText size={16} className="text-primary" />
            <h2 className="font-mono text-[10px] sm:text-xs uppercase tracking-[0.15em] text-text-secondary font-bold">
              Submission History
            </h2>
          </div>

          {/* iOS-Style Toggle: ดูเฉพาะข้อมูลของฉัน */}
          <div className="flex items-center gap-3 bg-surface border border-border px-4 py-2 rounded-2xl shadow-xs transition-colors duration-200">
            <span className="text-xs font-bold text-text-secondary">ดูเฉพาะข้อมูลของฉัน</span>
            <button
              onClick={() => setShowOnlyMine(!showOnlyMine)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out outline-none ${
                showOnlyMine ? 'bg-primary' : 'bg-border'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                  showOnlyMine ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {(() => {
          const displayedSamples = showOnlyMine
            ? samples.filter((s) => s.collectedBy === currentUser?.id)
            : samples;

          if (displayedSamples.length === 0) {
            return (
              <div className="text-center p-10 sm:p-12 bg-surface rounded-3xl shadow-md border border-border flex flex-col items-center">
                <div className="w-16 h-16 bg-surface-subtle rounded-2xl flex items-center justify-center mb-6 border border-border">
                  <FileText size={24} className="text-text-muted" />
                </div>
                <p className="text-text-primary font-bold mb-3 text-sm sm:text-base">
                  {showOnlyMine ? 'คุณยังไม่มีประวัติการส่งข้อมูล' : 'ยังไม่มีประวัติการส่งข้อมูลในระบบ'}
                </p>
                <p className="text-xs sm:text-sm text-text-secondary mb-8 max-w-[80%] leading-loose">
                  เริ่มต้นส่งภาพชุดทดสอบคุณภาพน้ำเพื่อตรวจระดับฟอสเฟตและแอมโมเนีย
                </p>
                <button
                  onClick={() => router.push('/submit')}
                  className="px-6 py-3 min-h-[48px] bg-primary hover:bg-navy-dark text-white rounded-xl text-sm font-bold transition-all shadow-sm cursor-pointer flex items-center gap-2"
                >
                  <Camera size={14} />
                  ส่งผลตรวจครั้งแรก
                </button>
              </div>
            );
          }

          return (
            /* 1-col mobile → 2-col sm → 3-col lg */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {displayedSamples.map((sample) => (
                <div
                  key={sample.id}
                  className="bg-surface rounded-2xl p-4 sm:p-5 shadow-md hover:shadow-xl border border-border
                             flex gap-4 items-center transition-all duration-300
                             hover:scale-[1.01] active:scale-[0.99] cursor-pointer group"
                  onClick={() => router.push(`/submit?locationId=${sample.location?.id}`)}
                >
                  {sample.imageUrl ? (
                    <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl overflow-hidden bg-surface-subtle border border-border flex-shrink-0 relative">
                      <img src={sample.imageUrl} alt="sample image" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 sm:w-18 sm:h-18 bg-primary-light dark:bg-surface-subtle rounded-xl flex items-center justify-center border border-border flex-shrink-0">
                      <FlaskConical size={20} className="text-primary" />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs text-text-secondary font-bold mb-2 truncate">
                      <MapPin size={12} className="text-primary flex-shrink-0" />
                      {sample.location?.name || 'ไม่ทราบสถานที่'}
                    </div>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <StatusBadge status={sample.status} size="sm" />
                      <div className="flex items-center gap-1 text-[10px] text-text-muted font-bold">
                        <Calendar size={10} />
                        {new Date(sample.collectedAt).toLocaleDateString('th-TH', {
                          day: 'numeric',
                          month: 'short',
                          year: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>

      </div> {/* end inner content wrapper */}
    </div>
  );
}
