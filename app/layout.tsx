import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "دلفین آبی | مدیریت هوشمند استخر", description: "سامانه یکپارچه مدیریت استخر" };
export default function Layout({children}:{children:React.ReactNode}){return <html lang="fa" dir="rtl"><body>{children}</body></html>}
