import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const allowedOrigins = new Set([
  "https://dolphin-abi-pool.gerayeli60.chatgpt.site",
  "https://dolphin-abi.vercel.app",
  "http://localhost:3000",
  "http://localhost:3001",
]);

function headers(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://dolphin-abi.vercel.app",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: headers(req) });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);
  const origin = req.headers.get("origin") ?? "";
  if (origin && !allowedOrigins.has(origin)) return json(req, { error: "Forbidden" }, 403);

  try {
    const body = await req.json();
    const username = String(body.username ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username) || password.length < 8) {
      return json(req, { error: "Invalid credentials" }, 401);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: profile } = await admin
      .from("profiles")
      .select("id,must_change_password,account_status")
      .eq("username", username)
      .maybeSingle();
    if (!profile || profile.account_status !== "active") {
      return json(req, { error: "Invalid credentials" }, 401);
    }

    const { data: authUser, error: userError } = await admin.auth.admin.getUserById(profile.id);
    if (userError || !authUser.user?.email) return json(req, { error: "Invalid credentials" }, 401);
    const { data: signedIn, error: signInError } = await admin.auth.signInWithPassword({
      email: authUser.user.email,
      password,
    });
    if (signInError || !signedIn.session) return json(req, { error: "Invalid credentials" }, 401);

    await admin.from("profiles").update({ last_login_at: new Date().toISOString() }).eq("id", profile.id);
    return json(req, {
      access_token: signedIn.session.access_token,
      refresh_token: signedIn.session.refresh_token,
      expires_in: signedIn.session.expires_in,
      must_change_password: profile.must_change_password,
    });
  } catch {
    return json(req, { error: "Invalid credentials" }, 401);
  }
});
