import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function sanitizeComment(raw: unknown): string {
  if (typeof raw !== "string") return "";
  // Strip pipe and newlines so the encoded "verdict=x|ip=y|comment=z" stays parseable.
  return raw.replace(/[|\r\n]+/g, " ").trim().slice(0, 500);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { tracking_code, verdict, comment } = await req.json();
    if (typeof tracking_code !== "string" || !/^HOK-\d{8}-\d{3,5}$/i.test(tracking_code.trim())) {
      return json({ error: "invalid_code" }, 400);
    }
    if (verdict !== "correct" && verdict !== "incorrect") {
      return json({ error: "invalid_verdict" }, 400);
    }
    const code = tracking_code.trim().toUpperCase();
    const cleanComment = sanitizeComment(comment);

    const { data: c } = await supabase.from("complaints").select("id").eq("tracking_code", code).maybeSingle();
    if (!c) return json({ error: "not_found" }, 404);

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";

    // Encode structured payload in `details`
    const details = `verdict=${verdict}|ip=${ip}` + (cleanComment ? `|comment=${cleanComment}` : "");

    // Update existing row (same code+ip) — else insert
    const { data: prev } = await supabase.from("activity_logs")
      .select("id").eq("complaint_id", c.id).eq("action", "routing_feedback")
      .ilike("details", `%|ip=${ip}%`).limit(1);

    if (prev && prev.length > 0) {
      await supabase.from("activity_logs")
        .update({ details, created_at: new Date().toISOString() })
        .eq("id", prev[0].id);
      return json({ ok: true, updated: true });
    }

    await supabase.from("activity_logs").insert({
      complaint_id: c.id,
      action: "routing_feedback",
      actor: "citizen",
      details,
    });
    return json({ ok: true });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
