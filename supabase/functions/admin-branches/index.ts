import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.95.0";

const allowedOrigins = new Set(["https://dolphin-abi-pool.gerayeli60.chatgpt.site", "https://dolphin-abi.vercel.app", "http://localhost:3000", "http://localhost:3001"]);
function cors(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {"Access-Control-Allow-Origin":allowedOrigins.has(origin)?origin:"https://dolphin-abi.vercel.app","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"GET, POST, PATCH, DELETE, OPTIONS","Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin"};
}
function json(req: Request, body: unknown, status=200){return new Response(JSON.stringify(body),{status,headers:cors(req)})}
function cleanText(value: unknown, max: number){return String(value??"").trim().slice(0,max)}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors(req)});
 const origin=req.headers.get("origin")??"";
 if(origin&&!allowedOrigins.has(origin))return json(req,{error:"Forbidden"},403);
 const admin=createClient(Deno.env.get("SUPABASE_URL")??"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"",{auth:{persistSession:false,autoRefreshToken:false}});
 const token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"")??"";
 const {data:authData,error:authError}=await admin.auth.getUser(token);
 if(authError||!authData.user)return json(req,{error:"Unauthorized"},401);
 const {data:owner}=await admin.from("organization_users").select("organization_id").eq("user_id",authData.user.id).eq("role","owner").eq("status","active").maybeSingle();
 if(!owner)return json(req,{error:"Owner access required"},403);
 const organizationId=owner.organization_id;

 if(req.method==="GET"){
  const [{data:branches,error:branchError},{data:memberships,error:userError},{data:members,error:memberError},{data:sessions,error:sessionError}]=await Promise.all([
   admin.from("branches").select("id,name,code,phone,address,capacity,status,created_at,updated_at").eq("organization_id",organizationId).order("created_at"),
   admin.from("organization_users").select("user_id,role,branch_id,status").eq("organization_id",organizationId),
   admin.from("members").select("id,home_branch_id,status").eq("organization_id",organizationId),
   admin.from("pool_sessions").select("id,branch_id,status").eq("organization_id",organizationId),
  ]);
  if(branchError||userError||memberError||sessionError)return json(req,{error:"Unable to load branches"},500);
  const userIds=(memberships??[]).map(item=>item.user_id);
  const {data:profiles,error:profilesError}=userIds.length?await admin.from("profiles").select("id,full_name,username,account_status").in("id",userIds):{data:[],error:null};
  if(profilesError)return json(req,{error:"Unable to load managers"},500);
  const profileMap=new Map((profiles??[]).map(profile=>[profile.id,profile]));
  const users=(memberships??[]).map(item=>({...profileMap.get(item.user_id),role:item.role,branch_id:item.branch_id,status:item.status}));
  const result=(branches??[]).map(branch=>{
   const branchUsers=users.filter(user=>user.branch_id===branch.id);
   return {...branch,user_count:branchUsers.length,member_count:(members??[]).filter(member=>member.home_branch_id===branch.id).length,active_member_count:(members??[]).filter(member=>member.home_branch_id===branch.id&&member.status==="active").length,session_count:(sessions??[]).filter(session=>session.branch_id===branch.id).length,managers:branchUsers.filter(user=>user.role==="branch_manager")};
  });
  return json(req,{branches:result,eligible_managers:users.filter(user=>user.role!=="owner"&&user.account_status==="active"&&user.status==="active")});
 }

 if(req.method==="POST"){
  const body=await req.json(),name=cleanText(body.name,120),code=cleanText(body.code,20).toLowerCase(),phone=cleanText(body.phone,30)||null,address=cleanText(body.address,500)||null,capacity=Number(body.capacity);
  if(name.length<2||!/^[a-z0-9][a-z0-9_-]{1,19}$/.test(code)||!Number.isInteger(capacity)||capacity<0||capacity>100000)return json(req,{error:"Invalid branch data"},400);
  const {data,error}=await admin.from("branches").insert({organization_id:organizationId,name,code,phone,address,capacity,status:"active"}).select("id").single();
  if(error?.code==="23505")return json(req,{error:"Branch code already exists"},409);
  if(error||!data)return json(req,{error:"Unable to create branch"},500);
  return json(req,{ok:true,id:data.id},201);
 }

 if(req.method==="PATCH"){
  const body=await req.json(),branchId=String(body.branch_id??"");
  const {data:branch}=await admin.from("branches").select("id,status").eq("id",branchId).eq("organization_id",organizationId).maybeSingle();
  if(!branch)return json(req,{error:"Branch not found"},404);
  if(body.action==="update"){
   const name=cleanText(body.name,120),code=cleanText(body.code,20).toLowerCase(),phone=cleanText(body.phone,30)||null,address=cleanText(body.address,500)||null,capacity=Number(body.capacity);
   if(name.length<2||!/^[a-z0-9][a-z0-9_-]{1,19}$/.test(code)||!Number.isInteger(capacity)||capacity<0||capacity>100000)return json(req,{error:"Invalid branch data"},400);
   const {error}=await admin.from("branches").update({name,code,phone,address,capacity}).eq("id",branchId).eq("organization_id",organizationId);
   if(error?.code==="23505")return json(req,{error:"Branch code already exists"},409);
   if(error)return json(req,{error:"Unable to update branch"},500);
   return json(req,{ok:true});
  }
  if(body.action==="set_status"){
   const status=body.status==="active"?"active":"inactive";
   if(status==="inactive"){
    const {count}=await admin.from("organization_users").select("user_id",{count:"exact",head:true}).eq("organization_id",organizationId).eq("branch_id",branchId).eq("status","active");
    if((count??0)>0)return json(req,{error:"Move or deactivate active branch users first"},409);
   }
   const {error}=await admin.from("branches").update({status}).eq("id",branchId).eq("organization_id",organizationId);
   if(error)return json(req,{error:"Unable to update status"},500);
   return json(req,{ok:true,status});
  }
  if(body.action==="assign_manager"){
   const managerId=String(body.manager_id??"")||null;
   if(managerId){
    const {data:candidate}=await admin.from("organization_users").select("user_id").eq("organization_id",organizationId).eq("user_id",managerId).neq("role","owner").eq("status","active").maybeSingle();
    if(!candidate)return json(req,{error:"Invalid manager"},400);
   }
   const {data:currentManagers}=await admin.from("organization_users").select("user_id").eq("organization_id",organizationId).eq("branch_id",branchId).eq("role","branch_manager");
   const demoteIds=(currentManagers??[]).map(item=>item.user_id).filter(id=>id!==managerId);
   if(demoteIds.length){
    await admin.from("organization_users").update({role:"receptionist"}).eq("organization_id",organizationId).in("user_id",demoteIds);
    await Promise.all(demoteIds.map(userId=>admin.auth.admin.updateUserById(userId,{app_metadata:{role:"receptionist",organization_id:organizationId}})));
   }
   if(managerId){
    const {error}=await admin.from("organization_users").update({role:"branch_manager",branch_id:branchId}).eq("organization_id",organizationId).eq("user_id",managerId);
    if(error)return json(req,{error:"Unable to assign manager"},500);
    await admin.auth.admin.updateUserById(managerId,{app_metadata:{role:"branch_manager",organization_id:organizationId}});
   }
   return json(req,{ok:true});
  }
  return json(req,{error:"Unknown action"},400);
 }

 if(req.method==="DELETE"){
  const branchId=new URL(req.url).searchParams.get("branch_id")??"";
  const {data:branch}=await admin.from("branches").select("id").eq("id",branchId).eq("organization_id",organizationId).maybeSingle();
  if(!branch)return json(req,{error:"Branch not found"},404);
  const checks=[["organization_users","branch_id"],["members","home_branch_id"],["memberships","branch_id"],["payment_records","branch_id"],["pool_sessions","branch_id"],["attendance_events","branch_id"]] as const;
  const counts=await Promise.all(checks.map(([table,column])=>admin.from(table).select("*",{count:"exact",head:true}).eq(column,branchId)));
  if(counts.some(result=>(result.count??0)>0))return json(req,{error:"Branch has related records and cannot be deleted"},409);
  const {error}=await admin.from("branches").delete().eq("id",branchId).eq("organization_id",organizationId);
  if(error)return json(req,{error:"Unable to delete branch"},500);
  return json(req,{ok:true});
 }
 return json(req,{error:"Method not allowed"},405);
});
