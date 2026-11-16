import React, { useMemo, useState } from 'react';
import { Plus, X, Send, Scale, FileSpreadsheet, ShoppingCart, Star, FileText, Building2, Phone, Mail, CreditCard } from 'lucide-react';
import { useAqar } from '../context/AqarContext';
import { CurrencyCode, Owner, PaymentMethod, PurchaseOrderStatus, Vendor, VendorRatingBreakdown } from '../types/aqar';
import { formatCurrency } from '../utils/formatters';
import { PrintViewButton } from './PrintViewButton';
import { ExpensesInvoicesCenterView } from './ExpensesInvoicesCenterView';
import { triggerHaptic } from '../utils/haptics';

export function AccountingOwnersView() {
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
  const [tab, setTab] = useState<'owners' | 'expenses' | 'accounting' | 'vendors'>(
    currentUser?.role === 'owner' ? 'owners' : 'expenses'
  );
  const [accSubTab, setAccSubTab] = useState<'ledger' | 'trial' | 'statements'>('ledger');
  const [showAddVendor, setShowAddVendor] = useState(false);
  const [transferOwner, setTransferOwner] = useState<Owner | null>(null);
  const [showAddPo, setShowAddPo] = useState(false);
  const [statementVendor, setStatementVendor] = useState<Vendor | null>(null);
  const [ratingVendor, setRatingVendor] = useState<{ vendor: Vendor; breakdown: VendorRatingBreakdown } | null>(null);

  const [vendorForm, setVendorForm] = useState({
    nameAr: '',
    nameEn: '',
    crNumber: '',
    vatNumber: '',
    category: 'صيانة عامة',
    city: 'الرياض',
    contactPerson: '',
    iban: '',
    phone: '',
    email: '',
  });

  const [transferForm, setTransferForm] = useState({
    amount: 10000,
    currency: 'SAR' as CurrencyCode,
    paymentMethod: 'تحويل بنكي' as PaymentMethod,
    referenceNumber: '',
    notes: '',
  });

  const [poForm, setPoForm] = useState({
    title: '',
    propertyId: '',
    category: 'صيانة وتكييف',
    vendor1Id: '',
    vendor1Amount: 1500,
    vendor2Id: '',
    vendor2Amount: 1850,
    currency: 'SAR' as CurrencyCode,
  });

  const ownerStatements = useMemo(() => {
    if (!state) return [];
    return state.owners.map((owner) => {
      const ownedProps = state.properties.filter((p) =>
        p.ownerShares.some((s) => s.ownerId === owner.id)
      );
      let grossRent = 0;
      let managementFee = 0;
      let approvedExpenses = 0;

      for (const prop of ownedProps) {
        const share = prop.ownerShares.find((s) => s.ownerId === owner.id)?.sharePercent || 0;
        const factor = share / 100;

        const propCollected = state.payments
          .filter((p) => p.propertyId === prop.id && p.status === 'معتمد' && p.paymentType === 'إيجار')
          .reduce((s, p) => s + convertToBase(p.amount, p.currency || 'SAR'), 0);

        const propMgmt = propCollected * (prop.managementFeePercent / 100);
        const propExpenses = state.expenses
          .filter((e) => e.propertyId === prop.id && e.approvalStatus === 'معتمد' && e.bearer === 'المالك')
          .reduce((s, e) => s + convertToBase(e.amount, e.currency || 'SAR'), 0);

        grossRent += propCollected * factor;
        managementFee += propMgmt * factor;
        approvedExpenses += propExpenses * factor;
      }

      const transferredInBase = convertToBase(owner.totalTransferred, 'SAR');
      const netPayable = grossRent - managementFee - approvedExpenses - transferredInBase;

      return {
        owner,
        ownedProps,
        grossRent: Math.round(grossRent * 100) / 100,
        managementFee: Math.round(managementFee * 100) / 100,
        approvedExpenses: Math.round(approvedExpenses * 100) / 100,
        transferredInBase: Math.round(transferredInBase * 100) / 100,
        netPayable: Math.round(netPayable * 100) / 100,
      };
    });
  }, [state, convertToBase]);

  if (!state || !currentUser) return null;

  const isOwner = currentUser.role === 'owner';

  const handleCreateVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await mutate(
      'POST',
      '/api/vendors',
      { ...vendorForm, rating: 5, active: true },
      { offlineDescAr: `إضافة المورد ${vendorForm.nameAr}` }
    );
    if (res) {
      triggerHaptic('success');
      pushToast('success', lang === 'ar' ? 'تمت إضافة المقاول بنجاح' : 'Vendor added');
      setShowAddVendor(false);
      setVendorForm({
        nameAr: '',
        nameEn: '',
        crNumber: '',
        vatNumber: '',
        category: 'صيانة عامة',
        city: 'الرياض',
        contactPerson: '',
        iban: '',
        phone: '',
        email: '',
      });
    }
  };

  const handleSubmitVendorRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ratingVendor) return;
    const res = await mutate(
      'PATCH',
      `/api/vendors/${ratingVendor.vendor.id}`,
      { ratingBreakdown: ratingVendor.breakdown },
      { offlineDescAr: `تحديث تقييم المورد ${ratingVendor.vendor.nameAr}` }
    );
    if (res) {
      triggerHaptic('success');
      pushToast('success', lang === 'ar' ? 'تم تحديث تقييم أداء المورد بنجاح' : 'Vendor rating updated');
      setRatingVendor(null);
    }
  };

  const handleOwnerTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferOwner) return;
    const res = await mutate(
      'POST',
      `/api/owners/${transferOwner.id}/transfer`,
      transferForm,
      { offlineDescAr: `تحويل مستحقات للمالك ${transferOwner.nameAr}` }
    );
    if (res) {
      pushToast('success', lang === 'ar' ? 'تم تسجيل التحويل المالي للمالك وترحيل القيد المتوازن' : 'Owner payout recorded');
      setTransferOwner(null);
    }
  };

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    const v1 = state.vendors.find((v) => v.id === (poForm.vendor1Id || state.vendors[0]?.id));
    const v2 = state.vendors.find((v) => v.id === poForm.vendor2Id);
    const quotes = [
      v1 && {
        vendorId: v1.id,
        vendorName: v1.nameAr,
        amount: poForm.vendor1Amount,
        deliveryDays: 2,
        warrantyMonths: 12,
        notes: 'العرض الأساسي',
      },
      v2 &&
        v2.id !== v1?.id && {
          vendorId: v2.id,
          vendorName: v2.nameAr,
          amount: poForm.vendor2Amount,
          deliveryDays: 3,
          warrantyMonths: 12,
          notes: 'عرض مقارنة ثانٍ',
        },
    ].filter(Boolean);

    const bestAmount = Math.min(poForm.vendor1Amount, v2 ? poForm.vendor2Amount : poForm.vendor1Amount);
    const res = await mutate(
      'POST',
      '/api/purchase-orders',
      {
        title: poForm.title,
        propertyId: poForm.propertyId || state.properties[0]?.id,
        category: poForm.category,
        status: 'مقارنة عروض',
        quotes,
        selectedVendorId: v1?.id,
        approvedAmount: bestAmount,
        currency: poForm.currency,
      },
      { offlineDescAr: `طلب شراء ${poForm.title}` }
    );
    if (res) {
      pushToast('success', lang === 'ar' ? 'تم إنشاء طلب الشراء ومقارنة عروض الموردين' : 'Purchase order created');
      setShowAddPo(false);
    }
  };

  const handleAdvancePoStatus = async (poId: string, status: PurchaseOrderStatus) => {
    const res = await mutate('PATCH', `/api/purchase-orders/${poId}`, { status });
    if (res) pushToast('success', lang === 'ar' ? `تمت ترقية الطلب إلى: ${status}` : `PO updated: ${status}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-200/70 dark:bg-white/[0.06]">
          {!isOwner && (
            <button
              onClick={() => setTab('expenses')}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                tab === 'expenses' ? 'bg-white dark:bg-[#26478D] text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {lang === 'ar' ? `المصروفات والموافقات (${state.expenses.length})` : `Expenses (${state.expenses.length})`}
            </button>
          )}
          <button
            onClick={() => setTab('owners')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
              tab === 'owners' ? 'bg-white dark:bg-[#26478D] text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            {lang === 'ar' ? `كشوف وحسابات الملاك (${ownerStatements.length})` : `Owners & Statements`}
          </button>
          {!isOwner && (
            <>
              <button
                onClick={() => setTab('accounting')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  tab === 'accounting' ? 'bg-white dark:bg-[#26478D] text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {lang === 'ar' ? `دليل الحسابات والقيود (${state.journals.length})` : `Accounting & Journals`}
              </button>
              <button
                onClick={() => setTab('vendors')}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  tab === 'vendors' ? 'bg-white dark:bg-[#26478D] text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {lang === 'ar' ? `الموردون والمقاولون (${state.vendors.length})` : `Vendors (${state.vendors.length})`}
              </button>
            </>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tab === 'owners' && (
            <PrintViewButton
              labelAr="طباعة كشوف الملاك"
              labelEn="Print Statements"
            />
          )}
          {tab === 'vendors' && hasPermission('manage_maintenance') && (
            <>
              <button
                onClick={() => setShowAddPo(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border border-[#26478D]/30 bg-[#26478D]/10 text-[#26478D] dark:text-blue-300 cursor-pointer"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'طلب شراء / عروض أسعار' : 'New PO / Quotes'}</span>
              </button>
              <button
                onClick={() => setShowAddVendor(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-[#26478D] text-white hover:bg-[#1e3a75] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'مقاول جديد' : 'Add Vendor'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab 1: Expenses & Supplier Invoices Center */}
      {tab === 'expenses' && <ExpensesInvoicesCenterView />}

      {/* Tab 2: Owners & Statements */}
      {tab === 'owners' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {ownerStatements.map(({ owner, ownedProps, grossRent, managementFee, approvedExpenses, transferredInBase, netPayable }) => (
            <div key={owner.id} className="p-6 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface space-y-4 print-only-panel">
              <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-200 dark:border-white/10">
                <div>
                  <div className="text-xs text-slate-500 font-mono-num">
                    {owner.bankName} · {owner.iban}
                  </div>
                  <h3 className="text-lg font-bold mt-0.5">{owner.nameAr}</h3>
                </div>
                <div className="text-end">
                  <div className="text-[11px] text-slate-500">
                    {lang === 'ar' ? `صافي الرصيد (${baseCurrency})` : `Net Balance (${baseCurrency})`}
                  </div>
                  <div className="text-xl font-bold font-mono-num text-[#26478D] dark:text-blue-400">
                    {formatCurrency(netPayable, baseCurrency, lang)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <div className="text-slate-500">إجمالي الإيجارات المحصلة</div>
                  <div className="font-mono-num font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {formatCurrency(grossRent, baseCurrency, lang)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">عمولة إدارة الأملاك</div>
                  <div className="font-mono-num font-semibold mt-0.5">-{formatCurrency(managementFee, baseCurrency, lang)}</div>
                </div>
                <div>
                  <div className="text-slate-500">مصروفات معتمدة</div>
                  <div className="font-mono-num font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
                    -{formatCurrency(approvedExpenses, baseCurrency, lang)}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">تحويلات سابقة</div>
                  <div className="font-mono-num font-semibold mt-0.5">-{formatCurrency(transferredInBase, baseCurrency, lang)}</div>
                </div>
              </div>

              <div className="text-xs text-slate-600 dark:text-slate-300 pt-2 border-t border-slate-200/70 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
                <div className="flex-1">
                  العقارات المملوكة:{' '}
                  {ownedProps
                    .map((p) => {
                      const pct = p.ownerShares.find((s) => s.ownerId === owner.id)?.sharePercent || 0;
                      const comp = state.companies?.find((c) => c.id === p.companyId);
                      const mode = p.ownershipMode || 'إدارة للغير';
                      return `${p.nameAr} (${pct}% · ${mode}${comp ? ` · ${comp.nameAr}` : ''})`;
                    })
                    .join(' · ')}
                </div>
                {hasPermission('manage_accounting') && !isOwner && (
                  <button
                    onClick={() => {
                      setTransferForm({
                        amount: Math.max(0, Math.round(netPayable)),
                        currency: baseCurrency,
                        paymentMethod: 'تحويل بنكي',
                        referenceNumber: `TR-${Math.floor(10000 + Math.random() * 89999)}`,
                        notes: `سداد صافي مستحقات ${owner.nameAr}`,
                      });
                      setTransferOwner(owner);
                    }}
                    className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#26478D] text-white text-[11px] font-semibold hover:bg-[#1e3a75] cursor-pointer shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{lang === 'ar' ? 'تحويل مستحقات' : 'Transfer Payout'}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 3: Double-Entry Accounting, Trial Balance & Financial Statements */}
      {tab === 'accounting' && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2 no-print">
            <button
              onClick={() => setAccSubTab('ledger')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                accSubTab === 'ledger' ? 'bg-[#26478D] text-white' : 'border border-slate-200 dark:border-white/10 glass-surface'
              }`}
            >
              {lang === 'ar' ? 'دليل الحسابات والقيود اليومية' : 'Accounts & Journals'}
            </button>
            <button
              onClick={() => setAccSubTab('trial')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                accSubTab === 'trial' ? 'bg-[#26478D] text-white' : 'border border-slate-200 dark:border-white/10 glass-surface'
              }`}
            >
              <Scale className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'ميزان المراجعة (Trial Balance)' : 'Trial Balance'}</span>
            </button>
            <button
              onClick={() => setAccSubTab('statements')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                accSubTab === 'statements' ? 'bg-[#26478D] text-white' : 'border border-slate-200 dark:border-white/10 glass-surface'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>{lang === 'ar' ? 'قائمة الدخل والمركز المالي' : 'Income Statement & Balance Sheet'}</span>
            </button>
          </div>

          {accSubTab === 'ledger' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10">
                  <h3 className="text-sm font-semibold">دليل الحسابات العقاري</h3>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                  {state.accounts.map((acc) => (
                    <div key={acc.id} className="px-5 py-3 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-medium">
                          <span className="font-mono-num text-slate-400 me-2">{acc.code}</span>
                          {acc.nameAr}
                        </div>
                        <div className="text-[11px] text-slate-500">{acc.type}</div>
                      </div>
                      <div className="font-mono-num font-bold">{formatConvertedBase(acc.balance, 'SAR')}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10">
                  <h3 className="text-sm font-semibold">القيود اليومية التلقائية المتوازنة</h3>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-white/5 max-h-[540px] overflow-y-auto">
                  {state.journals.map((j) => (
                    <div key={j.id} className="p-4 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono-num font-bold text-[#26478D] dark:text-blue-400">
                          {j.entryNumber} · {j.referenceType}
                        </span>
                        <span className="font-mono-num text-slate-500">{j.date}</span>
                      </div>
                      <div className="text-slate-700 dark:text-slate-200">{j.description}</div>
                      <div className="rounded-lg bg-slate-50 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/5">
                        {j.lines.map((l, idx) => (
                          <div key={idx} className="px-3 py-1.5 flex items-center justify-between font-mono-num text-[11px]">
                            <span className="font-sans">{l.accountName}</span>
                            <div className="flex gap-4">
                              <span className={l.debit > 0 ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-400'}>
                                مدين: {l.debit.toLocaleString()}
                              </span>
                              <span className={l.credit > 0 ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-slate-400'}>
                                دائن: {l.credit.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {accSubTab === 'trial' && (
            <div className="rounded-2xl border border-slate-200 dark:border-white/10 glass-surface overflow-x-auto">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
                <h3 className="text-sm font-bold">
                  {lang === 'ar' ? `ميزان المراجعة بالأرصدة (${baseCurrency})` : `Trial Balance (${baseCurrency})`}
                </h3>
              </div>
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-50 dark:bg-white/[0.03] text-slate-500 border-b border-slate-200 dark:border-white/10">
                  <tr>
                    <th className="py-3 px-4 text-start font-medium">الرمز</th>
                    <th className="py-3 px-4 text-start font-medium">اسم الحساب</th>
                    <th className="py-3 px-4 text-start font-medium">التصنيف</th>
                    <th className="py-3 px-4 text-start font-medium">رصيد مدين</th>
                    <th className="py-3 px-4 text-start font-medium">رصيد دائن</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {state.accounts.map((acc) => {
                    const isDebitNature = acc.type === 'أصول' || acc.type === 'مصروفات';
                    const val = convertToBase(acc.balance, 'SAR');
                    return (
                      <tr key={acc.id}>
                        <td className="py-3 px-4 font-mono-num text-slate-500">{acc.code}</td>
                        <td className="py-3 px-4 font-semibold">{acc.nameAr}</td>
                        <td className="py-3 px-4">{acc.type}</td>
                        <td className="py-3 px-4 font-mono-num text-emerald-600 dark:text-emerald-400">
                          {isDebitNature ? formatCurrency(val, baseCurrency, lang) : '—'}
                        </td>
                        <td className="py-3 px-4 font-mono-num text-amber-600 dark:text-amber-400">
                          {!isDebitNature ? formatCurrency(val, baseCurrency, lang) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {accSubTab === 'statements' && (() => {
            const totalAssets = state.accounts
              .filter((a) => a.type === 'أصول')
              .reduce((s, a) => s + convertToBase(a.balance, 'SAR'), 0);
            const totalLiab = state.accounts
              .filter((a) => a.type === 'التزامات')
              .reduce((s, a) => s + convertToBase(a.balance, 'SAR'), 0);
            const totalRev = state.accounts
              .filter((a) => a.type === 'إيرادات')
              .reduce((s, a) => s + convertToBase(a.balance, 'SAR'), 0);
            const totalExp = state.accounts
              .filter((a) => a.type === 'مصروفات')
              .reduce((s, a) => s + convertToBase(a.balance, 'SAR'), 0);
            const netIncome = totalRev - totalExp;

            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-6 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface space-y-4">
                  <h3 className="text-sm font-bold border-b border-slate-200 dark:border-white/10 pb-3">
                    {lang === 'ar' ? `قائمة الدخل التشغيلية (${baseCurrency})` : `Operating Income Statement (${baseCurrency})`}
                  </h3>
                  <div className="space-y-2.5 text-xs">
                    {state.accounts
                      .filter((a) => a.type === 'إيرادات' || a.type === 'مصروفات')
                      .map((a) => (
                        <div key={a.id} className="flex justify-between">
                          <span>
                            {a.nameAr} <span className="text-slate-400">({a.type})</span>
                          </span>
                          <span className={`font-mono-num font-semibold ${a.type === 'إيرادات' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                            {a.type === 'مصروفات' ? '-' : ''}
                            {formatConvertedBase(a.balance, 'SAR')}
                          </span>
                        </div>
                      ))}
                  </div>
                  <div className="pt-3 border-t border-slate-200 dark:border-white/10 flex justify-between text-sm font-bold">
                    <span>صافي الربح / الفائض التشغيلي</span>
                    <span className="font-mono-num text-[#26478D] dark:text-blue-400">
                      {formatCurrency(netIncome, baseCurrency, lang)}
                    </span>
                  </div>
                </div>

                <div className="p-6 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface space-y-4">
                  <h3 className="text-sm font-bold border-b border-slate-200 dark:border-white/10 pb-3">
                    {lang === 'ar' ? `ملخص المركز المالي (${baseCurrency})` : `Balance Sheet Summary (${baseCurrency})`}
                  </h3>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between">
                      <span>إجمالي الأصول والنقدية والذمم</span>
                      <span className="font-mono-num font-bold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(totalAssets, baseCurrency, lang)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>إجمالي الالتزامات ومستحقات الملاك والتأمينات</span>
                      <span className="font-mono-num font-bold text-amber-600 dark:text-amber-400">
                        {formatCurrency(totalLiab, baseCurrency, lang)}
                      </span>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-slate-200/70 dark:border-white/10 font-bold text-sm">
                      <span>صافي المركز وحقوق الإدارة</span>
                      <span className="font-mono-num text-[#26478D] dark:text-blue-400">
                        {formatCurrency(totalAssets - totalLiab, baseCurrency, lang)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Tab 4: Vendors & Purchase Orders / Quote Comparison */}
      {tab === 'vendors' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {state.vendors.map((v) => {
              const vendorExpenses = state.expenses.filter((e) => e.vendorId === v.id && e.approvalStatus !== 'ملغى');
              const vendorInvoices = (state.supplierInvoices || []).filter((inv) => inv.vendorId === v.id && inv.status !== 'ملغاة');
              const totalVolumeBase =
                vendorExpenses.reduce((s, e) => s + convertToBase(e.amount, e.currency || 'SAR'), 0) +
                vendorInvoices.reduce((s, i) => s + convertToBase(i.totalAmount, i.currency || 'SAR'), 0);

              return (
                <div key={v.id} className="p-5 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold">{v.nameAr}</div>
                        <div className="text-[11px] text-slate-500">
                          {v.category} · سجل <span className="font-mono-num">{v.crNumber}</span>
                        </div>
                      </div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/15 text-amber-500 font-mono-num text-xs font-bold">
                        <Star className="w-3 h-3 fill-amber-500" />
                        <span>{v.rating}/5</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      <div className="inline-flex items-center gap-1 font-mono-num truncate">
                        <Phone className="w-3 h-3 shrink-0" />
                        <span>{v.phone}</span>
                      </div>
                      <div className="inline-flex items-center gap-1 font-mono-num truncate">
                        <Mail className="w-3 h-3 shrink-0" />
                        <span>{v.email || '—'}</span>
                      </div>
                      {v.vatNumber && (
                        <div className="col-span-2 font-mono-num text-[10px]">
                          الرقم الضريبي: {v.vatNumber}
                        </div>
                      )}
                      {v.iban && (
                        <div className="col-span-2 inline-flex items-center gap-1 font-mono-num text-[10px] truncate">
                          <CreditCard className="w-3 h-3 shrink-0" />
                          <span>{v.iban}</span>
                        </div>
                      )}
                      {(v.city || v.contactPerson) && (
                        <div className="col-span-2 inline-flex items-center gap-1 text-[10px]">
                          <Building2 className="w-3 h-3 shrink-0" />
                          <span>{[v.city, v.contactPerson].filter(Boolean).join(' · ')}</span>
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl bg-slate-100/80 dark:bg-white/[0.04] px-3 py-2 flex items-center justify-between text-[11px]">
                      <span className="text-slate-500">إجمالي التعاملات ({vendorExpenses.length + vendorInvoices.length}):</span>
                      <span className="font-mono-num font-bold text-[#26478D] dark:text-blue-300">
                        {formatCurrency(totalVolumeBase, baseCurrency, lang)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/70 dark:border-white/10 no-print">
                    <button
                      type="button"
                      onClick={() => setStatementVendor(v)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#26478D] hover:bg-[#1e3a75] text-white text-[11px] font-semibold cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{lang === 'ar' ? 'كشف حساب وأعمال المورد' : 'Statement & History'}</span>
                    </button>
                    {hasPermission('manage_maintenance') && (
                      <button
                        type="button"
                        onClick={() =>
                          setRatingVendor({
                            vendor: v,
                            breakdown: v.ratingBreakdown || {
                              quality: Math.round(v.rating) || 5,
                              punctuality: Math.round(v.rating) || 5,
                              pricing: Math.round(v.rating) || 5,
                              cooperation: Math.round(v.rating) || 5,
                            },
                          })
                        }
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-amber-400/30 bg-amber-500/10 text-amber-600 dark:text-amber-300 text-[11px] font-semibold cursor-pointer"
                      >
                        <Star className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'تقييم' : 'Rate'}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-2xl border border-slate-200 dark:border-white/10 glass-surface overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-[#26478D] dark:text-blue-400" />
                <h3 className="text-sm font-bold">
                  {lang === 'ar'
                    ? `طلبات الشراء ومقارنة عروض الأسعار (${(state.purchaseOrders || []).length})`
                    : `Purchase Orders & Quote Comparison (${(state.purchaseOrders || []).length})`}
                </h3>
              </div>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {(state.purchaseOrders || []).map((po) => {
                const prop = state.properties.find((p) => p.id === po.propertyId);
                return (
                  <div key={po.id} className="p-5 space-y-3 text-xs">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-mono-num font-bold text-[#26478D] dark:text-blue-400">
                          {po.poNumber} · {prop?.nameAr}
                        </div>
                        <div className="text-sm font-bold mt-0.5">{po.title}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono-num font-bold text-sm">
                          {formatInCurrency(po.approvedAmount, po.currency)}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 font-semibold">
                          {po.status}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {po.quotes.map((q, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border ${
                            q.vendorId === po.selectedVendorId
                              ? 'border-emerald-400/70 bg-emerald-50/60 dark:bg-emerald-500/[0.06]'
                              : 'border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02]'
                          } flex items-center justify-between gap-2`}
                        >
                          <div>
                            <div className="font-semibold">{q.vendorName}</div>
                            <div className="text-[11px] text-slate-500">
                              تنفيذ: {q.deliveryDays} أيام · ضمان: {q.warrantyMonths} شهر
                            </div>
                          </div>
                          <div className="font-mono-num font-bold">{formatInCurrency(q.amount, po.currency)}</div>
                        </div>
                      ))}
                    </div>

                    {hasPermission('approve_expense_manager') && po.status !== 'مفوتر' && (
                      <div className="flex flex-wrap items-center justify-end gap-2 no-print">
                        {po.status === 'مقارنة عروض' && (
                          <button
                            onClick={() => handleAdvancePoStatus(po.id, 'أمر شراء')}
                            className="px-3 py-1.5 rounded-lg bg-[#26478D] text-white font-semibold cursor-pointer"
                          >
                            اعتماد وإصدار أمر شراء
                          </button>
                        )}
                        {po.status === 'أمر شراء' && (
                          <button
                            onClick={() => handleAdvancePoStatus(po.id, 'مستلم')}
                            className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer"
                          >
                            تأكيد الاستلام والتركيب
                          </button>
                        )}
                        {po.status === 'مستلم' && (
                          <button
                            onClick={() => handleAdvancePoStatus(po.id, 'مفوتر')}
                            className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-semibold cursor-pointer"
                          >
                            مطابقة الفاتورة وإغلاق الطلب
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Add Vendor Modal */}
      {showAddVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreateVendor}
            className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#13192B] p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">إضافة مورد / مقاول صيانة</h3>
              <button type="button" onClick={() => setShowAddVendor(false)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <input
                required
                placeholder="اسم المؤسسة أو المقاول *"
                value={vendorForm.nameAr}
                onChange={(e) => setVendorForm({ ...vendorForm, nameAr: e.target.value })}
                className="sm:col-span-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-transparent"
              />
              <input
                required
                placeholder="رقم السجل التجاري *"
                value={vendorForm.crNumber}
                onChange={(e) => setVendorForm({ ...vendorForm, crNumber: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-transparent font-mono-num"
              />
              <input
                placeholder="الرقم الضريبي (15 خانة)"
                value={vendorForm.vatNumber}
                onChange={(e) => setVendorForm({ ...vendorForm, vatNumber: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-transparent font-mono-num"
              />
              <input
                required
                placeholder="التخصص (تكييف، سباكة، كهرباء...)"
                value={vendorForm.category}
                onChange={(e) => setVendorForm({ ...vendorForm, category: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-transparent"
              />
              <input
                placeholder="المدينة"
                value={vendorForm.city}
                onChange={(e) => setVendorForm({ ...vendorForm, city: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-transparent"
              />
              <input
                required
                placeholder="رقم الجوال *"
                value={vendorForm.phone}
                onChange={(e) => setVendorForm({ ...vendorForm, phone: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-transparent font-mono-num"
              />
              <input
                placeholder="البريد الإلكتروني"
                value={vendorForm.email}
                onChange={(e) => setVendorForm({ ...vendorForm, email: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-transparent font-mono-num"
              />
              <input
                placeholder="اسم المسؤول / المندوب"
                value={vendorForm.contactPerson}
                onChange={(e) => setVendorForm({ ...vendorForm, contactPerson: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-transparent"
              />
              <input
                placeholder="رقم الآيبان البنكي (SA...)"
                value={vendorForm.iban}
                onChange={(e) => setVendorForm({ ...vendorForm, iban: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-transparent font-mono-num"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddVendor(false)} className="px-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-white/10 cursor-pointer">
                إلغاء
              </button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#26478D] text-white cursor-pointer">
                حفظ المورد
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Vendor 4-Criteria Rating Modal */}
      {ratingVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4">
          <form
            onSubmit={handleSubmitVendorRating}
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#13192B] p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">
                {lang === 'ar' ? `تقييم أداء المورد: ${ratingVendor.vendor.nameAr}` : `Rate Vendor: ${ratingVendor.vendor.nameEn}`}
              </h3>
              <button type="button" onClick={() => setRatingVendor(null)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-xs">
              {[
                { key: 'quality' as const, labelAr: 'جودة التنفيذ والمواد' },
                { key: 'punctuality' as const, labelAr: 'الالتزام بالمواعيد والسرعة' },
                { key: 'pricing' as const, labelAr: 'عدالة الأسعار ومطابقة الفواتير' },
                { key: 'cooperation' as const, labelAr: 'التعاون والضمان ما بعد الخدمة' },
              ].map((crit) => {
                const val = ratingVendor.breakdown[crit.key];
                return (
                  <div key={crit.key} className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-white/[0.04]">
                    <span className="font-semibold">{crit.labelAr}</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() =>
                            setRatingVendor({
                              ...ratingVendor,
                              breakdown: { ...ratingVendor.breakdown, [crit.key]: star },
                            })
                          }
                          className="cursor-pointer p-0.5"
                        >
                          <Star
                            className={`w-4 h-4 ${star <= val ? 'text-amber-500 fill-amber-500' : 'text-slate-300 dark:text-slate-600'}`}
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200 dark:border-white/10">
              <span>المتوسط العام:</span>
              <span className="font-mono-num font-bold text-amber-500 text-sm">
                {(
                  (ratingVendor.breakdown.quality +
                    ratingVendor.breakdown.punctuality +
                    ratingVendor.breakdown.pricing +
                    ratingVendor.breakdown.cooperation) /
                  4
                ).toFixed(1)}
                /5
              </span>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRatingVendor(null)} className="px-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-white/10 cursor-pointer">
                إلغاء
              </button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#26478D] text-white cursor-pointer">
                حفظ التقييم
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Supplier Work History & Statement Drawer */}
      {statementVendor && (() => {
        const vExpenses = state.expenses.filter((e) => e.vendorId === statementVendor.id);
        const vInvoices = (state.supplierInvoices || []).filter((i) => i.vendorId === statementVendor.id);
        const vTickets = state.tickets.filter((t) => t.vendorId === statementVendor.id);
        const vPos = (state.purchaseOrders || []).filter((po) => po.selectedVendorId === statementVendor.id);

        const totalPaidSar =
          vExpenses.filter((e) => e.approvalStatus !== 'ملغى').reduce((s, e) => s + convertToBase(e.paidAmount ?? (e.paymentStatus === 'مدفوع بالكامل' ? e.amount : 0), e.currency || 'SAR'), 0) +
          vInvoices.filter((i) => i.status !== 'ملغاة').reduce((s, i) => s + convertToBase(i.paidAmount, i.currency || 'SAR'), 0);

        const totalRemSar =
          vExpenses.filter((e) => e.approvalStatus !== 'ملغى').reduce((s, e) => s + convertToBase(e.remainingAmount ?? 0, e.currency || 'SAR'), 0) +
          vInvoices.filter((i) => i.status !== 'ملغاة').reduce((s, i) => s + convertToBase(i.remainingAmount, i.currency || 'SAR'), 0);

        return (
          <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/70 backdrop-blur-sm">
            <div className="w-full max-w-2xl h-full overflow-y-auto bg-white dark:bg-[#0D1322] border-s border-slate-200 dark:border-white/10 p-6 space-y-5">
              <div className="flex items-start justify-between gap-4 border-b border-slate-200 dark:border-white/10 pb-4">
                <div>
                  <div className="text-xs text-slate-500 font-mono-num">
                    سجل {statementVendor.crNumber} {statementVendor.vatNumber ? `· ضريبي ${statementVendor.vatNumber}` : ''}
                  </div>
                  <h3 className="text-lg font-bold mt-0.5">{statementVendor.nameAr}</h3>
                  <div className="text-xs text-slate-500">
                    {statementVendor.category} · {statementVendor.city || 'الرياض'} · {statementVendor.phone}
                  </div>
                </div>
                <button type="button" onClick={() => setStatementVendor(null)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="text-slate-500 dark:text-slate-400">إجمالي المدفوع للمورد</div>
                  <div className="text-base font-bold font-mono-num text-emerald-600 dark:text-emerald-400 mt-1">
                    {formatCurrency(totalPaidSar, baseCurrency, lang)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="text-slate-500 dark:text-slate-400">المتبقي المستحق</div>
                  <div className="text-base font-bold font-mono-num text-amber-600 dark:text-amber-400 mt-1">
                    {formatCurrency(totalRemSar, baseCurrency, lang)}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <div className="text-slate-500 dark:text-slate-400">تذاكر وأوامر شراء</div>
                  <div className="text-base font-bold font-mono-num text-[#26478D] dark:text-blue-300 mt-1">
                    {vTickets.length} تذكرة · {vPos.length} PO
                  </div>
                </div>
              </div>

              {statementVendor.ratingBreakdown && (
                <div className="grid grid-cols-4 gap-2 text-[11px] p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10">
                  <div>الجودة: <strong className="font-mono-num text-amber-500">{statementVendor.ratingBreakdown.quality}/5</strong></div>
                  <div>الالتزام: <strong className="font-mono-num text-amber-500">{statementVendor.ratingBreakdown.punctuality}/5</strong></div>
                  <div>الأسعار: <strong className="font-mono-num text-amber-500">{statementVendor.ratingBreakdown.pricing}/5</strong></div>
                  <div>التعاون: <strong className="font-mono-num text-amber-500">{statementVendor.ratingBreakdown.cooperation}/5</strong></div>
                </div>
              )}

              <div className="space-y-2">
                <h4 className="text-xs font-bold">سجل المصروفات وفواتير المورد ({vExpenses.length + vInvoices.length})</h4>
                <div className="divide-y divide-slate-100 dark:divide-white/5 rounded-xl border border-slate-200 dark:border-white/10 text-xs">
                  {vExpenses.map((e) => (
                    <div key={e.id} className="p-3 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-mono-num font-semibold">{e.expenseNumber} · {e.invoiceNumber}</div>
                        <div className="text-[11px] text-slate-500">{e.category} · {e.date} · {e.approvalStatus}</div>
                      </div>
                      <div className="text-end font-mono-num">
                        <div className="font-bold">{formatInCurrency(e.amount, e.currency || 'SAR')}</div>
                        <div className="text-[10px] text-slate-400">{e.paymentStatus || '—'}</div>
                      </div>
                    </div>
                  ))}
                  {vInvoices.map((inv) => (
                    <div key={inv.id} className="p-3 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-mono-num font-semibold">{inv.invoiceCode} · {inv.supplierInvoiceNumber}</div>
                        <div className="text-[11px] text-slate-500">{inv.invoiceDate} · {inv.status}</div>
                      </div>
                      <div className="text-end font-mono-num">
                        <div className="font-bold">{formatInCurrency(inv.totalAmount, inv.currency)}</div>
                        <div className="text-[10px] text-amber-500">متبقي: {inv.remainingAmount.toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                  {vExpenses.length === 0 && vInvoices.length === 0 && (
                    <div className="p-4 text-center text-slate-400">لا توجد معاملات مسجلة لهذا المورد حتى الآن.</div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-bold">تذاكر الصيانة وأعمال المورد ({vTickets.length})</h4>
                <div className="divide-y divide-slate-100 dark:divide-white/5 rounded-xl border border-slate-200 dark:border-white/10 text-xs">
                  {vTickets.map((t) => (
                    <div key={t.id} className="p-3 flex items-center justify-between gap-2">
                      <div>
                        <div className="font-semibold">{t.ticketNumber} · {t.title}</div>
                        <div className="text-[11px] text-slate-500">{t.category} · {t.status}</div>
                      </div>
                      <div className="font-mono-num font-bold">
                        {formatConvertedBase(t.actualCost || t.estimatedCost, 'SAR')}
                      </div>
                    </div>
                  ))}
                  {vTickets.length === 0 && (
                    <div className="p-4 text-center text-slate-400">لا توجد تذاكر صيانة مسندة لهذا المورد.</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Owner Payout Transfer Modal */}
      {transferOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <form
            onSubmit={handleOwnerTransfer}
            className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#13192B] p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">تحويل مستحقات للمالك: {transferOwner.nameAr}</h3>
              <button type="button" onClick={() => setTransferOwner(null)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 text-xs font-mono-num">
              {transferOwner.bankName} · {transferOwner.iban}
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <input
                type="number"
                required
                min={1}
                value={transferForm.amount}
                onChange={(e) => setTransferForm({ ...transferForm, amount: Number(e.target.value) })}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-transparent font-mono-num"
                placeholder="المبلغ (ريال سعودي)"
              />
              <div className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] flex items-center font-semibold text-emerald-600 dark:text-emerald-400">
                ريال سعودي (SAR)
              </div>
              <select
                value={transferForm.paymentMethod}
                onChange={(e) => setTransferForm({ ...transferForm, paymentMethod: e.target.value as PaymentMethod })}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0A0E1A]"
              >
                <option value="تحويل بنكي">تحويل بنكي</option>
                <option value="شيك">شيك</option>
                <option value="نقدي">نقدي</option>
              </select>
              <input
                placeholder="المرجع البنكي"
                value={transferForm.referenceNumber}
                onChange={(e) => setTransferForm({ ...transferForm, referenceNumber: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-transparent font-mono-num"
              />
              <textarea
                rows={2}
                placeholder="ملاحظات التحويل"
                value={transferForm.notes}
                onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                className="col-span-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-transparent"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setTransferOwner(null)} className="px-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-white/10 cursor-pointer">
                إلغاء
              </button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#26478D] text-white cursor-pointer">
                تنفيذ التحويل وترحيل القيد
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New Purchase Order & Quotes Comparison Modal */}
      {showAddPo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <form
            onSubmit={handleCreatePo}
            className="w-full max-w-lg rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#13192B] p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">طلب شراء ومقارنة عروض الموردين</h3>
              <button type="button" onClick={() => setShowAddPo(false)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <input
                required
                placeholder="عنوان الطلب / بند الصيانة"
                value={poForm.title}
                onChange={(e) => setPoForm({ ...poForm, title: e.target.value })}
                className="col-span-2 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-transparent"
              />
              <select
                value={poForm.propertyId || state.properties[0]?.id}
                onChange={(e) => setPoForm({ ...poForm, propertyId: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0A0E1A]"
              >
                {state.properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nameAr}
                  </option>
                ))}
              </select>
              <div className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] flex items-center font-semibold text-emerald-600 dark:text-emerald-400">
                العملة: ريال سعودي (SAR)
              </div>
              <select
                value={poForm.vendor1Id || state.vendors[0]?.id}
                onChange={(e) => setPoForm({ ...poForm, vendor1Id: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0A0E1A]"
              >
                {state.vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    العرض 1: {v.nameAr}
                  </option>
                ))}
              </select>
              <input
                type="number"
                required
                placeholder="سعر العرض الأول"
                value={poForm.vendor1Amount}
                onChange={(e) => setPoForm({ ...poForm, vendor1Amount: Number(e.target.value) })}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-transparent font-mono-num"
              />
              <select
                value={poForm.vendor2Id}
                onChange={(e) => setPoForm({ ...poForm, vendor2Id: e.target.value })}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0A0E1A]"
              >
                <option value="">العرض 2: (اختياري)</option>
                {state.vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nameAr}
                  </option>
                ))}
              </select>
              <input
                type="number"
                placeholder="سعر العرض الثاني"
                value={poForm.vendor2Amount}
                onChange={(e) => setPoForm({ ...poForm, vendor2Amount: Number(e.target.value) })}
                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-transparent font-mono-num"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowAddPo(false)} className="px-4 py-2 text-xs rounded-lg border border-slate-200 dark:border-white/10 cursor-pointer">
                إلغاء
              </button>
              <button type="submit" className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#26478D] text-white cursor-pointer">
                حفظ ومقارنة العروض
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
