# Dolphin Abi

سامانه مدیریت مجموعه‌های آبی با رابط فارسی و راست‌به‌چپ. نسخه MVP برای استفاده داخلی مدیر و پذیرش طراحی شده و در فاز اول درگاه پرداخت آنلاین ندارد.

## اجرای محلی

پیش‌نیاز: Node.js و npm.

```powershell
npm install
npm run dev
```

برنامه از تنظیمات عمومی Supabase در `lib/supabase-browser.ts` استفاده می‌کند. هیچ کلید secret یا service-role نباید در مخزن ثبت شود.

## کنترل کیفیت

```powershell
npm run typecheck
npm run build
```

## ساختار مهم

- `app/`: رابط مدیریتی Next.js
- `supabase/functions/`: عملیات امن سمت سرور
- `supabase/migrations/`: مهاجرت‌های پایگاه داده
- `docs/ADMIN_ACCESS_RECOVERY.md`: روش بازیابی دسترسی مدیر
- `PRODUCT.md`: محدوده محصول و MVP
- `PROGRESS.md`: وضعیت پیشرفت

## محیط تولید

- وب‌سایت: https://dolphin-abi.vercel.app
- مخزن: https://github.com/siredavoodi-jpg/dolphin-abi
