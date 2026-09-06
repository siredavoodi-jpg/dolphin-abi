// One-shot: injects subscription enforcement into admin edge functions.
import { readFileSync, writeFileSync } from "node:fs";
const root = new URL("../supabase/functions/", import.meta.url);
const check = (orgExpr, userIdExpr) =>
`{const {data:plat}=await admin.from("profiles").select("is_platform_admin").eq("id",${userIdExpr}).maybeSingle();if(!plat?.is_platform_admin){const {data:orgRow}=await admin.from("organizations").select("status,subscription_ends_on").eq("id",${orgExpr}).maybeSingle();const todayStr=new Date().toISOString().slice(0,10);if(!orgRow||orgRow.status!=="active"||(orgRow.subscription_ends_on&&orgRow.subscription_ends_on<todayStr))return json(req,{error:"Subscription suspended"},403)}}`;

const jobs = [
  { file: "admin-users/index.ts", anchor: 'if (!owner) return json(req, { error: "Owner access required" }, 403);', snippet: check("owner.organization_id", "authData.user.id") },
  { file: "admin-branches/index.ts", anchor: 'if(!owner)return json(req,{error:"Owner access required"},403);', snippet: check("owner.organization_id", "authData.user.id") },
  { file: "admin-members/index.ts", anchor: 'if(!isOwner&&!scopedBranch)return json(req,{error:"Branch access required"},403);', snippet: check("organizationId", "authData.user.id") },
  { file: "admin-payments/index.ts", anchor: 'if(access.role!=="owner"&&!scopedBranch)return json(req,{error:"Branch access required"},403);', snippet: check("organizationId", "auth.user.id") },
  { file: "admin-memberships/index.ts", anchor: 'if(access.role!=="owner"&&!scope)return json(req,{error:"Branch access required"},403);', snippet: check("org", "auth.user.id") },
  { file: "admin-attendance/index.ts", anchor: 'if(access.role!=="owner"&&!scope)return json(req,{error:"Branch access required"},403);', snippet: check("org", "auth.user.id") },
  { file: "admin-sessions/index.ts", anchor: 'if(access.role!=="owner"&&!scope)return json(req,{error:"Branch access required"},403);', snippet: check("org", "auth.user.id") },
  { file: "dashboard-summary/index.ts", anchor: 'if(access.role!=="owner"&&!scope)return json(req,{error:"Branch access required"},403);', snippet: check("org", "auth.user.id") },
];
for (const job of jobs) {
  const path = new URL(job.file, root);
  let src = readFileSync(path, "utf8");
  if (src.includes("Subscription suspended")) { console.log("skip (already patched):", job.file); continue; }
  if (!src.includes(job.anchor)) { console.error("ANCHOR NOT FOUND:", job.file); process.exitCode = 1; continue; }
  src = src.replace(job.anchor, job.anchor + job.snippet);
  writeFileSync(path, src);
  console.log("patched:", job.file);
}
