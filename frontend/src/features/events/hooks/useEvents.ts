import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/client';
import type { Event, EventFilter, PaginatedResult } from '@shared/types';

export const eventKeys = {
  all:      ['events'] as const,
  filtered: (f: Partial<EventFilter>) => ['events', f] as const,
  detail:   (id: string) => ['events', id] as const,
};

export function useEvents(filter: Partial<EventFilter> = {}) {
  return useQuery({
    queryKey: eventKeys.filtered(filter),
    queryFn:  async () => {
      const { data } = await apiClient.get<PaginatedResult<Event>>('/events', { params: filter });
      return data;
    },
  });
}

export function useEvent(id: string) {
  return useQuery({
    queryKey: eventKeys.detail(id),
    queryFn:  async () => {
      const { data } = await apiClient.get<{ success: boolean; data: Event }>(`/events/${id}`);
      return data.data;
    },
    enabled: !!id,
  });
}
