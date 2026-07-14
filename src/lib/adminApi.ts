import { supabase } from "@/integrations/supabase/client";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const ADMIN_FN_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/admin-api`;
const TOKEN_KEY = "hokim_admin_token";
const ROLE_KEY = "hokim_admin_role";
const USER_KEY = "hokim_admin_user";

export type AdminRole = "superadmin" | "editor" | "operator" | "auditor";

export function getAdminToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}
export function setAdminToken(token: string | null) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}
export function getAdminRole(): AdminRole | null {
  const v = sessionStorage.getItem(ROLE_KEY);
  return v && ["superadmin", "editor", "operator", "auditor"].includes(v) ? (v as AdminRole) : null;
}
export function getAdminUsername(): string | null {
  return sessionStorage.getItem(USER_KEY);
}
function setAdminRole(role: string | null, username: string | null) {
  if (role) sessionStorage.setItem(ROLE_KEY, role); else sessionStorage.removeItem(ROLE_KEY);
  if (username) sessionStorage.setItem(USER_KEY, username); else sessionStorage.removeItem(USER_KEY);
}

/** Call the admin-api edge function with the stored bearer token. */
export async function adminCall<T = any>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const token = getAdminToken();
  const res = await fetch(ADMIN_FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action, ...params }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) { setAdminToken(null); setAdminRole(null, null); }
    throw new Error(data?.error || `request_failed_${res.status}`);
  }
  return data as T;
}

export async function adminLogin(username: string, password: string): Promise<{ ok: boolean; role?: AdminRole }> {
  try {
    const data = await adminCall<{ token?: string; role?: AdminRole; username?: string }>("login", { username, password });
    if (data.token) {
      setAdminToken(data.token);
      setAdminRole(data.role ?? "superadmin", data.username ?? username);
      return { ok: true, role: data.role ?? "superadmin" };
    }
    return { ok: false };
  } catch {
    return { ok: false };
  }
}

export function clearAdmin() { setAdminToken(null); setAdminRole(null, null); }

/** Which UI actions the current role can perform. Keep in sync with the edge function. */
export function canRole(role: AdminRole | null, capability:
  | "view" | "update_status" | "write_notes" | "escalate"
  | "manage_users" | "manage_rules" | "manage_alerts" | "manage_mahalla_passwords"
): boolean {
  if (!role) return false;
  if (role === "superadmin") return true;
  switch (capability) {
    case "view": return true;
    case "update_status": return role === "editor" || role === "operator";
    case "escalate": return role === "editor";
    case "write_notes": return role === "editor";
    default: return false; // auditors and others: no writes
  }
}
