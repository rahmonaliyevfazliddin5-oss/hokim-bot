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

// ---------- alert config (cached) ----------
interface AlertConfig {
  approaching_threshold: number;
  block_threshold: number;
  window_minutes: number;
  email_enabled: boolean;
  email_provider: string;
  email_from: string | null;
  email_recipients: string[];
}
let _cfgCache: { at: number; cfg: AlertConfig } | null = null;
async function getAlertConfig(force = false): Promise<AlertConfig> {
  if (!force && _cfgCache && Date.now() - _cfgCache.at < 15000) return _cfgCache.cfg;
  const { data } = await supabase.from("admin_alert_config").select("*").eq("id", 1).maybeSingle();
  const cfg: AlertConfig = {
    approaching_threshold: data?.approaching_threshold ?? RL_ALERT_THRESHOLD,
    block_threshold: data?.block_threshold ?? RL_MAX_FAILURES,
    window_minutes: data?.window_minutes ?? RL_WINDOW_MIN,
    email_enabled: !!data?.email_enabled,
    email_provider: data?.email_provider ?? "resend",
    email_from: data?.email_from ?? null,
    email_recipients: (data?.email_recipients as string[] | null) ?? [],
  };
  _cfgCache = { at: Date.now(), cfg };
  return cfg;
}

// ---------- rate limit ----------
async function isRateLimited(mahalla: string, ip: string): Promise<boolean> {
  const cfg = await getAlertConfig();
  const since = new Date(Date.now() - cfg.window_minutes * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("mahalla_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("mahalla", mahalla)
    .eq("ip", ip)
    .eq("success", false)
    .gte("attempted_at", since);
  return (count ?? 0) >= cfg.block_threshold;
}
async function logAttempt(mahalla: string | null, ip: string, success: boolean) {
  await supabase.from("mahalla_login_attempts").insert({ mahalla, ip, success });
}

// ---------- email delivery (Resend via connector gateway) ----------
async function sendEmail(recipient: string, subject: string, html: string): Promise<{ id?: string; error?: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
  if (!LOVABLE_API_KEY) return { error: "LOVABLE_API_KEY_missing" };
  if (!RESEND_API_KEY) return { error: "RESEND_connector_not_linked" };
  const cfg = await getAlertConfig();
  const from = cfg.email_from || "Hokim AI <onboarding@resend.dev>";
  try {
    const res = await fetch("https://connector-gateway.lovable.dev/resend/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": RESEND_API_KEY,
      },
      body: JSON.stringify({ from, to: [recipient], subject, html }),
    });
    if (!res.ok) {
      const t = await res.text();
      return { error: `HTTP ${res.status}: ${t.slice(0, 300)}` };
    }
    const j = await res.json().catch(() => ({}));
    return { id: j?.id };
  } catch (e) {
    return { error: String(e).slice(0, 300) };
  }
}

// ---------- admin alerts ----------
async function raiseAlert(kind: string, mahalla: string | null, ip: string | null, count: number, details: string) {
  const cfg = await getAlertConfig();
  // Dedupe: skip if same kind + mahalla + ip alert exists within the current window
  const since = new Date(Date.now() - cfg.window_minutes * 60 * 1000).toISOString();
  let dq = supabase.from("admin_alerts").select("id", { count: "exact", head: true })
    .eq("kind", kind).gte("created_at", since);
  if (mahalla) dq = dq.eq("mahalla", mahalla); else dq = dq.is("mahalla", null);
  if (ip) dq = dq.eq("ip", ip); else dq = dq.is("ip", null);
  const { count: existing } = await dq;
  if ((existing ?? 0) > 0) return;

  const { data: inserted, error } = await supabase.from("admin_alerts").insert({
    kind, mahalla, ip, count, window_minutes: cfg.window_minutes, details,
  }).select("id").single();
  if (error || !inserted) return;
  const alertId = inserted.id as string;

  // Internal delivery — always logged as delivered immediately
  await supabase.from("admin_alert_deliveries").insert({
    alert_id: alertId, channel: "internal", recipient: null,
    status: "delivered", delivered_at: new Date().toISOString(),
  });

  // Email deliveries (fire-and-forget)
  if (cfg.email_enabled && cfg.email_recipients.length > 0) {
    const subject = `[Hokim AI] ${kind === "approaching_block" ? "Bloklashga yaqin"
                    : kind === "blocked" ? "MFY bloklandi"
                    : kind === "rate_limited_429" ? "429 rate-limit" : kind} — ${mahalla ?? "?"}`;
    const html = `<div style="font-family:system-ui,sans-serif;padding:16px;">
      <h2 style="margin:0 0 8px;color:#111;">Xavfsizlik bildirishnomasi</h2>
      <p style="margin:0 0 4px;"><b>Turi:</b> ${kind}</p>
      <p style="margin:0 0 4px;"><b>MFY:</b> ${mahalla ?? "—"}</p>
      <p style="margin:0 0 4px;"><b>IP:</b> ${ip ?? "—"}</p>
      <p style="margin:0 0 4px;"><b>Xato urinishlar:</b> ${count} / ${cfg.window_minutes} daq.</p>
      <p style="margin:8px 0 0;color:#444;">${details}</p>
      <p style="margin:16px 0 0;font-size:12px;color:#888;">Vaqt: ${new Date().toISOString()}</p>
    </div>`;
    for (const to of cfg.email_recipients) {
      // Log pending → send → update
      const { data: del } = await supabase.from("admin_alert_deliveries").insert({
        alert_id: alertId, channel: "email", recipient: to, status: "pending",
      }).select("id").single();
      const r = await sendEmail(to, subject, html);
      await supabase.from("admin_alert_deliveries").update({
        status: r.error ? "failed" : "delivered",
        error: r.error ?? null,
        provider_message_id: r.id ?? null,
        delivered_at: r.error ? null : new Date().toISOString(),
      }).eq("id", del!.id);
    }
  }
}
async function checkAndAlert(mahalla: string, ip: string) {
  const cfg = await getAlertConfig();
  const since = new Date(Date.now() - cfg.window_minutes * 60 * 1000).toISOString();
  const { count } = await supabase.from("mahalla_login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("mahalla", mahalla).eq("ip", ip).eq("success", false).gte("attempted_at", since);
  const n = count ?? 0;
  if (n >= cfg.block_threshold) {
    await raiseAlert("blocked", mahalla, ip, n, `${mahalla} / ${ip}: ${n} xato — bloklandi`);
  } else if (n >= cfg.approaching_threshold) {
    await raiseAlert("approaching_block", mahalla, ip, n, `${mahalla} / ${ip}: ${n}/${cfg.block_threshold} xato urinish`);
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

    // ============ Public: super-admin / role-based admin login ============
    if (action === "login") {
      const { username, password } = params;
      if (typeof username !== "string" || typeof password !== "string") {
        return json({ error: "invalid_input" }, 400);
      }
      // 1) Env-based superadmin (built-in)
      if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        await audit("admin_login_success", "admin", `ip=${ip} role=superadmin`);
        return json({
          token: await makeToken({ sub: "admin", role: "superadmin", username }, ADMIN_TTL_SECONDS),
          role: "superadmin",
          username,
        });
      }
      // 2) admin_users table (multi-role)
      const { data: verified } = await supabase.rpc("verify_admin_user_password", {
        _username: username, _password: password,
      });
      const v = Array.isArray(verified) ? verified[0] : verified;
      if (v?.ok && v?.active) {
        await audit("admin_login_success", `admin:${username}`, `ip=${ip} role=${v.role}`);
        return json({
          token: await makeToken({ sub: "admin", role: v.role, username }, ADMIN_TTL_SECONDS),
          role: v.role, username, full_name: v.full_name ?? null,
        });
      }
      await new Promise((r) => setTimeout(r, 400));
      await audit("admin_login_failed", `ip:${ip}`, `username=${String(username).slice(0, 40)}`);
      return json({ error: "invalid_credentials" }, 401);
    }

    // ============ Public: mahalla login (hashed + rate-limited) ============
    if (action === "mahalla_login") {
      const { mahalla, password } = params;
      if (typeof mahalla !== "string" || typeof password !== "string" || !mahalla || !password) {
        return json({ error: "invalid_input" }, 400);
      }
      if (await isRateLimited(mahalla, ip)) {
        const cfg = await getAlertConfig();
        await audit("mahalla_login_blocked", `ip:${ip}`, `mahalla=${mahalla} (rate-limited)`);
        await raiseAlert("rate_limited_429", mahalla, ip, cfg.block_threshold, `${mahalla} / ${ip}: 429 rate-limited`);
        return json({ error: "too_many_attempts", retry_after_minutes: cfg.window_minutes }, 429);
      }
      const ok = await verifyMahallaPassword(mahalla, password);
      await logAttempt(mahalla, ip, ok);
      if (!ok) {
        await new Promise((r) => setTimeout(r, 400));
        await audit("mahalla_login_failed", `ip:${ip}`, `mahalla=${mahalla}`);
        await checkAndAlert(mahalla, ip);
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

    // ---- Role-based access control ----
    const role: string = typeof payload.role === "string" ? payload.role : "superadmin";
    const actorLabel = typeof payload.username === "string" ? `admin:${payload.username}` : "admin";

    // Actions permitted by each admin role. `superadmin` = all.
    const READ_ONLY_ACTIONS = new Set([
      "list_complaints", "list_logs", "routing_audit", "routing_feedback_stats",
      "admin_log_view", "sla_kpi_stats",
      "admin_list_mahallas", "admin_recent_login_attempts",
      "admin_list_mahalla_sessions", "admin_mahalla_audit",
      "admin_mahalla_login_stats", "admin_alerts_list",
      "admin_alert_deliveries_list", "admin_alert_config_get",
      "escalation_rules_get", "admin_users_list", "admin_whoami",
    ]);
    const MUTATE_ACTIONS = new Set([
      "update_complaint", "escalate_overdue", "admin_alerts_mark_seen",
    ]);
    const OPERATOR_ONLY_STATUS = new Set(["jarayonda", "korib_chiqilmoqda", "hal_qilindi"]);
    const SUPERADMIN_ONLY = new Set([
      "admin_reset_mahalla_password", "admin_reset_all_mahalla_passwords",
      "admin_revoke_mahalla_session", "admin_bulk_revoke_sessions",
      "admin_alert_config_set", "admin_alert_test_email",
      "escalation_rules_set",
      "admin_users_create", "admin_users_update", "admin_users_delete",
      "admin_users_reset_password",
    ]);

    if (role !== "superadmin") {
      if (SUPERADMIN_ONLY.has(action)) return json({ error: "forbidden_role" }, 403);
      if (role === "auditor" && MUTATE_ACTIONS.has(action)) return json({ error: "forbidden_role" }, 403);
      // operators can update status but not free-form admin_notes; editors can do both.
      if (role === "operator" && action === "update_complaint") {
        const status = params?.status;
        if (typeof status === "string" && !OPERATOR_ONLY_STATUS.has(status)) {
          return json({ error: "operator_status_restricted" }, 403);
        }
        if (typeof params?.admin_notes === "string" && params.admin_notes.trim().length > 0) {
          return json({ error: "operator_notes_forbidden" }, 403);
        }
      }
      // Whitelist check: only allow known reads/mutations
      if (!READ_ONLY_ACTIONS.has(action) && !MUTATE_ACTIONS.has(action)) {
        return json({ error: "forbidden_role" }, 403);
      }
    }

    if (action === "admin_whoami") {
      return json({ role, username: payload.username ?? null });
    }

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
      const cfg = await getAlertConfig();
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const sinceWindow = new Date(Date.now() - cfg.window_minutes * 60 * 1000).toISOString();
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
        for (const [ip, n] of ipMap) if (n >= cfg.block_threshold) s.blocked_ips.push(ip);
      }
      const rows = Array.from(stats.values()).sort((a, b) => b.failed_window - a.failed_window || b.total - a.total);
      return json({ stats: rows, window_minutes: cfg.window_minutes, threshold: cfg.block_threshold });
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


    // ---- Bulk revoke sessions by filters (mahalla/ip/date range) ----
    if (action === "admin_bulk_revoke_sessions") {
      const { mahalla, ip: ipFilter, from, to, session_ids } = params as {
        mahalla?: string; ip?: string; from?: string; to?: string; session_ids?: string[];
      };
      let q = supabase.from("mahalla_sessions").update({ revoked_at: new Date().toISOString() })
        .is("revoked_at", null)
        .gt("expires_at", new Date().toISOString());
      let scope = "";
      if (Array.isArray(session_ids) && session_ids.length) {
        q = q.in("id", session_ids.slice(0, 500));
        scope = `ids=${session_ids.length}`;
      } else {
        if (typeof mahalla === "string" && mahalla) { q = q.eq("mahalla", mahalla); scope += ` mahalla=${mahalla}`; }
        if (typeof ipFilter === "string" && ipFilter) { q = q.eq("ip", ipFilter); scope += ` ip=${ipFilter}`; }
        if (typeof from === "string" && from) { q = q.gte("created_at", from); scope += ` from=${from}`; }
        if (typeof to === "string" && to) { q = q.lte("created_at", to); scope += ` to=${to}`; }
        if (!scope) return json({ error: "no_filter" }, 400);
      }
      const { data, error } = await q.select("id");
      if (error) return json({ error: error.message }, 500);
      const n = data?.length ?? 0;
      await audit("mahalla_session_bulk_revoked", "admin", `revoked=${n}${scope}`);
      return json({ ok: true, revoked: n });
    }

    // ---- Admin alerts ----
    if (action === "admin_alerts_list") {
      const { unseen_only, limit } = params as { unseen_only?: boolean; limit?: number };
      let q = supabase.from("admin_alerts").select("*")
        .order("created_at", { ascending: false }).limit(Math.min(limit ?? 100, 500));
      if (unseen_only) q = q.is("seen_at", null);
      const { data, error } = await q;
      if (error) return json({ error: error.message }, 500);
      const ids = (data ?? []).map((a: any) => a.id);
      let deliveries: any[] = [];
      if (ids.length) {
        const { data: d } = await supabase.from("admin_alert_deliveries")
          .select("*").in("alert_id", ids).order("created_at", { ascending: true });
        deliveries = d ?? [];
      }
      const { count: unseen } = await supabase.from("admin_alerts")
        .select("id", { count: "exact", head: true }).is("seen_at", null);
      return json({ alerts: data ?? [], deliveries, unseen: unseen ?? 0 });
    }

    if (action === "admin_alert_deliveries_list") {
      const { alert_id } = params as { alert_id?: string };
      if (!alert_id) return json({ error: "alert_id_required" }, 400);
      const { data, error } = await supabase.from("admin_alert_deliveries")
        .select("*").eq("alert_id", alert_id).order("created_at", { ascending: true });
      if (error) return json({ error: error.message }, 500);
      return json({ deliveries: data ?? [] });
    }

    // ---- Alert config ----
    if (action === "admin_alert_config_get") {
      const cfg = await getAlertConfig(true);
      const resendLinked = !!Deno.env.get("RESEND_API_KEY");
      return json({ config: cfg, resend_linked: resendLinked });
    }
    if (action === "admin_alert_config_set") {
      const { approaching_threshold, block_threshold, window_minutes,
              email_enabled, email_provider, email_from, email_recipients } = params as Record<string, unknown>;
      const at = Math.max(1, Math.min(50, Number(approaching_threshold) || 3));
      const bt = Math.max(at, Math.min(100, Number(block_threshold) || 5));
      const wm = Math.max(1, Math.min(1440, Number(window_minutes) || 15));
      const rec = Array.isArray(email_recipients)
        ? (email_recipients as unknown[]).map(String).map((s) => s.trim())
            .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)).slice(0, 20)
        : [];
      const { error } = await supabase.from("admin_alert_config").upsert({
        id: 1,
        approaching_threshold: at,
        block_threshold: bt,
        window_minutes: wm,
        email_enabled: !!email_enabled,
        email_provider: typeof email_provider === "string" ? email_provider : "resend",
        email_from: typeof email_from === "string" && email_from ? email_from : null,
        email_recipients: rec,
        updated_at: new Date().toISOString(),
        updated_by: "admin",
      });
      if (error) return json({ error: error.message }, 500);
      _cfgCache = null;
      await audit("admin_alert_config_updated", "admin",
        `at=${at} bt=${bt} wm=${wm} email=${!!email_enabled} rec=${rec.length}`);
      return json({ ok: true });
    }
    if (action === "admin_alert_test_email") {
      const { recipient } = params as { recipient?: string };
      const cfg = await getAlertConfig();
      const to = (recipient && typeof recipient === "string") ? recipient : cfg.email_recipients[0];
      if (!to) return json({ error: "no_recipient" }, 400);
      const r = await sendEmail(to, "[Hokim AI] Sinov bildirishnomasi",
        `<p>Bu Hokim AI xavfsizlik bildirishnomalari uchun sinov xabari.</p>
         <p>Vaqt: ${new Date().toISOString()}</p>`);
      return json({ ok: !r.error, error: r.error ?? null, id: r.id ?? null });
    }


    if (action === "admin_alerts_mark_seen") {
      const { ids, all } = params as { ids?: string[]; all?: boolean };
      let q = supabase.from("admin_alerts").update({ seen_at: new Date().toISOString() }).is("seen_at", null);
      if (all) {
        // no additional filter
      } else if (Array.isArray(ids) && ids.length) {
        q = q.in("id", ids.slice(0, 500));
      } else {
        return json({ error: "no_target" }, 400);
      }
      const { error } = await q;
      if (error) return json({ error: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "routing_feedback_stats") {
      const { data, error } = await supabase.from("activity_logs")
        .select("details, created_at, complaint_id")
        .eq("action", "routing_feedback")
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) return json({ error: error.message }, 500);
      let correct = 0, incorrect = 0;
      const recent: any[] = [];
      const byComplaint: Record<string, { verdict: string | null; comment: string; created_at: string }> = {};
      for (const r of data ?? []) {
        const v = /verdict=(\w+)/.exec(r.details ?? "")?.[1] ?? null;
        const cm = /\|comment=([\s\S]+)$/.exec(r.details ?? "")?.[1]?.trim() ?? "";
        if (v === "correct") correct++;
        else if (v === "incorrect") incorrect++;
        if (recent.length < 100) recent.push({
          complaint_id: r.complaint_id, verdict: v, comment: cm, created_at: r.created_at,
        });
        // Keep only latest per complaint (data is ordered desc)
        if (r.complaint_id && !byComplaint[r.complaint_id]) {
          byComplaint[r.complaint_id] = { verdict: v, comment: cm, created_at: r.created_at };
        }
      }
      const total = correct + incorrect;
      return json({
        correct, incorrect, total,
        accuracy: total ? correct / total : null,
        recent, by_complaint: byComplaint,
      });
    }

    // ---- Audit log: routing decisions, edits and views (with filters) ----
    if (action === "routing_audit") {
      const { q, actor, actions, from, to, limit } = params as {
        q?: string; actor?: string; actions?: string[]; from?: string; to?: string; limit?: number;
      };
      const defaultActions = [
        "ai_classified", "routed", "status_changed", "response_sent",
        "routing_feedback", "escalated", "admin_viewed", "admin_login_success",
      ];
      const acts = Array.isArray(actions) && actions.length ? actions : defaultActions;
      let query = supabase.from("activity_logs").select("*")
        .in("action", acts)
        .order("created_at", { ascending: false })
        .limit(Math.min(limit ?? 300, 2000));
      if (typeof from === "string" && from) query = query.gte("created_at", from);
      if (typeof to === "string" && to) query = query.lte("created_at", to);
      if (typeof actor === "string" && actor) query = query.ilike("actor", `%${actor}%`);
      if (typeof q === "string" && q) {
        const s = q.replace(/[%,]/g, "");
        query = query.or(`details.ilike.%${s}%,actor.ilike.%${s}%,action.ilike.%${s}%`);
      }
      const { data, error } = await query;
      if (error) return json({ error: error.message }, 500);
      return json({ logs: data ?? [] });
    }

    // ---- Log admin viewing a complaint (deduped per hour) ----
    if (action === "admin_log_view") {
      const { id } = params as { id?: string };
      if (typeof id !== "string" || !id) return json({ error: "id_required" }, 400);
      const { data: cx } = await supabase.from("complaints").select("tracking_code").eq("id", id).maybeSingle();
      if (!cx) return json({ error: "not_found" }, 404);
      const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabase.from("activity_logs")
        .select("id", { count: "exact", head: true })
        .eq("complaint_id", id).eq("action", "admin_viewed").eq("actor", "admin")
        .gte("created_at", since);
      if ((count ?? 0) === 0) {
        await audit("admin_viewed", "admin", `${cx.tracking_code}: admin ko'rdi`, id);
      }
      return json({ ok: true });
    }

    // ---- Auto-escalation: complaints whose ETA has passed (uses configurable rules) ----
    if (action === "escalate_overdue") {
      const nowMs = Date.now();
      // Load rules
      const { data: rulesRow } = await supabase.from("escalation_rules").select("*").eq("id", 1).maybeSingle();
      const rules = {
        enabled: rulesRow?.enabled ?? true,
        severity_bump_days: Math.max(0, Number(rulesRow?.severity_bump_days ?? 0)),
        reroute_to_hokimiyat_days: Math.max(0, Number(rulesRow?.reroute_to_hokimiyat_days ?? 3)),
        target_status: typeof rulesRow?.target_status === "string" ? rulesRow.target_status : "korib_chiqilmoqda",
        max_severity: typeof rulesRow?.max_severity === "string" ? rulesRow.max_severity : "yuqori",
      };
      if (!rules.enabled) return json({ ok: true, escalated: 0, details: [], skipped: "disabled" });

      const { data: rows, error } = await supabase
        .from("complaints")
        .select("id, tracking_code, status, severity, routing_target, responsible_org, eta_days, created_at")
        .not("eta_days", "is", null)
        .not("status", "in", "(hal_qilindi,bajarildi,rad_etildi)")
        .limit(2000);
      if (error) return json({ error: error.message }, 500);

      const sevOrder = ["oddiy", "orta", "yuqori"];
      const maxIdx = Math.max(0, sevOrder.indexOf(rules.max_severity));
      const bumpSeverity = (s: string | null) => {
        const i = sevOrder.indexOf(s ?? "oddiy");
        const next = Math.min(maxIdx, (i < 0 ? 0 : i) + 1);
        return sevOrder[next];
      };
      const escalateStatus = (s: string | null) => {
        const early = ["qabul_qilindi", "ai_tahlil", "mahallaga_yuborildi", "hokimiyatga_yuborildi", "yangi"];
        return early.includes(s ?? "") ? rules.target_status : s ?? rules.target_status;
      };

      let escalated = 0;
      const details: Array<Record<string, unknown>> = [];

      for (const r of rows ?? []) {
        const dueMs = new Date(r.created_at).getTime() + (r.eta_days as number) * 86400000;
        if (dueMs >= nowMs) continue;
        const overdueDays = Math.floor((nowMs - dueMs) / 86400000);

        const oldSev = r.severity as string | null;
        const oldStatus = r.status as string | null;
        const oldRoute = r.routing_target as string | null;

        const shouldBumpSev = overdueDays >= rules.severity_bump_days;
        const newSev = shouldBumpSev ? bumpSeverity(oldSev) : oldSev;
        const newStatus = escalateStatus(oldStatus);
        const newRoute = oldRoute === "mahalla" && overdueDays >= rules.reroute_to_hokimiyat_days ? "hokimiyat" : oldRoute;

        // Avoid duplicate escalation for the same day
        const since = new Date(nowMs - 20 * 60 * 60 * 1000).toISOString();
        const { count: recentEsc } = await supabase.from("activity_logs")
          .select("id", { count: "exact", head: true })
          .eq("complaint_id", r.id).eq("action", "escalated")
          .gte("created_at", since);
        if ((recentEsc ?? 0) > 0) continue;

        const patch: Record<string, unknown> = {};
        if (newSev !== oldSev) patch.severity = newSev;
        if (newStatus !== oldStatus) patch.status = newStatus;
        if (newRoute !== oldRoute) patch.routing_target = newRoute;
        if (Object.keys(patch).length === 0) continue;

        const { error: upErr } = await supabase.from("complaints").update(patch).eq("id", r.id);
        if (upErr) continue;

        const reason = `AI eskalatsiya: ETA ${r.eta_days} kun edi, ${overdueDays} kun kechikdi`
          + (newSev !== oldSev ? ` · og'irlik: ${oldSev ?? "?"} → ${newSev}` : "")
          + (newRoute !== oldRoute ? ` · yo'nalish: ${oldRoute ?? "?"} → ${newRoute}` : "");

        await audit("escalated", "system", `${r.tracking_code}: ${reason}`, r.id);
        if (newStatus !== oldStatus) {
          await audit("status_changed", "system",
            `${r.tracking_code}: ${oldStatus ?? "?"} → ${newStatus} (auto-eskalatsiya)`, r.id);
        }
        escalated++;
        details.push({
          tracking_code: r.tracking_code, overdue_days: overdueDays,
          severity: `${oldSev} → ${newSev}`,
          status: `${oldStatus} → ${newStatus}`,
          routing: `${oldRoute} → ${newRoute}`,
        });
      }
      return json({ ok: true, escalated, details });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
