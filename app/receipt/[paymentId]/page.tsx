"use client";
import {Loader2,Printer,Waves,X} from "lucide-react";
import {useCallback,useEffect,useState} from "react";
import {useParams} from "next/navigation";
import {functionsUrl,supabase} from "../../../lib/supabase-browser";
import "../receipt.css";
type Receipt={payment:{id:string;amount:number;currency:string;method:string;status:string;reference_number:string|null;paid_at:string;voided_at:string|null;void_reason:string|null},member:{member_number:number;full_name:string;phone:string|null}|null,branch:{name:string}|null,receiver:{full_name:string}|null,membership:{starts_on:string;ends_on:string;status:string}|null,plan:{name:string;duration_days:number;session_limit:number|null}|null,organization:{name:string}|null};
const money=(n:number)=>n.toLocaleString("fa-IR"),dateTime=(x:string)=>new Intl.DateTimeFormat("fa-IR",{dateStyle:"full",timeStyle:"short"}).format(new Date(x)),date=(x:string)=>new Intl.DateTimeFormat("fa-IR").format(new Date(x));
const methodLabels:Record<string,string>={cash:"نقدی",pos:"کارت‌خوان",bank_transfer:"انتقال بانکی"};

export default function ReceiptPage(){
 const {paymentId}=useParams<{paymentId:string}>();
 const [r,setR]=useState<Receipt|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState("");
 const load=useCallback(async()=>{setLoading(true);try{const {data}=await supabase.auth.getSession(),res=await fetch(`${functionsUrl}/admin-payments?payment_id=${paymentId}`,{headers:{Authorization:`Bearer ${data.session?.access_token??""}`}}),j=await res.json();if(!res.ok)throw new Error(j.error??"خطا در دریافت رسید");setR(j)}catch(e){setError(e instanceof Error?e.message:"خطا")}finally{setLoading(false)}},[paymentId]);
 useEffect(()=>{void load()},[load]);
 return <main className="receipt-page" dir="rtl">
  <div className="receipt-toolbar no-print"><a href="/payments">بازگشت</a><button onClick={()=>window.print()} disabled={!r}><Printer/> چاپ رسید</button></div>
  {loading?<div className="receipt-loading"><Loader2 className="spin"/></div>:error||!r?<div className="receipt-loading"><X/><p>{error??"رسید پیدا نشد"}</p></div>:
  <section className="receipt-paper">
   <header><div className="receipt-brand"><span><Waves/></span><div><b>{r.organization?.name??"دلفین آبی"}</b><small>{r.branch?.name??""}</small></div></div><div className="receipt-meta"><small>رسید پرداخت حضوری</small><b>#{r.payment.id.slice(0,8).toUpperCase()}</b></div></header>
   <div className={`receipt-state ${r.payment.status}`}>{r.payment.status==="paid"?"پرداخت معتبر":r.payment.status==="voided"?"باطل‌شده":"بازگشت وجه"}</div>
   <table className="receipt-rows"><tbody>
    <tr><th>پرداخت‌کننده</th><td>{r.member?.full_name??"—"}</td></tr>
    <tr><th>شماره عضویت</th><td>{r.member?money(r.member.member_number):"—"}</td></tr>
    {r.plan&&<tr><th>طرح</th><td>{r.plan.name}{r.plan.session_limit?` · ${money(r.plan.session_limit)} جلسه`:''}</td></tr>}
    {r.membership&&<tr><th>بازه عضویت</th><td>{date(r.membership.starts_on)} تا {date(r.membership.ends_on)}</td></tr>}
    <tr className="amount-row"><th>مبلغ</th><td><b>{money(r.payment.amount)}</b> {r.payment.currency==="IRR"?"ریال":""}</td></tr>
    <tr><th>روش پرداخت</th><td>{methodLabels[r.payment.method]??"—"}</td></tr>
    {r.payment.reference_number&&<tr><th>شماره پیگیری</th><td>{r.payment.reference_number}</td></tr>}
    <tr><th>تاریخ و ساعت</th><td>{dateTime(r.payment.paid_at)}</td></tr>
    <tr><th>دریافت‌کننده</th><td>{r.receiver?.full_name??"—"}</td></tr>
    {r.payment.status==="voided"&&<><tr><th>زمان ابطال</th><td>{dateTime(r.payment.voided_at??"")}</td></tr><tr><th>دلیل ابطال</th><td>{r.payment.void_reason}</td></tr></>}
   </tbody></table>
   <footer className="receipt-foot"><span>امضای دریافت‌کننده: ....................</span><span>مهر مجموعه: ....................</span></footer>
   <p className="receipt-note">این رسید سند رسمی پرداخت حضوری است و در سامانه دلفین آبی ثبت شده است.</p>
  </section>}
 </main>
}
