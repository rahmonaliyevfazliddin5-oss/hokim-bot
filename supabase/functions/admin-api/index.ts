import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ADMIN_USERNAME = Deno.env.get("ADMIN_USERNAME") ?? "";
const ADMIN_PASSWORD = Deno.env.get("ADMIN_PASSWORD") ?? "";
const TOKEN_SECRET = Deno.env.get("ADMIN_TOKEN_SECRET") ?? "";
const BUCKET = "complaint-images";
const TOKEN_TTL_SECONDS = 60 * 60 * 8; // 8 hours

const enc = new TextEncoder();

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

async function hmac(data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(TOKEN_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return new Uint8Array(sig);
}

async function makeToken(extra: Record<string, unknown> = { sub: "admin" }): Promise<string> {
  const payload = { ...extra, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = b64url(await hmac(body));
  return `${body}.${sig}`;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
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

async function verifyToken(token: string | null): Promise<boolean> {
  const p = await verifyTokenPayload(token);
  return !!p && p.sub === "admin";
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Extract the storage object path from a stored value (path or legacy full URL). */
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

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { action, ...params } = await req.json();

    // ---- Public action: login (super-admin) ----
    if (action === "login") {
      const { username, password } = params;
      const okUser =
        typeof username === "string" &&
        typeof password === "string" &&
        username === ADMIN_USERNAME &&
        password === ADMIN_PASSWORD;
      if (!okUser) {
        await new Promise((r) => setTimeout(r, 400));
        return json({ error: "invalid_credentials" }, 401);
      }
      return json({ token: await makeToken({ sub: "admin" }) });
    }

    // ---- Public action: mahalla login ----
    // Password rule: slug(mahalla) + "123" where slug lowercases the name and strips all non-alphanumerics.
    if (action === "mahalla_login") {
      const { mahalla, password } = params;
      const slug = typeof mahalla === "string" ? mahalla.toLowerCase().replace(/[^a-z0-9а-яёқғҳўʻ']/gi, "") : "";
      const expected = slug + "123";
      const okUser =
        typeof mahalla === "string" &&
        mahalla.length > 0 &&
        typeof password === "string" &&
        slug.length > 0 &&
        password.toLowerCase() === expected;
      if (!okUser) {
        await new Promise((r) => setTimeout(r, 400));
        return json({ error: "invalid_credentials" }, 401);
      }
      return json({ token: await makeToken({ sub: "mahalla", mahalla }), mahalla });
    }

    // ---- All other actions require a valid token ----
    const auth = req.headers.get("authorization") || "";
    const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : params.token ?? null;
    const payload = await verifyTokenPayload(token);
    if (!payload) return json({ error: "unauthorized" }, 401);
    const isAdmin = payload.sub === "admin";
    const isMahalla = payload.sub === "mahalla" && typeof payload.mahalla === "string";

    // ---- Mahalla-scoped actions ----
    if (isMahalla) {
      const mahalla = payload.mahalla as string;

      if (action === "mahalla_list_complaints") {
        const { data, error } = await supabase
          .from("complaints")
          .select("*")
          .eq("mahalla", mahalla)
          .order("created_at", { ascending: false })
          .limit(1000);
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
          .from("complaints")
          .select("status, tracking_code, mahalla")
          .eq("id", id)
          .maybeSingle();
        if (!prev || prev.mahalla !== mahalla) return json({ error: "forbidden" }, 403);
        const notes = typeof admin_notes === "string" && admin_notes.length ? admin_notes.slice(0, 2000) : null;
        const { error } = await supabase
          .from("complaints")
          .update({ status, admin_notes: notes })
          .eq("id", id);
        if (error) return json({ error: error.message }, 500);
        await supabase.from("activity_logs").insert({
          action: "status_changed",
          details: `${prev.tracking_code}: ${prev.status} → ${status}`,
          actor: `mahalla:${mahalla}`,
          complaint_id: id,
        });
        return json({ ok: true });
      }

      return json({ error: "forbidden" }, 403);
    }

    if (!isAdmin) return json({ error: "unauthorized" }, 401);


    if (action === "list_complaints") {
      const { data, error } = await supabase
        .from("complaints")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) return json({ error: error.message }, 500);
      const rows = await Promise.all(
        (data ?? []).map(async (r) => ({ ...r, image_urls: await signImages(r.image_urls) })),
      );
      return json({ complaints: rows });
    }

    if (action === "list_logs") {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) return json({ error: error.message }, 500);
      return json({ logs: data ?? [] });
    }

    if (action === "update_complaint") {
      const { id, status, admin_notes } = params;
      if (typeof id !== "string") return json({ error: "id_required" }, 400);
      const allowed = ["yangi", "jarayonda", "bajarildi", "rad_etildi"];
      if (typeof status !== "string" || !allowed.includes(status)) {
        return json({ error: "invalid_status" }, 400);
      }
      const notes = typeof admin_notes === "string" && admin_notes.length ? admin_notes.slice(0, 2000) : null;

      const { data: prev } = await supabase
        .from("complaints")
        .select("status, tracking_code")
        .eq("id", id)
        .maybeSingle();

      const { error } = await supabase
        .from("complaints")
        .update({ status, admin_notes: notes })
        .eq("id", id);
      if (error) return json({ error: error.message }, 500);

      await supabase.from("activity_logs").insert({
        action: "status_changed",
        details: `${prev?.tracking_code ?? id}: ${prev?.status ?? "?"} → ${status}`,
        actor: "admin",
        complaint_id: id,
      });
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
