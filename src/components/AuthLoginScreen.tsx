import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Delete,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useAqar } from '../context/AqarContext';

export function AuthLoginScreen() {
  const {
    lang,
    setLang,
    workspaceId,
    companyBranding,
    demoLoginEnabled,
    loginProfiles,
    loginWithPassword,
    loginWithPin,
    provisionWorkspace,
  } = useAqar();

  const isAr = lang === 'ar';
  const [mode, setMode] = useState<'password' | 'pin' | 'provision'>('password');
  const [wsSlugInput, setWsSlugInput] = useState(workspaceId || 'default');
  const [identifier, setIdentifier] = useState(demoLoginEnabled ? 'owner.sys@aqarplus.sa' : '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(loginProfiles[0]?.id || '');
  const [pinIdentifier, setPinIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Provision workspace fields
  const [newSlug, setNewSlug] = useState('');
  const [newCompanyAr, setNewCompanyAr] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPhone, setNewAdminPhone] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminPin, setNewAdminPin] = useState('');

  useEffect(() => {
    if (demoLoginEnabled && !identifier) {
      setIdentifier('owner.sys@aqarplus.sa');
    }
    if (loginProfiles.length > 0 && !selectedUserId) {
      setSelectedUserId(loginProfiles[0].id);
    }
  }, [demoLoginEnabled, identifier, loginProfiles, selectedUserId]);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim() || !password) {
      setErrorMsg(isAr ? 'أدخل البريد الإلكتروني / الهاتف وكلمة المرور' : 'Enter identifier and password');
      return;
    }
    setBusy(true);
    setErrorMsg('');
    const result = await loginWithPassword(identifier.trim(), password, wsSlugInput.trim() || 'default');
    setBusy(false);
    if (!result.ok) {
      setErrorMsg(result.error || (isAr ? 'بيانات الدخول غير صحيحة' : 'Invalid credentials'));
    }
  };

  const handlePinSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const targetId = loginProfiles.length > 0 ? selectedUserId : pinIdentifier.trim();
    if (!targetId) {
      setErrorMsg(isAr ? 'أدخل البريد الإلكتروني أو معرّف المستخدم أولاً' : 'Enter your email or user ID');
      return;
    }
    if (pin.length < 4) {
      setErrorMsg(isAr ? 'أدخل رمز PIN مكون من 4 إلى 6 أرقام' : 'Enter 4-6 digit PIN');
      return;
    }
    setBusy(true);
    setErrorMsg('');
    const result = await loginWithPin(targetId, pin, wsSlugInput.trim() || 'default');
    setBusy(false);
    if (!result.ok) {
      setErrorMsg(result.error || (isAr ? 'رمز PIN غير صحيح' : 'Incorrect PIN'));
      setPin('');
    }
  };

  const sanitizeSlugInput = (raw: string) =>
    raw
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

  const generateAutoSlug = () => {
    const suffix = Math.random().toString(36).slice(2, 6);
    const fromName = sanitizeSlugInput(newCompanyAr);
    const generated = fromName.length >= 3 ? `${fromName.slice(0, 20)}-${suffix}` : `co-${suffix}`;
    setNewSlug(generated);
  };

  const handleProvisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCompanyAr.trim() || !newAdminName.trim() || !newAdminEmail.trim()) {
      setErrorMsg(isAr ? 'يرجى إدخال اسم الشركة واسم المدير والبريد الإلكتروني' : 'Please fill required company and owner fields');
      return;
    }
    if (newAdminPassword.length < 8) {
      setErrorMsg(isAr ? 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل' : 'Password must be at least 8 characters');
      return;
    }
    if (newAdminPin && !/^\d{4,6}$/.test(newAdminPin)) {
      setErrorMsg(isAr ? 'رمز PIN يجب أن يتكون من 4 إلى 6 أرقام' : 'PIN must be 4-6 digits');
      return;
    }
    let cleanSlug = sanitizeSlugInput(newSlug);
    if (cleanSlug.length < 3 || cleanSlug === 'default') {
      const fromName = sanitizeSlugInput(newCompanyAr);
      const suffix = Date.now().toString(36).slice(-4);
      cleanSlug = fromName.length >= 3 ? `${fromName.slice(0, 20)}-${suffix}` : `co-${suffix}`;
      setNewSlug(cleanSlug);
    }
    setBusy(true);
    setErrorMsg('');
    const result = await provisionWorkspace({
      workspaceSlug: cleanSlug,
      companyNameAr: newCompanyAr.trim(),
      adminNameAr: newAdminName.trim(),
      adminEmail: newAdminEmail.trim(),
      adminPhone: newAdminPhone.trim(),
      password: newAdminPassword,
      pin: newAdminPin.trim() || undefined,
    });
    setBusy(false);
    if (!result.ok) {
      setErrorMsg(result.error || (isAr ? 'تعذر إنشاء مساحة عمل الشركة' : 'Failed to create company workspace'));
    }
  };

  const handleDemoProfileSignIn = async (profileId: string, email: string) => {
    setIdentifier(email);
    setSelectedUserId(profileId);
    setBusy(true);
    setErrorMsg('');
    const res = await loginWithPin(profileId, '1234', wsSlugInput.trim() || 'default');
    if (!res.ok) {
      const pwRes = await loginWithPassword(email, 'Aqar@2026', wsSlugInput.trim() || 'default');
      if (!pwRes.ok) {
        setErrorMsg(
          isAr
            ? 'تم تغيير كلمة المرور الافتراضية لهذا الحساب — أدخل كلمة المرور الجديدة أعلاه'
            : 'Custom password set for this account — please enter it above'
        );
      }
    }
    setBusy(false);
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 relative overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at top right, rgba(38, 71, 141, 0.42), transparent 55%), radial-gradient(circle at bottom left, rgba(16, 185, 129, 0.14), transparent 45%), linear-gradient(155deg, #1E40AF 0%, #0F1E4A 42%, #0A0E1A 100%)',
      }}
    >
      {/* Top Language Toggle */}
      <button
        type="button"
        onClick={() => setLang(isAr ? 'en' : 'ar')}
        className="fixed top-4 end-4 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-medium backdrop-blur-md cursor-pointer transition-colors"
      >
        <Globe className="w-3.5 h-3.5" />
        <span className="font-mono-num">{isAr ? 'EN' : 'AR'}</span>
      </button>

      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Main Glass Auth Card */}
        <div className="lg:col-span-7 rounded-3xl border border-white/15 bg-white/10 backdrop-blur-2xl text-white p-6 sm:p-8 shadow-2xl space-y-5 animate-aqar-fade-scale">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#26478D] to-[#0A0E1A] border border-white/20 flex items-center justify-center overflow-hidden shadow-lg shrink-0">
              {companyBranding?.logoDataUrl ? (
                <img
                  src={companyBranding.logoDataUrl}
                  alt="Company Logo"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src="./assets/aistudio/Aqar_plus_8de53ba4.svg"
                  alt="AqarPlus"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain p-2"
                />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-blue-200/90">
                {isAr ? companyBranding?.nameAr || 'AqarPlus — عقار بلس' : companyBranding?.nameEn || 'AqarPlus Property OS'}
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight mt-0.5">
                {isAr ? 'تسجيل الدخول الآمن للنظام' : 'Secure Workspace Sign-In'}
              </h1>
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[#0A0E1A]/50 border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => {
                setMode('password');
                setErrorMsg('');
              }}
              className={`py-2.5 px-2 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                mode === 'password' ? 'bg-[#26478D] text-white shadow' : 'text-blue-100/75 hover:text-white'
              }`}
            >
              <Mail className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{isAr ? 'كلمة المرور' : 'Password'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('pin');
                setErrorMsg('');
              }}
              className={`py-2.5 px-2 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                mode === 'pin' ? 'bg-[#26478D] text-white shadow' : 'text-blue-100/75 hover:text-white'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{isAr ? 'رمز PIN' : 'Quick PIN'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('provision');
                setErrorMsg('');
              }}
              className={`py-2.5 px-2 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                mode === 'provision' ? 'bg-emerald-600 text-white shadow' : 'text-blue-100/75 hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{isAr ? 'شركة جديدة' : 'New Company'}</span>
            </button>
          </div>

          {errorMsg && (
            <div className="px-4 py-3 rounded-xl bg-red-500/20 border border-red-400/40 text-red-100 text-xs font-medium">
              {errorMsg}
            </div>
          )}

          {mode === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-blue-100/90 mb-1.5 font-medium">
                  {isAr ? 'معرّف الشركة / مساحة العمل (Workspace ID)' : 'Company Workspace ID'}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={wsSlugInput}
                  onChange={(e) => setWsSlugInput(e.target.value)}
                  placeholder="default"
                  className="w-full px-4 py-2.5 rounded-xl border border-white/15 bg-[#0A0E1A]/55 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono-num"
                />
              </div>

              <div>
                <label className="block text-blue-100/90 mb-1.5 font-medium">
                  {isAr ? 'البريد الإلكتروني أو رقم الجوال' : 'Email or Phone'}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="name@company.sa"
                  className="w-full px-4 py-3 rounded-xl border border-white/15 bg-[#0A0E1A]/55 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono-num"
                />
              </div>

              <div>
                <label className="block text-blue-100/90 mb-1.5 font-medium">
                  {isAr ? 'كلمة المرور' : 'Password'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    dir="ltr"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-4 py-3 pe-11 rounded-xl border border-white/15 bg-[#0A0E1A]/55 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute top-1/2 -translate-y-1/2 end-3 text-blue-200/75 hover:text-white cursor-pointer"
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3.5 px-5 rounded-xl bg-white text-[#1E40AF] hover:bg-blue-50 disabled:opacity-60 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                <span>{isAr ? 'تسجيل الدخول وفتح مساحة العمل' : 'Sign In & Open Workspace'}</span>
                {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          )}

          {mode === 'pin' && (
            <form onSubmit={handlePinSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-blue-100/90 mb-1.5 font-medium">
                  {isAr ? 'معرّف الشركة (Workspace ID)' : 'Company Workspace ID'}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={wsSlugInput}
                  onChange={(e) => setWsSlugInput(e.target.value)}
                  placeholder="default"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 bg-[#0A0E1A]/55 text-white focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono-num"
                />
              </div>

              {loginProfiles.length > 0 ? (
                <div>
                  <label className="block text-blue-100/90 mb-1.5 font-medium">
                    {isAr ? 'الحساب المستهدف' : 'Select User Account'}
                  </label>
                  <select
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 bg-[#0A0E1A]/75 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    {loginProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {isAr ? `${p.nameAr} — ${p.roleLabelAr}` : `${p.nameEn} — ${p.roleLabelEn}`}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-blue-100/90 mb-1.5 font-medium">
                    {isAr ? 'البريد الإلكتروني أو معرّف المستخدم' : 'Email or User ID'}
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    required
                    value={pinIdentifier}
                    onChange={(e) => setPinIdentifier(e.target.value)}
                    placeholder="name@company.sa"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 bg-[#0A0E1A]/55 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono-num"
                  />
                </div>
              )}

              <div className="flex items-center justify-center gap-3 py-1" dir="ltr">
                {[0, 1, 2, 3].map((idx) => {
                  const filled = idx < pin.length;
                  return (
                    <div
                      key={idx}
                      className={`w-11 h-12 rounded-xl border flex items-center justify-center text-lg font-mono-num font-bold transition-transform ${
                        filled
                          ? 'bg-white text-[#1E40AF] border-white scale-105'
                          : 'bg-white/5 border-white/20 text-white/30'
                      }`}
                    >
                      {filled ? '•' : ''}
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-3 gap-2" dir="ltr">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      if (pin.length < 6) setPin((p) => p + digit);
                    }}
                    className="min-h-[44px] rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 border border-white/10 text-base font-mono-num font-semibold cursor-pointer"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setPin('')}
                  className="min-h-[44px] rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-[11px] font-medium text-blue-100 cursor-pointer"
                >
                  {isAr ? 'مسح' : 'Clear'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    if (pin.length < 6) setPin((p) => p + '0');
                  }}
                  className="min-h-[44px] rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 border border-white/10 text-base font-mono-num font-semibold cursor-pointer"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => setPin((p) => p.slice(0, -1))}
                  className="min-h-[44px] rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-blue-100 cursor-pointer"
                  aria-label="Backspace"
                >
                  <Delete className="w-4 h-4" />
                </button>
              </div>

              <button
                type="submit"
                disabled={busy || pin.length < 4}
                className="w-full py-3.5 px-5 rounded-xl bg-white text-[#1E40AF] hover:bg-blue-50 disabled:opacity-60 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                <span>{isAr ? 'تأكيد الدخول برمز PIN' : 'Sign In with PIN'}</span>
              </button>
            </form>
          )}

          {mode === 'provision' && (
            <form onSubmit={handleProvisionSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-blue-100/90 font-medium">
                      {isAr ? 'معرّف الشركة (اختياري — يُولَّد تلقائياً)' : 'Company Workspace Slug (Auto if blank)'}
                    </label>
                    <button
                      type="button"
                      onClick={generateAutoSlug}
                      className="text-[10px] text-emerald-300 hover:text-emerald-200 underline cursor-pointer"
                    >
                      {isAr ? 'توليد تلقائي' : 'Auto-generate'}
                    </button>
                  </div>
                  <input
                    type="text"
                    dir="ltr"
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value)}
                    placeholder="alnoor-properties"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 bg-[#0A0E1A]/55 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-blue-100/90 mb-1 font-medium">
                    {isAr ? 'اسم الشركة / المكتب العقاري' : 'Company Name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newCompanyAr}
                    onChange={(e) => setNewCompanyAr(e.target.value)}
                    placeholder={isAr ? 'شركة النور العقارية' : 'Al-Noor Properties'}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 bg-[#0A0E1A]/55 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-blue-100/90 mb-1 font-medium">
                    {isAr ? 'اسم مالك النظام' : 'Owner Full Name'}
                  </label>
                  <input
                    type="text"
                    required
                    value={newAdminName}
                    onChange={(e) => setNewAdminName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 bg-[#0A0E1A]/55 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-blue-100/90 mb-1 font-medium">
                    {isAr ? 'البريد الإلكتروني للمدير' : 'Owner Email'}
                  </label>
                  <input
                    type="email"
                    dir="ltr"
                    required
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    placeholder="owner@company.sa"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 bg-[#0A0E1A]/55 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 font-mono-num"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-blue-100/90 mb-1 font-medium">
                    {isAr ? 'كلمة مرور قوية (8+ أحرف)' : 'Strong Password (8+ chars)'}
                  </label>
                  <input
                    type="password"
                    dir="ltr"
                    required
                    minLength={8}
                    value={newAdminPassword}
                    onChange={(e) => setNewAdminPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 bg-[#0A0E1A]/55 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>
                <div>
                  <label className="block text-blue-100/90 mb-1 font-medium">
                    {isAr ? 'رقم الجوال + رمز PIN اختياري' : 'Phone / Optional 4-6 PIN'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      dir="ltr"
                      value={newAdminPhone}
                      onChange={(e) => setNewAdminPhone(e.target.value)}
                      placeholder="05xxxxxxxx"
                      className="w-full px-3 py-2.5 rounded-xl border border-white/15 bg-[#0A0E1A]/55 text-white placeholder:text-slate-400 font-mono-num"
                    />
                    <input
                      type="password"
                      dir="ltr"
                      maxLength={6}
                      value={newAdminPin}
                      onChange={(e) => setNewAdminPin(e.target.value)}
                      placeholder="PIN"
                      className="w-full px-3 py-2.5 rounded-xl border border-white/15 bg-[#0A0E1A]/55 text-white placeholder:text-slate-400 font-mono-num"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3.5 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-60 font-bold text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-lg"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                <span>{isAr ? 'تأسيس مساحة عمل معزولة للشركة' : 'Provision Isolated Company Workspace'}</span>
              </button>
            </form>
          )}
        </div>

        {/* Team Profiles & Security Info Panel */}
        <div className="lg:col-span-5 rounded-3xl border border-white/15 bg-[#0A0E1A]/65 backdrop-blur-2xl text-white p-6 shadow-2xl flex flex-col justify-between gap-5">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-300">
              <ShieldCheck className="w-4 h-4" />
              <span>{isAr ? 'عزل الشركات والصلاحيات الموثقة' : 'Company & Role Isolation'}</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              {isAr
                ? 'تم عزل كل شركة في قاعدة بيانات SQLite مستقلة مع توقيع HMAC-SHA256 مرتبط بمعرّف الشركة، وحماية من محاولات التخمين، وتشفير النسخ الاحتياطية بـ AES-256-GCM.'
                : 'Every company runs in an isolated SQLite store bound by HMAC-SHA256 workspace tokens, brute-force lockout protection, and AES-256-GCM encrypted backups.'}
            </p>
            {!demoLoginEnabled && (
              <div className="space-y-2.5">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-400/25 text-[11px] text-emerald-200 leading-relaxed">
                  {isAr
                    ? 'وضع الإنتاج الآمن مفعّل: تم تعطيل الدخول التجريبي السريع وإخفاء قائمة الحسابات من الواجهة العامة.'
                    : 'Production security active: Demo quick-login and public user enumeration are disabled.'}
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-[11px] text-blue-100/90 space-y-1.5 leading-relaxed">
                  <div className="font-bold text-white">
                    {isAr ? 'مستخدم جديد؟' : 'New to AqarPlus?'}
                  </div>
                  <p>
                    {isAr
                      ? 'اضغط على تبويب «شركة جديدة» بالأعلى لإنشاء شركتك وحساب المالك بكلمة مرور ورمز PIN من اختيارك فوراً، أو أدخل بيانات شركتك القائمة لتسجيل الدخول.'
                      : 'Switch to the "New Company" tab above to provision your isolated company database and owner credentials immediately, or sign in to an existing workspace.'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {demoLoginEnabled && loginProfiles.length > 0 && (
            <div className="space-y-3 flex-1">
              <div className="p-3 rounded-xl bg-blue-500/15 border border-blue-400/30 text-[11px] text-blue-100 space-y-1">
                <div className="font-bold">
                  {isAr ? 'حسابات فريق العمل (وضع التطوير فقط)' : 'Team Accounts (Dev Mode Only)'}
                </div>
                <div className="font-mono-num text-blue-200/90" dir="ltr">
                  Password: Aqar@2026 · PIN: 1234
                </div>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto pe-1">
                {loginProfiles.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    disabled={busy}
                    onClick={() => void handleDemoProfileSignIn(profile.id, profile.email)}
                    className="w-full p-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/15 hover:border-blue-400/50 text-start flex items-center justify-between gap-2 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">
                        {isAr ? profile.nameAr : profile.nameEn}
                      </div>
                      <div className="text-[11px] text-slate-300 truncate">
                        {isAr ? profile.roleLabelAr : profile.roleLabelEn} ·{' '}
                        <span className="font-mono-num">{profile.email}</span>
                      </div>
                    </div>
                    <UserCheck className="w-4 h-4 text-emerald-300 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="pt-3 border-t border-white/10 text-[11px] text-slate-400 flex items-center justify-between">
            <span>{isAr ? 'تخزين IndexedDB + SQLite WAL' : 'IndexedDB + SQLite WAL'}</span>
            <span className="font-mono-num">AqarPlus v1.0</span>
          </div>
        </div>
      </div>
    </div>
  );
}
