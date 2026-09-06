import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.95.0";
const origins=new Set(["https://dolphin-abi-pool.gerayeli60.chatgpt.site","https://dolphin-abi.vercel.app","http://localhost:3000","http://localhost:3001"]),roles=new Set(["owner","branch_manager","receptionist"]);
function cors(req:Request){const o=req.headers.get("origin")??"";return{"Access-Control-Allow-Origin":origins.has(o)?o:"https://dolphin-abi.vercel.app","Access-Control-Allow-Headers":"authorization, x-client-info, apikey, content-type","Access-Control-Allow-Methods":"GET, OPTIONS","Content-Type":"application/json","Cache-Control":"no-store","Vary":"Origin"}}
function json(req:Request,body:unknown,status=200){return new Response(JSON.stringify(body),{status,headers:cors(req)})}
Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response("ok",{headers:cors(req)});
 const origin=req.headers.get("origin")??"";if(origin&&!origins.has(origin))return json(req,{error:"Forbidden"},403);
 const admin=createClient(Deno.env.get("SUPABASE_URL")??"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")??"",{auth:{persistSession:false,autoRefreshToken:false}});
 const token=req.headers.get("authorization")?.replace(/^Bearer\s+/i,"")??"";const {data:auth,error:authError}=await admin.auth.getUser(token);if(authError||!auth.user)return json(req,{error:"Unauthorized"},401);
 const {data:access}=await admin.from("organization_users").select("organization_id,role,branch_id,status").eq("user_id",auth.user.id).eq("status","active").maybeSingle();if(!access||!roles.has(access.role))return json(req,{error:"Staff access required"},403);
 const org=access.organization_id,scope=access.role==="owner"?null:access.branch_id;if(access.role!=="owner"&&!scope)return json(req,{error:"Branch access required"},403);
 {const {data:plat}=await admin.from("profiles").select("is_platform_admin").eq("id",auth.user.id).maybeSingle();if(!plat?.is_platform_admin){const {data:orgRow}=await admin.from("organizations").select("status,subscription_ends_on").eq("id",org).maybeSingle();const todayStr=new Date().toISOString().slice(0,10);if(!orgRow||orgRow.status!=="active"||(orgRow.subscription_ends_on&&orgRow.subscription_ends_on<todayStr))return json(req,{error:"Subscription suspended"},403)}}
 if(req.method!=="GET")return json(req,{error:"Method not allowed"},405);
 const tz="Asia/Tehran",today=new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 const days=Math.min(180,Math.max(7,Number(new URL(req.url).searchParams.get("days"))||30));
 const startOfTodayMs=new Date(today+"T00:00:00Z").getTime()-((new Date(new Date().toLocaleString("en-US",{timeZone:tz})).getTime()-new Date(new Date().toLocaleString("en-US",{timeZone:"UTC"})).getTime())/3600000)*3600000;
 const rangeStart=new Date(startOfTodayMs-(days-1)*86400000).toISOString(),todayStart=new Date(startOfTodayMs).toISOString();
 let paymentQ=admin.from("payment_records").select("id,branch_id,member_id,amount,method,status,paid_at,voided_at,void_reason").eq("organization_id",org).gte("paid_at",rangeStart).order("paid_at"),memberQ=admin.from("members").select("id,full_name,phone,home_branch_id,status,created_at").eq("organization_id",org),membershipQ=admin.from("memberships").select("id,member_id,plan_id,status,starts_on,ends_on,remaining_sessions").eq("organization_id",org).order("ends_on",{ascending:false}),sessionQ=admin.from("pool_sessions").select("id,branch_id,title,starts_at,ends_at,capacity,status").eq("organization_id",org).gte("starts_at",new Date(startOfTodayMs-7*86400000).toISOString()).order("starts_at",{ascending:false}).limit(60),planQ=admin.from("membership_plans").select("id,name").eq("organization_id",org);
 if(scope){paymentQ=paymentQ.eq("branch_id",scope);memberQ=memberQ.eq("home_branch_id",scope);sessionQ=sessionQ.eq("branch_id",scope)}
 const [{data:payments,error:pe},{data:members,error:me},{data:memberships,error:mse},{data:sessions,error:se},{data:plans}]=await Promise.all([paymentQ,memberQ,membershipQ,sessionQ,planQ]);
 if(pe||me||mse||se)return json(req,{error:"Unable to load reports"},500);
 const tehranDay=(iso:string)=>new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(iso));
 const paid=(payments??[]).filter(p=>p.status==="paid"),voided=(payments??[]).filter(p=>p.status!=="paid");
 const sum=(arr:typeof paid)=>arr.reduce((s,p)=>s+Number(p.amount),0);
 const todayPaid=paid.filter(p=>tehranDay(p.paid_at)===today);
 const last7=paid.filter(p=>p.paid_at>=new Date(startOfTodayMs-6*86400000).toISOString());
 const daily:Array<{day:string;amount:number;count:number}>=[];
 for(let i=days-1;i>=0;i--){const d=new Date(startOfTodayMs-i*86400000).toISOString().slice(0,10);const rows=paid.filter(p=>tehranDay(p.paid_at)===d);daily.push({day:d,amount:sum(rows),count:rows.length})}
 const methodMap=new Map<string,{amount:number;count:number}>();for(const p of paid){const m=methodMap.get(p.method)??{amount:0,count:0};m.amount+=Number(p.amount);m.count++;methodMap.set(p.method,m)}
 const memberMap=new Map((members??[]).map(m=>[m.id,m])),planMap=new Map((plans??[]).map(p=>[p.id,p.name]));
 const latestMembership=new Map<string,typeof memberships[number]>();for(const ms of memberships??[]){const cur=latestMembership.get(ms.member_id);if(!cur||ms.ends_on>cur.ends_on)latestMembership.set(ms.member_id,ms)}
 const activeMemberships=(memberships??[]).filter(ms=>ms.status==="active"&&ms.ends_on>=today);
 const expiringSoon=activeMemberships.filter(ms=>ms.ends_on<=new Date(startOfTodayMs+7*86400000).toISOString().slice(0,10)).map(ms=>({member_name:memberMap.get(ms.member_id)?.full_name??"عضو",phone:memberMap.get(ms.member_id)?.phone??null,plan_name:planMap.get(ms.plan_id)??null,ends_on:ms.ends_on,remaining_sessions:ms.remaining_sessions})).sort((a,b)=>a.ends_on<b.ends_on?-1:1);
 const expiredCount=[...latestMembership.values()].filter(ms=>ms.ends_on<today).length;
 const sessionIds=(sessions??[]).map(s=>s.id);
 const {data:resCounts}=sessionIds.length?await admin.from("session_reservations").select("session_id,status").eq("organization_id",org).in("session_id",sessionIds):{data:[]};
 const occupancy=new Map<string,number>();for(const r of resCounts??[])if(r.status==="confirmed"||r.status==="attended")occupancy.set(r.session_id,(occupancy.get(r.session_id)??0)+1);
 return json(req,{
  range:{days,today},
  revenue:{today:sum(todayPaid),todayCount:todayPaid.length,last7:sum(last7),range:sum(paid),rangeCount:paid.length,daily},
  methods:Object.fromEntries([...methodMap].map(([k,v])=>[k,v])),
  voided:{count:voided.length,amount:sum(voided),recent:voided.slice(0,10).map(v=>({id:v.id,amount:v.amount,reason:v.void_reason,paid_at:v.paid_at,voided_at:v.voided_at,member:memberMap.get(v.member_id)?.full_name??"—"}))},
  members:{total:(members??[]).length,active:(members??[]).filter(m=>m.status==="active").length,withActiveMembership:new Set(activeMemberships.map(m=>m.member_id)).size,expiringSoon,expiredCount},
  sessions:(sessions??[]).slice(0,30).map(s=>({id:s.id,title:s.title,starts_at:s.starts_at,capacity:s.capacity,status:s.status,booked:occupancy.get(s.id)??0})),
  access:{role:access.role,branch_id:access.branch_id}
 });
});
