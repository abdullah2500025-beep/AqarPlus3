import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  Building2,
  Calendar,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  FileSignature,
  Filter,
  KeyRound,
  MessageCircle,
  Phone,
  RefreshCw,
  Send,
  UserCheck,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';
import { useAqar } from '../context/AqarContext';
import { Installment, LeaseContract, PaymentMethod, TaskItem, TicketPriority } from '../types/aqar';
import { formatSar, formatDisplayDate } from '../utils/formatters';
import { triggerHaptic } from '../utils/haptics';

type DailyHubTab = 'tasks' | 'payments' | 'contracts';

interface UnifiedDailyTask {
  id: string;
  source: 'task' | 'auto_rent_today' | 'auto_rent_overdue' | 'auto_viewing' | 'auto_handover' | 'auto_ticket' | 'auto_contract';
  sourceId: string;
  targetTime: string;
  dueDate: string;
  typeLabelAr: string;
  typeLabelEn: string;
  badgeColor: 'amber' | 'orange' | 'blue' | 'emerald' | 'red' | 'purple';
  title: string;
  location: string;
  propertyId?: string;
  unitId?: string;
  tenantId?: string;
  tenantName?: string;
  phone?: string;
  assigneeId?: string;
  assigneeName: string;
  priority: 'عاجل' | 'عادي' | 'منخفض';
  completed: boolean;
  overdue: boolean;
  notes?: string;
}

const REFERENCE_TODAY = '2026-11-14';

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso.slice(0, 10) + 'T00:00:00Z').getTime();
  const b = new Date(toIso.slice(0, 10) + 'T00:00:00Z').getTime();
  return Math.round((b - a) / 86400000);
}

export function DailyTasksAlertsView() {
  const { state, currentUser, lang, mutate, pushToast, setActiveNav } = useAqar();
  const isAr = lang === 'ar';

  const [tab, setTab] = useState<DailyHubTab>('tasks');
  const [completedAutoIds, setCompletedAutoIds] = useState<string[]>([]);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [rescheduleTarget, setRescheduleTarget] = useState<{ task: UnifiedDailyTask; date: string } | null>(null);
  const [delegateTarget, setDelegateTarget] = useState<{ task: UnifiedDailyTask; staffId: string } | null>(null);

  // Payment alerts filters & quick payment modal
  const [payFilterProperty, setPayFilterProperty] = useState('all');
  const [payFilterTenant, setPayFilterTenant] = useState('');
  const [payFilterAmount, setPayFilterAmount] = useState<'all' | 'lt1000' | '1000_5000' | 'gt5000'>('all');
  const [payFilterFollowUp, setPayFilterFollowUp] = useState<'all' | 'contacted' | 'uncontacted'>('all');
  const [quickPayInst, setQuickPayInst] = useState<Installment | null>(null);
  const [quickPayMethod, setQuickPayMethod] = useState<PaymentMethod>('تحويل بنكي');
  const [quickPayRef, setQuickPayRef] = useState('');
  const [quickPayAmount, setQuickPayAmount] = useState(0);

  // Contract alerts filters
  const [contractFilterProperty, setContractFilterProperty] = useState('all');
  const [contractFilterTenantType, setContractFilterTenantType] = useState<'all' | 'فرد' | 'عائلة' | 'شركة'>('all');
  const [contractFilterStatus, setContractFilterStatus] = useState<'all' | 'نشط' | 'منتهي' | 'معلق'>('all');

  const todayIso = useMemo(() => {
    const nowIso = new Date().toISOString().slice(0, 10);
    // Keep aligned with seeded data reference window if needed
    return nowIso >= REFERENCE_TODAY ? nowIso : REFERENCE_TODAY;
  }, []);

  const contactedTenantIds = useMemo(() => {
    if (!state) return new Set<string>();
    return new Set(
      state.communications
        .filter((c) => c.targetType === 'مستأجر')
        .map((c) => c.targetId)
    );
  }, [state]);

  // 1. Unified Today's Tasks (Real Tasks + Smart Auto-Derived Daily Action Items)
  const unifiedTasks = useMemo<UnifiedDailyTask[]>(() => {
    if (!state) return [];
    const list: UnifiedDailyTask[] = [];

    for (const t of state.tasks) {
      const prop = state.properties.find((p) => p.id === t.propertyId);
      const unit = state.units.find((u) => u.id === t.unitId);
      const tenant = unit?.linkedTenantId ? state.tenants.find((x) => x.id === unit.linkedTenantId) : undefined;
      const assignee = state.users.find((u) => u.id === t.assignedTo);
      const isUrgent = t.priority === 'عاجل' || t.priority === 'مرتفع';
      const isDone = t.status === 'مكتملة';
      const isOverdue = !isDone && t.dueDate.slice(0, 10) < todayIso;
      list.push({
        id: `task-${t.id}`,
        source: 'task',
        sourceId: t.id,
        targetTime: '10:00 ص',
        dueDate: t.dueDate.slice(0, 10),
        typeLabelAr: t.type,
        typeLabelEn: t.type,
        badgeColor: t.type.includes('صيانة') ? 'red' : t.type.includes('تسليم') ? 'emerald' : 'blue',
        title: t.title,
        location: `${prop?.nameAr || 'إدارة عامة'}${unit ? ` · ${unit.unitNumber}` : ''}`,
        propertyId: t.propertyId,
        unitId: t.unitId,
        tenantId: tenant?.id,
        tenantName: tenant?.nameAr,
        phone: tenant?.phone || assignee?.phone,
        assigneeId: t.assignedTo,
        assigneeName: assignee?.nameAr || 'غير مسند',
        priority: isUrgent ? 'عاجل' : t.priority === 'منخفض' ? 'منخفض' : 'عادي',
        completed: isDone,
        overdue: isOverdue,
        notes: t.description,
      });
    }

    // Auto Rent Due Today & Overdue > 3 days
    for (const inst of state.installments) {
      if (inst.status === 'ملغاة' || inst.status === 'مدفوعة بالكامل' || inst.remainingAmount <= 0) continue;
      const prop = state.properties.find((p) => p.id === inst.propertyId);
      const unit = state.units.find((u) => u.id === inst.unitId);
      const tenant = state.tenants.find((x) => x.id === inst.tenantId);
      const diff = daysBetween(inst.dueDate, todayIso); // positive => overdue
      if (inst.dueDate.slice(0, 10) === todayIso || inst.status === 'مستحقة اليوم') {
        const autoId = `auto-rent-today-${inst.id}`;
        list.push({
          id: autoId,
          source: 'auto_rent_today',
          sourceId: inst.id,
          targetTime: '09:30 ص',
          dueDate: inst.dueDate,
          typeLabelAr: 'تحصيل إيجار',
          typeLabelEn: 'Rent Due',
          badgeColor: 'amber',
          title: `تحصيل قسط مستحق اليوم — ${tenant?.nameAr || ''} (${formatSar(inst.remainingAmount, lang)})`,
          location: `${prop?.nameAr || ''} · ${unit?.unitNumber || ''}`,
          propertyId: inst.propertyId,
          unitId: inst.unitId,
          tenantId: inst.tenantId,
          tenantName: tenant?.nameAr,
          phone: tenant?.phone,
          assigneeName: state.users.find((u) => u.role === 'accountant')?.nameAr || 'المحاسب',
          priority: 'عاجل',
          completed: completedAutoIds.includes(autoId),
          overdue: false,
        });
      } else if (diff >= 3 || inst.status === 'متأخرة') {
        const autoId = `auto-rent-over-${inst.id}`;
        list.push({
          id: autoId,
          source: 'auto_rent_overdue',
          sourceId: inst.id,
          targetTime: '11:00 ص',
          dueDate: inst.dueDate,
          typeLabelAr: 'متابعة متأخر',
          typeLabelEn: 'Overdue Follow-up',
          badgeColor: 'orange',
          title: `متابعة قسط متأخر (${Math.max(1, diff)} يوم) — ${tenant?.nameAr || ''}`,
          location: `${prop?.nameAr || ''} · ${unit?.unitNumber || ''}`,
          propertyId: inst.propertyId,
          unitId: inst.unitId,
          tenantId: inst.tenantId,
          tenantName: tenant?.nameAr,
          phone: tenant?.phone,
          assigneeName: state.users.find((u) => u.role === 'leasing')?.nameAr || 'التأجير',
          priority: 'عاجل',
          completed: completedAutoIds.includes(autoId),
          overdue: true,
        });
      }
    }

    // Auto Scheduled Viewings from Leads
    for (const lead of state.leads) {
      if (lead.status === 'ملغي' || lead.status === 'تحويل لعقد') continue;
      const prop = state.properties.find((p) => p.id === lead.propertyId);
      const unit = state.units.find((u) => u.id === lead.unitId);
      const autoId = `auto-lead-${lead.id}`;
      list.push({
        id: autoId,
        source: 'auto_viewing',
        sourceId: lead.id,
        targetTime: '01:30 م',
        dueDate: lead.viewingDate || todayIso,
        typeLabelAr: 'معاينة وحدة',
        typeLabelEn: 'Unit Viewing',
        badgeColor: 'blue',
        title: `معاينة وحدة مع المهتم: ${lead.nameAr}`,
        location: `${prop?.nameAr || ''} · ${unit?.unitNumber || ''}`,
        propertyId: lead.propertyId,
        unitId: lead.unitId,
        tenantName: lead.nameAr,
        phone: lead.phone,
        assigneeId: lead.assignedTo,
        assigneeName: state.users.find((u) => u.id === lead.assignedTo)?.nameAr || 'موظف التأجير',
        priority: 'عادي',
        completed: completedAutoIds.includes(autoId),
        overdue: false,
      });
    }

    // Auto Urgent Maintenance Tickets
    for (const tkt of state.tickets) {
      if (tkt.status === 'مغلق' || tkt.status === 'مكتمل') continue;
      if (tkt.priority !== 'عاجل' && tkt.priority !== 'مرتفع') continue;
      const prop = state.properties.find((p) => p.id === tkt.propertyId);
      const unit = state.units.find((u) => u.id === tkt.unitId);
      const autoId = `auto-tkt-${tkt.id}`;
      list.push({
        id: autoId,
        source: 'auto_ticket',
        sourceId: tkt.id,
        targetTime: '12:00 م',
        dueDate: tkt.createdAt.slice(0, 10),
        typeLabelAr: 'بلاغ صيانة عاجل',
        typeLabelEn: 'Urgent Maintenance',
        badgeColor: 'red',
        title: `${tkt.ticketNumber} · ${tkt.title}`,
        location: `${prop?.nameAr || ''} · ${unit?.unitNumber || ''}`,
        propertyId: tkt.propertyId,
        unitId: tkt.unitId,
        assigneeId: tkt.assignedTo,
        assigneeName: state.users.find((u) => u.id === tkt.assignedTo)?.nameAr || 'الفني',
        priority: 'عاجل',
        completed: completedAutoIds.includes(autoId),
        overdue: false,
      });
    }

    // Auto Contracts Expiring <= 7 days or Awaiting Handover
    for (const c of state.contracts) {
      const prop = state.properties.find((p) => p.id === c.propertyId);
      const unit = state.units.find((u) => u.id === c.unitId);
      const tenant = state.tenants.find((t) => t.id === c.tenantId);
      const daysLeft = daysBetween(todayIso, c.endDate);
      if ((c.lifecycleStatus === 'نشط' || c.lifecycleStatus === 'بانتظار التجديد') && daysLeft <= 7 && daysLeft >= -5) {
        const autoId = `auto-cnt-${c.id}`;
        list.push({
          id: autoId,
          source: 'auto_contract',
          sourceId: c.id,
          targetTime: '03:00 م',
          dueDate: c.endDate,
          typeLabelAr: 'تجديد عقد',
          typeLabelEn: 'Contract Renewal',
          badgeColor: 'purple',
          title: `متابعة تجديد العقد ${c.internalNumber} (${daysLeft <= 0 ? 'منتهي' : `متبقي ${daysLeft} يوم`})`,
          location: `${prop?.nameAr || ''} · ${unit?.unitNumber || ''}`,
          propertyId: c.propertyId,
          unitId: c.unitId,
          tenantId: c.tenantId,
          tenantName: tenant?.nameAr,
          phone: tenant?.phone,
          assigneeName: state.users.find((u) => u.role === 'leasing')?.nameAr || 'التأجير',
          priority: 'عاجل',
          completed: completedAutoIds.includes(autoId),
          overdue: daysLeft < 0,
        });
      }
      if (unit?.status === 'بانتظار الاستلام') {
        const autoId = `auto-handover-${c.id}`;
        list.push({
          id: autoId,
          source: 'auto_handover',
          sourceId: c.id,
          targetTime: '04:00 م',
          dueDate: c.startDate,
          typeLabelAr: 'تسليم مفاتيح',
          typeLabelEn: 'Key Handover',
          badgeColor: 'emerald',
          title: `تسليم مفاتيح الوحدة للمستأجر ${tenant?.nameAr || ''}`,
          location: `${prop?.nameAr || ''} · ${unit.unitNumber}`,
          propertyId: c.propertyId,
          unitId: c.unitId,
          tenantId: c.tenantId,
          tenantName: tenant?.nameAr,
          phone: tenant?.phone,
          assigneeName: state.users.find((u) => u.role === 'supervisor')?.nameAr || 'المشرف',
          priority: 'عادي',
          completed: completedAutoIds.includes(autoId),
          overdue: false,
        });
      }
    }

    return list;
  }, [state, todayIso, completedAutoIds, lang]);

  // 2. Payment Alerts Data
  const paymentAlertsData = useMemo(() => {
    if (!state) return { dueToday: [], overdue: [], upcoming: [], totalAmount: 0, avgDelay: 0 };
    const open = state.installments.filter((i) => i.status !== 'ملغاة' && i.status !== 'مدفوعة بالكامل' && i.remainingAmount > 0);
    const filtered = open.filter((inst) => {
      if (payFilterProperty !== 'all' && inst.propertyId !== payFilterProperty) return false;
      const tenant = state.tenants.find((t) => t.id === inst.tenantId);
      if (payFilterTenant.trim()) {
        const q = payFilterTenant.trim().toLowerCase();
        if (!(tenant?.nameAr.toLowerCase().includes(q) || tenant?.phone.includes(q))) return false;
      }
      if (payFilterAmount === 'lt1000' && inst.remainingAmount >= 1000) return false;
      if (payFilterAmount === '1000_5000' && (inst.remainingAmount < 1000 || inst.remainingAmount > 5000)) return false;
      if (payFilterAmount === 'gt5000' && inst.remainingAmount <= 5000) return false;
      const contacted = contactedTenantIds.has(inst.tenantId);
      if (payFilterFollowUp === 'contacted' && !contacted) return false;
      if (payFilterFollowUp === 'uncontacted' && contacted) return false;
      return true;
    });

    const dueToday: { inst: Installment; delayDays: number }[] = [];
    const overdue: { inst: Installment; delayDays: number }[] = [];
    const upcoming: { inst: Installment; daysUntil: number }[] = [];

    for (const inst of filtered) {
      const diff = daysBetween(inst.dueDate, todayIso); // > 0 means overdue
      if (diff === 0 || inst.status === 'مستحقة اليوم') {
        dueToday.push({ inst, delayDays: 0 });
      } else if (diff > 0 || inst.status === 'متأخرة' || inst.status === 'مدفوعة جزئياً') {
        overdue.push({ inst, delayDays: Math.max(1, diff) });
      } else if (diff < 0 && Math.abs(diff) <= 14) {
        upcoming.push({ inst, daysUntil: Math.abs(diff) });
      }
    }

    overdue.sort((a, b) => b.delayDays - a.delayDays);
    upcoming.sort((a, b) => a.daysUntil - b.daysUntil);

    const totalAmount = [...dueToday, ...overdue].reduce((s, x) => s + x.inst.remainingAmount, 0);
    const avgDelay = overdue.length > 0 ? Math.round(overdue.reduce((s, x) => s + x.delayDays, 0) / overdue.length) : 0;

    return { dueToday, overdue, upcoming, totalAmount, avgDelay };
  }, [state, todayIso, payFilterProperty, payFilterTenant, payFilterAmount, payFilterFollowUp, contactedTenantIds]);

  // 3. Contract Alerts Data
  const contractAlertsData = useMemo(() => {
    if (!state) return { expiringSoon: [], expiredNotRenewed: [], pendingActivation: [], awaitingEvictionCount: 0 };

    const filteredContracts = state.contracts.filter((c) => {
      if (contractFilterProperty !== 'all' && c.propertyId !== contractFilterProperty) return false;
      const tenant = state.tenants.find((t) => t.id === c.tenantId);
      if (contractFilterTenantType !== 'all' && (tenant?.tenantType || 'فرد') !== contractFilterTenantType) return false;
      if (contractFilterStatus === 'نشط' && c.lifecycleStatus !== 'نشط' && c.lifecycleStatus !== 'بانتظار التجديد') return false;
      if (contractFilterStatus === 'منتهي' && c.lifecycleStatus !== 'منتهي') return false;
      if (contractFilterStatus === 'معلق' && c.lifecycleStatus !== 'مسودة' && c.lifecycleStatus !== 'بانتظار الاعتماد' && c.lifecycleStatus !== 'بانتظار التوثيق') return false;
      return true;
    });

    const expiringSoon: { contract: LeaseContract; daysLeft: number }[] = [];
    const expiredNotRenewed: { contract: LeaseContract; overdueDays: number }[] = [];
    const pendingActivation: LeaseContract[] = [];

    for (const c of filteredContracts) {
      const daysLeft = daysBetween(todayIso, c.endDate);
      if (c.lifecycleStatus === 'مسودة' || c.lifecycleStatus === 'بانتظار الاعتماد' || c.lifecycleStatus === 'بانتظار التوثيق') {
        pendingActivation.push(c);
      } else if (c.lifecycleStatus === 'منتهي' || (c.lifecycleStatus === 'نشط' && daysLeft < 0)) {
        expiredNotRenewed.push({ contract: c, overdueDays: Math.max(1, -daysLeft) });
      } else if ((c.lifecycleStatus === 'نشط' || c.lifecycleStatus === 'بانتظار التجديد') && daysLeft <= 45) {
        expiringSoon.push({ contract: c, daysLeft });
      }
    }

    expiringSoon.sort((a, b) => a.daysLeft - b.daysLeft);
    expiredNotRenewed.sort((a, b) => b.overdueDays - a.overdueDays);
    const awaitingEvictionCount = state.contracts.filter((c) => c.occupancyStatus === 'قيد الإخلاء' || c.ejarStatus === 'طلب إنهاء').length;

    return { expiringSoon, expiredNotRenewed, pendingActivation, awaitingEvictionCount };
  }, [state, todayIso, contractFilterProperty, contractFilterTenantType, contractFilterStatus]);

  if (!state || !currentUser) return null;

  const urgentCount = unifiedTasks.filter((t) => t.priority === 'عاجل' && !t.completed).length;
  const completedCount = unifiedTasks.filter((t) => t.completed).length;
  const overdueTasksCount = unifiedTasks.filter((t) => t.overdue && !t.completed).length;

  const handleToggleTaskComplete = async (task: UnifiedDailyTask) => {
    triggerHaptic('success');
    if (task.source === 'task') {
      const nextStatus = task.completed ? 'قيد التنفيذ' : 'مكتملة';
      const res = await mutate('PATCH', `/api/tasks/${task.sourceId}`, { status: nextStatus });
      if (res) {
        pushToast('success', nextStatus === 'مكتملة' ? 'تم إنجاز المهمة بنجاح ✓' : 'تمت إعادة فتح المهمة');
      }
    } else {
      setCompletedAutoIds((prev) =>
        prev.includes(task.id) ? prev.filter((x) => x !== task.id) : [...prev, task.id]
      );
      pushToast('success', task.completed ? 'تمت إعادة فتح المهمة اليومية' : 'تم إنجاز بند المتابعة اليومي ✓');
    }
  };

  const handleSaveTaskNote = async (task: UnifiedDailyTask) => {
    const note = (noteDrafts[task.id] || '').trim();
    if (!note) return;
    triggerHaptic('light');
    if (task.source === 'task') {
      const res = await mutate('PATCH', `/api/tasks/${task.sourceId}`, { commentText: note });
      if (res) {
        pushToast('success', 'تمت إضافة الملاحظة إلى سجل المهمة');
        setNoteDrafts((prev) => ({ ...prev, [task.id]: '' }));
      }
    } else {
      await mutate('POST', '/api/communications', {
        targetType: task.tenantId ? 'مستأجر' : 'موظف',
        targetId: task.tenantId || currentUser.id,
        targetName: task.tenantName || task.assigneeName,
        channel: 'مكالمة',
        summary: note,
        relatedEntityId: task.sourceId,
      });
      pushToast('success', 'تم حفظ الملاحظة السريعة في السجل');
      setNoteDrafts((prev) => ({ ...prev, [task.id]: '' }));
    }
  };

  const handleRescheduleSave = async () => {
    if (!rescheduleTarget) return;
    triggerHaptic('medium');
    if (rescheduleTarget.task.source === 'task') {
      await mutate('PATCH', `/api/tasks/${rescheduleTarget.task.sourceId}`, {
        commentText: `تمت إعادة جدولة الموعد إلى ${rescheduleTarget.date}`,
      });
    } else {
      await mutate('POST', '/api/tasks', {
        title: `مجدولة: ${rescheduleTarget.task.title}`,
        description: `إعادة جدولة من مركز مهام اليوم إلى ${rescheduleTarget.date}`,
        type: rescheduleTarget.task.typeLabelAr,
        propertyId: rescheduleTarget.task.propertyId,
        unitId: rescheduleTarget.task.unitId,
        assignedTo: currentUser.id,
        dueDate: rescheduleTarget.date,
        priority: 'متوسط' as TicketPriority,
        status: 'مسندة',
        checklist: [{ text: 'تنفيذ المتابعة المجدولة', done: false }],
      });
    }
    pushToast('success', `تمت إعادة جدولة المهمة إلى ${rescheduleTarget.date}`);
    setRescheduleTarget(null);
  };

  const handleDelegateSave = async () => {
    if (!delegateTarget) return;
    triggerHaptic('medium');
    if (delegateTarget.task.source === 'task') {
      await mutate('POST', `/api/tasks/${delegateTarget.task.sourceId}/reassign`, {
        assignedTo: delegateTarget.staffId,
        reason: 'تفويض من مركز مهام اليوم',
      });
    } else {
      await mutate('POST', '/api/tasks', {
        title: delegateTarget.task.title,
        description: `مهمة مفوضة من ${currentUser.nameAr}`,
        type: delegateTarget.task.typeLabelAr,
        propertyId: delegateTarget.task.propertyId,
        unitId: delegateTarget.task.unitId,
        assignedTo: delegateTarget.staffId,
        dueDate: delegateTarget.task.dueDate,
        priority: delegateTarget.task.priority === 'عاجل' ? 'مرتفع' : 'متوسط',
        status: 'مسندة',
        checklist: [{ text: 'تنفيذ المهمة المفوضة', done: false }],
      });
    }
    pushToast('success', 'تم تفويض المهمة للموظف بنجاح');
    setDelegateTarget(null);
  };

  const handleSendWhatsAppReminder = async (
    tenantId: string,
    tenantName: string,
    phone: string | undefined,
    messageText: string,
    relatedId?: string
  ) => {
    triggerHaptic('light');
    await mutate('POST', '/api/communications', {
      targetType: 'مستأجر',
      targetId: tenantId,
      targetName: tenantName,
      channel: 'واتساب',
      summary: messageText,
      relatedEntityId: relatedId,
    });
    const cleanPhone = (phone || '').replace(/\D/g, '');
    if (cleanPhone) {
      const intl = cleanPhone.startsWith('05') ? `966${cleanPhone.slice(1)}` : cleanPhone;
      const a = document.createElement('a');
      a.href = `https://wa.me/${intl}?text=${encodeURIComponent(messageText)}`;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.click();
    }
    pushToast('success', `تم توثيق وإرسال تنبيه واتساب إلى ${tenantName}`);
  };

  const handleQuickPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPayInst || quickPayAmount <= 0) return;
    triggerHaptic('success');
    const res = await mutate(
      'POST',
      '/api/payments',
      {
        contractId: quickPayInst.contractId,
        amount: quickPayAmount,
        paymentMethod: quickPayMethod,
        paymentType: 'إيجار',
        referenceNumber: quickPayRef || undefined,
        autoAllocateOldest: true,
        notes: 'تحصيل سريع من مركز تنبيهات الدفعات',
      },
      { offlineDescAr: `تحصيل سريع ${quickPayAmount} ر.س` }
    );
    if (res) {
      pushToast('success', 'تم تسجيل الدفعة وإصدار سند القبض والقيد المحاسبي بنجاح');
      setQuickPayInst(null);
    }
  };

  const handleContractAction = async (
    contract: LeaseContract,
    action: 'activate' | 'renew' | 'evict' | 'cancel'
  ) => {
    triggerHaptic('medium');
    if (action === 'activate') {
      await mutate('PATCH', `/api/contracts/${contract.id}`, { lifecycleStatus: 'نشط' });
      pushToast('success', `تم تفعيل العقد ${contract.internalNumber}`);
    } else if (action === 'evict') {
      await mutate('PATCH', `/api/contracts/${contract.id}`, { occupancyStatus: 'قيد الإخلاء' });
      pushToast('info', `تم بدء إجراءات الإخلاء للعقد ${contract.internalNumber}`);
    } else if (action === 'cancel') {
      await mutate('PATCH', `/api/contracts/${contract.id}`, { lifecycleStatus: 'ملغي' });
      pushToast('info', `تم إلغاء العقد ${contract.internalNumber}`);
    } else if (action === 'renew') {
      await mutate('PATCH', `/api/contracts/${contract.id}`, { lifecycleStatus: 'بانتظار التجديد' });
      setActiveNav('leasing');
      pushToast('info', `تم تحويل العقد ${contract.internalNumber} لمسار التجديد في شاشة العقود`);
    }
  };

  const badgeStyle = (color: UnifiedDailyTask['badgeColor']) => {
    switch (color) {
      case 'red':
        return 'bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30';
      case 'orange':
        return 'bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/30';
      case 'amber':
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30';
      case 'emerald':
        return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30';
      case 'purple':
        return 'bg-purple-500/15 text-purple-600 dark:text-purple-300 border-purple-500/30';
      default:
        return 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="p-5 rounded-3xl border border-slate-200 dark:border-white/10 bg-white dark:bg-gradient-to-br dark:from-[#0A0E1A] dark:to-[#1A1F2E] shadow-sm space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#26478D] text-white flex items-center justify-center shadow-lg">
              <CalendarCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                {isAr ? 'مهام اليوم والتنبيهات — مركز القيادة اليومي' : "Daily Tasks & Alerts Command Center"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAr
                  ? 'كل مهام التحصيل والمعاينة والصيانة وتنبيهات الدفعات والعقود في شاشة موحدة واحدة.'
                  : 'All today actions, overdue rent follow-ups, and contract expirations in one place.'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 no-print">
            <span className="text-xs font-mono-num px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300">
              {todayIso}
            </span>
          </div>
        </div>

        {/* Horizontal Scrollable 3 Main Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-print">
          {(
            [
              {
                id: 'tasks',
                labelAr: `مهام اليوم (${unifiedTasks.length})`,
                labelEn: `Today's Tasks (${unifiedTasks.length})`,
                icon: CheckCircle2,
              },
              {
                id: 'payments',
                labelAr: `تنبيهات الدفعات (${paymentAlertsData.dueToday.length + paymentAlertsData.overdue.length})`,
                labelEn: `Payment Alerts (${paymentAlertsData.dueToday.length + paymentAlertsData.overdue.length})`,
                icon: Wallet,
              },
              {
                id: 'contracts',
                labelAr: `تنبيهات العقود (${contractAlertsData.expiringSoon.length + contractAlertsData.expiredNotRenewed.length})`,
                labelEn: `Contract Alerts (${contractAlertsData.expiringSoon.length + contractAlertsData.expiredNotRenewed.length})`,
                icon: FileSignature,
              },
            ] as const
          ).map((item) => {
            const Icon = item.icon;
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setTab(item.id);
                }}
                className={`shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#26478D] text-white shadow-md'
                    : 'bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{isAr ? item.labelAr : item.labelEn}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TAB 1: TODAY'S TASKS */}
      {tab === 'tasks' && (
        <div className="space-y-5">
          {/* 4 Quick Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface">
              <div className="text-[11px] text-slate-500">إجمالي المهام اليوم</div>
              <div className="text-2xl font-bold font-mono-num mt-1">{unifiedTasks.length}</div>
            </div>
            <div className="p-4 rounded-2xl border border-red-200 dark:border-red-500/25 bg-red-500/5">
              <div className="text-[11px] text-red-600 dark:text-red-400">المهام العاجلة</div>
              <div className="text-2xl font-bold font-mono-num text-red-600 dark:text-red-400 mt-1">{urgentCount}</div>
            </div>
            <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-500/25 bg-emerald-500/5">
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400">المهام المكتملة</div>
              <div className="text-2xl font-bold font-mono-num text-emerald-600 dark:text-emerald-400 mt-1">{completedCount}</div>
            </div>
            <div className="p-4 rounded-2xl border border-amber-200 dark:border-amber-500/25 bg-amber-500/5">
              <div className="text-[11px] text-amber-600 dark:text-amber-400">المهام المتأخرة</div>
              <div className="text-2xl font-bold font-mono-num text-amber-600 dark:text-amber-400 mt-1">{overdueTasksCount}</div>
            </div>
          </div>

          {/* Daily Task Glass Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {unifiedTasks.map((task) => (
              <div
                key={task.id}
                className={`p-4 rounded-2xl border transition-all space-y-3 ${
                  task.completed
                    ? 'border-emerald-300/60 dark:border-emerald-500/25 bg-emerald-500/5 opacity-80'
                    : task.priority === 'عاجل'
                    ? 'border-red-300/60 dark:border-red-500/25 glass-surface'
                    : 'border-slate-200 dark:border-white/10 glass-surface'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <input
                      type="checkbox"
                      checked={task.completed}
                      onChange={() => handleToggleTaskComplete(task)}
                      className="mt-1 w-4 h-4 accent-emerald-600 cursor-pointer shrink-0"
                    />
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold ${badgeStyle(task.badgeColor)}`}>
                          {task.typeLabelAr}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                            task.priority === 'عاجل'
                              ? 'bg-red-600 text-white'
                              : task.priority === 'منخفض'
                              ? 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300'
                              : 'bg-blue-600/15 text-blue-600 dark:text-blue-300'
                          }`}
                        >
                          {task.priority}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono-num text-slate-500">
                          <Clock className="w-3 h-3" />
                          {task.targetTime}
                        </span>
                      </div>
                      <div className={`text-sm font-bold ${task.completed ? 'line-through text-slate-400' : ''}`}>
                        {task.title}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="w-3.5 h-3.5" />
                          {task.location}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <UserCheck className="w-3.5 h-3.5" />
                          {task.assigneeName}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Inline Quick Note */}
                <div className="flex items-center gap-2 no-print">
                  <input
                    type="text"
                    value={noteDrafts[task.id] || ''}
                    onChange={(e) => setNoteDrafts((prev) => ({ ...prev, [task.id]: e.target.value }))}
                    placeholder="أضف ملاحظة سريعة للمتابعة..."
                    className="flex-1 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent text-xs focus:outline-none focus:ring-1 focus:ring-[#26478D]"
                  />
                  {noteDrafts[task.id]?.trim() && (
                    <button
                      type="button"
                      onClick={() => handleSaveTaskNote(task)}
                      className="px-3 py-1.5 rounded-xl bg-[#26478D] text-white text-[11px] font-semibold cursor-pointer"
                    >
                      حفظ
                    </button>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/70 dark:border-white/10 text-[11px] no-print">
                  <button
                    type="button"
                    onClick={() => handleToggleTaskComplete(task)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg font-semibold cursor-pointer ${
                      task.completed
                        ? 'bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-200'
                        : 'bg-emerald-600 text-white hover:bg-emerald-500'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{task.completed ? 'إعادة فتح' : 'تحديد كمكتمل'}</span>
                  </button>

                  {task.phone && (
                    <a
                      href={`tel:${task.phone}`}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
                    >
                      <Phone className="w-3.5 h-3.5 text-blue-500" />
                      <span>اتصال</span>
                    </a>
                  )}

                  {task.phone && (
                    <button
                      type="button"
                      onClick={() =>
                        handleSendWhatsAppReminder(
                          task.tenantId || currentUser.id,
                          task.tenantName || task.assigneeName,
                          task.phone,
                          `السلام عليكم ${task.tenantName || ''}، تذكير من إدارة عقار بلس بخصوص: ${task.title} (${task.location}).`,
                          task.sourceId
                        )
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/25 cursor-pointer"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>واتساب</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setRescheduleTarget({ task, date: task.dueDate || todayIso })}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
                  >
                    <CalendarClock className="w-3.5 h-3.5" />
                    <span>إعادة جدولة</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setDelegateTarget({
                        task,
                        staffId: task.assigneeId || state.users[0]?.id || 'usr-gm',
                      })
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>تفويض</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: PAYMENT ALERTS */}
      {tab === 'payments' && (
        <div className="space-y-5">
          {/* 4 Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl border border-amber-200 dark:border-amber-500/25 bg-amber-500/5">
              <div className="text-[11px] text-amber-600 dark:text-amber-400">دفعات مستحقة اليوم</div>
              <div className="text-2xl font-bold font-mono-num mt-1">{paymentAlertsData.dueToday.length}</div>
            </div>
            <div className="p-4 rounded-2xl border border-red-200 dark:border-red-500/25 bg-red-500/5">
              <div className="text-[11px] text-red-600 dark:text-red-400">دفعات متأخرة</div>
              <div className="text-2xl font-bold font-mono-num text-red-600 dark:text-red-400 mt-1">
                {paymentAlertsData.overdue.length}
              </div>
            </div>
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface">
              <div className="text-[11px] text-slate-500">إجمالي المبالغ المستحقة</div>
              <div className="text-xl font-bold font-mono-num text-[#26478D] dark:text-blue-400 mt-1">
                {formatSar(paymentAlertsData.totalAmount, lang)}
              </div>
            </div>
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface">
              <div className="text-[11px] text-slate-500">متوسط أيام التأخير</div>
              <div className="text-2xl font-bold font-mono-num mt-1">{paymentAlertsData.avgDelay} يوم</div>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs no-print">
            <select
              value={payFilterProperty}
              onChange={(e) => setPayFilterProperty(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0A0E1A]"
            >
              <option value="all">كل العقارات</option>
              {state.properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameAr}
                </option>
              ))}
            </select>
            <input
              type="text"
              value={payFilterTenant}
              onChange={(e) => setPayFilterTenant(e.target.value)}
              placeholder="بحث باسم المستأجر أو الجوال..."
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent"
            />
            <select
              value={payFilterAmount}
              onChange={(e) => setPayFilterAmount(e.target.value as typeof payFilterAmount)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0A0E1A]"
            >
              <option value="all">كل المبالغ</option>
              <option value="lt1000">أقل من 1,000 ر.س</option>
              <option value="1000_5000">1,000 - 5,000 ر.س</option>
              <option value="gt5000">أكثر من 5,000 ر.س</option>
            </select>
            <select
              value={payFilterFollowUp}
              onChange={(e) => setPayFilterFollowUp(e.target.value as typeof payFilterFollowUp)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0A0E1A]"
            >
              <option value="all">حالة المتابعة: الكل</option>
              <option value="contacted">تم التواصل معهم</option>
              <option value="uncontacted">لم يتم التواصل بعد</option>
            </select>
          </div>

          {/* 1. Due Today */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <span>1. دفعات مستحقة اليوم ({paymentAlertsData.dueToday.length})</span>
            </h3>
            {paymentAlertsData.dueToday.length === 0 ? (
              <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface text-xs text-slate-500">
                لا توجد دفعات مستحقة اليوم مطابقة للفلاتر.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {paymentAlertsData.dueToday.map(({ inst }) => {
                  const tenant = state.tenants.find((t) => t.id === inst.tenantId);
                  const prop = state.properties.find((p) => p.id === inst.propertyId);
                  const unit = state.units.find((u) => u.id === inst.unitId);
                  return (
                    <div key={inst.id} className="p-4 rounded-2xl border border-amber-300/60 dark:border-amber-500/30 glass-surface flex items-center justify-between gap-3">
                      <div className="space-y-1 text-xs">
                        <div className="font-bold text-sm">{tenant?.nameAr}</div>
                        <div className="text-slate-500">
                          {prop?.nameAr} · {unit?.unitNumber} · قسط #{inst.installmentNumber}
                        </div>
                        <div className="font-mono-num font-bold text-amber-600 dark:text-amber-300">
                          {formatSar(inst.remainingAmount, lang)}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0 no-print">
                        <button
                          type="button"
                          onClick={() => {
                            setQuickPayInst(inst);
                            setQuickPayAmount(inst.remainingAmount);
                            setQuickPayRef('');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#26478D] text-white text-[11px] font-semibold cursor-pointer"
                        >
                          تسجيل دفعة
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleSendWhatsAppReminder(
                              inst.tenantId,
                              tenant?.nameAr || '',
                              tenant?.phone,
                              `السلام عليكم ${tenant?.nameAr || ''}، نذكركم باستحقاق دفعة الإيجار اليوم بمبلغ ${inst.remainingAmount} ر.س للوحدة ${unit?.unitNumber || ''}.`,
                              inst.id
                            )
                          }
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-[11px] cursor-pointer"
                        >
                          إرسال تذكير
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 2. Overdue (Oldest First, Red Cards) */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-4 h-4" />
              <span>2. دفعات متأخرة — مرتبة بالأقدم أولاً ({paymentAlertsData.overdue.length})</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {paymentAlertsData.overdue.map(({ inst, delayDays }) => {
                const tenant = state.tenants.find((t) => t.id === inst.tenantId);
                const prop = state.properties.find((p) => p.id === inst.propertyId);
                const unit = state.units.find((u) => u.id === inst.unitId);
                return (
                  <div
                    key={inst.id}
                    className="p-4 rounded-2xl border border-red-300 dark:border-red-500/35 bg-red-500/5 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{tenant?.nameAr}</span>
                        <span className="px-2 py-0.5 rounded-lg bg-red-600 text-white text-[10px] font-mono-num font-bold">
                          متأخر {delayDays} يوم
                        </span>
                      </div>
                      <div className="text-slate-500 dark:text-slate-400">
                        {prop?.nameAr} · {unit?.unitNumber} · استحق في {formatDisplayDate(inst.dueDate, lang)}
                      </div>
                      <div className="font-mono-num font-bold text-red-600 dark:text-red-300">
                        المتبقي: {formatSar(inst.remainingAmount, lang)}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0 no-print">
                      <button
                        type="button"
                        onClick={() =>
                          handleSendWhatsAppReminder(
                            inst.tenantId,
                            tenant?.nameAr || '',
                            tenant?.phone,
                            `السلام عليكم ${tenant?.nameAr || ''}، نفيدكم بتأخر سداد دفعة الإيجار بمبلغ ${inst.remainingAmount} ر.س لمدة ${delayDays} يوم للوحدة ${unit?.unitNumber || ''}، نرجو السداد العاجل.`,
                            inst.id
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-[11px] font-semibold cursor-pointer"
                      >
                        متابعة فورية
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setQuickPayInst(inst);
                          setQuickPayAmount(inst.remainingAmount);
                          setQuickPayRef('');
                        }}
                        className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-500/30 text-[11px] font-semibold cursor-pointer"
                      >
                        تحصيل الآن
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Upcoming (Yellow/Amber Cards) */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <BellRing className="w-4 h-4" />
              <span>3. دفعات قادمة قريباً ({paymentAlertsData.upcoming.length})</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {paymentAlertsData.upcoming.map(({ inst, daysUntil }) => {
                const tenant = state.tenants.find((t) => t.id === inst.tenantId);
                const prop = state.properties.find((p) => p.id === inst.propertyId);
                const unit = state.units.find((u) => u.id === inst.unitId);
                return (
                  <div
                    key={inst.id}
                    className="p-4 rounded-2xl border border-amber-300/70 dark:border-amber-500/30 bg-amber-500/5 flex items-center justify-between gap-3"
                  >
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">{tenant?.nameAr}</span>
                        <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-mono-num font-bold">
                          بعد {daysUntil} يوم
                        </span>
                      </div>
                      <div className="text-slate-500">
                        {prop?.nameAr} · {unit?.unitNumber} · {formatDisplayDate(inst.dueDate, lang)}
                      </div>
                      <div className="font-mono-num font-bold">{formatSar(inst.remainingAmount, lang)}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        handleSendWhatsAppReminder(
                          inst.tenantId,
                          tenant?.nameAr || '',
                          tenant?.phone,
                          `تذكير مسبق: موعد استحقاق دفعة الإيجار للوحدة ${unit?.unitNumber || ''} بمبلغ ${inst.remainingAmount} ر.س بتاريخ ${inst.dueDate}.`,
                          inst.id
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-amber-600 text-white text-[11px] font-semibold cursor-pointer shrink-0 no-print"
                    >
                      إرسال تذكير مسبق
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CONTRACT ALERTS */}
      {tab === 'contracts' && (
        <div className="space-y-5">
          {/* 4 Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl border border-amber-200 dark:border-amber-500/25 bg-amber-500/5">
              <div className="text-[11px] text-amber-600 dark:text-amber-400">عقود تنتهي قريباً (≤ 45 يوم)</div>
              <div className="text-2xl font-bold font-mono-num mt-1">{contractAlertsData.expiringSoon.length}</div>
            </div>
            <div className="p-4 rounded-2xl border border-red-200 dark:border-red-500/25 bg-red-500/5">
              <div className="text-[11px] text-red-600 dark:text-red-400">منتهية ولم تُجدد</div>
              <div className="text-2xl font-bold font-mono-num text-red-600 dark:text-red-400 mt-1">
                {contractAlertsData.expiredNotRenewed.length}
              </div>
            </div>
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface">
              <div className="text-[11px] text-slate-500">عقود بانتظار الإخلاء</div>
              <div className="text-2xl font-bold font-mono-num mt-1">{contractAlertsData.awaitingEvictionCount}</div>
            </div>
            <div className="p-4 rounded-2xl border border-blue-200 dark:border-blue-500/25 bg-blue-500/5">
              <div className="text-[11px] text-blue-600 dark:text-blue-400">بانتظار التفعيل</div>
              <div className="text-2xl font-bold font-mono-num text-blue-600 dark:text-blue-400 mt-1">
                {contractAlertsData.pendingActivation.length}
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs no-print">
            <select
              value={contractFilterProperty}
              onChange={(e) => setContractFilterProperty(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0A0E1A]"
            >
              <option value="all">كل العقارات</option>
              {state.properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameAr}
                </option>
              ))}
            </select>
            <select
              value={contractFilterTenantType}
              onChange={(e) => setContractFilterTenantType(e.target.value as typeof contractFilterTenantType)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0A0E1A]"
            >
              <option value="all">كل أنواع المستأجرين</option>
              <option value="فرد">فرد</option>
              <option value="عائلة">عائلة</option>
              <option value="شركة">شركة</option>
            </select>
            <select
              value={contractFilterStatus}
              onChange={(e) => setContractFilterStatus(e.target.value as typeof contractFilterStatus)}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0A0E1A]"
            >
              <option value="all">كل الحالات</option>
              <option value="نشط">نشط</option>
              <option value="منتهي">منتهي</option>
              <option value="معلق">معلق / بانتظار التفعيل</option>
            </select>
          </div>

          {/* 1. Expiring Soon */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-amber-500" />
              <span>1. عقود تنتهي قريباً ({contractAlertsData.expiringSoon.length})</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {contractAlertsData.expiringSoon.map(({ contract, daysLeft }) => {
                const tenant = state.tenants.find((t) => t.id === contract.tenantId);
                const prop = state.properties.find((p) => p.id === contract.propertyId);
                const unit = state.units.find((u) => u.id === contract.unitId);
                return (
                  <div key={contract.id} className="p-4 rounded-2xl border border-amber-300/60 dark:border-amber-500/30 glass-surface space-y-3 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-sm">
                          {contract.internalNumber} · {tenant?.nameAr}
                        </div>
                        <div className="text-slate-500">
                          {prop?.nameAr} · {unit?.unitNumber} · ينتهي {formatDisplayDate(contract.endDate, lang)}
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono-num font-bold">
                        متبقي {daysLeft} يوم
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 no-print">
                      <button
                        type="button"
                        onClick={() => handleContractAction(contract, 'renew')}
                        className="px-3 py-1.5 rounded-lg bg-[#26478D] text-white font-semibold cursor-pointer"
                      >
                        تجديد
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleSendWhatsAppReminder(
                            contract.tenantId,
                            tenant?.nameAr || '',
                            tenant?.phone,
                            `السلام عليكم ${tenant?.nameAr || ''}، نذكركم بقرب انتهاء عقد الإيجار ${contract.internalNumber} بتاريخ ${contract.endDate} (متبقي ${daysLeft} يوم). يرجى تأكيد رغبتكم بالتجديد.`,
                            contract.id
                          )
                        }
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 cursor-pointer"
                      >
                        إرسال تنبيه
                      </button>
                      <button
                        type="button"
                        onClick={() => handleContractAction(contract, 'evict')}
                        className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-500/30 text-red-600 dark:text-red-400 cursor-pointer"
                      >
                        بدء إجراءات الإخلاء
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Expired - Not Renewed */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
              <AlertTriangle className="w-4 h-4" />
              <span>2. عقود منتهية لم تُجدد ({contractAlertsData.expiredNotRenewed.length})</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {contractAlertsData.expiredNotRenewed.map(({ contract, overdueDays }) => {
                const tenant = state.tenants.find((t) => t.id === contract.tenantId);
                const prop = state.properties.find((p) => p.id === contract.propertyId);
                const unit = state.units.find((u) => u.id === contract.unitId);
                return (
                  <div key={contract.id} className="p-4 rounded-2xl border border-red-300 dark:border-red-500/35 bg-red-500/5 space-y-3 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-sm">
                          {contract.internalNumber} · {tenant?.nameAr}
                        </div>
                        <div className="text-slate-500 dark:text-slate-400">
                          {prop?.nameAr} · {unit?.unitNumber} · انتهى {formatDisplayDate(contract.endDate, lang)}
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-lg bg-red-600 text-white font-mono-num font-bold">
                        منتهي منذ {overdueDays} يوم
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 no-print">
                      <button
                        type="button"
                        onClick={() => handleContractAction(contract, 'renew')}
                        className="px-3 py-1.5 rounded-lg bg-[#26478D] text-white font-semibold cursor-pointer"
                      >
                        تجديد متأخر
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleSendWhatsAppReminder(
                            contract.tenantId,
                            tenant?.nameAr || '',
                            tenant?.phone,
                            `إنذار إخلاء/تجديد: انتهت مدة العقد ${contract.internalNumber} بتاريخ ${contract.endDate}. يرجى المراجعة الفورية للتجديد أو تسليم الوحدة.`,
                            contract.id
                          )
                        }
                        className="px-3 py-1.5 rounded-lg bg-red-600 text-white font-semibold cursor-pointer"
                      >
                        إنذار إخلاء
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Pending Activation */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <FileSignature className="w-4 h-4" />
              <span>3. عقود بانتظار التفعيل ({contractAlertsData.pendingActivation.length})</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {contractAlertsData.pendingActivation.map((contract) => {
                const tenant = state.tenants.find((t) => t.id === contract.tenantId);
                const prop = state.properties.find((p) => p.id === contract.propertyId);
                const unit = state.units.find((u) => u.id === contract.unitId);
                return (
                  <div key={contract.id} className="p-4 rounded-2xl border border-blue-300/60 dark:border-blue-500/30 glass-surface space-y-3 text-xs">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-bold text-sm">
                          {contract.internalNumber} · {tenant?.nameAr}
                        </div>
                        <div className="text-slate-500">
                          {prop?.nameAr} · {unit?.unitNumber} · {formatSar(contract.annualRent, lang)}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-300 font-semibold">
                        {contract.lifecycleStatus}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 no-print">
                      <button
                        type="button"
                        onClick={() => handleContractAction(contract, 'activate')}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer"
                      >
                        تفعيل العقد
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveNav('leasing')}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 cursor-pointer"
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        onClick={() => handleContractAction(contract, 'cancel')}
                        className="px-3 py-1.5 rounded-lg border border-red-300 dark:border-red-500/30 text-red-600 dark:text-red-400 cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Quick Reschedule Modal */}
      {rescheduleTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#13192B] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">إعادة جدولة المهمة</h3>
              <button type="button" onClick={() => setRescheduleTarget(null)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-slate-500">{rescheduleTarget.task.title}</div>
            <input
              type="date"
              value={rescheduleTarget.date}
              onChange={(e) => setRescheduleTarget({ ...rescheduleTarget, date: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent text-xs font-mono-num"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRescheduleTarget(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleRescheduleSave}
                className="px-4 py-1.5 rounded-lg bg-[#26478D] text-white text-xs font-semibold cursor-pointer"
              >
                حفظ الموعد الجديد
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Delegate Modal */}
      {delegateTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#13192B] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">تفويض المهمة لموظف آخر</h3>
              <button type="button" onClick={() => setDelegateTarget(null)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-slate-500">{delegateTarget.task.title}</div>
            <select
              value={delegateTarget.staffId}
              onChange={(e) => setDelegateTarget({ ...delegateTarget, staffId: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0A0E1A] text-xs"
            >
              {state.users
                .filter((u) => u.active && u.role !== 'owner')
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.nameAr} ({u.roleLabelAr})
                  </option>
                ))}
            </select>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDelegateTarget(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleDelegateSave}
                className="px-4 py-1.5 rounded-lg bg-[#26478D] text-white text-xs font-semibold cursor-pointer"
              >
                تأكيد التفويض
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Record Payment Modal */}
      {quickPayInst && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <form
            onSubmit={handleQuickPaymentSubmit}
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#13192B] p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">تحصيل دفعة سريعة وإصدار سند قبض</h3>
              <button type="button" onClick={() => setQuickPayInst(null)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">المبلغ المحصل (ر.س)</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={quickPayInst.remainingAmount}
                  value={quickPayAmount}
                  onChange={(e) => setQuickPayAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent font-mono-num font-bold"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">طريقة الدفع</label>
                <select
                  value={quickPayMethod}
                  onChange={(e) => setQuickPayMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0A0E1A]"
                >
                  <option value="تحويل بنكي">تحويل بنكي</option>
                  <option value="نقدي">نقدي</option>
                  <option value="شبكة مدى">شبكة مدى</option>
                  <option value="سداد إلكتروني">سداد إلكتروني</option>
                  <option value="شيك">شيك</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">رقم المرجع (اختياري)</label>
                <input
                  value={quickPayRef}
                  onChange={(e) => setQuickPayRef(e.target.value)}
                  placeholder="TRX-..."
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent font-mono-num"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setQuickPayInst(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-xs cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer"
              >
                اعتماد التحصيل وإصدار السند
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
