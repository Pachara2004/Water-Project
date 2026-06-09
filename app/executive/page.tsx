'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import AnalyticsCharts, { SampleItem } from '@/components/AnalyticsCharts';

export default function ExecutiveDashboard() {
  const { currentUser } = useAppStore();
  const router = useRouter();
  const [samples, setSamples] = useState<SampleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role !== 'EXECUTIVE' && currentUser.role !== 'ADMIN' && currentUser.role !== 'COLLECTOR') {
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
            phosphate?: number | null;
            ammonia?: number | null;
            rainVolume?: number | null;
            weatherCondition?: number | null;
            location?: {
              name: string;
              agency: string;
            } | null;
          }) => ({
            id: s.id,
            locationId: s.locationId,
            status: s.status,
            collectedAt: s.collectionTime,
            phosphateVal: s.phosphate,
            ammoniaVal: s.ammonia,
            rainVolume: s.rainVolume,
            weatherCondition: s.weatherCondition,
            location: s.location ? {
              id: s.locationId,
              name: s.location.name,
              organization: s.location.agency,
            } : undefined
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
        <div className="w-full h-52 rounded-3xl shimmer border border-border" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="w-full h-24 rounded-2xl bg-surface shimmer border border-border" />
          ))}
        </div>
        <div className="w-full h-64 rounded-3xl shimmer border border-border" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh w-full bg-surface-muted pb-10
                    relative transition-colors duration-300">

      {/* Centred content wrapper */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-8 lg:px-12">

      {/* Header */}
      <div className="pt-6 sm:pt-10 pb-4">
        <div className="relative w-full rounded-3xl overflow-hidden bg-surface text-text-primary
                        p-8 sm:p-10 shadow-sm border border-border transition-all duration-300">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-wide leading-tight mb-3 text-text-primary">
            ระบบวิเคราะห์และติดตาม <span className="text-primary font-bold">คุณภาพน้ำทะเล</span>
          </h1>
          <p className="text-text-secondary text-xs sm:text-sm max-w-[85%] leading-loose">
            ศูนย์ข้อมูลคุณภาพสารเคมีแบบเรียลไทม์ และสถิติความแปรปรวนเชิงลึกเพื่อการเฝ้าระวังทางสิ่งแวดล้อม
          </p>
        </div>
      </div>

      <div className="px-5 sm:px-8 mt-4 sm:mt-5">
        <AnalyticsCharts samples={samples} />
      </div>

      </div> {/* end inner content wrapper */}
    </div>
  );
}

