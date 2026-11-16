import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { useAqar } from '../context/AqarContext';
import { EmployeeInvitation } from '../types/aqar';

interface PublicInvitationPayload {
  valid: boolean;
  reason?: string;
  expired?: boolean;
  invitation?: EmployeeInvitation;
  company?: {
    id: string;
    nameAr: string;
    nameEn: string;
    logoDataUrl?: string;
  };
  invitee?: {
    nameAr: string;
    nameEn: string;
    email: string;
    phone: string;
    username?: string;
    jobTitle?: string;
    department?: string;
    roleLabelAr: string;
    roleLabelEn: string;
  };
}

interface InviteActivationPageProps {
  token: string;
  workspaceSlug: string;
  onExitToLogin: () => void;
}

export function InviteActivationPage({ token, workspaceSlug, onExitToLogin }: InviteActivationPageProps) {
  const { lang, setLang, setWorkspaceId } = useAqar();
  const isAr = lang === 'ar';

  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<PublicInvitationPayload | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pin, setPin] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [activatedSuccess, setActivatedSuccess] = useState(false);

  useEffect(() => {
    setWorkspaceId(workspaceSlug || 'default');
  }, [workspaceSlug, setWorkspaceId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/public/invitations/${encodeURIComponent(token)}?workspace=${encodeURIComponent(workspaceSlug || 'default')}`,
          {
            headers: {
              'x-workspace-id': workspaceSlug || 'default',
            },
          }
        );
        const data = (await res.json()) as PublicInvitationPayload;
        if (!cancelled) {
          setPayload(data);
        }
      } catch {
        if (!cancelled) {
          setPayload({
            valid: false,
            reason: isAr ? 'تعذر التحقق من رابط الدعوة مع الخادم' : 'Failed to verify invitation link',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, workspaceSlug, isAr]);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verificationCode.trim()) {
      setErrorMsg(isAr ? 'أدخل رمز التحقق المكون من 6 أرقام' : 'Enter 6-digit verification code');
      return;
    }
    if (password.length < 8) {
      setErrorMsg(isAr ? 'كلمة المرور يجب أن لا تقل عن 8 أحرف' : 'Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg(isAr ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }
    if (pin && !/^\d{4,6}$/.test(pin)) {
      setErrorMsg(isAr ? 'رمز PIN الاختياري يجب أن يتكون من 4 إلى 6 أرقام' : 'Optional PIN must be 4-6 digits');
      return;
    }
    if (!acceptedTerms) {
      setErrorMsg(isAr ? 'يجب الموافقة على شروط العمل وسياسة الصلاحيات' : 'Please accept terms & role policy');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    try {
      const res = await fetch(
        `/api/public/invitations/${encodeURIComponent(token)}/accept?workspace=${encodeURIComponent(workspaceSlug || 'default')}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-workspace-id': workspaceSlug || 'default',
          },
          body: JSON.stringify({
            verificationCode: verificationCode.trim(),
            password,
            confirmPassword,
            pin: pin.trim() || undefined,
            acceptedTerms,
            deviceName: typeof navigator !== 'undefined' ? navigator.platform || 'Web Portal' : 'Web Portal',
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data?.error || (isAr ? 'تعذر إتمام تفعيل الحساب' : 'Activation failed'));
      } else {
        setActivatedSuccess(true);
      }
    } catch {
      setErrorMsg(isAr ? 'تعذر الاتصال بالخادم لإتمام التفعيل' : 'Network error during activation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 relative overflow-hidden"
      style={{
        background:
          'radial-gradient(circle at top right, rgba(38, 71, 141, 0.45), transparent 55%), radial-gradient(circle at bottom left, rgba(16, 185, 129, 0.16), transparent 45%), linear-gradient(155deg, #1E40AF 0%, #0F1E4A 42%, #0A0E1A 100%)',
      }}
    >
      <button
        type="button"
        onClick={() => setLang(isAr ? 'en' : 'ar')}
        className="fixed top-4 end-4 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white text-xs font-medium backdrop-blur-md cursor-pointer transition-colors"
      >
        <Globe className="w-3.5 h-3.5" />
        <span className="font-mono-num">{isAr ? 'EN' : 'AR'}</span>
      </button>

      <div className="w-full max-w-2xl rounded-3xl border border-white/15 bg-white/10 backdrop-blur-2xl text-white p-6 sm:p-8 shadow-2xl space-y-6">
        {loading ? (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-300 mx-auto" />
            <div className="text-sm font-medium text-blue-100">
              {isAr ? 'جارٍ التحقق من صلاحية رابط الدعوة...' : 'Verifying invitation link...'}
            </div>
          </div>
        ) : activatedSuccess ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center mx-auto text-emerald-300">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold">
              {isAr ? 'تم تفعيل حسابك بنجاح' : 'Account Activated Successfully'}
            </h1>
            <p className="text-xs sm:text-sm text-blue-100/90 max-w-md mx-auto leading-relaxed">
              {isAr
                ? `تم تفعيل حسابك في ${payload?.company?.nameAr || 'الشركة'} بصلاحيات (${payload?.invitee?.roleLabelAr || ''}). يمكنك الآن تسجيل الدخول باستخدام بريدك أو اسم المستخدم وكلمة المرور التي أعددتها.`
                : 'Your employee account is now active. You can sign in using your email or username and password.'}
            </p>
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={onExitToLogin}
                className="px-6 py-3 rounded-xl bg-white text-[#1E40AF] hover:bg-blue-50 font-bold text-sm inline-flex items-center gap-2 shadow-lg cursor-pointer whitespace-nowrap shrink-0"
              >
                <span>{isAr ? 'الانتقال إلى تسجيل الدخول' : 'Go to Sign In'}</span>
                {isAr ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        ) : !payload?.valid ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-400/40 flex items-center justify-center mx-auto text-red-300">
              <ShieldAlert className="w-9 h-9" />
            </div>
            <h1 className="text-xl font-bold">
              {isAr ? 'تعذر قبول الدعوة' : 'Invitation Unavailable'}
            </h1>
            <p className="text-xs sm:text-sm text-red-100 max-w-md mx-auto leading-relaxed">
              {payload?.reason || (isAr ? 'رابط الدعوة غير صالح أو منتهي الصلاحية' : 'Invalid or expired invite')}
            </p>
            <div className="pt-2 flex justify-center">
              <button
                type="button"
                onClick={onExitToLogin}
                className="px-5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/20 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
              >
                {isAr ? 'العودة إلى صفحة تسجيل الدخول' : 'Back to Sign In'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 pb-4 border-b border-white/15">
              <div className="w-14 h-14 rounded-2xl bg-[#0A0E1A]/60 border border-white/20 flex items-center justify-center overflow-hidden shrink-0">
                {payload.company?.logoDataUrl ? (
                  <img
                    src={payload.company.logoDataUrl}
                    alt={payload.company.nameAr}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Building2 className="w-7 h-7 text-blue-300" />
                )}
              </div>
              <div className="min-w-0">
                <div className="text-xs text-blue-200 font-semibold">
                  {isAr ? payload.company?.nameAr : payload.company?.nameEn} ·{' '}
                  <span className="font-mono-num">{workspaceSlug}</span>
                </div>
                <h1 className="text-xl font-bold mt-0.5">
                  {isAr ? 'قبول دعوة الانضمام وتفعيل الحساب' : 'Accept Team Invitation & Activate Account'}
                </h1>
              </div>
            </div>

            {payload.invitee && (
              <div className="p-4 rounded-2xl bg-[#0A0E1A]/50 border border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-slate-400">{isAr ? 'اسم الموظف' : 'Employee Name'}</div>
                  <div className="font-bold text-white mt-0.5">{payload.invitee.nameAr}</div>
                </div>
                <div>
                  <div className="text-slate-400">{isAr ? 'الدور والمسمى الوظيفي' : 'Role & Job Title'}</div>
                  <div className="font-bold text-emerald-300 mt-0.5">
                    {payload.invitee.roleLabelAr}
                    {payload.invitee.jobTitle ? ` · ${payload.invitee.jobTitle}` : ''}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">{isAr ? 'البريد الإلكتروني' : 'Email'}</div>
                  <div className="font-mono-num text-blue-100 mt-0.5" dir="ltr">
                    {payload.invitee.email}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">{isAr ? 'رقم الجوال' : 'Phone'}</div>
                  <div className="font-mono-num text-blue-100 mt-0.5" dir="ltr">
                    {payload.invitee.phone}
                  </div>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="px-4 py-3 rounded-xl bg-red-500/20 border border-red-400/40 text-red-100 text-xs font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleActivate} className="space-y-4 text-xs">
              <div>
                <label className="block text-blue-100/90 mb-1.5 font-medium">
                  {isAr ? 'رمز التحقق المكون من 6 أرقام (المرفق مع الدعوة)' : '6-Digit Verification Code'}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  required
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="000000"
                  className="w-full px-4 py-3 rounded-xl border border-white/15 bg-[#0A0E1A]/55 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono-num text-base tracking-widest"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-blue-100/90 mb-1.5 font-medium">
                    {isAr ? 'كلمة المرور الشخصية (8 أحرف فأكثر)' : 'New Password (8+ chars)'}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      dir="ltr"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full px-4 py-3 pe-10 rounded-xl border border-white/15 bg-[#0A0E1A]/55 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute top-1/2 -translate-y-1/2 end-3 text-blue-200/75 hover:text-white cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-blue-100/90 mb-1.5 font-medium">
                    {isAr ? 'تأكيد كلمة المرور' : 'Confirm Password'}
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    dir="ltr"
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full px-4 py-3 rounded-xl border border-white/15 bg-[#0A0E1A]/55 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-blue-100/90 mb-1.5 font-medium">
                  {isAr ? 'رمز دخول سريع PIN اختياري (4 إلى 6 أرقام)' : 'Optional Quick PIN (4-6 digits)'}
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-blue-300/70 absolute top-1/2 -translate-y-1/2 start-3.5" />
                  <input
                    type="password"
                    dir="ltr"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full ps-10 pe-4 py-2.5 rounded-xl border border-white/15 bg-[#0A0E1A]/55 text-white placeholder:text-slate-400 font-mono-num"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 w-4 h-4 accent-emerald-500 cursor-pointer shrink-0"
                />
                <span className="text-[11px] text-blue-100 leading-relaxed">
                  {isAr
                    ? 'أقرّ بموافقتي على سياسة أمن المعلومات وصلاحيات الوصول الخاصة بالشركة، وأن استخدامي للحساب يقتصر على المهام المصرح بها لي.'
                    : 'I agree to the company security & role access policy and will use this account only for authorized work.'}
                </span>
              </label>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={onExitToLogin}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium cursor-pointer whitespace-nowrap shrink-0"
                >
                  {isAr ? 'العودة لتسجيل الدخول' : 'Back to Sign In'}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 disabled:opacity-60 font-bold text-sm inline-flex items-center gap-2 shadow-lg cursor-pointer whitespace-nowrap shrink-0"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />}
                  <span>{isAr ? 'تفعيل الحساب والانضمام' : 'Activate & Join Team'}</span>
                </button>
              </div>
            </form>

            <div className="pt-3 border-t border-white/10 flex items-center gap-2 text-[11px] text-blue-200/80">
              <ShieldCheck className="w-4 h-4 text-emerald-300 shrink-0" />
              <span>
                {isAr
                  ? 'هذا الرابط يستخدم لمرة واحدة فقط ومربوط حصرياً بمساحة عمل هذه الشركة.'
                  : 'Single-use cryptographic invitation link bound strictly to this company workspace.'}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
