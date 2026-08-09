# معماری پیشنهادی — مرحله تحلیل

## گزینه‌های چندمستاجری
1. **Shared schema + tenant_id (پیشنهاد MVP):** اقتصادی و ساده‌تر؛ نیازمند RLS دقیق.
2. **Schema per tenant:** جداسازی بیشتر؛ نگهداری سخت‌تر.
3. **Database per tenant:** جداسازی حداکثری؛ هزینه و عملیات بالا.

انتخاب اجرایی منوط به تأیید کارفرماست.

## جداول اولیه
`organizations`, `branches`, `profiles`, `staff_roles`, `members`, `memberships`, `plans`, `cards`, `wallets`, `wallet_transactions`, `sessions`, `session_reservations`, `attendance_events`, `tickets`, `orders`, `payments`, `products`, `inventory_movements`, `audit_logs`, `subscriptions`.

اصول: UUID، زمان UTC، مبلغ صحیح، تراکنش مالی append-only، Supabase Auth و Postgres RLS.
