import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.95.0";
const origins=new Set(["https://dolphin-abi-pool.gerayeli60.chatgpt.site","https://dolphin-abi.vercel.app","http://localhost:3000","http://localhost:3001"]),roles=new Set(["owner","branch_manager","receptionist"]);
function cors(req:Request){const o=req.headers.get("origin")??"";return{"Access-Control-Allow-Origin":origins.has(o)?o:"https://dolphin-abi.vercel.app","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"GET, POST, PATCH, OPTIONS","Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin"}}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:cors(req)})}
function txt(value:unknown,max:number){return String(value??"").trim().slice(0,max)}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors(req)});const origin=req.headers.get("origin")??"";if(origin&&!origins.has(origin))return json(req,{error:"Forbidden"},403);
 const admin=createClient(Deno.env.get("SUPABASE_URL")??"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"",{auth:{persistSession:false,autoRefreshToken:false}});
 const token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"")??"";const {data:auth,error:authError}=await admin.auth.getUser(token);if(authError||!auth.user)return json(req,{error:"Unauthorized"},401);
 const {data:access}=await admin.from("organization_users").select("organization_id,role,branch_id,status").eq("user_id",auth.user.id).eq("status","active").maybeSingle();if(!access||!roles.has(access.role))return json(req,{error:"Staff access required"},403);
 const organizationId=access.organization_id,scopedBranch=access.role==="owner"?null:access.branch_id;if(access.role!=="owner"&&!scopedBranch)return json(req,{error:"Branch access required"},403);{const {data:plat}=await admin.from("profiles").select("is_platform_admin").eq("id",auth.user.id).maybeSingle();if(!plat?.is_platform_admin){const {data:orgRow}=await admin.from("organizations").select("status,subscription_ends_on").eq("id",organizationId).maybeSingle();const todayStr=new Date().toISOString().slice(0,10);if(!orgRow||orgRow.status!=="active"||(orgRow.subscription_ends_on&&orgRow.subscription_ends_on<todayStr))return json(req,{error:"Subscription suspended"},403)}}
 if(req.method==="GET"){
  const receiptId=new URL(req.url).searchParams.get("payment_id")??"";
  if(receiptId){
   let receiptQuery=admin.from("payment_records").select("id,branch_id,member_id,membership_id,amount,currency,method,status,reference_number,received_by,paid_at,voided_at,void_reason").eq("organization_id",organizationId).eq("id",receiptId).maybeSingle();
   if(scopedBranch)receiptQuery=receiptQuery.eq("branch_id",scopedBranch);
   const {data:payment}=await receiptQuery;
   if(!payment)return json(req,{error:"Payment not found"},404);
   const [{data:member},{data:branch},{data:receiver},{data:membership}]=await Promise.all([
    payment.member_id?admin.from("members").select("id,member_number,full_name,phone").eq("id",payment.member_id).maybeSingle():Promise.resolve({data:null}),
    admin.from("branches").select("id,name").eq("id",payment.branch_id).maybeSingle(),
    admin.from("profiles").select("id,full_name").eq("id",payment.received_by).maybeSingle(),
    payment.membership_id?admin.from("memberships").select("id,plan_id,starts_on,ends_on,status").eq("id",payment.membership_id).maybeSingle():Promise.resolve({data:null})
   ]);
   const planId=membership?.plan_id;
   const {data:plan}=planId?await admin.from("membership_plans").select("id,name,price_amount,duration_days,session_limit").eq("id",planId).maybeSingle():{data:null};
   const {data:org}=await admin.from("organizations").select("name").eq("id",organizationId).maybeSingle();
   return json(req,{payment,member,branch,receiver,membership,plan,organization:org});
  }
  let membershipQuery=admin.from("memberships").select("id,branch_id,member_id,plan_id,starts_on,ends_on,status,created_at").eq("organization_id",organizationId).eq("status","pending").order("created_at",{ascending:false}).limit(500);
  let paymentQuery=admin.from("payment_records").select("id,branch_id,member_id,membership_id,amount,currency,method,status,reference_number,received_by,paid_at,voided_at,void_reason").eq("organization_id",organizationId).order("paid_at",{ascending:false}).limit(500);
  let branchQuery=admin.from("branches").select("id,name").eq("organization_id",organizationId).order("name");
  let memberQuery=admin.from("members").select("id,member_number,full_name,home_branch_id").eq("organization_id",organizationId).order("full_name").limit(500);
  if(scopedBranch){membershipQuery=membershipQuery.eq("branch_id",scopedBranch);paymentQuery=paymentQuery.eq("branch_id",scopedBranch);branchQuery=branchQuery.eq("id",scopedBranch);memberQuery=memberQuery.eq("home_branch_id",scopedBranch)}
  const [{data:memberships,error:membershipError},{data:payments,error:paymentError},{data:branches,error:branchError},{data:members,error:memberError},{data:plans,error:planError}]=await Promise.all([membershipQuery,paymentQuery,branchQuery,memberQuery,admin.from("membership_plans").select("id,name,price_amount,currency").eq("organization_id",organizationId)]);
  if(membershipError||paymentError||branchError||memberError||planError)return json(req,{error:"Unable to load payments"},500);
  const receiverIds=[...new Set((payments??[]).map(item=>item.received_by))];const {data:receivers,error:receiverError}=receiverIds.length?await admin.from("profiles").select("id,full_name").in("id",receiverIds):{data:[],error:null};if(receiverError)return json(req,{error:"Unable to load receivers"},500);
  return json(req,{memberships:memberships??[],payments:payments??[],branches:branches??[],members:members??[],plans:plans??[],receivers:receivers??[],access:{role:access.role,branch_id:access.branch_id}});
 }
 if(req.method==="POST"){
  const body=await req.json(),membershipId=txt(body.membership_id,50),method=txt(body.method,30),reference=txt(body.reference_number,100);if(!membershipId||!["cash","pos","bank_transfer"].includes(method))return json(req,{error:"Invalid payment data"},400);if(method!=="cash"&&!reference)return json(req,{error:"Payment reference required"},400);
  let membershipQuery=admin.from("memberships").select("id,branch_id,status").eq("id",membershipId).eq("organization_id",organizationId).eq("status","pending");if(scopedBranch)membershipQuery=membershipQuery.eq("branch_id",scopedBranch);const {data:membership}=await membershipQuery.maybeSingle();if(!membership)return json(req,{error:"Pending membership not found"},404);
  const {data,error}=await admin.rpc("record_manual_membership_payment",{p_organization_id:organizationId,p_membership_id:membershipId,p_method:method,p_reference_number:reference||null,p_received_by:auth.user.id});if(error)return json(req,{error:error.message},error.code==="23505"?409:400);return json(req,{ok:true,id:data},201);
 }
 if(req.method==="PATCH"){
  if(!["owner","branch_manager"].includes(access.role))return json(req,{error:"Manager access required"},403);const body=await req.json(),paymentId=txt(body.payment_id,50),reason=txt(body.void_reason,300);if(!paymentId||reason.length<3)return json(req,{error:"Void reason required"},400);
  let paymentQuery=admin.from("payment_records").select("id,branch_id,status").eq("id",paymentId).eq("organization_id",organizationId).eq("status","paid");if(scopedBranch)paymentQuery=paymentQuery.eq("branch_id",scopedBranch);const {data:payment}=await paymentQuery.maybeSingle();if(!payment)return json(req,{error:"Paid payment not found"},404);
  const {error}=await admin.rpc("void_manual_membership_payment",{p_organization_id:organizationId,p_payment_id:paymentId,p_voided_by:auth.user.id,p_void_reason:reason});if(error)return json(req,{error:error.message},400);return json(req,{ok:true});
 }
 return json(req,{error:"Method not allowed"},405);
});
