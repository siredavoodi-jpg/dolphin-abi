import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.95.0";
const origins=new Set(["https://dolphin-abi-pool.gerayeli60.chatgpt.site","https://dolphin-abi.vercel.app","http://localhost:3000","http://localhost:3001"]),roles=new Set(["owner","branch_manager","receptionist"]);
function cors(req:Request){const o=req.headers.get("origin")??"";return{"Access-Control-Allow-Origin":origins.has(o)?o:"https://dolphin-abi.vercel.app","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"GET, POST, PATCH, OPTIONS","Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin"}}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:cors(req)})}
function txt(v:unknown,max:number){return String(v??"").trim().slice(0,max)}
function validDate(v:unknown){const s=String(v??"");return /^\d{4}-\d{2}-\d{2}$/.test(s)?s:null}
function addDays(date:string,days:number){const d=new Date(date+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors(req)});const o=req.headers.get("origin")??"";if(o&&!origins.has(o))return json(req,{error:"Forbidden"},403);
 const admin=createClient(Deno.env.get("SUPABASE_URL")??"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"",{auth:{persistSession:false,autoRefreshToken:false}});
 const token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"")??"";const {data:a,error:ae}=await admin.auth.getUser(token);if(ae||!a.user)return json(req,{error:"Unauthorized"},401);
 const {data:access}=await admin.from("organization_users").select("organization_id,role,branch_id,status").eq("user_id",a.user.id).eq("status","active").maybeSingle();if(!access||!roles.has(access.role))return json(req,{error:"Staff access required"},403);
 const org=access.organization_id,scope=access.role==="owner"?null:access.branch_id;if(access.role!=="owner"&&!scope)return json(req,{error:"Branch access required"},403);{const {data:plat}=await admin.from("profiles").select("is_platform_admin").eq("id",auth.user.id).maybeSingle();if(!plat?.is_platform_admin){const {data:orgRow}=await admin.from("organizations").select("status,subscription_ends_on").eq("id",org).maybeSingle();const todayStr=new Date().toISOString().slice(0,10);if(!orgRow||orgRow.status!=="active"||(orgRow.subscription_ends_on&&orgRow.subscription_ends_on<todayStr))return json(req,{error:"Subscription suspended"},403)}}
 if(req.method==="GET"){
  let memberQ=admin.from("members").select("id,member_number,full_name,home_branch_id,status").eq("organization_id",org).eq("status","active").order("full_name").limit(500);
  let membershipQ=admin.from("memberships").select("id,branch_id,member_id,plan_id,starts_on,ends_on,remaining_sessions,status,created_at").eq("organization_id",org).order("created_at",{ascending:false}).limit(500);
  let branchQ=admin.from("branches").select("id,name,status").eq("organization_id",org).eq("status","active").order("name");
  if(scope){memberQ=memberQ.eq("home_branch_id",scope);membershipQ=membershipQ.eq("branch_id",scope);branchQ=branchQ.eq("id",scope)}
  const [{data:plans,error:pe},{data:members,error:me},{data:memberships,error:mse},{data:branches,error:be}]=await Promise.all([admin.from("membership_plans").select("id,name,duration_days,session_limit,price_amount,currency,is_active,created_at").eq("organization_id",org).order("created_at"),memberQ,membershipQ,branchQ]);
  if(pe||me||mse||be)return json(req,{error:"Unable to load memberships"},500);
  return json(req,{plans:plans??[],members:members??[],memberships:memberships??[],branches:branches??[],access:{role:access.role,branch_id:access.branch_id}});
 }
 if(req.method==="POST"){
  const body=await req.json();
  if(body.type==="plan"){
   if(access.role!=="owner")return json(req,{error:"Owner access required"},403);
   const name=txt(body.name,120),duration=Number(body.duration_days),limit=body.session_limit==null||body.session_limit===""?null:Number(body.session_limit),price=Number(body.price_amount);
   if(name.length<2||!Number.isInteger(duration)||duration<1||duration>3650||(limit!==null&&(!Number.isInteger(limit)||limit<1||limit>10000))||!Number.isSafeInteger(price)||price<0)return json(req,{error:"Invalid plan data"},400);
   const {data,error}=await admin.from("membership_plans").insert({organization_id:org,name,duration_days:duration,session_limit:limit,price_amount:price,currency:"IRR",is_active:true}).select("id").single();
   if(error?.code==="23505")return json(req,{error:"Plan name already exists"},409);if(error||!data)return json(req,{error:"Unable to create plan"},500);return json(req,{ok:true,id:data.id},201);
  }
  if(body.type==="membership"){
   const memberId=txt(body.member_id,50),planId=txt(body.plan_id,50),branchId=txt(body.branch_id,50),starts=validDate(body.starts_on);
   if(!memberId||!planId||!branchId||!starts)return json(req,{error:"Invalid membership data"},400);if(scope&&branchId!==scope)return json(req,{error:"Branch access denied"},403);
   const [{data:member},{data:plan},{data:branch}]=await Promise.all([admin.from("members").select("id,home_branch_id,status").eq("id",memberId).eq("organization_id",org).eq("status","active").maybeSingle(),admin.from("membership_plans").select("id,duration_days,session_limit,is_active").eq("id",planId).eq("organization_id",org).eq("is_active",true).maybeSingle(),admin.from("branches").select("id").eq("id",branchId).eq("organization_id",org).eq("status","active").maybeSingle()]);
   if(!member||!plan||!branch)return json(req,{error:"Invalid membership references"},400);if(scope&&member.home_branch_id!==scope)return json(req,{error:"Branch access denied"},403);
   const ends=addDays(starts,plan.duration_days-1);
   const {count}=await admin.from("memberships").select("id",{count:"exact",head:true}).eq("organization_id",org).eq("member_id",memberId).in("status",["active","pending"]).gte("ends_on",starts);
   if((count??0)>0)return json(req,{error:"Member already has an overlapping membership"},409);
   const {data,error}=await admin.from("memberships").insert({organization_id:org,branch_id:branchId,member_id:memberId,plan_id:planId,starts_on:starts,ends_on:ends,remaining_sessions:plan.session_limit,status:"pending",created_by:a.user.id}).select("id,ends_on").single();
   if(error||!data)return json(req,{error:"Unable to issue membership"},500);return json(req,{ok:true,id:data.id,ends_on:data.ends_on},201);
  }
  return json(req,{error:"Unknown create type"},400);
 }
 if(req.method==="PATCH"){
  const body=await req.json();
  if(body.type==="plan"){
   if(access.role!=="owner")return json(req,{error:"Owner access required"},403);const id=txt(body.plan_id,50);
   if(body.action==="set_status"){const {error}=await admin.from("membership_plans").update({is_active:body.is_active===true}).eq("id",id).eq("organization_id",org);if(error)return json(req,{error:"Unable to update plan"},500);return json(req,{ok:true})}
   const name=txt(body.name,120),duration=Number(body.duration_days),limit=body.session_limit==null||body.session_limit===""?null:Number(body.session_limit),price=Number(body.price_amount);
   if(name.length<2||!Number.isInteger(duration)||duration<1||(limit!==null&&(!Number.isInteger(limit)||limit<1))||!Number.isSafeInteger(price)||price<0)return json(req,{error:"Invalid plan data"},400);
   const {error}=await admin.from("membership_plans").update({name,duration_days:duration,session_limit:limit,price_amount:price}).eq("id",id).eq("organization_id",org);if(error?.code==="23505")return json(req,{error:"Plan name already exists"},409);if(error)return json(req,{error:"Unable to update plan"},500);return json(req,{ok:true});
  }
  if(body.type==="membership"&&body.action==="cancel"){
   const id=txt(body.membership_id,50);let q=admin.from("memberships").update({status:"cancelled"}).eq("id",id).eq("organization_id",org).in("status",["active","pending"]);if(scope)q=q.eq("branch_id",scope);const {error}=await q;if(error)return json(req,{error:"Unable to cancel membership"},500);return json(req,{ok:true});
  }
  return json(req,{error:"Unknown action"},400);
 }
 return json(req,{error:"Method not allowed"},405);
});
