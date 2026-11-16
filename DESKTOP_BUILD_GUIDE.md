# دليل بناء برنامج سطح المكتب لنظام Windows (EXE)

## البنية المعتمدة
- **Electron (`electron/main.cjs`)**: نافذة أصلية مع قفل النسخة الواحدة (`requestSingleInstanceLock`) وتخزين البيانات في `%APPDATA%/AqarPlus/data/aqarplus.sqlite`.
- **Embedded Express + SQLite WAL (`dist-server/server.mjs`)**: يعتمد على وحدة `node:sqlite` المدمجة في Node 22+ مع وضع `WAL`.
- **الواجهة (`./dist`)**: مبنية بمسارات نسبية (`base: './'`) + PWA + IndexedDB لتعمل دون إنترنت بالكامل.

## بناء ملفات التثبيت (.exe)
- الاعتماديات `electron` و`electron-builder` مُضافة ومثبتة في `package.json` و`package-lock.json`.
- يتطلب تغليف حزمة **NSIS EXE (`AqarPlus-1.0.0-x64.exe`)** تشغيل `electron-builder` على نظام **Windows** (أو عبر مسار GitHub Actions `windows-latest` الجاهز في `.github/workflows/ci-release.yml`، أو عبر `wine` على Linux).

```bash
# 1. تثبيت الاعتماديات الموحد
npm ci

# 2. التحقق وبناء الواجهة والخادم وإنتاج EXE على Windows
npm run typecheck
npm run dist:win
```

مخرجات البناء في مجلد `release/`:
- `AqarPlus-1.0.0-x64.exe` (مثبّت NSIS كامل باللغتين العربية والإنجليزية)
- `AqarPlus-Portable-1.0.0-x64.exe` (نسخة محمولة بدون تثبيت)
- `win-unpacked/AqarPlus.exe` (حزمة التطبيق التنفيذية المستخرجة)
