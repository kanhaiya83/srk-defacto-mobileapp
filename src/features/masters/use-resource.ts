import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import request from '@/api/request';

/**
 * Generic REST bindings for the master collections.
 *
 * Every master endpoint is a plain `/api/{resource}` CRUD surface, so one set
 * of hooks serves all fifteen. The query key is the bare resource name — the
 * same key the entity-specific hooks in `masters-api.ts` use — so a create here
 * refreshes a picker elsewhere without either side knowing about the other.
 */

export type MasterRecord = Record<string, unknown> & { _id: string; createdAt?: string; updatedAt?: string };

export const useResourceList = <T = MasterRecord>(resource: string, enabled = true) =>
  useQuery({
    queryKey: [resource],
    queryFn: () => request.get<T[]>(`/api/${resource}`).then((res) => res.data),
    enabled,
  });

export const useResourceItem = <T = MasterRecord>(resource: string, id?: string | null) =>
  useQuery({
    queryKey: [resource, id],
    queryFn: () => request.get<T>(`/api/${resource}/${id}`).then((res) => res.data),
    enabled: Boolean(id) && id !== 'new',
  });

export const useCreateResource = (resource: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      request.post(`/api/${resource}`, payload).then((res) => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [resource] }),
  });
};

export const useUpdateResource = (resource: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Record<string, unknown> }) =>
      request.put(`/api/${resource}/${id}`, payload).then((res) => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [resource] }),
  });
};

export const useDeleteResource = (resource: string) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => request.delete(`/api/${resource}/${id}`).then((res) => res.data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [resource] }),
  });
};
