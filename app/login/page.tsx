"use client";

import { Eye, EyeOff, LockKeyhole, LogIn, UserRound, Waves } from "lucide-react";
import { FormEvent, useState } from "react";
import { functionsUrl, supabase } from "../../lib/supabase-browser";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const response = await fetch(functionsUrl + "/username-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
        },
        body: JSON.stringify({ username: username.trim().toLowerCase(), password }),
      });
      const result = await response.json();
      if (!response.ok || !result.access_token || !result.refresh_token) {
        throw new Error(result.error ?? "نام کاربری یا رمز عبور صحیح نیست.");
      }
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: result.access_token,
        refresh_token: result.refresh_token,
      });
      if (sessionError) throw sessionError;
      window.location.replace(result.must_change_password ? "/change-password" : "/");
    } catch {
      setError("نام کاربری یا رمز عبور صحیح نیست.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="auth-page">
    <section className="auth-panel">
      <div className="auth-brand"><span><Waves/></span><div><b>دلفین آبی</b><small>DOLPHIN ABI</small></div></div>
      <div className="auth-copy"><span>سامانه مدیریت مجموعه</span><h1>ورود به حساب کاربری</h1><p>نام کاربری و رمز عبوری که از مدیر مجموعه دریافت کرده‌اید وارد کنید.</p></div>
      <form onSubmit={submit}>
        <label>نام کاربری<div className="auth-input"><UserRound/><input value={username} onChange={e=>setUsername(e.target.value)} autoComplete="username" dir="ltr" required placeholder="username"/></div></label>
        <label>رمز عبور<div className="auth-input"><LockKeyhole/><input value={password} onChange={e=>setPassword(e.target.value)} type={showPassword?"text":"password"} autoComplete="current-password" dir="ltr" required placeholder="••••••••••••"/><button type="button" onClick={()=>setShowPassword(v=>!v)} aria-label="نمایش رمز">{showPassword?<EyeOff/>:<Eye/>}</button></div></label>
        {error&&<p className="auth-error">{error}</p>}
        <button className="auth-submit" disabled={loading}>{loading?"در حال ورود...":<><LogIn/> ورود امن</>}</button>
      </form>
      <footer>برای دریافت یا بازیابی رمز عبور با مدیر مجموعه تماس بگیرید.</footer>
    </section>
    <aside className="auth-art"><div className="water-orb"><Waves/></div><h2>مدیریت یکپارچه،<br/>تجربه‌ای آرام‌تر</h2><p>اعضا، سانس‌ها، پذیرش و گزارش‌ها در یک فضای امن و ساده.</p></aside>
  </main>;
}
