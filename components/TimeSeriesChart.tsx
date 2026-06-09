'use client';

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

export interface TimeSeriesDataPoint {
  date: string;
  phosphate: number;
  ammonia: number;
}

interface TimeSeriesChartProps {
  data: TimeSeriesDataPoint[];
}

export default function TimeSeriesChart({ data }: TimeSeriesChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 bg-gray-50 rounded-lg text-gray-400">
        ไม่มีข้อมูลย้อนหลัง
      </div>
    );
  }

  return (
    <div className="w-full h-64 mt-5 p-4 bg-surface-subtle/50 rounded-2xl border border-border/40">
      <h3 className="text-sm font-bold text-text-secondary mb-3 px-1">แนวโน้มคุณภาพน้ำ (ย้อนหลัง)</h3>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{
            top: 5,
            right: 10,
            left: -20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }} 
            tickMargin={10}
            stroke="#9ca3af"
          />
          <YAxis 
            tick={{ fontSize: 12 }}
            stroke="#9ca3af"
            axisLine={false}
            tickLine={false}
          />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Legend wrapperStyle={{ fontSize: '12px' }} />
          <Line 
            type="monotone" 
            name="ฟอสเฟต (PO4)"
            dataKey="phosphate" 
            stroke="#3b82f6" 
            strokeWidth={2}
            dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }}
            activeDot={{ r: 6 }} 
          />
          <Line 
            type="monotone" 
            name="แอมโมเนีย (NH3)"
            dataKey="ammonia" 
            stroke="#ef4444" 
            strokeWidth={2}
            dot={{ r: 4, fill: '#ef4444', strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
