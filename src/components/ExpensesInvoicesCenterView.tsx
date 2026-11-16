import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  Edit3,
  Eye,
  FileSpreadsheet,
  FileText,
  Filter,
  Lock,
  Plus,
  QrCode,
  Receipt,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Trash2,
  TrendingUp,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useAqar } from '../context/AqarContext';
import {
  CurrencyCode,
  Expense,
  ExpenseCategory,
  PaymentMethod,
  SupplierInvoice,
  SupplierInvoiceLineItem,
} from '../types/aqar';
import { DEFAULT_CURRENCY_RATES_TO_SAR, formatCurrency } from '../utils/formatters';
import { exportExpensesReportToExcel } from '../utils/excelExport';
import { EXPENSE_CATEGORY_MAP, ExpenseWizardModal } from './ExpenseWizardModal';
import { PIN_STORAGE_KEY } from './OnboardingJourney';
import { triggerHaptic } from '../utils/haptics';

type CenterSubTab = 'expenses' | 'invoices' | 'recurring_budgets' | 'reports';
type QuickChip = 'all' | 'this_month' | 'unapproved' | 'overdue' | 'drafts';

const TODAY_STR = '2026-11-14';
const CURRENT_MONTH = '2026-11';
const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#ef4444', '#64748b'];

function getApprovalBadgeClass(status: Expense['approvalStatus']): string {
  switch (status) {
    case 'معتمد':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30';
    case 'مرفوض':
    case 'ملغى':
      return 'bg-red-500/15 text-red-300 border-red-400/30';
    case 'مسودة':
      return 'bg-slate-500/20 text-slate-300 border-slate-400/30';
    default:
      return 'bg-amber-500/15 text-amber-300 border-amber-400/30';
  }
}

function getInvoiceBadgeClass(status: SupplierInvoice['status']): string {
  switch (status) {
    case 'مدفوعة بالكامل':
    case 'معتمدة':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30';
    case 'مدفوعة جزئياً':
      return 'bg-blue-500/15 text-blue-300 border-blue-400/30';
    case 'متأخرة':
    case 'ملغاة':
      return 'bg-red-500/15 text-red-300 border-red-400/30';
    case 'مسودة':
      return 'bg-slate-500/20 text-slate-300 border-slate-400/30';
    default:
      return 'bg-amber-500/15 text-amber-300 border-amber-400/30';
  }
}

export function ExpensesInvoicesCenterView() {
  const {
    state,
    currentUser,
    lang,
    hasPermission,
    mutate,
    pushToast,
    baseCurrency,
    convertToBase,
    formatInCurrency,
    formatConvertedBase,
  } = useAqar();

  const isAr = lang === 'ar';

  const [subTab, setSubTab] = useState<CenterSubTab>('expenses');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickChip, setQuickChip] = useState<QuickChip>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [propertyFilter, setPropertyFilter] = useState<string>('all');

  // Expense Wizard (Create / Edit)
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Action Modals for Expenses
  const [pinApproveModal, setPinApproveModal] = useState<{ expense: Expense; pin: string } | null>(null);
  const [rejectModal, setRejectModal] = useState<{ expense: Expense; reason: string } | null>(null);
  const [payVoucherModal, setPayVoucherModal] = useState<{
    expense: Expense;
    paidAmount: number;
    paymentMethod: PaymentMethod;
    paidFromAccount: string;
    referenceNumber: string;
  } | null>(null);
  const [cancelExpenseModal, setCancelExpenseModal] = useState<{
    expense: Expense;
    reason: string;
    pin: string;
  } | null>(null);
  const [attachmentPreviewExp, setAttachmentPreviewExp] = useState<Expense | null>(null);

  // Supplier Invoice Create / Pay / Cancel Modals
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [invForm, setInvForm] = useState({
    supplierInvoiceNumber: '',
    vendorId: '',
    propertyId: '',
    unitId: '',
    ticketId: '',
    invoiceDate: TODAY_STR,
    receivedDate: TODAY_STR,
    dueDate: '2026-11-30',
    currency: 'SAR' as CurrencyCode,
    vatApplicable: true,
    zatcaQrVerified: true,
    notes: '',
    items: [
      { id: 'li-1', description: '', quantity: 1, unitPrice: 500, total: 500 },
    ] as SupplierInvoiceLineItem[],
  });
  const [payInvModal, setPayInvModal] = useState<{ invoice: SupplierInvoice; payAmount: number } | null>(null);
  const [cancelInvModal, setCancelInvModal] = useState<{ invoice: SupplierInvoice; reason: string } | null>(null);

  // Recurring & Budgets Modals
  const [showAddRecurring, setShowAddRecurring] = useState(false);
  const [recForm, setRecForm] = useState({
    title: '',
    category: 'مصروفات التشغيل' as ExpenseCategory,
    subCategory: 'كهرباء عامة',
    propertyId: '',
    vendorId: '',
    estimatedAmount: 1500,
    currency: 'SAR' as CurrencyCode,
    bearer: 'المالك' as 'المالك' | 'الشركة' | 'المستأجر',
    frequency: 'شهري' as 'شهري' | 'ربع سنوي' | 'سنوي',
    dayOfMonth: 5,
  });

  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetForm, setBudgetForm] = useState({
    propertyId: '',
    month: CURRENT_MONTH,
    monthlyLimitSar: 15000,
    alertThresholdPercent: 80,
    blockAt100Percent: false,
  });

  const expenses = state?.expenses || [];
  const supplierInvoices = state?.supplierInvoices || [];
  const recurringRules = state?.recurringExpenses || [];
  const propertyBudgets = state?.propertyBudgets || [];

  const toSarRate = (amt: number, cur?: CurrencyCode) => {
    const rate = state?.settings.currencyRatesToSar?.[cur || 'SAR'] ?? DEFAULT_CURRENCY_RATES_TO_SAR[cur || 'SAR'] ?? 1;
    return amt * rate;
  };

  // KPI Metrics
  const kpis = useMemo(() => {
    if (!state) {
      return { monthTotalBase: 0, pendingCount: 0, pendingBase: 0, unpaidCount: 0, unpaidBase: 0, topCat: '—', topCatBase: 0 };
    }
    const validExpenses = expenses.filter((e) => e.approvalStatus !== 'ملغى' && e.approvalStatus !== 'مرفوض');
    const thisMonthExpenses = validExpenses.filter((e) => e.date.startsWith(CURRENT_MONTH));
    const monthTotalBase = thisMonthExpenses.reduce((s, e) => s + convertToBase(e.amount, e.currency || 'SAR'), 0);

    const pendingList = expenses.filter((e) =>
      ['بانتظار المشرف', 'بانتظار مدير القسم', 'بانتظار المدير', 'بانتظار المالك'].includes(e.approvalStatus)
    );
    const pendingBase = pendingList.reduce((s, e) => s + convertToBase(e.amount, e.currency || 'SAR'), 0);

    const unpaidExpenses = validExpenses.filter(
      (e) => e.approvalStatus !== 'مسودة' && (e.paymentStatus === 'لم يُدفع' || e.paymentStatus === 'مدفوع جزئياً')
    );
    const unpaidInvoices = supplierInvoices.filter(
      (inv) => inv.status !== 'ملغاة' && inv.status !== 'مدفوعة بالكامل' && inv.remainingAmount > 0
    );
    const unpaidBase =
      unpaidExpenses.reduce((s, e) => s + convertToBase(e.remainingAmount ?? e.amount, e.currency || 'SAR'), 0) +
      unpaidInvoices.reduce((s, inv) => s + convertToBase(inv.remainingAmount, inv.currency || 'SAR'), 0);

    const catTotals = new Map<string, number>();
    for (const e of validExpenses) {
      catTotals.set(e.category, (catTotals.get(e.category) || 0) + convertToBase(e.amount, e.currency || 'SAR'));
    }
    let topCat = '—';
    let topCatBase = 0;
    for (const [cat, val] of catTotals.entries()) {
      if (val > topCatBase) {
        topCat = cat;
        topCatBase = val;
      }
    }

    return {
      monthTotalBase: Math.round(monthTotalBase * 100) / 100,
      pendingCount: pendingList.length,
      pendingBase: Math.round(pendingBase * 100) / 100,
      unpaidCount: unpaidExpenses.length + unpaidInvoices.length,
      unpaidBase: Math.round(unpaidBase * 100) / 100,
      topCat,
      topCatBase: Math.round(topCatBase * 100) / 100,
    };
  }, [state, expenses, supplierInvoices, convertToBase]);

  // Filtered Lists
  const filteredExpenses = useMemo(() => {
    if (!state) return [];
    const q = searchQuery.trim().toLowerCase();
    return expenses.filter((e) => {
      if (propertyFilter !== 'all' && e.propertyId !== propertyFilter) return false;
      if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;

      if (quickChip === 'this_month' && !e.date.startsWith(CURRENT_MONTH)) return false;
      if (
        quickChip === 'unapproved' &&
        !['بانتظار المشرف', 'بانتظار مدير القسم', 'بانتظار المدير', 'بانتظار المالك'].includes(e.approvalStatus)
      ) {
        return false;
      }
      if (quickChip === 'drafts' && e.approvalStatus !== 'مسودة') return false;
      if (quickChip === 'overdue') {
        const isUnpaid = e.paymentStatus === 'لم يُدفع' || e.paymentStatus === 'مدفوع جزئياً';
        const isPastDue = Boolean(e.dueDate && e.dueDate < TODAY_STR);
        if (!isUnpaid && !isPastDue) return false;
      }

      if (!q) return true;
      const prop = state.properties.find((p) => p.id === e.propertyId);
      const vendor = state.vendors.find((v) => v.id === e.vendorId);
      const haystack = [
        e.expenseNumber,
        e.invoiceNumber,
        e.category,
        e.subCategory || '',
        e.notes || '',
        prop?.nameAr || '',
        prop?.nameEn || '',
        vendor?.nameAr || '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [state, expenses, searchQuery, quickChip, categoryFilter, propertyFilter]);

  const filteredInvoices = useMemo(() => {
    if (!state) return [];
    const q = searchQuery.trim().toLowerCase();
    return supplierInvoices.filter((inv) => {
      if (propertyFilter !== 'all' && inv.propertyId !== propertyFilter) return false;
      if (quickChip === 'this_month' && !inv.invoiceDate.startsWith(CURRENT_MONTH)) return false;
      if (quickChip === 'unapproved' && inv.status !== 'بانتظار الاعتماد') return false;
      if (quickChip === 'drafts' && inv.status !== 'مسودة') return false;
      if (quickChip === 'overdue' && inv.status !== 'متأخرة' && !(inv.dueDate && inv.dueDate < TODAY_STR && inv.remainingAmount > 0)) {
        return false;
      }
      if (!q) return true;
      const prop = state.properties.find((p) => p.id === inv.propertyId);
      const vendor = state.vendors.find((v) => v.id === inv.vendorId);
      const haystack = [inv.invoiceCode, inv.supplierInvoiceNumber, inv.notes || '', prop?.nameAr || '', vendor?.nameAr || '']
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [state, supplierInvoices, searchQuery, quickChip, propertyFilter]);

  // Analytics & Forecasts
  const analytics = useMemo(() => {
    if (!state) return { byCategory: [], byProperty: [], forecastNextMonthSar: 0, anomalies: [] as Array<{ category: string; currentSar: number; avgSar: number; pctJump: number }> };
    const valid = expenses.filter((e) => e.approvalStatus !== 'ملغى' && e.approvalStatus !== 'مرفوض');

    const catMap = new Map<string, number>();
    const propMap = new Map<string, number>();
    const monthCatMap = new Map<string, { current: number; priorTotal: number; priorMonths: Set<string> }>();

    for (const e of valid) {
      const baseVal = Math.round(convertToBase(e.amount, e.currency || 'SAR') * 100) / 100;
      catMap.set(e.category, (catMap.get(e.category) || 0) + baseVal);
      propMap.set(e.propertyId, (propMap.get(e.propertyId) || 0) + baseVal);

      const sarVal = toSarRate(e.amount, e.currency || 'SAR');
      const m = e.date.slice(0, 7);
      const entry = monthCatMap.get(e.category) || { current: 0, priorTotal: 0, priorMonths: new Set<string>() };
      if (m === CURRENT_MONTH) {
        entry.current += sarVal;
      } else {
        entry.priorTotal += sarVal;
        entry.priorMonths.add(m);
      }
      monthCatMap.set(e.category, entry);
    }

    const byCategory = Array.from(catMap.entries())
      .map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }))
      .sort((a, b) => b.value - a.value);

    const byProperty = state.properties
      .map((p) => ({
        name: isAr ? p.nameAr : p.nameEn,
        value: Math.round((propMap.get(p.id) || 0) * 100) / 100,
      }))
      .filter((x) => x.value > 0)
      .sort((a, b) => b.value - a.value);

    const recurringMonthlySar = recurringRules
      .filter((r) => r.enabled)
      .reduce((s, r) => {
        const sar = toSarRate(r.estimatedAmount, r.currency);
        return s + (r.frequency === 'شهري' ? sar : r.frequency === 'ربع سنوي' ? sar / 3 : sar / 12);
      }, 0);
    const variableMonthlyAvgSar =
      valid
        .filter((e) => !e.isRecurringInstance)
        .reduce((s, e) => s + toSarRate(e.amount, e.currency || 'SAR'), 0) / Math.max(1, new Set(valid.map((e) => e.date.slice(0, 7))).size);

    const forecastNextMonthSar = Math.round((recurringMonthlySar + variableMonthlyAvgSar) * 100) / 100;

    const anomalies: Array<{ category: string; currentSar: number; avgSar: number; pctJump: number }> = [];
    for (const [cat, stats] of monthCatMap.entries()) {
      const priorAvg = stats.priorMonths.size > 0 ? stats.priorTotal / stats.priorMonths.size : 0;
      if (priorAvg > 0 && stats.current > priorAvg * 1.35) {
        anomalies.push({
          category: cat,
          currentSar: Math.round(stats.current),
          avgSar: Math.round(priorAvg),
          pctJump: Math.round(((stats.current - priorAvg) / priorAvg) * 100),
        });
      }
    }

    return { byCategory, byProperty, forecastNextMonthSar, anomalies };
  }, [state, expenses, recurringRules, convertToBase, isAr]);

  if (!state || !currentUser) return null;

  const canActOnExpense = (exp: Expense) => {
    const isSelf = exp.createdBy === currentUser.id && currentUser.role !== 'gm' && currentUser.role !== 'sys_owner';
    if (isSelf) return false;
    const isTop = currentUser.role === 'gm' || currentUser.role === 'sys_owner';
    if (exp.approvalStatus === 'بانتظار المشرف') return hasPermission('approve_expense_supervisor') || isTop;
    if (exp.approvalStatus === 'بانتظار مدير القسم') return hasPermission('approve_expense_supervisor') || isTop;
    if (exp.approvalStatus === 'بانتظار المدير') return hasPermission('approve_expense_manager');
    if (exp.approvalStatus === 'بانتظار المالك') return currentUser.role === 'owner' || isTop;
    return false;
  };

  const handleExpenseDecision = async (exp: Expense, decision: 'approve' | 'reject' | 'submit', reason?: string) => {
    const res = await mutate(
      'POST',
      `/api/expenses/${exp.id}/decision`,
      { decision, reason },
      { offlineDescAr: decision === 'approve' ? `اعتماد مصروف ${exp.expenseNumber}` : decision === 'submit' ? `إرسال مصروف ${exp.expenseNumber}` : `رفض مصروف ${exp.expenseNumber}` }
    );
    if (res) {
      triggerHaptic(decision === 'reject' ? 'warning' : 'success');
      pushToast(
        'success',
        decision === 'submit'
          ? isAr ? 'تم إرسال المسودة لسير الاعتماد' : 'Draft submitted for approval'
          : decision === 'approve'
          ? isAr ? 'تم تحديث اعتماد المصروف بنجاح' : 'Expense approval updated'
          : isAr ? 'تم رفض المصروف وتسجيل السبب' : 'Expense rejected'
      );
    }
  };

  const triggerApproveClick = (exp: Expense) => {
    const sarVal = toSarRate(exp.amount, exp.currency || 'SAR');
    if (sarVal > 5000 && exp.approvalStatus !== 'بانتظار المشرف') {
      setPinApproveModal({ expense: exp, pin: '' });
      return;
    }
    if (sarVal > 5000 && (currentUser.role === 'gm' || currentUser.role === 'sys_owner')) {
      setPinApproveModal({ expense: exp, pin: '' });
      return;
    }
    void handleExpenseDecision(exp, 'approve');
  };

  const confirmPinApprove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinApproveModal) return;
    const storedPin = localStorage.getItem(PIN_STORAGE_KEY) || '1234';
    if (pinApproveModal.pin.trim() !== storedPin) {
      triggerHaptic('error');
      pushToast('error', isAr ? 'رمز PIN الأمني غير صحيح (الافتراضي 1234)' : 'Invalid Master PIN');
      return;
    }
    const target = pinApproveModal.expense;
    setPinApproveModal(null);
    await handleExpenseDecision(target, 'approve');
  };

  const handleSubmitPayVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payVoucherModal) return;
    const res = await mutate(
      'PATCH',
      `/api/expenses/${payVoucherModal.expense.id}`,
      {
        action: 'pay',
        paidAmount: payVoucherModal.paidAmount,
        paymentMethod: payVoucherModal.paymentMethod,
        paidFromAccount: payVoucherModal.paidFromAccount,
        referenceNumber: payVoucherModal.referenceNumber,
      },
      { offlineDescAr: `سند صرف للمصروف ${payVoucherModal.expense.expenseNumber}` }
    );
    if (res) {
      triggerHaptic('success');
      pushToast('success', isAr ? 'تم تسجيل سند الصرف وتحديث حالة السداد' : 'Disbursement recorded');
      setPayVoucherModal(null);
    }
  };

  const handleConfirmCancelExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelExpenseModal) return;
    if (cancelExpenseModal.reason.trim().length < 4) {
      pushToast('error', isAr ? 'يرجى كتابة سبب واضح (4 أحرف على الأقل)' : 'Reason required');
      return;
    }
    if (cancelExpenseModal.expense.approvalStatus === 'معتمد') {
      const storedPin = localStorage.getItem(PIN_STORAGE_KEY) || '1234';
      if (cancelExpenseModal.pin.trim() !== storedPin) {
        triggerHaptic('error');
        pushToast('error', isAr ? 'إلغاء مصروف معتمد يتطلب رمز PIN المدير الصحيح' : 'Manager PIN required');
        return;
      }
    }
    const res = await mutate(
      'PATCH',
      `/api/expenses/${cancelExpenseModal.expense.id}`,
      { action: 'cancel', reason: cancelExpenseModal.reason.trim() },
      { offlineDescAr: `إلغاء المصروف ${cancelExpenseModal.expense.expenseNumber}` }
    );
    if (res) {
      triggerHaptic('warning');
      pushToast(
        'success',
        cancelExpenseModal.expense.approvalStatus === 'معتمد'
          ? isAr ? 'تم إلغاء المصروف وعكس القيد المحاسبي تلقائياً' : 'Expense cancelled & GL reversed'
          : isAr ? 'تم إلغاء المصروف وحفظه في سجل التدقيق' : 'Expense cancelled'
      );
      setCancelExpenseModal(null);
    }
  };

  // Supplier Invoice Helpers
  const invSubtotal = Math.round(invForm.items.reduce((s, li) => s + li.total, 0) * 100) / 100;
  const invVatAmount = invForm.vatApplicable ? Math.round(invSubtotal * 0.15 * 100) / 100 : 0;
  const invTotalAmount = Math.round((invSubtotal + invVatAmount) * 100) / 100;

  const handleCreateSupplierInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const vendorId = invForm.vendorId || state.vendors[0]?.id;
    const propertyId = invForm.propertyId || state.properties[0]?.id;
    if (!vendorId || !propertyId) {
      pushToast('error', isAr ? 'يرجى تحديد المورد والعقار' : 'Select vendor and property');
      return;
    }
    const validItems = invForm.items.filter((li) => li.description.trim() && li.total > 0);
    if (validItems.length === 0) {
      pushToast('error', isAr ? 'أضف بنداً واحداً على الأقل بقيمة صحيحة' : 'Add at least one valid line item');
      return;
    }

    const res = await mutate(
      'POST',
      '/api/supplier-invoices',
      {
        supplierInvoiceNumber: invForm.supplierInvoiceNumber.trim(),
        invoiceDate: invForm.invoiceDate,
        receivedDate: invForm.receivedDate,
        dueDate: invForm.dueDate,
        vendorId,
        propertyId,
        unitId: invForm.unitId || undefined,
        ticketId: invForm.ticketId || undefined,
        items: validItems,
        subtotal: invSubtotal,
        vatAmount: invVatAmount,
        totalAmount: invTotalAmount,
        paidAmount: 0,
        remainingAmount: invTotalAmount,
        currency: invForm.currency,
        status: 'بانتظار الاعتماد',
        zatcaQrVerified: invForm.zatcaQrVerified,
        notes: invForm.notes || undefined,
      },
      { offlineDescAr: `تسجيل فاتورة مورد ${invForm.supplierInvoiceNumber}` }
    );
    if (res) {
      triggerHaptic('success');
      pushToast('success', isAr ? 'تم تسجيل فاتورة المورد وإرسالها للاعتماد' : 'Supplier invoice recorded');
      setShowAddInvoice(false);
    }
  };

  const handleCreateRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    const propertyId = recForm.propertyId || state.properties[0]?.id;
    if (!propertyId) return;
    const res = await mutate(
      'POST',
      '/api/recurring-expenses',
      {
        ...recForm,
        propertyId,
        vendorId: recForm.vendorId || undefined,
        enabled: true,
      },
      { offlineDescAr: `إضافة قاعدة مصروف دوري: ${recForm.title}` }
    );
    if (res) {
      triggerHaptic('success');
      pushToast('success', isAr ? 'تمت جدولة المصروف الدوري بنجاح' : 'Recurring expense rule saved');
      setShowAddRecurring(false);
      setRecForm((prev) => ({ ...prev, title: '' }));
    }
  };

  const handleGenerateRecurringMonth = async () => {
    const res = await mutate<{ created: Expense[]; count: number }>(
      'POST',
      '/api/recurring-expenses/generate',
      { month: CURRENT_MONTH },
      { offlineDescAr: `توليد مسودات المصروفات الدورية لشهر ${CURRENT_MONTH}` }
    );
    if (res) {
      triggerHaptic('success');
      pushToast(
        'success',
        res.count > 0
          ? isAr ? `تم توليد ${res.count} مسودة مصروف لشهر ${CURRENT_MONTH}` : `Generated ${res.count} draft expenses`
          : isAr ? `جميع المصروفات الدورية المفعلة مولّدة مسبقاً لشهر ${CURRENT_MONTH}` : `All active recurring rules already generated for ${CURRENT_MONTH}`
      );
    }
  };

  const handleSavePropertyBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    const propertyId = budgetForm.propertyId || state.properties[0]?.id;
    if (!propertyId) return;
    const res = await mutate(
      'POST',
      '/api/property-budgets',
      { ...budgetForm, propertyId },
      { offlineDescAr: `تحديث ميزانية عقار ${budgetForm.month}` }
    );
    if (res) {
      triggerHaptic('success');
      pushToast('success', isAr ? 'تم حفظ الميزانية الشهرية للعقار' : 'Property budget saved');
      setShowBudgetModal(false);
    }
  };

  return (
    <div className="rounded-3xl bg-gradient-to-br from-[#0A0E1A] via-[#121829] to-[#1A1F2E] border border-white/10 p-4 sm:p-6 text-slate-100 space-y-6 shadow-2xl">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs text-blue-300 font-semibold mb-1">
            <Receipt className="w-4 h-4" />
            <span>{isAr ? 'النظام المالي الموحد — النطاق العقاري والموردون' : 'Unified Expense & Vendor Invoice Hub'}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            {isAr ? 'مركز المصروفات وفواتير الموردين' : 'Expenses & Supplier Invoices Center'}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          <button
            type="button"
            onClick={() => {
              const name = exportExpensesReportToExcel({
                state,
                expenses: filteredExpenses,
                supplierInvoices: filteredInvoices,
                lang,
                baseCurrency,
                currencyRates: state.settings.currencyRatesToSar,
              });
              pushToast('success', isAr ? `تم تصدير التقرير: ${name}` : `Exported ${name}`);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/[0.1] text-xs font-semibold text-slate-200 cursor-pointer min-h-[40px]"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>{isAr ? 'تصدير Excel' : 'Export Excel'}</span>
          </button>

          {hasPermission('create_expense') && (
            <button
              type="button"
              onClick={() => {
                setEditingExpense(null);
                setWizardOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-l from-[#26478D] to-blue-600 hover:from-blue-600 hover:to-[#26478D] text-white text-xs font-bold shadow-lg shadow-blue-900/30 cursor-pointer min-h-[40px]"
            >
              <Plus className="w-4 h-4" />
              <span>{isAr ? 'تسجيل مصروف وفاتورة' : 'New Expense Wizard'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 4 Live KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
        <div className="rounded-2xl bg-white/[0.04] backdrop-blur-md border border-white/10 p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{isAr ? `مصروفات الشهر (${CURRENT_MONTH})` : `Monthly Expenses (${CURRENT_MONTH})`}</span>
            <Wallet className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold font-mono-num text-white">
            {formatCurrency(kpis.monthTotalBase, baseCurrency, lang)}
          </div>
          <div className="text-[11px] text-slate-400">
            {isAr ? 'شامل الضريبة للمصروفات النشطة' : 'Incl. VAT for active expenses'}
          </div>
        </div>

        <div className="rounded-2xl bg-white/[0.04] backdrop-blur-md border border-amber-400/20 p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{isAr ? 'بانتظار الاعتماد' : 'Pending Approval'}</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono-num text-amber-300">{kpis.pendingCount}</span>
            <span className="text-xs font-mono-num text-slate-300">
              ({formatCurrency(kpis.pendingBase, baseCurrency, lang)})
            </span>
          </div>
          <div className="text-[11px] text-slate-400">
            {isAr ? 'مشرف / مدير قسم / مدير عام / مالك' : 'Multi-tier workflow'}
          </div>
        </div>

        <div className="rounded-2xl bg-white/[0.04] backdrop-blur-md border border-red-400/20 p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{isAr ? 'غير مدفوعة / آجلة' : 'Unpaid / Overdue'}</span>
            <CreditCard className="w-4 h-4 text-red-400" />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-mono-num text-red-300">{kpis.unpaidCount}</span>
            <span className="text-xs font-mono-num text-slate-300">
              ({formatCurrency(kpis.unpaidBase, baseCurrency, lang)})
            </span>
          </div>
          <div className="text-[11px] text-slate-400">
            {isAr ? 'مصروفات + فواتير موردين متبقية' : 'Expenses + Supplier Invoices'}
          </div>
        </div>

        <div className="rounded-2xl bg-white/[0.04] backdrop-blur-md border border-emerald-400/20 p-4 space-y-1">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{isAr ? 'أعلى فئة إنفاقاً' : 'Top Spending Category'}</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-base font-bold text-emerald-300 truncate">{kpis.topCat}</div>
          <div className="text-xs font-mono-num text-slate-300">
            {formatCurrency(kpis.topCatBase, baseCurrency, lang)}
          </div>
        </div>
      </div>

      {/* Sub-Tabs Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3 no-print">
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'expenses' as const, labelAr: `سجل المصروفات (${expenses.length})`, labelEn: `Expenses (${expenses.length})`, icon: Receipt },
            { id: 'invoices' as const, labelAr: `فواتير الموردين (${supplierInvoices.length})`, labelEn: `Supplier Invoices (${supplierInvoices.length})`, icon: FileText },
            { id: 'recurring_budgets' as const, labelAr: `المتكررة والميزانيات والتوقعات`, labelEn: `Recurring, Budgets & Forecast`, icon: CalendarClock },
            { id: 'reports' as const, labelAr: `التقارير والمؤشرات`, labelEn: `Charts & Analytics`, icon: BarChart3 },
          ].map((t) => {
            const Icon = t.icon;
            const active = subTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer min-h-[38px] ${
                  active
                    ? 'bg-[#26478D] text-white shadow-md shadow-blue-900/30'
                    : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.09] border border-white/10'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{isAr ? t.labelAr : t.labelEn}</span>
              </button>
            );
          })}
        </div>

        {subTab === 'invoices' && hasPermission('create_expense') && (
          <button
            type="button"
            onClick={() => {
              setInvForm((prev) => ({
                ...prev,
                vendorId: prev.vendorId || state.vendors[0]?.id || '',
                propertyId: prev.propertyId || state.properties[0]?.id || '',
                supplierInvoiceNumber: `INV-SUP-${Math.floor(1000 + Math.random() * 8999)}`,
              }));
              setShowAddInvoice(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer min-h-[38px]"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{isAr ? 'تسجيل فاتورة مورد تفصيلية' : 'New Supplier Invoice'}</span>
          </button>
        )}
      </div>

      {/* Filter Bar (Shown on Expenses & Invoices tabs) */}
      {(subTab === 'expenses' || subTab === 'invoices') && (
        <div className="space-y-3 no-print">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAr ? 'بحث برقم المصروف، الفاتورة، العقار، المورد، البيان...' : 'Search expense #, invoice, property, vendor...'}
                className="w-full ps-9 pe-3 py-2 rounded-xl bg-white/[0.05] border border-white/10 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-blue-400"
              />
            </div>

            <select
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[#0F1526] border border-white/10 text-xs text-slate-200 min-h-[38px]"
            >
              <option value="all">{isAr ? 'جميع العقارات' : 'All Properties'}</option>
              {state.properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {isAr ? p.nameAr : p.nameEn}
                </option>
              ))}
            </select>

            {subTab === 'expenses' && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 rounded-xl bg-[#0F1526] border border-white/10 text-xs text-slate-200 min-h-[38px]"
              >
                <option value="all">{isAr ? 'جميع الفئات' : 'All Categories'}</option>
                {Array.from(new Set(expenses.map((e) => e.category))).map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <Filter className="w-3.5 h-3.5 text-slate-400 me-1" />
            {[
              { id: 'all' as const, labelAr: 'الكل', labelEn: 'All' },
              { id: 'this_month' as const, labelAr: 'هذا الشهر', labelEn: 'This Month' },
              { id: 'unapproved' as const, labelAr: 'غير معتمد', labelEn: 'Unapproved' },
              { id: 'overdue' as const, labelAr: 'غير مدفوع / متأخر', labelEn: 'Unpaid / Overdue' },
              { id: 'drafts' as const, labelAr: 'المسودات', labelEn: 'Drafts' },
            ].map((chip) => (
              <button
                key={chip.id}
                type="button"
                onClick={() => setQuickChip(chip.id)}
                className={`px-3 py-1.5 rounded-xl font-semibold cursor-pointer transition-colors ${
                  quickChip === chip.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/[0.04] text-slate-300 hover:bg-white/[0.08] border border-white/10'
                }`}
              >
                {isAr ? chip.labelAr : chip.labelEn}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 1: EXPENSES REGISTRY */}
      {subTab === 'expenses' && (
        <div className="space-y-3">
          {filteredExpenses.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-xs text-slate-400">
              {isAr ? 'لا توجد مصروفات مطابقة لمعايير البحث الحالية.' : 'No matching expenses found.'}
            </div>
          ) : (
            filteredExpenses.map((exp) => {
              const prop = state.properties.find((p) => p.id === exp.propertyId);
              const unit = state.units.find((u) => u.id === exp.unitId);
              const vendor = state.vendors.find((v) => v.id === exp.vendorId);
              const creator = state.users.find((u) => u.id === exp.createdBy);
              const canAct = canActOnExpense(exp);
              const hasAttachments = Boolean(
                exp.invoiceImageDataUrl || exp.invoicePdfDataUrl || (exp.workPhotosDataUrls && exp.workPhotosDataUrls.length > 0)
              );
              const isOverdue = Boolean(
                exp.dueDate && exp.dueDate < TODAY_STR && exp.paymentStatus !== 'مدفوع بالكامل' && exp.approvalStatus !== 'ملغى'
              );
              const canEdit =
                hasPermission('create_expense') &&
                exp.approvalStatus !== 'ملغى' &&
                (exp.approvalStatus !== 'معتمد' || currentUser.role === 'gm' || currentUser.role === 'sys_owner');
              const canPay =
                exp.approvalStatus === 'معتمد' &&
                exp.paymentStatus !== 'مدفوع بالكامل' &&
                (hasPermission('manage_accounting') || hasPermission('create_expense'));
              const canCancel =
                exp.approvalStatus !== 'ملغى' &&
                (exp.approvalStatus === 'معتمد' ? hasPermission('approve_expense_manager') : hasPermission('create_expense'));

              return (
                <div
                  key={exp.id}
                  className="rounded-2xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.06] transition-all p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono-num text-xs font-bold text-blue-300">{exp.expenseNumber}</span>
                        <span className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-semibold ${getApprovalBadgeClass(exp.approvalStatus)}`}>
                          {exp.approvalStatus}
                        </span>
                        {exp.paymentStatus && (
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border ${
                              exp.paymentStatus === 'مدفوع بالكامل'
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-400/20'
                                : isOverdue
                                ? 'bg-red-500/15 text-red-300 border-red-400/30'
                                : 'bg-amber-500/10 text-amber-300 border-amber-400/20'
                            }`}
                          >
                            {exp.paymentStatus}
                            {isOverdue ? ' · متأخر' : ''}
                          </span>
                        )}
                        {exp.zatcaQrVerified && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-teal-500/15 text-teal-300 border border-teal-400/25 text-[10px] font-semibold">
                            <QrCode className="w-3 h-3" />
                            <span>ZATCA QR</span>
                          </span>
                        )}
                        {exp.isRecurringInstance && (
                          <span className="px-2 py-0.5 rounded-lg bg-purple-500/15 text-purple-300 border border-purple-400/25 text-[10px] font-semibold">
                            دوري متكرر
                          </span>
                        )}
                        {exp.registerAsAsset && (
                          <span className="px-2 py-0.5 rounded-lg bg-indigo-500/15 text-indigo-300 border border-indigo-400/25 text-[10px] font-semibold">
                            أصل رأسمالي
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-bold text-white">
                        {exp.category}
                        {exp.subCategory ? ` · ${exp.subCategory}` : ''} — {prop ? (isAr ? prop.nameAr : prop.nameEn) : '—'}
                        {unit ? ` (${unit.unitNumber})` : ''}
                      </div>

                      <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-mono-num">فاتورة: {exp.invoiceNumber || '—'}</span>
                        <span className="font-mono-num">تاريخ: {exp.date}</span>
                        <span>المورد: {vendor?.nameAr || 'توريد مباشر'}</span>
                        <span>المتحمل: {exp.bearer}</span>
                        <span>الدفع: {exp.paymentMethod}</span>
                        {creator && <span>بواسطة: {creator.nameAr}</span>}
                      </div>
                    </div>

                    <div className="text-end space-y-0.5">
                      <div className="text-lg font-bold font-mono-num text-white">
                        {formatInCurrency(exp.amount, exp.currency || 'SAR')}
                      </div>
                      {(exp.currency || 'SAR') !== baseCurrency && (
                        <div className="text-[11px] font-mono-num text-slate-400">
                          ≈ {formatConvertedBase(exp.amount, exp.currency || 'SAR')}
                        </div>
                      )}
                      {exp.netAmount !== undefined && exp.vatAmount !== undefined && (
                        <div className="text-[10px] font-mono-num text-slate-400">
                          صافي {exp.netAmount.toLocaleString()} + ضريبة {exp.vatAmount.toLocaleString()}
                        </div>
                      )}
                      {exp.remainingAmount !== undefined && exp.remainingAmount > 0 && exp.approvalStatus !== 'ملغى' && (
                        <div className="text-[11px] font-mono-num text-amber-300">
                          المتبقي للسداد: {formatInCurrency(exp.remainingAmount, exp.currency || 'SAR')}
                        </div>
                      )}
                    </div>
                  </div>

                  {exp.notes && <p className="text-xs text-slate-300 bg-white/[0.03] rounded-xl px-3 py-2">{exp.notes}</p>}
                  {(exp.rejectionReason || exp.cancellationReason) && (
                    <div className="text-xs text-red-300 bg-red-500/10 border border-red-400/20 rounded-xl px-3 py-2">
                      سبب {exp.approvalStatus === 'مرفوض' ? 'الرفض' : 'الإلغاء'}: {exp.rejectionReason || exp.cancellationReason}
                    </div>
                  )}

                  {/* Actions Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/10 no-print">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
                      {exp.approvedBySupervisor && <span className="px-2 py-0.5 rounded bg-white/[0.04]">✓ مشرف</span>}
                      {exp.approvedByDeptManager && <span className="px-2 py-0.5 rounded bg-white/[0.04]">✓ مدير قسم</span>}
                      {exp.approvedByManager && <span className="px-2 py-0.5 rounded bg-white/[0.04]">✓ مدير عام</span>}
                      {exp.approvedByOwner && <span className="px-2 py-0.5 rounded bg-white/[0.04]">✓ المالك</span>}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {exp.approvalStatus === 'مسودة' && hasPermission('create_expense') && (
                        <button
                          type="button"
                          onClick={() => void handleExpenseDecision(exp, 'submit')}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold cursor-pointer"
                        >
                          <Send className="w-3 h-3" />
                          <span>{isAr ? 'إرسال للاعتماد' : 'Submit'}</span>
                        </button>
                      )}

                      {canAct && (
                        <>
                          <button
                            type="button"
                            onClick={() => triggerApproveClick(exp)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>
                              {toSarRate(exp.amount, exp.currency || 'SAR') > 5000
                                ? isAr ? 'اعتماد (PIN)' : 'Approve (PIN)'
                                : isAr ? 'اعتماد' : 'Approve'}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setRejectModal({ expense: exp, reason: '' })}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-400/30 text-red-300 hover:bg-red-500/10 text-[11px] font-semibold cursor-pointer"
                          >
                            <XCircle className="w-3 h-3" />
                            <span>{isAr ? 'رفض' : 'Reject'}</span>
                          </button>
                        </>
                      )}

                      {canPay && (
                        <button
                          type="button"
                          onClick={() =>
                            setPayVoucherModal({
                              expense: exp,
                              paidAmount: exp.remainingAmount ?? exp.amount,
                              paymentMethod: exp.paymentMethod === 'آجل' ? 'تحويل بنكي' : exp.paymentMethod,
                              paidFromAccount: exp.paidFromAccount || 'مصرف الراجحي — حساب التشغيل',
                              referenceNumber: `PAY-${Math.floor(10000 + Math.random() * 89999)}`,
                            })
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-semibold cursor-pointer"
                        >
                          <CreditCard className="w-3 h-3" />
                          <span>{isAr ? 'سند صرف / سداد' : 'Record Payout'}</span>
                        </button>
                      )}

                      {hasAttachments && (
                        <button
                          type="button"
                          onClick={() => setAttachmentPreviewExp(exp)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/15 bg-white/[0.04] hover:bg-white/[0.1] text-slate-200 text-[11px] cursor-pointer"
                        >
                          <Eye className="w-3 h-3" />
                          <span>{isAr ? 'المرفقات' : 'Attachments'}</span>
                        </button>
                      )}

                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingExpense(exp);
                            setWizardOpen(true);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/15 bg-white/[0.04] hover:bg-white/[0.1] text-slate-200 text-[11px] cursor-pointer"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>{isAr ? 'تعديل' : 'Edit'}</span>
                        </button>
                      )}

                      {canCancel && (
                        <button
                          type="button"
                          onClick={() => setCancelExpenseModal({ expense: exp, reason: '', pin: '' })}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-400/25 text-red-300 hover:bg-red-500/10 text-[11px] cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>{isAr ? 'إلغاء' : 'Cancel'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SUB-TAB 2: SUPPLIER INVOICES */}
      {subTab === 'invoices' && (
        <div className="space-y-3">
          {filteredInvoices.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-10 text-center text-xs text-slate-400">
              {isAr ? 'لا توجد فواتير موردين مطابقة للبحث.' : 'No matching supplier invoices.'}
            </div>
          ) : (
            filteredInvoices.map((inv) => {
              const prop = state.properties.find((p) => p.id === inv.propertyId);
              const vendor = state.vendors.find((v) => v.id === inv.vendorId);
              const isPastDue = Boolean(inv.dueDate && inv.dueDate < TODAY_STR && inv.remainingAmount > 0 && inv.status !== 'ملغاة');
              return (
                <div key={inv.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono-num text-xs font-bold text-blue-300">{inv.invoiceCode}</span>
                        <span className="font-mono-num text-xs text-slate-300">({inv.supplierInvoiceNumber})</span>
                        <span className={`px-2.5 py-0.5 rounded-lg border text-[11px] font-semibold ${getInvoiceBadgeClass(inv.status)}`}>
                          {inv.status}
                        </span>
                        {isPastDue && (
                          <span className="px-2 py-0.5 rounded-lg bg-red-500/20 text-red-300 border border-red-400/30 text-[10px] font-semibold">
                            استحقاق متأخر
                          </span>
                        )}
                        {inv.zatcaQrVerified && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-teal-500/15 text-teal-300 text-[10px] font-semibold">
                            <QrCode className="w-3 h-3" />
                            <span>فاتورة إلكترونية ZATCA</span>
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-bold text-white">
                        {vendor?.nameAr || 'مورد غير محدد'} — {prop?.nameAr || '—'}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono-num flex flex-wrap gap-x-4 gap-y-1">
                        <span>تاريخ الفاتورة: {inv.invoiceDate}</span>
                        <span>تاريخ الاستلام: {inv.receivedDate}</span>
                        {inv.dueDate && <span>تاريخ الاستحقاق: {inv.dueDate}</span>}
                      </div>
                    </div>

                    <div className="text-end space-y-0.5">
                      <div className="text-lg font-bold font-mono-num text-white">
                        {formatInCurrency(inv.totalAmount, inv.currency)}
                      </div>
                      <div className="text-[11px] font-mono-num text-slate-400">
                        صافي {inv.subtotal.toLocaleString()} + ضريبة {inv.vatAmount.toLocaleString()}
                      </div>
                      <div className="text-[11px] font-mono-num">
                        <span className="text-emerald-300">المدفوع: {inv.paidAmount.toLocaleString()}</span> ·{' '}
                        <span className="text-amber-300">المتبقي: {inv.remainingAmount.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div className="rounded-xl bg-white/[0.03] border border-white/10 overflow-x-auto">
                    <table className="w-full text-start text-[11px]">
                      <thead className="text-slate-400 border-b border-white/10">
                        <tr>
                          <th className="py-2 px-3 text-start">البند / الوصف</th>
                          <th className="py-2 px-3 text-start">الكمية</th>
                          <th className="py-2 px-3 text-start">سعر الوحدة</th>
                          <th className="py-2 px-3 text-end">الإجمالي</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {inv.items.map((item) => (
                          <tr key={item.id}>
                            <td className="py-2 px-3 text-slate-200">{item.description}</td>
                            <td className="py-2 px-3 font-mono-num">{item.quantity}</td>
                            <td className="py-2 px-3 font-mono-num">{item.unitPrice.toLocaleString()}</td>
                            <td className="py-2 px-3 text-end font-mono-num font-semibold">{item.total.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {inv.cancellationReason && (
                    <div className="text-xs text-red-300 bg-red-500/10 border border-red-400/20 rounded-xl px-3 py-2">
                      سبب الإلغاء: {inv.cancellationReason}
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1 no-print">
                    {(inv.status === 'مسودة' || inv.status === 'بانتظار الاعتماد') && hasPermission('approve_expense_supervisor') && (
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await mutate('PATCH', `/api/supplier-invoices/${inv.id}`, { status: 'معتمدة' });
                          if (res) {
                            triggerHaptic('success');
                            pushToast('success', isAr ? 'تم اعتماد فاتورة المورد' : 'Invoice approved');
                          }
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{isAr ? 'اعتماد الفاتورة' : 'Approve Invoice'}</span>
                      </button>
                    )}

                    {inv.remainingAmount > 0 && inv.status !== 'ملغاة' && hasPermission('manage_accounting') && (
                      <button
                        type="button"
                        onClick={() => setPayInvModal({ invoice: inv, payAmount: inv.remainingAmount })}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-semibold cursor-pointer"
                      >
                        <CreditCard className="w-3 h-3" />
                        <span>{isAr ? 'تسجيل دفعة سداد' : 'Record Payment'}</span>
                      </button>
                    )}

                    {inv.status !== 'ملغاة' && inv.status !== 'مدفوعة بالكامل' && hasPermission('create_expense') && (
                      <button
                        type="button"
                        onClick={() => setCancelInvModal({ invoice: inv, reason: '' })}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-400/25 text-red-300 hover:bg-red-500/10 text-[11px] cursor-pointer"
                      >
                        <XCircle className="w-3 h-3" />
                        <span>{isAr ? 'إلغاء الفاتورة' : 'Cancel'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* SUB-TAB 3: RECURRING EXPENSES, BUDGETS & FORECASTING */}
      {subTab === 'recurring_budgets' && (
        <div className="space-y-6">
          {/* Smart Forecasting & Anomaly Banner */}
          <div className="rounded-2xl border border-blue-400/25 bg-gradient-to-l from-blue-500/10 to-indigo-500/10 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-300" />
                <h3 className="text-sm font-bold text-white">
                  {isAr ? 'التوقعات المالية الذكية ومراقبة الانحرافات' : 'Expense Forecasting & Anomaly Insights'}
                </h3>
              </div>
              <div className="text-xs font-mono-num px-3 py-1 rounded-xl bg-white/[0.08] text-blue-200 font-bold">
                {isAr ? 'التوقع الإحصائي للشهر القادم:' : 'Projected Next Month:'}{' '}
                {formatConvertedBase(analytics.forecastNextMonthSar, 'SAR')}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 space-y-1.5">
                <div className="font-semibold text-slate-200">
                  {isAr ? 'تنبيهات الشذوذ وارتفاع الإنفاق (> 35% عن المتوسط):' : 'Spending Anomaly Alerts (> 35% vs avg):'}
                </div>
                {analytics.anomalies.length === 0 ? (
                  <p className="text-emerald-300 text-[11px]">
                    {isAr ? '✓ جميع فئات المصروفات لهذا الشهر ضمن المعدل التاريخي الطبيعي.' : 'All categories within normal historical average.'}
                  </p>
                ) : (
                  analytics.anomalies.map((a) => (
                    <div key={a.category} className="flex items-center justify-between text-amber-300 text-[11px]">
                      <span>
                        <AlertTriangle className="w-3 h-3 inline me-1" />
                        {a.category} (+{a.pctJump}%)
                      </span>
                      <span className="font-mono-num">
                        {a.currentSar.toLocaleString()} vs {a.avgSar.toLocaleString()} ر.س
                      </span>
                    </div>
                  ))
                )}
              </div>

              <div className="rounded-xl bg-white/[0.04] border border-white/10 p-3 space-y-1.5">
                <div className="font-semibold text-slate-200">
                  {isAr ? 'توصيات الصيانة الدورية المجدولة:' : 'Periodic Maintenance Advisories:'}
                </div>
                <p className="text-[11px] text-slate-300">
                  {isAr
                    ? '• فحص التكييف المركزي والسبليت كل 6 أشهر · فحص سلامة المصاعد شهرياً لتجنب تكاليف الأعطال الطارئة.'
                    : '• Schedule 6-month HVAC tune-ups & monthly elevator checks to prevent emergency repair spikes.'}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Recurring Expenses Rules */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-white">
                  {isAr ? `قواعد المصروفات الدورية (${recurringRules.length})` : `Recurring Rules (${recurringRules.length})`}
                </h3>
                <div className="flex flex-wrap items-center gap-2 no-print">
                  {hasPermission('create_expense') && (
                    <>
                      <button
                        type="button"
                        onClick={handleGenerateRecurringMonth}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>{isAr ? 'توليد مسودات الشهر' : 'Generate Monthly Drafts'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setRecForm((prev) => ({
                            ...prev,
                            propertyId: prev.propertyId || state.properties[0]?.id || '',
                          }));
                          setShowAddRecurring(true);
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#26478D] hover:bg-blue-700 text-white text-[11px] font-semibold cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{isAr ? 'قاعدة جديدة' : 'New Rule'}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="space-y-2.5">
                {recurringRules.map((rule) => {
                  const prop = state.properties.find((p) => p.id === rule.propertyId);
                  return (
                    <div
                      key={rule.id}
                      className="rounded-xl border border-white/10 bg-white/[0.03] p-3 flex items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-white">{rule.title}</div>
                        <div className="text-[11px] text-slate-400">
                          {rule.category} · {prop?.nameAr || '—'} · {rule.frequency} (يوم {rule.dayOfMonth})
                        </div>
                        <div className="text-[11px] font-mono-num text-blue-300">
                          {formatInCurrency(rule.estimatedAmount, rule.currency)} · يتحمله {rule.bearer}
                          {rule.lastGeneratedMonth ? ` · آخر توليد: ${rule.lastGeneratedMonth}` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          const res = await mutate('PATCH', `/api/recurring-expenses/${rule.id}`, { enabled: !rule.enabled });
                          if (res) {
                            pushToast('success', !rule.enabled ? (isAr ? 'تم تفعيل القاعدة' : 'Rule enabled') : (isAr ? 'تم إيقاف القاعدة' : 'Rule paused'));
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold cursor-pointer shrink-0 ${
                          rule.enabled
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30'
                            : 'bg-slate-600/30 text-slate-300 border border-white/10'
                        }`}
                      >
                        {rule.enabled ? (isAr ? 'مفعلة' : 'Active') : (isAr ? 'متوقفة' : 'Paused')}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Property Monthly Budgets */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-white">
                  {isAr ? `ميزانيات العقارات الشهرية (${CURRENT_MONTH})` : `Property Budgets (${CURRENT_MONTH})`}
                </h3>
                {hasPermission('manage_accounting') && (
                  <button
                    type="button"
                    onClick={() => {
                      setBudgetForm((prev) => ({
                        ...prev,
                        propertyId: prev.propertyId || state.properties[0]?.id || '',
                      }));
                      setShowBudgetModal(true);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#26478D] hover:bg-blue-700 text-white text-[11px] font-semibold cursor-pointer no-print"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isAr ? 'ضبط ميزانية عقار' : 'Set Property Budget'}</span>
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {propertyBudgets.map((bdg) => {
                  const prop = state.properties.find((p) => p.id === bdg.propertyId);
                  const spentSar = expenses
                    .filter(
                      (e) =>
                        e.propertyId === bdg.propertyId &&
                        e.date.startsWith(bdg.month) &&
                        e.approvalStatus !== 'ملغى' &&
                        e.approvalStatus !== 'مرفوض'
                    )
                    .reduce((s, e) => s + toSarRate(e.amount, e.currency || 'SAR'), 0);
                  const pct = bdg.monthlyLimitSar > 0 ? Math.min(130, Math.round((spentSar / bdg.monthlyLimitSar) * 100)) : 0;
                  const barColor =
                    pct >= 100 ? 'bg-red-500' : pct >= (bdg.alertThresholdPercent || 80) ? 'bg-amber-400' : 'bg-emerald-500';

                  return (
                    <div key={bdg.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-white">
                          {prop?.nameAr || bdg.propertyId} <span className="font-mono-num text-slate-400">({bdg.month})</span>
                        </span>
                        <span className="font-mono-num font-bold text-slate-200">{pct}%</span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 font-mono-num">
                        <span>المنصرف: {Math.round(spentSar).toLocaleString()} ر.س</span>
                        <span>
                          الحد: {bdg.monthlyLimitSar.toLocaleString()} ر.س · تنبيه {bdg.alertThresholdPercent}%
                          {bdg.blockAt100Percent ? ' · إيقاف إجباري 100%' : ''}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: REPORTS & CHARTS */}
      {subTab === 'reports' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
            <h3 className="text-sm font-bold text-white">
              {isAr ? `توزيع المصروفات حسب العقار (${baseCurrency})` : `Expenses by Property (${baseCurrency})`}
            </h3>
            <div className="h-64 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={analytics.byProperty}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="name" tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#cbd5e1', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, color: '#fff', fontSize: 12 }}
                  />
                  <Bar dataKey="value" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 space-y-3">
            <h3 className="text-sm font-bold text-white">
              {isAr ? `توزيع المصروفات حسب الفئة (${baseCurrency})` : `Expenses by Category (${baseCurrency})`}
            </h3>
            <div className="h-64 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.byCategory}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={82}
                    label={({ name }) => name}
                  >
                    {analytics.byCategory.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0F172A', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, color: '#fff', fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* EXPENSE WIZARD MODAL */}
      <ExpenseWizardModal
        open={wizardOpen}
        initialExpense={editingExpense}
        onClose={() => {
          setWizardOpen(false);
          setEditingExpense(null);
        }}
      />

      {/* PIN CONFIRMATION MODAL (> 5,000 SAR APPROVAL) */}
      {pinApproveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
          <form
            onSubmit={confirmPinApprove}
            className="w-full max-w-sm rounded-2xl border border-amber-400/30 bg-[#13192B] p-6 space-y-4 text-slate-100"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                <Lock className="w-4 h-4" />
                <span>{isAr ? 'تأكيد PIN المدير للاعتماد عالي القيمة' : 'GM Master PIN Required'}</span>
              </div>
              <button type="button" onClick={() => setPinApproveModal(null)} className="cursor-pointer text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300">
              {isAr
                ? `المصروف ${pinApproveModal.expense.expenseNumber} يتجاوز 5,000 ر.س (${formatInCurrency(pinApproveModal.expense.amount, pinApproveModal.expense.currency || 'SAR')}). أدخل رمز PIN لتأكيد الاعتماد.`
                : `Expense exceeds 5,000 SAR. Enter Master PIN to approve.`}
            </p>
            <input
              type="password"
              required
              autoFocus
              value={pinApproveModal.pin}
              onChange={(e) => setPinApproveModal({ ...pinApproveModal, pin: e.target.value })}
              placeholder="••••"
              className="w-full px-3 py-2.5 rounded-xl bg-white/[0.06] border border-white/15 text-center font-mono-num text-base tracking-widest"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPinApproveModal(null)}
                className="px-4 py-2 rounded-xl border border-white/15 text-xs cursor-pointer"
              >
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer">
                {isAr ? 'تأكيد الاعتماد' : 'Confirm Approve'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* REJECT EXPENSE MODAL */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!rejectModal.reason.trim()) return;
              const target = rejectModal.expense;
              const rsn = rejectModal.reason.trim();
              setRejectModal(null);
              await handleExpenseDecision(target, 'reject', rsn);
            }}
            className="w-full max-w-md rounded-2xl border border-red-400/30 bg-[#13192B] p-6 space-y-4 text-slate-100"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-red-300">
                {isAr ? `رفض المصروف ${rejectModal.expense.expenseNumber}` : 'Reject Expense'}
              </h3>
              <button type="button" onClick={() => setRejectModal(null)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              required
              rows={3}
              value={rejectModal.reason}
              onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
              placeholder={isAr ? 'اكتب سبب الرفض ليظهر للموظف وسجل التدقيق...' : 'Enter rejection reason...'}
              className="w-full px-3 py-2 rounded-xl bg-white/[0.06] border border-white/15 text-xs"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRejectModal(null)} className="px-4 py-2 rounded-xl border border-white/15 text-xs cursor-pointer">
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold cursor-pointer">
                {isAr ? 'تأكيد الرفض' : 'Reject'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PAYOUT DISBURSEMENT VOUCHER MODAL */}
      {payVoucherModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSubmitPayVoucher}
            className="w-full max-w-md rounded-2xl border border-white/15 bg-[#13192B] p-6 space-y-4 text-slate-100"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-teal-300">
                {isAr ? `سند صرف / سداد — ${payVoucherModal.expense.expenseNumber}` : 'Expense Payout Voucher'}
              </h3>
              <button type="button" onClick={() => setPayVoucherModal(null)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">{isAr ? 'المبلغ المدفوع الآن' : 'Payment Amount'}</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={payVoucherModal.expense.remainingAmount ?? payVoucherModal.expense.amount}
                  step="0.01"
                  value={payVoucherModal.paidAmount}
                  onChange={(e) => setPayVoucherModal({ ...payVoucherModal, paidAmount: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.06] border border-white/15 font-mono-num"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">{isAr ? 'طريقة الدفع' : 'Payment Method'}</label>
                <select
                  value={payVoucherModal.paymentMethod}
                  onChange={(e) => setPayVoucherModal({ ...payVoucherModal, paymentMethod: e.target.value as PaymentMethod })}
                  className="w-full px-3 py-2 rounded-xl bg-[#0A0E1A] border border-white/15"
                >
                  <option value="تحويل بنكي">تحويل بنكي</option>
                  <option value="نقدي">نقدي</option>
                  <option value="شبكة مدى">شبكة مدى</option>
                  <option value="شيك">شيك</option>
                  <option value="سداد إلكتروني">سداد إلكتروني</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">{isAr ? 'الحساب البنكي / الصندوق الصادر منه' : 'Paid From Account'}</label>
                <input
                  value={payVoucherModal.paidFromAccount}
                  onChange={(e) => setPayVoucherModal({ ...payVoucherModal, paidFromAccount: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.06] border border-white/15"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">{isAr ? 'رقم المرجع / الحوالة' : 'Reference Number'}</label>
                <input
                  value={payVoucherModal.referenceNumber}
                  onChange={(e) => setPayVoucherModal({ ...payVoucherModal, referenceNumber: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.06] border border-white/15 font-mono-num"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPayVoucherModal(null)} className="px-4 py-2 rounded-xl border border-white/15 text-xs cursor-pointer">
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-bold cursor-pointer">
                {isAr ? 'تثبيت سند الصرف' : 'Confirm Payment'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* REASONED CANCELLATION MODAL (+ MANAGER PIN IF APPROVED) */}
      {cancelExpenseModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
          <form
            onSubmit={handleConfirmCancelExpense}
            className="w-full max-w-md rounded-2xl border border-red-400/30 bg-[#13192B] p-6 space-y-4 text-slate-100"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-red-300">
                {isAr ? `إلغاء المصروف ${cancelExpenseModal.expense.expenseNumber}` : 'Cancel Expense'}
              </h3>
              <button type="button" onClick={() => setCancelExpenseModal(null)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-300">
              {cancelExpenseModal.expense.approvalStatus === 'معتمد'
                ? isAr
                  ? 'تنبيه: هذا المصروف معتمد ومرحّل محاسبياً. إلغاؤه سيصدر قيداً عكسياً تلقائياً ويتطلب رمز PIN المدير وكتابة السبب.'
                  : 'Cancelling an approved expense creates an automatic GL reversal and requires Manager PIN.'
                : isAr
                ? 'سيتم حفظ الإلغاء مع السبب في سجل التدقيق دون مسح الأثر.'
                : 'Cancellation reason will be permanently audited.'}
            </p>
            <textarea
              required
              rows={3}
              value={cancelExpenseModal.reason}
              onChange={(e) => setCancelExpenseModal({ ...cancelExpenseModal, reason: e.target.value })}
              placeholder={isAr ? 'سبب الإلغاء الإلزامي (4 أحرف على الأقل)...' : 'Mandatory cancellation reason...'}
              className="w-full px-3 py-2 rounded-xl bg-white/[0.06] border border-white/15 text-xs"
            />
            {cancelExpenseModal.expense.approvalStatus === 'معتمد' && (
              <div>
                <label className="block text-xs text-amber-300 mb-1">{isAr ? 'رمز PIN المدير' : 'Manager PIN'}</label>
                <input
                  type="password"
                  required
                  value={cancelExpenseModal.pin}
                  onChange={(e) => setCancelExpenseModal({ ...cancelExpenseModal, pin: e.target.value })}
                  placeholder="••••"
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.06] border border-white/15 font-mono-num text-center tracking-widest"
                />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCancelExpenseModal(null)} className="px-4 py-2 rounded-xl border border-white/15 text-xs cursor-pointer">
                {isAr ? 'تراجع' : 'Back'}
              </button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold cursor-pointer">
                {isAr ? 'تأكيد الإلغاء' : 'Confirm Cancel'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ATTACHMENTS PREVIEW LIGHTBOX */}
      {attachmentPreviewExp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-2xl max-h-[88vh] overflow-y-auto rounded-2xl border border-white/15 bg-[#13192B] p-6 space-y-4 text-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">
                {isAr ? `مرفقات المصروف ${attachmentPreviewExp.expenseNumber}` : `Attachments — ${attachmentPreviewExp.expenseNumber}`}
              </h3>
              <button type="button" onClick={() => setAttachmentPreviewExp(null)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            {attachmentPreviewExp.invoiceImageDataUrl && (
              <div className="space-y-1">
                <div className="text-xs text-slate-400">{isAr ? 'صورة الفاتورة:' : 'Invoice Image:'}</div>
                <img src={attachmentPreviewExp.invoiceImageDataUrl} alt="Invoice" className="rounded-xl max-h-80 object-contain border border-white/10" />
              </div>
            )}
            {attachmentPreviewExp.invoicePdfDataUrl && (
              <div className="text-xs text-blue-300 bg-blue-500/10 rounded-xl p-3">
                {isAr ? 'ملف PDF مرفق ومحفوظ مع بيانات المصروف.' : 'PDF document attached.'}
              </div>
            )}
            {attachmentPreviewExp.workPhotosDataUrls && attachmentPreviewExp.workPhotosDataUrls.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-slate-400">{isAr ? 'صور الأعمال:' : 'Work Photos:'}</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {attachmentPreviewExp.workPhotosDataUrls.map((url, idx) => (
                    <img key={idx} src={url} alt={`Work ${idx + 1}`} className="rounded-xl h-32 w-full object-cover border border-white/10" />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* NEW SUPPLIER INVOICE MODAL */}
      {showAddInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreateSupplierInvoice}
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/15 bg-[#13192B] p-6 space-y-4 text-slate-100"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">{isAr ? 'تسجيل فاتورة مورد تفصيلية' : 'Create Supplier Invoice'}</h3>
              <button type="button" onClick={() => setShowAddInvoice(false)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">{isAr ? 'رقم فاتورة المورد' : 'Supplier Inv #'}</label>
                <input
                  required
                  value={invForm.supplierInvoiceNumber}
                  onChange={(e) => setInvForm({ ...invForm, supplierInvoiceNumber: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.06] border border-white/15 font-mono-num"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">{isAr ? 'المورد' : 'Vendor'}</label>
                <select
                  value={invForm.vendorId || state.vendors[0]?.id}
                  onChange={(e) => setInvForm({ ...invForm, vendorId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#0A0E1A] border border-white/15"
                >
                  {state.vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nameAr}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">{isAr ? 'العقار' : 'Property'}</label>
                <select
                  value={invForm.propertyId || state.properties[0]?.id}
                  onChange={(e) => setInvForm({ ...invForm, propertyId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#0A0E1A] border border-white/15"
                >
                  {state.properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameAr}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">{isAr ? 'تاريخ الفاتورة' : 'Invoice Date'}</label>
                <input
                  type="date"
                  required
                  value={invForm.invoiceDate}
                  onChange={(e) => setInvForm({ ...invForm, invoiceDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.06] border border-white/15 font-mono-num"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">{isAr ? 'تاريخ الاستحقاق' : 'Due Date'}</label>
                <input
                  type="date"
                  value={invForm.dueDate}
                  onChange={(e) => setInvForm({ ...invForm, dueDate: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.06] border border-white/15 font-mono-num"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">{isAr ? 'العملة المعتمدة' : 'Currency'}</label>
                <div className="w-full px-3 py-2 rounded-xl bg-white/[0.04] border border-white/10 text-emerald-300 font-semibold">
                  {isAr ? 'ريال سعودي (SAR)' : 'SAR'}
                </div>
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold">
                <span>{isAr ? 'بنود الفاتورة' : 'Line Items'}</span>
                <button
                  type="button"
                  onClick={() =>
                    setInvForm((prev) => ({
                      ...prev,
                      items: [
                        ...prev.items,
                        { id: `li-${Date.now()}`, description: '', quantity: 1, unitPrice: 0, total: 0 },
                      ],
                    }))
                  }
                  className="text-blue-300 hover:text-blue-200 text-[11px] cursor-pointer"
                >
                  + {isAr ? 'إضافة بند' : 'Add Line'}
                </button>
              </div>
              <div className="space-y-2">
                {invForm.items.map((item, idx) => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 items-center text-xs">
                    <input
                      required
                      placeholder={isAr ? 'وصف البند / قطعة الغيار...' : 'Item description'}
                      value={item.description}
                      onChange={(e) => {
                        const next = [...invForm.items];
                        next[idx] = { ...item, description: e.target.value };
                        setInvForm({ ...invForm, items: next });
                      }}
                      className="col-span-6 px-3 py-2 rounded-xl bg-white/[0.06] border border-white/15"
                    />
                    <input
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) => {
                        const qty = Math.max(1, Number(e.target.value));
                        const next = [...invForm.items];
                        next[idx] = { ...item, quantity: qty, total: Math.round(qty * item.unitPrice * 100) / 100 };
                        setInvForm({ ...invForm, items: next });
                      }}
                      className="col-span-2 px-2.5 py-2 rounded-xl bg-white/[0.06] border border-white/15 font-mono-num"
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.unitPrice}
                      onChange={(e) => {
                        const price = Math.max(0, Number(e.target.value));
                        const next = [...invForm.items];
                        next[idx] = { ...item, unitPrice: price, total: Math.round(item.quantity * price * 100) / 100 };
                        setInvForm({ ...invForm, items: next });
                      }}
                      className="col-span-3 px-2.5 py-2 rounded-xl bg-white/[0.06] border border-white/15 font-mono-num"
                    />
                    <button
                      type="button"
                      disabled={invForm.items.length === 1}
                      onClick={() =>
                        setInvForm((prev) => ({
                          ...prev,
                          items: prev.items.filter((_, i) => i !== idx),
                        }))
                      }
                      className="col-span-1 text-red-400 disabled:opacity-30 cursor-pointer flex justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/[0.04] border border-white/10 p-3 text-xs">
              <div className="flex flex-wrap items-center gap-4">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={invForm.vatApplicable}
                    onChange={(e) => setInvForm({ ...invForm, vatApplicable: e.target.checked })}
                  />
                  <span>{isAr ? 'تطبيق ضريبة القيمة المضافة 15%' : 'Apply 15% VAT'}</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={invForm.zatcaQrVerified}
                    onChange={(e) => setInvForm({ ...invForm, zatcaQrVerified: e.target.checked })}
                  />
                  <span>{isAr ? 'تم التحقق من QR الزكاة والدخل' : 'ZATCA QR Verified'}</span>
                </label>
              </div>
              <div className="font-mono-num text-end space-y-0.5">
                <div>الصافي: {invSubtotal.toLocaleString()} · الضريبة: {invVatAmount.toLocaleString()}</div>
                <div className="text-sm font-bold text-emerald-300">
                  الإجمالي: {formatInCurrency(invTotalAmount, invForm.currency)}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddInvoice(false)} className="px-4 py-2 rounded-xl border border-white/15 text-xs cursor-pointer">
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold cursor-pointer">
                {isAr ? 'حفظ فاتورة المورد' : 'Save Invoice'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PAY SUPPLIER INVOICE MODAL */}
      {payInvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              const res = await mutate('PATCH', `/api/supplier-invoices/${payInvModal.invoice.id}`, {
                payAmount: payInvModal.payAmount,
              });
              if (res) {
                triggerHaptic('success');
                pushToast('success', isAr ? 'تم تسجيل دفعة سداد فاتورة المورد' : 'Invoice payment recorded');
                setPayInvModal(null);
              }
            }}
            className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#13192B] p-6 space-y-4 text-slate-100"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">{isAr ? `سداد فاتورة ${payInvModal.invoice.invoiceCode}` : 'Pay Invoice'}</h3>
              <button type="button" onClick={() => setPayInvModal(null)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-slate-300 font-mono-num">
              المتبقي الحالي: {formatInCurrency(payInvModal.invoice.remainingAmount, payInvModal.invoice.currency)}
            </div>
            <input
              type="number"
              required
              min={1}
              max={payInvModal.invoice.remainingAmount}
              step="0.01"
              value={payInvModal.payAmount}
              onChange={(e) => setPayInvModal({ ...payInvModal, payAmount: Number(e.target.value) })}
              className="w-full px-3 py-2 rounded-xl bg-white/[0.06] border border-white/15 font-mono-num text-sm"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setPayInvModal(null)} className="px-4 py-2 rounded-xl border border-white/15 text-xs cursor-pointer">
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold cursor-pointer">
                {isAr ? 'تثبيت الدفعة' : 'Record'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CANCEL SUPPLIER INVOICE MODAL */}
      {cancelInvModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!cancelInvModal.reason.trim()) return;
              const res = await mutate('PATCH', `/api/supplier-invoices/${cancelInvModal.invoice.id}`, {
                status: 'ملغاة',
                cancellationReason: cancelInvModal.reason.trim(),
              });
              if (res) {
                triggerHaptic('warning');
                pushToast('success', isAr ? 'تم إلغاء الفاتورة مع حفظ السبب' : 'Invoice cancelled');
                setCancelInvModal(null);
              }
            }}
            className="w-full max-w-md rounded-2xl border border-red-400/30 bg-[#13192B] p-6 space-y-4 text-slate-100"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-red-300">{isAr ? `إلغاء الفاتورة ${cancelInvModal.invoice.invoiceCode}` : 'Cancel Invoice'}</h3>
              <button type="button" onClick={() => setCancelInvModal(null)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              required
              rows={3}
              value={cancelInvModal.reason}
              onChange={(e) => setCancelInvModal({ ...cancelInvModal, reason: e.target.value })}
              placeholder={isAr ? 'اكتب سبب إلغاء الفاتورة...' : 'Cancellation reason...'}
              className="w-full px-3 py-2 rounded-xl bg-white/[0.06] border border-white/15 text-xs"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCancelInvModal(null)} className="px-4 py-2 rounded-xl border border-white/15 text-xs cursor-pointer">
                {isAr ? 'تراجع' : 'Back'}
              </button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-bold cursor-pointer">
                {isAr ? 'تأكيد الإلغاء' : 'Cancel Invoice'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ADD RECURRING EXPENSE RULE MODAL */}
      {showAddRecurring && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreateRecurring}
            className="w-full max-w-md rounded-2xl border border-white/15 bg-[#13192B] p-6 space-y-4 text-slate-100"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">{isAr ? 'إضافة قاعدة مصروف دوري' : 'Add Recurring Expense Rule'}</h3>
              <button type="button" onClick={() => setShowAddRecurring(false)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <input
                required
                placeholder={isAr ? 'عنوان المصروف الدوري (مثال: عقد صيانة المصاعد)' : 'Rule Title'}
                value={recForm.title}
                onChange={(e) => setRecForm({ ...recForm, title: e.target.value })}
                className="col-span-2 px-3 py-2 rounded-xl bg-white/[0.06] border border-white/15"
              />
              <select
                value={recForm.category}
                onChange={(e) => {
                  const cat = e.target.value as ExpenseCategory;
                  setRecForm({ ...recForm, category: cat, subCategory: EXPENSE_CATEGORY_MAP[cat]?.[0] || '' });
                }}
                className="px-3 py-2 rounded-xl bg-[#0A0E1A] border border-white/15"
              >
                <option value="مصروفات الصيانة">مصروفات الصيانة</option>
                <option value="مصروفات التشغيل">مصروفات التشغيل</option>
                <option value="مصروفات إدارية">مصروفات إدارية</option>
                <option value="مصروفات حكومية وضريبية">مصروفات حكومية وضريبية</option>
              </select>
              <select
                value={recForm.propertyId || state.properties[0]?.id}
                onChange={(e) => setRecForm({ ...recForm, propertyId: e.target.value })}
                className="px-3 py-2 rounded-xl bg-[#0A0E1A] border border-white/15"
              >
                {state.properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nameAr}
                  </option>
                ))}
              </select>
              <input
                type="number"
                required
                min={1}
                value={recForm.estimatedAmount}
                onChange={(e) => setRecForm({ ...recForm, estimatedAmount: Number(e.target.value) })}
                className="px-3 py-2 rounded-xl bg-white/[0.06] border border-white/15 font-mono-num"
              />
              <select
                value={recForm.frequency}
                onChange={(e) => setRecForm({ ...recForm, frequency: e.target.value as typeof recForm.frequency })}
                className="px-3 py-2 rounded-xl bg-[#0A0E1A] border border-white/15"
              >
                <option value="شهري">شهري</option>
                <option value="ربع سنوي">ربع سنوي</option>
                <option value="سنوي">سنوي</option>
              </select>
              <input
                type="number"
                min={1}
                max={28}
                value={recForm.dayOfMonth}
                onChange={(e) => setRecForm({ ...recForm, dayOfMonth: Number(e.target.value) })}
                placeholder="يوم الاستحقاق (1-28)"
                className="px-3 py-2 rounded-xl bg-white/[0.06] border border-white/15 font-mono-num"
              />
              <select
                value={recForm.bearer}
                onChange={(e) => setRecForm({ ...recForm, bearer: e.target.value as typeof recForm.bearer })}
                className="px-3 py-2 rounded-xl bg-[#0A0E1A] border border-white/15"
              >
                <option value="المالك">يتحمله المالك</option>
                <option value="الشركة">على حساب الشركة</option>
                <option value="المستأجر">يتحمله المستأجر</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddRecurring(false)} className="px-4 py-2 rounded-xl border border-white/15 text-xs cursor-pointer">
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-[#26478D] text-white text-xs font-bold cursor-pointer">
                {isAr ? 'حفظ القاعدة' : 'Save Rule'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* PROPERTY BUDGET UPSERT MODAL */}
      {showBudgetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSavePropertyBudget}
            className="w-full max-w-md rounded-2xl border border-white/15 bg-[#13192B] p-6 space-y-4 text-slate-100"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold">{isAr ? 'ضبط الميزانية الشهرية للعقار' : 'Set Property Monthly Budget'}</h3>
              <button type="button" onClick={() => setShowBudgetModal(false)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">{isAr ? 'العقار' : 'Property'}</label>
                <select
                  value={budgetForm.propertyId || state.properties[0]?.id}
                  onChange={(e) => setBudgetForm({ ...budgetForm, propertyId: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-[#0A0E1A] border border-white/15"
                >
                  {state.properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameAr}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">{isAr ? 'الشهر' : 'Month'}</label>
                  <input
                    type="month"
                    value={budgetForm.month}
                    onChange={(e) => setBudgetForm({ ...budgetForm, month: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white/[0.06] border border-white/15 font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">{isAr ? 'الحد الشهري (ر.س)' : 'Limit (SAR)'}</label>
                  <input
                    type="number"
                    required
                    min={500}
                    value={budgetForm.monthlyLimitSar}
                    onChange={(e) => setBudgetForm({ ...budgetForm, monthlyLimitSar: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-white/[0.06] border border-white/15 font-mono-num"
                  />
                </div>
              </div>
              <div>
                <label className="block text-slate-400 mb-1">{isAr ? 'نسبة التنبيه المبكر (%)' : 'Alert Threshold (%)'}</label>
                <input
                  type="number"
                  min={50}
                  max={99}
                  value={budgetForm.alertThresholdPercent}
                  onChange={(e) => setBudgetForm({ ...budgetForm, alertThresholdPercent: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-xl bg-white/[0.06] border border-white/15 font-mono-num"
                />
              </div>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={budgetForm.blockAt100Percent}
                  onChange={(e) => setBudgetForm({ ...budgetForm, blockAt100Percent: e.target.checked })}
                />
                <span>{isAr ? 'منع تسجيل مصروفات تتجاوز 100% إلا بموافقة المدير العام' : 'Block expenses above 100% unless GM overrides'}</span>
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowBudgetModal(false)} className="px-4 py-2 rounded-xl border border-white/15 text-xs cursor-pointer">
                {isAr ? 'إلغاء' : 'Cancel'}
              </button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-[#26478D] text-white text-xs font-bold cursor-pointer">
                {isAr ? 'حفظ الميزانية' : 'Save Budget'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
