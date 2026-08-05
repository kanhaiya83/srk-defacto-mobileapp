import { useCallback } from "react";
import { useAuthStore } from "@/store/auth-store";
import type { Action, Permission } from "@/types/auth";

/**
 * Permission helpers for components.
 *
 * These decide what to *render*. They are a usability layer, not a security
 * boundary — the server independently enforces the same rules, so hiding a
 * button never has to be relied upon for correctness.
 */
export const usePermissions = () => {
  const user = useAuthStore((s) => s.user);

  const can = useCallback(
    (permission: Permission): boolean => {
      if (!user) return false;
      if (user.isSuperAdmin) return true;
      return user.permissions.includes(permission);
    },
    [user]
  );

  const canAny = useCallback(
    (...permissions: Permission[]): boolean => permissions.some(can),
    [can]
  );

  const canAll = useCallback(
    (...permissions: Permission[]): boolean => permissions.every(can),
    [can]
  );

  /** True if the user can do *anything* in a module — used for menu visibility. */
  const canAccessModule = useCallback(
    (moduleKey: string): boolean => {
      if (!user) return false;
      if (user.isSuperAdmin) return true;
      return user.permissions.some((p) => p.startsWith(`${moduleKey}:`));
    },
    [user]
  );

  const actionsFor = useCallback(
    (moduleKey: string): Action[] => {
      if (!user) return [];
      if (user.isSuperAdmin) return ["read", "create", "update", "delete"];
      return user.permissions
        .filter((p) => p.startsWith(`${moduleKey}:`))
        .map((p) => p.split(":")[1] as Action);
    },
    [user]
  );

  return {
    user,
    can,
    canAny,
    canAll,
    canAccessModule,
    actionsFor,
    isSuperAdmin: Boolean(user?.isSuperAdmin),
  };
};

/**
 * Convenience hook for a single module's CRUD flags, which is what a typical
 * Master/Operation page needs:
 *
 *   const { canCreate, canUpdate, canDelete } = useModulePermissions("vendor");
 */
export const useModulePermissions = (moduleKey: string) => {
  const { can, canAccessModule } = usePermissions();

  return {
    canRead: can(`${moduleKey}:read`),
    canCreate: can(`${moduleKey}:create`),
    canUpdate: can(`${moduleKey}:update`),
    canDelete: can(`${moduleKey}:delete`),
    hasAnyAccess: canAccessModule(moduleKey),
  };
};
