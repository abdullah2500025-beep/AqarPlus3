import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  Award,
  Building2,
  CalendarClock,
  CheckCircle2,
  CheckSquare,
  ClipboardCheck,
  Clock,
  Download,
  Edit3,
  Eraser,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileSignature,
  FileText,
  History,
  Key,
  Lock,
  Mail,
  MessageCircle,
  Phone,
  Plus,
  Printer,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  User,
  Wallet,
  Wrench,
  X,
  LogOut,
  ExternalLink,
} from 'lucide-react';
import { useAqar } from '../context/AqarContext';
import {
  CurrencyCode,
  HandoverChecklistItem,
  HandoverInspection,
  LeaseContract,
  Payment,
  PaymentMethod,
  PaymentType,
  TenantBehaviorScores,
  TenantTypeKind,
  TenantViolationNote,
  TicketPriority,
} from '../types/aqar';
import { formatDateTime, formatSar, CURRENCY_META } from '../utils/formatters';
import { triggerHaptic } from '../utils/haptics';
import { buildWhatsAppHref, resolveTemplateText } from '../utils/templateEngine';
import { exportTenantStatementToExcel } from '../utils/excelExport';
import { readFileAsDataUrl, runGeminiOcrExtraction } from '../utils/ocrClient';
import { MoveToArchiveButton } from './MoveToArchiveButton';
import { CreateTaskQuickButton } from './CreateTaskQuickModal';
import { ReceiptModal } from './ReceiptModal';
import { PIN_STORAGE_KEY } from './OnboardingJourney';
import imgApartment from '../assets/images/unit_modern_apartment_1794682469428.jpg';
import imgVilla from '../assets/images/unit_luxury_villa_1794682469756.jpg';
import imgOffice from '../assets/images/unit_commercial_office_1794682470533.jpg';

type DossierTabId =
  | 'personal'
  | 'contract'
  | 'financials'
  | 'maintenance'
  | 'communication'
  | 'handovers'
  | 'history';

const TODAY_ISO = '2026-11-14';

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

function getUnitCoverPhoto(unitType?: string): string {
  if (unitType === 'فيلا') return imgVilla;
  if (unitType === 'مكتب' || unitType === 'معرض تجاري') return imgOffice;
  return imgApartment;
}

function maskNationalId(id: string): string {
  const clean = id.trim();
  if (clean.length <= 4) return '****';
  return `${clean.slice(0, 4)}****${clean.slice(-2)}`;
}

function validateSaudiId(id: string): { valid: boolean; labelAr: string; labelEn: string } {
  const clean = id.trim();
  if (/^1\d{9}$/.test(clean)) return { valid: true, labelAr: 'هوية وطنية صالحة', labelEn: 'Valid National ID' };
  if (/^2\d{9}$/.test(clean)) return { valid: true, labelAr: 'إقامة صالحة', labelEn: 'Valid Iqama' };
  if (/^7\d{9}$/.test(clean)) return { valid: true, labelAr: 'سجل منشأة/رقم موحد', labelEn: 'Valid Corporate ID' };
  return { valid: false, labelAr: 'صيغة غير قياسية (10 أرقام)', labelEn: 'Non-standard format' };
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(`${fromIso.slice(0, 10)}T00:00:00Z`).getTime();
  const b = new Date(`${toIso.slice(0, 10)}T00:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

interface TenantDossierModalProps {
  tenantId: string;
  initialTab?: DossierTabId;
  onClose: () => void;
}

export function TenantDossierModal({ tenantId, initialTab = 'personal', onClose }: TenantDossierModalProps) {
  const {
    state,
    currentUser,
    lang,
    hasPermission,
    mutate,
    pushToast,
    setActiveNav,
    baseCurrency,
    formatInCurrency,
    formatConvertedBase,
  } = useAqar();

  const [tab, setTab] = useState<DossierTabId>(initialTab);
  const [revealId, setRevealId] = useState(false);
  const [showOtherUnitsPopover, setShowOtherUnitsPopover] = useState(false);
  const [selectedContractId, setSelectedContractId] = useState<string>('');
  const [previewReceipt, setPreviewReceipt] = useState<Payment | null>(null);
  const [printContractOpen, setPrintContractOpen] = useState(false);

  // PIN verification modal (for viewing protected ID photo or editing contracts when required)
  const [pinPrompt, setPinPrompt] = useState<{
    open: boolean;
    title: string;
    onVerified: () => void;
  }>({ open: false, title: '', onVerified: () => {} });
  const [pinInput, setPinInput] = useState('');
  const [unlockedDocIds, setUnlockedDocIds] = useState<Record<string, boolean>>({});
  const [previewDocDataUrl, setPreviewDocDataUrl] = useState<{ title: string; dataUrl?: string } | null>(null);

  // Sub-modals
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showEditContract, setShowEditContract] = useState(false);
  const [showRenewContract, setShowRenewContract] = useState(false);
  const [showQuickPay, setShowQuickPay] = useState(false);
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showNewHandover, setShowNewHandover] = useState(false);
  const [showAddViolation, setShowAddViolation] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);

  const isAr = lang === 'ar';

  const tenant = useMemo(
    () => state?.tenants.find((t) => t.id === tenantId) || null,
    [state?.tenants, tenantId]
  );

  const tenantContracts = useMemo(
    () => (state?.contracts || []).filter((c) => c.tenantId === tenantId),
    [state?.contracts, tenantId]
  );

  const activeContract = useMemo(() => {
    if (selectedContractId) {
      const picked = tenantContracts.find((c) => c.id === selectedContractId);
      if (picked) return picked;
    }
    return (
      tenantContracts.find((c) => c.lifecycleStatus === 'نشط' || c.lifecycleStatus === 'بانتظار التجديد') ||
      tenantContracts[0] ||
      null
    );
  }, [tenantContracts, selectedContractId]);

  const currentProperty = useMemo(
    () => (activeContract ? state?.properties.find((p) => p.id === activeContract.propertyId) || null : null),
    [state?.properties, activeContract]
  );

  const currentUnit = useMemo(
    () => (activeContract ? state?.units.find((u) => u.id === activeContract.unitId) || null : null),
    [state?.units, activeContract]
  );

  const propertyUnits = useMemo(
    () => (currentProperty ? (state?.units || []).filter((u) => u.propertyId === currentProperty.id) : []),
    [state?.units, currentProperty]
  );

  const tenantInstallments = useMemo(
    () => (state?.installments || []).filter((i) => i.tenantId === tenantId),
    [state?.installments, tenantId]
  );

  const tenantPayments = useMemo(
    () => (state?.payments || []).filter((p) => p.tenantId === tenantId),
    [state?.payments, tenantId]
  );

  const tenantTickets = useMemo(
    () =>
      (state?.tickets || []).filter(
        (t) => t.tenantId === tenantId || tenantContracts.some((c) => c.unitId === t.unitId)
      ),
    [state?.tickets, tenantId, tenantContracts]
  );

  const tenantHandovers = useMemo(
    () =>
      (state?.handovers || []).filter((h) =>
        tenantContracts.some((c) => c.id === h.contractId)
      ),
    [state?.handovers, tenantContracts]
  );

  const tenantDocs = useMemo(
    () =>
      (state?.documents || []).filter(
        (d) =>
          d.relatedId === tenantId ||
          (tenant && d.ocrExtracted?.nationalIdOrIqama === tenant.nationalIdOrIqama)
      ),
    [state?.documents, tenantId, tenant]
  );

  const tenantComms = useMemo(
    () => (state?.communications || []).filter((c) => c.targetId === tenantId),
    [state?.communications, tenantId]
  );

  // Forms state
  const [profileForm, setProfileForm] = useState({
    nameAr: '',
    nameEn: '',
    nationalIdOrIqama: '',
    birthDate: '',
    nationality: 'سعودي',
    employer: '',
    maritalStatus: 'متزوج' as 'أعزب' | 'متزوج' | 'أرمل',
    tenantType: 'فرد' as TenantTypeKind,
    familyMembersCount: 1,
    phone: '',
    altPhone: '',
    email: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    nationalAddress: '',
    notes: '',
  });

  const [contractEditForm, setContractEditForm] = useState({
    ejarNumber: '',
    ejarStatus: 'موثق في إيجار' as LeaseContract['ejarStatus'],
    ejarPortalUrl: '',
    handoverDate: '',
    occupancyStartDate: '',
    occupancyStatus: 'نشط' as 'نشط' | 'قيد الإخلاء' | 'مُخلى',
    keysDeliveredCount: 2,
    remotesDeliveredCount: 2,
    earlyTerminationFee: 0,
    securityDeposit: 0,
    officeFee: 0,
    includedServices: '',
    notes: '',
  });

  const [renewForm, setRenewForm] = useState({
    newStartDate: '2026-12-01',
    newEndDate: '2027-11-30',
    annualRent: 45000,
    ejarNumber: '',
  });

  const [payForm, setPayForm] = useState({
    amount: 0,
    paymentMethod: 'تحويل بنكي' as PaymentMethod,
    paymentType: 'إيجار' as PaymentType,
    referenceNumber: '',
    notes: '',
  });

  const [ticketForm, setTicketForm] = useState({
    category: 'سباكة',
    priority: 'متوسط' as TicketPriority,
    title: '',
    description: '',
    estimatedCost: 250,
  });

  const [commForm, setCommForm] = useState({
    channel: 'رسالة نصية / واتساب' as 'اتصال هاتفي' | 'رسالة نصية / واتساب' | 'بريد إلكتروني' | 'زيارة ميدانية' | 'ملاحظة داخلية',
    direction: 'صادر' as 'صادر' | 'وارد',
    templateUsed: '',
    language: 'ar' as 'ar' | 'en' | 'bn',
    summary: '',
  });

  const [apptForm, setApptForm] = useState({
    title: 'معاينة / تسليم مفاتيح',
    scheduledAt: '2026-11-18T11:00',
    notes: '',
    createTask: true,
  });

  const [violationForm, setViolationForm] = useState({
    title: '',
    category: 'ملاحظة' as TenantViolationNote['category'],
    details: '',
  });

  const [handoverForm, setHandoverForm] = useState({
    type: 'إخلاء واستلام' as HandoverInspection['type'],
    date: TODAY_ISO,
    keysReturned: 2,
    acRemotesReturned: 2,
    electricityReading: '',
    waterReading: '',
    damageCost: 0,
    notes: '',
    photosDataUrls: [] as string[],
    checklist: [
      { item: 'طلاء الجدران والأسقف', status: 'سليم' },
      { item: 'أجهزة التكييف والريموتات', status: 'سليم' },
      { item: 'السباكة والمطابخ والأبواب', status: 'سليم' },
      { item: 'عدادات الكهرباء والمياه', status: 'سليم' },
    ] as HandoverChecklistItem[],
  });

  // Canvas signature ref for handover
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    if (!tenant) return;
    setProfileForm({
      nameAr: tenant.nameAr || '',
      nameEn: tenant.nameEn || '',
      nationalIdOrIqama: tenant.nationalIdOrIqama || '',
      birthDate: tenant.birthDate || '',
      nationality: tenant.nationality || 'سعودي',
      employer: tenant.employer || '',
      maritalStatus: tenant.maritalStatus || 'متزوج',
      tenantType: tenant.tenantType || 'فرد',
      familyMembersCount: tenant.familyMembersCount || 1,
      phone: tenant.phone || '',
      altPhone: tenant.altPhone || '',
      email: tenant.email || '',
      emergencyContactName: tenant.emergencyContactName || '',
      emergencyContactPhone: tenant.emergencyContactPhone || '',
      nationalAddress: tenant.nationalAddress || '',
      notes: tenant.notes || '',
    });
  }, [tenant]);

  useEffect(() => {
    if (!activeContract) return;
    setContractEditForm({
      ejarNumber: activeContract.ejarNumber || '',
      ejarStatus: activeContract.ejarStatus,
      ejarPortalUrl: activeContract.ejarPortalUrl || '',
      handoverDate: activeContract.handoverDate || activeContract.startDate,
      occupancyStartDate: activeContract.occupancyStartDate || activeContract.startDate,
      occupancyStatus: activeContract.occupancyStatus || 'نشط',
      keysDeliveredCount: activeContract.keysDeliveredCount ?? 2,
      remotesDeliveredCount: activeContract.remotesDeliveredCount ?? 2,
      earlyTerminationFee: activeContract.earlyTerminationFee ?? 0,
      securityDeposit: activeContract.securityDeposit ?? 0,
      officeFee: activeContract.officeFee ?? 0,
      includedServices: activeContract.includedServices || '',
      notes: activeContract.notes || '',
    });
    setRenewForm({
      newStartDate: activeContract.endDate || '2026-12-01',
      newEndDate: `${Number((activeContract.endDate || '2026-12-01').slice(0, 4)) + 1}${(activeContract.endDate || '2026-12-01').slice(4)}`,
      annualRent: activeContract.annualRent,
      ejarNumber: '',
    });
  }, [activeContract]);

  if (!state || !currentUser || !tenant) return null;

  // Behavioral Badge Calculation
  const scores: TenantBehaviorScores = tenant.behaviorScores || {
    paymentCommitment: Math.min(5, Math.max(1, Math.round(tenant.rating || 4))),
    unitCare: 4,
    cooperation: 4,
    penaltyTotal: 0,
  };
  const avgBehavior = (scores.paymentCommitment + scores.unitCare + scores.cooperation) / 3;
  const behaviorBadge =
    avgBehavior >= 4.2
      ? { dot: '🟢', labelAr: 'مستأجر مميز', labelEn: 'VIP Tenant', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' }
      : avgBehavior >= 3.0
      ? { dot: '🟡', labelAr: 'مستأجر عادي', labelEn: 'Regular Tenant', cls: 'bg-amber-500/20 text-amber-300 border-amber-400/30' }
      : { dot: '🔴', labelAr: 'يحتاج متابعة', labelEn: 'Needs Follow-up', cls: 'bg-red-500/20 text-red-300 border-red-400/30' };

  // Role-based financial visibility: maintenance technician & maint_manager without accounting/collection permissions
  const canViewFullFinancials =
    hasPermission('view_all') ||
    hasPermission('collect_payments') ||
    hasPermission('manage_accounting') ||
    currentUser.role === 'leasing' ||
    currentUser.role === 'receptionist' ||
    currentUser.role === 'auditor';

  const tenantPaidTotal = tenantPayments
    .filter((p) => p.status === 'معتمد')
    .reduce((s, p) => s + p.amount, 0);
  const tenantOpenBalance = tenantInstallments
    .filter((i) => i.status !== 'ملغاة')
    .reduce((s, i) => s + i.remainingAmount, 0);
  const tenantOverdueTotal = tenantInstallments
    .filter((i) => i.status === 'متأخرة' || i.status === 'مدفوعة جزئياً')
    .reduce((s, i) => s + i.remainingAmount, 0);
  const totalContractValue = tenantContracts
    .filter((c) => c.lifecycleStatus !== 'ملغي')
    .reduce((s, c) => s + c.annualRent, 0);

  // Tenant-borne maintenance charges (visible even to maintenance roles)
  const tenantBorneMaintenanceExpenses = state.expenses.filter(
    (e) =>
      e.bearer === 'المستأجر' &&
      (e.tenantId === tenant.id || tenantContracts.some((c) => c.unitId === e.unitId))
  );

  // Eviction Risk & Loyalty AI/Rule Assessment
  const overdueCount = tenantInstallments.filter((i) => i.status === 'متأخرة').length;
  const violationCount = (tenant.violationNotes || []).filter((v) => v.category === 'مخالفة' || v.category === 'تأخر سداد').length;
  const riskScore = Math.min(95, Math.max(5, overdueCount * 22 + violationCount * 15 + (5 - avgBehavior) * 14));
  const riskLevel =
    riskScore >= 55
      ? { labelAr: 'خطر تعثر/إخلاء مرتفع', tone: 'text-red-400 bg-red-500/10 border-red-500/30', adviceAr: 'يُنصح بتفعيل جدولة السداد التحفيزية والمتابعة الأسبوعية وعدم التجديد التلقائي إلا بعد تصفية المتأخرات.' }
      : riskScore >= 30
      ? { labelAr: 'خطر متوسط (يتطلب تذكيراً دورياً)', tone: 'text-amber-300 bg-amber-500/10 border-amber-500/30', adviceAr: 'إرسال تذكيرات واتساب آلية قبل 5 أيام من استحقاق كل قسط للحفاظ على انتظام التحصيل.' }
      : { labelAr: 'مستأجر موثوق ومنخفض المخاطر', tone: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30', adviceAr: 'مؤهل لمزايا الولاء (خصم 3%-5% عند التجديد المبكر أو أولوية الترقية لوحدات أكبر).' };

  const idValidation = validateSaudiId(tenant.nationalIdOrIqama);

  // PIN gate helper
  const requestPinGate = (title: string, onVerified: () => void) => {
    setPinInput('');
    setPinPrompt({ open: true, title, onVerified });
  };

  const handleConfirmPin = (e: React.FormEvent) => {
    e.preventDefault();
    const expected = localStorage.getItem(PIN_STORAGE_KEY) || '1234';
    if (pinInput.trim() !== expected) {
      triggerHaptic('error');
      pushToast('error', isAr ? 'رمز الأمان PIN غير صحيح' : 'Invalid PIN code');
      return;
    }
    triggerHaptic('success');
    const cb = pinPrompt.onVerified;
    setPinPrompt({ open: false, title: '', onVerified: () => {} });
    cb();
  };

  // Handlers
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await mutate('PATCH', `/api/tenants/${tenant.id}`, profileForm, {
      offlineDescAr: `تحديث ملف ${profileForm.nameAr}`,
    });
    if (res) {
      triggerHaptic('success');
      pushToast('success', isAr ? 'تم تحديث البيانات الشخصية للمستأجر بنجاح' : 'Tenant profile updated');
      setShowEditProfile(false);
    }
  };

  const handleSaveContractEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeContract) return;
    const res = await mutate('PATCH', `/api/contracts/${activeContract.id}`, contractEditForm, {
      offlineDescAr: `تعديل عقد ${activeContract.internalNumber}`,
    });
    if (res) {
      triggerHaptic('success');
      pushToast('success', isAr ? 'تم تحديث بيانات العقد والإشغال' : 'Contract updated');
      setShowEditContract(false);
    }
  };

  const handleRenewContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeContract) return;
    const res = await mutate('POST', `/api/contracts/${activeContract.id}/renew`, renewForm, {
      offlineDescAr: `تجديد العقد ${activeContract.internalNumber}`,
    });
    if (res) {
      triggerHaptic('success');
      pushToast('success', isAr ? 'تم تجديد العقد وتوليد جدول الأقساط الجديد' : 'Contract renewed');
      setShowRenewContract(false);
    }
  };

  const handleQuickPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeContract || payForm.amount <= 0) return;
    const res = await mutate<{ payment?: Payment }>(
      'POST',
      '/api/payments',
      {
        contractId: activeContract.id,
        unitId: activeContract.unitId,
        propertyId: activeContract.propertyId,
        tenantId: tenant.id,
        amount: payForm.amount,
        currency: activeContract.currency || 'SAR',
        paymentMethod: payForm.paymentMethod,
        paymentType: payForm.paymentType,
        referenceNumber: payForm.referenceNumber || `REF-${Math.floor(10000 + Math.random() * 89999)}`,
        notes: payForm.notes || `دفعة من ملف المستأجر ${tenant.nameAr}`,
      },
      { offlineDescAr: `تحصيل ${payForm.amount} للمستأجر ${tenant.nameAr}` }
    );
    if (res) {
      triggerHaptic('success');
      pushToast('success', isAr ? 'تم إصدار سند القبض وتحديث الرصيد' : 'Payment receipt issued');
      setShowQuickPay(false);
      if (res.payment) setPreviewReceipt(res.payment);
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    const propId = activeContract?.propertyId || state.properties[0]?.id;
    const unitId = activeContract?.unitId || state.units[0]?.id;
    if (!propId || !unitId) return;
    const res = await mutate(
      'POST',
      '/api/tickets',
      {
        propertyId: propId,
        unitId,
        tenantId: tenant.id,
        source: 'المستأجر',
        category: ticketForm.category,
        priority: ticketForm.priority,
        title: ticketForm.title,
        description: ticketForm.description || ticketForm.title,
        estimatedCost: ticketForm.estimatedCost,
        actualCost: 0,
        status: 'جديد',
      },
      { offlineDescAr: `بلاغ صيانة للمستأجر ${tenant.nameAr}` }
    );
    if (res) {
      triggerHaptic('success');
      pushToast('success', isAr ? 'تم فتح بلاغ الصيانة وربطه بملف المستأجر' : 'Maintenance ticket created');
      setShowNewTicket(false);
      setTicketForm({ category: 'سباكة', priority: 'متوسط', title: '', description: '', estimatedCost: 250 });
    }
  };

  const handleLogCommunication = async (customSummary?: string, customChannel?: typeof commForm.channel) => {
    const summaryText = customSummary ?? commForm.summary;
    if (!summaryText.trim()) return;
    const res = await mutate(
      'POST',
      '/api/communications',
      {
        targetType: 'مستأجر',
        targetId: tenant.id,
        targetName: tenant.nameAr,
        channel: customChannel || commForm.channel,
        direction: commForm.direction,
        templateUsed: commForm.templateUsed || undefined,
        language: commForm.language,
        summary: summaryText,
        status: 'مرسل',
      },
      { offlineDescAr: `تواصل مع ${tenant.nameAr}` }
    );
    if (res) {
      triggerHaptic('success');
      pushToast('success', isAr ? 'تم توثيق التواصل في السجل التاريخي' : 'Communication logged');
      if (!customSummary) setCommForm((prev) => ({ ...prev, summary: '' }));
    }
  };

  const handleScheduleAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await mutate(
      'POST',
      `/api/tenants/${tenant.id}/appointments`,
      {
        ...apptForm,
        propertyId: activeContract?.propertyId,
        unitId: activeContract?.unitId,
      },
      { offlineDescAr: `موعد مع ${tenant.nameAr}` }
    );
    if (res) {
      triggerHaptic('success');
      pushToast('success', isAr ? 'تمت جدولة الموعد وإضافته للسجل والمهام' : 'Appointment scheduled');
      setShowAppointmentModal(false);
    }
  };

  const handleAddViolation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!violationForm.title.trim()) return;
    const res = await mutate('POST', `/api/tenants/${tenant.id}/notes`, violationForm, {
      offlineDescAr: `تسجيل ملاحظة لـ ${tenant.nameAr}`,
    });
    if (res) {
      triggerHaptic('success');
      pushToast('success', isAr ? 'تم توثيق الملاحظة / المخالفة في السجل' : 'Note recorded');
      setViolationForm({ title: '', category: 'ملاحظة', details: '' });
      setShowAddViolation(false);
    }
  };

  const handleUpdateBehaviorScore = async (field: keyof TenantBehaviorScores, val: number) => {
    const nextScores: TenantBehaviorScores = {
      ...scores,
      [field]: val,
    };
    const res = await mutate('PATCH', `/api/tenants/${tenant.id}`, { behaviorScores: nextScores });
    if (res) {
      triggerHaptic('light');
      pushToast('success', isAr ? 'تم تحديث التقييم السلوكي للمستأجر' : 'Behavior score updated');
    }
  };

  const handleCreateHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeContract) {
      pushToast('error', isAr ? 'يجب وجود عقد مرتبط لإنشاء محضر استلام/إخلاء' : 'Linked contract required');
      return;
    }
    const depositHeld = activeContract.securityDeposit || 0;
    const unpaidRentDue = tenantOpenBalance;
    const netRefundOrDue = depositHeld - handoverForm.damageCost - unpaidRentDue;
    const signatureDataUrl =
      hasSignature && sigCanvasRef.current ? sigCanvasRef.current.toDataURL('image/png') : undefined;

    const res = await mutate(
      'POST',
      '/api/handovers',
      {
        contractId: activeContract.id,
        unitId: activeContract.unitId,
        propertyId: activeContract.propertyId,
        type: handoverForm.type,
        date: handoverForm.date,
        keysReturned: handoverForm.keysReturned,
        acRemotesReturned: handoverForm.acRemotesReturned,
        electricityReading: handoverForm.electricityReading || '00000',
        waterReading: handoverForm.waterReading || '00000',
        checklist: handoverForm.checklist,
        damageCost: handoverForm.damageCost,
        unpaidRentDue,
        depositHeld,
        netRefundOrDue,
        photosDataUrls: handoverForm.photosDataUrls,
        tenantSignatureDataUrl: signatureDataUrl,
        notes: handoverForm.notes,
        status: 'بانتظار الاعتماد',
      },
      { offlineDescAr: `محضر ${handoverForm.type} - ${tenant.nameAr}` }
    );
    if (res) {
      triggerHaptic('success');
      pushToast('success', isAr ? 'تم حفظ محضر التسليم/الإخلاء مع التوقيع الرقمي' : 'Handover saved');
      setShowNewHandover(false);
      setTab('handovers');
    }
  };

  const handleApproveHandover = async (handoverId: string) => {
    const res = await mutate('POST', `/api/handovers/${handoverId}/approve`, {
      nextUnitStatus: 'تحتاج إلى تنظيف',
    });
    if (res) {
      triggerHaptic('success');
      pushToast('success', isAr ? 'تم اعتماد المحضر وتحديث حالة الوحدة والعقد' : 'Handover approved');
    }
  };

  const handleTenantOcrUpload = async (file: File) => {
    setOcrBusy(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await runGeminiOcrExtraction({
        userId: currentUser.id,
        dataUrl,
        mimeType: file.type || 'image/jpeg',
        fileName: file.name,
        categoryHint: 'هويات وإقامات',
        autoSync: true,
        targetTenantId: tenant.id,
        applyProperty: false,
        createMissing: false,
      });
      await mutate('POST', '/api/documents', {
        title: [res.extracted.docType, tenant.nameAr].filter(Boolean).join(' - '),
        category: res.extracted.docType === 'عقد إيجار' ? 'عقود إيجار' : 'هويات وإقامات',
        fileName: file.name,
        fileType: file.type.includes('pdf') ? 'PDF' : 'JPG',
        fileSizeKb: Math.max(1, Math.round(file.size / 1024)),
        relatedType: 'مستأجر',
        relatedId: tenant.id,
        expiryDate: res.extracted.expiryDate || res.extracted.endDate || undefined,
        version: 1,
        dataUrl,
        ocrStatus: 'تم الاستخراج آلياً',
        ocrRawText: res.rawText,
        ocrExtracted: res.extracted,
        accessLog: [],
      });
      triggerHaptic('success');
      pushToast('success', isAr ? 'تم تحليل المستند بالذكاء الاصطناعي وأرشفته في الملف' : 'Document OCR complete');
    } catch (err) {
      pushToast('error', (err as Error).message);
    } finally {
      setOcrBusy(false);
    }
  };

  // Signature Pad Pointer Events
  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    isDrawingRef.current = true;
    setHasSignature(true);
  };
  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !sigCanvasRef.current) return;
    const ctx = sigCanvasRef.current.getContext('2d');
    if (!ctx) return;
    const rect = sigCanvasRef.current.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };
  const endDraw = () => {
    isDrawingRef.current = false;
  };
  const clearSignature = () => {
    const canvas = sigCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx?.clearRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const tabs: { id: DossierTabId; labelAr: string; labelEn: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
    { id: 'personal', labelAr: 'البيانات الشخصية', labelEn: 'Personal Info', icon: User },
    { id: 'contract', labelAr: 'العقد والإشغال', labelEn: 'Contract', icon: FileSignature, badge: tenantContracts.length },
    { id: 'financials', labelAr: 'المالية والدفعات', labelEn: 'Financials', icon: Wallet, badge: tenantPayments.length },
    { id: 'maintenance', labelAr: 'الصيانة والبلاغات', labelEn: 'Maintenance', icon: Wrench, badge: tenantTickets.length },
    { id: 'communication', labelAr: 'التواصل', labelEn: 'Comms', icon: MessageCircle, badge: tenantComms.length },
    { id: 'handovers', labelAr: 'التسليم والاستلام', labelEn: 'Handovers', icon: ClipboardCheck, badge: tenantHandovers.length },
    { id: 'history', labelAr: 'السجل التاريخي', labelEn: 'History & Notes', icon: History },
  ];

  // Countdown math for activeContract
  const contractDaysTotal = activeContract ? Math.max(1, daysBetween(activeContract.startDate, activeContract.endDate)) : 365;
  const contractDaysRemaining = activeContract ? daysBetween(TODAY_ISO, activeContract.endDate) : 0;
  const contractElapsedPct = activeContract
    ? Math.min(100, Math.max(0, Math.round(((contractDaysTotal - Math.max(0, contractDaysRemaining)) / contractDaysTotal) * 100)))
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/75 backdrop-blur-sm">
      <div className="w-full max-w-5xl h-full bg-gradient-to-b from-[#0A0E1A] via-[#111727] to-[#1A1F2E] text-slate-100 border-s border-white/10 shadow-2xl flex flex-col overflow-hidden animate-aqar-hero">
        {/* Glassmorphic Hero Header */}
        <div className="relative overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#0F1B38] via-[#172852] to-[#1A1F2E] px-5 py-4 shrink-0">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3.5 min-w-0">
              {/* Unit cover photo + Colored initial avatar */}
              <div className="relative shrink-0">
                <img
                  src={getUnitCoverPhoto(currentUnit?.unitType)}
                  alt={currentUnit?.unitNumber || 'Unit'}
                  className="w-16 h-16 rounded-2xl object-cover border border-white/20 opacity-85"
                />
                <div
                  className={`absolute -bottom-1.5 -end-1.5 w-9 h-9 rounded-xl bg-gradient-to-br ${getAvatarTone(
                    tenant.nameAr
                  )} border-2 border-[#0F1B38] flex items-center justify-center text-xs font-bold text-white shadow-lg`}
                >
                  {tenant.nameAr.slice(0, 2)}
                </div>
              </div>

              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold truncate text-white">{tenant.nameAr}</h2>
                  <span className="px-2 py-0.5 rounded-lg bg-white/10 border border-white/15 text-[11px] font-semibold text-blue-200">
                    {tenant.tenantType || 'فرد'}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg border text-[11px] font-semibold ${behaviorBadge.cls}`}>
                    <span>{behaviorBadge.dot}</span>
                    <span>{isAr ? behaviorBadge.labelAr : behaviorBadge.labelEn}</span>
                  </span>
                </div>

                {/* Clickable Property / Unit Link with Same-Property Other Units Popover */}
                <div className="relative flex flex-wrap items-center gap-2 text-xs text-slate-300">
                  {currentProperty && currentUnit ? (
                    <button
                      type="button"
                      onClick={() => setShowOtherUnitsPopover((v) => !v)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/[0.08] hover:bg-white/[0.15] border border-white/10 text-blue-200 font-medium cursor-pointer transition-colors"
                    >
                      <Building2 className="w-3.5 h-3.5 text-blue-300" />
                      <span>
                        {currentProperty.nameAr} · {isAr ? 'وحدة' : 'Unit'} {currentUnit.unitNumber}
                      </span>
                    </button>
                  ) : (
                    <span className="text-slate-400">{isAr ? 'بدون وحدة حالية مرتبطة' : 'No active unit linked'}</span>
                  )}
                  <span className="text-slate-500">·</span>
                  <span className="font-mono-num text-slate-300">{tenant.phone}</span>
                  <span className="text-slate-500">·</span>
                  <span className="font-mono-num text-slate-300">
                    {revealId ? tenant.nationalIdOrIqama : maskNationalId(tenant.nationalIdOrIqama)}
                  </span>

                  {showOtherUnitsPopover && currentProperty && (
                    <div className="absolute top-9 start-0 z-30 w-80 p-3 rounded-xl bg-[#13192B] border border-white/15 shadow-2xl space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-white">
                        <span>{isAr ? `وحدات ${currentProperty.nameAr}` : `${currentProperty.nameEn} Units`}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setShowOtherUnitsPopover(false);
                            onClose();
                            setActiveNav('properties');
                          }}
                          className="text-[11px] text-blue-400 hover:underline cursor-pointer"
                        >
                          {isAr ? 'فتح العقار ←' : 'Open Property →'}
                        </button>
                      </div>
                      <div className="max-h-40 overflow-y-auto space-y-1 text-[11px]">
                        {propertyUnits.map((u) => (
                          <div
                            key={u.id}
                            className={`flex items-center justify-between p-1.5 rounded-lg ${
                              u.id === currentUnit?.id ? 'bg-[#26478D]/30 border border-blue-400/30' : 'bg-white/[0.03]'
                            }`}
                          >
                            <span className="font-semibold">
                              وحدة {u.unitNumber} ({u.unitType})
                            </span>
                            <span className={u.status === 'شاغرة' ? 'text-emerald-400' : 'text-slate-400'}>
                              {u.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Corner Quick Actions */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <a
                href={`tel:${tenant.phone}`}
                onClick={() => handleLogCommunication(`اتصال هاتفي مباشر بالمستأجر (${tenant.phone})`, 'اتصال هاتفي')}
                className="min-h-[40px] px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Phone className="w-3.5 h-3.5 text-blue-300" />
                <span className="hidden sm:inline">{isAr ? 'اتصال' : 'Call'}</span>
              </a>
              <a
                href={buildWhatsAppHref(tenant.phone, `السلام عليكم ${tenant.nameAr}، تحية طيبة من ${state.settings.nameAr}`)}
                target="_blank"
                rel="noreferrer"
                onClick={() => handleLogCommunication('بدء محادثة واتساب مباشرة', 'رسالة نصية / واتساب')}
                className="min-h-[40px] px-3 rounded-xl bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{isAr ? 'واتساب' : 'WhatsApp'}</span>
              </a>
              {hasPermission('manage_tenants') && (
                <button
                  type="button"
                  onClick={() => setShowEditProfile(true)}
                  className="min-h-[40px] px-3 rounded-xl bg-[#26478D] hover:bg-[#1e3a75] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">{isAr ? 'تعديل البيانات' : 'Edit'}</span>
                </button>
              )}
              {hasPermission('manage_tenants') && !tenant.archivedAt && (
                <MoveToArchiveButton
                  category="tenants"
                  entityId={tenant.id}
                  entityLabel={tenant.nameAr}
                  variant="glassLight"
                  onArchived={onClose}
                />
              )}
              <button
                type="button"
                onClick={onClose}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 7 Smooth Scrollable Tabs */}
          <div className="mt-4 -mx-1 px-1 flex items-center gap-1.5 overflow-x-auto pb-1">
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    triggerHaptic('light');
                    setTab(t.id);
                  }}
                  className={`shrink-0 min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                    active
                      ? 'bg-[#26478D] text-white shadow-lg shadow-[#26478D]/30 border border-blue-400/30'
                      : 'bg-white/[0.04] hover:bg-white/[0.1] text-slate-300 border border-white/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{isAr ? t.labelAr : t.labelEn}</span>
                  {t.badge !== undefined && t.badge > 0 && (
                    <span className="px-1.5 py-0.2 rounded-md bg-white/15 text-[10px] font-mono-num">
                      {t.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 pb-24">
          {/* TAB 1: PERSONAL INFO */}
          {tab === 'personal' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Basic Info Card */}
                <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <User className="w-4 h-4 text-blue-400" />
                      <span>{isAr ? 'البيانات الأساسية والهوية' : 'Personal & Identity Data'}</span>
                    </h3>
                    {hasPermission('manage_tenants') && (
                      <button
                        type="button"
                        onClick={() => setShowEditProfile(true)}
                        className="text-xs text-blue-400 hover:underline cursor-pointer"
                      >
                        {isAr ? 'تعديل' : 'Edit'}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block">{isAr ? 'الاسم بالعربية' : 'Arabic Name'}</span>
                      <span className="font-semibold text-white">{tenant.nameAr}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">{isAr ? 'الاسم بالإنجليزية' : 'English Name'}</span>
                      <span className="font-semibold text-white">{tenant.nameEn || '—'}</span>
                    </div>
                    <div className="col-span-2 p-2.5 rounded-xl bg-white/[0.03] border border-white/10 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="text-slate-400 block">{isAr ? 'رقم الهوية / الإقامة' : 'National ID / Iqama'}</span>
                        <span className="font-mono-num font-bold text-sm text-white">
                          {revealId ? tenant.nationalIdOrIqama : maskNationalId(tenant.nationalIdOrIqama)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                            idValidation.valid ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {isAr ? idValidation.labelAr : idValidation.labelEn}
                        </span>
                        <button
                          type="button"
                          onClick={() => setRevealId((v) => !v)}
                          className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 cursor-pointer"
                          title={isAr ? 'إظهار/إخفاء الرقم' : 'Reveal/Mask'}
                        >
                          {revealId ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 block">{isAr ? 'تاريخ الميلاد' : 'Birth Date'}</span>
                      <span className="font-mono-num text-white">{tenant.birthDate || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">{isAr ? 'الجنسية' : 'Nationality'}</span>
                      <span className="text-white">{tenant.nationality}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">{isAr ? 'المهنة / جهة العمل' : 'Occupation / Employer'}</span>
                      <span className="text-white">{tenant.employer || '—'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">{isAr ? 'الحالة الاجتماعية' : 'Marital Status'}</span>
                      <span className="text-white">{tenant.maritalStatus || '—'}</span>
                    </div>
                    {(tenant.tenantType === 'عائلة' || tenant.familyMembersCount) && (
                      <div className="col-span-2">
                        <span className="text-slate-400 block">{isAr ? 'عدد أفراد الأسرة' : 'Family Members'}</span>
                        <span className="font-mono-num font-bold text-blue-300">
                          {tenant.familyMembersCount || 1} {isAr ? 'أفراد' : 'members'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Contact & Emergency Info */}
                <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md space-y-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Phone className="w-4 h-4 text-emerald-400" />
                    <span>{isAr ? 'بيانات التواصل والطوارئ' : 'Contact & Emergency Info'}</span>
                  </h3>
                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] border border-white/10">
                      <div>
                        <span className="text-slate-400 block">{isAr ? 'الجوال الأساسي' : 'Primary Phone'}</span>
                        <span className="font-mono-num font-bold text-sm text-white">{tenant.phone}</span>
                      </div>
                      <a
                        href={`tel:${tenant.phone}`}
                        className="px-3 py-1.5 rounded-lg bg-[#26478D] text-white font-semibold inline-flex items-center gap-1"
                      >
                        <Phone className="w-3 h-3" />
                        <span>{isAr ? 'اتصال مباشر' : 'Call'}</span>
                      </a>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-slate-400 block">{isAr ? 'جوال إضافي' : 'Alt Phone'}</span>
                        <span className="font-mono-num text-white">{tenant.altPhone || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">{isAr ? 'البريد الإلكتروني' : 'Email'}</span>
                        <span className="text-white break-all">{tenant.email || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">{isAr ? 'جهة اتصال الطوارئ' : 'Emergency Contact'}</span>
                        <span className="text-white">{tenant.emergencyContactName || '—'}</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">{isAr ? 'جوال الطوارئ' : 'Emergency Phone'}</span>
                        <span className="font-mono-num text-white">{tenant.emergencyContactPhone || '—'}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400 block">{isAr ? 'العنوان الوطني' : 'National Address'}</span>
                      <span className="text-white">{tenant.nationalAddress || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Attached Documents (PIN Protected ID Image + 30-Day Expiry Alert) */}
              <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-md space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-400" />
                      <span>{isAr ? `المستندات المرفقة (${tenantDocs.length})` : `Attached Documents (${tenantDocs.length})`}</span>
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {isAr
                        ? 'صور الهويات والإقامات محمية برمز أمان PIN وتنبيهات انتهاء قبل 30 يوماً'
                        : 'ID/Iqama photos are PIN-protected with 30-day expiry alerts'}
                    </p>
                  </div>
                  {hasPermission('manage_documents') && (
                    <label className="inline-flex items-center gap-1.5 px-3.5 min-h-[40px] rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{ocrBusy ? (isAr ? 'جاري التحليل...' : 'Scanning...') : isAr ? 'مسح ورفع مستند (OCR)' : 'Scan & Upload (OCR)'}</span>
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="hidden"
                        disabled={ocrBusy}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleTenantOcrUpload(f);
                        }}
                      />
                    </label>
                  )}
                </div>

                {tenantDocs.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-white/15 text-center text-xs text-slate-400">
                    {isAr ? 'لا توجد مستندات مؤرشفة لهذا المستأجر بعد.' : 'No archived documents yet.'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {tenantDocs.map((d) => {
                      const daysLeft = d.expiryDate ? daysBetween(TODAY_ISO, d.expiryDate) : null;
                      const expiringSoon = daysLeft !== null && daysLeft <= 30;
                      const isSensitive = d.category === 'هويات وإقامات' || d.title.includes('هوية') || d.title.includes('إقامة');
                      const isUnlocked = !isSensitive || unlockedDocIds[d.id];

                      return (
                        <div key={d.id} className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <div className="font-semibold text-white truncate">{d.title}</div>
                            <div className="text-[11px] text-slate-400 font-mono-num">
                              {d.category} · {d.fileType}
                            </div>
                            {d.expiryDate && (
                              <div className={`text-[11px] font-mono-num mt-1 inline-flex items-center gap-1 ${expiringSoon ? 'text-amber-300 font-bold' : 'text-slate-400'}`}>
                                {expiringSoon && <AlertTriangle className="w-3 h-3 text-amber-400" />}
                                <span>
                                  {isAr ? 'الانتهاء:' : 'Exp:'} {d.expiryDate}{' '}
                                  {daysLeft !== null && daysLeft <= 30
                                    ? daysLeft < 0
                                      ? isAr ? '(منتهية!)' : '(Expired!)'
                                      : isAr ? `(متبقي ${daysLeft} يوم)` : `(${daysLeft}d left)`
                                    : ''}
                                </span>
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const openPreview = () => {
                                setUnlockedDocIds((prev) => ({ ...prev, [d.id]: true }));
                                setPreviewDocDataUrl({ title: d.title, dataUrl: d.dataUrl });
                                mutate('POST', `/api/documents/${d.id}/access`, { action: 'معاينة' });
                              };
                              if (!isUnlocked) {
                                requestPinGate(isAr ? 'أدخل رمز PIN لعرض صورة الهوية/الإقامة' : 'Enter PIN to view protected ID', openPreview);
                              } else {
                                openPreview();
                              }
                            }}
                            className="shrink-0 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
                          >
                            {isSensitive && !isUnlocked ? <Lock className="w-3.5 h-3.5 text-amber-300" /> : <Eye className="w-3.5 h-3.5" />}
                            <span>{isAr ? (isUnlocked ? 'عرض' : 'فك القفل') : 'View'}</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: CONTRACT & OCCUPANCY */}
          {tab === 'contract' && (
            <div className="space-y-5">
              {tenantContracts.length > 1 && (
                <div className="flex flex-wrap items-center gap-2">
                  {tenantContracts.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setSelectedContractId(c.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold font-mono-num cursor-pointer ${
                        activeContract?.id === c.id
                          ? 'bg-[#26478D] text-white'
                          : 'bg-white/5 text-slate-300 border border-white/10'
                      }`}
                    >
                      {c.internalNumber} ({c.lifecycleStatus})
                    </button>
                  ))}
                </div>
              )}

              {!activeContract ? (
                <div className="p-6 rounded-2xl bg-white/[0.04] border border-white/10 text-center text-xs text-slate-400">
                  {isAr ? 'لا توجد عقود مسجلة لهذا المستأجر.' : 'No contracts recorded for this tenant.'}
                </div>
              ) : (
                <>
                  {/* Visual Countdown & Quick Actions */}
                  <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xs text-slate-400">{isAr ? 'العقد الحالي والمدة المتبقية' : 'Active Contract Countdown'}</div>
                        <div className="text-lg font-bold font-mono-num text-white mt-0.5">
                          {activeContract.internalNumber} · {activeContract.lifecycleStatus}
                        </div>
                      </div>
                      <div className="text-end font-mono-num">
                        <div
                          className={`text-lg font-bold ${
                            contractDaysRemaining <= 0
                              ? 'text-red-400'
                              : contractDaysRemaining <= 30
                              ? 'text-amber-300'
                              : 'text-emerald-400'
                          }`}
                        >
                          {contractDaysRemaining > 0
                            ? isAr
                              ? `${contractDaysRemaining} يوم متبقي`
                              : `${contractDaysRemaining} days left`
                            : isAr
                            ? 'منتهي المدة'
                            : 'Expired'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {activeContract.startDate} → {activeContract.endDate}
                        </div>
                      </div>
                    </div>

                    <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          contractDaysRemaining <= 30 ? 'bg-amber-400' : 'bg-[#26478D]'
                        }`}
                        style={{ width: `${contractElapsedPct}%` }}
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setPrintContractOpen(true)}
                        className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>{isAr ? 'عرض العقد (PDF)' : 'View Contract PDF'}</span>
                      </button>
                      {hasPermission('manage_contracts') && (
                        <>
                          <button
                            type="button"
                            onClick={() => setShowRenewContract(true)}
                            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>{isAr ? 'تجديد العقد' : 'Renew Contract'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setHandoverForm((prev) => ({ ...prev, type: 'إخلاء واستلام' }));
                              setShowNewHandover(true);
                            }}
                            className="px-3.5 py-2 rounded-xl bg-amber-600/90 hover:bg-amber-600 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>{isAr ? 'طلب إخلاء' : 'Request Eviction'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (state.settings.securityCenter?.requirePinBeforeEditContract) {
                                requestPinGate(isAr ? 'أدخل رمز PIN لتعديل بيانات العقد' : 'Enter PIN to edit contract', () =>
                                  setShowEditContract(true)
                                );
                              } else {
                                setShowEditContract(true);
                              }
                            }}
                            className="px-3.5 py-2 rounded-xl bg-[#26478D] hover:bg-[#1e3a75] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>{isAr ? 'تعديل العقد' : 'Edit Contract'}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Occupancy & Keys + Financial Terms Grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                    <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3">
                      <h4 className="font-bold text-sm text-white flex items-center gap-2">
                        <Key className="w-4 h-4 text-amber-300" />
                        <span>{isAr ? 'معلومات الإشغال والاستلام' : 'Occupancy & Handover Info'}</span>
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-slate-400 block">{isAr ? 'العقار والوحدة' : 'Property / Unit'}</span>
                          <span className="font-semibold text-white">
                            {currentProperty?.nameAr} · {currentUnit?.unitNumber}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">{isAr ? 'الدور' : 'Floor'}</span>
                          <span className="font-mono-num text-white">{currentUnit?.floor ?? '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">{isAr ? 'تاريخ الاستلام' : 'Handover Date'}</span>
                          <span className="font-mono-num text-white">{activeContract.handoverDate || activeContract.startDate}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">{isAr ? 'بداية الإشغال' : 'Occupancy Start'}</span>
                          <span className="font-mono-num text-white">{activeContract.occupancyStartDate || activeContract.startDate}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">{isAr ? 'حالة الإشغال' : 'Occupancy Status'}</span>
                          <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-semibold">
                            {activeContract.occupancyStatus || 'نشط'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">{isAr ? 'المفاتيح والريموتات' : 'Keys & Remotes'}</span>
                          <span className="font-mono-num text-white">
                            {activeContract.keysDeliveredCount ?? currentUnit?.keyCount ?? 2} مفتاح ·{' '}
                            {activeContract.remotesDeliveredCount ?? currentUnit?.acRemoteCount ?? 2} ريموت
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3">
                      <h4 className="font-bold text-sm text-white flex items-center gap-2">
                        <FileSignature className="w-4 h-4 text-blue-400" />
                        <span>{isAr ? 'تفاصيل العقد ومنصة إيجار' : 'Contract & Ejar Terms'}</span>
                      </h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-slate-400 block">{isAr ? 'رقم عقد إيجار' : 'Ejar Contract #'}</span>
                          <span className="font-mono-num text-white">{activeContract.ejarNumber || '—'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">{isAr ? 'حالة التوثيق في إيجار' : 'Ejar Status'}</span>
                          <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-semibold">
                            {activeContract.ejarStatus}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">{isAr ? 'الإيجار السنوي / الشهري' : 'Annual / Monthly Rent'}</span>
                          <span className="font-mono-num font-bold text-emerald-400">
                            {formatInCurrency(activeContract.annualRent, activeContract.currency || 'SAR')}
                            <span className="text-slate-400 font-normal">
                              {' '}
                              ({formatInCurrency(Math.round(activeContract.annualRent / 12), activeContract.currency || 'SAR')}/شهر)
                            </span>
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">{isAr ? 'دورة السداد' : 'Payment Cycle'}</span>
                          <span className="text-white">{activeContract.paymentFrequency}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">{isAr ? 'التأمين / السعي' : 'Deposit / Office Fee'}</span>
                          <span className="font-mono-num text-white">
                            {formatSar(activeContract.securityDeposit, lang)} / {formatSar(activeContract.officeFee, lang)}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">{isAr ? 'رسوم الإلغاء المبكر' : 'Early Termination Fee'}</span>
                          <span className="font-mono-num text-amber-300">
                            {formatSar(activeContract.earlyTerminationFee || 0, lang)}
                          </span>
                        </div>
                        <div className="col-span-2 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="text-slate-400 block">{isAr ? 'الخدمات المشمولة' : 'Included Services'}</span>
                            <span className="text-white">{activeContract.includedServices || '—'}</span>
                          </div>
                          {activeContract.ejarPortalUrl && (
                            <a
                              href={activeContract.ejarPortalUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-blue-400 hover:underline font-semibold"
                            >
                              <span>{isAr ? 'رابط منصة إيجار' : 'Ejar Portal'}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 3: FINANCIALS & PAYMENTS (WITH RBAC) */}
          {tab === 'financials' && (
            <div className="space-y-5">
              {!canViewFullFinancials ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/30 flex items-start gap-3 text-xs text-amber-200">
                    <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold text-sm">{isAr ? 'وصول مالي مقيد حسب الصلاحية' : 'Restricted Financial View'}</div>
                      <p className="mt-1 opacity-90">
                        {isAr
                          ? 'دورك الوظيفي الحالي يتيح الاطلاع على تكاليف الصيانة المحملة على المستأجر فقط دون كشف مبالغ الإيجار وسندات القبض.'
                          : 'Your current role displays tenant-borne maintenance charges only.'}
                      </p>
                    </div>
                  </div>
                  <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3">
                    <h4 className="text-sm font-bold">{isAr ? 'مصروفات الصيانة المحملة على المستأجر' : 'Tenant-Borne Maintenance Charges'}</h4>
                    {tenantBorneMaintenanceExpenses.length === 0 ? (
                      <p className="text-xs text-slate-400">{isAr ? 'لا توجد رسوم صيانة محملة على المستأجر.' : 'No tenant maintenance charges.'}</p>
                    ) : (
                      <div className="divide-y divide-white/10 text-xs">
                        {tenantBorneMaintenanceExpenses.map((e) => (
                          <div key={e.id} className="py-2.5 flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-white">{e.notes || e.category}</div>
                              <div className="text-slate-400 font-mono-num">{e.expenseNumber} · {e.date}</div>
                            </div>
                            <span className="font-mono-num font-bold text-amber-300">{formatSar(e.amount, lang)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* Financial KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
                      <div className="text-[11px] text-slate-400">{isAr ? 'قيمة العقود' : 'Contract Total'}</div>
                      <div className="text-base font-bold font-mono-num text-white mt-1">{formatSar(totalContractValue, lang)}</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-400/20">
                      <div className="text-[11px] text-emerald-300">{isAr ? 'إجمالي المدفوع' : 'Total Paid'}</div>
                      <div className="text-base font-bold font-mono-num text-emerald-300 mt-1">{formatSar(tenantPaidTotal, lang)}</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/20">
                      <div className="text-[11px] text-amber-300">{isAr ? 'المتبقي المفتوح' : 'Open Balance'}</div>
                      <div className="text-base font-bold font-mono-num text-amber-300 mt-1">{formatSar(tenantOpenBalance, lang)}</div>
                    </div>
                    <div className="p-4 rounded-2xl bg-red-500/10 border border-red-400/20">
                      <div className="text-[11px] text-red-300">{isAr ? 'المتأخرات المستحقة' : 'Overdue'}</div>
                      <div className="text-base font-bold font-mono-num text-red-300 mt-1">{formatSar(tenantOverdueTotal, lang)}</div>
                    </div>
                  </div>

                  {/* Quick Financial Actions */}
                  <div className="flex flex-wrap items-center gap-2">
                    {hasPermission('collect_payments') && activeContract && (
                      <button
                        type="button"
                        onClick={() => {
                          const nextInst = tenantInstallments.find((i) => i.remainingAmount > 0 && i.status !== 'ملغاة');
                          setPayForm((prev) => ({ ...prev, amount: nextInst?.remainingAmount || Math.round(activeContract.annualRent / 4) }));
                          setShowQuickPay(true);
                        }}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Wallet className="w-3.5 h-3.5" />
                        <span>{isAr ? 'تسجيل دفعة / سند قبض' : 'Record Payment'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const file = exportTenantStatementToExcel({ state, tenant, lang, baseCurrency });
                        pushToast('success', isAr ? `تم تصدير كشف الحساب (${file})` : `Exported ${file}`);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{isAr ? 'كشف حساب Excel' : 'Excel Statement'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>{isAr ? 'طباعة PDF' : 'Print PDF'}</span>
                    </button>
                    {activeContract && tenantOpenBalance > 0 && (
                      <button
                        type="button"
                        onClick={async () => {
                          const r = await mutate('POST', '/api/reminders/run', {
                            contractId: activeContract.id,
                            channels: ['واتساب'],
                          });
                          if (r) pushToast('success', isAr ? 'تم إرسال تذكير سداد للمستأجر وتوثيقه' : 'Payment reminder sent');
                        }}
                        className="px-3.5 py-2 rounded-xl bg-[#26478D] hover:bg-[#1e3a75] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>{isAr ? 'إرسال تذكير بالسداد' : 'Send Reminder'}</span>
                      </button>
                    )}
                  </div>

                  {/* Installments Schedule */}
                  <div className="rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/10 font-bold text-xs text-white">
                      {isAr ? `جدول الأقساط (${tenantInstallments.length})` : `Installments (${tenantInstallments.length})`}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-start text-xs">
                        <thead className="bg-white/[0.03] text-slate-400 border-b border-white/10">
                          <tr>
                            <th className="py-2.5 px-4 text-start">#</th>
                            <th className="py-2.5 px-4 text-start">{isAr ? 'تاريخ الاستحقاق' : 'Due Date'}</th>
                            <th className="py-2.5 px-4 text-start">{isAr ? 'المبلغ' : 'Amount'}</th>
                            <th className="py-2.5 px-4 text-start">{isAr ? 'المدفوع' : 'Paid'}</th>
                            <th className="py-2.5 px-4 text-start">{isAr ? 'المتبقي' : 'Remaining'}</th>
                            <th className="py-2.5 px-4 text-start">{isAr ? 'الحالة' : 'Status'}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                          {tenantInstallments.map((inst) => {
                            const dot =
                              inst.status === 'مدفوعة بالكامل'
                                ? '🟢'
                                : inst.status === 'متأخرة'
                                ? '🔴'
                                : inst.status === 'مستحقة اليوم' || inst.status === 'مدفوعة جزئياً'
                                ? '🟡'
                                : '⚪';
                            return (
                              <tr key={inst.id} className="hover:bg-white/[0.02]">
                                <td className="py-2.5 px-4 font-mono-num">{inst.installmentNumber}</td>
                                <td className="py-2.5 px-4 font-mono-num">{inst.dueDate}</td>
                                <td className="py-2.5 px-4 font-mono-num">{formatSar(inst.amount, lang)}</td>
                                <td className="py-2.5 px-4 font-mono-num text-emerald-400">{formatSar(inst.paidAmount, lang)}</td>
                                <td className="py-2.5 px-4 font-mono-num text-amber-300 font-semibold">{formatSar(inst.remainingAmount, lang)}</td>
                                <td className="py-2.5 px-4">
                                  <span className="inline-flex items-center gap-1.5">
                                    <span>{dot}</span>
                                    <span>{inst.status}</span>
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Full Payments Log */}
                  <div className="rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden">
                    <div className="px-4 py-3 border-b border-white/10 font-bold text-xs text-white">
                      {isAr ? `سجل المدفوعات والسندات (${tenantPayments.length})` : `Payments Log (${tenantPayments.length})`}
                    </div>
                    {tenantPayments.length === 0 ? (
                      <div className="p-4 text-xs text-slate-400 text-center">
                        {isAr ? 'لا توجد دفعات مسجلة بعد.' : 'No payments recorded yet.'}
                      </div>
                    ) : (
                      <div className="divide-y divide-white/5">
                        {tenantPayments.map((pay) => (
                          <div key={pay.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                            <div>
                              <div className="font-mono-num font-bold text-white">{pay.receiptNumber}</div>
                              <div className="text-[11px] text-slate-400">
                                {pay.paymentType} · {pay.paymentMethod} · {formatDateTime(pay.createdAt, lang)}
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-end font-mono-num">
                                <div className={`font-bold ${pay.status === 'معكوس' ? 'line-through text-red-400' : 'text-emerald-400'}`}>
                                  {formatSar(pay.amount, lang)}
                                </div>
                                <div className="text-[10px] text-slate-400">{pay.status}</div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setPreviewReceipt(pay)}
                                className="px-3 py-1.5 rounded-lg bg-[#26478D] hover:bg-[#1e3a75] text-white text-[11px] font-semibold cursor-pointer"
                              >
                                {isAr ? 'عرض الإيصال' : 'Receipt'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 4: MAINTENANCE & TICKETS */}
          {tab === 'maintenance' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
                  <div className="text-[11px] text-slate-400">{isAr ? 'إجمالي البلاغات' : 'Total Tickets'}</div>
                  <div className="text-lg font-bold font-mono-num text-white mt-1">{tenantTickets.length}</div>
                </div>
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/20">
                  <div className="text-[11px] text-amber-300">{isAr ? 'بلاغات نشطة' : 'Active'}</div>
                  <div className="text-lg font-bold font-mono-num text-amber-300 mt-1">
                    {tenantTickets.filter((t) => t.status !== 'مكتمل' && t.status !== 'مغلق').length}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
                  <div className="text-[11px] text-slate-400">{isAr ? 'متوسط الاستجابة' : 'Avg Response'}</div>
                  <div className="text-lg font-bold font-mono-num text-blue-300 mt-1">4.5 {isAr ? 'ساعة' : 'hrs'}</div>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
                  <div className="text-[11px] text-slate-400">{isAr ? 'أكثر فئة تكراراً' : 'Top Issue'}</div>
                  <div className="text-sm font-bold text-white mt-1 truncate">
                    {tenantTickets[0]?.category || (isAr ? 'لا يوجد' : 'None')}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                {hasPermission('manage_maintenance') && (
                  <button
                    type="button"
                    onClick={() => setShowNewTicket(true)}
                    className="px-4 py-2 rounded-xl bg-[#26478D] hover:bg-[#1e3a75] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isAr ? 'فتح بلاغ صيانة جديد للوحدة' : 'New Maintenance Ticket'}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    setActiveNav('maintenance');
                  }}
                  className="text-xs font-semibold text-blue-400 hover:underline cursor-pointer"
                >
                  {isAr ? 'فتح مركز الصيانة الكامل ←' : 'Open Maintenance Center →'}
                </button>
              </div>

              <div className="rounded-2xl bg-white/[0.04] border border-white/10 divide-y divide-white/5">
                {tenantTickets.length === 0 ? (
                  <div className="p-5 text-center text-xs text-slate-400">
                    {isAr ? 'سجل الصيانة نظيف — لا توجد بلاغات مسجلة.' : 'No maintenance tickets found.'}
                  </div>
                ) : (
                  tenantTickets.map((tkt) => (
                    <div key={tkt.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="space-y-0.5">
                        <div className="font-bold text-white">{tkt.title}</div>
                        <div className="text-[11px] text-slate-400 font-mono-num">
                          {tkt.ticketNumber} · {tkt.category} · {tkt.priority} · {tkt.createdAt.slice(0, 10)}
                        </div>
                        {tkt.diagnosis && <div className="text-[11px] text-slate-300">{tkt.diagnosis}</div>}
                      </div>
                      <div className="text-end space-y-1">
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-semibold">{tkt.status}</span>
                        {tkt.actualCost > 0 && (
                          <div className="text-[11px] font-mono-num text-slate-300">{formatSar(tkt.actualCost, lang)}</div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 5: COMMUNICATION & APPOINTMENTS */}
          {tab === 'communication' && (
            <div className="space-y-5">
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
                  <div className="text-slate-400">{isAr ? 'الرسائل المسجلة' : 'Messages'}</div>
                  <div className="text-lg font-bold font-mono-num text-white mt-1">
                    {tenantComms.filter((c) => c.channel !== 'اتصال هاتفي').length}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
                  <div className="text-slate-400">{isAr ? 'المكالمات' : 'Calls'}</div>
                  <div className="text-lg font-bold font-mono-num text-white mt-1">
                    {tenantComms.filter((c) => c.channel === 'اتصال هاتفي').length}
                  </div>
                </div>
                <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10">
                  <div className="text-slate-400">{isAr ? 'آخر تواصل' : 'Last Contact'}</div>
                  <div className="text-xs font-mono-num text-blue-300 mt-1">
                    {tenantComms[0] ? formatDateTime(tenantComms[0].createdAt, lang) : '—'}
                  </div>
                </div>
              </div>

              {/* Composer + Template Selector + Appointment */}
              <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-bold text-sm text-white">{isAr ? 'إرسال رسالة أو جدولة موعد' : 'Send Message / Schedule'}</h4>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAppointmentModal(true)}
                      className="px-3 py-1.5 rounded-xl bg-amber-600/85 hover:bg-amber-600 text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <CalendarClock className="w-3.5 h-3.5" />
                      <span>{isAr ? 'جدولة موعد' : 'Schedule Appointment'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        setActiveNav('templates');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-blue-300 font-semibold cursor-pointer"
                    >
                      {isAr ? 'مكتبة القوالب ←' : 'Templates →'}
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <select
                    value={commForm.channel}
                    onChange={(e) => setCommForm({ ...commForm, channel: e.target.value as typeof commForm.channel })}
                    className="min-h-[40px] px-2.5 rounded-xl bg-[#0A0E1A] border border-white/10 text-white"
                  >
                    <option value="رسالة نصية / واتساب">واتساب / SMS</option>
                    <option value="اتصال هاتفي">اتصال هاتفي</option>
                    <option value="بريد إلكتروني">بريد إلكتروني</option>
                    <option value="زيارة ميدانية">زيارة ميدانية</option>
                    <option value="ملاحظة داخلية">ملاحظة داخلية</option>
                  </select>
                  <select
                    value={commForm.direction}
                    onChange={(e) => setCommForm({ ...commForm, direction: e.target.value as 'صادر' | 'وارد' })}
                    className="min-h-[40px] px-2.5 rounded-xl bg-[#0A0E1A] border border-white/10 text-white"
                  >
                    <option value="صادر">{isAr ? 'صادر (من المكتب)' : 'Outbound'}</option>
                    <option value="وارد">{isAr ? 'وارد (من المستأجر)' : 'Inbound'}</option>
                  </select>
                  <select
                    value={commForm.templateUsed}
                    onChange={(e) => {
                      const tpl = (state.communicationTemplates || []).find((t) => t.name === e.target.value);
                      const resolved = tpl
                        ? resolveTemplateText(commForm.language === 'en' && tpl.contentEn ? tpl.contentEn : tpl.contentAr, {
                            state,
                            tenant,
                            contract: activeContract || undefined,
                          })
                        : commForm.summary;
                      setCommForm({ ...commForm, templateUsed: e.target.value, summary: resolved });
                    }}
                    className="min-h-[40px] px-2.5 rounded-xl bg-[#0A0E1A] border border-white/10 text-white"
                  >
                    <option value="">{isAr ? '-- اختر قالباً جاهزاً --' : '-- Choose Template --'}</option>
                    {(state.communicationTemplates || []).map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={commForm.language}
                    onChange={(e) => setCommForm({ ...commForm, language: e.target.value as 'ar' | 'en' | 'bn' })}
                    className="min-h-[40px] px-2.5 rounded-xl bg-[#0A0E1A] border border-white/10 text-white"
                  >
                    <option value="ar">العربية</option>
                    <option value="en">English</option>
                    <option value="bn">বাংলা</option>
                  </select>
                </div>

                <textarea
                  rows={3}
                  value={commForm.summary}
                  onChange={(e) => setCommForm({ ...commForm, summary: e.target.value })}
                  placeholder={isAr ? 'اكتب نص الرسالة أو ملخص المكالمة...' : 'Write message or call summary...'}
                  className="w-full px-3 py-2 rounded-xl bg-[#0A0E1A] border border-white/10 text-white"
                />

                <div className="flex flex-wrap justify-end gap-2">
                  <a
                    href={buildWhatsAppHref(tenant.phone, commForm.summary || `مرحباً ${tenant.nameAr}`)}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => handleLogCommunication(commForm.summary || 'رسالة واتساب مباشرة', 'رسالة نصية / واتساب')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold inline-flex items-center gap-1.5"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{isAr ? 'إرسال عبر واتساب' : 'Send WhatsApp'}</span>
                  </a>
                  {tenant.email && (
                    <a
                      href={`mailto:${tenant.email}?subject=${encodeURIComponent(state.settings.nameAr)}&body=${encodeURIComponent(commForm.summary)}`}
                      onClick={() => handleLogCommunication(commForm.summary || 'مراسلة بريدية', 'بريد إلكتروني')}
                      className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold inline-flex items-center gap-1.5"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      <span>{isAr ? 'بريد إلكتروني' : 'Email'}</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => handleLogCommunication()}
                    className="px-4 py-2 rounded-xl bg-[#26478D] hover:bg-[#1e3a75] text-white font-semibold cursor-pointer"
                  >
                    {isAr ? 'توثيق في السجل' : 'Save Log'}
                  </button>
                </div>
              </div>

              {/* Chronological Timeline */}
              <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3">
                <h4 className="font-bold text-sm text-white">{isAr ? 'الخط الزمني للتواصل والمواعيد' : 'Communication Timeline'}</h4>
                {tenantComms.length === 0 ? (
                  <p className="text-xs text-slate-400">{isAr ? 'لا توجد مراسلات موثقة بعد.' : 'No logs yet.'}</p>
                ) : (
                  <div className="space-y-3">
                    {tenantComms.map((c) => {
                      const staff = state.users.find((u) => u.id === c.sentBy);
                      return (
                        <div key={c.id} className="p-3.5 rounded-xl bg-white/[0.03] border border-white/10 space-y-1 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2 py-0.5 rounded-md bg-[#26478D]/40 text-blue-200 font-semibold">{c.channel}</span>
                              <span>{c.direction || 'صادر'}</span>
                              {c.status === 'مجدول' && (
                                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-semibold">
                                  مجدول: {c.scheduledAt?.replace('T', ' ')}
                                </span>
                              )}
                              <span>· بواسطة {staff?.nameAr || c.sentBy}</span>
                            </div>
                            <span className="font-mono-num">{formatDateTime(c.createdAt, lang)}</span>
                          </div>
                          <p className="text-slate-200 leading-relaxed">{c.summary}</p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: HANDOVERS & EVICTION SETTLEMENT */}
          {tab === 'handovers' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-bold text-white">{isAr ? 'محاضر التسليم والاستلام والإخلاء' : 'Handover & Eviction Inspections'}</h4>
                  <p className="text-[11px] text-slate-400">
                    {isAr ? 'حساب تلقائي لتسوية التأمين مقابل الأضرار والرصيد المتبقي مع التوقيع الرقمي' : 'Automatic deposit settlement & digital signatures'}
                  </p>
                </div>
                {hasPermission('manage_contracts') && activeContract && (
                  <button
                    type="button"
                    onClick={() => setShowNewHandover(true)}
                    className="px-4 py-2 rounded-xl bg-[#26478D] hover:bg-[#1e3a75] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isAr ? 'إنشاء محضر استلام / إخلاء' : 'New Handover / Eviction'}</span>
                  </button>
                )}
              </div>

              {tenantHandovers.length === 0 ? (
                <div className="p-6 rounded-2xl bg-white/[0.04] border border-white/10 text-center text-xs text-slate-400">
                  {isAr ? 'لا توجد محاضر استلام أو إخلاء مسجلة لهذا المستأجر بعد.' : 'No handover records yet.'}
                </div>
              ) : (
                <div className="space-y-4">
                  {tenantHandovers.map((h) => (
                    <div key={h.id} className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-bold text-sm text-white">{h.type}</div>
                          <div className="text-[11px] text-slate-400 font-mono-num">
                            {h.date} · كهرباء: {h.electricityReading} · مياه: {h.waterReading} · مفاتيح: {h.keysReturned}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-1 rounded-lg font-semibold ${
                              h.status === 'معتمد' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {h.status}
                          </span>
                          {h.status !== 'معتمد' && hasPermission('manage_contracts') && (
                            <button
                              type="button"
                              onClick={() => handleApproveHandover(h.id)}
                              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer"
                            >
                              {isAr ? 'اعتماد المحضر' : 'Approve'}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-white/[0.03] font-mono-num">
                        <div>
                          <span className="text-slate-400 block">التأمين المحتجز</span>
                          <span className="font-bold text-white">{formatSar(h.depositHeld, lang)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">تكلفة الأضرار</span>
                          <span className="font-bold text-red-400">-{formatSar(h.damageCost, lang)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">إيجار مستحق</span>
                          <span className="font-bold text-amber-300">-{formatSar(h.unpaidRentDue, lang)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">صافي التسوية</span>
                          <span className={`font-bold ${h.netRefundOrDue >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {h.netRefundOrDue >= 0
                              ? `مسترد للمستأجر: ${formatSar(h.netRefundOrDue, lang)}`
                              : `مطالبة على المستأجر: ${formatSar(Math.abs(h.netRefundOrDue), lang)}`}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {h.checklist.map((item, idx) => (
                          <div key={idx} className="p-2 rounded-lg bg-white/[0.02] border border-white/10">
                            <div className="font-semibold text-white">{item.item}</div>
                            <div className={item.status === 'سليم' ? 'text-emerald-400' : 'text-amber-300'}>{item.status}</div>
                          </div>
                        ))}
                      </div>

                      {h.tenantSignatureDataUrl && (
                        <div className="flex items-center gap-3 pt-2">
                          <span className="text-slate-400">{isAr ? 'توقيع المستأجر الرقمي:' : 'Signature:'}</span>
                          <img src={h.tenantSignatureDataUrl} alt="Signature" className="h-12 bg-white rounded-lg p-1" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 7: HISTORY, VIOLATIONS, BEHAVIORAL SCORE & AI RISK */}
          {tab === 'history' && (
            <div className="space-y-5">
              {/* Behavioral Star Ratings & AI Risk Assessment */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-white flex items-center gap-2">
                      <Award className="w-4 h-4 text-amber-400" />
                      <span>{isAr ? 'التقييم السلوكي والالتزام (1–5 نجوم)' : 'Behavioral Rating (1-5)'}</span>
                    </h4>
                    <span className={`px-2.5 py-0.5 rounded-lg border font-semibold ${behaviorBadge.cls}`}>
                      {behaviorBadge.dot} {tenant.rating}/5
                    </span>
                  </div>

                  {[
                    { key: 'paymentCommitment' as const, labelAr: 'الالتزام بالسداد في المواعيد', labelEn: 'Payment Commitment' },
                    { key: 'unitCare' as const, labelAr: 'العناية بالوحدة السكنية', labelEn: 'Unit Care' },
                    { key: 'cooperation' as const, labelAr: 'التعاون وحسن الجوار', labelEn: 'Cooperation & Conduct' },
                  ].map((crit) => (
                    <div key={crit.key} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-white/[0.03]">
                      <span className="text-slate-200">{isAr ? crit.labelAr : crit.labelEn}</span>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            disabled={!hasPermission('manage_tenants')}
                            onClick={() => handleUpdateBehaviorScore(crit.key, star)}
                            className="cursor-pointer p-0.5"
                          >
                            <Star
                              className={`w-4 h-4 ${
                                star <= scores[crit.key] ? 'text-amber-400 fill-amber-400' : 'text-slate-600'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Smart Risk & Loyalty Card */}
                <div className={`p-5 rounded-2xl border space-y-3 text-xs ${riskLevel.tone}`}>
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-sm flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      <span>{isAr ? 'تحليل المخاطر ومؤشر الولاء الذكي' : 'Smart Risk & Loyalty Index'}</span>
                    </div>
                    <span className="font-mono-num font-bold text-base">{Math.round(riskScore)}%</span>
                  </div>
                  <div className="font-semibold">{riskLevel.labelAr}</div>
                  <p className="leading-relaxed opacity-90">{riskLevel.adviceAr}</p>
                  <div className="pt-2 border-t border-white/10 flex flex-wrap gap-3 font-mono-num text-[11px]">
                    <span>أقساط متأخرة: {overdueCount}</span>
                    <span>مخالفات: {violationCount}</span>
                    <span>سجل غرامات: {formatSar(scores.penaltyTotal || 0, lang)}</span>
                  </div>
                </div>
              </div>

              {/* Violations & Notes Section */}
              <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-white">{isAr ? 'المخالفات والملاحظات السلوكية' : 'Violations & Notes'}</h4>
                  {hasPermission('manage_tenants') && (
                    <button
                      type="button"
                      onClick={() => setShowAddViolation(true)}
                      className="px-3 py-1.5 rounded-xl bg-[#26478D] hover:bg-[#1e3a75] text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isAr ? 'إضافة ملاحظة / مخالفة' : 'Add Note / Violation'}</span>
                    </button>
                  )}
                </div>
                {(tenant.violationNotes || []).length === 0 ? (
                  <p className="text-slate-400">{isAr ? 'لا توجد مخالفات مسجلة في سجل المستأجر.' : 'No violations recorded.'}</p>
                ) : (
                  <div className="space-y-2">
                    {(tenant.violationNotes || []).map((vn) => (
                      <div key={vn.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/10 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-white">{vn.title}</span>
                          <span className="px-2 py-0.5 rounded-md bg-white/10 text-[10px]">{vn.category}</span>
                        </div>
                        <p className="text-slate-300">{vn.details}</p>
                        <div className="text-[10px] text-slate-400 font-mono-num">{formatDateTime(vn.createdAt, lang)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Historical Contracts & Tenant Audit Logs */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3">
                  <h4 className="font-bold text-sm text-white">{isAr ? 'تاريخ العقود والوحدات' : 'Contract History'}</h4>
                  {tenantContracts.map((c) => {
                    const p = state.properties.find((pr) => pr.id === c.propertyId);
                    const u = state.units.find((un) => un.id === c.unitId);
                    return (
                      <div key={c.id} className="p-3 rounded-xl bg-white/[0.03] border border-white/10 flex items-center justify-between">
                        <div>
                          <div className="font-mono-num font-bold text-white">{c.internalNumber}</div>
                          <div className="text-slate-400">
                            {p?.nameAr} · وحدة {u?.unitNumber} ({c.startDate} → {c.endDate})
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-md bg-white/10 text-slate-200">{c.lifecycleStatus}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="p-5 rounded-2xl bg-white/[0.04] border border-white/10 space-y-3">
                  <h4 className="font-bold text-sm text-white">{isAr ? 'سجل التدقيق لملف المستأجر' : 'Tenant Audit Log'}</h4>
                  <div className="max-h-56 overflow-y-auto space-y-2">
                    {state.auditLogs
                      .filter(
                        (a) =>
                          a.entityId === tenant.id ||
                          tenantContracts.some((c) => c.id === a.entityId) ||
                          a.summary.includes(tenant.nameAr)
                      )
                      .slice(0, 15)
                      .map((a) => (
                        <div key={a.id} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                          <div className="flex justify-between text-[11px] text-slate-400">
                            <span>{a.userName} · {a.action}</span>
                            <span className="font-mono-num">{formatDateTime(a.createdAt, lang)}</span>
                          </div>
                          <div className="text-slate-200 mt-0.5">{a.summary}</div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Floating Action Bar (FABs) inside Tenant File */}
        <div className="px-5 py-3 bg-[#0A0E1A]/95 border-t border-white/10 backdrop-blur-md flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {hasPermission('collect_payments') && activeContract && canViewFullFinancials && (
              <button
                type="button"
                onClick={() => {
                  const nextInst = tenantInstallments.find((i) => i.remainingAmount > 0 && i.status !== 'ملغاة');
                  setPayForm((prev) => ({ ...prev, amount: nextInst?.remainingAmount || 3500 }));
                  setShowQuickPay(true);
                }}
                className="min-h-[40px] px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>{isAr ? 'تسجيل دفعة' : 'Payment'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setTab('communication')}
              className="min-h-[40px] px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>{isAr ? 'رسالة' : 'Message'}</span>
            </button>
            {hasPermission('manage_maintenance') && (
              <button
                type="button"
                onClick={() => setShowNewTicket(true)}
                className="min-h-[40px] px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Wrench className="w-3.5 h-3.5 text-amber-300" />
                <span>{isAr ? 'بلاغ صيانة' : 'Ticket'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowAppointmentModal(true)}
              className="min-h-[40px] px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <CalendarClock className="w-3.5 h-3.5 text-blue-300" />
              <span>{isAr ? 'جدولة موعد' : 'Appointment'}</span>
            </button>
          </div>

          <CreateTaskQuickButton
            defaultType="تأجير"
            defaultTitle={`متابعة ملف المستأجر ${tenant.nameAr}`}
            propertyId={activeContract?.propertyId}
            unitId={activeContract?.unitId}
            relatedLabel={`المستأجر: ${tenant.nameAr}`}
            compact
          />
        </div>
      </div>

      {/* PIN Gate Modal */}
      {pinPrompt.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <form onSubmit={handleConfirmPin} className="w-full max-w-sm rounded-2xl bg-[#13192B] border border-white/15 p-6 space-y-4 text-white">
            <div className="flex items-center gap-2 font-bold text-sm">
              <Lock className="w-4 h-4 text-amber-400" />
              <span>{pinPrompt.title}</span>
            </div>
            <input
              type="password"
              inputMode="numeric"
              required
              autoFocus
              value={pinInput}
              onChange={(e) => setPinInput(e.target.value)}
              placeholder="•••• (الافتراضي 1234)"
              className="w-full min-h-[44px] px-3 text-center text-lg tracking-widest rounded-xl bg-[#0A0E1A] border border-white/15 font-mono-num"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPinPrompt({ open: false, title: '', onVerified: () => {} })}
                className="px-4 py-2 rounded-xl border border-white/15 text-xs cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-[#26478D] text-white text-xs font-semibold cursor-pointer">
                {isAr ? 'تحقق' : 'Verify'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Protected Document Preview Modal */}
      {previewDocDataUrl && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-[#13192B] border border-white/15 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-sm text-white">{previewDocDataUrl.title}</h4>
              <button type="button" onClick={() => setPreviewDocDataUrl(null)} className="cursor-pointer text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>
            {previewDocDataUrl.dataUrl ? (
              previewDocDataUrl.dataUrl.startsWith('data:application/pdf') ? (
                <iframe src={previewDocDataUrl.dataUrl} title={previewDocDataUrl.title} className="w-full h-96 rounded-xl bg-white" />
              ) : (
                <img src={previewDocDataUrl.dataUrl} alt={previewDocDataUrl.title} className="max-h-[70vh] mx-auto rounded-xl object-contain" />
              )
            ) : (
              <div className="p-8 rounded-xl bg-white/[0.03] border border-white/10 text-center text-xs text-slate-300 space-y-2">
                <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto" />
                <div>{isAr ? 'تم فك قفل السجل المؤرشف للعرض الموثق.' : 'Verified archive record unlocked.'}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Personal Profile Modal */}
      {showEditProfile && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <form onSubmit={handleSaveProfile} className="w-full max-w-2xl rounded-2xl bg-[#13192B] border border-white/15 p-6 space-y-4 my-auto text-xs text-white">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold">{isAr ? 'تعديل البيانات الشخصية للمستأجر' : 'Edit Tenant Profile'}</h4>
              <button type="button" onClick={() => setShowEditProfile(false)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                required
                placeholder="الاسم الكامل بالعربية"
                value={profileForm.nameAr}
                onChange={(e) => setProfileForm({ ...profileForm, nameAr: e.target.value })}
                className="min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10"
              />
              <input
                placeholder="Full Name (English)"
                value={profileForm.nameEn}
                onChange={(e) => setProfileForm({ ...profileForm, nameEn: e.target.value })}
                className="min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10"
              />
              <input
                required
                placeholder="رقم الهوية / الإقامة"
                value={profileForm.nationalIdOrIqama}
                onChange={(e) => setProfileForm({ ...profileForm, nationalIdOrIqama: e.target.value })}
                className="min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10 font-mono-num"
              />
              <input
                type="date"
                value={profileForm.birthDate}
                onChange={(e) => setProfileForm({ ...profileForm, birthDate: e.target.value })}
                className="min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10 font-mono-num"
              />
              <select
                value={profileForm.tenantType}
                onChange={(e) => setProfileForm({ ...profileForm, tenantType: e.target.value as TenantTypeKind })}
                className="min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10"
              >
                <option value="فرد">فرد</option>
                <option value="عائلة">عائلة</option>
                <option value="شركة">شركة / مؤسسة</option>
              </select>
              <select
                value={profileForm.maritalStatus}
                onChange={(e) => setProfileForm({ ...profileForm, maritalStatus: e.target.value as 'أعزب' | 'متزوج' | 'أرمل' })}
                className="min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10"
              >
                <option value="أعزب">أعزب</option>
                <option value="متزوج">متزوج</option>
                <option value="أرمل">أرمل</option>
              </select>
              {profileForm.tenantType === 'عائلة' && (
                <input
                  type="number"
                  min={1}
                  placeholder="عدد أفراد الأسرة"
                  value={profileForm.familyMembersCount}
                  onChange={(e) => setProfileForm({ ...profileForm, familyMembersCount: Number(e.target.value) })}
                  className="min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10 font-mono-num"
                />
              )}
              <input
                placeholder="الجنسية"
                value={profileForm.nationality}
                onChange={(e) => setProfileForm({ ...profileForm, nationality: e.target.value })}
                className="min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10"
              />
              <input
                placeholder="المهنة / جهة العمل"
                value={profileForm.employer}
                onChange={(e) => setProfileForm({ ...profileForm, employer: e.target.value })}
                className="min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10"
              />
              <input
                required
                placeholder="الجوال الأساسي"
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                className="min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10 font-mono-num"
              />
              <input
                placeholder="جوال إضافي"
                value={profileForm.altPhone}
                onChange={(e) => setProfileForm({ ...profileForm, altPhone: e.target.value })}
                className="min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10 font-mono-num"
              />
              <input
                type="email"
                placeholder="البريد الإلكتروني"
                value={profileForm.email}
                onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                className="min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10"
              />
              <input
                placeholder="اسم جهة اتصال الطوارئ"
                value={profileForm.emergencyContactName}
                onChange={(e) => setProfileForm({ ...profileForm, emergencyContactName: e.target.value })}
                className="min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10"
              />
              <input
                placeholder="جوال الطوارئ"
                value={profileForm.emergencyContactPhone}
                onChange={(e) => setProfileForm({ ...profileForm, emergencyContactPhone: e.target.value })}
                className="min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10 font-mono-num"
              />
              <input
                placeholder="العنوان الوطني"
                value={profileForm.nationalAddress}
                onChange={(e) => setProfileForm({ ...profileForm, nationalAddress: e.target.value })}
                className="sm:col-span-2 min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowEditProfile(false)} className="px-4 py-2 rounded-xl border border-white/15 cursor-pointer">
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button type="submit" className="px-5 py-2 rounded-xl bg-[#26478D] text-white font-semibold cursor-pointer">
                {isAr ? 'حفظ التغييرات' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Contract & Occupancy Modal */}
      {showEditContract && activeContract && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <form onSubmit={handleSaveContractEdit} className="w-full max-w-xl rounded-2xl bg-[#13192B] border border-white/15 p-6 space-y-4 my-auto text-xs text-white">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold">{isAr ? `تعديل العقد ${activeContract.internalNumber}` : 'Edit Contract'}</h4>
              <button type="button" onClick={() => setShowEditContract(false)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                placeholder="رقم عقد إيجار"
                value={contractEditForm.ejarNumber}
                onChange={(e) => setContractEditForm({ ...contractEditForm, ejarNumber: e.target.value })}
                className="min-h-[40px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10 font-mono-num"
              />
              <select
                value={contractEditForm.ejarStatus}
                onChange={(e) => setContractEditForm({ ...contractEditForm, ejarStatus: e.target.value as LeaseContract['ejarStatus'] })}
                className="min-h-[40px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10"
              >
                <option value="غير موثق">غير موثق</option>
                <option value="قيد التوثيق">قيد التوثيق</option>
                <option value="موثق في إيجار">موثق في إيجار</option>
                <option value="طلب إنهاء">طلب إنهاء</option>
              </select>
              <select
                value={contractEditForm.occupancyStatus}
                onChange={(e) => setContractEditForm({ ...contractEditForm, occupancyStatus: e.target.value as 'نشط' | 'قيد الإخلاء' | 'مُخلى' })}
                className="min-h-[40px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10"
              >
                <option value="نشط">نشط</option>
                <option value="قيد الإخلاء">قيد الإخلاء</option>
                <option value="مُخلى">مُخلى</option>
              </select>
              <input
                type="number"
                placeholder="رسوم الإلغاء المبكر"
                value={contractEditForm.earlyTerminationFee}
                onChange={(e) => setContractEditForm({ ...contractEditForm, earlyTerminationFee: Number(e.target.value) })}
                className="min-h-[40px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10 font-mono-num"
              />
              <input
                type="number"
                placeholder="عدد المفاتيح المسلمة"
                value={contractEditForm.keysDeliveredCount}
                onChange={(e) => setContractEditForm({ ...contractEditForm, keysDeliveredCount: Number(e.target.value) })}
                className="min-h-[40px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10 font-mono-num"
              />
              <input
                type="number"
                placeholder="عدد أجهزة الريموت"
                value={contractEditForm.remotesDeliveredCount}
                onChange={(e) => setContractEditForm({ ...contractEditForm, remotesDeliveredCount: Number(e.target.value) })}
                className="min-h-[40px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10 font-mono-num"
              />
              <input
                placeholder="الخدمات المشمولة"
                value={contractEditForm.includedServices}
                onChange={(e) => setContractEditForm({ ...contractEditForm, includedServices: e.target.value })}
                className="col-span-2 min-h-[40px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowEditContract(false)} className="px-4 py-2 rounded-xl border border-white/15 cursor-pointer">
                إلغاء
              </button>
              <button type="submit" className="px-5 py-2 rounded-xl bg-[#26478D] text-white font-semibold cursor-pointer">
                حفظ التعديل
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Renew Contract Modal */}
      {showRenewContract && activeContract && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <form onSubmit={handleRenewContract} className="w-full max-w-md rounded-2xl bg-[#13192B] border border-white/15 p-6 space-y-4 text-xs text-white">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold">{isAr ? 'تجديد العقد وإصدار دفعات جديدة' : 'Renew Contract'}</h4>
              <button type="button" onClick={() => setShowRenewContract(false)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-slate-400 block mb-1">تاريخ البداية الجديد</label>
                <input
                  type="date"
                  required
                  value={renewForm.newStartDate}
                  onChange={(e) => setRenewForm({ ...renewForm, newStartDate: e.target.value })}
                  className="w-full min-h-[40px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10 font-mono-num"
                />
              </div>
              <div>
                <label className="text-slate-400 block mb-1">تاريخ الانتهاء الجديد</label>
                <input
                  type="date"
                  required
                  value={renewForm.newEndDate}
                  onChange={(e) => setRenewForm({ ...renewForm, newEndDate: e.target.value })}
                  className="w-full min-h-[40px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10 font-mono-num"
                />
              </div>
              <input
                type="number"
                required
                placeholder="الإيجار السنوي الجديد"
                value={renewForm.annualRent}
                onChange={(e) => setRenewForm({ ...renewForm, annualRent: Number(e.target.value) })}
                className="min-h-[40px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10 font-mono-num"
              />
              <input
                placeholder="رقم عقد إيجار الجديد (اختياري)"
                value={renewForm.ejarNumber}
                onChange={(e) => setRenewForm({ ...renewForm, ejarNumber: e.target.value })}
                className="min-h-[40px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10 font-mono-num"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowRenewContract(false)} className="px-4 py-2 rounded-xl border border-white/15 cursor-pointer">
                إلغاء
              </button>
              <button type="submit" className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-semibold cursor-pointer">
                اعتماد التجديد
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Quick Payment Modal */}
      {showQuickPay && activeContract && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <form onSubmit={handleQuickPay} className="w-full max-w-md rounded-2xl bg-[#13192B] border border-white/15 p-6 space-y-4 text-xs text-white">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold">{isAr ? 'تسجيل دفعة وإصدار سند قبض' : 'Record Payment'}</h4>
              <button type="button" onClick={() => setShowQuickPay(false)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="number"
                required
                min={1}
                placeholder="المبلغ"
                value={payForm.amount}
                onChange={(e) => setPayForm({ ...payForm, amount: Number(e.target.value) })}
                className="min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10 font-mono-num text-sm font-bold"
              />
              <select
                value={payForm.paymentMethod}
                onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value as PaymentMethod })}
                className="min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10"
              >
                <option value="تحويل بنكي">تحويل بنكي</option>
                <option value="شبكة مدى">شبكة مدى</option>
                <option value="نقدي">نقدي</option>
                <option value="شيك">شيك</option>
                <option value="سداد إلكتروني">سداد إلكتروني</option>
              </select>
              <select
                value={payForm.paymentType}
                onChange={(e) => setPayForm({ ...payForm, paymentType: e.target.value as PaymentType })}
                className="min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10"
              >
                <option value="إيجار">إيجار</option>
                <option value="دفعة مقدمة">دفعة مقدمة</option>
                <option value="تأمين">تأمين</option>
                <option value="رسوم مكتب وسعي">رسوم مكتب وسعي</option>
              </select>
              <input
                placeholder="المرجع البنكي"
                value={payForm.referenceNumber}
                onChange={(e) => setPayForm({ ...payForm, referenceNumber: e.target.value })}
                className="min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10 font-mono-num"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowQuickPay(false)} className="px-4 py-2 rounded-xl border border-white/15 cursor-pointer">
                إلغاء
              </button>
              <button type="submit" className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-semibold cursor-pointer">
                اعتماد السند
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New Ticket Modal */}
      {showNewTicket && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <form onSubmit={handleCreateTicket} className="w-full max-w-md rounded-2xl bg-[#13192B] border border-white/15 p-6 space-y-4 text-xs text-white">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold">{isAr ? 'بلاغ صيانة مرتبط بالمستأجر' : 'New Maintenance Ticket'}</h4>
              <button type="button" onClick={() => setShowNewTicket(false)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <select
                value={ticketForm.category}
                onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}
                className="min-h-[40px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10"
              >
                <option value="سباكة">سباكة</option>
                <option value="تكييف">تكييف</option>
                <option value="كهرباء">كهرباء</option>
                <option value="نجارة وأبواب">نجارة وأبواب</option>
                <option value="أخرى">أخرى</option>
              </select>
              <select
                value={ticketForm.priority}
                onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value as TicketPriority })}
                className="min-h-[40px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10"
              >
                <option value="عاجل">عاجل</option>
                <option value="مرتفع">مرتفع</option>
                <option value="متوسط">متوسط</option>
                <option value="منخفض">منخفض</option>
              </select>
              <input
                required
                placeholder="عنوان العطل"
                value={ticketForm.title}
                onChange={(e) => setTicketForm({ ...ticketForm, title: e.target.value })}
                className="col-span-2 min-h-[40px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10"
              />
              <textarea
                rows={2}
                placeholder="التفاصيل..."
                value={ticketForm.description}
                onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
                className="col-span-2 px-3 py-2 rounded-xl bg-[#0A0E1A] border border-white/10"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowNewTicket(false)} className="px-4 py-2 rounded-xl border border-white/15 cursor-pointer">
                إلغاء
              </button>
              <button type="submit" className="px-5 py-2 rounded-xl bg-[#26478D] text-white font-semibold cursor-pointer">
                إصدار البلاغ
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Schedule Appointment Modal */}
      {showAppointmentModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <form onSubmit={handleScheduleAppointment} className="w-full max-w-md rounded-2xl bg-[#13192B] border border-white/15 p-6 space-y-4 text-xs text-white">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold">{isAr ? 'جدولة موعد مع المستأجر' : 'Schedule Appointment'}</h4>
              <button type="button" onClick={() => setShowAppointmentModal(false)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              required
              placeholder="موضوع الموعد (تسليم مفتاح، توقيع تجديد، فحص...)"
              value={apptForm.title}
              onChange={(e) => setApptForm({ ...apptForm, title: e.target.value })}
              className="w-full min-h-[40px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10"
            />
            <input
              type="datetime-local"
              required
              value={apptForm.scheduledAt}
              onChange={(e) => setApptForm({ ...apptForm, scheduledAt: e.target.value })}
              className="w-full min-h-[40px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10 font-mono-num"
            />
            <textarea
              rows={2}
              placeholder="ملاحظات الموعد..."
              value={apptForm.notes}
              onChange={(e) => setApptForm({ ...apptForm, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-[#0A0E1A] border border-white/10"
            />
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={apptForm.createTask}
                onChange={(e) => setApptForm({ ...apptForm, createTask: e.target.checked })}
                className="w-4 h-4 accent-[#26478D]"
              />
              <span>{isAr ? 'إنشاء مهمة متابعة تلقائية في مركز المهام' : 'Create follow-up task'}</span>
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAppointmentModal(false)} className="px-4 py-2 rounded-xl border border-white/15 cursor-pointer">
                إلغاء
              </button>
              <button type="submit" className="px-5 py-2 rounded-xl bg-[#26478D] text-white font-semibold cursor-pointer">
                تثبيت الموعد
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Violation / Behavioral Note Modal */}
      {showAddViolation && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <form onSubmit={handleAddViolation} className="w-full max-w-md rounded-2xl bg-[#13192B] border border-white/15 p-6 space-y-4 text-xs text-white">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold">{isAr ? 'تسجيل ملاحظة أو مخالفة' : 'Add Note / Violation'}</h4>
              <button type="button" onClick={() => setShowAddViolation(false)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <select
              value={violationForm.category}
              onChange={(e) => setViolationForm({ ...violationForm, category: e.target.value as TenantViolationNote['category'] })}
              className="w-full min-h-[40px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10"
            >
              <option value="ملاحظة">ملاحظة</option>
              <option value="مخالفة">مخالفة</option>
              <option value="تأخر سداد">تأخر سداد</option>
              <option value="إشادة">إشادة والتزام</option>
            </select>
            <input
              required
              placeholder="العنوان المختصر"
              value={violationForm.title}
              onChange={(e) => setViolationForm({ ...violationForm, title: e.target.value })}
              className="w-full min-h-[40px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10"
            />
            <textarea
              rows={3}
              required
              placeholder="التفاصيل الموثقة..."
              value={violationForm.details}
              onChange={(e) => setViolationForm({ ...violationForm, details: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-[#0A0E1A] border border-white/10"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddViolation(false)} className="px-4 py-2 rounded-xl border border-white/15 cursor-pointer">
                إلغاء
              </button>
              <button type="submit" className="px-5 py-2 rounded-xl bg-[#26478D] text-white font-semibold cursor-pointer">
                حفظ في السجل
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New Handover / Eviction Inspection with Digital Signature Pad */}
      {showNewHandover && activeContract && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <form onSubmit={handleCreateHandover} className="w-full max-w-2xl rounded-2xl bg-[#13192B] border border-white/15 p-6 space-y-4 my-auto text-xs text-white">
            <div className="flex items-center justify-between">
              <h4 className="text-base font-bold">{isAr ? 'محضر فحص وتسليم / إخلاء وحدة' : 'Unit Handover / Eviction Form'}</h4>
              <button type="button" onClick={() => setShowNewHandover(false)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <select
                value={handoverForm.type}
                onChange={(e) => setHandoverForm({ ...handoverForm, type: e.target.value as HandoverInspection['type'] })}
                className="min-h-[40px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10"
              >
                <option value="استلام عند التأجير">استلام عند التأجير</option>
                <option value="استلام أثناء الإشغال">استلام أثناء الإشغال</option>
                <option value="إخلاء واستلام">إخلاء واستلام</option>
              </select>
              <input
                type="date"
                value={handoverForm.date}
                onChange={(e) => setHandoverForm({ ...handoverForm, date: e.target.value })}
                className="min-h-[40px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10 font-mono-num"
              />
              <input
                type="number"
                min={0}
                placeholder="تكلفة الأضرار (ر.س)"
                value={handoverForm.damageCost}
                onChange={(e) => setHandoverForm({ ...handoverForm, damageCost: Number(e.target.value) })}
                className="min-h-[40px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10 font-mono-num"
              />
              <input
                placeholder="قراءة عداد الكهرباء"
                value={handoverForm.electricityReading}
                onChange={(e) => setHandoverForm({ ...handoverForm, electricityReading: e.target.value })}
                className="min-h-[40px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10 font-mono-num"
              />
              <input
                placeholder="قراءة عداد المياه"
                value={handoverForm.waterReading}
                onChange={(e) => setHandoverForm({ ...handoverForm, waterReading: e.target.value })}
                className="min-h-[40px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10 font-mono-num"
              />
              <input
                type="number"
                min={0}
                placeholder="المفاتيح المستلمة"
                value={handoverForm.keysReturned}
                onChange={(e) => setHandoverForm({ ...handoverForm, keysReturned: Number(e.target.value) })}
                className="min-h-[40px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10 font-mono-num"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              {handoverForm.checklist.map((c, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-[#0A0E1A] border border-white/10 flex items-center justify-between gap-2">
                  <span>{c.item}</span>
                  <select
                    value={c.status}
                    onChange={(e) => {
                      const next = [...handoverForm.checklist];
                      next[idx] = { ...next[idx], status: e.target.value as HandoverChecklistItem['status'] };
                      setHandoverForm({ ...handoverForm, checklist: next });
                    }}
                    className="px-2 py-1 rounded-lg bg-[#13192B] border border-white/10"
                  >
                    <option value="سليم">سليم</option>
                    <option value="يحتاج صيانة">يحتاج صيانة</option>
                    <option value="تالف">تالف</option>
                  </select>
                </div>
              ))}
            </div>

            {/* Settlement Preview */}
            <div className="p-3 rounded-xl bg-white/[0.04] border border-white/10 flex flex-wrap justify-between gap-2 font-mono-num">
              <span>التأمين: {formatSar(activeContract.securityDeposit, lang)}</span>
              <span>المتبقي إيجاراً: {formatSar(tenantOpenBalance, lang)}</span>
              <span className="font-bold text-emerald-300">
                صافي التسوية: {formatSar(activeContract.securityDeposit - handoverForm.damageCost - tenantOpenBalance, lang)}
              </span>
            </div>

            {/* Digital Signature Canvas Pad */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{isAr ? 'التوقيع الرقمي للمستأجر:' : 'Tenant Digital Signature:'}</span>
                <button
                  type="button"
                  onClick={clearSignature}
                  className="inline-flex items-center gap-1 text-slate-400 hover:text-white cursor-pointer"
                >
                  <Eraser className="w-3.5 h-3.5" />
                  <span>{isAr ? 'مسح التوقيع' : 'Clear'}</span>
                </button>
              </div>
              <canvas
                ref={sigCanvasRef}
                width={520}
                height={110}
                onPointerDown={startDraw}
                onPointerMove={moveDraw}
                onPointerUp={endDraw}
                onPointerLeave={endDraw}
                className="w-full h-28 rounded-xl bg-white border border-white/20 touch-none cursor-crosshair"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowNewHandover(false)} className="px-4 py-2 rounded-xl border border-white/15 cursor-pointer">
                إلغاء
              </button>
              <button type="submit" className="px-5 py-2 rounded-xl bg-[#26478D] text-white font-semibold cursor-pointer">
                حفظ المحضر
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Printable Contract View (PDF) */}
      {printContractOpen && activeContract && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-white text-slate-900 p-6 space-y-4 print-only-panel">
            <div className="flex items-center justify-between border-b pb-3 no-print">
              <h4 className="font-bold text-base">نسخة العقد الإيجاري للطباعة — {activeContract.internalNumber}</h4>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-3.5 py-1.5 rounded-lg bg-[#26478D] text-white text-xs font-semibold cursor-pointer"
                >
                  طباعة / PDF
                </button>
                <button type="button" onClick={() => setPrintContractOpen(false)} className="px-3 py-1.5 rounded-lg border text-xs cursor-pointer">
                  إغلاق
                </button>
              </div>
            </div>
            <div className="space-y-3 text-xs">
              <div className="text-lg font-bold text-[#26478D]">{state.settings.nameAr}</div>
              <div>المستأجر: <strong>{tenant.nameAr}</strong> · الهوية: {tenant.nationalIdOrIqama} · الجوال: {tenant.phone}</div>
              <div>العقار والوحدة: {currentProperty?.nameAr} · وحدة {currentUnit?.unitNumber}</div>
              <div>رقم عقد إيجار: {activeContract.ejarNumber || '—'} · المدة: {activeContract.startDate} إلى {activeContract.endDate}</div>
              <div>القيمة السنوية: {formatSar(activeContract.annualRent, 'ar')} · دورة السداد: {activeContract.paymentFrequency}</div>
              <div>التأمين المسترد: {formatSar(activeContract.securityDeposit, 'ar')} · الخدمات: {activeContract.includedServices}</div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {previewReceipt && <ReceiptModal payment={previewReceipt} onClose={() => setPreviewReceipt(null)} />}
    </div>
  );
}
