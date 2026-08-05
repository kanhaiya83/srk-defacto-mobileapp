import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/components/ui/toast";
import { auditApi, rolesApi, usersApi, type ListAuditParams, type ListUsersParams } from "./auth-api";
import { getErrorMessage } from "./request";

/**
 * React Query bindings for the administration modules, following the same
 * pattern as the existing masters-api / operations-api hooks.
 */

const keys = {
  users: (params?: ListUsersParams) => ["users", params] as const,
  user: (id: string) => ["users", id] as const,
  roles: () => ["roles"] as const,
  catalogue: () => ["roles", "catalogue"] as const,
  audit: (params?: ListAuditParams) => ["audit-logs", params] as const,
  auditFilters: () => ["audit-logs", "filters"] as const,
  recordHistory: (model: string, id: string) => ["audit-logs", "history", model, id] as const,
};

const onError = (fallback: string) => (error: unknown) =>
  toast.error(getErrorMessage(error, fallback));

// ------------------------------------------------------------------ users

export const useUsers = (params: ListUsersParams = {}) =>
  useQuery({ queryKey: keys.users(params), queryFn: () => usersApi.list(params) });

export const useUser = (id: string | null) =>
  useQuery({
    queryKey: keys.user(id ?? ""),
    queryFn: () => usersApi.getById(id!),
    enabled: Boolean(id),
  });

export const useCreateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User created");
    },
    onError: onError("Failed to create user"),
  });
};

export const useUpdateUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof usersApi.update>[1] }) =>
      usersApi.update(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User updated");
    },
    onError: onError("Failed to update user"),
  });
};

export const useSetUserStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      usersApi.setStatus(id, isActive),
    onSuccess: (_data, variables) => {
      void qc.invalidateQueries({ queryKey: ["users"] });
      toast.success(variables.isActive ? "User activated" : "User deactivated");
    },
    onError: onError("Failed to update user status"),
  });
};

export const useResetUserPassword = () =>
  useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { password?: string; notifyUser?: boolean } }) =>
      usersApi.resetPassword(id, payload),
    onError: onError("Failed to reset password"),
  });

export const useDeleteUser = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: usersApi.remove,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User deleted");
    },
    onError: onError("Failed to delete user"),
  });
};

// ------------------------------------------------------------------ roles

export const useRoles = () => useQuery({ queryKey: keys.roles(), queryFn: rolesApi.list });

export const usePermissionCatalogue = () =>
  useQuery({
    queryKey: keys.catalogue(),
    queryFn: rolesApi.catalogue,
    // The module registry only changes on deploy, so this is effectively static.
    staleTime: 1000 * 60 * 30,
  });

export const useCreateRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: rolesApi.create,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.roles() });
      toast.success("Role created");
    },
    onError: onError("Failed to create role"),
  });
};

export const useUpdateRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Parameters<typeof rolesApi.update>[1] }) =>
      rolesApi.update(id, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.roles() });
      toast.success("Role updated", {
        description: "Affected users will be signed out so new permissions apply.",
      });
    },
    onError: onError("Failed to update role"),
  });
};

export const useDeleteRole = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: rolesApi.remove,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: keys.roles() });
      toast.success("Role deleted");
    },
    onError: onError("Failed to delete role"),
  });
};

// ------------------------------------------------------------- audit logs

export const useAuditLogs = (params: ListAuditParams = {}) =>
  useQuery({ queryKey: keys.audit(params), queryFn: () => auditApi.list(params) });

export const useAuditFilters = () =>
  useQuery({ queryKey: keys.auditFilters(), queryFn: auditApi.filters, staleTime: 1000 * 60 * 30 });

export const useRecordHistory = (modelName: string | null, recordId: string | null) =>
  useQuery({
    queryKey: keys.recordHistory(modelName ?? "", recordId ?? ""),
    queryFn: () => auditApi.recordHistory(modelName!, recordId!),
    enabled: Boolean(modelName && recordId),
  });
