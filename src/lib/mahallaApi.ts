const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;
const ADMIN_FN_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/admin-api`;

const ACCESS_KEY = "hokim_mahalla_access";
const REFRESH_KEY = "hokim_mahalla_refresh";
const NAME_KEY = "hokim_mahalla_name";

// -------- token storage --------
export function getMahallaToken(): string | null {
  // legacy alias for existing callers (returns access token)
  return localStorage.getItem(ACCESS_KEY);
}
export function getMahallaRefresh(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}
export function getMahallaName(): string | null {
  return localStorage.getItem(NAME_KEY);
}

export function setMahallaSession(
  accessOrToken: string | null,
  name: string | null,
  refresh?: string | null,
) {
  if (accessOrToken && name) {
    localStorage.setItem(ACCESS_KEY, accessOrToken);
    localStorage.setItem(NAME_KEY, name);
    if (refresh !== undefined) {
      if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
      else localStorage.removeItem(REFRESH_KEY);
    }
  } else {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(NAME_KEY);
    localStorage.removeItem(REFRESH_KEY);
  }
}

// -------- refresh helper --------
let refreshInFlight: Promise<boolean> | null = null;

async function refreshMahallaToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  const refresh = getMahallaRefresh();
  const name = getMahallaName();
  if (!refresh || !name) return false;
  refreshInFlight = (async () => {
    try {
      const res = await fetch(ADMIN_FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mahalla_refresh", refresh_token: refresh }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.access_token) {
        setMahallaSession(data.access_token, name, data.refresh_token ?? refresh);
        return true;
      }
      setMahallaSession(null, null);
      return false;
    } catch {
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

// -------- authenticated call with auto-refresh --------
async function rawCall<T>(action: string, params: Record<string, unknown>, token: string | null): Promise<Response> {
  return fetch(ADMIN_FN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action, ...params }),
  });
}

export async function mahallaCall<T = any>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  let token = getMahallaToken();
  let res = await rawCall<T>(action, params, token);
  if (res.status === 401 && getMahallaRefresh()) {
    const ok = await refreshMahallaToken();
    if (ok) {
      token = getMahallaToken();
      res = await rawCall<T>(action, params, token);
    }
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) setMahallaSession(null, null);
    throw new Error(data?.error || `request_failed_${res.status}`);
  }
  return data as T;
}

// -------- login --------
export async function mahallaLogin(mahalla: string, password: string): Promise<{ ok: boolean; error?: string; retryAfter?: number }> {
  try {
    const res = await fetch(ADMIN_FN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mahalla_login", mahalla, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.access_token) {
      setMahallaSession(data.access_token, mahalla, data.refresh_token ?? null);
      return { ok: true };
    }
    if (res.status === 429) return { ok: false, error: "too_many_attempts", retryAfter: data.retry_after_minutes };
    return { ok: false, error: data?.error || "invalid_credentials" };
  } catch (e) {
    return { ok: false, error: "network_error" };
  }
}

export async function mahallaLogout(): Promise<void> {
  const refresh = getMahallaRefresh();
  try {
    if (refresh) {
      await fetch(ADMIN_FN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mahalla_logout", refresh_token: refresh }),
      });
    }
  } catch {}
  setMahallaSession(null, null);
}
