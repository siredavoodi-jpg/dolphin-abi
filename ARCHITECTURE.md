# معماری پیشنهادی — مرحله تحلیل

## گزینه‌های چندمستاجری
1. **Shared schema + tenant_id (پیشنهاد MVP):** اقتصادی و ساده‌تر؛ نیازمند RLS دقیق.
2. **Schema per tenant:** جداسازی بیشتر؛ نگهداری سخت‌تر.
3. **Database per tenant:** جداسازی حداکثری؛ هزینه و عملیات بالا.

گزینه اول در تاریخ ۱۴۰۵/۰۵/۱۸ تأیید شد: دیتابیس مشترک با `organization_id` و RLS.

## جداول اولیه
`organizations`, `branches`, `profiles`, `staff_roles`, `members`, `memberships`, `plans`, `cards`, `wallets`, `wallet_transactions`, `sessions`, `session_reservations`, `attendance_events`, `tickets`, `orders`, `payments`, `products`, `inventory_movements`, `audit_logs`, `subscriptions`.

اصول: UUID، زمان UTC، مبلغ صحیح، تراکنش مالی append-only، Supabase Auth و Postgres RLS. فاز اول بدون درگاه بانکی است و حساب عضو توسط ادمین با رمز موقت ایجاد می‌شود.
