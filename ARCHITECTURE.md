# معماری MVP — وضعیت فعلی

## گزینه‌های چندمستاجری
1. **Shared schema + tenant_id (پیشنهاد MVP):** اقتصادی و ساده‌تر؛ نیازمند RLS دقیق.
2. **Schema per tenant:** جداسازی بیشتر؛ نگهداری سخت‌تر.
3. **Database per tenant:** جداسازی حداکثری؛ هزینه و عملیات بالا.

گزینه اول در تاریخ ۱۴۰۵/۰۵/۱۸ تأیید شد: دیتابیس مشترک با `organization_id` و RLS.

## جداول فعال MVP
`organizations`, `branches`, `profiles`, `organization_users`, `members`, `membership_plans`, `memberships`, `payment_records`, `pool_sessions`, `session_reservations`, `attendance_events`, `audit_logs`.

عملیات دارای سطح دسترسی از طریق Supabase Edge Functions انجام می‌شود. رابط کاربری فقط publishable key را دریافت می‌کند و هیچ secret/service-role key در مرورگر یا مخزن قرار نمی‌گیرد.

اصول: UUID، زمان UTC، مبلغ صحیح، تراکنش مالی append-only، Supabase Auth و Postgres RLS. فاز اول بدون درگاه بانکی است و حساب عضو توسط ادمین با رمز موقت ایجاد می‌شود.

## استقرار

- رابط کاربری: Next.js روی Vercel
- پایگاه داده و احراز هویت: Supabase در فرانکفورت
- دامنه نسخه آزمایشی: `https://dolphin-abi.vercel.app`
- خط مبنای دیتابیس: `supabase/migrations/*_baseline_mvp_schema.sql`

## محیط Supabase

- Project: Dolphin Abi
- Project ref: `slztfxrwrsnwyyrqfshc`
- Region: `us-west-2` (بازسازی‌شده در ۶ سپتامبر ۲۰۲۶ پس از حذف پروژه قبلی)
- PostgreSQL: 17
- اطلاعات محرمانه و کلیدهای secret/service-role نباید در مخزن ثبت شوند.
