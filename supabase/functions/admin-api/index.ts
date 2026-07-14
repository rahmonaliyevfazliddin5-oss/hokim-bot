import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_USERNAME = Deno.env.get("ADMIN_USERNAME") ?? "";
const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD") ?? "";
const TOKEN_SECRET = Deno.env.get("ADMIN_TOKEN_SECRET") ?? "";
const BUCKET = "complaint-images";

// Token lifetimes
const ACCESS_TTL_SECONDS = 15 * 60;           // 15 minutes
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const ADMIN_TTL_SECONDS = 60 * 60 * 8;        // 8 hours

// Brute-force limits
const RL_WINDOW_MIN = 15;
const RL_MAX_FAILURES = 5;
// Alert when failures reach this many (approaching threshold)
const RL_ALERT_THRESHOLD = 3;

const enc = new TextEncoder();

// ---------- base64url ----------
function b64url(bytes: Uint8Array): string {
  let s = btoa(String.fromCharCode(...bytes));
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlToBytes(s: string): Uint8Array {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// ---------- HMAC & hashing ----------
async function hmac(data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(TOKEN_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(data)));
}
async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return b64url(arr);
}

// ---------- JWT-like signed tokens ----------
async function makeToken(payload: Record<string, unknown>, ttlSeconds: number): Promise<string> {
  const full = { ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const body = b64url(enc.encode(JSON.stringify(full)));
  const sig = b64url(await hmac(body));
  return `${body}.${sig}`;
}
async function verifyTokenPayload(token: string | null): Promise<any | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = await hmac(body);
  if (!timingSafeEqual(b64urlToBytes(sig), expected)) return null;
  try {
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(body)));
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ---------- images ----------
function toPath(v: string): string {
  const marker = `/${BUCKET}/`;
  const idx = v.indexOf(marker);
  return idx >= 0 ? v.slice(idx + marker.length) : v;
}
async function signImages(urls: string[] | null | undefined): Promise<string[]> {
  if (!urls || urls.length === 0) return [];
  const out: string[] = [];
  for (const u of urls) {
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(toPath(u), 3600);
    if (data?.signedUrl) out.push(data.signedUrl);
  }
  return out;
}

// ---------- audit ----------
async function audit(action: string, actor: string, details: string, complaint_id: string | null = null) {
  await supabase.from("activity_logs").insert({ action, actor, details, complaint_id });
}

// ---------- helpers ----------
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  return fwd.split(",")[0].trim() || "0.0.0.0";
}

// ---------- rate limit ----------
async function isRateLimited(mahalla: string, ip: string): Promise<boolean> {
  const since = new Date(Date.now() - RL_WINDOW_MIN * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("mahalla_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("mahalla", mahalla)
    .eq("ip", ip)
    .eq("success", false)
    .gte("attempted_at", since);
  return (count ?? 0) >= RL_MAX_FAILURES;
}
async function logAttempt(mahalla: string | null, ip: string, success: boolean) {
  await supabase.from("mahalla_login_attempts").insert({ mahalla, ip, success });
}

// ---------- admin alerts ----------
async function raiseAlert(kind: string, mahalla: string | null, ip: string | null, count: number, details: string) {
  // Dedupe: skip if same kind + mahalla + ip alert exists within the current window
  const since = new Date(Date.now() - RL_WINDOW_MIN * 60 * 1000).toISOString();
  let q = supabase.from("admin_alerts").select("id", { count: "exact", head: true })
    .eq("kind", kind).gte("created_at", since);
  if (mahalla) q = q.eq("mahalla", mahalla); else q = q.is("mahalla", null);
  if (ip) q = q.eq("ip", ip); else q = q.is("ip", null);
  const { count: existing } = await q;
  if ((existing ?? 0) > 0) return;
  await supabase.from("admin_alerts").insert({
    kind, mahalla, ip, count, window_minutes: RL_WINDOW_MIN, details,
  });
}
async function checkAndAlert(mahalla: string, ip: string) {
  const since = new Date(Date.now() - RL_WINDOW_MIN * 60 * 1000).toISOString();
  const { count } = await supabase.from("mahalla_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("mahalla", mahalla).eq("ip", ip).eq("success", false).gte("attempted_at", since);
  const n = count ?? 0;
  if (n >= RL_MAX_FAILURES) {
    await raiseAlert("blocked", mahalla, ip, n, `${mahalla} / ${ip}: ${n} xato — bloklandi`);
  } else if (n >= RL_ALERT_THRESHOLD) {
    await raiseAlert("approaching_block", mahalla, ip, n, `${mahalla} / ${ip}: ${n}/${RL_MAX_FAILURES} xato urinish`);
  }
}

// ---------- session (refresh token) ----------
async function createSession(mahalla: string, ip: string, ua: string): Promise<string> {
  const raw = randomToken(32);
  const hash = await sha256Hex(raw);
  const expires = new Date(Date.now() + REFRESH_TTL_SECONDS * 1000).toISOString();
  const { data, error } = await supabase.from("mahalla_sessions").insert({
    mahalla, refresh_hash: hash, ip, user_agent: ua.slice(0, 300), expires_at: expires,
  }).select("id").maybeSingle();
  if (error || !data) throw new Error("session_create_failed");
  // Refresh token embeds session id so we can look it up without a scan
  return `${data.id}.${raw}`;
}
async function rotateSession(refresh: string): Promise<{ mahalla: string; newRefresh: string } | null> {
  const dot = refresh.indexOf(".");
  if (dot <= 0) return null;
  const sid = refresh.slice(0, dot);
  const raw = refresh.slice(dot + 1);
  const hash = await sha256Hex(raw);
  const { data } = await supabase
    .from("mahalla_sessions")
    .select("id, mahalla, refresh_hash, expires_at, revoked_at, ip, user_agent")
    .eq("id", sid)
    .maybeSingle();
  if (!data || data.revoked_at) return null;
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  if (data.refresh_hash !== hash) return null;
  const newRaw = randomToken(32);
  const newHash = await sha256Hex(newRaw);
  await supabase.from("mahalla_sessions").update({
    refresh_hash: newHash,
    expires_at: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000).toISOString(),
  }).eq("id", sid);
  return { mahalla: data.mahalla, newRefresh: `${sid}.${newRaw}` };
}
async function revokeSession(refresh: string): Promise<void> {
  const dot = refresh.indexOf(".");
  if (dot <= 0) return;
  const sid = refresh.slice(0, dot);
  await supabase.from("mahalla_sessions").update({ revoked_at: new Date().toISOString() }).eq("id", sid);
}

// ---------- password helpers (via RPC) ----------
async function verifyMahallaPassword(mahalla: string, password: string): Promise<boolean> {
  const { data, error } = await supabase.rpc("verify_mahalla_password", {
    _mahalla: mahalla, _password: password,
  });
  if (error) return false;
  return data === true;
}
async function setMahallaPassword(mahalla: string, password: string, actor: string): Promise<void> {
  const { error } = await supabase.rpc("set_mahalla_password", {
    _mahalla: mahalla, _password: password, _actor: actor,
  });
  if (error) throw new Error(error.message);
}
function defaultPasswordFor(mahalla: string): string {
  const slug = mahalla.toLowerCase().replace(/[^a-z0-9а-яёқғҳўʻ']/gi, "");
  return slug + "123";
}

// ============================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { action, ...params } = body;
    const ip = clientIp(req);
    const ua = req.headers.get("user-agent") ?? "";

    // ============ Public: super-admin login ============
    if (action === "login") {
      const { username, password } = params;
      const ok =
        typeof username === "string" && typeof password === "string" &&
        username === ADMIN_USERNAME && password === ADMIN_PASSWORD;
      if (!ok) {
        await new Promise((r) => setTimeout(r, 400));
        await audit("admin_login_failed", `ip:${ip}`, `username=${String(username).slice(0, 40)}`);
        return json({ error: "invalid_credentials" }, 401);
      }
      await audit("admin_login_success", "admin", `ip=${ip}`);
      return json({ token: await makeToken({ sub: "admin" }, ADMIN_TTL_SECONDS) });
    }

    // ============ Public: mahalla login (hashed + rate-limited) ============
    if (action === "mahalla_login") {
      const { mahalla, password } = params;
      if (typeof mahalla !== "string" || typeof password !== "string" || !mahalla || !password) {
        return json({ error: "invalid_input" }, 400);
      }
      if (await isRateLimited(mahalla, ip)) {
        await audit("mahalla_login_blocked", `ip:${ip}`, `mahalla=${mahalla} (rate-limited)`);
        return json({ error: "too_many_attempts", retry_after_minutes: RL_WINDOW_MIN }, 429);
      }
      const ok = await verifyMahallaPassword(mahalla, password);
      await logAttempt(mahalla, ip, ok);
      if (!ok) {
        await new Promise((r) => setTimeout(r, 400));
        await audit("mahalla_login_failed", `ip:${ip}`, `mahalla=${mahalla}`);
        return json({ error: "invalid_credentials" }, 401);
      }
      const refresh = await createSession(mahalla, ip, ua);
      const access = await makeToken({ sub: "mahalla", mahalla }, ACCESS_TTL_SECONDS);
      await audit("mahalla_login_success", `mahalla:${mahalla}`, `ip=${ip}`);
      return json({
        access_token: access,
        refresh_token: refresh,
        expires_in: ACCESS_TTL_SECONDS,
        mahalla,
        // legacy field name for older clients
        token: access,
      });
    }

    // ============ Public: mahalla refresh ============
    if (action === "mahalla_refresh") {
      const { refresh_token } = params;
      if (typeof refresh_token !== "string") return json({ error: "invalid_input" }, 400);
      const rot = await rotateSession(refresh_token);
      if (!rot) return json({ error: "invalid_refresh" }, 401);
      const access = await makeToken({ sub: "mahalla", mahalla: rot.mahalla }, ACCESS_TTL_SECONDS);
      return json({
        access_token: access, refresh_token: rot.newRefresh,
        expires_in: ACCESS_TTL_SECONDS, mahalla: rot.mahalla, token: access,
      });
    }

    // ============ Public: mahalla logout (revoke) ============
    if (action === "mahalla_logout") {
      const { refresh_token } = params;
      if (typeof refresh_token === "string") await revokeSession(refresh_token);
      return json({ ok: true });
    }

    // ============ Beyond this point requires valid access token ============
    const auth = req.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : params.token ?? null;
    const payload = await verifyTokenPayload(token);
    if (!payload) return json({ error: "unauthorized" }, 401);
    const isAdmin = payload.sub === "admin";
    const isMahalla = payload.sub === "mahalla" && typeof payload.mahalla === "string";

    // ============ Mahalla-scoped ============
    if (isMahalla) {
      const mahalla = payload.mahalla as string;

      if (action === "mahalla_list_complaints") {
        const { data, error } = await supabase
          .from("complaints").select("*").eq("mahalla", mahalla)
          .order("created_at", { ascending: false }).limit(1000);
        if (error) return json({ error: error.message }, 500);
        const rows = await Promise.all(
          (data ?? []).map(async (r) => ({ ...r, image_urls: await signImages(r.image_urls) })),
        );
        return json({ complaints: rows, mahalla });
      }

      if (action === "mahalla_update_complaint") {
        const { id, status, admin_notes } = params;
        if (typeof id !== "string") return json({ error: "id_required" }, 400);
        const allowed = ["yangi", "jarayonda", "bajarildi", "rad_etildi"];
        if (typeof status !== "string" || !allowed.includes(status)) {
          return json({ error: "invalid_status" }, 400);
        }
        const { data: prev } = await supabase
          .from("complaints").select("status, tracking_code, mahalla, admin_notes")
          .eq("id", id).maybeSingle();
        if (!prev || prev.mahalla !== mahalla) return json({ error: "forbidden" }, 403);
        const notes = typeof admin_notes === "string" && admin_notes.length ? admin_notes.slice(0, 2000) : null;
        const { error } = await supabase.from("complaints")
          .update({ status, admin_notes: notes }).eq("id", id);
        if (error) return json({ error: error.message }, 500);
        if (prev.status !== status) {
          await audit("status_changed", `mahalla:${mahalla}`,
            `${prev.tracking_code}: ${prev.status} → ${status}`, id);
        }
        if (notes && notes !== (prev.admin_notes ?? null)) {
          await audit("response_sent", `mahalla:${mahalla}`,
            `${prev.tracking_code}: javob yuborildi (${notes.length} b)`, id);
        }
        return json({ ok: true });
      }

      return json({ error: "forbidden" }, 403);
    }

    if (!isAdmin) return json({ error: "unauthorized" }, 401);

    // ============ Admin actions ============
    if (action === "list_complaints") {
      const { data, error } = await supabase.from("complaints").select("*")
        .order("created_at", { ascending: false }).limit(1000);
      if (error) return json({ error: error.message }, 500);
      const rows = await Promise.all(
        (data ?? []).map(async (r) => ({ ...r, image_urls: await signImages(r.image_urls) })),
      );
      return json({ complaints: rows });
    }

    if (action === "list_logs") {
      const { data, error } = await supabase.from("activity_logs").select("*")
        .order("created_at", { ascending: false }).limit(200);
      if (error) return json({ error: error.message }, 500);
      return json({ logs: data ?? [] });
    }

    if (action === "update_complaint") {
      const { id, status, admin_notes } = params;
      if (typeof id !== "string") return json({ error: "id_required" }, 400);
      const allowed = ["yangi", "jarayonda", "bajarildi", "rad_etildi"];
      if (typeof status !== "string" || !allowed.includes(status)) return json({ error: "invalid_status" }, 400);
      const notes = typeof admin_notes === "string" && admin_notes.length ? admin_notes.slice(0, 2000) : null;
      const { data: prev } = await supabase.from("complaints")
        .select("status, tracking_code, admin_notes").eq("id", id).maybeSingle();
      const { error } = await supabase.from("complaints").update({ status, admin_notes: notes }).eq("id", id);
      if (error) return json({ error: error.message }, 500);
      if (prev && prev.status !== status) {
        await audit("status_changed", "admin",
          `${prev.tracking_code ?? id}: ${prev.status ?? "?"} → ${status}`, id);
      }
      if (notes && notes !== (prev?.admin_notes ?? null)) {
        await audit("response_sent", "admin",
          `${prev?.tracking_code ?? id}: javob yuborildi (${notes.length} b)`, id);
      }
      return json({ ok: true });
    }

    // ---- Mahalla credentials admin ----
    if (action === "admin_list_mahallas") {
      const { data, error } = await supabase.from("mahalla_credentials")
        .select("mahalla, updated_at, updated_by").order("mahalla", { ascending: true });
      if (error) return json({ error: error.message }, 500);
      return json({ mahallas: data ?? [] });
    }

    if (action === "admin_reset_mahalla_password") {
      const { mahalla, new_password } = params;
      if (typeof mahalla !== "string" || !mahalla) return json({ error: "mahalla_required" }, 400);
      const pw = typeof new_password === "string" && new_password.length >= 6
        ? new_password : defaultPasswordFor(mahalla);
      try {
        await setMahallaPassword(mahalla, pw, "admin");
      } catch (e) {
        return json({ error: String((e as Error).message ?? e) }, 500);
      }
      // Revoke all sessions for this mahalla so old refresh tokens die
      await supabase.from("mahalla_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("mahalla", mahalla).is("revoked_at", null);
      await audit("mahalla_password_reset", "admin",
        `mahalla=${mahalla} ${typeof new_password === "string" && new_password.length >= 6 ? "(custom)" : "(default)"}`);
      // Return the password only when it's the default so admin can share it.
      // Custom passwords are not echoed back.
      return json({ ok: true, default_password: (typeof new_password !== "string" || new_password.length < 6) ? pw : undefined });
    }

    if (action === "admin_recent_login_attempts") {
      const { mahalla, limit } = params as { mahalla?: string; limit?: number };
      let q = supabase.from("mahalla_login_attempts").select("*")
        .order("attempted_at", { ascending: false }).limit(Math.min(limit ?? 200, 500));
      if (typeof mahalla === "string" && mahalla) q = q.eq("mahalla", mahalla);
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 500);
      return json({ attempts: data ?? [] });
    }

    // ---- Sessions: list + revoke ----
    if (action === "admin_list_mahalla_sessions") {
      const { mahalla, active_only } = params as { mahalla?: string; active_only?: boolean };
      let q = supabase.from("mahalla_sessions")
        .select("id, mahalla, ip, user_agent, created_at, expires_at, revoked_at")
        .order("created_at", { ascending: false }).limit(500);
      if (typeof mahalla === "string" && mahalla) q = q.eq("mahalla", mahalla);
      if (active_only) q = q.is("revoked_at", null).gt("expires_at", new Date().toISOString());
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 500);
      return json({ sessions: data ?? [] });
    }

    if (action === "admin_revoke_mahalla_session") {
      const { session_id } = params as { session_id?: string };
      if (typeof session_id !== "string" || !session_id) return json({ error: "session_id_required" }, 400);
      const { data: sess } = await supabase.from("mahalla_sessions")
        .select("mahalla, revoked_at").eq("id", session_id).maybeSingle();
      if (!sess) return json({ error: "not_found" }, 404);
      if (!sess.revoked_at) {
        await supabase.from("mahalla_sessions")
          .update({ revoked_at: new Date().toISOString() }).eq("id", session_id);
        await audit("mahalla_session_revoked", "admin", `mahalla=${sess.mahalla} sid=${session_id.slice(0, 8)}`);
      }
      return json({ ok: true });
    }

    // ---- Audit / mahalla login logs (filter + search) ----
    if (action === "admin_mahalla_audit") {
      const { q, mahalla, actions, from, to, limit } = params as {
        q?: string; mahalla?: string; actions?: string[]; from?: string; to?: string; limit?: number;
      };
      const defaultActions = [
        "mahalla_login_success", "mahalla_login_failed", "mahalla_login_blocked",
        "mahalla_password_reset", "mahalla_session_revoked",
        "status_changed", "response_sent",
      ];
      const acts = Array.isArray(actions) && actions.length ? actions : defaultActions;
      let query = supabase.from("activity_logs").select("*")
        .in("action", acts)
        .order("created_at", { ascending: false })
        .limit(Math.min(limit ?? 300, 1000));
      if (typeof from === "string" && from) query = query.gte("created_at", from);
      if (typeof to === "string" && to) query = query.lte("created_at", to);
      if (typeof mahalla === "string" && mahalla) {
        query = query.or(`actor.ilike.%${mahalla}%,details.ilike.%${mahalla}%`);
      }
      if (typeof q === "string" && q) {
        const s = q.replace(/[%,]/g, "");
        query = query.or(`details.ilike.%${s}%,actor.ilike.%${s}%,action.ilike.%${s}%`);
      }
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 500);
      return json({ logs: data ?? [] });
    }

    // ---- Per-mahalla login stats ----
    if (action === "admin_mahalla_login_stats") {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const sinceWindow = new Date(Date.now() - RL_WINDOW_MIN * 60 * 1000).toISOString();
      const { data: attempts, error } = await supabase.from("mahalla_login_attempts")
        .select("mahalla, ip, success, attempted_at")
        .gte("attempted_at", since24h)
        .order("attempted_at", { ascending: false })
        .limit(5000);
      if (error) return json({ error: error.message }, 500);

      const stats = new Map<string, {
        mahalla: string; total: number; success: number; failed: number;
        failed_window: number; last_attempt: string | null; last_success: string | null;
        blocked_ips: string[];
      }>();
      const ipFailByMahalla = new Map<string, Map<string, number>>();

      for (const a of attempts ?? []) {
        if (!a.mahalla) continue;
        let s = stats.get(a.mahalla);
        if (!s) {
          s = { mahalla: a.mahalla, total: 0, success: 0, failed: 0, failed_window: 0,
                last_attempt: null, last_success: null, blocked_ips: [] };
          stats.set(a.mahalla, s);
        }
        s.total++;
        if (a.success) { s.success++; if (!s.last_success) s.last_success = a.attempted_at; }
        else {
          s.failed++;
          if (a.attempted_at >= sinceWindow) {
            s.failed_window++;
            let ipMap = ipFailByMahalla.get(a.mahalla);
            if (!ipMap) { ipMap = new Map(); ipFailByMahalla.set(a.mahalla, ipMap); }
            ipMap.set(a.ip, (ipMap.get(a.ip) ?? 0) + 1);
          }
        }
        if (!s.last_attempt) s.last_attempt = a.attempted_at;
      }
      for (const [m, ipMap] of ipFailByMahalla) {
        const s = stats.get(m); if (!s) continue;
        for (const [ip, n] of ipMap) if (n >= RL_MAX_FAILURES) s.blocked_ips.push(ip);
      }
      const rows = Array.from(stats.values()).sort((a, b) => b.failed_window - a.failed_window || b.total - a.total);
      return json({ stats: rows, window_minutes: RL_WINDOW_MIN, threshold: RL_MAX_FAILURES });
    }

    // ---- Bulk reset all mahalla passwords to default ----
    if (action === "admin_reset_all_mahalla_passwords") {
      const { data: list, error: e0 } = await supabase.from("mahalla_credentials").select("mahalla");
      if (e0) return json({ error: e0.message }, 500);
      let ok = 0; const failed: string[] = [];
      for (const row of list ?? []) {
        try { await setMahallaPassword(row.mahalla, defaultPasswordFor(row.mahalla), "admin"); ok++; }
        catch { failed.push(row.mahalla); }
      }
      await supabase.from("mahalla_sessions")
        .update({ revoked_at: new Date().toISOString() }).is("revoked_at", null);
      await audit("mahalla_password_bulk_reset", "admin", `reset=${ok} failed=${failed.length}`);
      return json({ ok: true, reset: ok, failed });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
