import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BellRing,
  CheckCheck,
  Clock,
  FileWarning,
  Moon,
  RotateCcw,
  SlidersHorizontal,
  Wallet,
  Wrench,
  X,
  ArrowUpLeft,
} from 'lucide-react';
import { NavSection, useAqar } from '../context/AqarContext';
import { formatDisplayDate, formatSar } from '../utils/formatters';

export type AlertCategory = 'all' | 'rent' | 'contracts' | 'maintenance';
export type AlertPriority = 'عاجل' | 'عادي' | 'منخفض';

export interface DerivedAlert {
  id: string;
  category: Exclude<AlertCategory, 'all'>;
  severity: 'critical' | 'warning';
  priority: AlertPriority;
  ruleBadgeAr: string;
  ruleBadgeEn: string;
  titleAr: string;
  titleEn: string;
  detailAr: string;
  detailEn: string;
  metaAr: string;
  metaEn: string;
  targetNav: NavSection;
  actionLabelAr: string;
  actionLabelEn: string;
}

export function useDashboardAlerts() {
  const { state, currentUser, lang } = useAqar();

  const alerts = useMemo<DerivedAlert[]>(() => {
    if (!state || !currentUser) return [];
    const todayMs = new Date('2026-11-14T00:00:00Z').getTime();
    const list: DerivedAlert[] = [];

    // 1. Smart Rent Rules: -7d, -1d, 0d (Due Today), +3d+ Overdue (and general <= 30d)
    for (const inst of state.installments) {
      if (inst.status === 'ملغاة' || inst.remainingAmount <= 0) continue;
      const dueMs = new Date(`${inst.dueDate}T00:00:00Z`).getTime();
      const diffDays = Math.ceil((dueMs - todayMs) / 86400000);

      if (diffDays <= 30) {
        const tenant = state.tenants.find((t) => t.id === inst.tenantId);
        const unit = state.units.find((u) => u.id === inst.unitId);
        const prop = state.properties.find((p) => p.id === inst.propertyId);
        const isOverdue = diffDays < 0 || inst.status === 'متأخرة';
        const isOverdue3Plus = diffDays <= -3;
        const isToday = diffDays === 0 || inst.status === 'مستحقة اليوم';
        const isTomorrow = diffDays === 1;
        const isSevenDays = diffDays === 7;

        const priority: AlertPriority =
          isOverdue || isToday || isTomorrow ? 'عاجل' : diffDays <= 14 ? 'عادي' : 'منخفض';

        const ruleBadgeAr = isOverdue3Plus
          ? 'تأخر +3 أيام'
          : isOverdue
          ? 'متأخر عن السداد'
          : isToday
          ? 'يوم الاستحقاق'
          : isTomorrow
          ? 'قبل يوم واحد'
          : isSevenDays
          ? 'قبل 7 أيام'
          : `خلال ${diffDays} يوم`;

        const ruleBadgeEn = isOverdue3Plus
          ? 'Overdue 3+ days'
          : isOverdue
          ? 'Overdue'
          : isToday
          ? 'Due Today'
          : isTomorrow
          ? '1 Day Before'
          : isSevenDays
          ? '7 Days Before'
          : `In ${diffDays}d`;

        list.push({
          id: `alert-rent-${inst.id}`,
          category: 'rent',
          severity: priority === 'عاجل' ? 'critical' : 'warning',
          priority,
          ruleBadgeAr,
          ruleBadgeEn,
          titleAr: isOverdue
            ? `دفعة إيجار متأخرة · وحدة ${unit?.unitNumber || ''}`
            : isToday
            ? `دفعة إيجار مستحقة اليوم · وحدة ${unit?.unitNumber || ''}`
            : `استحقاق إيجار قادم خلال ${diffDays} يوم · وحدة ${unit?.unitNumber || ''}`,
          titleEn: isOverdue
            ? `Overdue Rent · Unit ${unit?.unitNumber || ''}`
            : isToday
            ? `Rent Due Today · Unit ${unit?.unitNumber || ''}`
            : `Upcoming Rent Due in ${diffDays}d · Unit ${unit?.unitNumber || ''}`,
          detailAr: `${tenant?.nameAr || 'مستأجر'} · المتبقي ${formatSar(inst.remainingAmount, 'ar')} (قسط #${inst.installmentNumber})`,
          detailEn: `${tenant?.nameEn || 'Tenant'} · Remaining ${formatSar(inst.remainingAmount, 'en')} (Inst #${inst.installmentNumber})`,
          metaAr: `${prop?.nameAr || ''} · تاريخ الاستحقاق ${formatDisplayDate(inst.dueDate, 'ar')}`,
          metaEn: `${prop?.nameEn || ''} · Due ${formatDisplayDate(inst.dueDate, 'en')}`,
          targetNav: 'finance',
          actionLabelAr: 'تحصيل الدفعة',
          actionLabelEn: 'Collect Rent',
        });
      }
    }

    // 2. Smart Contract Expiry Rules: Expired, <= 7d, <= 30d, <= 60d
    for (const ctr of state.contracts) {
      if (ctr.lifecycleStatus === 'ملغي' || ctr.lifecycleStatus === 'منتهٍ بالإخلاء') continue;
      const endMs = new Date(`${ctr.endDate}T00:00:00Z`).getTime();
      const daysLeft = Math.ceil((endMs - todayMs) / 86400000);
      const isExpired = daysLeft < 0 || ctr.lifecycleStatus === 'منتهي';

      if (isExpired || daysLeft <= 60) {
        const tenant = state.tenants.find((t) => t.id === ctr.tenantId);
        const unit = state.units.find((u) => u.id === ctr.unitId);
        const prop = state.properties.find((p) => p.id === ctr.propertyId);

        const priority: AlertPriority =
          isExpired || daysLeft <= 7 ? 'عاجل' : daysLeft <= 30 ? 'عادي' : 'منخفض';

        const ruleBadgeAr = isExpired
          ? 'عقد منتهي'
          : daysLeft <= 7
          ? 'تذكير 7 أيام'
          : daysLeft <= 30
          ? 'تذكير 30 يوماً'
          : 'تذكير 60 يوماً';

        const ruleBadgeEn = isExpired
          ? 'Expired'
          : daysLeft <= 7
          ? '7-Day Alert'
          : daysLeft <= 30
          ? '30-Day Alert'
          : '60-Day Alert';

        list.push({
          id: `alert-ctr-${ctr.id}`,
          category: 'contracts',
          severity: isExpired || daysLeft <= 20 ? 'critical' : 'warning',
          priority,
          ruleBadgeAr,
          ruleBadgeEn,
          titleAr: isExpired
            ? `عقد منتهي يتطلب التجديد أو الإخلاء · ${ctr.internalNumber}`
            : `عقد ينتهي خلال ${daysLeft} يوم · ${ctr.internalNumber}`,
          titleEn: isExpired
            ? `Expired Contract · ${ctr.internalNumber}`
            : `Contract Expiring in ${daysLeft}d · ${ctr.internalNumber}`,
          detailAr: `${tenant?.nameAr || ''} · وحدة ${unit?.unitNumber || ''} · إيجار: ${ctr.ejarNumber || 'غير موثق'}`,
          detailEn: `${tenant?.nameEn || ''} · Unit ${unit?.unitNumber || ''} · Ejar: ${ctr.ejarNumber || 'Pending'}`,
          metaAr: `${prop?.nameAr || ''} · تاريخ الانتهاء ${ctr.endDate}`,
          metaEn: `${prop?.nameEn || ''} · Ends ${ctr.endDate}`,
          targetNav: 'leasing',
          actionLabelAr: 'إدارة العقد',
          actionLabelEn: 'Manage Lease',
        });
      }
    }

    // 3. Maintenance Tickets (created, assigned, completed) & Tasks (assigned / within 24h)
    if (currentUser.role !== 'owner') {
      for (const tkt of state.tickets) {
        if (tkt.status === 'مغلق') continue;
        const unit = state.units.find((u) => u.id === tkt.unitId);
        const prop = state.properties.find((p) => p.id === tkt.propertyId);
        const isCompleted = tkt.status === 'مكتمل';
        const isCritical = !isCompleted && (tkt.priority === 'عاجل' || tkt.priority === 'مرتفع');
        const priority: AlertPriority = isCompleted ? 'منخفض' : isCritical ? 'عاجل' : 'عادي';

        const ruleBadgeAr = isCompleted
          ? 'صيانة مكتملة'
          : tkt.assignedTo
          ? 'تم الإسناد لفني'
          : 'بلاغ صيانة جديد';
        const ruleBadgeEn = isCompleted
          ? 'Completed'
          : tkt.assignedTo
          ? 'Technician Assigned'
          : 'New Ticket';

        list.push({
          id: `alert-tkt-${tkt.id}`,
          category: 'maintenance',
          severity: isCritical ? 'critical' : 'warning',
          priority,
          ruleBadgeAr,
          ruleBadgeEn,
          titleAr: isCompleted
            ? `بلاغ صيانة مكتمل · ${tkt.ticketNumber}`
            : `بلاغ صيانة (${tkt.priority}) · ${tkt.ticketNumber}`,
          titleEn: isCompleted
            ? `Completed Maintenance · ${tkt.ticketNumber}`
            : `Maintenance (${tkt.priority}) · ${tkt.ticketNumber}`,
          detailAr: `${tkt.title} · وحدة ${unit?.unitNumber || ''}`,
          detailEn: `${tkt.title} · Unit ${unit?.unitNumber || ''}`,
          metaAr: `${prop?.nameAr || ''} · الحالة: ${tkt.status}`,
          metaEn: `${prop?.nameEn || ''} · Status: ${tkt.status}`,
          targetNav: 'maintenance',
          actionLabelAr: 'متابعة الصيانة',
          actionLabelEn: 'Open Ticket',
        });
      }

      for (const tsk of state.tasks) {
        if (tsk.status === 'مكتملة') continue;
        if (tsk.linkedTicketId) continue;
        const dueMs = new Date(`${tsk.dueDate}T00:00:00Z`).getTime();
        const diffDays = Math.ceil((dueMs - todayMs) / 86400000);
        const isAssignedToMe = tsk.assignedTo === currentUser.id;
        if (diffDays <= 2 || tsk.priority === 'عاجل' || isAssignedToMe) {
          const assignee = state.users.find((u) => u.id === tsk.assignedTo);
          const priority: AlertPriority =
            diffDays <= 1 || tsk.priority === 'عاجل' ? 'عاجل' : diffDays <= 3 ? 'عادي' : 'منخفض';

          list.push({
            id: `alert-tsk-${tsk.id}`,
            category: 'maintenance',
            severity: diffDays <= 1 || tsk.priority === 'عاجل' ? 'critical' : 'warning',
            priority,
            ruleBadgeAr: diffDays <= 1 ? 'قبل الموعد بـ 24 ساعة' : 'مهمة مسندة',
            ruleBadgeEn: diffDays <= 1 ? 'Within 24h Deadline' : 'Assigned Task',
            titleAr: `مهمة تشغيلية (${priority}) · ${tsk.type}`,
            titleEn: `Operational Task (${priority}) · ${tsk.type}`,
            detailAr: tsk.title,
            detailEn: tsk.title,
            metaAr: `المكلف: ${assignee?.nameAr || ''} · موعد التسليم ${tsk.dueDate}`,
            metaEn: `Assigned: ${assignee?.nameEn || ''} · Due ${tsk.dueDate}`,
            targetNav: 'daily_hub',
            actionLabelAr: 'فتح المهمة',
            actionLabelEn: 'View Task',
          });
        }
      }
    }

    const rank: Record<AlertPriority, number> = { عاجل: 0, عادي: 1, منخفض: 2 };
    return list.sort((a, b) => rank[a.priority] - rank[b.priority]);
  }, [state, currentUser, lang]);

  return alerts;
}

interface DashboardAlertsOverlayProps {
  open: boolean;
  initialCategory?: AlertCategory;
  onClose: () => void;
  dismissedIds: string[];
  onDismiss: (id: string) => void;
  onResetDismissed: () => void;
}

export function DashboardAlertsOverlay({
  open,
  initialCategory = 'all',
  onClose,
  dismissedIds,
  onDismiss,
  onResetDismissed,
}: DashboardAlertsOverlayProps) {
  const { state, currentUser, lang, setActiveNav } = useAqar();
  const allAlerts = useDashboardAlerts();
  const [category, setCategory] = useState<AlertCategory>(initialCategory);
  const [priorityFilter, setPriorityFilter] = useState<'all' | AlertPriority>('all');

  React.useEffect(() => {
    setCategory(initialCategory);
  }, [initialCategory, open]);

  if (!open) return null;

  const activeAlerts = allAlerts.filter((a) => !dismissedIds.includes(a.id));
  const filtered = activeAlerts.filter(
    (a) =>
      (category === 'all' || a.category === category) &&
      (priorityFilter === 'all' || a.priority === priorityFilter)
  );

  const rentCount = activeAlerts.filter((a) => a.category === 'rent').length;
  const contractCount = activeAlerts.filter((a) => a.category === 'contracts').length;
  const maintCount = activeAlerts.filter((a) => a.category === 'maintenance').length;
  const urgentCount = activeAlerts.filter((a) => a.priority === 'عاجل').length;

  const userDndEnabled = currentUser?.notificationPrefs?.dndEnabled;
  const dndWindow =
    currentUser?.notificationPrefs?.dndFrom && currentUser?.notificationPrefs?.dndTo
      ? `${currentUser.notificationPrefs.dndFrom} – ${currentUser.notificationPrefs.dndTo}`
      : state?.settings.notificationsCenter?.workHoursEnabled
      ? `${state.settings.notificationsCenter.workHoursStart} – ${state.settings.notificationsCenter.workHoursEnd}`
      : null;

  const handleNavigate = (nav: NavSection) => {
    onClose();
    setActiveNav(nav);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-label={lang === 'ar' ? 'مركز تنبيهات لوحة التحكم' : 'Dashboard Notification Center'}
    >
      <div className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#13192B] text-slate-900 dark:text-slate-100 shadow-2xl overflow-hidden">
        {/* Overlay Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#26478D]/15 dark:bg-[#26478D]/30 text-[#26478D] dark:text-blue-400 flex items-center justify-center shrink-0">
              <BellRing className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold">
                {lang === 'ar' ? 'مركز التنبيهات الذكية والإجراءات العاجلة' : 'Smart Notifications & Urgent Operations'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'ar'
                  ? 'قواعد ذكية: الإيجار (-7، -1، اليوم، +3)، العقود (60/30/7 أيام)، الصيانة والمهام'
                  : 'Smart rules for rent (-7/-1/0/+3d), leases (60/30/7d), maintenance & tasks'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleNavigate('settings')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'تفضيلات التنبيه' : 'Preferences'}</span>
            </button>
            {dismissedIds.length > 0 && (
              <button
                onClick={onResetDismissed}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? `استعادة (${dismissedIds.length})` : `Restore (${dismissedIds.length})`}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
              aria-label="Close overlay"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* DND Banner if active */}
        {(userDndEnabled || state?.settings.notificationsCenter?.workHoursEnabled) && dndWindow && (
          <div className="px-6 py-2 bg-indigo-50/70 dark:bg-indigo-500/10 border-b border-indigo-200/60 dark:border-indigo-500/20 flex items-center justify-between text-[11px] text-indigo-700 dark:text-indigo-300">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <Moon className="w-3.5 h-3.5" />
              {userDndEnabled
                ? `وضع عدم الإزعاج الشخصي مفعّل (${dndWindow})`
                : `جدول ساعات العمل النشط للإشعارات (${dndWindow})`}
            </span>
            <span>{urgentCount} تنبيهات عاجلة تتجاوز الصمت</span>
          </div>
        )}

        {/* Category + Priority Filters */}
        <div className="px-6 py-3 border-b border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setCategory('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                category === 'all'
                  ? 'bg-[#26478D] text-white'
                  : 'bg-white dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10'
              }`}
            >
              {lang === 'ar' ? `الكل (${activeAlerts.length})` : `All (${activeAlerts.length})`}
            </button>
            <button
              onClick={() => setCategory('rent')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                category === 'rent'
                  ? 'bg-[#26478D] text-white'
                  : 'bg-white dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10'
              }`}
            >
              <Wallet className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? `استحقاقات الإيجار (${rentCount})` : `Rent Due (${rentCount})`}</span>
            </button>
            <button
              onClick={() => setCategory('contracts')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                category === 'contracts'
                  ? 'bg-[#26478D] text-white'
                  : 'bg-white dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10'
              }`}
            >
              <FileWarning className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? `العقود (${contractCount})` : `Contracts (${contractCount})`}</span>
            </button>
            <button
              onClick={() => setCategory('maintenance')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                category === 'maintenance'
                  ? 'bg-[#26478D] text-white'
                  : 'bg-white dark:bg-white/[0.05] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? `الصيانة والمهام (${maintCount})` : `Maintenance (${maintCount})`}</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="text-slate-500 font-medium me-1">الأولوية:</span>
            {(['all', 'عاجل', 'عادي', 'منخفض'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer transition-colors ${
                  priorityFilter === p
                    ? p === 'عاجل'
                      ? 'bg-red-600 text-white'
                      : 'bg-slate-800 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-white dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10'
                }`}
              >
                {p === 'all' ? 'جميع الأولويات' : p}
              </button>
            ))}
          </div>
        </div>

        {/* Alerts List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
          {filtered.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <CheckCheck className="w-8 h-8 mx-auto text-emerald-600 dark:text-emerald-400" />
              <div className="text-sm font-semibold">
                {lang === 'ar' ? 'لا توجد تنبيهات مطابقة في هذا التصنيف' : 'No pending alerts in this category'}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'ar'
                  ? 'جميع الاستحقاقات والعقود والمهام ضمن النطاق السليم.'
                  : 'All rent schedules, contracts, and maintenance tasks are up to date.'}
              </p>
            </div>
          ) : (
            filtered.map((alert) => {
              const Icon =
                alert.category === 'rent' ? Wallet : alert.category === 'contracts' ? FileWarning : Wrench;
              const isCritical = alert.priority === 'عاجل';

              return (
                <div
                  key={alert.id}
                  className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                        isCritical
                          ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                          : alert.priority === 'عادي'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'bg-slate-500/10 text-slate-500'
                      }`}
                    >
                      {isCritical ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`px-1.5 py-0.5 rounded font-semibold text-[10px] ${
                            isCritical
                              ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                              : alert.priority === 'عادي'
                              ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300'
                              : 'bg-slate-500/15 text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {alert.priority}
                        </span>
                        <span className="text-[11px] font-semibold text-[#26478D] dark:text-blue-400">
                          {lang === 'ar' ? alert.ruleBadgeAr : alert.ruleBadgeEn}
                        </span>
                        <span className="text-slate-400">·</span>
                        <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400">
                          <Icon className="w-3 h-3" />
                          <span>
                            {alert.category === 'rent'
                              ? lang === 'ar'
                                ? 'إيجارات'
                                : 'Rent'
                              : alert.category === 'contracts'
                              ? lang === 'ar'
                                ? 'عقود'
                                : 'Contracts'
                              : lang === 'ar'
                              ? 'صيانة ومهام'
                              : 'Maintenance'}
                          </span>
                        </span>
                      </div>
                      <div className="text-sm font-bold text-slate-900 dark:text-slate-100">
                        {lang === 'ar' ? alert.titleAr : alert.titleEn}
                      </div>
                      <div className="text-xs text-slate-600 dark:text-slate-300 font-mono-num">
                        {lang === 'ar' ? alert.detailAr : alert.detailEn}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {lang === 'ar' ? alert.metaAr : alert.metaEn}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => onDismiss(alert.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer whitespace-nowrap"
                    >
                      {lang === 'ar' ? 'تجاهل' : 'Dismiss'}
                    </button>
                    <button
                      onClick={() => handleNavigate(alert.targetNav)}
                      className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#26478D] text-white hover:bg-[#1e3a75] cursor-pointer whitespace-nowrap"
                    >
                      <span>{lang === 'ar' ? alert.actionLabelAr : alert.actionLabelEn}</span>
                      <ArrowUpLeft className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
