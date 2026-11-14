import React, { useMemo, useState } from 'react';
import {
  Building2,
  Camera,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  FileSignature,
  Inbox,
  Loader2,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  QrCode,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Star,
  Trash2,
  Upload,
  UserCheck,
  X,
  XCircle,
} from 'lucide-react';
import { useAqar } from '../context/AqarContext';
import {
  Lead,
  LeadApprovalState,
  LeadEscalation,
  LeadEscalationChannel,
  LeadEscalationStatus,
  LeadInteraction,
  PaymentFrequency,
  Tenant,
  TenantTypeKind,
} from '../types/aqar';
import { formatDateTime, formatSar } from '../utils/formatters';
import { triggerHaptic } from '../utils/haptics';
import { buildWhatsAppHref } from '../utils/templateEngine';
import { readFileAsDataUrl, runGeminiOcrExtraction } from '../utils/ocrClient';
import { CameraDocumentScannerModal } from './CameraDocumentScannerModal';
import type { ProcessedScanResult } from '../utils/documentScanProcessor';
import { QrCodeSvg } from './QrCodeSvg';
import { PrintViewButton } from './PrintViewButton';
import {
  PublicProspectViews,
  SmartSummaryCardPreview,
  formatEscalationSummaryText,
} from './PublicProspectViews';

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

function approvalTone(state?: LeadApprovalState): string {
  switch (state) {
    case 'موافق':
      return 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30';
    case 'بانتظار الموافقة':
      return 'bg-sky-500/20 text-sky-300 border-sky-400/30';
    case 'مرفوض':
      return 'bg-red-500/20 text-red-300 border-red-400/30';
    case 'مطلوب تعديلات':
      return 'bg-amber-500/20 text-amber-300 border-amber-400/30';
    default:
      return 'bg-white/10 text-slate-300 border-white/15';
  }
}

export interface LeadCenterPanelProps {
  viewMode?: 'leads' | 'inbox';
  showAddLeadModal: boolean;
  onCloseAddLeadModal: () => void;
  showQrModal: boolean;
  onCloseQrModal: () => void;
  onOpenConvertedTenant?: (tenantId: string) => void;
}

const CHANNEL_OPTIONS: {
  id: LeadEscalationChannel;
  labelAr: string;
  descAr: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'واتساب', labelAr: 'واتساب + رابط', descAr: 'فتح رسالة واتساب جاهزة', icon: MessageCircle },
  { id: 'داخلي', labelAr: 'إرسال داخلي', descAr: 'صندوق الموافقات والإشعارات', icon: Inbox },
  { id: 'بريد إلكتروني', labelAr: 'بريد إلكتروني', descAr: 'إرسال عبر الإيميل', icon: Mail },
  { id: 'SMS', labelAr: 'رسالة SMS', descAr: 'رسالة نصية مختصرة', icon: MessageSquare },
];

export function LeadCenterPanel({
  viewMode = 'leads',
  showAddLeadModal,
  onCloseAddLeadModal,
  showQrModal,
  onCloseQrModal,
  onOpenConvertedTenant,
}: LeadCenterPanelProps) {
  const {
    state,
    currentUser,
    lang,
    mutate,
    pushToast,
    startLeasingWizardForUnit,
  } = useAqar();

  const isAr = lang === 'ar';
  const [search, setSearch] = useState('');
  const [inboxFilter, setInboxFilter] = useState<'all' | 'pending' | 'decided'>('all');

  // Preview Public/External Portals
  const [portalPreview, setPortalPreview] = useState<{
    mode: 'prospect' | 'decision';
    token?: string;
    propertyId?: string;
    unitId?: string;
  } | null>(null);

  // Add Lead Modal state
  const [creatingLead, setCreatingLead] = useState(false);
  const [isLeadOcrBusy, setIsLeadOcrBusy] = useState(false);
  const [showLeadIdCamera, setShowLeadIdCamera] = useState(false);
  const [sendOnRegister, setSendOnRegister] = useState(true);
  const [newLeadForm, setNewLeadForm] = useState({
    nameAr: '',
    phone: '',
    nationalIdOrIqama: '',
    birthDate: '',
    idImageDataUrl: '',
    tenantType: 'فرد' as TenantTypeKind,
    source: 'إدخال يدوي',
    propertyId: '',
    unitId: '',
    offeredRent: 3500,
    paymentFrequency: 'شهري' as PaymentFrequency,
    officeFee: 500,
    earlyTerminationFee: 1000,
    viewingDate: '2026-11-18',
    notes: '',
  });
  const [registerEsc, setRegisterEsc] = useState({
    recipientType: 'owner' as 'owner' | 'internal',
    recipientId: '',
    channel: 'واتساب' as LeadEscalationChannel,
    priority: 'عادي' as 'عادي' | 'عاجل',
  });

  // Escalation Modal ("إرسال بيانات مهتم للمالك أو المسؤول")
  const [escalateLeadTarget, setEscalateLeadTarget] = useState<Lead | null>(null);
  const [escalating, setEscalating] = useState(false);
  const [sentEscalation, setSentEscalation] = useState<LeadEscalation | null>(null);
  const [escForm, setEscForm] = useState({
    recipientType: 'owner' as 'owner' | 'internal',
    recipientId: '',
    channel: 'واتساب' as LeadEscalationChannel,
    priority: 'عادي' as 'عادي' | 'عاجل',
    unitId: '',
    rentAmount: 900,
    paymentFrequency: 'شهري' as PaymentFrequency,
    officeFee: 550,
    earlyTerminationFee: 1000,
    employeeNotes: '',
    idImageDataUrl: '',
  });

  // Lead Detail Drawer
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<'profile' | 'matching' | 'timeline'>('profile');
  const [savingLead, setSavingLead] = useState(false);
  const [convertingLeadId, setConvertingLeadId] = useState<string | null>(null);
  const [leadEditForm, setLeadEditForm] = useState<Partial<Lead>>({});
  const [interactionDraft, setInteractionDraft] = useState<{
    type: LeadInteraction['type'];
    direction: 'inbound' | 'outbound';
    summary: string;
  }>({
    type: 'call',
    direction: 'outbound',
    summary: '',
  });

  // Inbox inline decision state
  const [inboxActionTarget, setInboxActionTarget] = useState<{
    escId: string;
    decision: Exclude<LeadEscalationStatus, 'بانتظار الموافقة'>;
  } | null>(null);
  const [inboxDecisionNote, setInboxDecisionNote] = useState('');
  const [submittingInboxDecision, setSubmittingInboxDecision] = useState(false);

  // Public Link & QR Generator state
  const [qrPropId, setQrPropId] = useState<string>('');
  const [qrUnitId, setQrUnitId] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const escalations = useMemo(() => state?.leadEscalations || [], [state?.leadEscalations]);

  const filteredLeads = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (state?.leads || []).filter((lead) => {
      if (!q) return true;
      const prop = state?.properties.find((p) => p.id === lead.propertyId);
      const unit = state?.units.find((u) => u.id === lead.unitId);
      return (
        lead.nameAr.toLowerCase().includes(q) ||
        lead.phone.toLowerCase().includes(q) ||
        (lead.nationalIdOrIqama || '').toLowerCase().includes(q) ||
        (prop?.nameAr || '').toLowerCase().includes(q) ||
        (unit?.unitNumber || '').toLowerCase().includes(q)
      );
    });
  }, [state?.leads, state?.properties, state?.units, search]);

  const filteredInbox = useMemo(() => {
    return escalations.filter((esc) => {
      if (inboxFilter === 'pending') return esc.status === 'بانتظار الموافقة';
      if (inboxFilter === 'decided') return esc.status !== 'بانتظار الموافقة';
      return true;
    });
  }, [escalations, inboxFilter]);

  const openLead = useMemo(
    () => (openLeadId ? state?.leads.find((l) => l.id === openLeadId) || null : null),
    [openLeadId, state?.leads]
  );

  const unitMatches = useMemo(() => {
    if (!state || !openLead) return [];
    const budget = openLead.budgetMonthly || openLead.offeredRent || 0;
    const desiredRooms = openLead.roomsRequired || 0;
    return state.units
      .filter((u) => u.status === 'شاغرة' || u.id === openLead.unitId)
      .map((u) => {
        const prop = state.properties.find((p) => p.id === u.propertyId);
        let score = 0;
        if (budget > 0 && u.suggestedMonthlyRent > 0) {
          const diffRatio = Math.abs(u.suggestedMonthlyRent - budget) / Math.max(budget, u.suggestedMonthlyRent);
          score += Math.max(0, Math.round(30 * (1 - Math.min(1, diffRatio * 1.4))));
        } else {
          score += 20;
        }
        if (desiredRooms > 0) {
          score += u.rooms >= desiredRooms ? 25 : Math.max(5, 25 - (desiredRooms - u.rooms) * 8);
        } else {
          score += 20;
        }
        if (u.propertyId === openLead.propertyId) score += 20;
        else if (openLead.preferredArea && prop?.district.includes(openLead.preferredArea)) score += 16;
        else score += 8;
        if (openLead.tenantType === 'شركة' && (u.unitType === 'مكتب' || u.unitType === 'معرض تجاري')) score += 15;
        else if (openLead.tenantType !== 'شركة' && (u.unitType === 'شقة' || u.unitType === 'فيلا')) score += 15;
        else score += 9;
        score += u.status === 'شاغرة' ? 10 : 4;
        return { unit: u, prop, score: Math.min(99, score) };
      })
      .sort((a, b) => b.score - a.score);
  }, [state, openLead]);

  if (!state) return null;

  const activeQrPropId = qrPropId || state.properties[0]?.id || '';
  const activeQrUnits = state.units.filter((u) => u.propertyId === activeQrPropId && u.status === 'شاغرة');
  const publicIntakeUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/?prospectForm=1${
    activeQrPropId ? `&propertyId=${encodeURIComponent(activeQrPropId)}` : ''
  }${qrUnitId ? `&unitId=${encodeURIComponent(qrUnitId)}` : ''}`;

  const copyText = (key: string, value: string, toastText: string) => {
    navigator.clipboard?.writeText(value);
    setCopiedKey(key);
    pushToast('success', toastText);
    setTimeout(() => setCopiedKey(null), 2200);
  };

  const openEscalateModalForLead = (lead: Lead) => {
    const unit = state.units.find((u) => u.id === lead.unitId) || state.units[0];
    const prop = state.properties.find((p) => p.id === (unit?.propertyId || lead.propertyId)) || state.properties[0];
    const primaryOwnerId = prop?.ownerShares?.[0]?.ownerId;
    const propOwner = primaryOwnerId ? state.owners.find((o) => o.id === primaryOwnerId) : state.owners[0];
    const defaultInternal =
      state.users.find((u) => u.role === 'supervisor') ||
      state.users.find((u) => u.role === 'gm') ||
      state.users[0];

    setSentEscalation(null);
    setEscalateLeadTarget(lead);
    setEscForm({
      recipientType: propOwner ? 'owner' : 'internal',
      recipientId: propOwner?.id || defaultInternal?.id || '',
      channel: 'واتساب',
      priority: 'عادي',
      unitId: unit?.id || '',
      rentAmount: lead.offeredRent || unit?.suggestedMonthlyRent || 3500,
      paymentFrequency: lead.paymentFrequency || 'شهري',
      officeFee: lead.officeFee ?? unit?.officeFee ?? 500,
      earlyTerminationFee: lead.earlyTerminationFee ?? 1000,
      employeeNotes: lead.notes || '',
      idImageDataUrl: lead.idImageDataUrl || '',
    });
  };

  const openLeadDrawer = (lead: Lead) => {
    setOpenLeadId(lead.id);
    setDrawerTab('profile');
    setLeadEditForm({ ...lead });
  };

  const handleLeadIdOcrFill = async (dataUrl: string, mimeType: string, fileName: string) => {
    setNewLeadForm((prev) => ({ ...prev, idImageDataUrl: dataUrl }));
    setIsLeadOcrBusy(true);
    try {
      const res = await runGeminiOcrExtraction({
        userId: currentUser?.id || 'usr-lease',
        dataUrl,
        mimeType,
        fileName,
        categoryHint: 'هويات',
        autoSync: false,
      });
      const ext = res.extracted;
      setNewLeadForm((prev) => ({
        ...prev,
        idImageDataUrl: dataUrl,
        nameAr: prev.nameAr || ext.tenantNameAr || '',
        nationalIdOrIqama: prev.nationalIdOrIqama || ext.nationalIdOrIqama || '',
        phone: prev.phone || ext.phone || '',
      }));
      if (ext.tenantNameAr || ext.nationalIdOrIqama) {
        pushToast('success', isAr ? 'تم إرفاق صورة الهوية واستخراج البيانات تلقائياً' : 'ID attached & auto-filled');
      } else {
        pushToast('success', isAr ? 'تم إرفاق صورة الهوية / الإقامة' : 'ID image attached');
      }
    } catch {
      pushToast('success', isAr ? 'تم إرفاق صورة الهوية / الإقامة بنجاح' : 'ID image attached');
    } finally {
      setIsLeadOcrBusy(false);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (creatingLead) return;
    setCreatingLead(true);
    triggerHaptic('medium');
    try {
      const unitId = newLeadForm.unitId || state.units.find((u) => u.status === 'شاغرة')?.id || state.units[0]?.id;
      const unit = state.units.find((u) => u.id === unitId);
      const propertyId = newLeadForm.propertyId || unit?.propertyId || state.properties[0]?.id;
      const prop = state.properties.find((p) => p.id === propertyId);

      const res = await mutate<{ lead?: Lead }>(
        'POST',
        '/api/leads',
        {
          ...newLeadForm,
          idImageDataUrl: newLeadForm.idImageDataUrl || undefined,
          unitId,
          propertyId,
          status: 'جديد',
          approvalState: 'لم يُرسل',
          rating: 4,
          assignedTo: currentUser?.id || 'usr-lease',
          createdAt: new Date().toISOString().slice(0, 10),
        },
        { offlineDescAr: `تسجيل مهتم ${newLeadForm.nameAr}` }
      );
      if (res?.lead) {
        const createdLead = res.lead;
        let resolvedEsc: LeadEscalation | null = null;

        if (sendOnRegister) {
          const fallbackOwnerId = prop?.ownerShares?.[0]?.ownerId || state.owners[0]?.id || '';
          const fallbackInternalId =
            state.users.find((u) => u.role === 'supervisor')?.id ||
            state.users.find((u) => u.role === 'gm')?.id ||
            state.users[0]?.id ||
            '';
          const resolvedRecipientId =
            registerEsc.recipientId ||
            (registerEsc.recipientType === 'owner' ? fallbackOwnerId : fallbackInternalId);

          if (resolvedRecipientId) {
            const escRes = await mutate<{ escalation?: LeadEscalation }>(
              'POST',
              `/api/leads/${createdLead.id}/escalate`,
              {
                recipientType: registerEsc.recipientType,
                recipientId: resolvedRecipientId,
                channel: registerEsc.channel,
                priority: registerEsc.priority,
                unitId: createdLead.unitId,
                rentAmount: createdLead.offeredRent,
                paymentFrequency: createdLead.paymentFrequency,
                officeFee: createdLead.officeFee,
                earlyTerminationFee: createdLead.earlyTerminationFee,
                employeeNotes: createdLead.notes,
                idImageDataUrl: createdLead.idImageDataUrl,
                nationalIdOrIqama: createdLead.nationalIdOrIqama,
                birthDate: createdLead.birthDate,
              },
              { offlineDescAr: `إرسال بيانات المهتم ${createdLead.nameAr} للمالك/المسؤول` }
            );
            resolvedEsc = escRes?.escalation || null;
          }
        }

        triggerHaptic('success');
        onCloseAddLeadModal();
        setNewLeadForm((prev) => ({
          ...prev,
          nameAr: '',
          phone: '',
          nationalIdOrIqama: '',
          birthDate: '',
          idImageDataUrl: '',
          notes: '',
        }));

        if (resolvedEsc) {
          setEscalateLeadTarget(createdLead);
          setSentEscalation(resolvedEsc);
          pushToast(
            'success',
            isAr
              ? `تم تسجيل المهتم وإرسال بطاقة المراجعة (${resolvedEsc.requestCode}) إلى ${resolvedEsc.recipientName}`
              : `Lead registered & escalated (${resolvedEsc.requestCode})`
          );
        } else {
          pushToast('success', isAr ? 'تم تسجيل العميل المحتمل بنجاح' : 'Lead created');
        }
      }
    } finally {
      setCreatingLead(false);
    }
  };

  const handleSaveLeadProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openLead || savingLead) return;
    setSavingLead(true);
    try {
      const res = await mutate(
        'PATCH',
        `/api/leads/${openLead.id}`,
        leadEditForm,
        { offlineDescAr: `تحديث ملف المهتم ${openLead.nameAr}` }
      );
      if (res) {
        pushToast('success', isAr ? 'تم حفظ تعديلات ملف المهتم' : 'Lead updated');
      }
    } finally {
      setSavingLead(false);
    }
  };

  const handleLogInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openLead || !interactionDraft.summary.trim()) return;
    const res = await mutate(
      'PATCH',
      `/api/leads/${openLead.id}`,
      { newInteraction: interactionDraft },
      { offlineDescAr: `تسجيل تواصل مع ${openLead.nameAr}` }
    );
    if (res) {
      pushToast('success', isAr ? 'تم توثيق التواصل في سجل المهتم' : 'Interaction logged');
      setInteractionDraft({ type: 'call', direction: 'outbound', summary: '' });
    }
  };

  const handleAssignMatchedUnit = async (unitId: string, propertyId: string, suggestedRent: number) => {
    if (!openLead) return;
    const res = await mutate(
      'PATCH',
      `/api/leads/${openLead.id}`,
      {
        unitId,
        propertyId,
        offeredRent: openLead.offeredRent || suggestedRent,
        newInteraction: {
          type: 'visit',
          direction: 'outbound',
          summary: `تحديث الوحدة المرشحة للمهتم عبر المطابقة الذكية`,
        },
      },
      { offlineDescAr: `ربط المهتم ${openLead.nameAr} بوحدة` }
    );
    if (res) {
      setLeadEditForm((prev) => ({ ...prev, unitId, propertyId }));
      pushToast('success', isAr ? 'تم تعيين الوحدة للمهتم بنجاح' : 'Unit assigned to lead');
    }
  };

  const handleSubmitEscalation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escalateLeadTarget || escalating) return;
    setEscalating(true);
    triggerHaptic('medium');
    try {
      const res = await mutate<{ escalation: LeadEscalation }>(
        'POST',
        `/api/leads/${escalateLeadTarget.id}/escalate`,
        escForm,
        { offlineDescAr: `إرسال بيانات المهتم ${escalateLeadTarget.nameAr} للمالك/المسؤول` }
      );
      if (res?.escalation) {
        triggerHaptic('success');
        setSentEscalation(res.escalation);
        pushToast(
          'success',
          isAr
            ? `تم إنشاء بطاقة المراجعة (${res.escalation.requestCode}) وإرسالها لـ ${res.escalation.recipientName}`
            : `Escalation ${res.escalation.requestCode} sent`
        );
      }
    } finally {
      setEscalating(false);
    }
  };

  const handleInboxDecision = async (
    escId: string,
    decision: Exclude<LeadEscalationStatus, 'بانتظار الموافقة'>,
    notes?: string
  ) => {
    if ((decision === 'مرفوض' || decision === 'أريد تعديلات') && !notes?.trim()) {
      setInboxActionTarget({ escId, decision });
      setInboxDecisionNote('');
      return;
    }
    setSubmittingInboxDecision(true);
    triggerHaptic('medium');
    try {
      const res = await mutate<{ escalation: LeadEscalation }>(
        'POST',
        `/api/lead-escalations/${escId}/decision`,
        { decision, decisionNotes: notes?.trim() || undefined },
        { offlineDescAr: `قرار مراجعة المهتم: ${decision}` }
      );
      if (res?.escalation) {
        triggerHaptic('success');
        pushToast('success', isAr ? `تم اعتماد القرار: ${decision}` : `Decision saved: ${decision}`);
        setInboxActionTarget(null);
        setInboxDecisionNote('');
      }
    } finally {
      setSubmittingInboxDecision(false);
    }
  };

  const handleConvertLead = async (lead: Lead) => {
    if (convertingLeadId) return;
    setConvertingLeadId(lead.id);
    triggerHaptic('medium');
    try {
      const res = await mutate<{ lead: Lead; tenant: Tenant }>(
        'POST',
        `/api/leads/${lead.id}/convert`,
        {},
        { offlineDescAr: `تحويل المهتم ${lead.nameAr} إلى مستأجر` }
      );
      if (res?.tenant) {
        triggerHaptic('success');
        pushToast('success', isAr ? `تم تحويل ${lead.nameAr} إلى ملف مستأجر رسمي` : 'Lead converted to tenant');
        setOpenLeadId(null);
        if (onOpenConvertedTenant) onOpenConvertedTenant(res.tenant.id);
      }
    } finally {
      setConvertingLeadId(null);
    }
  };

  const previewEscObject: LeadEscalation | null = escalateLeadTarget
    ? (() => {
        const unit = state.units.find((u) => u.id === (escForm.unitId || escalateLeadTarget.unitId)) || state.units[0];
        const prop = state.properties.find((p) => p.id === (unit?.propertyId || escalateLeadTarget.propertyId)) || state.properties[0];
        const owner = state.owners.find((o) => o.id === escForm.recipientId);
        const mgr = state.users.find((u) => u.id === escForm.recipientId);
        const company = (prop?.companyId && state.companies?.find((c) => c.id === prop.companyId)) || undefined;
        return {
          id: 'preview',
          requestCode: 'معاينة فورية',
          leadId: escalateLeadTarget.id,
          propertyId: prop?.id || '',
          unitId: unit?.id || '',
          recipientType: escForm.recipientType,
          recipientId: escForm.recipientId,
          recipientName: (escForm.recipientType === 'owner' ? owner?.nameAr : mgr?.nameAr) || 'المستلم',
          recipientPhone: escForm.recipientType === 'owner' ? owner?.phone : mgr?.phone,
          recipientEmail: escForm.recipientType === 'owner' ? owner?.email : mgr?.email,
          channel: escForm.channel,
          status: 'بانتظار الموافقة',
          priority: escForm.priority,
          employeeNotes: escForm.employeeNotes,
          token: 'preview',
          tokenExpiresAt: new Date(Date.now() + 72 * 3600 * 1000).toISOString(),
          snapshot: {
            companyName: company?.nameAr || state.settings.nameAr,
            propertyName: prop?.nameAr || '—',
            unitNumber: unit?.unitNumber || '—',
            leadName: escalateLeadTarget.nameAr,
            nationalIdOrIqama: escalateLeadTarget.nationalIdOrIqama,
            hasIdPhoto: Boolean(escForm.idImageDataUrl || escalateLeadTarget.idImageDataUrl),
            idImageDataUrl: escForm.idImageDataUrl || escalateLeadTarget.idImageDataUrl,
            birthDate: escalateLeadTarget.birthDate,
            phone: escalateLeadTarget.phone,
            rentAmount: escForm.rentAmount,
            paymentFrequency: escForm.paymentFrequency,
            officeFee: escForm.officeFee,
            earlyTerminationFee: escForm.earlyTerminationFee,
            employeeNotes: escForm.employeeNotes,
            registrationDate: (escalateLeadTarget.createdAt || '2026-11-14').slice(0, 10),
            registrationSource: escalateLeadTarget.source,
          },
          createdBy: currentUser?.id || 'usr-lease',
          createdByName: currentUser?.nameAr || 'فريق التأجير',
          createdAt: new Date().toISOString(),
        };
      })()
    : null;

  const sentDecisionUrl = sentEscalation
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/?leadDecision=${encodeURIComponent(sentEscalation.token)}`
    : '';
  const sentSummaryMessage = sentEscalation ? formatEscalationSummaryText(sentEscalation, sentDecisionUrl) : '';

  return (
    <div className="space-y-5">
      {/* CLEAN LEADS GRID (Matches Tenant Cards simplicity & elegance) */}
      {viewMode === 'leads' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 no-print">
            <div className="relative flex-1 min-w-[240px] max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={isAr ? 'بحث بالاسم، الجوال، الهوية، أو الوحدة...' : 'Search leads...'}
                className="w-full min-h-[42px] ps-9 pe-3 py-2 text-xs rounded-xl border border-white/10 bg-white/[0.05] text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#26478D]"
              />
            </div>
            <div className="text-xs text-slate-400">
              {isAr ? `عرض ${filteredLeads.length} عميل محتمل` : `Showing ${filteredLeads.length} leads`}
            </div>
          </div>

          {filteredLeads.length === 0 ? (
            <div className="p-8 rounded-2xl bg-white/[0.03] border border-white/10 text-center text-xs text-slate-400">
              {isAr ? 'لا يوجد عملاء محتملون مطابقون للبحث الحالي.' : 'No matching leads found.'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredLeads.map((lead) => {
                const unit = state.units.find((u) => u.id === lead.unitId);
                const prop = state.properties.find((p) => p.id === lead.propertyId);
                const appState = lead.approvalState && lead.approvalState !== 'لم يُرسل' ? lead.approvalState : lead.status;
                const latestEsc = escalations.find((e) => e.leadId === lead.id);

                return (
                  <div
                    key={lead.id}
                    onClick={() => openLeadDrawer(lead)}
                    className="p-4 rounded-2xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 backdrop-blur-md transition-all space-y-3.5 cursor-pointer"
                  >
                    {/* Header matching Tenant Cards */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${getAvatarTone(
                            lead.nameAr
                          )} flex items-center justify-center text-sm font-bold text-white shrink-0 shadow-md`}
                        >
                          {lead.nameAr.slice(0, 2)}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-bold text-white truncate">{lead.nameAr}</h3>
                          <div className="text-[11px] text-slate-400 font-mono-num truncate">
                            {lead.phone} · {lead.source}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-[11px] font-semibold shrink-0 ${
                          lead.approvalState === 'موافق'
                            ? 'text-emerald-300'
                            : lead.approvalState === 'بانتظار الموافقة'
                            ? 'text-sky-300'
                            : lead.approvalState === 'مرفوض'
                            ? 'text-red-300'
                            : lead.approvalState === 'مطلوب تعديلات'
                            ? 'text-amber-300'
                            : 'text-slate-300'
                        }`}
                      >
                        {appState}
                      </span>
                    </div>

                    {/* Unit & Rent Info Strip */}
                    <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 text-xs flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-slate-300 min-w-0">
                        <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                        <span className="truncate">
                          {prop?.nameAr || '—'} · {unit ? `${unit.unitType} ${unit.unitNumber}` : 'بدون وحدة'}
                        </span>
                      </div>
                      <span className="font-mono-num font-bold text-emerald-400 shrink-0">
                        {formatSar(lead.offeredRent, lang)}
                      </span>
                    </div>

                    {/* Meta Line */}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono-num">
                      <span>
                        معاينة: <strong className="text-slate-200">{lead.viewingDate}</strong>
                        {' · '}
                        <span className={lead.idImageDataUrl ? 'text-emerald-300' : 'text-slate-400'}>
                          {lead.idImageDataUrl ? 'صورة الهوية مرفقة' : 'بدون صورة هوية'}
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-0.5 text-amber-400 font-bold">
                        <Star className="w-3 h-3 fill-amber-400" />
                        {lead.rating ?? 4}
                      </span>
                    </div>

                    {latestEsc?.decisionNotes && (
                      <div className="text-[11px] text-amber-200 bg-amber-500/10 border border-amber-400/20 rounded-xl px-3 py-2 truncate">
                        رد المراجع ({latestEsc.decidedBy}): {latestEsc.decisionNotes}
                      </div>
                    )}

                    {/* Clean Single-Row Quick Actions */}
                    <div
                      className="pt-2.5 border-t border-white/10 flex items-center justify-between gap-2"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`tel:${lead.phone}`}
                          className="min-h-[36px] px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold inline-flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3 text-blue-300" />
                          <span>اتصال</span>
                        </a>
                        <a
                          href={buildWhatsAppHref(lead.phone, `السلام عليكم ${lead.nameAr}`)}
                          target="_blank"
                          rel="noreferrer"
                          className="min-h-[36px] px-2.5 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white text-[11px] font-semibold inline-flex items-center gap-1"
                        >
                          <MessageCircle className="w-3 h-3" />
                          <span>واتساب</span>
                        </a>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEscalateModalForLead(lead)}
                          className="min-h-[36px] px-3 rounded-lg bg-[#26478D] hover:bg-[#1e3a75] text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Send className="w-3 h-3" />
                          <span>إرسال للمالك</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openLeadDrawer(lead)}
                          className="min-h-[36px] px-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>التفاصيل</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* APPROVAL INBOX VIEW */}
      {viewMode === 'inbox' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-300">
              صندوق مراجعة بطاقات المهتمين المرسلة للمالك أو المسؤول
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all', label: 'الكل' },
                  { id: 'pending', label: 'بانتظار الموافقة' },
                  { id: 'decided', label: 'تم البت فيها' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setInboxFilter(f.id)}
                  className={`min-h-[36px] px-3.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                    inboxFilter === f.id
                      ? 'bg-[#26478D] border-blue-400/50 text-white'
                      : 'bg-white/[0.04] border-white/10 text-slate-300 hover:bg-white/10'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {filteredInbox.length === 0 ? (
            <div className="p-8 rounded-2xl border border-white/10 bg-white/[0.03] text-center text-xs text-slate-400">
              لا توجد طلبات مراجعة في هذا التصنيف حالياً.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredInbox.map((esc) => {
                const decisionUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/?leadDecision=${encodeURIComponent(esc.token)}`;
                const isPromptingThis = inboxActionTarget?.escId === esc.id;
                return (
                  <div
                    key={esc.id}
                    className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5 space-y-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex flex-wrap items-center gap-2 text-slate-300">
                        <span className="font-bold text-white">{esc.recipientName}</span>
                        <span>({esc.recipientType === 'owner' ? 'مالك' : 'مسؤول داخلي'})</span>
                        <span>· {esc.channel}</span>
                        <span>· {esc.priority}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => copyText(`link-${esc.id}`, decisionUrl, 'تم نسخ رابط المالك الآمن (صالح 72 ساعة)')}
                          className="min-h-[36px] px-3 rounded-xl bg-white/10 hover:bg-white/15 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          {copiedKey === `link-${esc.id}` ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>نسخ رابط المالك</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPortalPreview({ mode: 'decision', token: esc.token })}
                          className="min-h-[36px] px-3 rounded-xl border border-sky-400/35 bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>معاينة شاشة المالك</span>
                        </button>
                      </div>
                    </div>

                    <SmartSummaryCardPreview esc={esc} compact />

                    {esc.status === 'بانتظار الموافقة' && (
                      <div className="pt-2 space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={submittingInboxDecision}
                            onClick={() => handleInboxDecision(esc.id, 'موافق')}
                            className="min-h-[42px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>✅ موافق</span>
                          </button>
                          <button
                            type="button"
                            disabled={submittingInboxDecision}
                            onClick={() => handleInboxDecision(esc.id, 'أريد تعديلات')}
                            className="min-h-[42px] px-4 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/35 text-amber-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <RefreshCw className="w-4 h-4" />
                            <span>🔄 أريد تعديلات</span>
                          </button>
                          <button
                            type="button"
                            disabled={submittingInboxDecision}
                            onClick={() => handleInboxDecision(esc.id, 'مرفوض')}
                            className="min-h-[42px] px-4 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-400/35 text-red-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>❌ أرفض</span>
                          </button>
                        </div>

                        {isPromptingThis && inboxActionTarget && (
                          <div className="p-3.5 rounded-xl bg-black/30 border border-white/15 space-y-2.5">
                            <label className="block text-xs font-semibold text-white">
                              {inboxActionTarget.decision === 'مرفوض'
                                ? 'سبب الرفض:'
                                : 'التعديلات المطلوبة:'}
                            </label>
                            <textarea
                              rows={2}
                              value={inboxDecisionNote}
                              onChange={(e) => setInboxDecisionNote(e.target.value)}
                              className="w-full p-2.5 rounded-xl border border-white/15 bg-[#0A0E1A] text-xs text-white"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setInboxActionTarget(null)}
                                className="min-h-[36px] px-3 rounded-lg border border-white/15 text-xs cursor-pointer"
                              >
                                إلغاء
                              </button>
                              <button
                                type="button"
                                disabled={!inboxDecisionNote.trim() || submittingInboxDecision}
                                onClick={() =>
                                  handleInboxDecision(esc.id, inboxActionTarget.decision, inboxDecisionNote)
                                }
                                className="min-h-[36px] px-4 rounded-lg bg-[#26478D] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                              >
                                تأكيد القرار
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PUBLIC REGISTRATION LINK & QR MODAL */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-[#13192B] text-white p-6 space-y-4 my-auto text-xs">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2 font-bold text-sm">
                <QrCode className="w-4 h-4 text-blue-400" />
                <span>رابط التسجيل العام ورمز QR للوحدات الشاغرة</span>
              </div>
              <button type="button" onClick={onCloseQrModal} className="cursor-pointer text-slate-300">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">العقار / العمارة</label>
                <select
                  value={activeQrPropId}
                  onChange={(e) => {
                    setQrPropId(e.target.value);
                    setQrUnitId('');
                  }}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A]"
                >
                  {state.properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameAr}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-300 font-semibold mb-1">الوحدة الشاغرة (اختياري)</label>
                <select
                  value={qrUnitId}
                  onChange={(e) => setQrUnitId(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A]"
                >
                  <option value="">كل الوحدات الشاغرة</option>
                  {activeQrUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.unitType} {u.unitNumber}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-white/10 bg-[#0A0E1A] flex flex-col items-center text-center space-y-3">
              <QrCodeSvg value={publicIntakeUrl} size={148} />
              <div className="text-[11px] font-mono-num text-blue-300 break-all" dir="ltr">
                {publicIntakeUrl}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyText('qr-url', publicIntakeUrl, 'تم نسخ رابط تسجيل المهتمين')}
                  className="min-h-[40px] px-4 rounded-xl bg-[#26478D] text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  {copiedKey === 'qr-url' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                  <span>نسخ الرابط</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onCloseQrModal();
                    setPortalPreview({
                      mode: 'prospect',
                      propertyId: activeQrPropId,
                      unitId: qrUnitId || undefined,
                    });
                  }}
                  className="min-h-[40px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>معاينة النموذج العام</span>
                </button>
                <PrintViewButton labelAr="طباعة" />
              </div>
              <button
                type="button"
                onClick={onCloseQrModal}
                className="min-h-[40px] px-4 rounded-xl border border-white/15 cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ESCALATION MODAL: SEND SMART SUMMARY CARD TO OWNER / MANAGER */}
      {escalateLeadTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-2xl border border-white/15 bg-[#111829] text-white p-5 sm:p-6 space-y-5 my-auto">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3.5">
              <div>
                <h3 className="text-base font-bold flex items-center gap-2">
                  <Send className="w-4 h-4 text-blue-400" />
                  <span>إرسال بيانات المهتم للمالك أو المسؤول</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  بطاقة الملخص الذكي (بيانات العقار، المهتم، الإيجار، الدفعة، السعي، ورسوم الإلغاء) مع رابط قرار مباشر.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEscalateLeadTarget(null);
                  setSentEscalation(null);
                }}
                className="p-2 rounded-lg hover:bg-white/10 text-slate-300 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {sentEscalation ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-100 text-xs flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-emerald-300">
                    <CheckCircle2 className="w-5 h-5" />
                    <span>
                      تم إرسال الطلب ({sentEscalation.requestCode}) إلى {sentEscalation.recipientName}
                    </span>
                  </div>
                  <span className="font-mono-num text-[11px]">صلاحية الرابط: 72 ساعة</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-300">نص البطاقة الجاهز للإرسال:</label>
                    <textarea
                      readOnly
                      rows={15}
                      value={sentSummaryMessage}
                      className="w-full p-3 rounded-xl border border-white/15 bg-[#0A0E1A] text-xs text-slate-200 leading-relaxed"
                    />
                  </div>
                  <SmartSummaryCardPreview esc={sentEscalation} compact />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-white/10">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={buildWhatsAppHref(sentEscalation.recipientPhone, sentSummaryMessage)}
                      target="_blank"
                      rel="noreferrer"
                      className="min-h-[42px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-2"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>فتح في واتساب</span>
                    </a>
                    {sentEscalation.recipientEmail && (
                      <a
                        href={`mailto:${encodeURIComponent(sentEscalation.recipientEmail)}?subject=${encodeURIComponent(
                          `طلب مراجعة مهتم جديد ${sentEscalation.requestCode} - ${sentEscalation.snapshot.leadName}`
                        )}&body=${encodeURIComponent(sentSummaryMessage)}`}
                        className="min-h-[42px] px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-2"
                      >
                        <Mail className="w-4 h-4" />
                        <span>إرسال بريد</span>
                      </a>
                    )}
                    {sentEscalation.recipientPhone && (
                      <a
                        href={`sms:${sentEscalation.recipientPhone}?body=${encodeURIComponent(
                          `طلب مراجعة مهتم (${sentEscalation.requestCode}): ${sentEscalation.snapshot.leadName} - ${sentEscalation.snapshot.propertyName} (${sentEscalation.snapshot.unitNumber}) - ${sentEscalation.snapshot.rentAmount} ر.س | للموافقة: ${sentDecisionUrl}`
                        )}`}
                        className="min-h-[42px] px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold inline-flex items-center gap-2"
                      >
                        <MessageSquare className="w-4 h-4" />
                        <span>إرسال SMS</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => copyText('sent-msg', sentSummaryMessage, 'تم نسخ نص البطاقة والرابط')}
                      className="min-h-[42px] px-4 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
                    >
                      <Copy className="w-4 h-4" />
                      <span>نسخ البطاقة</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPortalPreview({ mode: 'decision', token: sentEscalation.token })}
                      className="min-h-[42px] px-4 rounded-xl border border-sky-400/35 bg-sky-500/15 hover:bg-sky-500/25 text-sky-200 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>معاينة رابط المالك</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEscalateLeadTarget(null);
                      setSentEscalation(null);
                    }}
                    className="min-h-[42px] px-5 rounded-xl border border-white/15 text-xs font-semibold cursor-pointer"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmitEscalation} className="space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                  <div className="lg:col-span-6 space-y-4 text-xs">
                    <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03] space-y-3">
                      <div className="font-bold text-blue-300">1. المستلم والقناة</div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const unit = state.units.find((u) => u.id === escForm.unitId);
                            const prop = state.properties.find((p) => p.id === (unit?.propertyId || escalateLeadTarget.propertyId));
                            const primaryOwnerId = prop?.ownerShares?.[0]?.ownerId;
                            const owner = primaryOwnerId ? state.owners.find((o) => o.id === primaryOwnerId) : state.owners[0];
                            setEscForm({
                              ...escForm,
                              recipientType: 'owner',
                              recipientId: owner?.id || state.owners[0]?.id || '',
                            });
                          }}
                          className={`min-h-[40px] px-3 rounded-xl font-semibold border cursor-pointer ${
                            escForm.recipientType === 'owner'
                              ? 'bg-[#26478D] border-blue-400 text-white'
                              : 'bg-[#0A0E1A] border-white/10 text-slate-300'
                          }`}
                        >
                          مالك العقار
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const mgr =
                              state.users.find((u) => u.role === 'supervisor') ||
                              state.users.find((u) => u.role === 'gm') ||
                              state.users[0];
                            setEscForm({
                              ...escForm,
                              recipientType: 'internal',
                              recipientId: mgr?.id || '',
                              channel: 'داخلي',
                            });
                          }}
                          className={`min-h-[40px] px-3 rounded-xl font-semibold border cursor-pointer ${
                            escForm.recipientType === 'internal'
                              ? 'bg-[#26478D] border-blue-400 text-white'
                              : 'bg-[#0A0E1A] border-white/10 text-slate-300'
                          }`}
                        >
                          مسؤول داخلي
                        </button>
                      </div>

                      <select
                        required
                        value={escForm.recipientId}
                        onChange={(e) => setEscForm({ ...escForm, recipientId: e.target.value })}
                        className="w-full min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] text-white"
                      >
                        {escForm.recipientType === 'owner'
                          ? state.owners.map((o) => (
                              <option key={o.id} value={o.id}>
                                المالك: {o.nameAr} ({o.phone})
                              </option>
                            ))
                          : state.users.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.nameAr} — {u.roleLabelAr}
                              </option>
                            ))}
                      </select>

                      <div>
                        <div className="text-[11px] text-slate-400 mb-1.5">طريقة الإرسال:</div>
                        <div className="grid grid-cols-2 gap-2">
                          {CHANNEL_OPTIONS.map((ch) => {
                            const Icon = ch.icon;
                            const active = escForm.channel === ch.id;
                            return (
                              <button
                                key={ch.id}
                                type="button"
                                onClick={() => setEscForm({ ...escForm, channel: ch.id })}
                                className={`min-h-[40px] px-3 py-2 rounded-xl border text-start flex items-center gap-2 cursor-pointer transition-colors ${
                                  active
                                    ? 'bg-[#26478D] border-blue-400 text-white'
                                    : 'bg-[#0A0E1A] border-white/10 text-slate-300 hover:bg-white/[0.06]'
                                }`}
                              >
                                <Icon className="w-3.5 h-3.5 shrink-0" />
                                <span className="font-semibold truncate">{ch.labelAr}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <select
                          value={escForm.priority}
                          onChange={(e) => setEscForm({ ...escForm, priority: e.target.value as 'عادي' | 'عاجل' })}
                          className="w-full min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] text-white"
                        >
                          <option value="عادي">أولوية: عادي</option>
                          <option value="عاجل">أولوية: عاجل</option>
                        </select>
                        <label className="min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] hover:bg-white/10 text-white font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer">
                          <Upload className="w-3.5 h-3.5 text-emerald-300" />
                          <span>{escForm.idImageDataUrl ? 'تحديث صورة الهوية' : 'إرفاق صورة الهوية'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              const dataUrl = await readFileAsDataUrl(f);
                              setEscForm((prev) => ({ ...prev, idImageDataUrl: dataUrl }));
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03] space-y-3">
                      <div className="font-bold text-amber-300">2. تفاصيل الإيجار والرسوم</div>
                      <div className="grid grid-cols-2 gap-3">
                        <select
                          value={escForm.unitId}
                          onChange={(e) => {
                            const u = state.units.find((un) => un.id === e.target.value);
                            setEscForm({
                              ...escForm,
                              unitId: e.target.value,
                              rentAmount: u?.suggestedMonthlyRent || escForm.rentAmount,
                              officeFee: u?.officeFee ?? escForm.officeFee,
                            });
                          }}
                          className="col-span-2 w-full min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A]"
                        >
                          {state.units.map((u) => {
                            const p = state.properties.find((pr) => pr.id === u.propertyId);
                            return (
                              <option key={u.id} value={u.id}>
                                {p?.nameAr} — {u.unitType} {u.unitNumber}
                              </option>
                            );
                          })}
                        </select>
                        <div>
                          <label className="block text-slate-400 mb-1">الإيجار (ر.س)</label>
                          <input
                            type="number"
                            required
                            min={100}
                            value={escForm.rentAmount}
                            onChange={(e) => setEscForm({ ...escForm, rentAmount: Number(e.target.value) })}
                            className="w-full min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] font-mono-num"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1">نوع الدفعة</label>
                          <select
                            value={escForm.paymentFrequency}
                            onChange={(e) => setEscForm({ ...escForm, paymentFrequency: e.target.value as PaymentFrequency })}
                            className="w-full min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A]"
                          >
                            <option value="شهري">شهري</option>
                            <option value="ربع سنوي">ربع سنوي</option>
                            <option value="نصف سنوي">نصف سنوي</option>
                            <option value="سنوي">سنوي</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1">رسوم المكتب (السعي)</label>
                          <input
                            type="number"
                            min={0}
                            value={escForm.officeFee}
                            onChange={(e) => setEscForm({ ...escForm, officeFee: Number(e.target.value) })}
                            className="w-full min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] font-mono-num"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1">رسوم إلغاء العقد</label>
                          <input
                            type="number"
                            min={0}
                            value={escForm.earlyTerminationFee}
                            onChange={(e) => setEscForm({ ...escForm, earlyTerminationFee: Number(e.target.value) })}
                            className="w-full min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] font-mono-num"
                          />
                        </div>
                      </div>
                      <textarea
                        rows={2}
                        placeholder="ملاحظات الموظف (اختياري)..."
                        value={escForm.employeeNotes}
                        onChange={(e) => setEscForm({ ...escForm, employeeNotes: e.target.value })}
                        className="w-full p-2.5 rounded-xl border border-white/15 bg-[#0A0E1A]"
                      />
                    </div>
                  </div>

                  <div className="lg:col-span-6 space-y-2">
                    <div className="text-xs font-bold text-slate-300">معاينة البطاقة:</div>
                    {previewEscObject && <SmartSummaryCardPreview esc={previewEscObject} compact />}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => setEscalateLeadTarget(null)}
                    className="min-h-[42px] px-4 rounded-xl border border-white/15 text-xs cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={escalating || !escForm.recipientId}
                    className="min-h-[42px] px-6 rounded-xl bg-[#26478D] hover:bg-[#1e3a75] text-white text-xs font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>{escalating ? 'جاري الإرسال...' : 'إرسال للمالك/المسؤول'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* LEAD DETAIL DRAWER (Profile, Smart Unit Matching, Timeline, Convert) */}
      {openLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-2xl border border-white/15 bg-[#111829] text-white p-5 sm:p-6 space-y-4 my-auto">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
              <div>
                <h3 className="text-base font-bold">{openLead.nameAr}</h3>
                <div className="text-xs text-slate-400 font-mono-num">
                  {openLead.phone} · {openLead.source} · {openLead.approvalState || 'لم يُرسل'}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOpenLeadId(null);
                    openEscalateModalForLead(openLead);
                  }}
                  className="min-h-[36px] px-3 rounded-lg bg-[#26478D] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>إرسال للمالك/المسؤول</span>
                </button>
                {!openLead.convertedToTenantId ? (
                  <button
                    type="button"
                    disabled={convertingLeadId === openLead.id}
                    onClick={() => handleConvertLead(openLead)}
                    className="min-h-[36px] px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    <span>تحويل لمستأجر</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setOpenLeadId(null);
                      if (openLead.unitId) startLeasingWizardForUnit(openLead.unitId);
                      else if (onOpenConvertedTenant && openLead.convertedToTenantId) {
                        onOpenConvertedTenant(openLead.convertedToTenantId);
                      }
                    }}
                    className="min-h-[36px] px-3 rounded-lg bg-blue-600 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  >
                    <FileSignature className="w-3.5 h-3.5" />
                    <span>إصدار العقد</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setOpenLeadId(null)}
                  className="p-2 rounded-lg hover:bg-white/10 text-slate-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 p-1 rounded-xl bg-white/[0.04] border border-white/10">
              {(
                [
                  { id: 'profile', label: 'البيانات الشخصية والمالية' },
                  { id: 'matching', label: `الوحدات المقترحة (${unitMatches.length})` },
                  { id: 'timeline', label: `سجل التواصل (${(openLead.interactions || []).length})` },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDrawerTab(t.id)}
                  className={`min-h-[36px] px-3.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    drawerTab === t.id ? 'bg-[#26478D] text-white' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {drawerTab === 'profile' && (
              <form onSubmit={handleSaveLeadProfile} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">الاسم الكامل</label>
                    <input
                      required
                      value={leadEditForm.nameAr || ''}
                      onChange={(e) => setLeadEditForm({ ...leadEditForm, nameAr: e.target.value })}
                      className="w-full min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A]"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">رقم الجوال</label>
                    <input
                      required
                      value={leadEditForm.phone || ''}
                      onChange={(e) => setLeadEditForm({ ...leadEditForm, phone: e.target.value })}
                      className="w-full min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] font-mono-num"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">رقم الهوية / الإقامة</label>
                    <input
                      value={leadEditForm.nationalIdOrIqama || ''}
                      onChange={(e) => setLeadEditForm({ ...leadEditForm, nationalIdOrIqama: e.target.value })}
                      className="w-full min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] font-mono-num"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">تاريخ الميلاد</label>
                    <input
                      type="date"
                      value={leadEditForm.birthDate || ''}
                      onChange={(e) => setLeadEditForm({ ...leadEditForm, birthDate: e.target.value })}
                      className="w-full min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] font-mono-num"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">الإيجار المقترح (ر.س)</label>
                    <input
                      type="number"
                      value={leadEditForm.offeredRent ?? 0}
                      onChange={(e) => setLeadEditForm({ ...leadEditForm, offeredRent: Number(e.target.value) })}
                      className="w-full min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] font-mono-num"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">نوع الدفعة</label>
                    <select
                      value={leadEditForm.paymentFrequency || 'شهري'}
                      onChange={(e) => setLeadEditForm({ ...leadEditForm, paymentFrequency: e.target.value as PaymentFrequency })}
                      className="w-full min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A]"
                    >
                      <option value="شهري">شهري</option>
                      <option value="ربع سنوي">ربع سنوي</option>
                      <option value="نصف سنوي">نصف سنوي</option>
                      <option value="سنوي">سنوي</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">رسوم المكتب / السعي</label>
                    <input
                      type="number"
                      value={leadEditForm.officeFee ?? 0}
                      onChange={(e) => setLeadEditForm({ ...leadEditForm, officeFee: Number(e.target.value) })}
                      className="w-full min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] font-mono-num"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">رسوم إلغاء العقد</label>
                    <input
                      type="number"
                      value={leadEditForm.earlyTerminationFee ?? 1000}
                      onChange={(e) => setLeadEditForm({ ...leadEditForm, earlyTerminationFee: Number(e.target.value) })}
                      className="w-full min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] font-mono-num"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl border border-white/10 bg-white/[0.03] flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-white">صورة الهوية المرفقة</div>
                    <div className="text-[11px] text-slate-400">
                      {leadEditForm.idImageDataUrl ? '✓ مرفقة وستظهر للمالك عند الإرسال' : 'اختياري'}
                    </div>
                  </div>
                  <label className="min-h-[36px] px-3 rounded-lg bg-white/10 hover:bg-white/15 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{leadEditForm.idImageDataUrl ? 'تغيير الصورة' : 'إرفاق صورة الهوية'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const dataUrl = await readFileAsDataUrl(f);
                        setLeadEditForm((prev) => ({ ...prev, idImageDataUrl: dataUrl }));
                      }}
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">ملاحظات الموظف</label>
                  <textarea
                    rows={2}
                    value={leadEditForm.notes || ''}
                    onChange={(e) => setLeadEditForm({ ...leadEditForm, notes: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-white/15 bg-[#0A0E1A]"
                  />
                </div>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingLead}
                    className="min-h-[40px] px-5 rounded-xl bg-[#26478D] text-white font-bold cursor-pointer disabled:opacity-50"
                  >
                    {savingLead ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                  </button>
                </div>
              </form>
            )}

            {drawerTab === 'matching' && (
              <div className="space-y-3 text-xs max-h-[360px] overflow-y-auto pe-1">
                {unitMatches.map(({ unit, prop, score }) => {
                  const isAssigned = openLead.unitId === unit.id;
                  return (
                    <div
                      key={unit.id}
                      className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-3 ${
                        isAssigned ? 'border-emerald-400/50 bg-emerald-500/10' : 'border-white/10 bg-white/[0.03]'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-white flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-blue-400" />
                          <span>
                            {prop?.nameAr} — {unit.unitType} {unit.unitNumber}
                          </span>
                          <span className="font-mono-num text-emerald-300 font-bold">{score}% توافق</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 font-mono-num">
                          {unit.rooms} غرف · {unit.areaSqm} م² · {formatSar(unit.suggestedMonthlyRent, lang)}
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isAssigned}
                        onClick={() => handleAssignMatchedUnit(unit.id, unit.propertyId, unit.suggestedMonthlyRent)}
                        className="min-h-[36px] px-3.5 rounded-lg bg-[#26478D] text-white font-semibold disabled:opacity-50 cursor-pointer"
                      >
                        {isAssigned ? '✓ معيّنة حالياً' : 'تعيين للمهتم'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {drawerTab === 'timeline' && (
              <div className="space-y-4 text-xs">
                <form onSubmit={handleLogInteraction} className="flex flex-wrap gap-2">
                  <select
                    value={interactionDraft.type}
                    onChange={(e) => setInteractionDraft({ ...interactionDraft, type: e.target.value as LeadInteraction['type'] })}
                    className="min-h-[38px] px-3 rounded-lg border border-white/15 bg-[#0A0E1A]"
                  >
                    <option value="call">مكالمة</option>
                    <option value="whatsapp">واتساب</option>
                    <option value="visit">معاينة</option>
                    <option value="email">بريد</option>
                  </select>
                  <input
                    required
                    placeholder="ملخص التواصل..."
                    value={interactionDraft.summary}
                    onChange={(e) => setInteractionDraft({ ...interactionDraft, summary: e.target.value })}
                    className="flex-1 min-w-[200px] min-h-[38px] px-3 rounded-lg border border-white/15 bg-[#0A0E1A]"
                  />
                  <button type="submit" className="min-h-[38px] px-4 rounded-lg bg-[#26478D] text-white font-semibold cursor-pointer">
                    توثيق
                  </button>
                </form>

                <div className="space-y-2 max-h-[260px] overflow-y-auto pe-1">
                  {(openLead.interactions || []).map((item) => (
                    <div key={item.id} className="p-3 rounded-xl border border-white/10 bg-black/25 space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-400">
                        <span className="font-semibold text-blue-300">
                          {item.type} · {item.actorName}
                        </span>
                        <span className="font-mono-num">{formatDateTime(item.createdAt, lang)}</span>
                      </div>
                      <div className="text-slate-200">{item.summary}</div>
                    </div>
                  ))}
                  {(!openLead.interactions || openLead.interactions.length === 0) && (
                    <div className="text-center text-slate-400 py-4">لا توجد تفاعلات مسجلة بعد.</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* UPGRADED ADD NEW LEAD & DIRECT ESCALATION MODAL */}
      {showAddLeadModal && (() => {
        const selectedPropId =
          newLeadForm.propertyId ||
          state.units.find((u) => u.id === newLeadForm.unitId)?.propertyId ||
          state.properties[0]?.id ||
          '';
        const availableUnits = state.units.filter((u) => u.propertyId === selectedPropId);
        const selectedProp = state.properties.find((p) => p.id === selectedPropId);
        const defaultOwnerId = selectedProp?.ownerShares?.[0]?.ownerId || state.owners[0]?.id || '';
        const defaultInternalId =
          state.users.find((u) => u.role === 'supervisor')?.id ||
          state.users.find((u) => u.role === 'gm')?.id ||
          state.users[0]?.id ||
          '';
        const effectiveRecipientId =
          registerEsc.recipientId ||
          (registerEsc.recipientType === 'owner' ? defaultOwnerId : defaultInternalId);

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
            <form
              onSubmit={handleCreateLead}
              className="w-full max-w-4xl rounded-2xl border border-white/15 bg-[#111829] text-white p-5 sm:p-6 space-y-5 my-auto text-xs"
            >
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3.5">
                <div>
                  <h3 className="text-base font-bold">تسجيل مهتم جديد</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    إدخال بيانات المهتم وإرفاق صورة الهوية أو الإقامة مع إمكانية الإرسال الفوري للمالك أو المسؤول.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onCloseAddLeadModal}
                  className="p-2 rounded-lg hover:bg-white/10 text-slate-300 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Column 1: Property/Unit, Personal Data, ID Photo */}
                <div className="lg:col-span-6 space-y-4">
                  <div className="font-bold text-blue-300 border-b border-white/10 pb-2">
                    1. بيانات العقار والمهتم الشخصية
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">العقار / العمارة</label>
                      <select
                        value={selectedPropId}
                        onChange={(e) => {
                          const pid = e.target.value;
                          const prop = state.properties.find((p) => p.id === pid);
                          const firstUnit =
                            state.units.find((u) => u.propertyId === pid && u.status === 'شاغرة') ||
                            state.units.find((u) => u.propertyId === pid);
                          const propOwnerId = prop?.ownerShares?.[0]?.ownerId || state.owners[0]?.id || '';
                          setNewLeadForm((prev) => ({
                            ...prev,
                            propertyId: pid,
                            unitId: firstUnit?.id || '',
                            offeredRent: firstUnit?.suggestedMonthlyRent || prev.offeredRent,
                            officeFee: firstUnit?.officeFee ?? prev.officeFee,
                          }));
                          if (registerEsc.recipientType === 'owner') {
                            setRegisterEsc((prev) => ({ ...prev, recipientId: propOwnerId }));
                          }
                        }}
                        className="w-full min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A]"
                      >
                        {state.properties.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nameAr}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">الشقة / الوحدة</label>
                      <select
                        value={newLeadForm.unitId || availableUnits[0]?.id || ''}
                        onChange={(e) => {
                          const u = state.units.find((un) => un.id === e.target.value);
                          setNewLeadForm((prev) => ({
                            ...prev,
                            unitId: e.target.value,
                            propertyId: u?.propertyId || prev.propertyId,
                            offeredRent: u?.suggestedMonthlyRent || prev.offeredRent,
                            officeFee: u?.officeFee ?? prev.officeFee,
                          }));
                        }}
                        className="w-full min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A]"
                      >
                        {(availableUnits.length > 0 ? availableUnits : state.units).map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.unitType} {u.unitNumber} ({u.status})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-slate-400 mb-1">الاسم الكامل للمهتم *</label>
                      <input
                        required
                        placeholder="مثال: محمد أحمد العلي"
                        value={newLeadForm.nameAr}
                        onChange={(e) => setNewLeadForm({ ...newLeadForm, nameAr: e.target.value })}
                        className="w-full min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A]"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">رقم الجوال *</label>
                      <input
                        required
                        type="tel"
                        inputMode="tel"
                        placeholder="05XXXXXXXX"
                        value={newLeadForm.phone}
                        onChange={(e) => setNewLeadForm({ ...newLeadForm, phone: e.target.value })}
                        className="w-full min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] font-mono-num"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">رقم الهوية / الإقامة</label>
                      <input
                        placeholder="10XXXXXXXX / 20XXXXXXXX"
                        value={newLeadForm.nationalIdOrIqama}
                        onChange={(e) => setNewLeadForm({ ...newLeadForm, nationalIdOrIqama: e.target.value })}
                        className="w-full min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] font-mono-num"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">تاريخ الميلاد</label>
                      <input
                        type="date"
                        value={newLeadForm.birthDate}
                        onChange={(e) => setNewLeadForm({ ...newLeadForm, birthDate: e.target.value })}
                        className="w-full min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] font-mono-num"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">صفة المستأجر ومصدر التسجيل</label>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          value={newLeadForm.tenantType}
                          onChange={(e) => setNewLeadForm({ ...newLeadForm, tenantType: e.target.value as TenantTypeKind })}
                          className="min-h-[40px] px-2 rounded-xl border border-white/15 bg-[#0A0E1A]"
                        >
                          <option value="فرد">فرد</option>
                          <option value="عائلة">عائلة</option>
                          <option value="شركة">شركة</option>
                        </select>
                        <select
                          value={newLeadForm.source}
                          onChange={(e) => setNewLeadForm({ ...newLeadForm, source: e.target.value })}
                          className="min-h-[40px] px-2 rounded-xl border border-white/15 bg-[#0A0E1A]"
                        >
                          <option value="إدخال يدوي">إدخال يدوي</option>
                          <option value="زيارة مكتب">زيارة مكتب</option>
                          <option value="اتصال هاتفي">اتصال هاتفي</option>
                          <option value="منصة عقار">منصة عقار</option>
                          <option value="واتساب">واتساب</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* ID / Iqama Image Attachment + Camera + OCR */}
                  <div className="pt-3 border-t border-white/10 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-emerald-300">2. صورة الهوية أو الإقامة</div>
                        <div className="text-[11px] text-slate-400">
                          {newLeadForm.idImageDataUrl
                            ? '✓ مرفقة وستُرسل ضمن بطاقة المهتم للمالك/المسؤول'
                            : 'ارفق صورة الهوية أو التقطها بالكاميرا لإرسالها مع الطلب'}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setShowLeadIdCamera(true)}
                          className="min-h-[36px] px-3 rounded-lg bg-white/10 hover:bg-white/15 font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                        >
                          <Camera className="w-3.5 h-3.5 text-sky-300" />
                          <span>كاميرا</span>
                        </button>
                        <label className="min-h-[36px] px-3 rounded-lg bg-emerald-600/80 hover:bg-emerald-600 text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer">
                          {isLeadOcrBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                          <span>{newLeadForm.idImageDataUrl ? 'تغيير الصورة' : 'رفع صورة الهوية'}</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              const dataUrl = await readFileAsDataUrl(f);
                              await handleLeadIdOcrFill(dataUrl, f.type || 'image/jpeg', f.name);
                            }}
                          />
                        </label>
                      </div>
                    </div>

                    {newLeadForm.idImageDataUrl && (
                      <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-black/30 border border-white/10">
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={newLeadForm.idImageDataUrl}
                            alt="معاينة صورة الهوية"
                            className="h-14 w-24 rounded-lg object-contain bg-black/40 border border-white/10 shrink-0"
                          />
                          <div className="text-[11px] text-slate-300">
                            <div className="font-semibold text-white">صورة الهوية جاهزة للإرسال</div>
                            {isLeadOcrBusy ? (
                              <span className="text-sky-300 inline-flex items-center gap-1 mt-0.5">
                                <Sparkles className="w-3 h-3" /> جاري قراءة البيانات...
                              </span>
                            ) : (
                              <span className="text-emerald-300">ستظهر مباشرة في بطاقة المالك/المسؤول</span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setNewLeadForm((prev) => ({ ...prev, idImageDataUrl: '' }))}
                          className="min-h-[34px] px-2.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-300 inline-flex items-center gap-1 cursor-pointer shrink-0"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Column 2: Financial Terms + Direct Escalation (Channel + Owner/Manager) */}
                <div className="lg:col-span-6 space-y-4 lg:border-s lg:border-white/10 lg:ps-6">
                  <div className="font-bold text-amber-300 border-b border-white/10 pb-2">
                    3. البيانات المالية وملاحظات الموظف
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">الإيجار المطلوب (ر.س)</label>
                      <input
                        type="number"
                        min={100}
                        value={newLeadForm.offeredRent}
                        onChange={(e) => setNewLeadForm({ ...newLeadForm, offeredRent: Number(e.target.value) })}
                        className="w-full min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] font-mono-num"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">نوع الدفعة</label>
                      <select
                        value={newLeadForm.paymentFrequency}
                        onChange={(e) => setNewLeadForm({ ...newLeadForm, paymentFrequency: e.target.value as PaymentFrequency })}
                        className="w-full min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A]"
                      >
                        <option value="شهري">شهري</option>
                        <option value="ربع سنوي">ربع سنوي</option>
                        <option value="نصف سنوي">نصف سنوي</option>
                        <option value="سنوي">سنوي</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">رسوم المكتب / السعي (ر.س)</label>
                      <input
                        type="number"
                        min={0}
                        value={newLeadForm.officeFee}
                        onChange={(e) => setNewLeadForm({ ...newLeadForm, officeFee: Number(e.target.value) })}
                        className="w-full min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] font-mono-num"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">رسوم إلغاء العقد (ر.س)</label>
                      <input
                        type="number"
                        min={0}
                        value={newLeadForm.earlyTerminationFee}
                        onChange={(e) => setNewLeadForm({ ...newLeadForm, earlyTerminationFee: Number(e.target.value) })}
                        className="w-full min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] font-mono-num"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">موعد المعاينة</label>
                      <input
                        type="date"
                        value={newLeadForm.viewingDate}
                        onChange={(e) => setNewLeadForm({ ...newLeadForm, viewingDate: e.target.value })}
                        className="w-full min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] font-mono-num"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">ملاحظات الموظف</label>
                      <input
                        placeholder="رأي الموظف أو شروط إضافية..."
                        value={newLeadForm.notes}
                        onChange={(e) => setNewLeadForm({ ...newLeadForm, notes: e.target.value })}
                        className="w-full min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A]"
                      />
                    </div>
                  </div>

                  {/* Direct Escalation Toggle + Recipient & Channel Picker */}
                  <div className="pt-3 border-t border-white/10 space-y-3">
                    <label className="flex items-center justify-between gap-3 cursor-pointer">
                      <div>
                        <div className="font-bold text-white">4. إرسال للمالك أو المسؤول مباشرة بعد التسجيل</div>
                        <div className="text-[11px] text-slate-400">
                          اختر المالك أو المسؤول وطريقة الإرسال لإصدار بطاقة المراجعة فوراً
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={sendOnRegister}
                        onChange={(e) => setSendOnRegister(e.target.checked)}
                        className="w-4 h-4 accent-[#26478D] cursor-pointer"
                      />
                    </label>

                    {sendOnRegister && (
                      <div className="space-y-3 pt-1">
                        {/* Recipient Type Toggle */}
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setRegisterEsc((prev) => ({
                                ...prev,
                                recipientType: 'owner',
                                recipientId: defaultOwnerId,
                              }))
                            }
                            className={`min-h-[38px] px-3 rounded-xl font-semibold border cursor-pointer ${
                              registerEsc.recipientType === 'owner'
                                ? 'bg-[#26478D] border-blue-400 text-white'
                                : 'bg-[#0A0E1A] border-white/10 text-slate-300'
                            }`}
                          >
                            مالك العقار
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setRegisterEsc((prev) => ({
                                ...prev,
                                recipientType: 'internal',
                                recipientId: defaultInternalId,
                              }))
                            }
                            className={`min-h-[38px] px-3 rounded-xl font-semibold border cursor-pointer ${
                              registerEsc.recipientType === 'internal'
                                ? 'bg-[#26478D] border-blue-400 text-white'
                                : 'bg-[#0A0E1A] border-white/10 text-slate-300'
                            }`}
                          >
                            مسؤول داخلي
                          </button>
                        </div>

                        {/* Recipient Dropdown + Priority */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <select
                            required={sendOnRegister}
                            value={effectiveRecipientId}
                            onChange={(e) => setRegisterEsc({ ...registerEsc, recipientId: e.target.value })}
                            className="sm:col-span-2 min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] text-white"
                          >
                            {registerEsc.recipientType === 'owner'
                              ? state.owners.map((o) => (
                                  <option key={o.id} value={o.id}>
                                    المالك: {o.nameAr} ({o.phone})
                                  </option>
                                ))
                              : state.users.map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.nameAr} — {u.roleLabelAr}
                                  </option>
                                ))}
                          </select>

                          <select
                            value={registerEsc.priority}
                            onChange={(e) =>
                              setRegisterEsc({ ...registerEsc, priority: e.target.value as 'عادي' | 'عاجل' })
                            }
                            className="min-h-[40px] px-3 rounded-xl border border-white/15 bg-[#0A0E1A] text-white"
                          >
                            <option value="عادي">أولوية: عادي</option>
                            <option value="عاجل">أولوية: عاجل</option>
                          </select>
                        </div>

                        {/* Channel Buttons */}
                        <div>
                          <div className="text-[11px] text-slate-400 mb-1.5">اختيار طريقة الإرسال:</div>
                          <div className="grid grid-cols-2 gap-2">
                            {CHANNEL_OPTIONS.map((ch) => {
                              const Icon = ch.icon;
                              const active = registerEsc.channel === ch.id;
                              return (
                                <button
                                  key={ch.id}
                                  type="button"
                                  onClick={() => setRegisterEsc({ ...registerEsc, channel: ch.id })}
                                  className={`min-h-[40px] px-3 py-2 rounded-xl border text-start flex items-center gap-2 cursor-pointer transition-colors ${
                                    active
                                      ? 'bg-[#26478D] border-blue-400 text-white'
                                      : 'bg-[#0A0E1A] border-white/10 text-slate-300 hover:bg-white/[0.06]'
                                  }`}
                                >
                                  <Icon className="w-3.5 h-3.5 shrink-0" />
                                  <span className="font-semibold truncate">{ch.labelAr}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={onCloseAddLeadModal}
                  className="min-h-[42px] px-4 rounded-xl border border-white/15 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={creatingLead}
                  className="min-h-[42px] px-6 rounded-xl bg-[#26478D] hover:bg-[#1e3a75] text-white font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {sendOnRegister && <Send className="w-4 h-4" />}
                  <span>
                    {creatingLead
                      ? 'جاري الحفظ والإرسال...'
                      : sendOnRegister
                      ? 'حفظ وإرسال للمالك/المسؤول الآن'
                      : 'حفظ بيانات المهتم'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        );
      })()}

      <CameraDocumentScannerModal
        open={showLeadIdCamera}
        lang={lang}
        onClose={() => setShowLeadIdCamera(false)}
        onComplete={async (scan: ProcessedScanResult) => {
          setShowLeadIdCamera(false);
          await handleLeadIdOcrFill(scan.dataUrl, scan.mimeType, `lead-id-${Date.now()}.jpg`);
        }}
      />

      {/* IN-APP FULLSCREEN PREVIEW MODAL FOR PUBLIC PROSPECT FORM OR EXTERNAL OWNER PORTAL */}
      {portalPreview && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#070B14]">
          <PublicProspectViews
            mode={portalPreview.mode}
            token={portalPreview.token}
            propertyId={portalPreview.propertyId}
            unitId={portalPreview.unitId}
            onExitPreview={() => setPortalPreview(null)}
          />
        </div>
      )}
    </div>
  );
}
