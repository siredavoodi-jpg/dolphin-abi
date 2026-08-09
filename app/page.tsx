"use client";
import {Bell,CalendarDays,ChevronDown,CircleDollarSign,Clock3,CreditCard,LayoutDashboard,Menu,Search,Settings,ShoppingBag,TrendingUp,UserPlus,Users,Waves,X,ArrowUpLeft,Check,MoreHorizontal,WalletCards,ScanLine,Ticket,PackageOpen,BarChart3} from "lucide-react";
import {useState} from "react";

const nav=[[LayoutDashboard,"نمای کلی"],[Users,"اعضا"],[ScanLine,"پذیرش"],[CreditCard,"کارت و کیف پول"],[CalendarDays,"سانس‌ها"],[ShoppingBag,"فروشگاه"],[PackageOpen,"انبار"],[BarChart3,"گزارش‌ها"]] as const;
const sessions=[
  ["۰۸:۰۰ – ۱۰:۰۰","شنای آزاد بانوان","سارا احمدی","۳۹ / ۵۰","۷۸٪","b"],
  ["۱۰:۳۰ – ۱۲:۰۰","آموزش کودکان","امیر رضایی","۲۳ / ۲۵","۹۲٪","o"],
  ["۱۵:۰۰ – ۱۷:۰۰","شنای آزاد آقایان","نیما کاویانی","۲۷ / ۵۰","۵۴٪","g"]
];
const activity=[
  [UserPlus,"عضو جدید ثبت شد","نگار محمدی · عضویت سه‌ماهه","۴ دقیقه پیش","v"],
  [WalletCards,"کیف پول شارژ شد","علی کریمی · ۵۰۰٬۰۰۰ تومان","۱۲ دقیقه پیش","b"],
  [ScanLine,"ورود با کارت RFID","مهسا یوسفی · سانس بانوان","۱۸ دقیقه پیش","g"],
  [Ticket,"بلیت تک‌جلسه‌ای فروخته شد","پذیرش شعبه مرکزی","۲۵ دقیقه پیش","o"]
] as const;

export default function Home(){
 const [menu,setMenu]=useState(false); const [toast,setToast]=useState("");
 const ping=(s:string)=>{setToast(s);setTimeout(()=>setToast(""),2200)};
 return <main className="shell">
  <aside className={menu?"side open":"side"}>
   <button className="close" onClick={()=>setMenu(false)}><X/></button>
   <div className="brand"><span><Waves/></span><div><b>دلفین آبی</b><small>DOLPHIN ABI</small></div></div>
   <label>فضای کاری</label>
   <button className="branch" onClick={()=>window.location.href="/branches"}><i>م</i><span><b>شعبه مرکزی</b><small>مدیریت شعبه‌ها</small></span><ChevronDown/></button>
   <nav><label>مدیریت</label>{nav.map(([I,t],n)=><button key={t} className={n===0?"active":""} onClick={()=>n===1?window.location.href="/members":ping(t+" در نسخه نمایشی آماده است")}><I/><span>{t}</span>{t==="پذیرش"&&<em>۱۲</em>}</button>)}</nav>
   <div className="sidefoot"><button onClick={()=>window.location.href="/users"}><Settings/> کاربران و دسترسی‌ها</button><div className="profile"><span>ح‌گ</span><div><b>حسین گرایلی</b><small>مدیر کل مجموعه</small></div><MoreHorizontal/></div></div>
  </aside>
  {menu&&<div className="shade" onClick={()=>setMenu(false)}/>}
  <section className="content">
   <header><button className="burger" onClick={()=>setMenu(true)}><Menu/></button><div className="search"><Search/><input placeholder="جستجوی عضو، کارت یا فاکتور..."/><kbd>⌘ K</kbd></div><div className="headact"><button onClick={()=>ping("۳ اعلان جدید دارید")}><Bell/><i/></button><span><CalendarDays/> یکشنبه، ۱۸ مرداد ۱۴۰۵</span></div></header>
   <div className="dash">
    <div className="title"><div><small>داشبورد مدیریت</small><h1>سلام حسین، روز خوبی داشته باشی 👋</h1><p>خلاصه عملکرد امروز مجموعه را اینجا می‌بینی.</p></div><button onClick={()=>ping("فرم ثبت عضو جدید آماده شد")}><UserPlus/> ثبت عضو جدید</button></div>
    <section className="stats">
     <Stat icon={Users} title="اعضای فعال" value="۱٬۲۸۴" diff="۸٫۲٪" cls="v"/>
     <Stat icon={CircleDollarSign} title="درآمد امروز" value="۲۴٫۸ م" diff="۱۲٫۵٪" cls="b"/>
     <Stat icon={ScanLine} title="مراجعه امروز" value="۳۱۸" diff="۶٫۴٪" cls="g"/>
     <Stat icon={WalletCards} title="اعتبار کیف پول‌ها" value="۱۸۶٫۲ م" diff="۳٫۱٪" cls="o"/>
    </section>
    <section className="mid">
     <article className="card chart"><Head title="گزارش درآمد" sub="درآمد ۷ روز گذشته"/><div className="sum"><b>۱۴۸٬۶۰۰٬۰۰۰</b><span>تومان</span><em><TrendingUp/> ۱۱٫۴٪</em></div><div className="graph"><div className="axis"><span>۳۰ م</span><span>۲۰ م</span><span>۱۰ م</span><span>۰</span></div><div className="bars">{[48,62,53,76,88,64,82].map((h,i)=><div className="barcol" key={i}><i className={i===6?"now h"+h:"h"+h}>{i===6&&<b>۲۴٫۸ م</b>}</i><small>{["دوشنبه","سه‌شنبه","چهارشنبه","پنج‌شنبه","جمعه","شنبه","امروز"][i]}</small></div>)}</div></div></article>
     <article className="card occupy"><Head title="ظرفیت فعلی استخر" sub="سانس فعال · بانوان"/><div className="ring"><span><b>۶۸٪</b><small>تکمیل ظرفیت</small></span></div><div className="nums"><span><b>۳۴</b><small>حاضر</small></span><i/><span><b>۵۰</b><small>ظرفیت کل</small></span><i/><span><b>۱۶</b><small>ظرفیت خالی</small></span></div><div className="timer"><Clock3/><span><b>پایان سانس</b><small>۱۱:۳۰ · ۳۷ دقیقه دیگر</small></span><button onClick={()=>ping("کنترل ورود آماده است")}>کنترل ورود</button></div></article>
    </section>
    <section className="bottom">
     <article className="card list"><Head title="سانس‌های امروز" sub="برنامه و ظرفیت سانس‌های پیش‌رو"/>{sessions.map(s=><div className="session" key={s[0]}><span className={"time "+s[5]}><Clock3/>{s[0]}</span><div><b>{s[1]}</b><small>مربی: {s[2]}</small></div><div className="cap"><span>{s[3]} نفر</span><i><b className={s[5]} style={{width:s[4]}}/></i></div><MoreHorizontal/></div>)}</article>
     <article className="card list"><Head title="فعالیت‌های اخیر" sub="آخرین رویدادهای سیستم"/>{activity.map(([I,t,s,tm,c])=><div className="activity" key={t}><span className={c}><I/></span><div><b>{t}</b><small>{s}</small></div><time>{tm}</time></div>)}</article>
    </section>
   </div>
  </section>
  {toast&&<div className="toast"><Check/>{toast}</div>}
 </main>
}
function Head({title,sub}:{title:string,sub:string}){return <div className="cardhead"><div><h2>{title}</h2><p>{sub}</p></div><a>مشاهده همه <ArrowUpLeft/></a></div>}
function Stat({icon:I,title,value,diff,cls}:{icon:typeof Users,title:string,value:string,diff:string,cls:string}){return <article className="card stat"><span className={cls}><I/></span><MoreHorizontal/><p>{title}</p><h2>{value}<small> تومان</small></h2><footer><em><TrendingUp/>{diff}</em><span>نسبت به دوره قبل</span></footer></article>}
