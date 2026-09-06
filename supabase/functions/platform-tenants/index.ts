import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.95.0";
const origins=new Set(["https://dolphin-abi-pool.gerayeli60.chatgpt.site","https://dolphin-abi.vercel.app","http://localhost:3000","http://localhost:3001"]);
function cors(req:Request){const o=req.headers.get("origin")??"";return{"Access-Control-Allow-Origin":origins.has(o)?o:"https://dolphin-abi.vercel.app","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin"}}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:cors(req)})}
function txt(v:unknown,n:number){return String(v??"").trim().slice(0,n)}
function tempPassword(){const alphabet="ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";let out="";const bytes=new Uint8Array(14);crypto.getRandomValues(bytes);for(const b of bytes)out+=alphabet[b%alphabet.length];return "Dl-"+out+"9x"}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors(req)});
 const origin=req.headers.get("origin")??"";if(origin&&!origins.has(origin))return json(req,{error:"Forbidden"},403);
 const admin=createClient(Deno.env.get("SUPABASE_URL")??"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"",{auth:{persistSession:false,autoRefreshToken:false}});
 const token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"")??"";const {data:auth,error:authError}=await admin.auth.getUser(token);if(authError||!auth.user)return json(req,{error:"Unauthorized"},401);
 const {data:me}=await admin.from("profiles").select("id,is_platform_admin,account_status").eq("id",auth.user.id).maybeSingle();
 if(!me||!me.is_platform_admin||me.account_status!=="active")return json(req,{error:"Platform admin access required"},403);
 async function audit(organizationId:string|null,action:string,entityType:string,entityId:string|null,details:Record<string,unknown>){await admin.from("audit_logs").insert({organization_id:organizationId,actor_user_id:auth.user.id,action,entity_type:entityType,entity_id:entityId,details})}
 const today=new Date().toISOString().slice(0,10);
 if(req.method==="GET"){
  const detailId=new URL(req.url).searchParams.get("org_id")??"";
  const {data:orgs,error:orgsError}=await admin.from("organizations").select("id,name,slug,status,subscription_ends_on,created_at").order("created_at",{ascending:false});
  if(orgsError)return json(req,{error:"Unable to load organizations"},500);
  if(detailId&&!orgs?.some(o=>o.id===detailId))return json(req,{error:"Organization not found"},404);
  const {data:branchRows}=await admin.from("branches").select("id,organization_id,name,status,capacity"),{data:userRows}=await admin.from("organization_users").select("organization_id,user_id,role,branch_id,status"),{data:profileRows}=await admin.from("profiles").select("id,username,full_name,account_status,must_change_password,last_login_at"),{data:memberRows}=await admin.from("members").select("organization_id,status");
  const branchCount=new Map<string,number>(),userCount=new Map<string,number>(),memberCount=new Map<string,number>(),activeMemberCount=new Map<string,number>();
  for(const b of branchRows??[])branchCount.set(b.organization_id,(branchCount.get(b.organization_id)??0)+1);
  for(const u of userRows??[])userCount.set(u.organization_id,(userCount.get(u.organization_id)??0)+1);
  for(const m of memberRows??[]){memberCount.set(m.organization_id,(memberCount.get(m.organization_id)??0)+1);if(m.status==="active")activeMemberCount.set(m.organization_id,(activeMemberCount.get(m.organization_id)??0)+1)}
  const profileMap=new Map((profileRows??[]).map(p=>[p.id,p]));
  if(detailId){
   const users=(userRows??[]).filter(u=>u.organization_id===detailId).map(u=>({user_id:u.user_id,role:u.role,branch_id:u.branch_id,status:u.status,username:profileMap.get(u.user_id)?.username??null,full_name:profileMap.get(u.user_id)?.full_name??"کاربر",account_status:profileMap.get(u.user_id)?.account_status??"active",must_change_password:profileMap.get(u.user_id)?.must_change_password??false,last_login_at:profileMap.get(u.user_id)?.last_login_at??null}));
   return json(req,{organization:orgs?.find(o=>o.id===detailId)??null,branches:(branchRows??[]).filter(b=>b.organization_id===detailId),users});
  }
  return json(req,{organizations:(orgs??[]).map(o=>({...o,branch_count:branchCount.get(o.id)??0,user_count:userCount.get(o.id)??0,member_count:memberCount.get(o.id)??0,active_member_count:activeMemberCount.get(o.id)??0,expired:o.subscription_ends_on!==null&&o.subscription_ends_on<today}))});
 }
 if(req.method==="POST"){
  const body=await req.json(),name=txt(body.name,120),branchName=txt(body.branch_name,120)||"شعبه مرکزی",ownerName=txt(body.owner_full_name,120),username=txt(body.username,32).toLowerCase(),endsOn=txt(body.ends_on,10)||null,slugInput=txt(body.slug,60).toLowerCase();
  if(name.length<2||ownerName.length<2||!/^[a-z0-9][a-z0-9._-]{2,31}$/.test(username))return json(req,{error:"Invalid tenant data"},400);
  if(endsOn&&!/^\d{4}-\d{2}-\d{2}$/.test(endsOn))return json(req,{error:"Invalid tenant data"},400);
  let slug=/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slugInput)?slugInput:"org-"+crypto.randomUUID().slice(0,8);
  const {data:slugTaken}=await admin.from("organizations").select("id").eq("slug",slug).maybeSingle();if(slugTaken)slug=slug+"-"+crypto.randomUUID().slice(0,4);
  const {data:usernameTaken}=await admin.from("profiles").select("id").eq("username",username).maybeSingle();
  const finalUsername=usernameTaken?username.slice(0,24)+"-"+crypto.randomUUID().slice(0,4):username;
  const {data:org,error:orgError}=await admin.from("organizations").insert({name,slug,subscription_ends_on:endsOn}).select("id,slug").single();
  if(orgError)return json(req,{error:orgError.message.includes("slug")?"Slug already exists":"Unable to create organization"},400);
  const {data:branch,error:branchError}=await admin.from("branches").insert({organization_id:org.id,name:branchName,code:"MAIN",capacity:50}).select("id").single();
  if(branchError){await admin.from("organizations").delete().eq("id",org.id);return json(req,{error:"Unable to create branch"},500)}
  const tempPass=tempPassword(),email=`${finalUsername}-${crypto.randomUUID().slice(0,6)}@tenants.dolphinabi.local`;
  const {data:authUser,error:userError}=await admin.auth.admin.createUser({email,password:tempPass,email_confirm:true});
  if(userError||!authUser.user){await admin.from("organizations").delete().eq("id",org.id);return json(req,{error:"Unable to create owner user"},500)}
  const {error:profileError}=await admin.from("profiles").insert({id:authUser.user.id,username:finalUsername,full_name:ownerName,must_change_password:true});
  if(profileError){await admin.auth.admin.deleteUser(authUser.user.id);await admin.from("organizations").delete().eq("id",org.id);return json(req,{error:"Username already exists"},409)}
  const {error:linkError}=await admin.from("organization_users").insert({organization_id:org.id,user_id:authUser.user.id,role:"owner"});
  if(linkError){await admin.auth.admin.deleteUser(authUser.user.id);await admin.from("organizations").delete().eq("id",org.id);return json(req,{error:"Unable to link owner"},500)}
  await audit(org.id,"tenant.create","organizations",org.id,{name,slug,username:finalUsername});
  return json(req,{ok:true,org_id:org.id,slug,username:finalUsername,temp_password:tempPass,branch_id:branch.id},201);
 }
 if(req.method==="PATCH"){
  const body=await req.json(),orgId=txt(body.org_id,50),action=txt(body.action,30);
  const {data:org}=await admin.from("organizations").select("id,name,status,subscription_ends_on").eq("id",orgId).maybeSingle();
  if(!org)return json(req,{error:"Organization not found"},404);
  if(action==="set_subscription"){const endsOn=txt(body.ends_on,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(endsOn))return json(req,{error:"Invalid date"},400);const {error}=await admin.from("organizations").update({subscription_ends_on:endsOn,status:"active"}).eq("id",orgId);if(error)return json(req,{error:"Unable to update subscription"},500);await audit(orgId,"tenant.subscription","organizations",orgId,{ends_on:endsOn});return json(req,{ok:true,subscription_ends_on:endsOn})}
  if(action==="set_status"){const status=body.status==="suspended"?"suspended":"active";const {error}=await admin.from("organizations").update({status}).eq("id",orgId);if(error)return json(req,{error:"Unable to update status"},500);await audit(orgId,"tenant.status","organizations",orgId,{status});return json(req,{ok:true,status})}
  if(action==="reset_user_password"){const userId=txt(body.user_id,50);const {data:target}=await admin.from("organization_users").select("user_id,role").eq("organization_id",orgId).eq("user_id",userId).maybeSingle();if(!target)return json(req,{error:"User not found in organization"},404);const tempPass=tempPassword();const {error}=await admin.auth.admin.updateUserById(userId,{password:tempPass});if(error)return json(req,{error:"Unable to reset password"},500);await admin.from("profiles").update({must_change_password:true}).eq("id",userId);await audit(orgId,"tenant.password_reset","profiles",userId,{});return json(req,{ok:true,temp_password:tempPass})}
  return json(req,{error:"Unknown action"},400);
 }
 return json(req,{error:"Method not allowed"},405);
});
