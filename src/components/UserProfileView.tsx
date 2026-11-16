import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  KeyRound,
  Laptop,
  Lock,
  LogOut,
  Mail,
  Monitor,
  Phone,
  Shield,
  ShieldCheck,
  Trash2,
  User,
} from 'lucide-react';
import { useAqar } from '../context/AqarContext';
import { TrustedDeviceSummary, UserSessionSummary } from '../types/aqar';
import { getEffectiveModulePermissions, RBAC_ACTIONS, RBAC_MODULES } from '../utils/rbac';
import { formatDisplayDate } from '../utils/formatters';
import { UnifiedBackButton, UnifiedModalCloseButton, useEscapeKey } from './ui/UnifiedComponents';

function readImageAsCompressedDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة الصورة'));
    reader.onload = () => {
      const result = String(reader.result || '');
      const img = new Image();
      img.onload = () => {
        const maxDim = 320;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(result);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => resolve(result);
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}

export function UserProfileView() {
  const {
    state,
    currentUser,
    lang,
    apiFetch,
    pushToast,
    refreshState,
    goBackNav,
    logoutAllDevices,
    appType,
    deviceId,
    desktopProtectedStorage,
  } = useAqar();

  const isAr = lang === 'ar';
  const [nameAr, setNameAr] = useState(currentUser?.nameAr || '');
  const [nameEn, setNameEn] = useState(currentUser?.nameEn || '');
  const [username, setUsername] = useState(currentUser?.username || '');
  const [secondaryPhone, setSecondaryPhone] = useState(currentUser?.secondaryPhone || '');
  const [avatarPreview, setAvatarPreview] = useState(currentUser?.avatarDataUrl || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Contact verification flow
  const [verifyTarget, setVerifyTarget] = useState<'email' | 'phone' | null>(null);
  const [verifyValue, setVerifyValue] = useState('');
  const [verifyStep, setVerifyStep] = useState<'input' | 'confirm'>('input');
  const [verifyCode, setVerifyCode] = useState('');
  const [verifyNotice, setVerifyNotice] = useState('');
  const [verifySimCode, setVerifySimCode] = useState('');
  const [verifyBusy, setVerifyBusy] = useState(false);

  // Credentials update
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [savingCreds, setSavingCreds] = useState(false);

  // PIN toggle & 2FA modals
  const [pinToggleModal, setPinToggleModal] = useState<{ targetEnabled: boolean } | null>(null);
  const [pinTogglePassword, setPinTogglePassword] = useState('');
  const [pinToggleNewPin, setPinToggleNewPin] = useState('');
  const [pinToggleBusy, setPinToggleBusy] = useState(false);

  const [mfaToggleModal, setMfaToggleModal] = useState<{ targetEnabled: boolean } | null>(null);
  const [mfaTogglePassword, setMfaTogglePassword] = useState('');
  const [mfaToggleBusy, setMfaToggleBusy] = useState(false);

  // Active sessions & Trusted devices
  const [sessions, setSessions] = useState<UserSessionSummary[]>([]);
  const [trustedDevices, setTrustedDevices] = useState<TrustedDeviceSummary[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);
  const [revokeSessionId, setRevokeSessionId] = useState<string | null>(null);

  useEscapeKey(Boolean(verifyTarget), () => setVerifyTarget(null));
  useEscapeKey(Boolean(pinToggleModal), () => setPinToggleModal(null));
  useEscapeKey(Boolean(mfaToggleModal), () => setMfaToggleModal(null));
  useEscapeKey(confirmLogoutAll, () => setConfirmLogoutAll(false));
  useEscapeKey(Boolean(revokeSessionId), () => setRevokeSessionId(null));

  useEffect(() => {
    if (!currentUser) return;
    setNameAr(currentUser.nameAr || '');
    setNameEn(currentUser.nameEn || '');
    setUsername(currentUser.username || '');
    setSecondaryPhone(currentUser.secondaryPhone || '');
    setAvatarPreview(currentUser.avatarDataUrl || '');
  }, [currentUser]);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    try {
      const [sesRes, devRes] = await Promise.all([
        apiFetch('/api/profile/sessions'),
        apiFetch('/api/profile/trusted-devices'),
      ]);
      if (sesRes.ok) {
        const data = await sesRes.json();
        setSessions(Array.isArray(data.sessions) ? data.sessions : []);
      }
      if (devRes.ok) {
        const devData = await devRes.json();
        setTrustedDevices(Array.isArray(devData.devices) ? devData.devices : []);
      }
    } catch {
      // ignore offline
    } finally {
      setLoadingSessions(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const effectiveModulePerms = useMemo(() => {
    if (!state || !currentUser) return {};
    return getEffectiveModulePermissions(state, currentUser);
  }, [state, currentUser]);

  if (!state || !currentUser) return null;

  const customRole = currentUser.customRoleId
    ? (state.customRoles || []).find((r) => r.id === currentUser.customRoleId)
    : undefined;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      pushToast('error', isAr ? 'يرجى اختيار ملف صورة صالح' : 'Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      pushToast('error', isAr ? 'الحد الأقصى لحجم الصورة 5 ميجابايت' : 'Max image size 5MB');
      return;
    }
    try {
      const dataUrl = await readImageAsCompressedDataUrl(file);
      setAvatarPreview(dataUrl);
      const res = await apiFetch('/api/profile/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatarDataUrl: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast('error', data?.error || 'تعذر حفظ الصورة');
      } else {
        await refreshState();
        pushToast('success', isAr ? 'تم تحديث الصورة الشخصية' : 'Profile photo updated');
      }
    } catch {
      pushToast('error', isAr ? 'تعذر معالجة الصورة' : 'Image processing failed');
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarPreview('');
    const res = await apiFetch('/api/profile/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ avatarDataUrl: null }),
    });
    if (res.ok) {
      await refreshState();
      pushToast('success', isAr ? 'تمت إزالة الصورة الشخصية' : 'Avatar removed');
    }
  };

  const handleSaveBasicInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim()) {
      pushToast('error', isAr ? 'الاسم الكامل مطلوب' : 'Full name is required');
      return;
    }
    setSavingProfile(true);
    try {
      const res = await apiFetch('/api/profile/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nameAr: nameAr.trim(),
          nameEn: nameEn.trim() || nameAr.trim(),
          username: username.trim(),
          secondaryPhone: secondaryPhone.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast('error', data?.error || 'تعذر حفظ البيانات');
      } else {
        await refreshState();
        pushToast('success', isAr ? 'تم تحديث بيانات الملف الشخصي' : 'Profile updated');
      }
    } finally {
      setSavingProfile(false);
    }
  };

  const openContactVerification = (type: 'email' | 'phone') => {
    setVerifyTarget(type);
    setVerifyStep('input');
    setVerifyValue(type === 'email' ? currentUser.email : currentUser.phone);
    setVerifyCode('');
    setVerifyNotice('');
    setVerifySimCode('');
  };

  const handleRequestVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyTarget) return;
    setVerifyBusy(true);
    try {
      const res = await apiFetch('/api/profile/verify-contact/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: verifyTarget, newValue: verifyValue.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast('error', data?.error || 'تعذر طلب التحقق');
      } else {
        setVerifyNotice(data?.deliveryNotice || '');
        setVerifySimCode(data?.localSimulationCode ? String(data.localSimulationCode) : '');
        setVerifyStep('confirm');
      }
    } finally {
      setVerifyBusy(false);
    }
  };

  const handleConfirmVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyTarget) return;
    setVerifyBusy(true);
    try {
      const res = await apiFetch('/api/profile/verify-contact/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: verifyTarget, code: verifyCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast('error', data?.error || 'رمز التحقق غير صحيح');
      } else {
        await refreshState();
        setVerifyTarget(null);
        pushToast(
          'success',
          verifyTarget === 'email'
            ? isAr
              ? 'تم التحقق وتحديث البريد الإلكتروني'
              : 'Email verified and updated'
            : isAr
            ? 'تم التحقق وتحديث رقم الجوال'
            : 'Phone verified and updated'
        );
      }
    } finally {
      setVerifyBusy(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || newPassword.length < 8) {
      pushToast('error', isAr ? 'أدخل كلمة المرور الحالية وكلمة جديدة من 8 أحرف على الأقل' : 'Current & 8+ char password required');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      pushToast('error', isAr ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
      return;
    }
    setSavingCreds(true);
    try {
      const res = await apiFetch('/api/profile/change-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast('error', data?.error || 'تعذر تحديث كلمة المرور');
      } else {
        setCurrentPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
        await loadSessions();
        pushToast('success', isAr ? 'تم تحديث كلمة المرور وإنهاء الجلسات الأخرى' : 'Password updated');
      }
    } finally {
      setSavingCreds(false);
    }
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(newPin)) {
      pushToast('error', isAr ? 'رمز PIN يجب أن يتكون من 4 إلى 6 أرقام' : 'PIN must be 4-6 digits');
      return;
    }
    setSavingCreds(true);
    try {
      const payload: Record<string, string> = { newPin };
      if (currentUser.security?.hasPin) {
        payload.currentPin = currentPin;
      }
      const res = await apiFetch('/api/profile/change-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast('error', data?.error || 'تعذر تحديث رمز PIN');
      } else {
        setCurrentPin('');
        setNewPin('');
        await refreshState();
        pushToast('success', isAr ? 'تم حفظ رمز PIN الجديد' : 'PIN updated');
      }
    } finally {
      setSavingCreds(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    const res = await apiFetch(`/api/profile/sessions/${encodeURIComponent(sessionId)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    setRevokeSessionId(null);
    if (res.ok) {
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
      pushToast('success', isAr ? 'تم إنهاء الجلسة المحددة' : 'Session revoked');
    } else {
      pushToast('error', data?.error || 'تعذر إنهاء الجلسة');
    }
  };

  const handlePinToggleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinToggleModal) return;
    setPinToggleBusy(true);
    try {
      const res = await apiFetch('/api/profile/pin-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: pinToggleModal.targetEnabled,
          currentPassword: pinTogglePassword,
          newPin: pinToggleModal.targetEnabled && pinToggleNewPin.trim() ? pinToggleNewPin.trim() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast('error', data?.error || 'تعذر تغيير حالة رمز PIN');
      } else {
        setPinToggleModal(null);
        setPinTogglePassword('');
        setPinToggleNewPin('');
        await refreshState();
        pushToast(
          'success',
          pinToggleModal.targetEnabled
            ? isAr
              ? 'تم تفعيل الدخول برمز PIN'
              : 'Quick PIN enabled'
            : isAr
            ? 'تم تعطيل رمز PIN وحذفه بأمان'
            : 'Quick PIN disabled'
        );
      }
    } finally {
      setPinToggleBusy(false);
    }
  };

  const handleMfaToggleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaToggleModal) return;
    setMfaToggleBusy(true);
    try {
      const res = await apiFetch('/api/profile/two-factor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: mfaToggleModal.targetEnabled,
          currentPassword: mfaTogglePassword,
          deviceId,
          deviceName: currentUser.deviceName,
          appType,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        pushToast('error', data?.error || 'تعذر تحديث إعداد التحقق الإضافي');
      } else {
        setMfaToggleModal(null);
        setMfaTogglePassword('');
        await Promise.all([refreshState(), loadSessions()]);
        pushToast(
          'success',
          mfaToggleModal.targetEnabled
            ? isAr
              ? 'تم تفعيل التحقق الإضافي للأجهزة الجديدة'
              : 'Adaptive MFA enabled'
            : isAr
            ? 'تم تعطيل التحقق الإضافي لحسابك'
            : 'Adaptive MFA disabled'
        );
      }
    } finally {
      setMfaToggleBusy(false);
    }
  };

  const handleRevokeTrustedDevice = async (trustedId: string) => {
    const res = await apiFetch(`/api/profile/trusted-devices/${encodeURIComponent(trustedId)}`, {
      method: 'DELETE',
    });
    const data = await res.json();
    if (res.ok) {
      setTrustedDevices(Array.isArray(data.devices) ? data.devices : []);
      pushToast('success', isAr ? 'تمت إزالة الجهاز من الأجهزة الموثوقة' : 'Trusted device removed');
    } else {
      pushToast('error', data?.error || 'تعذر إزالة الجهاز الموثوق');
    }
  };

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header Bar with Back */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <UnifiedBackButton onClick={goBackNav} lang={lang} />
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white truncate">
              {isAr ? 'الملف الشخصي وإعدادات الحساب' : 'Personal Profile & Account'}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isAr
                ? 'إدارة بياناتك الشخصية، التحقق من الجوال والبريد، الأمان، والأجهزة النشطة'
                : 'Manage personal info, verified contact, credentials, and active devices'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setConfirmLogoutAll(true)}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:text-red-300 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>{isAr ? 'تسجيل الخروج من جميع الأجهزة' : 'Sign Out All Devices'}</span>
        </button>
      </div>

      {/* Identity Overview + Basic Info */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Identity Card (Read-only Role & Meta) */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11172A]/85 p-5 space-y-4">
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="relative w-24 h-24 rounded-2xl bg-[#26478D]/15 dark:bg-[#26478D]/30 border border-slate-200 dark:border-white/15 flex items-center justify-center overflow-hidden">
              {avatarPreview ? (
                <img src={avatarPreview} alt={currentUser.nameAr} className="w-full h-full object-cover" />
              ) : (
                <User className="w-10 h-10 text-[#26478D] dark:text-blue-300" />
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#26478D] hover:bg-[#1e3a78] text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0">
                <Camera className="w-3.5 h-3.5" />
                <span>{isAr ? 'تغيير الصورة' : 'Upload Photo'}</span>
                <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              </label>
              {avatarPreview && (
                <button
                  type="button"
                  onClick={() => void handleRemoveAvatar()}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/15 text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isAr ? 'حذف' : 'Remove'}</span>
                </button>
              )}
            </div>
            <div>
              <div className="text-base font-bold text-slate-900 dark:text-white">{currentUser.nameAr}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {customRole ? customRole.nameAr : currentUser.roleLabelAr}
                {currentUser.jobTitle ? ` · ${currentUser.jobTitle}` : ''}
              </div>
              {currentUser.department && (
                <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {isAr ? 'القسم:' : 'Department:'} {currentUser.department}
                </div>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-white/10 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-slate-400">{isAr ? 'حالة الحساب' : 'Account Status'}</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {currentUser.accountStatus || 'نشط'}
              </span>
            </div>
            {currentUser.joinedAt && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">{isAr ? 'تاريخ الانضمام' : 'Joined'}</span>
                <span className="font-mono-num text-slate-800 dark:text-slate-200">
                  {formatDisplayDate(currentUser.joinedAt)}
                </span>
              </div>
            )}
            {currentUser.lastLoginAt && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">{isAr ? 'آخر تسجيل دخول' : 'Last Login'}</span>
                <span className="font-mono-num text-slate-800 dark:text-slate-200">
                  {formatDisplayDate(currentUser.lastLoginAt)}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-slate-400">{isAr ? 'سقف الاعتماد المالي' : 'Approval Limit'}</span>
              <span className="font-mono-num font-bold text-slate-800 dark:text-slate-200">
                {currentUser.approvalLimitSar.toLocaleString()} {isAr ? 'ر.س' : 'SAR'}
              </span>
            </div>
          </div>
        </div>

        {/* Editable Personal Details & Verified Contact */}
        <div className="lg:col-span-8 space-y-5">
          <form
            onSubmit={handleSaveBasicInfo}
            className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11172A]/85 p-5 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <User className="w-4 h-4 text-[#26478D] dark:text-blue-400" />
                <span>{isAr ? 'البيانات الشخصية الأساسية' : 'Basic Personal Information'}</span>
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                  {isAr ? 'الاسم الكامل (عربي)' : 'Full Name (AR)'}
                </label>
                <input
                  type="text"
                  required
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#0A0E1A]/60 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                  {isAr ? 'الاسم بالإنجليزية' : 'Full Name (EN)'}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#0A0E1A]/60 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                  {isAr ? 'اسم المستخدم' : 'Username'}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="username"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#0A0E1A]/60 text-slate-900 dark:text-white font-mono-num"
                />
              </div>
              <div>
                <label className="block text-slate-600 dark:text-slate-300 font-medium mb-1">
                  {isAr ? 'رقم جوال إضافي (اختياري)' : 'Secondary Phone (Optional)'}
                </label>
                <input
                  type="text"
                  dir="ltr"
                  value={secondaryPhone}
                  onChange={(e) => setSecondaryPhone(e.target.value)}
                  placeholder="05xxxxxxxx"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#0A0E1A]/60 text-slate-900 dark:text-white font-mono-num"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="px-5 py-2.5 rounded-xl bg-[#26478D] hover:bg-[#1e3a78] text-white text-xs font-bold cursor-pointer disabled:opacity-60 whitespace-nowrap shrink-0"
              >
                {savingProfile ? '...' : isAr ? 'حفظ البيانات الأساسية' : 'Save Personal Info'}
              </button>
            </div>
          </form>

          {/* Verified Email & Primary Phone */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11172A]/85 p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>{isAr ? 'بيانات التواصل الموثقة (تتطلب رمز تحقق)' : 'Verified Contact Methods'}</span>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Mail className="w-3.5 h-3.5" />
                    <span>{isAr ? 'البريد الإلكتروني' : 'Email Address'}</span>
                  </div>
                  <div className="font-mono-num font-semibold text-slate-900 dark:text-white truncate mt-1" dir="ltr">
                    {currentUser.email}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openContactVerification('email')}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-white/20 hover:bg-slate-200/70 dark:hover:bg-white/10 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                >
                  {isAr ? 'تغيير' : 'Change'}
                </button>
              </div>
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.02] flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{isAr ? 'رقم الجوال الأساسي' : 'Primary Phone'}</span>
                  </div>
                  <div className="font-mono-num font-semibold text-slate-900 dark:text-white truncate mt-1" dir="ltr">
                    {currentUser.phone}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openContactVerification('phone')}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-white/20 hover:bg-slate-200/70 dark:hover:bg-white/10 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                >
                  {isAr ? 'تغيير' : 'Change'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security: Password & PIN */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <form
          onSubmit={handleUpdatePassword}
          className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11172A]/85 p-5 space-y-3 text-xs"
        >
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#26478D] dark:text-blue-400" />
            <span>{isAr ? 'تغيير كلمة المرور' : 'Change Password'}</span>
          </h2>
          <div>
            <label className="block text-slate-600 dark:text-slate-300 mb-1">
              {isAr ? 'كلمة المرور الحالية' : 'Current Password'}
            </label>
            <input
              type="password"
              dir="ltr"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#0A0E1A]/60 text-slate-900 dark:text-white"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-600 dark:text-slate-300 mb-1">
                {isAr ? 'كلمة المرور الجديدة (8+ أحرف)' : 'New Password (8+ chars)'}
              </label>
              <input
                type="password"
                dir="ltr"
                required
                minLength={8}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#0A0E1A]/60 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-slate-600 dark:text-slate-300 mb-1">
                {isAr ? 'تأكيد كلمة المرور' : 'Confirm Password'}
              </label>
              <input
                type="password"
                dir="ltr"
                required
                minLength={8}
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#0A0E1A]/60 text-slate-900 dark:text-white"
              />
            </div>
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={savingCreds}
              className="px-4 py-2 rounded-xl bg-[#26478D] hover:bg-[#1e3a78] text-white font-bold cursor-pointer whitespace-nowrap shrink-0"
            >
              {isAr ? 'تحديث كلمة المرور' : 'Update Password'}
            </button>
          </div>
        </form>

        <form
          onSubmit={handleUpdatePin}
          className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11172A]/85 p-5 space-y-3 text-xs"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-500" />
                <span>{isAr ? 'رمز الدخول السريع (PIN)' : 'Quick PIN Security'}</span>
              </h2>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {currentUser.security?.pinEnabled !== false && currentUser.security?.hasPin
                  ? isAr
                    ? 'الحالة: مفعّل للدخول السريع (4–6 أرقام)'
                    : 'Status: Enabled (4-6 digits)'
                  : isAr
                  ? 'الحالة: معطّل حالياً'
                  : 'Status: Disabled'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setPinTogglePassword('');
                setPinToggleNewPin('');
                setPinToggleModal({
                  targetEnabled: !(currentUser.security?.pinEnabled !== false && currentUser.security?.hasPin),
                });
              }}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-white/20 hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              {currentUser.security?.pinEnabled !== false && currentUser.security?.hasPin
                ? isAr
                  ? 'تعطيل PIN'
                  : 'Disable PIN'
                : isAr
                ? 'تفعيل PIN'
                : 'Enable PIN'}
            </button>
          </div>

          {currentUser.security?.requirePasswordAfterPinLock && (
            <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-700 dark:text-amber-300 text-[11px]">
              {isAr
                ? 'تم تعليق الدخول السريع مؤقتاً بعد 5 محاولات PIN خاطئة — سجّل بكلمة المرور أو فعّل رمزاً جديداً.'
                : 'Quick PIN was locked after 5 failed attempts — sign in with password or set a new PIN.'}
            </div>
          )}

          {currentUser.security?.hasPin && (
            <div>
              <label className="block text-slate-600 dark:text-slate-300 mb-1">
                {isAr ? 'رمز PIN الحالي' : 'Current PIN'}
              </label>
              <input
                type="password"
                dir="ltr"
                maxLength={6}
                required
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#0A0E1A]/60 text-slate-900 dark:text-white font-mono-num"
              />
            </div>
          )}
          <div>
            <label className="block text-slate-600 dark:text-slate-300 mb-1">
              {isAr ? 'رمز PIN الجديد (4–6 أرقام)' : 'New PIN (4-6 digits)'}
            </label>
            <input
              type="password"
              dir="ltr"
              maxLength={6}
              required
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#0A0E1A]/60 text-slate-900 dark:text-white font-mono-num"
            />
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={savingCreds}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer whitespace-nowrap shrink-0"
            >
              {isAr ? 'حفظ رمز PIN' : 'Save Quick PIN'}
            </button>
          </div>
        </form>
      </div>

      {/* Adaptive MFA & Trusted Devices */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11172A]/85 p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#26478D] dark:text-blue-400" />
              <span>{isAr ? 'التحقق الإضافي والأجهزة الموثوقة' : 'Adaptive MFA & Trusted Devices'}</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {currentUser.security?.twoFactorEnabled
                ? isAr
                  ? 'التحقق ثنائي الخطوة مفعّل للأجهزة الجديدة غير الموثوقة.'
                  : 'Step-up verification is active for unrecognized devices.'
                : isAr
                ? 'التحقق ثنائي الخطوة التكيفي يظهر عند الدخول من جهاز جديد إذا تم تفعيله لحسابك.'
                : 'Enable 2FA to verify unrecognized devices via your verified email.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setMfaTogglePassword('');
              setMfaToggleModal({ targetEnabled: !currentUser.security?.twoFactorEnabled });
            }}
            className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-white/20 hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
          >
            {currentUser.security?.twoFactorEnabled
              ? isAr
                ? 'تعطيل التحقق الإضافي'
                : 'Disable 2FA'
              : isAr
              ? 'تفعيل التحقق الإضافي'
              : 'Enable 2FA'}
          </button>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-white/10 text-xs">
          {trustedDevices.length === 0 ? (
            <div className="py-2 text-slate-500 dark:text-slate-400">
              {isAr ? 'لا توجد أجهزة موثوقة محفوظة حالياً.' : 'No trusted devices saved yet.'}
            </div>
          ) : (
            trustedDevices.map((dev) => (
              <div key={dev.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{dev.deviceName}</span>
                    {dev.isCurrent && (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        · {isAr ? 'الجهاز الحالي' : 'This Device'}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-num">
                    {dev.appType === 'desktop' ? (isAr ? 'سطح المكتب' : 'Desktop') : isAr ? 'ويب' : 'Web'} ·{' '}
                    {isAr ? 'وثوق منذ:' : 'Trusted:'} {formatDisplayDate(dev.trustedAt)} ·{' '}
                    {isAr ? 'آخر استخدام:' : 'Last used:'} {formatDisplayDate(dev.lastUsedAt)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleRevokeTrustedDevice(dev.id)}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-white/20 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-300 text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
                >
                  {isAr ? 'إزالة الثقة' : 'Remove Trust'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Active Devices / Sessions */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11172A]/85 p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Laptop className="w-4 h-4 text-[#26478D] dark:text-blue-400" />
              <span>{isAr ? 'الأجهزة والجلسات النشطة' : 'Active Devices & Sessions'}</span>
            </h2>
            {appType === 'desktop' && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {desktopProtectedStorage
                  ? isAr
                    ? 'بيانات الجلسة على سطح المكتب محمية بتشفير نظام التشغيل (OS Keychain).'
                    : 'Desktop session secret is protected with OS keychain encryption.'
                  : isAr
                  ? 'بيئة سطح المكتب النشطة — يتم إدارة الجلسة محلياً.'
                  : 'Desktop runtime session management active.'}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => void loadSessions()}
            className="text-xs text-[#26478D] dark:text-blue-400 hover:underline cursor-pointer whitespace-nowrap shrink-0"
          >
            {loadingSessions ? '...' : isAr ? 'تحديث القائمة' : 'Refresh'}
          </button>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-white/10 text-xs">
          {sessions.length === 0 ? (
            <div className="py-4 text-slate-500 dark:text-slate-400">
              {isAr ? 'لا توجد جلسات مسجلة حالياً.' : 'No active sessions found.'}
            </div>
          ) : (
            sessions.map((ses) => (
              <div key={ses.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0 space-y-0.5">
                  <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                    <span>{ses.deviceName}</span>
                    {ses.isCurrent && (
                      <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                        · {isAr ? 'الجلسة الحالية' : 'Current Session'}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-num">
                    {ses.appType === 'desktop'
                      ? isAr
                        ? 'تطبيق سطح المكتب'
                        : 'Desktop App'
                      : isAr
                      ? 'تطبيق ويب'
                      : 'Web App'}{' '}
                    · {ses.ipAddress || '—'} ·{' '}
                    {ses.rememberMe ? (isAr ? 'جلسة ممتدة' : 'Remembered') : isAr ? 'جلسة مؤقتة' : 'Session Only'} ·{' '}
                    {isAr ? 'تاريخ الدخول:' : 'Login:'} {formatDisplayDate(ses.createdAt)} ·{' '}
                    {isAr ? 'آخر نشاط:' : 'Last seen:'} {formatDisplayDate(ses.lastSeenAt)}
                  </div>
                </div>
                {!ses.isCurrent && (
                  <button
                    type="button"
                    onClick={() => setRevokeSessionId(ses.id)}
                    className="px-3 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-700 dark:text-red-300 font-semibold cursor-pointer whitespace-nowrap shrink-0"
                  >
                    {isAr ? 'إنهاء الجلسة' : 'Revoke'}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Read-Only Role & Permissions Matrix */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#11172A]/85 p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-500" />
            <span>
              {isAr ? 'الدور والصلاحيات الممنوحة (للعرض فقط)' : 'Assigned Role & Permissions (Read-Only)'}
            </span>
          </h2>
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {customRole ? customRole.nameAr : currentUser.roleLabelAr}
          </span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          {isAr
            ? 'لا يمكن تعديل الصلاحيات أو الدور الوظيفي من الملف الشخصي. يتم منح وتعديل الصلاحيات حصرياً عبر إدارة فريق العمل بواسطة مالك الشركة.'
            : 'Role and permissions cannot be self-edited here and are managed strictly by the Company Owner.'}
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start border-collapse">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400">
                <th className="py-2 px-2 text-start font-semibold">{isAr ? 'القسم' : 'Module'}</th>
                {RBAC_ACTIONS.map((act) => (
                  <th key={act.key} className="py-2 px-2 text-center font-semibold">
                    {isAr ? act.labelAr : act.labelEn}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-white/5">
              {RBAC_MODULES.map((mod) => {
                const granted = effectiveModulePerms[mod.key] || [];
                return (
                  <tr key={mod.key}>
                    <td className="py-2 px-2 font-medium text-slate-800 dark:text-slate-200">
                      {isAr ? mod.labelAr : mod.labelEn}
                    </td>
                    {RBAC_ACTIONS.map((act) => {
                      const has = granted.includes(act.key);
                      return (
                        <td key={act.key} className="py-2 px-2 text-center">
                          <span className={has ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-300 dark:text-slate-600'}>
                            {has ? '✓' : '—'}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 2-Step Contact Verification Modal */}
      {verifyTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#12182B] border border-slate-200 dark:border-white/15 p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-white/10">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {verifyTarget === 'email'
                  ? isAr
                    ? 'تحديث البريد الإلكتروني (تحقق ثنائي)'
                    : 'Verify New Email'
                  : isAr
                  ? 'تحديث رقم الجوال الأساسي (تحقق ثنائي)'
                  : 'Verify New Phone'}
              </h3>
              <UnifiedModalCloseButton onClick={() => setVerifyTarget(null)} lang={lang} />
            </div>

            {verifyStep === 'input' ? (
              <form onSubmit={handleRequestVerification} className="space-y-3 text-xs">
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1.5 font-medium">
                    {verifyTarget === 'email'
                      ? isAr
                        ? 'البريد الإلكتروني الجديد'
                        : 'New Email Address'
                      : isAr
                      ? 'رقم الجوال الجديد'
                      : 'New Primary Phone'}
                  </label>
                  <input
                    type={verifyTarget === 'email' ? 'email' : 'text'}
                    dir="ltr"
                    required
                    value={verifyValue}
                    onChange={(e) => setVerifyValue(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#0A0E1A]/60 text-slate-900 dark:text-white font-mono-num"
                  />
                </div>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setVerifyTarget(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold cursor-pointer"
                  >
                    {isAr ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={verifyBusy}
                    className="px-4 py-2 rounded-xl bg-[#26478D] text-white text-xs font-bold cursor-pointer"
                  >
                    {verifyBusy ? '...' : isAr ? 'إرسال رمز التحقق' : 'Send Code'}
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleConfirmVerification} className="space-y-3 text-xs">
                {verifyNotice && (
                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-200">
                    {verifyNotice}
                  </div>
                )}
                {verifySimCode && (
                  <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-800 dark:text-amber-200">
                    <div className="font-bold">{isAr ? 'رمز التحقق المحلي (بيئة التطوير):' : 'Local Verification Code:'}</div>
                    <div className="font-mono-num text-base font-bold tracking-widest mt-1" dir="ltr">
                      {verifySimCode}
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1.5 font-medium">
                    {isAr ? 'أدخل رمز التحقق المكون من 6 أرقام' : 'Enter 6-Digit Verification Code'}
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    required
                    maxLength={6}
                    value={verifyCode}
                    onChange={(e) => setVerifyCode(e.target.value)}
                    placeholder="000000"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#0A0E1A]/60 text-slate-900 dark:text-white font-mono-num tracking-widest"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <UnifiedBackButton onClick={() => setVerifyStep('input')} lang={lang} compact />
                  <button
                    type="submit"
                    disabled={verifyBusy}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
                  >
                    {verifyBusy ? '...' : isAr ? 'تأكيد وحفظ التغيير' : 'Confirm & Update'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Confirm Revoke Single Session Modal */}
      {revokeSessionId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#12182B] border border-slate-200 dark:border-white/15 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isAr ? 'تأكيد إنهاء الجلسة' : 'Confirm Session Revocation'}
              </h3>
              <UnifiedModalCloseButton onClick={() => setRevokeSessionId(null)} lang={lang} />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {isAr
                ? 'سيتم إغلاق هذا الجهاز فوراً ولن يتمكن من متابعة الاستخدام إلا بعد إعادة تسجيل الدخول.'
                : 'This device session will be terminated immediately.'}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRevokeSessionId(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold cursor-pointer"
              >
                {isAr ? 'تراجع' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => void handleRevokeSession(revokeSessionId)}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold cursor-pointer"
              >
                {isAr ? 'إنهاء الجلسة' : 'Revoke Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PIN Enable/Disable Modal */}
      {pinToggleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#12182B] border border-slate-200 dark:border-white/15 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {pinToggleModal.targetEnabled
                  ? isAr
                    ? 'تفعيل الدخول السريع (PIN)'
                    : 'Enable Quick PIN'
                  : isAr
                  ? 'تعطيل الدخول السريع (PIN)'
                  : 'Disable Quick PIN'}
              </h3>
              <UnifiedModalCloseButton onClick={() => setPinToggleModal(null)} lang={lang} />
            </div>
            <form onSubmit={handlePinToggleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-medium">
                  {isAr ? 'أدخل كلمة المرور الحالية للتأكيد' : 'Current Password'}
                </label>
                <input
                  type="password"
                  dir="ltr"
                  required
                  value={pinTogglePassword}
                  onChange={(e) => setPinTogglePassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#0A0E1A]/60 text-slate-900 dark:text-white"
                />
              </div>
              {pinToggleModal.targetEnabled && (
                <div>
                  <label className="block text-slate-600 dark:text-slate-300 mb-1 font-medium">
                    {isAr ? 'رمز PIN الجديد (4–6 أرقام)' : 'New PIN (4-6 digits)'}
                  </label>
                  <input
                    type="password"
                    dir="ltr"
                    required
                    maxLength={6}
                    value={pinToggleNewPin}
                    onChange={(e) => setPinToggleNewPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="••••"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#0A0E1A]/60 text-slate-900 dark:text-white font-mono-num"
                  />
                </div>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setPinToggleModal(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/15 font-semibold cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={pinToggleBusy}
                  className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold cursor-pointer disabled:opacity-60"
                >
                  {pinToggleBusy ? '...' : isAr ? 'تأكيد' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Adaptive 2FA Toggle Modal */}
      {mfaToggleModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#12182B] border border-slate-200 dark:border-white/15 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {mfaToggleModal.targetEnabled
                  ? isAr
                    ? 'تفعيل التحقق الإضافي للأجهزة الجديدة'
                    : 'Enable Adaptive 2FA'
                  : isAr
                  ? 'تعطيل التحقق الإضافي'
                  : 'Disable Adaptive 2FA'}
              </h3>
              <UnifiedModalCloseButton onClick={() => setMfaToggleModal(null)} lang={lang} />
            </div>
            <form onSubmit={handleMfaToggleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-600 dark:text-slate-300 mb-1 font-medium">
                  {isAr ? 'أدخل كلمة المرور الحالية للتأكيد' : 'Current Password'}
                </label>
                <input
                  type="password"
                  dir="ltr"
                  required
                  value={mfaTogglePassword}
                  onChange={(e) => setMfaTogglePassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#0A0E1A]/60 text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMfaToggleModal(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/15 font-semibold cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={mfaToggleBusy}
                  className="px-4 py-2 rounded-xl bg-[#26478D] text-white font-bold cursor-pointer disabled:opacity-60"
                >
                  {mfaToggleBusy ? '...' : isAr ? 'تأكيد' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirm Logout All Devices Modal */}
      {confirmLogoutAll && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#12182B] border border-slate-200 dark:border-white/15 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isAr ? 'تسجيل الخروج من جميع الأجهزة' : 'Sign Out From All Devices'}
              </h3>
              <UnifiedModalCloseButton onClick={() => setConfirmLogoutAll(false)} lang={lang} />
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {isAr
                ? 'سيتم إبطال جميع رموز الجلسات النشطة لحسابك بما فيها هذه الجلسة، وإعادتك لشاشة تسجيل الدخول.'
                : 'All active sessions for your account including this one will be revoked.'}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmLogoutAll(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/15 text-xs font-semibold cursor-pointer"
              >
                {isAr ? 'تراجع' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmLogoutAll(false);
                  void logoutAllDevices();
                }}
                className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold cursor-pointer"
              >
                {isAr ? 'تأكيد الخروج من الجميع' : 'Sign Out Everywhere'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
