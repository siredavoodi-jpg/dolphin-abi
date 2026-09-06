import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const allowedOrigins = new Set(["https://dolphin-abi-pool.gerayeli60.chatgpt.site", "https://dolphin-abi.vercel.app", "http://localhost:3000", "http://localhost:3001"]);
const assignableRoles = new Set(["branch_manager", "receptionist", "member"]);
function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {"Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://dolphin-abi.vercel.app", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS", "Content-Type": "application/json", "Cache-Control": "no-store", "Vary": "Origin"};
}
function json(req: Request, body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: cors(req) }); }
function temporaryPassword() {
  const bytes = crypto.getRandomValues(new Uint8Array(15));
  return `Da!${btoa(String.fromCharCode(...bytes)).replaceAll("+", "A").replaceAll("/", "b").replaceAll("=", "")}7x`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const origin = req.headers.get("origin") ?? "";
  if (origin && !allowedOrigins.has(origin)) return json(req, { error: "Forbidden" }, 403);
  const admin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", { auth: { persistSession: false, autoRefreshToken: false } });
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const { data: authData, error: authError } = await admin.auth.getUser(token);
  if (authError || !authData.user) return json(req, { error: "Unauthorized" }, 401);
  const { data: owner } = await admin.from("organization_users").select("organization_id").eq("user_id", authData.user.id).eq("role", "owner").eq("status", "active").maybeSingle();
  if (!owner) return json(req, { error: "Owner access required" }, 403);{const {data:plat}=await admin.from("profiles").select("is_platform_admin").eq("id",authData.user.id).maybeSingle();if(!plat?.is_platform_admin){const {data:orgRow}=await admin.from("organizations").select("status,subscription_ends_on").eq("id",owner.organization_id).maybeSingle();const todayStr=new Date().toISOString().slice(0,10);if(!orgRow||orgRow.status!=="active"||(orgRow.subscription_ends_on&&orgRow.subscription_ends_on<todayStr))return json(req,{error:"Subscription suspended"},403)}}

  if (req.method === "GET") {
    const [{ data: memberships, error: membersError }, { data: branches, error: branchesError }] = await Promise.all([
      admin.from("organization_users").select("user_id,role,branch_id,status,created_at").eq("organization_id", owner.organization_id).order("created_at", { ascending: false }),
      admin.from("branches").select("id,name,status").eq("organization_id", owner.organization_id).order("name"),
    ]);
    if (membersError || branchesError) return json(req, { error: "Unable to load users" }, 500);
    const ids = (memberships ?? []).map((item) => item.user_id);
    const { data: profiles, error: profilesError } = ids.length
      ? await admin.from("profiles").select("id,username,full_name,phone,must_change_password,account_status,last_login_at,created_at").in("id", ids)
      : { data: [], error: null };
    if (profilesError) return json(req, { error: "Unable to load profiles" }, 500);
    const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
    const users = (memberships ?? []).map((membership) => ({ ...profileMap.get(membership.user_id), role: membership.role, branch_id: membership.branch_id, membership_status: membership.status }));
    return json(req, { users, branches: branches ?? [], current_user_id: authData.user.id });
  }

  if (req.method === "POST") {
    let createdUserId = "";
    try {
      const body = await req.json();
      const username = String(body.username ?? "").trim().toLowerCase();
      const fullName = String(body.full_name ?? "").trim();
      const phone = String(body.phone ?? "").trim() || null;
      const role = String(body.role ?? "");
      const branchId = String(body.branch_id ?? "") || null;
      if (!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username)) return json(req, { error: "Invalid username" }, 400);
      if (fullName.length < 2 || fullName.length > 120 || !assignableRoles.has(role)) return json(req, { error: "Invalid user data" }, 400);
      if (role !== "member" && !branchId) return json(req, { error: "Branch is required" }, 400);
      if (branchId) {
        const { data: branch } = await admin.from("branches").select("id").eq("id", branchId).eq("organization_id", owner.organization_id).eq("status", "active").maybeSingle();
        if (!branch) return json(req, { error: "Invalid branch" }, 400);
      }
      const { data: duplicate } = await admin.from("profiles").select("id").eq("username", username).maybeSingle();
      if (duplicate) return json(req, { error: "Username already exists" }, 409);
      const password = temporaryPassword();
      const email = `${username}.${crypto.randomUUID()}@auth.dolphin.local`;
      const { data: created, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true, app_metadata: { role, organization_id: owner.organization_id } });
      if (createError || !created.user) throw createError ?? new Error("Unable to create user");
      createdUserId = created.user.id;
      const { error: profileError } = await admin.from("profiles").insert({ id: createdUserId, username, full_name: fullName, phone, must_change_password: true, account_status: "active" });
      if (profileError) throw profileError;
      const { error: membershipError } = await admin.from("organization_users").insert({ organization_id: owner.organization_id, user_id: createdUserId, role, branch_id: branchId, status: "active" });
      if (membershipError) throw membershipError;
      await admin.from("audit_logs").insert({organization_id:owner.organization_id,actor_user_id:authData.user.id,action:"user.create",entity_type:"profiles",entity_id:createdUserId,details:{username}});return json(req, { ok: true, user_id: createdUserId, username, temporary_password: password }, 201);
    } catch {
      if (createdUserId) await admin.auth.admin.deleteUser(createdUserId);
      return json(req, { error: "Unable to create user" }, 500);
    }
  }

  if (req.method === "PATCH") {
    const body = await req.json();
    const userId = String(body.user_id ?? "");
    const action = String(body.action ?? "");
    const { data: target } = await admin.from("organization_users").select("user_id,role").eq("organization_id", owner.organization_id).eq("user_id", userId).maybeSingle();
    if (!target) return json(req, { error: "User not found" }, 404);
    if (target.role === "owner") return json(req, { error: "Owner account cannot be changed here" }, 400);
    if (action === "reset_password") {
      const password = temporaryPassword();
      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) return json(req, { error: "Unable to reset password" }, 500);
      await admin.from("profiles").update({ must_change_password: true }).eq("id", userId);
      return json(req, { ok: true, temporary_password: password });
    }
    if (action === "set_status") {
      const status = body.status === "active" ? "active" : "blocked";
      const { error: profileError } = await admin.from("profiles").update({ account_status: status }).eq("id", userId);
      const { error: membershipError } = await admin.from("organization_users").update({ status: status === "active" ? "active" : "inactive" }).eq("organization_id", owner.organization_id).eq("user_id", userId);
      const { error: authUpdateError } = await admin.auth.admin.updateUserById(userId, { ban_duration: status === "active" ? "none" : "876000h" });
      if (profileError || membershipError || authUpdateError) return json(req, { error: "Unable to update status" }, 500);
      return json(req, { ok: true, status });
    }
    if (action === "update_access") {
      const role = String(body.role ?? "");
      const branchId = String(body.branch_id ?? "") || null;
      if (!assignableRoles.has(role) || (role !== "member" && !branchId)) return json(req, { error: "Invalid access settings" }, 400);
      if (branchId) {
        const { data: branch } = await admin.from("branches").select("id").eq("id", branchId).eq("organization_id", owner.organization_id).eq("status", "active").maybeSingle();
        if (!branch) return json(req, { error: "Invalid branch" }, 400);
      }
      const { error } = await admin.from("organization_users").update({ role, branch_id: branchId }).eq("organization_id", owner.organization_id).eq("user_id", userId);
      if (error) return json(req, { error: "Unable to update access" }, 500);
      await admin.auth.admin.updateUserById(userId, { app_metadata: { role, organization_id: owner.organization_id } });
      return json(req, { ok: true });
    }
    return json(req, { error: "Unknown action" }, 400);
  }
  return json(req, { error: "Method not allowed" }, 405);
});
