import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.95.0";
const allowedOrigins=new Set(["https://dolphin-abi-pool.gerayeli60.chatgpt.site","https://dolphin-abi.vercel.app","http://localhost:3000","http://localhost:3001"]);
const staffRoles=new Set(["owner","branch_manager","receptionist"]);
function cors(req:Request){const origin=req.headers.get("origin")??"";return{"Access-Control-Allow-Origin":allowedOrigins.has(origin)?origin:"https://dolphin-abi.vercel.app","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"GET, POST, PATCH, OPTIONS","Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin"}}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:cors(req)})}
function text(value:unknown,max:number){return String(value??"").trim().slice(0,max)}
function dateOrNull(value:unknown){const valueText=String(value??"");return /^\d{4}-\d{2}-\d{2}$/.test(valueText)?valueText:null}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors(req)});
 const origin=req.headers.get("origin")??"";if(origin&&!allowedOrigins.has(origin))return json(req,{error:"Forbidden"},403);
 const admin=createClient(Deno.env.get("SUPABASE_URL")??"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"",{auth:{persistSession:false,autoRefreshToken:false}});
 const token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"")??"";
 const {data:authData,error:authError}=await admin.auth.getUser(token);if(authError||!authData.user)return json(req,{error:"Unauthorized"},401);
 const {data:access}=await admin.from("organization_users").select("organization_id,role,branch_id,status").eq("user_id",authData.user.id).eq("status","active").maybeSingle();
 if(!access||!staffRoles.has(access.role))return json(req,{error:"Staff access required"},403);
 const organizationId=access.organization_id,isOwner=access.role==="owner",scopedBranch=isOwner?null:access.branch_id;
 if(!isOwner&&!scopedBranch)return json(req,{error:"Branch access required"},403);{const {data:plat}=await admin.from("profiles").select("is_platform_admin").eq("id",authData.user.id).maybeSingle();if(!plat?.is_platform_admin){const {data:orgRow}=await admin.from("organizations").select("status,subscription_ends_on").eq("id",organizationId).maybeSingle();const todayStr=new Date().toISOString().slice(0,10);if(!orgRow||orgRow.status!=="active"||(orgRow.subscription_ends_on&&orgRow.subscription_ends_on<todayStr))return json(req,{error:"Subscription suspended"},403)}}

 if(req.method==="GET"){
  const url=new URL(req.url),detailId=url.searchParams.get("id")??"";
  if(detailId){
   const {data:member}=await admin.from("members").select("id,home_branch_id,member_number,full_name,phone,national_id,birth_date,emergency_phone,status,notes,created_by,created_at,updated_at").eq("organization_id",organizationId).eq("id",detailId).maybeSingle();
   if(!member)return json(req,{error:"Member not found"},404);
   if(scopedBranch&&member.home_branch_id!==scopedBranch)return json(req,{error:"Branch access denied"},403);
   const [membershipRes,paymentRes,reservationRes,attendanceRes,branchRes,planRes]=await Promise.all([
    admin.from("memberships").select("id,plan_id,status,starts_on,ends_on,remaining_sessions,created_at").eq("organization_id",organizationId).eq("member_id",detailId).order("created_at",{ascending:false}),
    admin.from("payment_records").select("id,branch_id,membership_id,amount,method,status,reference_number,received_by,paid_at,voided_at,void_reason").eq("organization_id",organizationId).eq("member_id",detailId).order("paid_at",{ascending:false}),
    admin.from("session_reservations").select("id,session_id,status,reserved_at,cancelled_at").eq("organization_id",organizationId).eq("member_id",detailId).order("reserved_at",{ascending:false}).limit(100),
    admin.from("attendance_events").select("id,branch_id,session_id,event_type,occurred_at").eq("organization_id",organizationId).eq("member_id",detailId).order("occurred_at",{ascending:false}).limit(200),
    admin.from("branches").select("id,name,status").eq("organization_id",organizationId).order("name"),
    admin.from("membership_plans").select("id,name").eq("organization_id",organizationId)
   ]);
   const mErr=membershipRes.error||paymentRes.error||reservationRes.error||attendanceRes.error||branchRes.error||planRes.error;
   if(mErr)return json(req,{error:"Unable to load member detail"},500);
   const planMap=new Map((planRes.data??[]).map(plan=>[plan.id,plan.name]));
   const sessionIds=[...new Set([...(reservationRes.data??[]).map(x=>x.session_id),...(attendanceRes.data??[]).map(x=>x.session_id).filter(Boolean)])] as string[];
   const {data:sessions}=sessionIds.length?await admin.from("pool_sessions").select("id,title,starts_at,ends_at").in("id",sessionIds):{data:[]};
   const sessionMap=new Map((sessions??[]).map(x=>[x.id,x]));
   const receiverIds=[...new Set((paymentRes.data??[]).map(x=>x.received_by))];
   const {data:receivers}=receiverIds.length?await admin.from("profiles").select("id,full_name").in("id",receiverIds):{data:[]};
   const receiverMap=new Map((receivers??[]).map(x=>[x.id,x.full_name]));
   const creatorId=member.created_by;
   const {data:creator}=creatorId?await admin.from("profiles").select("id,full_name").eq("id",creatorId).maybeSingle():{data:null};
   return json(req,{
    member,branches:branchRes.data??[],
    memberships:(membershipRes.data??[]).map(x=>({...x,plan_name:planMap.get(x.plan_id)??null})),
    payments:(paymentRes.data??[]).map(x=>({...x,receiver_name:receiverMap.get(x.received_by)??null})),
    reservations:(reservationRes.data??[]).map(x=>({...x,session:sessionMap.get(x.session_id)??null})),
    attendance:(attendanceRes.data??[]).map(x=>({...x,session:sessionMap.get(x.session_id)??null})),
    created_by_name:creator?.full_name??null,
    access:{role:access.role,branch_id:access.branch_id}
   });
  }
  let branchQuery=admin.from("branches").select("id,name,status").eq("organization_id",organizationId).order("name");
  let memberQuery=admin.from("members").select("id,home_branch_id,member_number,full_name,phone,national_id,birth_date,emergency_phone,status,notes,created_at,updated_at").eq("organization_id",organizationId).order("created_at",{ascending:false}).limit(500);
  if(scopedBranch){branchQuery=branchQuery.eq("id",scopedBranch);memberQuery=memberQuery.eq("home_branch_id",scopedBranch)}
  const [{data:branches,error:branchError},{data:members,error:memberError}]=await Promise.all([branchQuery,memberQuery]);
  if(branchError||memberError)return json(req,{error:"Unable to load members"},500);
  const memberIds=(members??[]).map(member=>member.id);
  const {data:memberships,error:membershipError}=memberIds.length?await admin.from("memberships").select("member_id,plan_id,status,starts_on,ends_on,remaining_sessions").eq("organization_id",organizationId).in("member_id",memberIds).in("status",["active","pending"]).order("created_at",{ascending:false}):{data:[],error:null};
  if(membershipError)return json(req,{error:"Unable to load memberships"},500);
  const planIds=[...new Set((memberships??[]).map(item=>item.plan_id))];
  const {data:plans}=planIds.length?await admin.from("membership_plans").select("id,name").in("id",planIds):{data:[]};
  const planMap=new Map((plans??[]).map(plan=>[plan.id,plan.name])),membershipMap=new Map();
  for(const membership of memberships??[])if(!membershipMap.has(membership.member_id))membershipMap.set(membership.member_id,{...membership,plan_name:planMap.get(membership.plan_id)??null});
  return json(req,{members:(members??[]).map(member=>({...member,membership:membershipMap.get(member.id)??null})),branches:branches??[],access:{role:access.role,branch_id:access.branch_id}});
 }

 if(req.method==="POST"){
  const body=await req.json(),fullName=text(body.full_name,120),phone=text(body.phone,30)||null,nationalId=text(body.national_id,20)||null,birthDate=dateOrNull(body.birth_date),emergencyPhone=text(body.emergency_phone,30)||null,notes=text(body.notes,1000)||null,branchId=text(body.home_branch_id,50);
  if(fullName.length<2||!branchId)return json(req,{error:"Invalid member data"},400);
  if(nationalId&&!/^\d{8,12}$/.test(nationalId))return json(req,{error:"Invalid national ID"},400);
  if(scopedBranch&&branchId!==scopedBranch)return json(req,{error:"Branch access denied"},403);
  const {data:branch}=await admin.from("branches").select("id").eq("organization_id",organizationId).eq("id",branchId).eq("status","active").maybeSingle();if(!branch)return json(req,{error:"Invalid branch"},400);
  const {data,error}=await admin.from("members").insert({organization_id:organizationId,home_branch_id:branchId,full_name:fullName,phone,national_id:nationalId,birth_date:birthDate,emergency_phone:emergencyPhone,status:"active",notes,created_by:authData.user.id}).select("id,member_number").single();
  if(error?.code==="23505")return json(req,{error:"National ID already exists"},409);
  if(error||!data)return json(req,{error:"Unable to create member"},500);
  return json(req,{ok:true,id:data.id,member_number:data.member_number},201);
 }

 if(req.method==="PATCH"){
  const body=await req.json(),memberId=text(body.member_id,50);
  const {data:member}=await admin.from("members").select("id,home_branch_id").eq("organization_id",organizationId).eq("id",memberId).maybeSingle();
  if(!member)return json(req,{error:"Member not found"},404);
  if(scopedBranch&&member.home_branch_id!==scopedBranch)return json(req,{error:"Branch access denied"},403);
  if(body.action==="set_status"){
   const status=["active","inactive","blocked"].includes(body.status)?body.status:"inactive";
   const {error}=await admin.from("members").update({status}).eq("id",memberId).eq("organization_id",organizationId);if(error)return json(req,{error:"Unable to update status"},500);
   return json(req,{ok:true,status});
  }
  if(body.action==="update"){
   const fullName=text(body.full_name,120),phone=text(body.phone,30)||null,nationalId=text(body.national_id,20)||null,birthDate=dateOrNull(body.birth_date),emergencyPhone=text(body.emergency_phone,30)||null,notes=text(body.notes,1000)||null,branchId=text(body.home_branch_id,50);
   if(fullName.length<2||!branchId)return json(req,{error:"Invalid member data"},400);
   if(nationalId&&!/^\d{8,12}$/.test(nationalId))return json(req,{error:"Invalid national ID"},400);
   if(scopedBranch&&branchId!==scopedBranch)return json(req,{error:"Branch access denied"},403);
   const {data:branch}=await admin.from("branches").select("id").eq("organization_id",organizationId).eq("id",branchId).eq("status","active").maybeSingle();if(!branch)return json(req,{error:"Invalid branch"},400);
   const {error}=await admin.from("members").update({home_branch_id:branchId,full_name:fullName,phone,national_id:nationalId,birth_date:birthDate,emergency_phone:emergencyPhone,notes}).eq("id",memberId).eq("organization_id",organizationId);
   if(error?.code==="23505")return json(req,{error:"National ID already exists"},409);
   if(error)return json(req,{error:"Unable to update member"},500);
   return json(req,{ok:true});
  }
  return json(req,{error:"Unknown action"},400);
 }
 return json(req,{error:"Method not allowed"},405);
});
