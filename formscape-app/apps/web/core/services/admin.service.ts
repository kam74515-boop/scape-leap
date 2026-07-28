import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";
import { AuthService } from "@/services/auth.service";

export type AdminRole = "owner" | "admin" | "member" | "viewer";

export type AdminUser = {
  id: string;
  email: string;
  display_name: string;
  first_name: string;
  last_name: string;
  role: AdminRole;
  is_active: boolean;
  is_email_verified: boolean;
  must_change_password: boolean;
  failed_login_attempts: number;
  locked_until: string | null;
  last_login_at: string | null;
  date_joined: string;
  active_sessions: number;
};

export type AdminOverview = {
  users: { total: number; active: number; admins: number };
  sessions: { active: number };
  audit: { last_24h: number };
  database: {
    name: string;
    bytes: number;
    version: string;
    extensions: { extname: string; extversion: string }[];
  };
  entities: Record<string, number>;
  auth: {
    signup_enabled: boolean;
    smtp_configured: boolean;
    session_ttl_days: number;
  };
};

export type AuditLog = {
  id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  actor_email: string | null;
  actor_name: string | null;
  created_at: string;
};

export class AdminService extends APIService {
  private authService = new AuthService();

  constructor() {
    super(API_BASE_URL);
  }

  private async csrfHeaders() {
    const { csrf_token } = await this.authService.requestCSRFToken();
    return { "X-CSRFTOKEN": csrf_token };
  }

  async overview(): Promise<AdminOverview> {
    return this.get("/api/admin/overview/").then((response) => response.data);
  }

  async users(): Promise<AdminUser[]> {
    return this.get("/api/admin/users/").then((response) => response.data.users);
  }

  async auditLogs(): Promise<AuditLog[]> {
    return this.get("/api/admin/audit-logs/").then((response) => response.data.logs);
  }

  async createUser(data: { email: string; display_name: string; role: AdminRole }) {
    return this.post("/api/admin/users/", data, { headers: await this.csrfHeaders() }).then(
      (response) => response.data as { user: AdminUser; temporary_password: string }
    );
  }

  async updateUser(userId: string, data: Partial<Pick<AdminUser, "display_name" | "role" | "is_active">>) {
    return this.patch(`/api/admin/users/${userId}/`, data, { headers: await this.csrfHeaders() }).then(
      (response) => response.data as { user: AdminUser }
    );
  }

  async resetPassword(userId: string) {
    return this.post(`/api/admin/users/${userId}/reset-password/`, {}, { headers: await this.csrfHeaders() }).then(
      (response) => response.data as { temporary_password: string }
    );
  }

  async revokeSessions(userId: string) {
    return this.post(`/api/admin/users/${userId}/sessions/revoke/`, {}, { headers: await this.csrfHeaders() }).then(
      (response) => response.data as { revoked: number }
    );
  }
}
