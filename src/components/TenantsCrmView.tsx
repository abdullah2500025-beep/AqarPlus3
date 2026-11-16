import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  X,
  AlertCircle,
  Sparkles,
  Loader2,
  Camera,
  Upload,
  Wallet,
  Phone,
  Star,
  Archive,
  MessageCircle,
  Users,
  UserPlus,
  Clock,
  FileBarChart2,
  Building2,
  Eye,
  QrCode,
  Send,
} from 'lucide-react';
import { useAqar } from '../context/AqarContext';
import { OcrExtractedData, Tenant, TenantTypeKind } from '../types/aqar';
import { formatDateTime, formatSar } from '../utils/formatters';
import { triggerHaptic } from '../utils/haptics';
import { buildWhatsAppHref } from '../utils/templateEngine';
import { SwipeableRow } from './SwipeableRow';
import { readFileAsDataUrl, runGeminiOcrExtraction } from '../utils/ocrClient';
import { CameraDocumentScannerModal } from './CameraDocumentScannerModal';
import { ProcessedScanResult } from '../utils/documentScanProcessor';
import { TenantDossierModal } from './TenantDossierModal';
import { LeadCenterPanel } from './LeadCenterPanel';

const TODAY_ISO = '2026-11-14';
const CURRENT_MONTH_PREFIX = '2026-11';

type QuickTenantFilter = 'all' | 'active' | 'overdue' | 'expiring' | 'archived';

function getAvatarTone(name: string): string {
  const palette = [
    'from-[#26478D] to-[#1D356B]',
    'from-emerald-600 to-teal-700',
    'from-indigo-600 to-violet-700',
    'from-amber-600 to-orange-700',
    'from-cyan-600 to-blue-700',
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i += 1) sum += name.charCodeAt(i);
  return palette[sum % palette.length];
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso.slice(0, 10)}T00:00:00Z`).getTime();
  const b = new Date(`${toIso.slice(0, 10)}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

export function TenantsCrmView() {
  const { state, currentUser, lang, hasPermission, mutate, pushToast, setActiveNav, tenantsTabHint, setTenantsTabHint } = useAqar();
  const [tab, setTab] = useState<'tenants' | 'leads' | 'reports'>(tenantsTabHint || 'tenants');
  const [leadsViewMode, setLeadsViewMode] = useState<'leads' | 'inbox'>(
    currentUser?.role === 'owner' ? 'inbox' : 'leads'
  );
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [quickFilter, setQuickFilter] = useState<QuickTenantFilter>('all');

  useEffect(() => {
    if (tenantsTabHint) {
      setTab(tenantsTabHint);
    }
  }, [tenantsTabHint]);

  useEffect(() => {
    if (currentUser?.role === 'owner') {
      setLeadsViewMode('inbox');
    }
  }, [currentUser?.role]);
  const [submittingTenant, setSubmittingTenant] = useState(false);
  const [search, setSearch] = useState('');
  const [openTenantId, setOpenTenantId] = useState<string | null>(null);
  const [showAddTenant, setShowAddTenant] = useState(false);
  const [isTenantOcrBusy, setIsTenantOcrBusy] = useState(false);
  const [showTenantCamera, setShowTenantCamera] = useState(false);
  const [scannedTenantDoc, setScannedTenantDoc] = useState<{
    dataUrl: string;
    mimeType: string;
    fileName: string;
    sizeKb: number;
    extracted: OcrExtractedData;
  } | null>(null);

  const [tenantForm, setTenantForm] = useState({
    nameAr: '',
    nameEn: '',
    nationalIdOrIqama: '',
    nationality: 'سعودي',
    tenantType: 'فرد' as TenantTypeKind,
    birthDate: '',
    maritalStatus: 'متزوج' as 'أعزب' | 'متزوج' | 'أرمل',
    familyMembersCount: 1,
    phone: '',
    altPhone: '',
    email: '',
    employer: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    nationalAddress: '',
    classification: 'محتمل' as Tenant['classification'],
    notes: '',
  });

  const duplicateIdWarning = useMemo(() => {
    if (!state || !tenantForm.nationalIdOrIqama.trim()) return null;
    return state.tenants.find(
      (t) => t.nationalIdOrIqama.trim() === tenantForm.nationalIdOrIqama.trim()
    );
  }, [state, tenantForm.nationalIdOrIqama]);

  const enrichedTenants = useMemo(() => {
    if (!state) return [];
    return state.tenants.map((t) => {
      const contracts = state.contracts.filter((c) => c.tenantId === t.id);
      const primaryContract =
        contracts.find((c) => c.lifecycleStatus === 'نشط' || c.lifecycleStatus === 'بانتظار التجديد') ||
        contracts[0];
      const prop = primaryContract ? state.properties.find((p) => p.id === primaryContract.propertyId) : undefined;
      const unit = primaryContract ? state.units.find((u) => u.id === primaryContract.unitId) : undefined;
      const payments = state.payments
        .filter((p) => p.tenantId === t.id && p.status === 'معتمد')
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const lastPayment = payments[0];
      const overdueInst = state.installments.filter(
        (i) => i.tenantId === t.id && (i.status === 'متأخرة' || i.status === 'مدفوعة جزئياً') && i.remainingAmount > 0
      );
      const overdueAmount = overdueInst.reduce((s, i) => s + i.remainingAmount, 0);
      const openBalance = state.installments
        .filter((i) => i.tenantId === t.id && i.status !== 'ملغاة')
        .reduce((s, i) => s + i.remainingAmount, 0);
      const daysLeft = primaryContract ? daysBetween(TODAY_ISO, primaryContract.endDate) : null;
      const isExpiringSoon =
        Boolean(primaryContract) &&
        (primaryContract?.lifecycleStatus === 'نشط' || primaryContract?.lifecycleStatus === 'بانتظار التجديد') &&
        daysLeft !== null &&
        daysLeft >= 0 &&
        daysLeft <= 30;
      const isExpired =
        Boolean(primaryContract) &&
        (primaryContract?.lifecycleStatus === 'منتهي' ||
          primaryContract?.lifecycleStatus === 'منتهٍ بالإخلاء' ||
          (daysLeft !== null && daysLeft < 0));
      const isArchived = Boolean(t.archivedAt) || t.classification === 'سابق';
      const isActive = !isArchived && t.classification === 'نشط';

      return {
        tenant: t,
        primaryContract,
        prop,
        unit,
        lastPayment,
        overdueAmount,
        openBalance,
        isExpiringSoon,
        isExpired,
        isArchived,
        isActive,
        isNewThisMonth: (t.createdAt || '').startsWith(CURRENT_MONTH_PREFIX),
      };
    });
  }, [state]);

  const kpis = useMemo(() => {
    const activeCount = enrichedTenants.filter((e) => e.isActive).length;
    const newThisMonth = enrichedTenants.filter((e) => e.isNewThisMonth).length;
    const overdueCount = enrichedTenants.filter((e) => e.overdueAmount > 0).length;
    const expiringSoonCount = enrichedTenants.filter((e) => e.isExpiringSoon).length;
    return { activeCount, newThisMonth, overdueCount, expiringSoonCount };
  }, [enrichedTenants]);

  const filteredTenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enrichedTenants.filter((row) => {
      if (quickFilter === 'active' && !row.isActive) return false;
      if (quickFilter === 'overdue' && row.overdueAmount <= 0) return false;
      if (quickFilter === 'expiring' && !row.isExpiringSoon && !row.isExpired) return false;
      if (quickFilter === 'archived' && !row.isArchived) return false;

      if (!q) return true;
      return (
        row.tenant.nameAr.toLowerCase().includes(q) ||
        (row.tenant.nameEn || '').toLowerCase().includes(q) ||
        row.tenant.nationalIdOrIqama.toLowerCase().includes(q) ||
        row.tenant.phone.toLowerCase().includes(q) ||
        (row.prop?.nameAr || '').toLowerCase().includes(q) ||
        (row.prop?.nameEn || '').toLowerCase().includes(q) ||
        (row.unit?.unitNumber || '').toLowerCase().includes(q)
      );
    });
  }, [enrichedTenants, quickFilter, search]);

  if (!state) return null;

  const isAr = lang === 'ar';

  const handleProcessTenantIdOcr = async (
    dataUrl: string,
    mimeType: string,
    fileName: string,
    sizeKb: number
  ) => {
    setIsTenantOcrBusy(true);
    try {
      const res = await runGeminiOcrExtraction({
        userId: currentUser?.id || 'usr-gm',
        dataUrl,
        mimeType,
        fileName,
        categoryHint: 'هويات وإقامات',
        autoSync: false,
        applyProperty: false,
        createMissing: false,
      });
      const ext = res.extracted;
      setScannedTenantDoc({ dataUrl, mimeType, fileName, sizeKb, extracted: ext });
      setTenantForm((prev) => ({
        ...prev,
        nameAr: ext.tenantNameAr || prev.nameAr,
        nameEn: ext.tenantNameEn || prev.nameEn,
        nationalIdOrIqama: ext.nationalIdOrIqama || prev.nationalIdOrIqama,
        nationality: ext.nationality || prev.nationality,
        phone: ext.phone || prev.phone,
        email: ext.email || prev.email,
        employer: ext.employer || prev.employer,
        notes:
          prev.notes ||
          [
            ext.docType ? `مستخرج آلياً من ${ext.docType}` : '',
            ext.expiryDate ? `تاريخ الانتهاء: ${ext.expiryDate}` : '',
          ]
            .filter(Boolean)
            .join(' · '),
      }));
      pushToast('success', isAr ? 'تم استخراج بيانات المستأجر من المستند وتعبئة الحقول تلقائياً' : 'Tenant fields auto-filled from OCR');
    } catch (err) {
      pushToast('error', (err as Error).message);
    } finally {
      setIsTenantOcrBusy(false);
    }
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingTenant) return;
    setSubmittingTenant(true);
    triggerHaptic('medium');
    try {
      const res = await mutate<{ tenant?: Tenant }>(
        'POST',
        '/api/tenants',
        {
          ...tenantForm,
          rating: 4,
          behaviorScores: { paymentCommitment: 4, unitCare: 4, cooperation: 4, penaltyTotal: 0 },
          onboardingChecklist: scannedTenantDoc
            ? {
                idVerified: Boolean(tenantForm.nationalIdOrIqama),
                docsArchived: true,
                depositPaid: false,
                contractSigned: scannedTenantDoc.extracted.docType === 'عقد إيجار',
                ejarRegistered: Boolean(scannedTenantDoc.extracted.ejarNumber),
                handoverSigned: false,
              }
            : undefined,
        },
        { offlineDescAr: `تسجيل مستأجر ${tenantForm.nameAr}` }
      );
      if (res) {
        if (scannedTenantDoc && res.tenant) {
          await mutate('POST', '/api/documents', {
            title: [scannedTenantDoc.extracted.docType, res.tenant.nameAr].filter(Boolean).join(' - '),
            category: scannedTenantDoc.extracted.docType === 'عقد إيجار' ? 'عقود إيجار' : 'هويات وإقامات',
            fileName: scannedTenantDoc.fileName,
            fileType: scannedTenantDoc.mimeType.includes('pdf') ? 'PDF' : 'JPG',
            fileSizeKb: scannedTenantDoc.sizeKb,
            relatedType: 'مستأجر',
            relatedId: res.tenant.id,
            expiryDate: scannedTenantDoc.extracted.expiryDate || scannedTenantDoc.extracted.endDate || undefined,
            version: 1,
            dataUrl: scannedTenantDoc.dataUrl,
            ocrStatus: 'تم الاستخراج آلياً',
            ocrRawText: scannedTenantDoc.extracted.rawText,
            ocrExtracted: scannedTenantDoc.extracted,
            accessLog: [],
          });
        }
        triggerHaptic('success');
        pushToast('success', isAr ? 'تم تسجيل ملف المستأجر وأرشفة مستنداته بنجاح' : 'Tenant registered');
        setShowAddTenant(false);
        setScannedTenantDoc(null);
      }
    } finally {
      setSubmittingTenant(false);
    }
  };

  const pendingLeadEscalationsCount = (state.leadEscalations || []).filter(
    (e) => e.status === 'بانتظار الموافقة'
  ).length;

  const chips: { id: QuickTenantFilter; labelAr: string; labelEn: string }[] = [
    { id: 'all', labelAr: 'الكل', labelEn: 'All' },
    { id: 'active', labelAr: 'نشط', labelEn: 'Active' },
    { id: 'overdue', labelAr: 'متأخر', labelEn: 'Overdue' },
    { id: 'expiring', labelAr: 'منتهي / قريب الانتهاء', labelEn: 'Expiring / Ended' },
    { id: 'archived', labelAr: 'مؤرشف', labelEn: 'Archived' },
  ];

  return (
    <div className="space-y-6 rounded-3xl p-4 sm:p-6 bg-gradient-to-br from-[#0A0E1A] via-[#121829] to-[#1A1F2E] text-slate-100 border border-white/10 shadow-xl">
      {/* Header & Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-white/[0.06] border border-white/10">
          <button
            type="button"
            onClick={() => {
              setTab('tenants');
              setTenantsTabHint('tenants');
            }}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              tab === 'tenants' ? 'bg-[#26478D] text-white shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            {isAr ? `ملفات المستأجرين (${state.tenants.length})` : `Tenant Files (${state.tenants.length})`}
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('leads');
              setTenantsTabHint('leads');
            }}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              tab === 'leads' ? 'bg-[#26478D] text-white shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            <span>
              {isAr ? `العملاء المحتملون والموافقات (${state.leads.length})` : `Leads & Approvals (${state.leads.length})`}
            </span>
            {pendingLeadEscalationsCount > 0 && (
              <span className="font-mono-num text-[11px] font-bold text-amber-300">
                · {pendingLeadEscalationsCount} بانتظار القرار
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('reports');
              setTenantsTabHint('reports');
            }}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
              tab === 'reports' ? 'bg-[#26478D] text-white shadow-sm' : 'text-slate-300 hover:text-white'
            }`}
          >
            <FileBarChart2 className="w-3.5 h-3.5" />
            <span>{isAr ? 'تقارير المستأجرين' : 'Tenant Reports'}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasPermission('manage_tenants') && tab === 'tenants' && (
            <button
              type="button"
              onClick={() => setShowAddTenant(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#26478D] text-white hover:bg-[#1e3a75] cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isAr ? 'تسجيل مستأجر جديد' : 'Add Tenant'}</span>
            </button>
          )}
          {tab === 'leads' && (
            <>
              <div className="flex items-center gap-1 p-1 rounded-xl bg-white/[0.06] border border-white/10">
                <button
                  type="button"
                  onClick={() => setLeadsViewMode('leads')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                    leadsViewMode === 'leads' ? 'bg-[#26478D] text-white shadow-sm' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {isAr ? `قائمة المهتمين (${state.leads.length})` : `Leads (${state.leads.length})`}
                </button>
                <button
                  type="button"
                  onClick={() => setLeadsViewMode('inbox')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                    leadsViewMode === 'inbox' ? 'bg-[#26478D] text-white shadow-sm' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isAr ? 'صندوق الموافقات' : 'Approvals Inbox'}</span>
                  {pendingLeadEscalationsCount > 0 && (
                    <span className="font-mono-num text-[11px] font-bold text-amber-300">
                      ({pendingLeadEscalationsCount})
                    </span>
                  )}
                </button>
              </div>
              <button
                type="button"
                onClick={() => setShowQrModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-white/15 bg-white/[0.05] hover:bg-white/10 text-white cursor-pointer whitespace-nowrap shrink-0"
              >
                <QrCode className="w-3.5 h-3.5 text-blue-300" />
                <span>{isAr ? 'رابط التسجيل و QR' : 'Public Link & QR'}</span>
              </button>
              {(hasPermission('manage_contracts') || hasPermission('manage_tenants')) && (
                <button
                  type="button"
                  onClick={() => setShowAddLeadModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#26478D] text-white hover:bg-[#1e3a75] cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isAr ? 'تسجيل مهتم جديد' : 'Register New Lead'}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {tab === 'tenants' && (
        <>
          {/* 4 Live KPI Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md flex items-center justify-between">
              <div>
                <div className="text-[11px] text-slate-400">{isAr ? 'المستأجرون النشطون' : 'Active Tenants'}</div>
                <div className="text-2xl font-bold font-mono-num text-white mt-1">{kpis.activeCount}</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#26478D]/30 text-blue-300 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md flex items-center justify-between">
              <div>
                <div className="text-[11px] text-slate-400">{isAr ? 'الجدد هذا الشهر' : 'New This Month'}</div>
                <div className="text-2xl font-bold font-mono-num text-emerald-400 mt-1">{kpis.newThisMonth}</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <UserPlus className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md flex items-center justify-between">
              <div>
                <div className="text-[11px] text-slate-400">{isAr ? 'متأخرون عن الدفع' : 'Overdue Tenants'}</div>
                <div className="text-2xl font-bold font-mono-num text-red-400 mt-1">{kpis.overdueCount}</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center">
                <AlertCircle className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md flex items-center justify-between">
              <div>
                <div className="text-[11px] text-slate-400">{isAr ? 'عقود تنتهي خلال 30 يوم' : 'Expiring <= 30d'}</div>
                <div className="text-2xl font-bold font-mono-num text-amber-300 mt-1">{kpis.expiringSoonCount}</div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-300 flex items-center justify-center">
                <Clock className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Smart Search Bar + Quick Filter Chips */}
          <div className="flex flex-wrap items-center justify-between gap-3 no-print">
            <div className="relative flex-1 min-w-[260px] max-w-lg">
              <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
              <input
                type="search"
                enterKeyHint="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  isAr
                    ? 'بحث ذكي: الاسم، رقم الهوية، الجوال، اسم العقار، رقم الوحدة...'
                    : 'Smart search: name, ID, phone, property, unit...'
                }
                className="w-full min-h-[44px] ps-9 pe-8 py-2 text-xs rounded-xl border border-white/10 bg-white/[0.05] text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#26478D]"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute top-1/2 -translate-y-1/2 end-2.5 text-slate-400 hover:text-white cursor-pointer"
                  aria-label="Clear"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {chips.map((c) => {
                const active = quickFilter === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setQuickFilter(c.id)}
                    className={`px-3.5 min-h-[38px] rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                      active
                        ? 'bg-[#26478D] text-white border border-blue-400/40'
                        : 'bg-white/[0.05] text-slate-300 border border-white/10 hover:bg-white/[0.1]'
                    }`}
                  >
                    {isAr ? c.labelAr : c.labelEn}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Glass Tenant Cards Grid (Mobile Swipeable + Desktop Grid) */}
          {filteredTenants.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white/[0.03] border border-white/10 text-center text-xs text-slate-400">
              {isAr ? 'لا توجد ملفات مستأجرين مطابقة لمعايير البحث أو الفلتر.' : 'No matching tenant files.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTenants.map(({ tenant: t, primaryContract, prop, unit, lastPayment, overdueAmount, isExpiringSoon }) => {
                const contractStatusLabel = primaryContract?.lifecycleStatus || (t.archivedAt ? 'مؤرشف' : 'بدون عقد');
                const badgeCls =
                  overdueAmount > 0
                    ? 'bg-red-500/20 text-red-300 border-red-400/30'
                    : isExpiringSoon
                    ? 'bg-amber-500/20 text-amber-300 border-amber-400/30'
                    : primaryContract?.lifecycleStatus === 'نشط'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                    : 'bg-white/10 text-slate-300 border-white/15';

                const cardInner = (
                  <div className="p-4 rounded-2xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 backdrop-blur-md transition-all space-y-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${getAvatarTone(
                            t.nameAr
                          )} flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-md`}
                        >
                          {t.nameAr.slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <h3 className="text-sm font-bold text-white truncate">{t.nameAr}</h3>
                            <span className="px-1.5 py-0.5 rounded-md bg-white/10 text-[10px] font-semibold text-blue-200 shrink-0">
                              {t.tenantType || 'فرد'}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono-num truncate">
                            {t.phone} · {t.employer || t.nationality}
                          </div>
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-semibold shrink-0 ${badgeCls}`}>
                        {overdueAmount > 0 ? (isAr ? 'متأخر بالسداد' : 'Overdue') : contractStatusLabel}
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-xs flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-slate-300 min-w-0">
                        <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="truncate">
                          {prop ? `${prop.nameAr} · وحدة ${unit?.unitNumber || '—'}` : isAr ? 'غير مرتبط بوحدة حالية' : 'No unit linked'}
                        </span>
                      </div>
                      {primaryContract && (
                        <span className="font-mono-num text-[11px] text-slate-400 shrink-0">{primaryContract.internalNumber}</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono-num">
                      <span>
                        {isAr ? 'آخر دفعة: ' : 'Last Pay: '}
                        {lastPayment ? (
                          <strong className="text-emerald-400">
                            {formatSar(lastPayment.amount, lang)} ({lastPayment.createdAt.slice(0, 10)})
                          </strong>
                        ) : (
                          '—'
                        )}
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-amber-400 font-bold">
                        <Star className="w-3 h-3 fill-amber-400" />
                        {t.rating}
                      </span>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`tel:${t.phone}`}
                          onClick={(e) => e.stopPropagation()}
                          className="min-h-[36px] px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold inline-flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3 text-blue-300" />
                          <span>{isAr ? 'اتصال' : 'Call'}</span>
                        </a>
                        <a
                          href={buildWhatsAppHref(t.phone, `السلام عليكم ${t.nameAr}`)}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="min-h-[36px] px-2.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white text-[11px] font-semibold inline-flex items-center gap-1"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>{isAr ? 'واتساب' : 'WhatsApp'}</span>
                        </a>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic('light');
                          setOpenTenantId(t.id);
                        }}
                        className="min-h-[36px] px-3 rounded-lg bg-[#26478D] hover:bg-[#1e3a75] text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>{isAr ? 'التفاصيل' : 'Details'}</span>
                      </button>
                    </div>
                  </div>
                );

                return (
                  <div key={t.id} onClick={() => setOpenTenantId(t.id)} className="cursor-pointer">
                    <div className="md:hidden">
                      <SwipeableRow
                        rightSwipeAction={{
                          label: isAr ? 'تحصيل' : 'Collect',
                          icon: <Wallet className="w-4 h-4" />,
                          tone: 'emerald',
                          onTrigger: () => setActiveNav('finance'),
                        }}
                        leftSwipeAction={{
                          label: isAr ? 'الملف' : 'File',
                          icon: <Eye className="w-4 h-4" />,
                          tone: 'blue',
                          onTrigger: () => setOpenTenantId(t.id),
                        }}
                      >
                        {cardInner}
                      </SwipeableRow>
                    </div>
                    <div className="hidden md:block">{cardInner}</div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* LEADS, SMART SUMMARY ESCALATION, APPROVAL INBOX & PUBLIC QR PORTAL */}
      {tab === 'leads' && (
        <LeadCenterPanel
          viewMode={leadsViewMode}
          showAddLeadModal={showAddLeadModal}
          onCloseAddLeadModal={() => setShowAddLeadModal(false)}
          showQrModal={showQrModal}
          onCloseQrModal={() => setShowQrModal(false)}
          onOpenConvertedTenant={(tenantId) => {
            setOpenTenantId(tenantId);
            setTab('tenants');
          }}
        />
      )}

      {/* TENANT GROUP REPORTS TAB */}
      {tab === 'reports' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3">
              <h4 className="font-bold text-sm text-white">{isAr ? 'توزيع المستأجرين حسب النوع' : 'Tenants by Type'}</h4>
              {(['فرد', 'عائلة', 'شركة'] as TenantTypeKind[]).map((kind) => {
                const cnt = state.tenants.filter((t) => (t.tenantType || 'فرد') === kind).length;
                return (
                  <div key={kind} className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03]">
                    <span>{kind}</span>
                    <span className="font-mono-num font-bold text-blue-300">{cnt}</span>
                  </div>
                );
              })}
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3">
              <h4 className="font-bold text-sm text-white">{isAr ? 'مؤشر الالتزام بالسداد والسلوك' : 'Behavioral Distribution'}</h4>
              <div className="flex justify-between p-2.5 rounded-xl bg-emerald-500/10 text-emerald-300">
                <span>🟢 مستأجر مميز (≥ 4.2)</span>
                <span className="font-mono-num font-bold">{state.tenants.filter((t) => t.rating >= 4.2).length}</span>
              </div>
              <div className="flex justify-between p-2.5 rounded-xl bg-amber-500/10 text-amber-300">
                <span>🟡 مستأجر عادي (3.0–4.1)</span>
                <span className="font-mono-num font-bold">
                  {state.tenants.filter((t) => t.rating >= 3 && t.rating < 4.2).length}
                </span>
              </div>
              <div className="flex justify-between p-2.5 rounded-xl bg-red-500/10 text-red-300">
                <span>🔴 يحتاج متابعة (&lt; 3.0)</span>
                <span className="font-mono-num font-bold">{state.tenants.filter((t) => t.rating < 3).length}</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3">
              <h4 className="font-bold text-sm text-white">{isAr ? 'إحصائيات الإشغال والالتزامات' : 'Portfolio Totals'}</h4>
              <div className="flex justify-between p-2.5 rounded-xl bg-white/[0.03]">
                <span>{isAr ? 'إجمالي المتأخرات' : 'Total Overdue'}</span>
                <span className="font-mono-num font-bold text-red-400">
                  {formatSar(enrichedTenants.reduce((s, r) => s + r.overdueAmount, 0), lang)}
                </span>
              </div>
              <div className="flex justify-between p-2.5 rounded-xl bg-white/[0.03]">
                <span>{isAr ? 'إجمالي الأرصدة المفتوحة' : 'Open Receivables'}</span>
                <span className="font-mono-num font-bold text-amber-300">
                  {formatSar(enrichedTenants.reduce((s, r) => s + r.openBalance, 0), lang)}
                </span>
              </div>
            </div>
          </div>

          {/* Overdue Action Table */}
          <div className="rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/10 font-bold text-xs text-white">
              {isAr ? 'تقرير المتأخرين والعقود القريبة من الانتهاء' : 'Overdue & Expiring Contracts Report'}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs">
                <thead className="bg-white/[0.03] text-slate-400 border-b border-white/10">
                  <tr>
                    <th className="py-2.5 px-4 text-start">المستأجر</th>
                    <th className="py-2.5 px-4 text-start">العقار والوحدة</th>
                    <th className="py-2.5 px-4 text-start">نهاية العقد</th>
                    <th className="py-2.5 px-4 text-start">المتأخرات</th>
                    <th className="py-2.5 px-4 text-start">فتح الملف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {enrichedTenants
                    .filter((r) => r.overdueAmount > 0 || r.isExpiringSoon)
                    .map((r) => (
                      <tr key={r.tenant.id} className="hover:bg-white/[0.02]">
                        <td className="py-2.5 px-4 font-semibold text-white">{r.tenant.nameAr}</td>
                        <td className="py-2.5 px-4 text-slate-300">
                          {r.prop?.nameAr || '—'} · {r.unit?.unitNumber || '—'}
                        </td>
                        <td className="py-2.5 px-4 font-mono-num text-amber-300">{r.primaryContract?.endDate || '—'}</td>
                        <td className="py-2.5 px-4 font-mono-num font-bold text-red-400">{formatSar(r.overdueAmount, lang)}</td>
                        <td className="py-2.5 px-4">
                          <button
                            type="button"
                            onClick={() => setOpenTenantId(r.tenant.id)}
                            className="px-3 py-1 rounded-lg bg-[#26478D] text-white text-[11px] font-semibold cursor-pointer"
                          >
                            عرض
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 7-TAB COMPREHENSIVE TENANT FILE MODAL */}
      {openTenantId && (
        <TenantDossierModal
          tenantId={openTenantId}
          onClose={() => setOpenTenantId(null)}
        />
      )}

      {/* Add Tenant Modal with Duplicate ID Detection + Gemini OCR Auto-Fill */}
      {showAddTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 overflow-y-auto">
          <form
            onSubmit={handleCreateTenant}
            className="w-full max-w-xl rounded-2xl border border-white/15 bg-[#13192B] text-white p-6 space-y-4 my-auto"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">{isAr ? 'تسجيل ملف مستأجر جديد' : 'New Tenant Profile'}</h3>
              <button type="button" onClick={() => setShowAddTenant(false)} className="cursor-pointer text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Gemini OCR Auto-Fill Strip */}
            <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-bold text-emerald-300">
                  <Sparkles className="w-4 h-4" />
                  <span>{isAr ? 'تعبئة تلقائية من صورة الهوية / العقد (Gemini OCR)' : 'Auto-Fill from ID / Contract (OCR)'}</span>
                </span>
                {isTenantOcrBusy && <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{isAr ? 'رفع صورة هوية / عقد' : 'Upload ID / Lease'}</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    disabled={isTenantOcrBusy}
                    onChange={async (e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const url = await readFileAsDataUrl(f);
                      await handleProcessTenantIdOcr(
                        url,
                        f.type || 'image/jpeg',
                        f.name,
                        Math.max(1, Math.round(f.size / 1024))
                      );
                    }}
                  />
                </label>
                <button
                  type="button"
                  disabled={isTenantOcrBusy}
                  onClick={() => setShowTenantCamera(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/40 bg-white/10 text-emerald-300 text-[11px] font-semibold cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{isAr ? 'التقاط بالكاميرا' : 'Scan Camera'}</span>
                </button>
                {scannedTenantDoc && (
                  <span className="text-[10px] text-emerald-300 font-medium">
                    ✓ تم استخراج: {scannedTenantDoc.fileName}
                  </span>
                )}
              </div>
            </div>

            {duplicateIdWarning && (() => {
              const isExTenant = duplicateIdWarning.classification === 'سابق' || Boolean(duplicateIdWarning.archivedAt);
              return (
                <div className="p-3 rounded-xl border bg-amber-500/10 border-amber-400/30 text-amber-200 text-xs flex items-center justify-between gap-2">
                  <span>
                    {isExTenant
                      ? `تنبيه: سبق له التأجير (${duplicateIdWarning.nameAr}) — محفوظ بالأرشيف`
                      : `تنبيه تكرار: رقم الهوية مسجل مسبقاً للمستأجر ${duplicateIdWarning.nameAr}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddTenant(false);
                      setOpenTenantId(duplicateIdWarning.id);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#26478D] text-white font-semibold shrink-0 cursor-pointer"
                  >
                    فتح الملف
                  </button>
                </div>
              );
            })()}

            <div className="grid grid-cols-2 gap-3 text-xs">
              <input
                required
                placeholder="الاسم الكامل بالعربية"
                value={tenantForm.nameAr}
                onChange={(e) => setTenantForm({ ...tenantForm, nameAr: e.target.value })}
                className="col-span-2 min-h-[42px] px-3 rounded-xl border border-white/10 bg-[#0A0E1A]"
              />
              <input
                required
                inputMode="numeric"
                placeholder="رقم الهوية الوطنية أو الإقامة"
                value={tenantForm.nationalIdOrIqama}
                onChange={(e) => setTenantForm({ ...tenantForm, nationalIdOrIqama: e.target.value })}
                className="min-h-[42px] px-3 rounded-xl border border-white/10 bg-[#0A0E1A] font-mono-num"
              />
              <select
                value={tenantForm.tenantType}
                onChange={(e) => setTenantForm({ ...tenantForm, tenantType: e.target.value as TenantTypeKind })}
                className="min-h-[42px] px-3 rounded-xl border border-white/10 bg-[#0A0E1A]"
              >
                <option value="فرد">نوع المستأجر: فرد</option>
                <option value="عائلة">نوع المستأجر: عائلة</option>
                <option value="شركة">نوع المستأجر: شركة</option>
              </select>
              {tenantForm.tenantType === 'عائلة' && (
                <input
                  type="number"
                  min={1}
                  placeholder="عدد أفراد الأسرة"
                  value={tenantForm.familyMembersCount}
                  onChange={(e) => setTenantForm({ ...tenantForm, familyMembersCount: Number(e.target.value) })}
                  className="col-span-2 min-h-[42px] px-3 rounded-xl border border-white/10 bg-[#0A0E1A] font-mono-num"
                />
              )}
              <input
                placeholder="الجنسية"
                value={tenantForm.nationality}
                onChange={(e) => setTenantForm({ ...tenantForm, nationality: e.target.value })}
                className="min-h-[42px] px-3 rounded-xl border border-white/10 bg-[#0A0E1A]"
              />
              <input
                required
                type="tel"
                inputMode="tel"
                placeholder="رقم الجوال (05XXXXXXXX)"
                value={tenantForm.phone}
                onChange={(e) => setTenantForm({ ...tenantForm, phone: e.target.value })}
                className="min-h-[42px] px-3 rounded-xl border border-white/10 bg-[#0A0E1A] font-mono-num"
              />
              <input
                type="email"
                placeholder="البريد الإلكتروني"
                value={tenantForm.email}
                onChange={(e) => setTenantForm({ ...tenantForm, email: e.target.value })}
                className="min-h-[42px] px-3 rounded-xl border border-white/10 bg-[#0A0E1A]"
              />
              <input
                placeholder="المهنة / جهة العمل"
                value={tenantForm.employer}
                onChange={(e) => setTenantForm({ ...tenantForm, employer: e.target.value })}
                className="min-h-[42px] px-3 rounded-xl border border-white/10 bg-[#0A0E1A]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddTenant(false)}
                className="min-h-[42px] px-4 text-xs rounded-xl border border-white/15 cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={Boolean(duplicateIdWarning) || submittingTenant}
                className="min-h-[42px] px-5 text-xs font-semibold rounded-xl bg-[#26478D] text-white disabled:opacity-50 cursor-pointer"
              >
                {submittingTenant ? 'جاري الحفظ...' : 'حفظ ملف المستأجر'}
              </button>
            </div>
          </form>
        </div>
      )}

      <CameraDocumentScannerModal
        open={showTenantCamera}
        lang={lang}
        onClose={() => setShowTenantCamera(false)}
        onComplete={async (scan: ProcessedScanResult) => {
          setShowTenantCamera(false);
          await handleProcessTenantIdOcr(scan.dataUrl, scan.mimeType, `tenant-id-${Date.now()}.jpg`, scan.sizeKb);
        }}
      />
    </div>
  );
}
