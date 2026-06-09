import { getStatusLabel } from '@/lib/standards';

interface StatusBadgeProps {
  status: 'SAFE' | 'WARNING' | 'DANGER' | null;
  size?: 'sm' | 'md' | 'lg';
}

const statusStyles = {
  SAFE: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
  WARNING: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
  DANGER: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
};

const dotStyles = {
  SAFE: 'bg-emerald-500',
  WARNING: 'bg-amber-500',
  DANGER: 'bg-red-500',
};

const sizeStyles = {
  sm: 'text-[10px] px-2.5 py-1 gap-1.5',
  md: 'text-xs px-3.5 py-1.5 gap-2',
  lg: 'text-sm px-4.5 py-2.5 gap-2.5',
};

const dotSizes = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-2.5 h-2.5',
};

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  if (!status) {
    return (
      <span className={`inline-flex items-center rounded-full border font-medium bg-gray-50 text-gray-500 border-gray-200 ${sizeStyles[size]}`}>
        <span className={`rounded-full bg-gray-400 ${dotSizes[size]}`} />
        ไม่มีข้อมูล
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center rounded-full border font-bold ${statusStyles[status]} ${sizeStyles[size]}`}>
      <span className={`rounded-full ${dotStyles[status]} ${dotSizes[size]}`} />
      {getStatusLabel(status)}
    </span>
  );
}
