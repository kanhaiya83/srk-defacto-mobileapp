/** Actions that can be permitted on a module. Mirrors the server registry. */
export type Action = 'read' | 'create' | 'update' | 'delete';

export type ModuleCategory = 'master' | 'operation' | 'report' | 'admin';

/** A permission string in `module:action` form, e.g. `vendor:create`. */
export type Permission = string;

export interface AuthRole {
  id: string;
  name: string;
  isSystem: boolean;
}

export interface AuthUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: AuthRole;
  permissions: Permission[];
  isSuperAdmin: boolean;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: string;
  passwordChangedAt?: string;
}

export interface LoginResponse {
  accessToken: string;
  /** Present only on clients that cannot hold the httpOnly refresh cookie. */
  refreshToken?: string;
  user: AuthUser;
  mustChangePassword: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  requestId?: string;
}

export interface Role {
  _id: string;
  name: string;
  description?: string;
  permissions: Permission[];
  isSystem: boolean;
  isActive: boolean;
  userCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ManagedUser {
  _id: string;
  name: string;
  username: string;
  email: string;
  role: { _id: string; name: string; isSystem: boolean } | string;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt?: string;
  passwordChangedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  _id: string;
  user: { _id: string; name: string; username: string } | null;
  username: string;
  action: string;
  module: string;
  modelName: string;
  recordId: string | null;
  previousData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  method?: string;
  path?: string;
  status: 'success' | 'failure';
  message?: string;
  createdAt: string;
}

export interface PermissionModule {
  key: string;
  label: string;
  category: ModuleCategory;
  actions: Action[];
}

export interface Paginated<T> {
  success: boolean;
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
