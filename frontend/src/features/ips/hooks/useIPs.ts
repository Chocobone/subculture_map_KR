import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/shared/api/client';
import type { IP } from '@shared/types';

export const ipKeys = {
  all: ['ips'] as const,
};

export function useIPs() {
  return useQuery({
    queryKey: ipKeys.all,
    queryFn:  async () => {
      const { data } = await apiClient.get<{ success: boolean; data: IP[] }>('/ips');
      return data.data;
    },
  });
}

export function useCreateIP() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; keywords: string[] }) =>
      apiClient.post('/ips', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ipKeys.all }),
  });
}

export function useDeleteIP() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/ips/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ipKeys.all }),
  });
}
