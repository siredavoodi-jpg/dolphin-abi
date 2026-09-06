// One-shot: insert audit_logs writes before success returns in admin edge functions.
import { readFileSync, writeFileSync } from "node:fs";
const root = new URL("../supabase/functions/", import.meta.url);
const audit = (org, actor, action, entity, idExpr, details) =>
`await admin.from("audit_logs").insert({organization_id:${org},actor_user_id:${actor},action:"${action}",entity_type:"${entity}",entity_id:${idExpr},details:${details}});`;

const jobs = [
  { file: "admin-payments/index.ts",
    anchor: `if(error)return json(req,{error:error.message},error.code==="23505"?409:400);return json(req,{ok:true,id:data},201);`,
    insert: audit("organizationId", "auth.user.id", "payment.register", "payment_records", "data", "{method}") },
  { file: "admin-payments/index.ts",
    anchor: `if(error)return json(req,{error:error.message},400);return json(req,{ok:true});`,
    insert: audit("organizationId", "auth.user.id", "payment.void", "payment_records", "paymentId", "{reason}") },
  { file: "admin-members/index.ts",
    anchor: `return json(req,{ok:true,id:data.id,member_number:data.member_number},201);`,
    insert: audit("organizationId", "authData.user.id", "member.create", "members", "data.id", "{member_number:data.member_number}") },
  { file: "admin-members/index.ts",
    anchor: `return json(req,{ok:true,status});`,
    insert: audit("organizationId", "authData.user.id", "member.status", "members", "memberId", "{status}") },
  { file: "admin-members/index.ts",
    anchor: `return json(req,{ok:true});`,
    insert: audit("organizationId", "authData.user.id", "member.update", "members", "memberId", "{}") },
  { file: "admin-memberships/index.ts",
    anchor: `if(error||!data)return json(req,{error:"Unable to create plan"},500);return json(req,{ok:true,id:data.id},201);`,
    insert: audit("org", "auth.user.id", "plan.create", "membership_plans", "data.id", "{}") },
  { file: "admin-memberships/index.ts",
    anchor: `if(error||!data)return json(req,{error:"Unable to issue membership"},500);return json(req,{ok:true,id:data.id,ends_on:data.ends_on},201);`,
    insert: audit("org", "auth.user.id", "membership.issue", "memberships", "data.id", "{}") },
  { file: "admin-memberships/index.ts",
    anchor: `if(error)return json(req,{error:"Unable to cancel membership"},500);return json(req,{ok:true});`,
    insert: audit("org", "auth.user.id", "membership.cancel", "memberships", "id", "{}") },
  { file: "admin-sessions/index.ts",
    anchor: `if(error)return json(req,{error:"Unable to create session"},500);return json(req,{ok:true,id:data.id},201)`,
    insert: audit("org", "auth.user.id", "session.create", "pool_sessions", "data.id", "{title}") },
  { file: "admin-sessions/index.ts",
    anchor: `if(error)return json(req,{error:error.message},error.code==="23505"?409:400);return json(req,{ok:true,id:data},201)`,
    insert: audit("org", "auth.user.id", "reservation.create", "session_reservations", "data", "{}") },
  { file: "admin-sessions/index.ts",
    anchor: `if(error)return json(req,{error:error.message},400);return json(req,{ok:true})`,
    insert: audit("org", "auth.user.id", "reservation.cancel", "session_reservations", "r.id", "{}") },
  { file: "admin-sessions/index.ts",
    anchor: `if(error)return json(req,{error:"Unable to update session"},500);return json(req,{ok:true})`,
    insert: audit("org", "auth.user.id", "session.status", "pool_sessions", "id", "{status}") },
  { file: "admin-users/index.ts",
    anchor: `return json(req, { ok: true, user_id: createdUserId, username, temporary_password: password }, 201);`,
    insert: audit("owner.organization_id", "authData.user.id", "user.create", "profiles", "createdUserId", "{username}") },
];
let n = 0;
for (const job of jobs) {
  const path = new URL(job.file, root);
  let src = readFileSync(path, "utf8");
  if (!src.includes(job.anchor)) { console.error("ANCHOR NOT FOUND in", job.file, ":", job.anchor.slice(0, 60)); process.exitCode = 1; continue; }
  src = src.replace(job.anchor, job.insert + job.anchor);
  writeFileSync(path, src);
  n++;
  console.log("patched:", job.file);
}
console.log("total:", n);
