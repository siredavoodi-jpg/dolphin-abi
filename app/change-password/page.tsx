"use client";

import { CheckCircle2, KeyRound, Waves } from "lucide-react";
import { FormEvent, useState } from "react";
import { functionsUrl, supabase } from "../../lib/supabase-browser";

export default function ChangePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 12) return setError("رمز عبور باید حداقل ۱۲ کاراکتر باشد.");
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) return setError("رمز باید شامل حروف کوچک، بزرگ و عدد باشد.");
    if (password !== confirm) return setError("تکرار رمز عبور یکسان نیست.");
    setLoading(true);
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error();
      const response = await fetch(functionsUrl + "/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + data.session.access_token,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
        },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) throw new Error();
      window.location.replace("/");
    } catch {
      setError("تغییر رمز انجام نشد. دوباره تلاش کنید.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="auth-page single">
    <section className="auth-panel">
      <div className="auth-brand"><span><Waves/></span><div><b>دلفین آبی</b><small>FIRST SIGN IN</small></div></div>
      <div className="auth-copy"><span>اولین ورود</span><h1>یک رمز شخصی انتخاب کنید</h1><p>رمز موقت فقط برای ورود اول بود. رمز جدید حداقل ۱۲ کاراکتر و شامل حروف کوچک، بزرگ و عدد باشد.</p></div>
      <form onSubmit={submit}>
        <label>رمز جدید<div className="auth-input"><KeyRound/><input value={password} onChange={e=>setPassword(e.target.value)} type="password" dir="ltr" required autoComplete="new-password"/></div></label>
        <label>تکرار رمز جدید<div className="auth-input"><CheckCircle2/><input value={confirm} onChange={e=>setConfirm(e.target.value)} type="password" dir="ltr" required autoComplete="new-password"/></div></label>
        {error&&<p className="auth-error">{error}</p>}
        <button className="auth-submit" disabled={loading}>{loading?"در حال ذخیره...":"ثبت رمز و ورود به داشبورد"}</button>
      </form>
    </section>
  </main>;
}
