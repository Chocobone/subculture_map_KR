import type { EventStatus } from '@shared/types';

const CONFIG: Record<EventStatus, { label: string; className: string }> = {
  ongoing:  { label: '진행중', className: 'bg-green-100 text-green-700' },
  upcoming: { label: '예정',   className: 'bg-blue-100  text-blue-700'  },
  ended:    { label: '종료',   className: 'bg-gray-100  text-gray-500'  },
};

export function StatusBadge({ status }: { status: EventStatus }) {
  const { label, className } = CONFIG[status];
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
