import request, { refreshClient } from "./request";
import type {
  AuditLogEntry,
  AuthUser,
  LoginResponse,
  ManagedUser,
  Paginated,
  PermissionModule,
  Role,
} from "@/types/auth";

/** Server envelope: `{ success, data, ... }`. */
interface Envelope<T> {
  success: boolean;
  data: T;
  message?: string;
  temporaryPassword?: string;
}

// ------------------------------------------------------------------- auth

export const authApi = {
  async login(identifier: string, password: string): Promise<LoginResponse> {
    const { data } = await request.post<Envelope<LoginResponse>>("/api/auth/login", {
      identifier,
      password,
    });
    return data.data;
  },

  /**
   * Uses the bare client so a failure here does not trip the refresh
   * interceptor — on app boot a 401 simply means "no session", not an error.
   */
  async refresh(): Promise<LoginResponse> {
    const { data } = await refreshClient.post<Envelope<LoginResponse>>("/api/auth/refresh");
    return data.data;
  },

  async me(): Promise<AuthUser> {
    const { data } = await request.get<Envelope<AuthUser>>("/api/auth/me");
    return data.data;
  },

  async logout(): Promise<void> {
    await request.post("/api/auth/logout");
  },

  async logoutAll(): Promise<void> {
    await request.post("/api/auth/logout-all");
  },

  async changePassword(payload: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }): Promise<void> {
    await request.post("/api/auth/change-password", payload);
  },

  async forgotPassword(email: string): Promise<string> {
    const { data } = await request.post<{ success: boolean; message: string }>(
      "/api/auth/forgot-password",
      { email }
    );
    return data.message;
  },

  async resetPassword(payload: {
    token: string;
    password: string;
    confirmPassword: string;
  }): Promise<void> {
    await request.post("/api/auth/reset-password", payload);
  },
};

// ------------------------------------------------------------------ users

export interface ListUsersParams {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  isActive?: boolean;
}

export const usersApi = {
  async list(params: ListUsersParams = {}): Promise<Paginated<ManagedUser>> {
    const { data } = await request.get<Paginated<ManagedUser>>("/api/users", { params });
    return data;
  },

  async getById(id: string): Promise<ManagedUser> {
    const { data } = await request.get<Envelope<ManagedUser>>(`/api/users/${id}`);
    return data.data;
  },

  async create(payload: {
    name: string;
    username: string;
    email: string;
    password?: string;
    role: string;
    isActive?: boolean;
    sendWelcomeEmail?: boolean;
  }): Promise<Envelope<ManagedUser>> {
    const { data } = await request.post<Envelope<ManagedUser>>("/api/users", payload);
    return data;
  },

  async update(
    id: string,
    payload: { name?: string; email?: string; role?: string; isActive?: boolean }
  ): Promise<ManagedUser> {
    const { data } = await request.put<Envelope<ManagedUser>>(`/api/users/${id}`, payload);
    return data.data;
  },

  async setStatus(id: string, isActive: boolean): Promise<void> {
    await request.patch(`/api/users/${id}/status`, { isActive });
  },

  async resetPassword(
    id: string,
    payload: { password?: string; notifyUser?: boolean }
  ): Promise<{ message?: string; temporaryPassword?: string }> {
    const { data } = await request.post<Envelope<never>>(`/api/users/${id}/reset-password`, payload);
    return { message: data.message, temporaryPassword: data.temporaryPassword };
  },

  async remove(id: string): Promise<void> {
    await request.delete(`/api/users/${id}`);
  },
};

// ------------------------------------------------------------------ roles

export const rolesApi = {
  async list(): Promise<Role[]> {
    const { data } = await request.get<Envelope<Role[]>>("/api/roles");
    return data.data;
  },

  async getById(id: string): Promise<Role> {
    const { data } = await request.get<Envelope<Role>>(`/api/roles/${id}`);
    return data.data;
  },

  /** Module/action catalogue — drives the role editor's checkbox grid. */
  async catalogue(): Promise<PermissionModule[]> {
    const { data } = await request.get<Envelope<PermissionModule[]>>(
      "/api/roles/permissions/catalogue"
    );
    return data.data;
  },

  async create(payload: {
    name: string;
    description?: string;
    permissions: string[];
    isActive?: boolean;
  }): Promise<Role> {
    const { data } = await request.post<Envelope<Role>>("/api/roles", payload);
    return data.data;
  },

  async update(
    id: string,
    payload: { name?: string; description?: string; permissions?: string[]; isActive?: boolean }
  ): Promise<Role> {
    const { data } = await request.put<Envelope<Role>>(`/api/roles/${id}`, payload);
    return data.data;
  },

  async remove(id: string): Promise<void> {
    await request.delete(`/api/roles/${id}`);
  },
};

// ------------------------------------------------------------- audit logs

export interface ListAuditParams {
  page?: number;
  limit?: number;
  user?: string;
  module?: string;
  action?: string;
  recordId?: string;
  from?: string;
  to?: string;
}

export const auditApi = {
  async list(params: ListAuditParams = {}): Promise<Paginated<AuditLogEntry>> {
    const { data } = await request.get<Paginated<AuditLogEntry>>("/api/audit-logs", { params });
    return data;
  },

  async filters(): Promise<{
    modules: Array<{ key: string; label: string; category: string }>;
    actions: string[];
  }> {
    const { data } = await request.get<
      Envelope<{ modules: Array<{ key: string; label: string; category: string }>; actions: string[] }>
    >("/api/audit-logs/filters");
    return data.data;
  },

  /** Full change history for one record — powers a "history" drawer. */
  async recordHistory(modelName: string, recordId: string): Promise<AuditLogEntry[]> {
    const { data } = await request.get<Envelope<AuditLogEntry[]>>(
      `/api/audit-logs/history/${modelName}/${recordId}`
    );
    return data.data;
  },
};
