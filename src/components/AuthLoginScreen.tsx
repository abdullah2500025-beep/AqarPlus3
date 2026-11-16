import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Delete,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  CompanyDiscoveryOption,
  MfaChallengeDetails,
  useAqar,
} from '../context/AqarContext';
import { UnifiedBackButton } from './ui/UnifiedComponents';

type AuthMode = 'password' | 'pin' | 'provision' | 'recovery';
type AuthStep = 'credentials' | 'select_company' | 'mfa_challenge';

export function AuthLoginScreen() {
  const {
    lang,
    setLang,
    workspaceId,
    companyBranding,
    lastCompanyMeta,
    demoLoginEnabled,
    loginProfiles,
    rememberedIdentifier,
    saveRememberedIdentifier,
    sessionExpiredReason,
    clearSessionExpiredReason,
    isBrowserOnline,
    isOfflineSimulated,
    loginWithPassword,
    loginWithPin,
    selectCompanyForLogin,
    verifyMfaForLogin,
    resendMfaCode,
    provisionWorkspace,
  } = useAqar();

  const isAr = lang === 'ar';
  const onlineNow = isBrowserOnline && !isOfflineSimulated;

  const [step, setStep] = useState<AuthStep>('credentials');
  const [mode, setMode] = useState<AuthMode>('password');
  const [manualWorkspaceMode, setManualWorkspaceMode] = useState(false);
  const [wsSlugInput, setWsSlugInput] = useState(workspaceId || 'default');

  const [identifier, setIdentifier] = useState(() =>
    demoLoginEnabled ? 'owner.sys@aqarplus.sa' : rememberedIdentifier || ''
  );
  const [rememberUsername, setRememberUsername] = useState(() => Boolean(rememberedIdentifier));
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [selectedUserId, setSelectedUserId] = useState(loginProfiles[0]?.id || '');
  const [pinIdentifier, setPinIdentifier] = useState(() => rememberedIdentifier || '');
  const [pin, setPin] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Multi-company selection state
  const [selectionToken, setSelectionToken] = useState('');
  const [discoveredCompanies, setDiscoveredCompanies] = useState<CompanyDiscoveryOption[]>([]);

  // Adaptive MFA challenge state
  const [mfaDetails, setMfaDetails] = useState<MfaChallengeDetails | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [trustDevice, setTrustDevice] = useState(true);

  // Recovery flow state
  const [recoveryPurpose, setRecoveryPurpose] = useState<'password_reset' | 'pin_reset'>('password_reset');
  const [recoveryStep, setRecoveryStep] = useState<'request' | 'reset'>('request');
  const [recoveryIdentifier, setRecoveryIdentifier] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryNewSecret, setRecoveryNewSecret] = useState('');
  const [recoveryConfirmSecret, setRecoveryConfirmSecret] = useState('');
  const [recoveryNotice, setRecoveryNotice] = useState('');
  const [recoverySimCode, setRecoverySimCode] = useState('');

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

  // Physical keyboard support in PIN mode
  useEffect(() => {
    if (step !== 'credentials' || mode !== 'pin') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTextInput =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
      if (isTextInput) return;

      if (/^\d$/.test(e.key)) {
        e.preventDefault();
        setErrorMsg('');
        setPin((prev) => (prev.length < 6 ? prev + e.key : prev));
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setPin((prev) => prev.slice(0, -1));
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setPin('');
      } else if (e.key === 'Enter' && pin.length >= 4 && !busy) {
        e.preventDefault();
        void handlePinSubmit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  const handleLoginFlowOutcome = (result: Awaited<ReturnType<typeof loginWithPassword>>) => {
    if (result.ok) {
      return true;
    }
    if (result.requiresCompanySelection && result.selectionToken && result.companies?.length) {
      setSelectionToken(result.selectionToken);
      setDiscoveredCompanies(result.companies);
      setStep('select_company');
      setErrorMsg('');
      return false;
    }
    if (result.requiresMfa && result.mfaChallenge) {
      setMfaDetails(result.mfaChallenge);
      setMfaCode('');
      setTrustDevice(true);
      setStep('mfa_challenge');
      setErrorMsg('');
      return false;
    }
    setErrorMsg(result.error || (isAr ? 'بيانات الدخول غير صحيحة' : 'Invalid credentials'));
    return false;
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onlineNow) {
      setErrorMsg(
        isAr
          ? 'لا يوجد اتصال بالإنترنت — تأكد من الاتصال بالشبكة للمصادقة مع الخادم'
          : 'No internet connection — connect to authenticate with server'
      );
      return;
    }
    const cleanId = identifier.trim();
    if (!cleanId || !password) {
      setErrorMsg(
        isAr
          ? 'أدخل البريد الإلكتروني أو اسم المستخدم أو رقم الجوال وكلمة المرور'
          : 'Enter email, username or phone and password'
      );
      return;
    }

    if (rememberUsername) {
      saveRememberedIdentifier(cleanId);
    } else {
      saveRememberedIdentifier(null);
    }

    setBusy(true);
    setErrorMsg('');
    setSuccessMsg('');
    clearSessionExpiredReason();

    const useAutoDiscover = !manualWorkspaceMode;
    const result = await loginWithPassword(
      cleanId,
      password,
      manualWorkspaceMode ? wsSlugInput.trim() || 'default' : undefined,
      rememberMe,
      {
        autoDiscover: useAutoDiscover,
        selectedWorkspaceId: manualWorkspaceMode ? wsSlugInput.trim() || 'default' : undefined,
      }
    );
    setBusy(false);
    handleLoginFlowOutcome(result);
  };

  const handlePinSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!onlineNow) {
      setErrorMsg(
        isAr
          ? 'لا يوجد اتصال بالإنترنت — تأكد من الاتصال بالشبكة للتحقق من رمز PIN'
          : 'No internet connection'
      );
      return;
    }
    const targetId =
      demoLoginEnabled && loginProfiles.length > 0 && selectedUserId
        ? selectedUserId
        : pinIdentifier.trim() || identifier.trim();
    if (!targetId) {
      setErrorMsg(
        isAr
          ? 'أدخل البريد الإلكتروني أو اسم المستخدم أو رقم الجوال أولاً'
          : 'Enter email, username, or phone first'
      );
      return;
    }
    if (pin.length < 4) {
      setErrorMsg(isAr ? 'أدخل رمز PIN مكون من 4 إلى 6 أرقام' : 'Enter 4-6 digit PIN');
      return;
    }

    setBusy(true);
    setErrorMsg('');
    setSuccessMsg('');
    clearSessionExpiredReason();

    const useAutoDiscover = !manualWorkspaceMode;
    const result = await loginWithPin(
      targetId,
      pin,
      manualWorkspaceMode ? wsSlugInput.trim() || 'default' : undefined,
      rememberMe,
      {
        autoDiscover: useAutoDiscover,
        selectedWorkspaceId: manualWorkspaceMode ? wsSlugInput.trim() || 'default' : undefined,
      }
    );
    setBusy(false);
    if (!handleLoginFlowOutcome(result)) {
      setPin('');
    }
  };

  const handleCompanySelect = async (company: CompanyDiscoveryOption) => {
    if (!selectionToken || busy) return;
    setBusy(true);
    setErrorMsg('');
    const result = await selectCompanyForLogin(selectionToken, company.workspaceId, rememberMe);
    setBusy(false);
    handleLoginFlowOutcome(result);
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaDetails?.challengeToken) return;
    if (mfaCode.trim().length < 6) {
      setErrorMsg(isAr ? 'أدخل رمز التحقق المكون من 6 أرقام' : 'Enter 6-digit verification code');
      return;
    }
    setBusy(true);
    setErrorMsg('');
    const result = await verifyMfaForLogin(mfaDetails.challengeToken, mfaCode.trim(), trustDevice);
    setBusy(false);
    handleLoginFlowOutcome(result);
  };

  const handleMfaResend = async () => {
    if (!mfaDetails?.challengeToken || busy) return;
    setBusy(true);
    setErrorMsg('');
    const res = await resendMfaCode(mfaDetails.challengeToken);
    setBusy(false);
    if (!res.ok) {
      setErrorMsg(res.error || (isAr ? 'تعذر إعادة إرسال الرمز' : 'Failed to resend code'));
    } else {
      setMfaDetails((prev) =>
        prev
          ? {
              ...prev,
              deliveryNotice: res.deliveryNotice || prev.deliveryNotice,
              localSimulationCode: res.localSimulationCode ?? prev.localSimulationCode,
              expiresAt: res.expiresAt || prev.expiresAt,
            }
          : prev
      );
      setSuccessMsg(isAr ? 'تم إرسال رمز تحقق جديد إلى بريدك الموثق' : 'New verification code sent');
    }
  };

  const openRecoveryMode = (purpose: 'password_reset' | 'pin_reset') => {
    setRecoveryPurpose(purpose);
    setRecoveryStep('request');
    setRecoveryCode('');
    setRecoveryNewSecret('');
    setRecoveryConfirmSecret('');
    setRecoveryNotice('');
    setRecoverySimCode('');
    setErrorMsg('');
    setSuccessMsg('');
    setRecoveryIdentifier(identifier || pinIdentifier || '');
    setStep('credentials');
    setMode('recovery');
  };

  const handleRecoveryRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryIdentifier.trim()) {
      setErrorMsg(
        isAr ? 'أدخل البريد الإلكتروني أو اسم المستخدم أو الجوال المسجل' : 'Enter registered email, username or phone'
      );
      return;
    }
    setBusy(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/recovery/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': manualWorkspaceMode ? wsSlugInput.trim() || 'default' : workspaceId || 'default',
        },
        body: JSON.stringify({
          identifier: recoveryIdentifier.trim(),
          purpose: recoveryPurpose,
          autoDiscover: !manualWorkspaceMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data?.error || 'تعذر طلب رمز الاستعادة');
      } else {
        setRecoveryNotice(data?.message || '');
        setRecoverySimCode(data?.localSimulationCode ? String(data.localSimulationCode) : '');
        setRecoveryStep('reset');
      }
    } catch {
      setErrorMsg(isAr ? 'تعذر الاتصال بالخادم لإرسال طلب الاستعادة' : 'Network error requesting recovery');
    } finally {
      setBusy(false);
    }
  };

  const handleRecoveryReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryCode.trim()) {
      setErrorMsg(isAr ? 'أدخل رمز التحقق' : 'Enter verification code');
      return;
    }
    if (recoveryNewSecret !== recoveryConfirmSecret) {
      setErrorMsg(isAr ? 'القيمة الجديدة وتأكيدها غير متطابقتين' : 'Values do not match');
      return;
    }
    setBusy(true);
    setErrorMsg('');
    try {
      const res = await fetch('/api/auth/recovery/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-workspace-id': manualWorkspaceMode ? wsSlugInput.trim() || 'default' : workspaceId || 'default',
        },
        body: JSON.stringify({
          identifier: recoveryIdentifier.trim(),
          purpose: recoveryPurpose,
          code: recoveryCode.trim(),
          newSecret: recoveryNewSecret,
          confirmSecret: recoveryConfirmSecret,
          autoDiscover: !manualWorkspaceMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data?.error || 'تعذر إتمام عملية الاستعادة');
      } else {
        setSuccessMsg(
          recoveryPurpose === 'password_reset'
            ? isAr
              ? 'تم تحديث كلمة المرور بنجاح — يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.'
              : 'Password updated successfully — sign in with your new password.'
            : isAr
            ? 'تم إعادة تعيين رمز PIN بنجاح — يمكنك الآن الدخول بالرمز الجديد.'
            : 'PIN updated successfully — sign in with your new PIN.'
        );
        setMode(recoveryPurpose === 'pin_reset' ? 'pin' : 'password');
      }
    } catch {
      setErrorMsg(isAr ? 'تعذر الاتصال بالخادم' : 'Network error');
    } finally {
      setBusy(false);
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
    const res = await loginWithPin(profileId, '1234', wsSlugInput.trim() || 'default', rememberMe);
    if (!res.ok) {
      if (res.requiresMfa || res.requiresCompanySelection) {
        setBusy(false);
        handleLoginFlowOutcome(res);
        return;
      }
      const pwRes = await loginWithPassword(email, 'Aqar@2026', wsSlugInput.trim() || 'default', rememberMe);
      if (!pwRes.ok) {
        setBusy(false);
        if (pwRes.requiresMfa || pwRes.requiresCompanySelection) {
          handleLoginFlowOutcome(pwRes);
          return;
        }
        setErrorMsg(
          isAr
            ? 'تم تغيير كلمة المرور الافتراضية لهذا الحساب — أدخل كلمة المرور الجديدة'
            : 'Custom password set for this account — please enter it manually'
        );
        return;
      }
    }
    setBusy(false);
  };

  const activeCompanyName =
    step === 'mfa_challenge' && mfaDetails?.companyBranding
      ? isAr
        ? mfaDetails.companyBranding.nameAr
        : mfaDetails.companyBranding.nameEn
      : isAr
      ? companyBranding?.nameAr || lastCompanyMeta?.nameAr || 'AqarPlus — عقار بلس'
      : companyBranding?.nameEn || lastCompanyMeta?.nameEn || 'AqarPlus Property OS';

  const activeCompanyLogo =
    (step === 'mfa_challenge' && mfaDetails?.companyBranding?.logoDataUrl) ||
    companyBranding?.logoDataUrl ||
    lastCompanyMeta?.logoDataUrl;

  const showDemoPanel = demoLoginEnabled && loginProfiles.length > 0 && step === 'credentials';

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 relative overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at top right, rgba(38, 71, 141, 0.42), transparent 55%), radial-gradient(circle at bottom left, rgba(16, 185, 129, 0.14), transparent 45%), linear-gradient(155deg, #1E40AF 0%, #0F1E4A 42%, #0A0E1A 100%)',
      }}
    >
      {/* Top Action Bar: Connection State + Language Toggle */}
      <div className="fixed top-4 inset-x-4 flex items-center justify-between pointer-events-none z-20">
        <div className="pointer-events-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 border border-white/15 text-xs text-white/90 backdrop-blur-md">
          {onlineNow ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span className="whitespace-nowrap">{isAr ? 'متصل بالخادم' : 'Online'}</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span className="whitespace-nowrap">{isAr ? 'غير متصل بالإنترنت' : 'Offline'}</span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setLang(isAr ? 'en' : 'ar')}
          className="pointer-events-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-medium backdrop-blur-md cursor-pointer transition-colors whitespace-nowrap shrink-0"
        >
          <Globe className="w-3.5 h-3.5" />
          <span className="font-mono-num">{isAr ? 'EN' : 'AR'}</span>
        </button>
      </div>

      <div
        className={`w-full pt-10 sm:pt-6 ${
          showDemoPanel ? 'max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch' : 'max-w-[500px]'
        }`}
      >
        {/* Main Unified Glass Auth Card */}
        <div
          className={`${
            showDemoPanel ? 'lg:col-span-7' : 'w-full'
          } rounded-3xl border border-white/15 bg-white/10 backdrop-blur-2xl text-white p-6 sm:p-8 shadow-2xl space-y-5`}
        >
          {/* Brand Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-[#26478D] to-[#0A0E1A] border border-white/20 flex items-center justify-center overflow-hidden shadow-lg shrink-0">
                {activeCompanyLogo ? (
                  <img
                    src={activeCompanyLogo}
                    alt={activeCompanyName}
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
                <div className="text-xs font-semibold text-blue-200/90 truncate">{activeCompanyName}</div>
                <h1 className="text-xl font-bold tracking-tight mt-0.5 text-white">
                  {step === 'select_company'
                    ? isAr
                      ? 'اختر الشركة للمتابعة'
                      : 'Select Company Workspace'
                    : step === 'mfa_challenge'
                    ? isAr
                      ? 'التحقق الأمني الإضافي'
                      : 'Additional Security Check'
                    : mode === 'provision'
                    ? isAr
                      ? 'تأسيس شركة جديدة'
                      : 'New Company Setup'
                    : mode === 'recovery'
                    ? isAr
                      ? 'استعادة الوصول للحساب'
                      : 'Account Recovery'
                    : isAr
                    ? 'تسجيل الدخول'
                    : 'Sign In'}
                </h1>
              </div>
            </div>
          </div>

          {/* Session Expired / Remote Revocation Notice */}
          {sessionExpiredReason && (
            <div className="px-4 py-3 rounded-xl bg-amber-500/20 border border-amber-400/40 text-amber-100 text-xs flex items-start justify-between gap-3 leading-relaxed">
              <span>{sessionExpiredReason}</span>
              <button
                type="button"
                onClick={clearSessionExpiredReason}
                className="text-amber-200 hover:text-white font-bold text-[11px] whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isAr ? 'إخفاء' : 'Dismiss'}
              </button>
            </div>
          )}

          {/* Offline Notice */}
          {!onlineNow && (
            <div className="px-4 py-3 rounded-xl bg-slate-900/60 border border-white/15 text-slate-200 text-xs leading-relaxed">
              {isAr
                ? 'الاتصال بالخادم غير متوفر حالياً. يتطلب تسجيل الدخول الأول أو تجديد الجلسة اتصالاً نشطاً بالإنترنت.'
                : 'You are offline. Signing in requires an active connection to verify credentials.'}
            </div>
          )}

          {/* Primary Mode Tabs (shown on credentials step when not in recovery) */}
          {step === 'credentials' && mode !== 'recovery' && (
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-[#0A0E1A]/50 border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => {
                  setMode('password');
                  setErrorMsg('');
                }}
                className={`py-2.5 px-2 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  mode === 'password' ? 'bg-[#26478D] text-white shadow' : 'text-blue-100/75 hover:text-white'
                }`}
              >
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span>{isAr ? 'كلمة المرور' : 'Password'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('pin');
                  setErrorMsg('');
                }}
                className={`py-2.5 px-2 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  mode === 'pin' ? 'bg-[#26478D] text-white shadow' : 'text-blue-100/75 hover:text-white'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5 shrink-0" />
                <span>{isAr ? 'رمز PIN' : 'Quick PIN'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('provision');
                  setErrorMsg('');
                }}
                className={`py-2.5 px-2 rounded-xl font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                  mode === 'provision' ? 'bg-emerald-600 text-white shadow' : 'text-blue-100/75 hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5 shrink-0" />
                <span>{isAr ? 'شركة جديدة' : 'New Company'}</span>
              </button>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="px-4 py-3 rounded-xl bg-red-500/20 border border-red-400/40 text-red-100 text-xs font-medium leading-relaxed"
            >
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="px-4 py-3 rounded-xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-100 text-xs font-medium leading-relaxed">
              {successMsg}
            </div>
          )}

          {/* STEP 2: MULTI-COMPANY SELECTOR */}
          {step === 'select_company' && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between gap-2">
                <UnifiedBackButton
                  lang={lang}
                  compact
                  onClick={() => {
                    setStep('credentials');
                    setErrorMsg('');
                  }}
                />
                <span className="text-blue-100/80">
                  {isAr ? 'حسابك مرتبط بأكثر من شركة — اختر مساحة العمل' : 'Select a company workspace'}
                </span>
              </div>

              <div className="space-y-2.5 max-h-[340px] overflow-y-auto">
                {discoveredCompanies.map((comp) => (
                  <button
                    key={comp.workspaceId}
                    type="button"
                    disabled={busy}
                    onClick={() => void handleCompanySelect(comp)}
                    className="w-full p-4 rounded-2xl border border-white/15 bg-white/5 hover:bg-white/15 hover:border-blue-400/60 transition-colors flex items-center justify-between gap-3 text-start cursor-pointer disabled:opacity-60"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-[#26478D]/60 border border-white/15 flex items-center justify-center overflow-hidden shrink-0">
                        {comp.logoDataUrl ? (
                          <img
                            src={comp.logoDataUrl}
                            alt={comp.companyNameAr}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Building2 className="w-5 h-5 text-blue-200" />
                        )}
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="text-sm font-bold text-white truncate">
                          {isAr ? comp.companyNameAr : comp.companyNameEn}
                        </div>
                        <div className="text-[11px] text-blue-200/80 flex items-center gap-1.5 flex-wrap">
                          <span>{isAr ? comp.roleLabelAr : comp.roleLabelEn || comp.roleLabelAr}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-num" dir="ltr">
                            {comp.workspaceId}
                          </span>
                        </div>
                      </div>
                    </div>
                    {isAr ? (
                      <ArrowLeft className="w-4 h-4 text-blue-200 shrink-0" />
                    ) : (
                      <ArrowRight className="w-4 h-4 text-blue-200 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: ADAPTIVE MFA VERIFICATION */}
          {step === 'mfa_challenge' && mfaDetails && (
            <form onSubmit={handleMfaSubmit} className="space-y-4 text-xs">
              <div className="flex items-center justify-between gap-2">
                <UnifiedBackButton
                  lang={lang}
                  compact
                  onClick={() => {
                    setStep('credentials');
                    setMfaDetails(null);
                    setErrorMsg('');
                  }}
                />
                <span className="text-emerald-300 font-semibold">
                  {mfaDetails.reason === 'unusual_activity'
                    ? isAr
                      ? 'تأكيد حماية الحساب'
                      : 'Account Protection Check'
                    : isAr
                    ? 'تأكيد جهاز جديد'
                    : 'New Device Verification'}
                </span>
              </div>

              <div className="p-3.5 rounded-xl bg-blue-500/15 border border-blue-400/30 text-blue-100 leading-relaxed space-y-1">
                <div>{mfaDetails.deliveryNotice}</div>
                <div className="text-[11px] text-blue-200/80 font-mono-num" dir="ltr">
                  {mfaDetails.maskedEmail}
                </div>
              </div>

              {mfaDetails.localSimulationCode && (
                <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-100 space-y-1">
                  <div className="font-bold">
                    {isAr ? 'معاينة محلية للرمز (بيئة بدون SMTP مفعّل)' : 'Local Verification Code'}
                  </div>
                  <div className="font-mono-num text-base font-bold tracking-widest" dir="ltr">
                    {mfaDetails.localSimulationCode}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-blue-100/90 mb-1.5 font-medium">
                  {isAr ? 'رمز التحقق المكون من 6 أرقام' : '6-Digit Verification Code'}
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  required
                  autoFocus
                  maxLength={6}
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="w-full px-4 py-3 rounded-xl border border-white/15 bg-[#0A0E1A]/55 text-white text-center text-lg font-mono-num tracking-[0.35em] focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <label className="flex items-center gap-2.5 text-xs text-blue-100/90 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={trustDevice}
                  onChange={(e) => setTrustDevice(e.target.checked)}
                  className="w-4 h-4 rounded border-white/30 bg-[#0A0E1A]/60 accent-blue-500 cursor-pointer"
                />
                <span>
                  {isAr
                    ? 'الوثوق بهذا الجهاز وعدم طلب الرمز في كل دخول من هذا الجهاز'
                    : 'Trust this device so MFA is not prompted on every login'}
                </span>
              </label>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleMfaResend()}
                  className="inline-flex items-center gap-1.5 text-blue-300 hover:text-white underline cursor-pointer whitespace-nowrap"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>{isAr ? 'إعادة إرسال الرمز' : 'Resend Code'}</span>
                </button>
              </div>

              <button
                type="submit"
                disabled={busy || mfaCode.length < 6}
                className="w-full py-3.5 px-5 rounded-xl bg-white text-[#1E40AF] hover:bg-blue-50 disabled:opacity-60 font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg whitespace-nowrap"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                <span>{isAr ? 'تأكيد الدخول' : 'Verify & Sign In'}</span>
              </button>
            </form>
          )}

          {/* STEP 1A: UNIFIED SMART PASSWORD LOGIN */}
          {step === 'credentials' && mode === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4 text-xs">
              {/* Optional / Collapsible Workspace Override (Smart Auto-Discovery by default) */}
              <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#0A0E1A]/40 border border-white/10">
                <span className="text-[11px] text-blue-100/80 truncate">
                  {manualWorkspaceMode
                    ? isAr
                      ? `مساحة العمل المحددة: ${wsSlugInput || 'default'}`
                      : `Workspace: ${wsSlugInput || 'default'}`
                    : isAr
                    ? 'اكتشاف الشركة المرتبطة بالحساب تلقائياً'
                    : 'Auto-discover linked company workspace'}
                </span>
                <button
                  type="button"
                  onClick={() => setManualWorkspaceMode((v) => !v)}
                  className="text-[11px] text-blue-300 hover:text-white underline cursor-pointer whitespace-nowrap shrink-0"
                >
                  {manualWorkspaceMode
                    ? isAr
                      ? 'تفعيل الاكتشاف التلقائي'
                      : 'Auto-detect'
                    : isAr
                    ? 'تحديد الشركة يدوياً'
                    : 'Specify Workspace ID'}
                </button>
              </div>

              {manualWorkspaceMode && (
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
                    className="w-full px-4 py-2.5 rounded-xl border border-white/15 bg-[#0A0E1A]/55 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono-num"
                  />
                </div>
              )}

              <div>
                <label className="block text-blue-100/90 mb-1.5 font-medium">
                  {isAr ? 'البريد الإلكتروني أو اسم المستخدم أو رقم الجوال' : 'Email, Username or Phone'}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  autoComplete="username"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="name@company.sa / username / 05xxxxxxxx"
                  className="w-full px-4 py-3 rounded-xl border border-white/15 bg-[#0A0E1A]/55 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono-num"
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label className="block text-blue-100/90 font-medium">
                    {isAr ? 'كلمة المرور' : 'Password'}
                  </label>
                  <button
                    type="button"
                    onClick={() => openRecoveryMode('password_reset')}
                    className="text-[11px] text-blue-300 hover:text-white underline cursor-pointer whitespace-nowrap"
                  >
                    {isAr ? 'نسيت كلمة المرور؟' : 'Forgot Password?'}
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    dir="ltr"
                    autoComplete="current-password"
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
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2 pt-0.5">
                <label className="flex items-center gap-2.5 text-xs text-blue-100/90 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-white/30 bg-[#0A0E1A]/60 accent-blue-500 cursor-pointer"
                  />
                  <span>
                    {isAr
                      ? 'الاحتفاظ بتسجيل الدخول على هذا الجهاز'
                      : 'Keep me signed in on this device'}
                  </span>
                </label>
                <label className="flex items-center gap-2.5 text-xs text-blue-100/80 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberUsername}
                    onChange={(e) => setRememberUsername(e.target.checked)}
                    className="w-4 h-4 rounded border-white/30 bg-[#0A0E1A]/60 accent-blue-500 cursor-pointer"
                  />
                  <span>
                    {isAr
                      ? 'تذكر اسم المستخدم فقط لسهولة الدخول القادم'
                      : 'Remember username/email only (never password)'}
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={busy || !onlineNow}
                className="w-full py-3.5 px-5 rounded-xl bg-white text-[#1E40AF] hover:bg-blue-50 disabled:opacity-60 font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg whitespace-nowrap"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                <span>{isAr ? 'تسجيل الدخول وفتح مساحة العمل' : 'Sign In & Open Workspace'}</span>
                {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </button>

              <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-blue-200/85">
                <button
                  type="button"
                  onClick={() => {
                    setMode('pin');
                    setErrorMsg('');
                  }}
                  className="hover:text-white underline cursor-pointer whitespace-nowrap"
                >
                  {isAr ? 'الدخول السريع برمز PIN' : 'Quick PIN Sign-In'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('provision');
                    setErrorMsg('');
                  }}
                  className="text-emerald-300 hover:text-emerald-200 underline cursor-pointer whitespace-nowrap"
                >
                  {isAr ? 'إنشاء شركة جديدة' : 'Create New Company'}
                </button>
              </div>
            </form>
          )}

          {/* STEP 1B: QUICK PIN LOGIN (PHYSICAL KEYBOARD + TOUCH KEYPAD) */}
          {step === 'credentials' && mode === 'pin' && (
            <form onSubmit={handlePinSubmit} className="space-y-4 text-xs">
              {manualWorkspaceMode && (
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
              )}

              {demoLoginEnabled && loginProfiles.length > 0 ? (
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
                    {isAr ? 'البريد الإلكتروني أو اسم المستخدم أو رقم الجوال' : 'Email, Username or Phone'}
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    required
                    value={pinIdentifier}
                    onChange={(e) => setPinIdentifier(e.target.value)}
                    placeholder="name@company.sa / username / 05xxxxxxxx"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 bg-[#0A0E1A]/55 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono-num"
                  />
                </div>
              )}

              {/* 4-6 digit PIN display slots (supports keyboard or keypad entry) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-center gap-2.5 py-1" dir="ltr">
                  {Array.from({ length: Math.max(4, Math.min(6, Math.max(pin.length, 4))) }).map((_, idx) => {
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
                <p className="text-center text-[11px] text-blue-200/75">
                  {isAr
                    ? 'يدعم 4 إلى 6 أرقام عبر لوحة المفاتيح أو الأزرار أدناه'
                    : 'Supports 4-6 digits via keyboard or keypad'}
                </p>
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

              <label className="flex items-center gap-2.5 text-xs text-blue-100/90 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-white/30 bg-[#0A0E1A]/60 accent-blue-500 cursor-pointer"
                />
                <span>
                  {isAr ? 'الاحتفاظ بتسجيل الدخول على هذا الجهاز' : 'Keep me signed in on this device'}
                </span>
              </label>

              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => openRecoveryMode('pin_reset')}
                  className="text-[11px] text-blue-300 hover:text-white underline cursor-pointer whitespace-nowrap"
                >
                  {isAr ? 'نسيت رمز PIN؟' : 'Forgot PIN?'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('password');
                    setErrorMsg('');
                  }}
                  className="text-[11px] text-blue-200 hover:text-white underline cursor-pointer whitespace-nowrap"
                >
                  {isAr ? 'العودة لتسجيل الدخول بكلمة المرور' : 'Back to Password'}
                </button>
              </div>

              <button
                type="submit"
                disabled={busy || pin.length < 4 || !onlineNow}
                className="w-full py-3.5 px-5 rounded-xl bg-white text-[#1E40AF] hover:bg-blue-50 disabled:opacity-60 font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg whitespace-nowrap"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                <span>{isAr ? 'تأكيد الدخول برمز PIN' : 'Sign In with PIN'}</span>
              </button>
            </form>
          )}

          {/* STEP 1C: PASSWORD & PIN RECOVERY */}
          {step === 'credentials' && mode === 'recovery' && (
            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between gap-3">
                <UnifiedBackButton
                  lang={lang}
                  compact
                  onClick={() => {
                    setErrorMsg('');
                    setMode(recoveryPurpose === 'pin_reset' ? 'pin' : 'password');
                  }}
                />
                <div className="font-bold text-sm text-white">
                  {recoveryPurpose === 'password_reset'
                    ? isAr
                      ? 'استعادة كلمة المرور'
                      : 'Password Recovery'
                    : isAr
                    ? 'إعادة تعيين رمز PIN'
                    : 'PIN Recovery'}
                </div>
              </div>

              {recoveryStep === 'request' ? (
                <form onSubmit={handleRecoveryRequest} className="space-y-3">
                  {manualWorkspaceMode && (
                    <div>
                      <label className="block text-blue-100/90 mb-1.5 font-medium">
                        {isAr ? 'معرّف الشركة (Workspace ID)' : 'Company Workspace ID'}
                      </label>
                      <input
                        type="text"
                        dir="ltr"
                        value={wsSlugInput}
                        onChange={(e) => setWsSlugInput(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 bg-[#0A0E1A]/55 text-white font-mono-num"
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-blue-100/90 mb-1.5 font-medium">
                      {isAr ? 'البريد الإلكتروني أو اسم المستخدم أو الجوال المسجل' : 'Registered Email, Username or Phone'}
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      required
                      value={recoveryIdentifier}
                      onChange={(e) => setRecoveryIdentifier(e.target.value)}
                      placeholder="name@company.sa"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 bg-[#0A0E1A]/55 text-white font-mono-num"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={busy || !onlineNow}
                    className="w-full py-3 px-4 rounded-xl bg-white text-[#1E40AF] hover:bg-blue-50 font-bold text-sm cursor-pointer disabled:opacity-60 whitespace-nowrap"
                  >
                    {busy ? '...' : isAr ? 'إرسال رمز التحقق' : 'Send Verification Code'}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleRecoveryReset} className="space-y-3">
                  {recoveryNotice && (
                    <div className="p-3 rounded-xl bg-blue-500/15 border border-blue-400/30 text-blue-100 leading-relaxed">
                      {recoveryNotice}
                    </div>
                  )}
                  {recoverySimCode && (
                    <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-100 space-y-1">
                      <div className="font-bold">
                        {isAr ? 'معاينة محلية للتحقق (بيئة بدون SMTP مفعّل)' : 'Local Verification Preview'}
                      </div>
                      <div className="font-mono-num text-base font-bold tracking-widest" dir="ltr">
                        {recoverySimCode}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-blue-100/90 mb-1 font-medium">
                      {isAr ? 'رمز التحقق المكون من 6 أرقام' : '6-digit Verification Code'}
                    </label>
                    <input
                      type="text"
                      dir="ltr"
                      required
                      maxLength={6}
                      value={recoveryCode}
                      onChange={(e) => setRecoveryCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 bg-[#0A0E1A]/55 text-white font-mono-num tracking-widest"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-blue-100/90 mb-1 font-medium">
                        {recoveryPurpose === 'password_reset'
                          ? isAr
                            ? 'كلمة المرور الجديدة (8+ أحرف)'
                            : 'New Password (8+ chars)'
                          : isAr
                          ? 'رمز PIN الجديد (4–6 أرقام)'
                          : 'New PIN (4-6 digits)'}
                      </label>
                      <input
                        type="password"
                        dir="ltr"
                        required
                        value={recoveryNewSecret}
                        onChange={(e) => setRecoveryNewSecret(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 bg-[#0A0E1A]/55 text-white font-mono-num"
                      />
                    </div>
                    <div>
                      <label className="block text-blue-100/90 mb-1 font-medium">
                        {isAr ? 'تأكيد القيمة الجديدة' : 'Confirm New Value'}
                      </label>
                      <input
                        type="password"
                        dir="ltr"
                        required
                        value={recoveryConfirmSecret}
                        onChange={(e) => setRecoveryConfirmSecret(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 bg-[#0A0E1A]/55 text-white font-mono-num"
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={busy || !onlineNow}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm cursor-pointer disabled:opacity-60 whitespace-nowrap"
                  >
                    {busy ? '...' : isAr ? 'حفظ وتأكيد الاستعادة' : 'Confirm & Save'}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* STEP 1D: PROVISION NEW COMPANY WORKSPACE */}
          {step === 'credentials' && mode === 'provision' && (
            <form onSubmit={handleProvisionSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-blue-100/90 font-medium">
                      {isAr ? 'معرّف الشركة (تلقائي عند تركه فارغاً)' : 'Workspace Slug (Auto if blank)'}
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
                      onChange={(e) => setNewAdminPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="PIN"
                      className="w-full px-3 py-2.5 rounded-xl border border-white/15 bg-[#0A0E1A]/55 text-white placeholder:text-slate-400 font-mono-num"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={busy || !onlineNow}
                className="w-full py-3.5 px-5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-60 font-bold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg whitespace-nowrap"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
                <span>{isAr ? 'تأسيس مساحة عمل الشركة' : 'Create Company Workspace'}</span>
              </button>
            </form>
          )}

          {/* Subtle Security Footer */}
          <div className="pt-3 border-t border-white/10 text-[11px] text-blue-200/75 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span>{isAr ? 'جلسات معزولة ومشفرة لكل شركة' : 'Company-Isolated Encrypted Sessions'}</span>
            </span>
            <span className="font-mono-num">AqarPlus</span>
          </div>
        </div>

        {/* Optional Dev Demo Quick-Login Accounts Panel (Dev Mode Only) */}
        {showDemoPanel && (
          <div className="lg:col-span-5 rounded-3xl border border-white/15 bg-[#0A0E1A]/65 backdrop-blur-2xl text-white p-6 shadow-2xl flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-blue-500/15 border border-blue-400/30 text-[11px] text-blue-100 space-y-1">
                <div className="font-bold">
                  {isAr ? 'حسابات فريق العمل (وضع التطوير فقط)' : 'Team Accounts (Dev Mode Only)'}
                </div>
                <div className="font-mono-num text-blue-200/90" dir="ltr">
                  Password: Aqar@2026 · PIN: 1234
                </div>
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto pe-1">
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
          </div>
        )}
      </div>
    </div>
  );
}
