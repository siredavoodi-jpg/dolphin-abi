import "./globals.css";
import { AuthGate } from "./auth-gate";
export const metadata = { title: "دلفین آبی | مدیریت هوشمند استخر", description: "سامانه یکپارچه مدیریت استخر" };
export default function Layout({children}:{children:React.ReactNode}){return <html lang="fa" dir="rtl"><body><AuthGate>{children}</AuthGate></body></html>}
