import { useNavigate } from 'react-router-dom';
import type { Event } from '@shared/types';
import { StatusBadge } from '@/shared/components/ui/StatusBadge';

const TYPE_LABEL: Record<Event['type'], string> = {
  popup:   '팝업',
  collab:  '콜라보',
  goods:   '굿즈',
  limited: '한정',
};

function dday(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (diff < 0)  return '';
  if (diff === 0) return 'D-DAY';
  return `D-${diff}`;
}

interface Props { event: Event; }

export function EventCard({ event }: Props) {
  const navigate = useNavigate();
  const end = dday(event.endDate);

  return (
    <article
      onClick={() => navigate(`/events/${event.id}`)}
      className="flex cursor-pointer gap-3 rounded-xl bg-white p-3 shadow-sm active:bg-gray-50"
    >
      {/* 타입 아이콘 영역 */}
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-2xl">
        {event.type === 'popup' ? '🏪' : event.type === 'collab' ? '🤝' : event.type === 'goods' ? '🎁' : '⭐'}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <StatusBadge status={event.status} />
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-500">
            {TYPE_LABEL[event.type]}
          </span>
          {end && event.status !== 'ended' && (
            <span className="ml-auto text-xs font-bold text-red-500">{end}</span>
          )}
        </div>
        <p className="truncate text-sm font-semibold text-gray-900">{event.title}</p>
        <p className="truncate text-xs text-gray-400">{event.place}</p>
        {event.startDate && event.endDate && (
          <p className="text-xs text-gray-400">
            {event.startDate} ~ {event.endDate}
          </p>
        )}
      </div>
    </article>
  );
}
