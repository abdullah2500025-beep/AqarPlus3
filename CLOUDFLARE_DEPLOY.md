# دليل نشر AqarPlus على Cloudflare Workers (مجاني + معزول للشركات)

## البنية المعتمدة
- **Static Assets (`./dist`)**: واجهة React + Tailwind + PWA Service Worker (`vite-plugin-pwa`) + تخزين IndexedDB معزول لكل شركة (`workspaceId`).
- **Durable Object SQLite المعزول (`AqarWorkspaceDO`)**: يتم توجيه كل شركة إلى Durable Object مستقل (`idFromName("ws:<workspaceId>")`) يحتوي على جداول SQLite مُنظمة (`meta`, `entities`, `user_credentials`, `sessions`, `operations_log`, `backups_store`) وفق `new_sqlite_classes` في `wrangler.toml`.
- **حماية الإنتاج الافتراضية**:
  - `AQAR_DEMO_LOGIN = "false"` افتراضياً (إخفاء قائمة الحسابات وأزرار الدخول التجريبي).
  - ربط التوقيع الأمني `HMAC-SHA256` بمعرّف الشركة `wid` لمنع استخدام جلسة شركة للوصول إلى شركة أخرى.
  - قفل الحساب مؤقتاً (5 دقائق) بعد 5 محاولات فاشلة لكلمة المرور أو رمز PIN.
- **WebSocket Hibernation API**: مزامنة لحظية متعددة الأجهزة دون استهلاك CPU عند السكون.

## خطوات النشر الفعلي على `workers.dev`
```bash
# 1. تثبيت الاعتماديات وتوليد الحزم
npm ci
npm run typecheck
npm run typecheck:worker
npm run build
npm run build:worker

# 2. تسجيل الدخول بحساب Cloudflare وضبط سر التوقيع
npx wrangler login
npx wrangler secret put AQAR_SESSION_SECRET
# (اختياري لميزة OCR)
npx wrangler secret put GEMINI_API_KEY

# 3. النشر الفعلي على الرابط الثابت *.workers.dev
npx wrangler deploy
```

## النشر التلقائي عبر GitHub Actions
يحتوي `.github/workflows/ci-release.yml` على مسار نشر آلي يتحقق من تعطيل `AQAR_DEMO_LOGIN` ثم ينشر عبر `cloudflare/wrangler-action@v3` فور ضبط الأسرار التالية في GitHub Repository Secrets:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
