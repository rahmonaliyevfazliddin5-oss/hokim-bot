import { supabase } from "@/integrations/supabase/client";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const ADMIN_FN_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/admin-api`;
const TOKEN_KEY = "hokim_admin_token";

export function getAdminToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}
export function setAdminToken(token: string | null) {
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
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
    if (res.status === 401) setAdminToken(null);
    throw new Error(data?.error || `request_failed_${res.status}`);
  }
  return data as T;
}

export async function adminLogin(username: string, password: string): Promise<boolean> {
  try {
    const data = await adminCall<{ token?: string }>("login", { username, password });
    if (data.token) {
      setAdminToken(data.token);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
