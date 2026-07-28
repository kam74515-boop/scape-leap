/**
 * 无 Docker Mock API — 本地已登录用户 + 工作区 formscape。
 * 监听 :8000；Vite 将 /api /auth 代理到此
 */
import http from "node:http";
import { handleFsRequest } from "./fs-routes.mjs";
import { handlePortalRequest } from "./portal-routes.mjs";

const PORT = Number(process.env.PLANE_MOCK_API_PORT || 8000);
const HOST = process.env.PLANE_MOCK_API_HOST || "0.0.0.0";
const PUBLIC_URL = (process.env.SCAPELEAP_PUBLIC_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");

const USER = {
  id: "user-local-1",
  avatar_url: "",
  cover_image_url: null,
  cover_image: null,
  date_joined: "2024-01-01T00:00:00.000Z",
  display_name: "林设计师",
  email: "designer@formscape.local",
  first_name: "林",
  last_name: "设计师",
  is_active: true,
  is_bot: false,
  is_email_verified: true,
  is_password_autoset: false,
  is_tour_completed: true,
  mobile_number: null,
  last_workspace_id: "ws-demo",
  user_timezone: "Asia/Shanghai",
  username: "designer",
  last_login_medium: "email",
  theme: {
    theme: "light",
    primary: "",
    background: "",
    darkPalette: false,
  },
};

const WORKSPACE = {
  id: "ws-demo",
  name: "构境工作室",
  slug: "formscape",
  url: `${PUBLIC_URL}/formscape`,
  logo_url: null,
  total_members: 1,
  total_issues: 0,
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
  created_by: USER.id,
  updated_by: USER.id,
  organization_size: "1-10",
  total_projects: 3,
  role: 20,
  timezone: "Asia/Shanghai",
  owner: USER,
};

const PROFILE = {
  id: "profile-local-1",
  user: USER.id,
  role: "Founder",
  last_workspace_id: WORKSPACE.id,
  theme: {
    theme: "light",
    primary: "",
    background: "",
    darkPalette: false,
  },
  onboarding_step: {
    workspace_join: true,
    profile_complete: true,
    workspace_create: true,
    workspace_invite: true,
  },
  is_onboarded: true,
  is_tour_completed: true,
  use_case: "design",
  billing_address_country: null,
  billing_address: null,
  has_billing_address: false,
  has_marketing_email_consent: false,
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
  language: "zh-CN",
  start_of_the_week: 0,
};

const SETTINGS = {
  id: "settings-local-1",
  email: USER.email,
  workspace: {
    last_workspace_id: WORKSPACE.id,
    last_workspace_slug: WORKSPACE.slug,
    last_workspace_name: WORKSPACE.name,
    last_workspace_logo: null,
    fallback_workspace_id: WORKSPACE.id,
    fallback_workspace_slug: WORKSPACE.slug,
    invites: 0,
  },
};

const INSTANCE = {
  id: "mock-instance",
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
  instance_name: "构境AI",
  whitelist_emails: null,
  instance_id: "formscape-local",
  license_key: null,
  current_version: "1.3.1",
  latest_version: "1.3.1",
  last_checked_at: "2024-01-01T00:00:00.000Z",
  namespace: "formscape",
  is_telemetry_enabled: false,
  is_support_required: false,
  is_activated: true,
  is_setup_done: true,
  is_signup_screen_visited: true,
  user_count: 1,
  is_verified: true,
  created_by: null,
  updated_by: null,
  workspaces_exist: true,
};

const CONFIG = {
  enable_signup: true,
  is_workspace_creation_disabled: false,
  is_google_enabled: false,
  is_github_enabled: false,
  is_gitlab_enabled: false,
  is_gitea_enabled: false,
  is_magic_login_enabled: false,
  is_email_password_enabled: true,
  github_app_name: null,
  slack_client_id: null,
  posthog_api_key: null,
  posthog_host: null,
  has_unsplash_configured: false,
  has_llm_configured: false,
  file_size_limit: 5242880,
  is_smtp_configured: false,
  app_base_url: PUBLIC_URL,
  space_base_url: `${PUBLIC_URL}/spaces`,
  admin_base_url: `${PUBLIC_URL}/god-mode`,
  is_self_managed: true,
};

const PROJECT = {
  id: "proj-demo-1",
  name: "滨江壹号 · 新婚两居",
  identifier: "BJ",
  description: "",
  description_text: null,
  description_html: null,
  network: 2,
  workspace: WORKSPACE.id,
  workspace_detail: { name: WORKSPACE.name, slug: WORKSPACE.slug, id: WORKSPACE.id },
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
  cover_image: null,
  cover_image_url: null,
  logo_props: { in_use: null, emoji: null },
  emoji: null,
  icon_prop: null,
  // 构境产品 IA：默认只开 work items；设计流程/画布走扩展路由
  module_view: false,
  cycle_view: false,
  issue_views_view: false,
  page_view: false,
  inbox_view: false,
  is_member: true,
  member_role: 20,
  is_deployed: false,
  default_assignee: null,
  project_lead: USER.id,
  estimate: null,
  default_state: null,
  total_members: 1,
  total_cycles: 0,
  total_modules: 0,
  is_issue_type_enabled: false,
  is_time_tracking_enabled: false,
  archive_in: 0,
  close_in: 0,
  sort_order: 1000,
  archived_at: null,
};

const EMPTY_ISSUES = {
  grouped_by: null,
  next_cursor: "1000:0:0",
  prev_cursor: "1000:0:0",
  next_page_results: false,
  prev_page_results: false,
  total_count: 0,
  count: 0,
  total_pages: 0,
  total_results: 0,
  extra_stats: null,
  results: [],
};

const HOME_WIDGETS = [
  { key: "quick_links", name: "Quick Links", is_enabled: true, sort_order: 40000 },
  { key: "recents", name: "Recents", is_enabled: true, sort_order: 30000 },
  { key: "my_stickies", name: "My Stickies", is_enabled: true, sort_order: 20000 },
  { key: "new_at_formscape", name: "New at formscape", is_enabled: true, sort_order: 10000 },
];

const PROJECT_MEMBER_ME = {
  id: "pm-me-1",
  member: USER.id,
  role: 20,
  original_role: 20,
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
  created_by: USER.id,
  updated_by: USER.id,
  project: PROJECT.id,
  workspace: WORKSPACE.id,
  view_props: { filters: {}, display_filters: {}, display_properties: {} },
  default_props: { filters: {}, display_filters: {}, display_properties: {} },
  preferences: {
    pages: { block_display: false },
    navigation: { default_tab: "overview", hide_in_more_menu: [] },
  },
};

const MEMBER_ME = {
  id: "member-me-1",
  member: USER.id,
  role: 20,
  company_role: null,
  created_at: "2024-01-01T00:00:00.000Z",
  updated_at: "2024-01-01T00:00:00.000Z",
  created_by: USER.id,
  updated_by: USER.id,
  workspace: WORKSPACE.id,
  draft_issue_count: 4,
  view_props: {
    filters: {},
    display_filters: {},
    display_properties: {},
  },
  default_props: {
    filters: {},
    display_filters: {},
    display_properties: {},
  },
};

const MEMBER_LIST = [
  {
    id: "member-1",
    member: {
      id: USER.id,
      avatar_url: USER.avatar_url,
      display_name: USER.display_name,
      email: USER.email,
      first_name: USER.first_name,
      last_name: USER.last_name,
      is_bot: false,
    },
    role: 20,
    avatar_url: USER.avatar_url,
    email: USER.email,
    first_name: USER.first_name,
    last_name: USER.last_name,
    display_name: USER.display_name,
    is_active: true,
    joining_date: "2024-01-01T00:00:00.000Z",
  },
];

const SIDEBAR_PREFERENCES = {};

const USER_PROPERTIES = {};

/** CORS: echo request Origin (never *) so credentials work */
function corsHeaders(req) {
  const origin = req.headers.origin || "http://127.0.0.1:3000";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-CSRFToken, X-Requested-With",
    Vary: "Origin",
  };
}

function send(req, res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(data),
    ...corsHeaders(req),
  });
  res.end(data);
}

/** strip trailing slash; keep "/" */
function normalizePath(pathname) {
  return pathname.replace(/\/+$/, "") || "/";
}

function match(path, pattern) {
  const re = new RegExp("^" + pattern.replace(/:[^/]+/g, "[^/]+") + "$");
  return re.test(path);
}

function isIssuesPath(path) {
  return /\/(issues|issues-detail|v2\/issues)(\/|$)/.test(path) && !path.endsWith("/me");
}

function isObjectListPath(path) {
  // 不要把 .../me 当成列表
  if (path.endsWith("/me")) return false;
  return (
    path.includes("/states") ||
    path.includes("/labels") ||
    path.includes("/cycles") ||
    path.includes("/modules") ||
    path.includes("/pages") ||
    path.includes("/views") ||
    path.includes("/inbox") ||
    path.includes("/estimates") ||
    path.includes("/analytics") ||
    path.includes("/notifications") ||
    path.includes("/favorites") ||
    path.includes("/user-favorites") ||
    path.includes("/stickies") ||
    path.includes("/invitations") ||
    (path.includes("/members") && !path.endsWith("/me")) ||
    path.includes("/webhooks") ||
    path.includes("/api-tokens") ||
    path.includes("/exports") ||
    path.includes("/imports")
  );
}

const server = http.createServer((req, res) => {
  const u = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  const path = normalizePath(u.pathname);
  const method = (req.method || "GET").toUpperCase();
  console.log(method, path);

  if (method === "OPTIONS") {
    res.writeHead(204, corsHeaders(req));
    return res.end();
  }

  if (path.startsWith("/api/portal-shares/") || path.startsWith("/api/public/portal/")) {
    return void handlePortalRequest(req, res, path, method);
  }

  // 构境业务数据：SQLite 持久化（真实读写，不再是 accept-all 假写）
  if (path.startsWith("/api/fs/")) {
    return void handleFsRequest(req, res, path, method);
  }

  // Mutations: accept-all
  if (method === "POST" || method === "PATCH" || method === "PUT" || method === "DELETE") {
    // keep a few auth-ish POST shapes that might be read as login responses
    if (path.startsWith("/auth") || path.includes("sign-in") || path.includes("sign-up") || path.includes("signout")) {
      return send(req, res, 200, { success: true, mock: true, user: USER });
    }
    return send(req, res, 200, { success: true });
  }

  // --- GET routes (specific → general) ---

  if (path === "/" || path === "/api") {
    return send(req, res, 200, { ok: true, mock: true, auth: "local-session" });
  }

  // instance
  if (path === "/api/instances") {
    return send(req, res, 200, { instance: INSTANCE, config: CONFIG });
  }
  if (path === "/api/instances/admins") return send(req, res, 200, []);
  if (path === "/api/instances/configurations") return send(req, res, 200, []);
  if (path === "/api/instances/changelog") return send(req, res, 200, {});

  // auth csrf
  if (path === "/auth/get-csrf-token") {
    return send(req, res, 200, { csrf_token: "mock" });
  }

  // current user — exact + nested (order matters)
  if (path === "/api/users/me") {
    return send(req, res, 200, USER);
  }
  if (path === "/api/users/me/profile") {
    return send(req, res, 200, PROFILE);
  }
  if (path === "/api/users/me/settings") {
    return send(req, res, 200, SETTINGS);
  }
  if (path === "/api/users/me/instance-admin") {
    return send(req, res, 200, { is_instance_admin: true });
  }
  if (path === "/api/users/me/workspaces") {
    return send(req, res, 200, [WORKSPACE]);
  }
  if (path === "/api/users/me/invitations" || path === "/api/users/me/workspaces/invitations") {
    return send(req, res, 200, []);
  }
  // /api/users/me/workspaces/:slug/project-roles
  if (match(path, "/api/users/me/workspaces/:slug/project-roles")) {
    return send(req, res, 200, {
      "proj-demo-1": 20,
      "proj-demo-2": 20,
      "proj-demo-3": 20,
    });
  }

  // workspaces
  if (path === "/api/workspaces") {
    return send(req, res, 200, [WORKSPACE]);
  }
  if (path === `/api/workspaces/${WORKSPACE.slug}`) {
    return send(req, res, 200, WORKSPACE);
  }
  if (path === `/api/workspaces/${WORKSPACE.slug}/workspace-members/me`) {
    return send(req, res, 200, MEMBER_ME);
  }
  if (
    path === `/api/workspaces/${WORKSPACE.slug}/workspace-members` ||
    path === `/api/workspaces/${WORKSPACE.slug}/members`
  ) {
    return send(req, res, 200, MEMBER_LIST);
  }

  // Home widgets — 必须是数组
  if (path === `/api/workspaces/${WORKSPACE.slug}/home-preferences` || path.endsWith("/home-preferences")) {
    return send(req, res, 200, HOME_WIDGETS);
  }

  // dashboard envelope
  if (path.includes("/dashboard")) {
    return send(req, res, 200, {
      dashboard: { id: "dash-home", name: "Home", is_default: true },
      widgets: [],
    });
  }

  const PROJECT_LIST = [
    PROJECT,
    {
      ...PROJECT,
      id: "proj-demo-2",
      name: "徐汇老宅改造",
      identifier: "XH",
      emoji: null,
      logo_props: { in_use: null, emoji: null },
      sort_order: 2000,
    },
    {
      ...PROJECT,
      id: "proj-demo-3",
      name: "园区湖景平层",
      identifier: "YQ",
      emoji: null,
      logo_props: { in_use: null, emoji: null },
      sort_order: 3000,
    },
  ];
  const projectById = (id) => PROJECT_LIST.find((p) => p.id === id) || { ...PROJECT, id };

  // projects/details before projects/:id
  if (path.endsWith("/projects/details") || path.includes("/projects/details")) {
    return send(req, res, 200, PROJECT_LIST);
  }

  if (path === `/api/workspaces/${WORKSPACE.slug}/projects`) {
    return send(req, res, 200, PROJECT_LIST);
  }

  // project-members/me — 对象，不是 []；按路径带上正确 project id
  if (path.includes("/project-members/me") || (path.includes("/projects/") && path.endsWith("/members/me"))) {
    const pm = path.match(/\/projects\/([^/]+)\//);
    const pid = pm?.[1] || PROJECT.id;
    return send(req, res, 200, { ...PROJECT_MEMBER_ME, project: pid });
  }

  // issues pagination envelope
  if (isIssuesPath(path)) {
    return send(req, res, 200, EMPTY_ISSUES);
  }

  // exact project by id (one segment only)
  if (match(path, `/api/workspaces/${WORKSPACE.slug}/projects/:id`)) {
    const m = path.match(/\/projects\/([^/]+)$/);
    const id = m?.[1] || PROJECT.id;
    return send(req, res, 200, projectById(id));
  }

  if (path === `/api/workspaces/${WORKSPACE.slug}/states`) {
    return send(req, res, 200, []);
  }
  if (path === `/api/workspaces/${WORKSPACE.slug}/sidebar-preferences`) {
    return send(req, res, 200, SIDEBAR_PREFERENCES);
  }
  if (path === `/api/workspaces/${WORKSPACE.slug}/user-properties`) {
    return send(req, res, 200, {
      rich_filters: {},
      display_filters: {},
      display_properties: {},
      navigation_project_limit: 10,
      navigation_control_preference: "TABBED",
    });
  }
  if (
    path === `/api/workspaces/${WORKSPACE.slug}/user-favorites` ||
    path.startsWith(`/api/workspaces/${WORKSPACE.slug}/user-favorites/`) ||
    path === `/api/workspaces/${WORKSPACE.slug}/favorites`
  ) {
    return send(req, res, 200, []);
  }

  // unread notifications object
  if (path.includes("/notifications/unread")) {
    return send(req, res, 200, {
      total_unread_notifications_count: 0,
      mention_unread_notifications_count: 0,
    });
  }

  // stickies paginated
  if (path.includes("/stickies")) {
    return send(req, res, 200, { results: [], total_pages: 0 });
  }

  // project-scoped user-properties → object
  if (path.includes("/user-properties")) {
    return send(req, res, 200, {
      rich_filters: {},
      display_filters: {},
      display_properties: {},
      sort_order: 1000,
      preferences: {
        pages: { block_display: false },
        navigation: { default_tab: "overview", hide_in_more_menu: [] },
      },
    });
  }

  // nested project resources: empty list
  if (path.includes("/projects/") && isObjectListPath(path)) {
    return send(req, res, 200, []);
  }
  if (isObjectListPath(path)) {
    return send(req, res, 200, []);
  }

  // generic project by id under any workspace slug
  if (match(path, "/api/workspaces/:slug/projects/:id")) {
    return send(req, res, 200, PROJECT);
  }
  if (match(path, "/api/workspaces/:slug")) {
    return send(req, res, 200, WORKSPACE);
  }

  // leftover /api/users/* — 未知返回 []，避免 invitations 变成 USER
  if (path.startsWith("/api/users")) {
    if (path === "/api/users/me" || path.startsWith("/api/users/me/")) {
      return send(req, res, 200, USER);
    }
    return send(req, res, 200, []);
  }

  // auth GET leftovers
  if (path.startsWith("/auth")) {
    return send(req, res, 200, { success: true, mock: true });
  }

  // default GET → [] or {} based on last segment heuristics
  const last = path.split("/").filter(Boolean).pop() || "";
  if (last === "home-preferences") {
    return send(req, res, 200, HOME_WIDGETS);
  }
  if (last === "me") {
    return send(req, res, 200, PROJECT_MEMBER_ME);
  }
  if (
    last.endsWith("preferences") ||
    last.endsWith("properties") ||
    last.endsWith("settings") ||
    last.endsWith("config") ||
    last.endsWith("configuration")
  ) {
    return send(req, res, 200, {});
  }
  return send(req, res, 200, []);
});

server.listen(PORT, HOST, () => {
  console.log(`Mock API (local session) http://${HOST}:${PORT}`);
});
