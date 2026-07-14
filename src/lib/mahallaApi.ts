const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const ADMIN_FN_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/admin-api`;
const TOKEN_KEY = "hokim_mahalla_token";
const NAME_KEY = "hokim_mahalla_name";

export function getMahallaToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}
export function getMahallaName(): string | null {
  return sessionStorage.getItem(NAME_KEY);
}
export function setMahallaSession(token: string | null, name: string | null) {
  if (token && name) {
    sessionStorage.setItem(TOKEN_KEY, token);
    sessionStorage.setItem(NAME_KEY, name);
  } else {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(NAME_KEY);
  }
}

export async function mahallaCall<T = any>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const token = getMahallaToken();
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
    if (res.status === 401) setMahallaSession(null, null);
    throw new Error(data?.error || `request_failed_${res.status}`);
  }
  return data as T;
}

export async function mahallaLogin(mahalla: string, password: string): Promise<boolean> {
  try {
    const res = await fetch(ADMIN_FN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mahalla_login", mahalla, password }),
    });
    const data = await res.json();
    if (res.ok && data.token) {
      setMahallaSession(data.token, mahalla);
      return true;
    }
  } catch {}
  return false;
}
