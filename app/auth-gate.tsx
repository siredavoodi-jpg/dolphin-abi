"use client";

import { LogOut, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase-browser";

const publicPaths = new Set(["/login"]);

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    let active = true;

    async function check() {
      const path = window.location.pathname;
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!active) return;

      if (!session) {
        setSignedIn(false);
        if (!publicPaths.has(path)) {
          window.location.replace("/login");
          return;
        }
        setReady(true);
        return;
      }

      setSignedIn(true);
      const { data: profile } = await supabase
        .from("profiles")
        .select("must_change_password,account_status")
        .eq("id", session.user.id)
        .single();

      if (!active) return;
      if (!profile || profile.account_status !== "active") {
        await supabase.auth.signOut();
        window.location.replace("/login?blocked=1");
        return;
      }
      if (profile.must_change_password && path !== "/change-password") {
        window.location.replace("/change-password");
        return;
      }
      if (!profile.must_change_password && (path === "/login" || path === "/change-password")) {
        window.location.replace("/");
        return;
      }
      setReady(true);
    }

    void check();
    const { data: listener } = supabase.auth.onAuthStateChange(() => void check());
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    window.location.replace("/login");
  }

  if (!ready) {
    return <div className="auth-loading"><span/><p>در حال بررسی دسترسی امن...</p></div>;
  }

  return <>
    {children}
    {signedIn && window.location.pathname === "/" && (
      <button className="auth-signout" onClick={signOut}>
        <ShieldCheck size={16}/><span>نشست امن</span><LogOut size={16}/>
      </button>
    )}
  </>;
}
