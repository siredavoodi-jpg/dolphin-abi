"use client";
import {ArrowRight,Ban,Building2,Check,Copy,KeyRound,Loader2,Plus,RefreshCw,Search,ShieldCheck,UserCog,Users,Waves,X} from "lucide-react";
import {FormEvent,useCallback,useEffect,useMemo,useState} from "react";
import {functionsUrl,supabase} from "../../lib/supabase-browser";

type Branch={id:string;name:string;status:string};
type UserRow={id:string;username:string;full_name:string;phone:string|null;role:string;branch_id:string|null;account_status:"active"|"blocked";must_change_password:boolean;last_login_at:string|null;created_at:string};
const roleLabels:Record<string,string>={owner:"مدیر کل",branch_manager:"مدیر شعبه",receptionist:"پذیرش",member:"عضو"};
async function api(init?:RequestInit){
 const {data}=await supabase.auth.getSession();
 const response=await fetch(functionsUrl+"/admin-users",{...init,headers:{Authorization:`Bearer ${data.session?.access_token??""}`,"Content-Type":"application/json",...(init?.headers??{})}});
 const result=await response.json(); if(!response.ok) throw new Error(result.error??"خطا در ارتباط با سرور"); return result;
}
export default function UsersPage(){
 const [users,setUsers]=useState<UserRow[]>([]),[branches,setBranches]=useState<Branch[]>([]);
 const [loading,setLoading]=useState(true),[busy,setBusy]=useState(""),[query,setQuery]=useState(""),[toast,setToast]=useState("");
 const [showCreate,setShowCreate]=useState(false),[credential,setCredential]=useState<{username:string,password:string}|null>(null);
 const load=useCallback(async()=>{setLoading(true);try{const r=await api();setUsers(r.users);setBranches(r.branches)}catch(e){setToast(e instanceof Error?e.message:"خطا در دریافت کاربران")}finally{setLoading(false)}},[]);
 useEffect(()=>{void load()},[load]);
 const filtered=useMemo(()=>{const q=query.trim().toLowerCase();return q?users.filter(u=>u.full_name?.toLowerCase().includes(q)||u.username?.toLowerCase().includes(q)||u.phone?.includes(q)):users},[query,users]);
 async function update(userId:string,payload:object){setBusy(userId);try{const r=await api({method:"PATCH",body:JSON.stringify({user_id:userId,...payload})});if(r.temporary_password){const u=users.find(x=>x.id===userId);setCredential({username:u?.username??"",password:r.temporary_password})}else setToast("تغییرات ذخیره شد");await load()}catch(e){setToast(e instanceof Error?e.message:"عملیات ناموفق بود")}finally{setBusy("")}}
 return <main className="users-page" dir="rtl">
  <header className="users-topbar"><a href="/" className="users-back"><ArrowRight/> بازگشت به داشبورد</a><div className="users-brand"><span><Waves/></span><b>دلفین آبی</b></div><div className="users-secure"><ShieldCheck/> مدیریت امن کاربران</div></header>
  <section className="users-container">
   <div className="users-heading"><div><small>تنظیمات مجموعه</small><h1>کاربران و دسترسی‌ها</h1><p>حساب‌های پرسنل، نقش‌ها و دسترسی شعب را مدیریت کنید.</p></div><button className="users-primary" onClick={()=>setShowCreate(true)}><Plus/> افزودن کاربر</button></div>
   <section className="users-summary"><div><span className="violet"><Users/></span><p>کل کاربران<b>{users.length}</b></p></div><div><span className="green"><Check/></span><p>حساب فعال<b>{users.filter(u=>u.account_status==="active").length}</b></p></div><div><span className="orange"><Building2/></span><p>شعب فعال<b>{branches.filter(b=>b.status==="active").length}</b></p></div></section>
   <section className="users-panel"><div className="users-tools"><label><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="جستجو با نام، نام کاربری یا تلفن..."/></label><button onClick={()=>void load()}><RefreshCw/> بروزرسانی</button></div>
   {loading?<div className="users-empty"><Loader2 className="spin"/><p>در حال دریافت کاربران...</p></div>:filtered.length===0?<div className="users-empty"><Users/><p>کاربری پیدا نشد.</p></div>:
   <div className="users-table-wrap"><table className="users-table"><thead><tr><th>کاربر</th><th>نقش و شعبه</th><th>آخرین ورود</th><th>وضعیت</th><th>عملیات</th></tr></thead><tbody>{filtered.map(u=>{const owner=u.role==="owner",branch=branches.find(b=>b.id===u.branch_id);return <tr key={u.id}>
    <td><div className="user-identity"><span>{u.full_name?.slice(0,1)??"ک"}</span><div><b>{u.full_name}</b><small dir="ltr">@{u.username}</small></div></div></td>
    <td>{owner?<div className="user-access"><b>{roleLabels[u.role]}</b><small>{branch?.name??"تمام مجموعه"}</small></div>:<div className="access-edit"><select aria-label="نقش کاربر" value={u.role} disabled={busy===u.id} onChange={e=>void update(u.id,{action:"update_access",role:e.target.value,branch_id:e.target.value==="member"?u.branch_id:(u.branch_id??branches[0]?.id)})}><option value="branch_manager">مدیر شعبه</option><option value="receptionist">پذیرش</option><option value="member">عضو</option></select><select aria-label="شعبه کاربر" value={u.branch_id??""} disabled={busy===u.id} onChange={e=>void update(u.id,{action:"update_access",role:u.role,branch_id:e.target.value})}><option value="" disabled={u.role!=="member"}>تمام مجموعه</option>{branches.filter(b=>b.status==="active").map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></div>}</td>
    <td><span className="last-login">{u.last_login_at?new Intl.DateTimeFormat("fa-IR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(u.last_login_at)):"هنوز وارد نشده"}</span></td>
    <td><span className={u.account_status==="active"?"status active":"status blocked"}>{u.account_status==="active"?"فعال":"مسدود"}</span>{u.must_change_password&&<small className="password-pending">تغییر رمز الزامی</small>}</td>
    <td><div className="user-actions"><button disabled={owner||busy===u.id} title="بازنشانی رمز" onClick={()=>void update(u.id,{action:"reset_password"})}>{busy===u.id?<Loader2 className="spin"/>:<KeyRound/>}</button><button disabled={owner||busy===u.id} className={u.account_status==="active"?"danger":"success"} title={u.account_status==="active"?"مسدود کردن":"فعال کردن"} onClick={()=>void update(u.id,{action:"set_status",status:u.account_status==="active"?"blocked":"active"})}>{u.account_status==="active"?<Ban/>:<Check/>}</button></div></td>
   </tr>})}</tbody></table></div>}</section>
  </section>
  {showCreate&&<CreateUser branches={branches} onClose={()=>setShowCreate(false)} onCreated={async v=>{setShowCreate(false);setCredential(v);await load()}}/>}
  {credential&&<CredentialModal value={credential} onClose={()=>setCredential(null)}/>}
  {toast&&<div className="users-toast"><Check/>{toast}<button onClick={()=>setToast("")}><X/></button></div>}
 </main>
}
function CreateUser({branches,onClose,onCreated}:{branches:Branch[];onClose:()=>void;onCreated:(v:{username:string,password:string})=>void}){
 const [saving,setSaving]=useState(false),[error,setError]=useState(""),[role,setRole]=useState("receptionist");
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setSaving(true);setError("");const f=new FormData(e.currentTarget);try{const r=await api({method:"POST",body:JSON.stringify({full_name:f.get("full_name"),username:f.get("username"),phone:f.get("phone"),role,branch_id:f.get("branch_id")})});onCreated({username:r.username,password:r.temporary_password})}catch(err){setError(err instanceof Error?err.message:"ایجاد کاربر ناموفق بود")}finally{setSaving(false)}}
 return <div className="users-modal-backdrop"><form className="users-modal" onSubmit={submit}><div className="modal-head"><div><span><UserCog/></span><div><h2>افزودن کاربر جدید</h2><p>رمز موقت به‌صورت امن ساخته می‌شود.</p></div></div><button type="button" onClick={onClose}><X/></button></div>
 <div className="modal-grid"><label className="wide">نام و نام خانوادگی<input name="full_name" required minLength={2} autoFocus placeholder="مثلاً سارا احمدی"/></label><label>نام کاربری<input name="username" required minLength={3} pattern="[a-z0-9._-]+" dir="ltr" placeholder="sara.ahmadi"/></label><label>شماره تلفن<input name="phone" dir="ltr" placeholder="0912..."/></label><label>نقش<select value={role} onChange={e=>setRole(e.target.value)}><option value="branch_manager">مدیر شعبه</option><option value="receptionist">پذیرش</option><option value="member">عضو</option></select></label><label>شعبه<select name="branch_id" required={role!=="member"}><option value="">انتخاب شعبه</option>{branches.filter(b=>b.status==="active").map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></label></div>
 {error&&<p className="modal-error">{error}</p>}<footer><button type="button" onClick={onClose}>انصراف</button><button className="users-primary" disabled={saving}>{saving?<Loader2 className="spin"/>:<Plus/>} ایجاد حساب</button></footer></form></div>
}
function CredentialModal({value,onClose}:{value:{username:string,password:string};onClose:()=>void}){
 const [copied,setCopied]=useState(false);async function copy(){await navigator.clipboard.writeText(`نام کاربری: ${value.username}\nرمز موقت: ${value.password}`);setCopied(true)}
 return <div className="users-modal-backdrop"><div className="users-modal credential-modal"><div className="credential-icon"><KeyRound/></div><h2>مشخصات ورود آماده است</h2><p>این رمز فقط همین یک‌بار نمایش داده می‌شود. آن را امن در اختیار کاربر قرار دهید.</p><div className="credential-box"><label>نام کاربری</label><b dir="ltr">{value.username}</b><label>رمز موقت</label><code dir="ltr">{value.password}</code></div><button className="users-primary copy-credential" onClick={()=>void copy()}>{copied?<Check/>:<Copy/>}{copied?"کپی شد":"کپی مشخصات"}</button><button className="credential-close" onClick={onClose}>بستن</button></div></div>
}
