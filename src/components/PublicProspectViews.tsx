import React, { useEffect, useState } from 'react';
import {
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  Home,
  Loader2,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
  ShieldCheck,
  User,
  Wallet,
  X,
  XCircle,
  ArrowRight,
  AlertTriangle,
  Upload,
  Trash2,
} from 'lucide-react';
import { LeadEscalation, LeadEscalationStatus, TenantTypeKind } from '../types/aqar';
import { buildWhatsAppHref } from '../utils/templateEngine';
import { triggerHaptic } from '../utils/haptics';
import { readFileAsDataUrl } from '../utils/ocrClient';

interface PublicProspectContext {
  companyName: string;
  companyPhone: string;
  properties: {
    id: string;
    nameAr: string;
    city: string;
    district: string;
    units: {
      id: string;
      unitNumber: string;
      unitType: string;
      rooms: number;
      suggestedMonthlyRent: number;
    }[];
  }[];
}

interface PublicDecisionPayload {
  escalation: LeadEscalation;
  expired: boolean;
  propertyName: string;
  unitNumber: string;
  unitType: string;
}

export interface PublicProspectViewsProps {
  mode: 'prospect' | 'decision';
  token?: string;
  propertyId?: string;
  unitId?: string;
  onExitPreview?: () => void;
}

export function formatEscalationSummaryText(esc: LeadEscalation, decisionUrl?: string): string {
  const s = esc.snapshot;
  const lines = [
    '━━━━━━━━━━━━━━━━━━━━━━',
    `🏢 ${s.companyName}`,
    '📋 طلب مراجعة مهتم جديد',
    `🔖 رقم الطلب: ${esc.requestCode}`,
    '━━━━━━━━━━━━━━━━━━━━━━',
    '',
    '🏠 بيانات العقار:',
    `• العمارة: ${s.propertyName}`,
    `• الشقة / الوحدة: ${s.unitNumber}`,
    '',
    '👤 بيانات المهتم:',
    `• الاسم: ${s.leadName}`,
    `• رقم الهوية: ${s.nationalIdOrIqama || 'غير مسجل بعد'}${s.hasIdPhoto ? ' [صورة الهوية مرفقة]' : ''}`,
    `• تاريخ الميلاد: ${s.birthDate || 'غير مسجل'}`,
    `• الجوال: ${s.phone}`,
    '',
    '💰 البيانات المالية والتعاقدية:',
    `• الإيجار: ${Number(s.rentAmount || 0).toLocaleString('en-US')} ريال`,
    `• نوع الدفعة: ${s.paymentFrequency}`,
    `• رسوم المكتب (السعي): ${Number(s.officeFee || 0).toLocaleString('en-US')} ريال`,
    `• رسوم إلغاء العقد قبل انتهاء المدة: ${Number(s.earlyTerminationFee || 0).toLocaleString('en-US')} ريال`,
  ];

  if (s.employeeNotes) {
    lines.push('', '📝 ملاحظات الموظف:', `"${s.employeeNotes}"`);
  }

  lines.push(
    '',
    '━━━━━━━━━━━━━━━━━━━━━━',
    `📅 تاريخ التسجيل: ${s.registrationDate}`,
    `📍 المصدر: ${s.registrationSource}`,
    '━━━━━━━━━━━━━━━━━━━━━━'
  );

  if (decisionUrl) {
    lines.push('', `🔗 للرد الفوري (موافقة / رفض / تعديل):`, decisionUrl);
  }
  return lines.join('\n');
}

export function SmartSummaryCardPreview({
  esc,
  compact = false,
}: {
  esc: LeadEscalation;
  compact?: boolean;
}) {
  const s = esc.snapshot;
  const [showIdPhoto, setShowIdPhoto] = useState(Boolean(s.idImageDataUrl));

  return (
    <div className="rounded-2xl border border-white/15 bg-gradient-to-br from-[#0F172A] via-[#131B2E] to-[#1A2238] text-slate-100 overflow-hidden shadow-lg">
      {/* Header Banner */}
      <div className="px-5 py-4 bg-gradient-to-l from-[#26478D]/85 to-[#16274D] border-b border-white/10 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-xs text-blue-200 font-medium">{s.companyName}</div>
            <h3 className="text-sm sm:text-base font-bold text-white">طلب مراجعة مهتم جديد</h3>
          </div>
        </div>
        <div className="text-end">
          <div className="text-xs font-mono-num font-bold text-blue-200">{esc.requestCode}</div>
          <div className="text-[11px] text-slate-300 mt-0.5">
            {esc.status === 'موافق' && <span className="text-emerald-300 font-bold">✅ موافق</span>}
            {esc.status === 'مرفوض' && <span className="text-red-300 font-bold">❌ مرفوض</span>}
            {esc.status === 'أريد تعديلات' && <span className="text-amber-300 font-bold">🔄 أريد تعديلات</span>}
            {esc.status === 'بانتظار الموافقة' && <span className="text-sky-300 font-semibold">⏳ بانتظار القرار</span>}
          </div>
        </div>
      </div>

      {/* Body Grid */}
      <div className={`p-5 grid grid-cols-1 ${compact ? 'gap-4' : 'md:grid-cols-2 gap-5'} text-xs`}>
        {/* 1. Property & Unit */}
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 space-y-2.5">
          <div className="flex items-center gap-2 font-bold text-blue-300 text-xs">
            <Home className="w-4 h-4" />
            <span>بيانات العقار والوحدة</span>
          </div>
          <div className="space-y-1.5 text-slate-200">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">العمارة / العقار:</span>
              <span className="font-bold text-white">{s.propertyName}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">الشقة / الوحدة:</span>
              <span className="font-bold text-white font-mono-num">{s.unitNumber}</span>
            </div>
          </div>
        </div>

        {/* 2. Personal Info */}
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-emerald-300 text-xs">
              <User className="w-4 h-4" />
              <span>بيانات المهتم الشخصية</span>
            </div>
            {s.hasIdPhoto && (
              <button
                type="button"
                onClick={() => setShowIdPhoto((v) => !v)}
                className="text-[11px] font-semibold text-emerald-300 hover:text-emerald-200 underline cursor-pointer"
              >
                {showIdPhoto ? 'إخفاء صورة الهوية' : 'عرض صورة الهوية المرفقة'}
              </button>
            )}
          </div>
          <div className="space-y-1.5 text-slate-200">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">الاسم الكامل:</span>
              <span className="font-bold text-white">{s.leadName}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">رقم الهوية / الإقامة:</span>
              <span className="font-mono-num font-semibold text-white">
                {s.nationalIdOrIqama || 'غير مسجل'}
                {s.hasIdPhoto ? ' · مرفق صورة' : ''}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">تاريخ الميلاد:</span>
              <span className="font-mono-num text-slate-200">{s.birthDate || 'غير محدد'}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-400">رقم الجوال:</span>
              <a
                href={`tel:${s.phone}`}
                className="font-mono-num font-semibold text-sky-300 hover:underline"
              >
                {s.phone}
              </a>
            </div>
          </div>
          {showIdPhoto && s.idImageDataUrl && (
            <div className="pt-2 border-t border-white/10">
              <img
                src={s.idImageDataUrl}
                alt="صورة هوية المهتم"
                className="max-h-44 rounded-lg border border-white/15 object-contain mx-auto bg-black/30"
              />
            </div>
          )}
        </div>

        {/* 3. Financial & Contractual Terms */}
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 space-y-2.5 md:col-span-2">
          <div className="flex items-center gap-2 font-bold text-amber-300 text-xs">
            <Wallet className="w-4 h-4" />
            <span>البيانات المالية والتعاقدية المقترحة</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
              <div className="text-[11px] text-slate-400">الإيجار المطلوب</div>
              <div className="text-sm font-bold text-emerald-300 font-mono-num mt-0.5">
                {Number(s.rentAmount || 0).toLocaleString('en-US')} ر.س
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
              <div className="text-[11px] text-slate-400">نوع الدفعة</div>
              <div className="text-sm font-bold text-white mt-0.5">{s.paymentFrequency}</div>
            </div>
            <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
              <div className="text-[11px] text-slate-400">رسوم المكتب (السعي)</div>
              <div className="text-sm font-bold text-white font-mono-num mt-0.5">
                {Number(s.officeFee || 0).toLocaleString('en-US')} ر.س
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-white/[0.03] border border-white/5">
              <div className="text-[11px] text-slate-400">رسوم إلغاء العقد</div>
              <div className="text-sm font-bold text-amber-200 font-mono-num mt-0.5">
                {Number(s.earlyTerminationFee || 0).toLocaleString('en-US')} ر.س
              </div>
            </div>
          </div>
        </div>

        {/* 4. Employee Notes & Meta */}
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4 space-y-2 md:col-span-2">
          <div className="flex items-center gap-2 font-bold text-slate-200 text-xs">
            <FileText className="w-4 h-4 text-slate-400" />
            <span>ملاحظات الموظف ومعلومات التسجيل</span>
          </div>
          <p className="text-slate-200 leading-relaxed bg-black/20 rounded-lg p-3 border border-white/5">
            {s.employeeNotes || 'لا توجد ملاحظات إضافية من الموظف'}
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-1">
            <span>
              📅 تاريخ التسجيل: <strong className="font-mono-num text-slate-200">{s.registrationDate}</strong>
            </span>
            <span>
              📍 المصدر: <strong className="text-slate-200">{s.registrationSource}</strong> · بواسطة{' '}
              <strong className="text-slate-200">{esc.createdByName}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Decision Banner if already decided */}
      {esc.status !== 'بانتظار الموافقة' && (
        <div
          className={`px-5 py-3.5 border-t border-white/10 text-xs flex flex-wrap items-center justify-between gap-2 ${
            esc.status === 'موافق'
              ? 'bg-emerald-500/15 text-emerald-200'
              : esc.status === 'مرفوض'
              ? 'bg-red-500/15 text-red-200'
              : 'bg-amber-500/15 text-amber-200'
          }`}
        >
          <div>
            <strong>القرار المسجل: {esc.status}</strong> · بواسطة {esc.decidedBy || esc.recipientName}
            {esc.decisionNotes ? <span className="ms-2">— "{esc.decisionNotes}"</span> : null}
          </div>
          {esc.decidedAt && (
            <span className="font-mono-num text-[11px] opacity-80">{esc.decidedAt.slice(0, 10)}</span>
          )}
        </div>
      )}
    </div>
  );
}

export function PublicProspectViews({
  mode,
  token,
  propertyId,
  unitId,
  onExitPreview,
}: PublicProspectViewsProps) {
  // Decision Mode State
  const [decisionLoading, setDecisionLoading] = useState(mode === 'decision');
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [decisionData, setDecisionData] = useState<PublicDecisionPayload | null>(null);
  const [activeAction, setActiveAction] = useState<Exclude<LeadEscalationStatus, 'بانتظار الموافقة'> | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);
  const [decisionSubmittedSuccess, setDecisionSubmittedSuccess] = useState(false);

  // Public Registration Mode State
  const [ctxLoading, setCtxLoading] = useState(mode === 'prospect');
  const [ctx, setCtx] = useState<PublicProspectContext | null>(null);
  const [ctxError, setCtxError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{
    merged: boolean;
    propertyName: string;
    leadName: string;
    phone: string;
  } | null>(null);
  const [form, setForm] = useState({
    nameAr: '',
    phone: '',
    email: '',
    nationalIdOrIqama: '',
    birthDate: '',
    idImageDataUrl: '',
    tenantType: 'فرد' as TenantTypeKind,
    familyMembersCount: 3,
    companyCrNumber: '',
    propertyId: propertyId || '',
    unitId: unitId || '',
    budgetMonthly: 3500,
    roomsRequired: 3,
    moveInDate: '2026-12-01',
    notes: '',
  });

  useEffect(() => {
    if (mode === 'decision' && token) {
      setDecisionLoading(true);
      setDecisionError(null);
      fetch(`/api/public/lead-decision/${encodeURIComponent(token)}`)
        .then(async (res) => {
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || 'تعذر تحميل طلب المراجعة');
          setDecisionData(json as PublicDecisionPayload);
        })
        .catch((err) => setDecisionError((err as Error).message))
        .finally(() => setDecisionLoading(false));
    }
  }, [mode, token]);

  useEffect(() => {
    if (mode === 'prospect') {
      setCtxLoading(true);
      fetch('/api/public/prospect-context')
        .then(async (res) => {
          const json = (await res.json()) as PublicProspectContext;
          if (!res.ok) throw new Error('تعذر تحميل قائمة الوحدات الشاغرة');
          setCtx(json);
          const defaultProp =
            json.properties.find((p) => p.id === propertyId) || json.properties[0];
          const defaultUnit =
            defaultProp?.units.find((u) => u.id === unitId) || defaultProp?.units[0];
          setForm((prev) => ({
            ...prev,
            propertyId: prev.propertyId || defaultProp?.id || '',
            unitId: prev.unitId || defaultUnit?.id || '',
            budgetMonthly: defaultUnit?.suggestedMonthlyRent || prev.budgetMonthly,
          }));
        })
        .catch((err) => setCtxError((err as Error).message))
        .finally(() => setCtxLoading(false));
    }
  }, [mode, propertyId, unitId]);

  const handleSubmitDecision = async (decision: Exclude<LeadEscalationStatus, 'بانتظار الموافقة'>) => {
    if (!token || !decisionData) return;
    if ((decision === 'مرفوض' || decision === 'أريد تعديلات') && !decisionNote.trim()) {
      setActiveAction(decision);
      return;
    }
    setDecisionSubmitting(true);
    setDecisionError(null);
    triggerHaptic('medium');
    try {
      const res = await fetch(`/api/public/lead-decision/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          decisionNotes: decisionNote.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'تعذر حفظ القرار');
      setDecisionData((prev) => (prev ? { ...prev, escalation: json.escalation } : prev));
      setDecisionSubmittedSuccess(true);
      setActiveAction(null);
      triggerHaptic('success');
    } catch (err) {
      setDecisionError((err as Error).message);
    } finally {
      setDecisionSubmitting(false);
    }
  };

  const handleSubmitProspect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nameAr.trim() || !form.phone.trim()) return;
    setFormSubmitting(true);
    setCtxError(null);
    triggerHaptic('medium');
    try {
      const res = await fetch('/api/public/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          source: propertyId || unitId ? 'رمز QR / رابط وحدة مباشر' : 'رابط التسجيل العام',
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'تعذر إرسال الطلب');
      setSubmitResult({
        merged: Boolean(json.merged),
        propertyName: json.propertyName || 'العقار',
        leadName: form.nameAr,
        phone: form.phone,
      });
      triggerHaptic('success');
    } catch (err) {
      setCtxError((err as Error).message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const selectedProp = ctx?.properties.find((p) => p.id === form.propertyId) || ctx?.properties[0];

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-gradient-to-br from-[#070B14] via-[#0F172A] to-[#1A2136] text-slate-100 p-4 sm:p-6 flex flex-col items-center justify-center"
    >
      <div className="w-full max-w-3xl space-y-5 my-4">
        {/* Top Security / Preview Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-white/[0.04] border border-white/10">
          <div className="flex items-center gap-2.5 text-xs">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold text-white">
              {mode === 'decision'
                ? 'بوابة المالك الآمنة لمراجعة طلب التأجير'
                : 'بوابة التسجيل الذكية للعملاء المهتمين'}
            </span>
            <span className="text-slate-400 hidden sm:inline">· اتصال مشفر دون كشف بيانات العقارات الأخرى</span>
          </div>
          {onExitPreview ? (
            <button
              type="button"
              onClick={onExitPreview}
              className="min-h-[36px] px-3 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold text-white inline-flex items-center gap-1.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>إغلاق المعاينة</span>
            </button>
          ) : (
            <a
              href={window.location.pathname}
              className="text-[11px] text-blue-300 hover:underline inline-flex items-center gap-1"
            >
              <span>الدخول لنظام الإدارة</span>
              <ArrowRight className="w-3 h-3 rotate-180" />
            </a>
          )}
        </div>

        {/* MODE 1: EXTERNAL OWNER DECISION PORTAL */}
        {mode === 'decision' && (
          <div className="space-y-4">
            {decisionLoading && (
              <div className="p-10 rounded-2xl border border-white/10 bg-white/[0.04] flex flex-col items-center gap-3 text-xs text-slate-300">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                <span>جاري التحقق من الرابط الآمن وتحميل بطاقة بيانات المهتم...</span>
              </div>
            )}

            {decisionError && !decisionLoading && (
              <div className="p-6 rounded-2xl border border-red-500/30 bg-red-500/10 text-red-200 text-xs flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 text-red-400" />
                <div>
                  <div className="font-bold text-sm">تعذر فتح طلب المراجعة</div>
                  <div className="mt-1">{decisionError}</div>
                </div>
              </div>
            )}

            {decisionData && !decisionLoading && (
              <>
                <SmartSummaryCardPreview esc={decisionData.escalation} />

                {decisionData.expired && decisionData.escalation.status === 'بانتظار الموافقة' && (
                  <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-xs flex items-center gap-2">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>انتهت صلاحية هذا الرابط المؤقت (72 ساعة). يرجى التواصل مع المكتب العقاري لإرسال رابط محدث.</span>
                  </div>
                )}

                {decisionSubmittedSuccess && (
                  <div className="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/15 text-emerald-100 text-xs space-y-2">
                    <div className="flex items-center gap-2 font-bold text-sm text-emerald-300">
                      <CheckCircle2 className="w-5 h-5" />
                      <span>تم تسجيل قرارك وإبلاغ الموظف المختص فوراً</span>
                    </div>
                    <p>
                      شكراً لك. تم تحديث حالة الطلب <span className="font-mono-num font-bold">{decisionData.escalation.requestCode}</span> إلى{' '}
                      <strong>{decisionData.escalation.status}</strong> في النظام المركزي.
                    </p>
                  </div>
                )}

                {!decisionData.expired && decisionData.escalation.status === 'بانتظار الموافقة' && (
                  <div className="p-5 rounded-2xl border border-white/15 bg-white/[0.04] space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-bold text-white text-sm">اتخاذ القرار بشأن المهتم</span>
                      <span className="text-slate-400 font-mono-num">
                        صلاحية الرابط حتى: {decisionData.escalation.tokenExpiresAt.slice(0, 10)}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <button
                        type="button"
                        disabled={decisionSubmitting}
                        onClick={() => {
                          setActiveAction('موافق');
                          handleSubmitDecision('موافق');
                        }}
                        className="min-h-[48px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>موافق على التأجير</span>
                      </button>

                      <button
                        type="button"
                        disabled={decisionSubmitting}
                        onClick={() => setActiveAction('أريد تعديلات')}
                        className={`min-h-[48px] px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors border ${
                          activeAction === 'أريد تعديلات'
                            ? 'bg-amber-600 text-white border-amber-400'
                            : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 border-amber-400/30'
                        }`}
                      >
                        <RefreshCw className="w-4 h-4" />
                        <span>أريد تعديلات</span>
                      </button>

                      <button
                        type="button"
                        disabled={decisionSubmitting}
                        onClick={() => setActiveAction('مرفوض')}
                        className={`min-h-[48px] px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors border ${
                          activeAction === 'مرفوض'
                            ? 'bg-red-600 text-white border-red-400'
                            : 'bg-red-500/15 hover:bg-red-500/25 text-red-200 border-red-400/30'
                        }`}
                      >
                        <XCircle className="w-4 h-4" />
                        <span>أرفض الطلب</span>
                      </button>
                    </div>

                    {/* Optional note for approve OR mandatory note for reject/modify */}
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      <label className="block text-xs text-slate-300 font-semibold">
                        {activeAction === 'مرفوض'
                          ? 'سبب الرفض (مطلوب):'
                          : activeAction === 'أريد تعديلات'
                          ? 'التعديلات المطلوبة (مطلوب — مثال: رفع الإيجار إلى 1000 ريال أو دفعة ربع سنوية):'
                          : 'ملاحظات أو شروط إضافية اختيارية للموظف (مثال: اشتراط دفع تأمين مسترد):'}
                      </label>
                      <textarea
                        rows={2}
                        value={decisionNote}
                        onChange={(e) => setDecisionNote(e.target.value)}
                        placeholder={
                          activeAction === 'مرفوض'
                            ? 'اكتب سبب رفض الطلب...'
                            : activeAction === 'أريد تعديلات'
                            ? 'حدد التعديل المالي أو التعاقدي المطلوب...'
                            : 'اكتب ملاحظاتك للموظف إن وجدت...'
                        }
                        className="w-full p-3 rounded-xl border border-white/15 bg-[#0A0E1A] text-xs text-white focus:outline-none focus:border-blue-400"
                      />
                      {(activeAction === 'مرفوض' || activeAction === 'أريد تعديلات') && (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setActiveAction(null)}
                            className="min-h-[40px] px-4 rounded-xl border border-white/15 text-xs cursor-pointer"
                          >
                            إلغاء
                          </button>
                          <button
                            type="button"
                            disabled={decisionSubmitting || !decisionNote.trim()}
                            onClick={() => handleSubmitDecision(activeAction)}
                            className={`min-h-[40px] px-5 rounded-xl text-xs font-bold text-white cursor-pointer disabled:opacity-50 ${
                              activeAction === 'مرفوض' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
                            }`}
                          >
                            {decisionSubmitting ? 'جاري الإرسال...' : `تأكيد: ${activeAction}`}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* MODE 2: PUBLIC PROSPECT REGISTRATION PORTAL */}
        {mode === 'prospect' && (
          <div className="rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-md overflow-hidden shadow-2xl">
            <div className="px-6 py-5 bg-gradient-to-l from-[#26478D]/90 to-[#142347] border-b border-white/10 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs text-blue-200">{ctx?.companyName || 'AqarPlus العقارية'}</div>
                <h2 className="text-lg font-bold text-white mt-0.5">نموذج تسجيل طلب استئجار وحدة</h2>
                <p className="text-xs text-blue-100/80 mt-1">
                  سجل بياناتك في ثوانٍ وسيتواصل معك مسؤول التأجير لترتيب المعاينة وتقديم العرض المناسب.
                </p>
              </div>
              <Building2 className="w-9 h-9 text-white/80 shrink-0" />
            </div>

            {ctxLoading && (
              <div className="p-10 flex flex-col items-center gap-3 text-xs text-slate-300">
                <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
                <span>جاري تحميل العقارات والوحدات الشاغرة...</span>
              </div>
            )}

            {ctxError && (
              <div className="m-5 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-xs">
                {ctxError}
              </div>
            )}

            {submitResult ? (
              <div className="p-8 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-white">
                  {submitResult.merged
                    ? `تم تحديث طلبك السابق بنجاح يا ${submitResult.leadName}`
                    : `تم استلام طلبك بنجاح يا ${submitResult.leadName}`}
                </h3>
                <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                  {submitResult.merged
                    ? `تعرّف النظام على رقم جوالك (${submitResult.phone}) وربط اهتمامك الجديد بـ ${submitResult.propertyName} دون تكرار.`
                    : `تم تسجيل طلبك بخصوص ${submitResult.propertyName} وإشعار فريق التأجير فوراً للتواصل معك على ${submitResult.phone}.`}
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                  {ctx?.companyPhone && (
                    <a
                      href={buildWhatsAppHref(
                        ctx.companyPhone,
                        `السلام عليكم، قمت بتسجيل طلب استئجار عبر الرابط العام باسم ${submitResult.leadName} (${submitResult.phone}) بخصوص ${submitResult.propertyName}.`
                      )}
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-[42px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-2"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>مراسلة المكتب عبر واتساب</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setSubmitResult(null)}
                    className="min-h-[42px] px-4 rounded-xl border border-white/15 text-xs font-semibold hover:bg-white/10 cursor-pointer"
                  >
                    تسجيل طلب آخر
                  </button>
                </div>
              </div>
            ) : (
              !ctxLoading && (
                <form onSubmit={handleSubmitProspect} className="p-6 space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-slate-300 font-semibold mb-1.5">العقار المطلوب</label>
                      <select
                        value={form.propertyId}
                        onChange={(e) => {
                          const prop = ctx?.properties.find((p) => p.id === e.target.value);
                          const firstUnit = prop?.units[0];
                          setForm({
                            ...form,
                            propertyId: e.target.value,
                            unitId: firstUnit?.id || '',
                            budgetMonthly: firstUnit?.suggestedMonthlyRent || form.budgetMonthly,
                          });
                        }}
                        className="w-full min-h-[42px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] text-white"
                      >
                        {(ctx?.properties || []).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nameAr} — {p.city} ({p.district})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1.5">الوحدة الشاغرة</label>
                      <select
                        value={form.unitId}
                        onChange={(e) => {
                          const u = selectedProp?.units.find((un) => un.id === e.target.value);
                          setForm({
                            ...form,
                            unitId: e.target.value,
                            budgetMonthly: u?.suggestedMonthlyRent || form.budgetMonthly,
                          });
                        }}
                        className="w-full min-h-[42px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] text-white"
                      >
                        <option value="">اختر وحدة محددة أو استشارة عامة</option>
                        {(selectedProp?.units || []).map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.unitType} {u.unitNumber} · {u.rooms} غرف · {u.suggestedMonthlyRent.toLocaleString('en-US')} ر.س/شهر
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1.5">الاسم الكامل *</label>
                      <input
                        required
                        placeholder="مثال: محمد أحمد العلي"
                        value={form.nameAr}
                        onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                        className="w-full min-h-[42px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1.5">رقم الجوال *</label>
                      <input
                        required
                        type="tel"
                        inputMode="tel"
                        placeholder="05XXXXXXXX"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="w-full min-h-[42px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] text-white font-mono-num"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1.5">صفة المستأجر</label>
                      <select
                        value={form.tenantType}
                        onChange={(e) => setForm({ ...form, tenantType: e.target.value as TenantTypeKind })}
                        className="w-full min-h-[42px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] text-white"
                      >
                        <option value="فرد">فرد</option>
                        <option value="عائلة">عائلة</option>
                        <option value="شركة">شركة / مؤسسة</option>
                      </select>
                    </div>

                    {form.tenantType === 'عائلة' && (
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1.5">عدد أفراد الأسرة</label>
                        <input
                          type="number"
                          min={1}
                          value={form.familyMembersCount}
                          onChange={(e) => setForm({ ...form, familyMembersCount: Number(e.target.value) })}
                          className="w-full min-h-[42px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] text-white font-mono-num"
                        />
                      </div>
                    )}

                    {form.tenantType === 'شركة' && (
                      <div>
                        <label className="block text-slate-300 font-semibold mb-1.5">رقم السجل التجاري</label>
                        <input
                          placeholder="1010XXXXXX"
                          value={form.companyCrNumber}
                          onChange={(e) => setForm({ ...form, companyCrNumber: e.target.value })}
                          className="w-full min-h-[42px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] text-white font-mono-num"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1.5">الميزانية الشهرية (ر.س)</label>
                      <input
                        type="number"
                        min={500}
                        value={form.budgetMonthly}
                        onChange={(e) => setForm({ ...form, budgetMonthly: Number(e.target.value) })}
                        className="w-full min-h-[42px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] text-white font-mono-num"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1.5">عدد الغرف المطلوب</label>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={form.roomsRequired}
                        onChange={(e) => setForm({ ...form, roomsRequired: Number(e.target.value) })}
                        className="w-full min-h-[42px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] text-white font-mono-num"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1.5">تاريخ الانتقال المتوقع</label>
                      <input
                        type="date"
                        value={form.moveInDate}
                        onChange={(e) => setForm({ ...form, moveInDate: e.target.value })}
                        className="w-full min-h-[42px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] text-white font-mono-num"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1.5">رقم الهوية / الإقامة (اختياري)</label>
                      <input
                        placeholder="10XXXXXXXX / 20XXXXXXXX"
                        value={form.nationalIdOrIqama}
                        onChange={(e) => setForm({ ...form, nationalIdOrIqama: e.target.value })}
                        className="w-full min-h-[42px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] text-white font-mono-num"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1.5">تاريخ الميلاد (اختياري)</label>
                      <input
                        type="date"
                        value={form.birthDate}
                        onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                        className="w-full min-h-[42px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] text-white font-mono-num"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-semibold mb-1.5">البريد الإلكتروني (اختياري)</label>
                      <input
                        type="email"
                        placeholder="name@example.com"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="w-full min-h-[42px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] text-white"
                      />
                    </div>
                  </div>

                  {/* Optional ID / Iqama Image Upload */}
                  <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.03] flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-white">صورة الهوية الوطنية أو الإقامة (اختياري)</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {form.idImageDataUrl
                          ? '✓ تم إرفاق صورة الهوية وستصل مع طلبك لمراجعتها بسرعة'
                          : 'إرفاق صورة الهوية يسرّع عملية الموافقة على الطلب'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {form.idImageDataUrl && (
                        <>
                          <img
                            src={form.idImageDataUrl}
                            alt="صورة الهوية"
                            className="h-10 w-16 rounded-lg object-cover border border-white/15"
                          />
                          <button
                            type="button"
                            onClick={() => setForm((prev) => ({ ...prev, idImageDataUrl: '' }))}
                            className="min-h-[36px] px-2.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>إزالة</span>
                          </button>
                        </>
                      )}
                      <label className="min-h-[38px] px-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer">
                        <Upload className="w-3.5 h-3.5" />
                        <span>{form.idImageDataUrl ? 'تغيير الصورة' : 'رفع صورة الهوية / الإقامة'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            const dataUrl = await readFileAsDataUrl(f);
                            setForm((prev) => ({ ...prev, idImageDataUrl: dataUrl }));
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-semibold mb-1.5">ملاحظات إضافية</label>
                    <textarea
                      rows={2}
                      placeholder="اذكر أي متطلبات خاصة أو وقت مناسب للمعاينة..."
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      className="w-full p-3 rounded-xl border border-white/15 bg-[#0A0E1A] text-white"
                    />
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                    <span className="text-[11px] text-slate-400 inline-flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-blue-400" />
                      <span>{selectedProp ? `${selectedProp.city} · ${selectedProp.district}` : ''}</span>
                    </span>
                    <button
                      type="submit"
                      disabled={formSubmitting}
                      className="min-h-[44px] px-6 rounded-xl bg-[#26478D] hover:bg-[#1e3a75] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                    >
                      {formSubmitting ? 'جاري تسجيل الطلب...' : 'إرسال طلب التأجير'}
                    </button>
                  </div>
                </form>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
