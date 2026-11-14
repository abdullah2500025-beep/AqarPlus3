import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Eraser,
  FileText,
  Loader2,
  QrCode,
  Save,
  Send,
  Sparkles,
  Upload,
  X,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { useAqar } from '../context/AqarContext';
import {
  CurrencyCode,
  Expense,
  ExpenseCategory,
  ExpensePaymentStatus,
  PaymentMethod,
} from '../types/aqar';
import { formatCurrency, formatSar } from '../utils/formatters';
import { readFileAsDataUrl, runGeminiOcrExtraction } from '../utils/ocrClient';
import { triggerHaptic } from '../utils/haptics';

const DRAFT_STORAGE_KEY = 'aqarplus_expense_wizard_draft_v1';

export const EXPENSE_CATEGORY_MAP: Record<ExpenseCategory, string[]> = {
  'مصروفات الصيانة': ['سباكة', 'كهرباء', 'تكييف', 'نجارة وألمنيوم', 'مصاعد', 'مكافحة حشرات'],
  'مصروفات التشغيل': ['كهرباء عامة', 'مياه', 'نظافة', 'حراسة وأمن', 'إنترنت'],
  'مصروفات إدارية': ['رواتب وعمولات', 'مستلزمات مكتبية', 'اتصالات', 'ضيافة'],
  'مصروفات رأس مالية': ['شراء مكيفات', 'أثاث ومفروشات', 'ترميم شامل', 'أنظمة مراقبة'],
  'مصروفات تأجير وتسويق': ['إعلانات منصات', 'لافتات تسويقية', 'رسوم وساطة وتوثيق'],
  'مصروفات حكومية وضريبية': ['ضريبة القيمة المضافة', 'رخص بلدية ودفاع مدني', 'رسوم إيجار'],
  'مصروفات طوارئ': ['تسرب مياه طارئ', 'انقطاع كهرباء', 'صيانة مصعد طارئة'],
  'مصروفات أخرى': ['نقل ومواصلات', 'متفرقات'],
  'صيانة': ['سباكة', 'كهرباء', 'تكييف', 'صيانة عامة'],
  'نظافة': ['نظافة عامة', 'تنظيف واجهات'],
  'كهرباء': ['فاتورة كهرباء', 'تمديدات'],
  'مياه': ['فاتورة مياه', 'خزانات'],
  'تشغيل عام': ['حراسة', 'مرافق'],
  'أصول ومعدات': ['تجهيزات وأصول'],
};

const MAIN_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'مصروفات الصيانة',
  'مصروفات التشغيل',
  'مصروفات إدارية',
  'مصروفات رأس مالية',
  'مصروفات تأجير وتسويق',
  'مصروفات حكومية وضريبية',
  'مصروفات طوارئ',
  'مصروفات أخرى',
];

interface ExpenseWizardModalProps {
  open: boolean;
  initialExpense?: Expense | null;
  onClose: () => void;
}

export function ExpenseWizardModal({ open, initialExpense, onClose }: ExpenseWizardModalProps) {
  const { state, currentUser, lang, mutate, pushToast } = useAqar();
  const isAr = lang === 'ar';
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasSavedDraftBanner, setHasSavedDraftBanner] = useState(false);

  const [form, setForm] = useState({
    category: 'مصروفات الصيانة' as ExpenseCategory,
    subCategory: 'تكييف',
    date: '2026-11-14',
    invoiceNumber: '',
    amount: 650,
    vatIncluded: true,
    currency: 'SAR' as CurrencyCode,
    propertyId: '',
    unitId: '',
    ticketId: '',
    vendorId: '',
    bearer: 'المالك' as 'المالك' | 'الشركة' | 'المستأجر',
    paymentMethod: 'تحويل بنكي' as PaymentMethod | 'آجل',
    paidFromAccount: 'مصرف الراجحي — حساب التشغيل',
    referenceNumber: '',
    paymentStatus: 'مدفوع بالكامل' as ExpensePaymentStatus,
    paidAmount: 650,
    dueDate: '2026-11-30',
    registerAsAsset: false,
    zatcaQrVerified: false,
    zatcaQrRaw: '',
    invoiceImageDataUrl: '',
    invoicePdfDataUrl: '',
    workPhotosDataUrls: [] as string[],
    notes: '',
  });

  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  useEffect(() => {
    if (!open || !state) return;
    setStep(1);
    if (initialExpense) {
      setHasSavedDraftBanner(false);
      setForm({
        category: initialExpense.category,
        subCategory: initialExpense.subCategory || EXPENSE_CATEGORY_MAP[initialExpense.category]?.[0] || '',
        date: initialExpense.date,
        invoiceNumber: initialExpense.invoiceNumber,
        amount: initialExpense.amount,
        vatIncluded: true,
        currency: initialExpense.currency || 'SAR',
        propertyId: initialExpense.propertyId,
        unitId: initialExpense.unitId || '',
        ticketId: initialExpense.ticketId || '',
        vendorId: initialExpense.vendorId || '',
        bearer: initialExpense.bearer,
        paymentMethod: initialExpense.paymentMethod,
        paidFromAccount: initialExpense.paidFromAccount || 'مصرف الراجحي — حساب التشغيل',
        referenceNumber: initialExpense.referenceNumber || '',
        paymentStatus: initialExpense.paymentStatus || 'مدفوع بالكامل',
        paidAmount: initialExpense.paidAmount ?? initialExpense.amount,
        dueDate: initialExpense.dueDate || initialExpense.date,
        registerAsAsset: Boolean(initialExpense.registerAsAsset),
        zatcaQrVerified: Boolean(initialExpense.zatcaQrVerified),
        zatcaQrRaw: initialExpense.zatcaQrRaw || '',
        invoiceImageDataUrl: initialExpense.invoiceImageDataUrl || '',
        invoicePdfDataUrl: initialExpense.invoicePdfDataUrl || '',
        workPhotosDataUrls: initialExpense.workPhotosDataUrls || [],
        notes: initialExpense.notes || '',
      });
    } else {
      const savedRaw = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (savedRaw) setHasSavedDraftBanner(true);
      setForm((prev) => ({
        ...prev,
        propertyId: prev.propertyId || state.properties[0]?.id || '',
        invoiceNumber: prev.invoiceNumber || `INV-${Math.floor(10000 + Math.random() * 89999)}`,
      }));
    }
  }, [open, initialExpense, state]);

  // Auto-save draft when creating new expense
  useEffect(() => {
    if (!open || initialExpense) return;
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(form));
    } catch {
      // Ignore quota exceeded if base64 image too big
    }
  }, [form, open, initialExpense]);

  const effectivePropertyId = form.propertyId || state?.properties[0]?.id || '';
  const propertyUnits = useMemo(
    () => (state?.units || []).filter((u) => u.propertyId === effectivePropertyId),
    [state?.units, effectivePropertyId]
  );
  const propertyTickets = useMemo(
    () => (state?.tickets || []).filter((t) => t.propertyId === effectivePropertyId && !t.archivedAt),
    [state?.tickets, effectivePropertyId]
  );

  // Live Property Monthly Budget check
  const budgetMetrics = useMemo(() => {
    if (!state || !effectivePropertyId) return null;
    const month = form.date.slice(0, 7);
    const budget = (state.propertyBudgets || []).find(
      (b) => b.propertyId === effectivePropertyId && b.month === month
    );
    if (!budget) return null;
    const spentSoFar = state.expenses
      .filter(
        (e) =>
          e.propertyId === effectivePropertyId &&
          e.date.startsWith(month) &&
          e.approvalStatus !== 'مرفوض' &&
          e.approvalStatus !== 'ملغى' &&
          e.id !== initialExpense?.id
      )
      .reduce((s, e) => s + e.amount, 0);
    const projected = spentSoFar + Number(form.amount || 0);
    const pct = budget.monthlyLimitSar > 0 ? Math.round((projected / budget.monthlyLimitSar) * 100) : 0;
    return {
      limit: budget.monthlyLimitSar,
      spentSoFar,
      projected,
      pct,
      alertAt: budget.alertThresholdPercent,
      blockAt100: budget.blockAt100Percent,
    };
  }, [state, effectivePropertyId, form.date, form.amount, initialExpense?.id]);

  if (!open || !state) return null;

  // VAT 15% math
  const grossAmount = form.vatIncluded
    ? Number(form.amount || 0)
    : Math.round(Number(form.amount || 0) * 1.15 * 100) / 100;
  const netAmount = Math.round((grossAmount / 1.15) * 100) / 100;
  const vatAmount = Math.round((grossAmount - netAmount) * 100) / 100;
  const remainingAmount =
    form.paymentStatus === 'مدفوع بالكامل'
      ? 0
      : form.paymentStatus === 'لم يُدفع'
      ? grossAmount
      : Math.max(0, Math.round((grossAmount - Number(form.paidAmount || 0)) * 100) / 100);

  const handleOcrInvoiceScan = async (file: File) => {
    setOcrBusy(true);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await runGeminiOcrExtraction({
        userId: currentUser?.id || 'usr-gm',
        dataUrl,
        mimeType: file.type || 'image/jpeg',
        fileName: file.name,
        categoryHint: 'فواتير',
        autoSync: false,
      });
      const ext = res.extracted;
      setForm((prev) => ({
        ...prev,
        invoiceImageDataUrl: file.type.includes('pdf') ? prev.invoiceImageDataUrl : dataUrl,
        invoicePdfDataUrl: file.type.includes('pdf') ? dataUrl : prev.invoicePdfDataUrl,
        invoiceNumber: ext.contractNumber || prev.invoiceNumber,
        amount: ext.annualRent || prev.amount,
        date: ext.startDate || prev.date,
        notes: ext.rawText ? `${ext.rawText.slice(0, 140)}...` : prev.notes,
        zatcaQrVerified: ext.rawText?.toLowerCase().includes('vat') || ext.rawText?.includes('ضريبة') || prev.zatcaQrVerified,
      }));
      triggerHaptic('success');
      pushToast('success', isAr ? 'تم مسح الفاتورة بالذكاء الاصطناعي وإرفاقها' : 'Invoice OCR scanned');
    } catch (err) {
      pushToast('error', (err as Error).message);
    } finally {
      setOcrBusy(false);
    }
  };

  const handleUploadAttachment = async (file: File, target: 'invoiceImage' | 'invoicePdf' | 'workPhoto') => {
    const dataUrl = await readFileAsDataUrl(file);
    if (target === 'invoiceImage') setForm((prev) => ({ ...prev, invoiceImageDataUrl: dataUrl }));
    else if (target === 'invoicePdf') setForm((prev) => ({ ...prev, invoicePdfDataUrl: dataUrl }));
    else setForm((prev) => ({ ...prev, workPhotosDataUrls: [...prev.workPhotosDataUrls, dataUrl] }));
  };

  const handleSubmit = async (saveAsDraft: boolean) => {
    if (submitting) return;
    if (!saveAsDraft && grossAmount > 500 && !form.invoiceImageDataUrl && !form.invoicePdfDataUrl) {
      triggerHaptic('error');
      pushToast(
        'error',
        isAr
          ? 'المصروفات فوق 500 ر.س تتطلب إرفاق صورة الفاتورة الأصلية أو حفظها كمسودة مؤقتة'
          : 'Original invoice attachment required for expenses above 500 SAR'
      );
      setStep(4);
      return;
    }

    setSubmitting(true);
    triggerHaptic('medium');
    try {
      const sigUrl = hasSignature && sigCanvasRef.current ? sigCanvasRef.current.toDataURL('image/png') : undefined;
      const payload = {
        category: form.category,
        subCategory: form.subCategory,
        date: form.date,
        invoiceNumber: form.invoiceNumber.trim() || `INV-${Date.now().toString().slice(-6)}`,
        amount: grossAmount,
        vatAmount,
        netAmount,
        currency: form.currency,
        propertyId: effectivePropertyId,
        unitId: form.unitId || undefined,
        ticketId: form.ticketId || undefined,
        vendorId: form.vendorId || undefined,
        bearer: form.bearer,
        paymentMethod: form.paymentMethod,
        paidFromAccount: form.paidFromAccount,
        referenceNumber: form.referenceNumber || undefined,
        paymentStatus: form.paymentStatus,
        paidAmount:
          form.paymentStatus === 'مدفوع بالكامل'
            ? grossAmount
            : form.paymentStatus === 'مدفوع جزئياً'
            ? Number(form.paidAmount || 0)
            : 0,
        dueDate: form.dueDate || form.date,
        registerAsAsset: form.registerAsAsset,
        zatcaQrVerified: form.zatcaQrVerified,
        zatcaQrRaw: form.zatcaQrRaw || (form.zatcaQrVerified ? `ZATCA|${form.invoiceNumber}|${grossAmount}|${vatAmount}` : undefined),
        invoiceImageDataUrl: form.invoiceImageDataUrl || undefined,
        invoicePdfDataUrl: form.invoicePdfDataUrl || undefined,
        workPhotosDataUrls: form.workPhotosDataUrls,
        recipientSignatureDataUrl: sigUrl,
        notes: form.notes,
        saveAsDraft,
      };

      const res = initialExpense
        ? await mutate('PATCH', `/api/expenses/${initialExpense.id}`, {
            action: 'edit',
            patch: { ...payload, approvalStatus: saveAsDraft ? 'مسودة' : 'بانتظار المشرف' },
          })
        : await mutate('POST', '/api/expenses', payload, {
            offlineDescAr: `${saveAsDraft ? 'مسودة' : 'تسجيل'} مصروف ${grossAmount} ر.س`,
          });

      if (res) {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        triggerHaptic('success');
        pushToast(
          'success',
          saveAsDraft
            ? isAr
              ? 'تم حفظ المصروف كمسودة بنجاح'
              : 'Saved as draft'
            : isAr
            ? 'تم رفع المصروف وإرساله لمسار الاعتماد'
            : 'Expense submitted for approval'
        );
        onClose();
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Signature drawing handlers
  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = sigCanvasRef.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const r = c.getBoundingClientRect();
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
    isDrawingRef.current = true;
    setHasSignature(true);
  };
  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current || !sigCanvasRef.current) return;
    const ctx = sigCanvasRef.current.getContext('2d');
    if (!ctx) return;
    const r = sigCanvasRef.current.getBoundingClientRect();
    ctx.lineTo(e.clientX - r.left, e.clientY - r.top);
    ctx.stroke();
  };
  const endDraw = () => {
    isDrawingRef.current = false;
  };
  const clearSig = () => {
    const c = sigCanvasRef.current;
    const ctx = c?.getContext('2d');
    if (c && ctx) ctx.clearRect(0, 0, c.width, c.height);
    setHasSignature(false);
  };

  const stepLabels = [
    { n: 1 as const, ar: '1. البيانات الأساسية', en: '1. Basic Info' },
    { n: 2 as const, ar: '2. التخصيص والميزانية', en: '2. Allocation' },
    { n: 3 as const, ar: '3. الدفع والمالية', en: '3. Payment' },
    { n: 4 as const, ar: '4. المرفقات والتوثيق', en: '4. Attachments' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl border border-white/15 bg-[#13192B] text-white shadow-2xl overflow-hidden my-auto">
        {/* Header & Progress Bar */}
        <div className="p-5 bg-gradient-to-r from-[#0F1B38] to-[#1A1F2E] border-b border-white/10 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-bold">
                {initialExpense
                  ? isAr
                    ? `تعديل المصروف ${initialExpense.expenseNumber}`
                    : `Edit ${initialExpense.expenseNumber}`
                  : isAr
                  ? 'معالج تسجيل المصروف وفاتورة المورد (4 خطوات)'
                  : 'Expense & Invoice Entry Wizard'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {isAr ? 'حفظ تلقائي للمسودة + قراءة ضوئية للفاتورة + رقابة ميزانية العقار' : 'Auto-draft + Gemini OCR + Budget Guard'}
              </p>
            </div>
            <button type="button" onClick={onClose} className="cursor-pointer text-slate-300 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {stepLabels.map((s) => (
              <button
                key={s.n}
                type="button"
                onClick={() => setStep(s.n)}
                className={`py-2 px-2 rounded-xl text-[11px] font-semibold text-center cursor-pointer transition-all ${
                  step === s.n
                    ? 'bg-[#26478D] text-white shadow'
                    : step > s.n
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-white/[0.05] text-slate-400'
                }`}
              >
                {isAr ? s.ar : s.en}
              </button>
            ))}
          </div>
        </div>

        {/* Saved Draft Restore Prompt */}
        {hasSavedDraftBanner && !initialExpense && (
          <div className="px-5 py-2.5 bg-blue-500/15 border-b border-blue-400/20 flex items-center justify-between text-xs">
            <span>{isAr ? 'تم استرداد آخر مسودة غير مكتملة تلقائياً.' : 'Previous unfinished draft restored.'}</span>
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(DRAFT_STORAGE_KEY);
                setHasSavedDraftBanner(false);
              }}
              className="text-blue-300 hover:underline cursor-pointer"
            >
              {isAr ? 'تجاهل' : 'Dismiss'}
            </button>
          </div>
        )}

        <div className="p-5 sm:p-6 space-y-4 text-xs max-h-[68vh] overflow-y-auto">
          {/* STEP 1: BASIC INFO & OCR */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Gemini OCR Invoice Strip */}
              <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/[0.08] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-emerald-300 font-bold">
                  <Sparkles className="w-4 h-4" />
                  <span>{isAr ? 'مسح الفاتورة بالذكاء الاصطناعي (Gemini OCR)' : 'Smart Invoice Scan (OCR)'}</span>
                </div>
                <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer">
                  {ocrBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                  <span>{ocrBusy ? (isAr ? 'جاري التحليل...' : 'Scanning...') : isAr ? 'ارفع الفاتورة للتعبئة الآلية' : 'Scan Invoice'}</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    disabled={ocrBusy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleOcrInvoiceScan(f);
                    }}
                  />
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1">{isAr ? 'التصنيف الرئيسي (8 فئات)' : 'Main Category'}</label>
                  <select
                    value={form.category}
                    onChange={(e) => {
                      const cat = e.target.value as ExpenseCategory;
                      setForm({
                        ...form,
                        category: cat,
                        subCategory: EXPENSE_CATEGORY_MAP[cat]?.[0] || '',
                        registerAsAsset: cat === 'مصروفات رأس مالية',
                      });
                    }}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10"
                  >
                    {MAIN_EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">{isAr ? 'الفئة الفرعية' : 'Subcategory'}</label>
                  <select
                    value={form.subCategory}
                    onChange={(e) => setForm({ ...form, subCategory: e.target.value })}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10"
                  >
                    {(EXPENSE_CATEGORY_MAP[form.category] || ['عام']).map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">{isAr ? 'رقم الفاتورة المرجعي' : 'Invoice Number'}</label>
                  <input
                    required
                    value={form.invoiceNumber}
                    onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10 font-mono-num"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">{isAr ? 'تاريخ المصروف / الفاتورة' : 'Expense Date'}</label>
                  <input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10 font-mono-num"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">{isAr ? 'المبلغ' : 'Amount'}</label>
                  <input
                    type="number"
                    min={1}
                    step="0.01"
                    required
                    value={form.amount}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setForm((prev) => ({
                        ...prev,
                        amount: val,
                        paidAmount: prev.paymentStatus === 'مدفوع بالكامل' ? val : prev.paidAmount,
                      }));
                    }}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10 font-mono-num font-bold text-sm"
                  />
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">{isAr ? 'العملة المعتمدة' : 'Currency'}</label>
                  <div className="w-full min-h-[42px] px-3 rounded-xl bg-white/[0.04] border border-white/10 flex items-center text-xs font-semibold text-emerald-300">
                    {isAr ? 'ريال سعودي (SAR)' : 'Saudi Riyal (SAR)'}
                  </div>
                </div>
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.vatIncluded}
                  onChange={(e) => setForm({ ...form, vatIncluded: e.target.checked })}
                  className="w-4 h-4 accent-[#26478D]"
                />
                <span>{isAr ? 'المبلغ المدخل شامل ضريبة القيمة المضافة 15%' : 'Amount includes 15% VAT'}</span>
              </label>

              {/* Live VAT Summary Box */}
              <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 grid grid-cols-3 gap-2 font-mono-num">
                <div>
                  <span className="text-slate-400 block">{isAr ? 'الصافي قبل الضريبة' : 'Net'}</span>
                  <span className="font-bold text-white">{formatCurrency(netAmount, form.currency, lang)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">{isAr ? 'ضريبة 15%' : 'VAT 15%'}</span>
                  <span className="font-bold text-amber-300">{formatCurrency(vatAmount, form.currency, lang)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">{isAr ? 'الإجمالي النهائي' : 'Gross Total'}</span>
                  <span className="font-bold text-emerald-400">{formatCurrency(grossAmount, form.currency, lang)}</span>
                </div>
              </div>

              {(form.category === 'مصروفات رأس مالية' || form.category === 'أصول ومعدات') && (
                <label className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-400/20 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.registerAsAsset}
                    onChange={(e) => setForm({ ...form, registerAsAsset: e.target.checked })}
                    className="w-4 h-4 accent-[#26478D]"
                  />
                  <span>{isAr ? 'تسجيل هذا البند تلقائياً في سجل أصول وعهد الوحدة عند الاعتماد' : 'Auto-register as Unit Asset on approval'}</span>
                </label>
              )}
            </div>
          )}

          {/* STEP 2: ALLOCATION, LINKING & BUDGET GUARD */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1">{isAr ? 'العقار' : 'Property'}</label>
                  <select
                    value={effectivePropertyId}
                    onChange={(e) => setForm({ ...form, propertyId: e.target.value, unitId: '', ticketId: '' })}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10"
                  >
                    {state.properties.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nameAr}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">{isAr ? 'الوحدة (اختياري)' : 'Unit (Optional)'}</label>
                  <select
                    value={form.unitId}
                    onChange={(e) => setForm({ ...form, unitId: e.target.value })}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10"
                  >
                    <option value="">{isAr ? 'مشترك على كامل العقار' : 'Property-wide'}</option>
                    {propertyUnits.map((u) => (
                      <option key={u.id} value={u.id}>
                        وحدة {u.unitNumber} ({u.unitType})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">{isAr ? 'المورد / المقاول المنفذ' : 'Vendor / Supplier'}</label>
                  <select
                    value={form.vendorId}
                    onChange={(e) => setForm({ ...form, vendorId: e.target.value })}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10"
                  >
                    <option value="">{isAr ? '-- بدون مورد محدد --' : '-- No Vendor --'}</option>
                    {state.vendors.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.nameAr} ({v.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">{isAr ? 'بلاغ الصيانة المرتبط' : 'Linked Ticket'}</label>
                  <select
                    value={form.ticketId}
                    onChange={(e) => setForm({ ...form, ticketId: e.target.value })}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10"
                  >
                    <option value="">{isAr ? '-- غير مرتبط ببلاغ --' : '-- None --'}</option>
                    {propertyTickets.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.ticketNumber} · {t.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-slate-300 block mb-1">{isAr ? 'الطرف المتحمل للتكلفة' : 'Cost Bearer'}</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['المالك', 'الشركة', 'المستأجر'] as const).map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setForm({ ...form, bearer: b })}
                        className={`min-h-[40px] rounded-xl font-semibold border cursor-pointer ${
                          form.bearer === b
                            ? 'bg-[#26478D] border-blue-400 text-white'
                            : 'bg-[#0A0E1A] border-white/10 text-slate-300'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Property Monthly Budget Live Guard */}
              {budgetMetrics && (
                <div
                  className={`p-4 rounded-xl border space-y-2 ${
                    budgetMetrics.pct >= 100
                      ? 'bg-red-500/15 border-red-400/30 text-red-200'
                      : budgetMetrics.pct >= budgetMetrics.alertAt
                      ? 'bg-amber-500/15 border-amber-400/30 text-amber-200'
                      : 'bg-white/[0.04] border-white/10 text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="inline-flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4" />
                      <span>{isAr ? 'مراقبة الميزانية الشهرية للعقار' : 'Property Monthly Budget Guard'}</span>
                    </span>
                    <span className="font-mono-num">{budgetMetrics.pct}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-black/30 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        budgetMetrics.pct >= 100 ? 'bg-red-500' : budgetMetrics.pct >= budgetMetrics.alertAt ? 'bg-amber-400' : 'bg-emerald-400'
                      }`}
                      style={{ width: `${Math.min(100, budgetMetrics.pct)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] font-mono-num opacity-90">
                    <span>المنصرف + الحالي: {formatSar(budgetMetrics.projected, lang)}</span>
                    <span>الحد الشهري: {formatSar(budgetMetrics.limit, lang)}</span>
                  </div>
                  {budgetMetrics.pct >= 100 && budgetMetrics.blockAt100 && (
                    <div className="text-[11px] font-bold">
                      ⚠️ تجاوز الميزانية 100% — العقار مقيد بحد الصرف الشهري (يُسمح بالاعتماد للمدير العام فقط).
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-slate-300 block mb-1">{isAr ? 'البيان والملاحظات التفصيلية' : 'Notes & Description'}</label>
                <textarea
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="وصف الأعمال المنجزة أو المواد المشتراة..."
                  className="w-full px-3 py-2 rounded-xl bg-[#0A0E1A] border border-white/10"
                />
              </div>
            </div>
          )}

          {/* STEP 3: PAYMENT DETAILS */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 block mb-1">{isAr ? 'طريقة الدفع' : 'Payment Method'}</label>
                  <select
                    value={form.paymentMethod}
                    onChange={(e) => {
                      const m = e.target.value as PaymentMethod | 'آجل';
                      setForm({
                        ...form,
                        paymentMethod: m,
                        paymentStatus: m === 'آجل' ? 'لم يُدفع' : form.paymentStatus,
                        paidAmount: m === 'آجل' ? 0 : form.paidAmount,
                      });
                    }}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10"
                  >
                    <option value="تحويل بنكي">تحويل بنكي</option>
                    <option value="شبكة مدى">شبكة مدى</option>
                    <option value="نقدي">نقدي / عهدة</option>
                    <option value="شيك">شيك</option>
                    <option value="سداد إلكتروني">سداد إلكتروني</option>
                    <option value="آجل">آجل (على الحساب)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">{isAr ? 'الحساب المدفوع منه' : 'Paid From Account'}</label>
                  <select
                    value={form.paidFromAccount}
                    onChange={(e) => setForm({ ...form, paidFromAccount: e.target.value })}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10"
                  >
                    <option value="مصرف الراجحي — حساب التشغيل">مصرف الراجحي — حساب التشغيل</option>
                    <option value="البنك الأهلي السعودي — حساب الضمان">البنك الأهلي السعودي — حساب الضمان</option>
                    <option value="الصندوق النقدي المركزي">الصندوق النقدي المركزي</option>
                    <option value="عهدة مشرف الصيانة">عهدة مشرف الصيانة</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">{isAr ? 'حالة السداد' : 'Payment Status'}</label>
                  <select
                    value={form.paymentStatus}
                    onChange={(e) => {
                      const ps = e.target.value as ExpensePaymentStatus;
                      setForm({
                        ...form,
                        paymentStatus: ps,
                        paidAmount: ps === 'مدفوع بالكامل' ? grossAmount : ps === 'لم يُدفع' ? 0 : form.paidAmount,
                      });
                    }}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10"
                  >
                    <option value="مدفوع بالكامل">مدفوع بالكامل</option>
                    <option value="مدفوع جزئياً">مدفوع جزئياً</option>
                    <option value="لم يُدفع">لم يُدفع (ذمة دائنة)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 block mb-1">{isAr ? 'رقم الحوالة / المرجع' : 'Reference Number'}</label>
                  <input
                    value={form.referenceNumber}
                    onChange={(e) => setForm({ ...form, referenceNumber: e.target.value })}
                    placeholder="TR-..."
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10 font-mono-num"
                  />
                </div>

                {form.paymentStatus === 'مدفوع جزئياً' && (
                  <div>
                    <label className="text-slate-300 block mb-1">{isAr ? 'المبلغ المدفوع الآن' : 'Paid Now'}</label>
                    <input
                      type="number"
                      min={0}
                      max={grossAmount}
                      value={form.paidAmount}
                      onChange={(e) => setForm({ ...form, paidAmount: Number(e.target.value) })}
                      className="w-full min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10 font-mono-num"
                    />
                  </div>
                )}

                <div>
                  <label className="text-slate-300 block mb-1">{isAr ? 'تاريخ الاستحقاق (للآجل/المتبقي)' : 'Due Date'}</label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#0A0E1A] border border-white/10 font-mono-num"
                  />
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 flex justify-between font-mono-num">
                <span>الإجمالي: {formatCurrency(grossAmount, form.currency, lang)}</span>
                <span className="text-amber-300 font-bold">المتبقي للسداد: {formatCurrency(remainingAmount, form.currency, lang)}</span>
              </div>
            </div>
          )}

          {/* STEP 4: ATTACHMENTS, ZATCA QR & DIGITAL SIGNATURE */}
          {step === 4 && (
            <div className="space-y-4">
              {grossAmount > 500 && !form.invoiceImageDataUrl && !form.invoicePdfDataUrl && (
                <div className="p-3 rounded-xl bg-amber-500/15 border border-amber-400/30 text-amber-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    {isAr
                      ? 'تنبيه رقابي: المصروفات فوق 500 ر.س تتطلب إرفاق صورة أو ملف PDF للفاتورة الأصلية قبل الإرسال للاعتماد.'
                      : 'Expenses over 500 SAR require attaching the original invoice image/PDF.'}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="p-4 rounded-xl border border-dashed border-white/20 bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer flex flex-col items-center gap-2 text-center">
                  <Upload className="w-5 h-5 text-blue-300" />
                  <span className="font-semibold">
                    {form.invoiceImageDataUrl ? '✓ تم إرفاق صورة الفاتورة' : isAr ? 'صورة الفاتورة الأصلية' : 'Original Invoice Photo'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadAttachment(f, 'invoiceImage');
                    }}
                  />
                </label>

                <label className="p-4 rounded-xl border border-dashed border-white/20 bg-white/[0.03] hover:bg-white/[0.06] cursor-pointer flex flex-col items-center gap-2 text-center">
                  <FileText className="w-5 h-5 text-emerald-300" />
                  <span className="font-semibold">
                    {form.invoicePdfDataUrl ? '✓ تم إرفاق ملف PDF' : isAr ? 'ملف PDF للفاتورة (اختياري)' : 'Invoice PDF (Optional)'}
                  </span>
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadAttachment(f, 'invoicePdf');
                    }}
                  />
                </label>
              </div>

              <div className="p-3.5 rounded-xl bg-white/[0.04] border border-white/10 space-y-2">
                <label className="flex items-center justify-between gap-2 cursor-pointer">
                  <span className="inline-flex items-center gap-2 font-semibold text-emerald-300">
                    <QrCode className="w-4 h-4" />
                    <span>{isAr ? 'التحقق من رمز QR الفوترة الإلكترونية (ZATCA)' : 'ZATCA E-Invoice QR Verified'}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={form.zatcaQrVerified}
                    onChange={(e) => setForm({ ...form, zatcaQrVerified: e.target.checked })}
                    className="w-4 h-4 accent-emerald-500"
                  />
                </label>
              </div>

              <div className="flex items-center justify-between">
                <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 cursor-pointer font-semibold">
                  <Camera className="w-3.5 h-3.5" />
                  <span>{isAr ? `إضافة صور قبل/بعد التنفيذ (${form.workPhotosDataUrls.length})` : `Before/After Photos (${form.workPhotosDataUrls.length})`}</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUploadAttachment(f, 'workPhoto');
                    }}
                  />
                </label>
              </div>

              {/* Recipient Signature Canvas */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{isAr ? 'التوقيع الرقمي للمستلم / المشرف:' : 'Recipient Digital Signature:'}</span>
                  <button type="button" onClick={clearSig} className="inline-flex items-center gap-1 text-slate-400 hover:text-white cursor-pointer">
                    <Eraser className="w-3.5 h-3.5" />
                    <span>{isAr ? 'مسح' : 'Clear'}</span>
                  </button>
                </div>
                <canvas
                  ref={sigCanvasRef}
                  width={540}
                  height={100}
                  onPointerDown={startDraw}
                  onPointerMove={moveDraw}
                  onPointerUp={endDraw}
                  onPointerLeave={endDraw}
                  className="w-full h-24 rounded-xl bg-white border border-white/20 touch-none cursor-crosshair"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="px-5 py-4 bg-[#0A0E1A]/90 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3 | 4)}
                className="min-h-[40px] px-3.5 rounded-xl border border-white/15 hover:bg-white/10 inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>{isAr ? 'السابق' : 'Back'}</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => handleSubmit(true)}
              className="min-h-[40px] px-3.5 rounded-xl border border-white/15 bg-white/[0.05] hover:bg-white/10 font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-amber-300" />
              <span>{isAr ? 'حفظ كمسودة' : 'Save Draft'}</span>
            </button>

            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s + 1) as 1 | 2 | 3 | 4)}
                className="min-h-[40px] px-4 rounded-xl bg-[#26478D] hover:bg-[#1e3a75] text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <span>{isAr ? 'التالي' : 'Next'}</span>
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                type="button"
                disabled={submitting}
                onClick={() => handleSubmit(false)}
                className="min-h-[40px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitting ? (isAr ? 'جاري الرفع...' : 'Submitting...') : isAr ? 'إرسال للاعتماد' : 'Submit Expense'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
