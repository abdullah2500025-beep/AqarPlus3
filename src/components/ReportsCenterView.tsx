import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
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
import {
  AlertCircle,
  BarChart3,
  Building2,
  Coins,
  Download,
  FileSpreadsheet,
  Percent,
  Printer,
  SlidersHorizontal,
  TrendingUp,
  Users,
  Wrench,
} from 'lucide-react';
import { useAqar } from '../context/AqarContext';
import { exportToCsv, formatCurrency, formatDisplayDate } from '../utils/formatters';
import { triggerHaptic } from '../utils/haptics';
import { AdvancedReportBuilder } from './AdvancedReportBuilder';

type ReportCategoryTab = 'real_estate' | 'financial' | 'hr' | 'custom';
type PnlPeriod = 'monthly' | 'quarterly' | 'annual';

const CHART_COLORS = ['#26478D', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#0EA5E9'];

export function ReportsCenterView() {
  const { state, lang, baseCurrency, convertToBase, pushToast } = useAqar();
  const [catTab, setCatTab] = useState<ReportCategoryTab>('real_estate');
  const [pnlPeriod, setPnlPeriod] = useState<PnlPeriod>('monthly');
  const [arrearsView, setArrearsView] = useState<'property' | 'tenant' | 'duration'>('property');
  const [expenseView, setExpenseView] = useState<'category' | 'property' | 'vendor'>('category');

  const isAr = lang === 'ar';

  const realEstateData = useMemo(() => {
    if (!state) {
      return {
        occupancyRows: [],
        vacantRows: [],
        totalExpectedLossAnnual: 0,
        maintenanceByCategory: [],
      };
    }

    const todayMs = Date.now();

    const occupancyRows = state.properties.map((p) => {
      const pUnits = state.units.filter((u) => u.propertyId === p.id);
      const leasedCount = pUnits.filter((u) => u.status === 'مؤجرة' || u.status === 'متأخرة في السداد').length;
      const vacantCount = pUnits.filter((u) => u.status === 'شاغرة').length;
      const occupancyPct = pUnits.length > 0 ? Math.round((leasedCount / pUnits.length) * 100) : 0;

      const revenue = state.payments
        .filter((pay) => pay.propertyId === p.id && pay.status === 'معتمد')
        .reduce((s, pay) => s + convertToBase(pay.amount, pay.currency || 'SAR'), 0);

      const expenses = state.expenses
        .filter((e) => e.propertyId === p.id && e.approvalStatus === 'معتمد')
        .reduce((s, e) => s + convertToBase(e.amount, e.currency || 'SAR'), 0);

      return {
        id: p.id,
        name: p.nameAr,
        totalUnits: pUnits.length,
        leasedCount,
        vacantCount,
        occupancyPct,
        revenue: Math.round(revenue * 100) / 100,
        expenses: Math.round(expenses * 100) / 100,
        netYield: Math.round((revenue - expenses) * 100) / 100,
      };
    });

    const vacantRows = state.units
      .filter((u) => u.status === 'شاغرة')
      .map((u) => {
        const prop = state.properties.find((p) => p.id === u.propertyId);
        // Find most recent contract end date on this unit to compute vacancy duration
        const pastContracts = state.contracts
          .filter((c) => c.unitId === u.id)
          .sort((a, b) => b.endDate.localeCompare(a.endDate));
        const refDate = pastContracts[0]?.endDate || prop?.createdAt?.slice(0, 10) || '2026-09-01';
        const diffDays = Math.max(7, Math.floor((todayMs - new Date(`${refDate}T00:00:00Z`).getTime()) / 86400000));
        const vacancyDays = Math.min(365, diffDays);
        const expectedLoss = Math.round(((u.suggestedAnnualRent / 365) * vacancyDays) * 100) / 100;
        return {
          id: u.id,
          unitNumber: u.unitNumber,
          unitType: u.unitType,
          propertyName: prop?.nameAr || '—',
          vacancyDays,
          annualRent: u.suggestedAnnualRent,
          expectedLoss,
        };
      });

    const totalExpectedLossAnnual = vacantRows.reduce((s, v) => s + v.annualRent, 0);

    const maintMap = new Map<string, { category: string; count: number; totalCost: number }>();
    for (const tkt of state.tickets) {
      const key = tkt.category || 'أخرى';
      const cur = maintMap.get(key) || { category: key, count: 0, totalCost: 0 };
      cur.count += 1;
      cur.totalCost += Number(tkt.actualCost || tkt.estimatedCost || 0);
      maintMap.set(key, cur);
    }
    const maintenanceByCategory = Array.from(maintMap.values()).sort((a, b) => b.count - a.count);

    return {
      occupancyRows,
      vacantRows,
      totalExpectedLossAnnual,
      maintenanceByCategory,
    };
  }, [state, convertToBase]);

  const financialData = useMemo(() => {
    if (!state) {
      return {
        pnlRows: [],
        totalInflow: 0,
        totalOutflow: 0,
        netCashFlow: 0,
        vatCollected: 0,
        vatPaid: 0,
        netVat: 0,
        arrearsByProperty: [],
        arrearsByTenant: [],
        arrearsByDuration: [],
        expensesByCategory: [],
        expensesByProperty: [],
        expensesByVendor: [],
      };
    }

    const totalInflow = state.payments
      .filter((p) => p.status === 'معتمد')
      .reduce((s, p) => s + convertToBase(p.amount, p.currency || 'SAR'), 0);

    const totalOutflow = state.expenses
      .filter((e) => e.approvalStatus === 'معتمد')
      .reduce((s, e) => s + convertToBase(e.amount, e.currency || 'SAR'), 0);

    const netCashFlow = Math.round((totalInflow - totalOutflow) * 100) / 100;

    // Group P&L by period
    const periodMap = new Map<string, { label: string; income: number; expense: number; net: number }>();
    const toBucket = (dateStr: string) => {
      const d = (dateStr || '2026-11-01').slice(0, 10);
      const [yr, mo] = d.split('-');
      if (pnlPeriod === 'annual') return yr;
      if (pnlPeriod === 'quarterly') {
        const q = Math.floor((Number(mo || 1) - 1) / 3) + 1;
        return `${yr}-Q${q}`;
      }
      return `${yr}-${mo}`;
    };

    for (const p of state.payments.filter((x) => x.status === 'معتمد')) {
      const key = toBucket(p.createdAt);
      const cur = periodMap.get(key) || { label: key, income: 0, expense: 0, net: 0 };
      cur.income += convertToBase(p.amount, p.currency || 'SAR');
      cur.net = cur.income - cur.expense;
      periodMap.set(key, cur);
    }
    for (const e of state.expenses.filter((x) => x.approvalStatus === 'معتمد')) {
      const key = toBucket(e.date);
      const cur = periodMap.get(key) || { label: key, income: 0, expense: 0, net: 0 };
      cur.expense += convertToBase(e.amount, e.currency || 'SAR');
      cur.net = cur.income - cur.expense;
      periodMap.set(key, cur);
    }
    const pnlRows = Array.from(periodMap.values())
      .map((r) => ({
        ...r,
        income: Math.round(r.income * 100) / 100,
        expense: Math.round(r.expense * 100) / 100,
        net: Math.round(r.net * 100) / 100,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    // VAT Calculations
    const zatcaVat = (state.zatcaInvoices || []).reduce((s, inv) => s + Number(inv.vatAmount || 0), 0);
    const commercialRentVat = state.contracts
      .filter((c) => {
        const u = state.units.find((x) => x.id === c.unitId);
        return u && ['مكتب', 'محل', 'معرض', 'مستودع'].includes(u.unitType);
      })
      .reduce((s, c) => s + convertToBase((c.annualRent || 0) * 0.15, c.currency || 'SAR'), 0);
    const vatCollected = Math.round(Math.max(zatcaVat, commercialRentVat) * 100) / 100;
    const vatPaid = Math.round(
      state.expenses
        .filter((e) => e.approvalStatus === 'معتمد')
        .reduce((s, e) => s + convertToBase(e.vatAmount || e.amount * 0.1304, e.currency || 'SAR'), 0) * 100
    ) / 100;
    const netVat = Math.round((vatCollected - vatPaid) * 100) / 100;

    // Arrears breakdowns
    const openInstallments = state.installments.filter(
      (i) => i.status !== 'ملغاة' && i.remainingAmount > 0 && (i.status === 'متأخرة' || i.status === 'مستحقة اليوم' || i.status === 'مدفوعة جزئياً')
    );

    const arrPropMap = new Map<string, { label: string; count: number; amount: number }>();
    const arrTenMap = new Map<string, { label: string; count: number; amount: number }>();
    const arrDurMap = new Map<string, { label: string; count: number; amount: number }>([
      ['0 - 30 يوم', { label: '0 - 30 يوم', count: 0, amount: 0 }],
      ['31 - 60 يوم', { label: '31 - 60 يوم', count: 0, amount: 0 }],
      ['أكثر من 60 يوم', { label: 'أكثر من 60 يوم', count: 0, amount: 0 }],
    ]);

    const refNowMs = new Date('2026-11-15T00:00:00Z').getTime();
    for (const inst of openInstallments) {
      const amt = convertToBase(inst.remainingAmount, inst.currency || 'SAR');
      const pName = state.properties.find((p) => p.id === inst.propertyId)?.nameAr || 'عقار';
      const tName = state.tenants.find((t) => t.id === inst.tenantId)?.nameAr || 'مستأجر';
      const pCur = arrPropMap.get(pName) || { label: pName, count: 0, amount: 0 };
      pCur.count += 1;
      pCur.amount += amt;
      arrPropMap.set(pName, pCur);

      const tCur = arrTenMap.get(tName) || { label: tName, count: 0, amount: 0 };
      tCur.count += 1;
      tCur.amount += amt;
      arrTenMap.set(tName, tCur);

      const delayDays = Math.max(0, Math.ceil((refNowMs - new Date(`${inst.dueDate}T00:00:00Z`).getTime()) / 86400000));
      const bucketKey = delayDays <= 30 ? '0 - 30 يوم' : delayDays <= 60 ? '31 - 60 يوم' : 'أكثر من 60 يوم';
      const bCur = arrDurMap.get(bucketKey)!;
      bCur.count += 1;
      bCur.amount += amt;
    }

    // Expenses breakdowns
    const expCatMap = new Map<string, { label: string; count: number; amount: number }>();
    const expPropMap = new Map<string, { label: string; count: number; amount: number }>();
    const expVendMap = new Map<string, { label: string; count: number; amount: number }>();

    for (const exp of state.expenses.filter((x) => x.approvalStatus === 'معتمد')) {
      const amt = convertToBase(exp.amount, exp.currency || 'SAR');
      const cKey = exp.category || 'أخرى';
      const cCur = expCatMap.get(cKey) || { label: cKey, count: 0, amount: 0 };
      cCur.count += 1;
      cCur.amount += amt;
      expCatMap.set(cKey, cCur);

      const pKey = state.properties.find((p) => p.id === exp.propertyId)?.nameAr || 'مصاريف عامة';
      const pCur = expPropMap.get(pKey) || { label: pKey, count: 0, amount: 0 };
      pCur.count += 1;
      pCur.amount += amt;
      expPropMap.set(pKey, pCur);

      const vKey = state.vendors.find((v) => v.id === exp.vendorId)?.nameAr || 'صرف مباشر';
      const vCur = expVendMap.get(vKey) || { label: vKey, count: 0, amount: 0 };
      vCur.count += 1;
      vCur.amount += amt;
      expVendMap.set(vKey, vCur);
    }

    return {
      pnlRows,
      totalInflow: Math.round(totalInflow * 100) / 100,
      totalOutflow: Math.round(totalOutflow * 100) / 100,
      netCashFlow,
      vatCollected,
      vatPaid,
      netVat,
      arrearsByProperty: Array.from(arrPropMap.values()).sort((a, b) => b.amount - a.amount),
      arrearsByTenant: Array.from(arrTenMap.values()).sort((a, b) => b.amount - a.amount),
      arrearsByDuration: Array.from(arrDurMap.values()),
      expensesByCategory: Array.from(expCatMap.values()).sort((a, b) => b.amount - a.amount),
      expensesByProperty: Array.from(expPropMap.values()).sort((a, b) => b.amount - a.amount),
      expensesByVendor: Array.from(expVendMap.values()).sort((a, b) => b.amount - a.amount),
    };
  }, [state, convertToBase, pnlPeriod]);

  const hrData = useMemo(() => {
    if (!state) return { staffRows: [], totalCommissions: 0 };
    const todayStr = '2026-11-15';
    const totalRentCollected = state.payments
      .filter((p) => p.status === 'معتمد' && p.paymentType === 'إيجار')
      .reduce((s, p) => s + convertToBase(p.amount, p.currency || 'SAR'), 0);

    const staffRows = state.users
      .filter((u) => u.role !== 'owner')
      .map((u) => {
        const myTasks = state.tasks.filter((t) => t.assignedTo === u.id && !t.archivedAt);
        const completed = myTasks.filter((t) => t.status === 'مكتملة').length;
        const overdue = myTasks.filter((t) => t.status !== 'مكتملة' && t.dueDate < todayStr).length;
        const completionPct = myTasks.length > 0 ? Math.round((completed / myTasks.length) * 100) : 100;

        // Calculate attributed leasing/management commission
        const contractsCreated = state.contracts.filter((c) => c.createdBy === u.id || u.role === 'leasing').length;
        const baseComm =
          u.role === 'leasing'
            ? totalRentCollected * 0.015
            : u.role === 'gm' || u.role === 'sys_owner'
            ? totalRentCollected * 0.02
            : completed * 150;

        return {
          id: u.id,
          name: u.nameAr,
          role: u.roleLabelAr,
          totalTasks: myTasks.length,
          completed,
          overdue,
          completionPct,
          rating: u.managerRating || 5,
          contractsCount: contractsCreated,
          commissionAmount: Math.round(baseComm * 100) / 100,
        };
      });

    const totalCommissions = staffRows.reduce((s, r) => s + r.commissionAmount, 0);
    return { staffRows, totalCommissions };
  }, [state, convertToBase]);

  if (!state) return null;

  const exportBrandedReportPdf = (title: string, headers: string[], rows: (string | number)[][]) => {
    triggerHaptic('light');
    const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const logoSrc = state.settings.logoDataUrl || './assets/aistudio/Aqar_plus_8de53ba4.svg';
    const ths = headers.map((h) => `<th>${esc(h)}</th>`).join('');
    const trs = rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('');

    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" /><title>${esc(title)}</title><style>
      @page{size:A4 landscape;margin:12mm;}
      body{font-family:'IBM Plex Sans Arabic',system-ui,sans-serif;color:#0f172a;margin:0;}
      .hdr{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #26478D;padding-bottom:10px;margin-bottom:14px;}
      .brand{display:flex;align-items:center;gap:12px;}
      .brand img{width:46px;height:46px;object-fit:contain;border-radius:8px;border:1px solid #cbd5e1;padding:3px;}
      table{width:100%;border-collapse:collapse;font-size:11px;}
      th{background:#26478D;color:#fff;padding:8px;text-align:start;}
      td{border-bottom:1px solid #e2e8f0;padding:7px 8px;}
      tr:nth-child(even) td{background:#f8fafc;}
    </style></head><body>
      <div class="hdr">
        <div class="brand">
          <img src="${esc(logoSrc)}" alt="Logo" />
          <div>
            <div style="font-size:16px;font-weight:700;color:#26478D;">${esc(state.settings.nameAr)}</div>
            <div style="font-size:13px;font-weight:600;">${esc(title)}</div>
          </div>
        </div>
        <div style="font-size:11px;color:#475569;text-align:end;">
          <div>الرقم الضريبي: ${esc(state.settings.vatNumber)}</div>
          <div>تاريخ التصدير: ${formatDisplayDate(new Date().toISOString().slice(0, 10), lang)}</div>
        </div>
      </div>
      <table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>
    </body></html>`;

    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        setTimeout(() => {
          if (iframe.parentNode) document.body.removeChild(iframe);
        }, 1200);
      }, 250);
    }
    pushToast('success', `تم تجهيز تقرير «${title}» بصيغة PDF بشعار الشركة`);
  };

  const exportSheetExcel = (fileName: string, sheetName: string, headers: string[], rows: (string | number)[][]) => {
    triggerHaptic('light');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      [state.settings.nameAr, sheetName],
      ['تاريخ الإصدار', new Date().toISOString().slice(0, 10)],
      [],
      headers,
      ...rows,
    ]);
    ws['!cols'] = headers.map(() => ({ wch: 22 }));
    ws['!views'] = [{ rightToLeft: isAr }];
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 28));
    XLSX.writeFile(wb, fileName);
    pushToast('success', `تم تصدير ${sheetName} بصيغة Excel`);
  };

  const activeArrearsList =
    arrearsView === 'property'
      ? financialData.arrearsByProperty
      : arrearsView === 'tenant'
      ? financialData.arrearsByTenant
      : financialData.arrearsByDuration;

  const activeExpensesList =
    expenseView === 'category'
      ? financialData.expensesByCategory
      : expenseView === 'property'
      ? financialData.expensesByProperty
      : financialData.expensesByVendor;

  return (
    <div className="space-y-6">
      {/* Category Navigation Bar */}
      <div className="p-2 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface flex flex-wrap items-center justify-between gap-3 no-print">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'real_estate', labelAr: 'أ. التقارير العقارية', icon: Building2 },
              { id: 'financial', labelAr: 'ب. التقارير المالية والضرائب', icon: TrendingUp },
              { id: 'hr', labelAr: 'ج. تقارير الموارد البشرية والعمولات', icon: Users },
              { id: 'custom', labelAr: 'د. مُنشئ التقارير المخصصة والجدولة', icon: SlidersHorizontal },
            ] as { id: ReportCategoryTab; labelAr: string; icon: React.ComponentType<{ className?: string }> }[]
          ).map((t) => {
            const Icon = t.icon;
            const active = catTab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  triggerHaptic('light');
                  setCatTab(t.id);
                }}
                className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer transition-colors ${
                  active
                    ? 'bg-[#26478D] text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.06]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.labelAr}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          className="min-h-[36px] px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
        >
          <Printer className="w-3.5 h-3.5" />
          <span>طباعة مباشرة</span>
        </button>
      </div>

      {/* SECTION A: REAL ESTATE REPORTS */}
      {catTab === 'real_estate' && (
        <div className="space-y-6">
          {/* Occupancy + Performance Chart & Export */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-[#26478D] dark:text-blue-400" />
                  <span>تقرير الإشغال وأداء العقارات (الإيرادات مقابل المصروفات)</span>
                </h3>
                <p className="text-[11px] text-slate-500">نسبة الإشغال الفعلي ومقارنة العوائد لكل عقار مع رسم بياني</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 no-print">
                <button
                  type="button"
                  onClick={() =>
                    exportToCsv(
                      'aqarplus-property-performance.csv',
                      ['العقار', 'إجمالي الوحدات', 'المؤجرة', 'الشاغرة', 'نسبة الإشغال %', 'الإيرادات', 'المصروفات', 'الصافي'],
                      realEstateData.occupancyRows.map((r) => [
                        r.name,
                        r.totalUnits,
                        r.leasedCount,
                        r.vacantCount,
                        `${r.occupancyPct}%`,
                        r.revenue,
                        r.expenses,
                        r.netYield,
                      ])
                    )
                  }
                  className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportSheetExcel(
                      'AqarPlus-RealEstate-Performance.xlsx',
                      'أداء العقارات',
                      ['العقار', 'إجمالي الوحدات', 'المؤجرة', 'الشاغرة', 'نسبة الإشغال %', 'الإيرادات', 'المصروفات', 'الصافي'],
                      realEstateData.occupancyRows.map((r) => [
                        r.name,
                        r.totalUnits,
                        r.leasedCount,
                        r.vacantCount,
                        r.occupancyPct,
                        r.revenue,
                        r.expenses,
                        r.netYield,
                      ])
                    )
                  }
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportBrandedReportPdf(
                      'تقرير الإشغال وأداء العقارات',
                      ['العقار', 'الوحدات', 'نسبة الإشغال', 'الإيرادات', 'المصروفات', 'الصافي'],
                      realEstateData.occupancyRows.map((r) => [
                        r.name,
                        `${r.leasedCount}/${r.totalUnits}`,
                        `${r.occupancyPct}%`,
                        formatCurrency(r.revenue, baseCurrency, lang),
                        formatCurrency(r.expenses, baseCurrency, lang),
                        formatCurrency(r.netYield, baseCurrency, lang),
                      ])
                    )
                  }
                  className="px-3 py-1.5 rounded-xl bg-[#26478D] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>
              </div>
            </div>

            <div className="h-64 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={realEstateData.occupancyRows}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="revenue" name="الإيرادات" fill="#10B981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expenses" name="المصروفات" fill="#EF4444" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
              <table className="w-full text-start text-xs">
                <thead className="bg-slate-50 dark:bg-white/[0.03] text-slate-500 border-b border-slate-200 dark:border-white/10">
                  <tr>
                    <th className="py-2.5 px-4 text-start">العقار</th>
                    <th className="py-2.5 px-4 text-start">نسبة الإشغال</th>
                    <th className="py-2.5 px-4 text-start">الإيرادات المحصلة</th>
                    <th className="py-2.5 px-4 text-start">المصروفات المعتمدة</th>
                    <th className="py-2.5 px-4 text-start">صافي الأداء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {realEstateData.occupancyRows.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2.5 px-4 font-bold">{r.name}</td>
                      <td className="py-2.5 px-4 font-mono-num">
                        {r.leasedCount}/{r.totalUnits} ({r.occupancyPct}%)
                      </td>
                      <td className="py-2.5 px-4 font-mono-num text-emerald-600 dark:text-emerald-400 font-semibold">
                        {formatCurrency(r.revenue, baseCurrency, lang)}
                      </td>
                      <td className="py-2.5 px-4 font-mono-num text-rose-500">
                        {formatCurrency(r.expenses, baseCurrency, lang)}
                      </td>
                      <td className="py-2.5 px-4 font-mono-num font-bold text-[#26478D] dark:text-blue-400">
                        {formatCurrency(r.netYield, baseCurrency, lang)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Vacant Units Loss + Maintenance Frequent Faults */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 p-5 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold">تقرير الوحدات الشاغرة والخسائر المتوقعة</h3>
                  <p className="text-[11px] text-slate-500">
                    إجمالي الشواغر: {realEstateData.vacantRows.length} وحدة · الإيجار السنوي المفقود:{' '}
                    <span className="font-mono-num font-bold text-amber-600">
                      {formatCurrency(realEstateData.totalExpectedLossAnnual, baseCurrency, lang)}
                    </span>
                  </p>
                </div>
              </div>
              {realEstateData.vacantRows.length === 0 ? (
                <div className="p-6 text-center text-xs text-emerald-600">كافة الوحدات مؤجرة حالياً (100% إشغال)</div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
                  <table className="w-full text-start text-xs">
                    <thead className="bg-slate-50 dark:bg-white/[0.03] text-slate-500 border-b border-slate-200 dark:border-white/10">
                      <tr>
                        <th className="py-2.5 px-3 text-start">الوحدة</th>
                        <th className="py-2.5 px-3 text-start">العقار</th>
                        <th className="py-2.5 px-3 text-start">مدة الشغور</th>
                        <th className="py-2.5 px-3 text-start">الخسارة المتوقعة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                      {realEstateData.vacantRows.map((v) => (
                        <tr key={v.id}>
                          <td className="py-2.5 px-3 font-bold">
                            {v.unitType} {v.unitNumber}
                          </td>
                          <td className="py-2.5 px-3">{v.propertyName}</td>
                          <td className="py-2.5 px-3 font-mono-num">{v.vacancyDays} يوم</td>
                          <td className="py-2.5 px-3 font-mono-num text-amber-600 dark:text-amber-400 font-semibold">
                            {formatCurrency(v.expectedLoss, baseCurrency, lang)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="lg:col-span-5 p-5 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface space-y-4">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Wrench className="w-4 h-4 text-[#26478D] dark:text-blue-400" />
                <span>تقرير الصيانة (الأعطال الأكثر تكراراً وتكاليفها)</span>
              </h3>
              <div className="space-y-2.5 text-xs">
                {realEstateData.maintenanceByCategory.map((m) => (
                  <div
                    key={m.category}
                    className="p-3 rounded-xl border border-slate-200 dark:border-white/10 flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold">{m.category}</div>
                      <div className="text-[11px] text-slate-500 font-mono-num">{m.count} بلاغات مسجلة</div>
                    </div>
                    <div className="font-mono-num font-bold text-rose-500">
                      {formatCurrency(m.totalCost, baseCurrency, lang)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION B: FINANCIAL REPORTS */}
      {catTab === 'financial' && (
        <div className="space-y-6">
          {/* Cash Flow + Tax KPI Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface">
              <div className="text-[11px] text-slate-500">التدفق النقدي الداخل (التحصيل)</div>
              <div className="text-xl font-bold font-mono-num text-emerald-600 dark:text-emerald-400 mt-1">
                {formatCurrency(financialData.totalInflow, baseCurrency, lang)}
              </div>
            </div>
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface">
              <div className="text-[11px] text-slate-500">التدفق النقدي الخارج (المصروفات)</div>
              <div className="text-xl font-bold font-mono-num text-rose-500 mt-1">
                {formatCurrency(financialData.totalOutflow, baseCurrency, lang)}
              </div>
            </div>
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface">
              <div className="text-[11px] text-slate-500">صافي التدفق النقدي</div>
              <div className="text-xl font-bold font-mono-num text-[#26478D] dark:text-blue-400 mt-1">
                {formatCurrency(financialData.netCashFlow, baseCurrency, lang)}
              </div>
            </div>
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface">
              <div className="text-[11px] text-slate-500 flex items-center gap-1">
                <Percent className="w-3 h-3" />
                <span>صافي ضريبة القيمة المضافة (VAT)</span>
              </div>
              <div className="text-xl font-bold font-mono-num mt-1">
                {formatCurrency(financialData.netVat, baseCurrency, lang)}
              </div>
              <div className="text-[10px] text-slate-500 font-mono-num mt-0.5">
                محصّلة: {formatCurrency(financialData.vatCollected, baseCurrency, lang)} · مدفوعة:{' '}
                {formatCurrency(financialData.vatPaid, baseCurrency, lang)}
              </div>
            </div>
          </div>

          {/* P&L Report (Monthly / Quarterly / Annual) */}
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold">تقرير الأرباح والخسائر (P&amp;L) والتدفقات النقدية</h3>
                <p className="text-[11px] text-slate-500">مقارنة الإيرادات والمصروفات وصافي الربح حسب الفترة الزمنية</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 no-print">
                <div className="inline-flex rounded-xl bg-slate-200/70 dark:bg-white/[0.06] p-1 text-xs">
                  {(
                    [
                      { id: 'monthly', label: 'شهري' },
                      { id: 'quarterly', label: 'ربع سنوي' },
                      { id: 'annual', label: 'سنوي' },
                    ] as { id: PnlPeriod; label: string }[]
                  ).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPnlPeriod(p.id)}
                      className={`px-3 py-1 rounded-lg font-semibold cursor-pointer ${
                        pnlPeriod === p.id ? 'bg-white dark:bg-[#26478D] shadow-sm' : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    exportSheetExcel(
                      `AqarPlus-PnL-${pnlPeriod}.xlsx`,
                      'الأرباح والخسائر',
                      ['الفترة', 'الإيرادات', 'المصروفات', 'صافي الربح'],
                      financialData.pnlRows.map((r) => [r.label, r.income, r.expense, r.net])
                    )
                  }
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportBrandedReportPdf(
                      `تقرير الأرباح والخسائر (${pnlPeriod === 'monthly' ? 'شهري' : pnlPeriod === 'quarterly' ? 'ربع سنوي' : 'سنوي'})`,
                      ['الفترة', 'الإيرادات', 'المصروفات', 'صافي الربح / الخسارة'],
                      financialData.pnlRows.map((r) => [
                        r.label,
                        formatCurrency(r.income, baseCurrency, lang),
                        formatCurrency(r.expense, baseCurrency, lang),
                        formatCurrency(r.net, baseCurrency, lang),
                      ])
                    )
                  }
                  className="px-3 py-1.5 rounded-xl bg-[#26478D] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>
              </div>
            </div>

            <div className="h-60 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financialData.pnlRows}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="income" name="الإيرادات" fill="#10B981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expense" name="المصروفات" fill="#EF4444" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="net" name="الصافي" fill="#26478D" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Arrears Report + Expenses Report */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  <span>تقرير المتأخرات المفصل</span>
                </h3>
                <div className="inline-flex rounded-xl bg-slate-200/70 dark:bg-white/[0.06] p-1 text-[11px]">
                  {(
                    [
                      { id: 'property', label: 'حسب العقار' },
                      { id: 'tenant', label: 'حسب المستأجر' },
                      { id: 'duration', label: 'حسب المدة' },
                    ] as { id: 'property' | 'tenant' | 'duration'; label: string }[]
                  ).map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setArrearsView(v.id)}
                      className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                        arrearsView === v.id ? 'bg-white dark:bg-[#26478D] shadow-sm' : ''
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                {activeArrearsList.map((row) => (
                  <div key={row.label} className="py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold">{row.label}</div>
                      <div className="text-[11px] text-slate-500 font-mono-num">{row.count} دفعة مفتوحة</div>
                    </div>
                    <div className="font-mono-num font-bold text-amber-600 dark:text-amber-400">
                      {formatCurrency(row.amount, baseCurrency, lang)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold">تقرير المصروفات التحليلي</h3>
                <div className="inline-flex rounded-xl bg-slate-200/70 dark:bg-white/[0.06] p-1 text-[11px]">
                  {(
                    [
                      { id: 'category', label: 'حسب النوع' },
                      { id: 'property', label: 'حسب العقار' },
                      { id: 'vendor', label: 'حسب المورد' },
                    ] as { id: 'category' | 'property' | 'vendor'; label: string }[]
                  ).map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setExpenseView(v.id)}
                      className={`px-2.5 py-1 rounded-lg font-semibold cursor-pointer ${
                        expenseView === v.id ? 'bg-white dark:bg-[#26478D] shadow-sm' : ''
                      }`}
                    >
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                {activeExpensesList.map((row) => (
                  <div key={row.label} className="py-2.5 flex items-center justify-between gap-3">
                    <div>
                      <div className="font-bold">{row.label}</div>
                      <div className="text-[11px] text-slate-500 font-mono-num">{row.count} فاتورة / سند</div>
                    </div>
                    <div className="font-mono-num font-bold text-rose-500">
                      {formatCurrency(row.amount, baseCurrency, lang)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION C: HR & COMMISSIONS REPORTS */}
      {catTab === 'hr' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl border border-slate-200 dark:border-white/10 glass-surface space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Coins className="w-4 h-4 text-amber-500" />
                  <span>تقرير أداء الموظفين والعمولات المستحقة</span>
                </h3>
                <p className="text-[11px] text-slate-500">
                  المهام المنجزة والمتأخرة ونسبة الإنجاز والعمولات المحتسبة · الإجمالي:{' '}
                  <span className="font-mono-num font-bold text-emerald-600">
                    {formatCurrency(hrData.totalCommissions, baseCurrency, lang)}
                  </span>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 no-print">
                <button
                  type="button"
                  onClick={() =>
                    exportSheetExcel(
                      'AqarPlus-HR-Commissions.xlsx',
                      'أداء الموظفين والعمولات',
                      ['الموظف', 'الدور', 'المهام المنجزة', 'المتأخرة', 'نسبة الإنجاز %', 'التقييم', 'العمولة المستحقة'],
                      hrData.staffRows.map((r) => [
                        r.name,
                        r.role,
                        r.completed,
                        r.overdue,
                        r.completionPct,
                        r.rating,
                        r.commissionAmount,
                      ])
                    )
                  }
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    exportBrandedReportPdf(
                      'تقرير أداء الموظفين والعمولات',
                      ['الموظف', 'الدور', 'المهام المنجزة', 'المتأخرة', 'نسبة الإنجاز', 'العمولة'],
                      hrData.staffRows.map((r) => [
                        r.name,
                        r.role,
                        r.completed,
                        r.overdue,
                        `${r.completionPct}%`,
                        formatCurrency(r.commissionAmount, baseCurrency, lang),
                      ])
                    )
                  }
                  className="px-3 py-1.5 rounded-xl bg-[#26478D] text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>PDF</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
              <div className="lg:col-span-8 overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10">
                <table className="w-full text-start text-xs">
                  <thead className="bg-slate-50 dark:bg-white/[0.03] text-slate-500 border-b border-slate-200 dark:border-white/10">
                    <tr>
                      <th className="py-2.5 px-4 text-start">الموظف</th>
                      <th className="py-2.5 px-3 text-start">المنجزة</th>
                      <th className="py-2.5 px-3 text-start">المتأخرة</th>
                      <th className="py-2.5 px-3 text-start">الإنجاز</th>
                      <th className="py-2.5 px-3 text-start">العمولة المحتسبة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {hrData.staffRows.map((r) => (
                      <tr key={r.id}>
                        <td className="py-2.5 px-4">
                          <div className="font-bold">{r.name}</div>
                          <div className="text-[11px] text-slate-500">{r.role}</div>
                        </td>
                        <td className="py-2.5 px-3 font-mono-num text-emerald-600 font-bold">{r.completed}</td>
                        <td className="py-2.5 px-3 font-mono-num text-rose-500">{r.overdue}</td>
                        <td className="py-2.5 px-3 font-mono-num font-bold">{r.completionPct}%</td>
                        <td className="py-2.5 px-3 font-mono-num font-bold text-[#26478D] dark:text-blue-400">
                          {formatCurrency(r.commissionAmount, baseCurrency, lang)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="lg:col-span-4 h-56" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={hrData.staffRows.filter((r) => r.commissionAmount > 0)}
                      dataKey="commissionAmount"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={42}
                      outerRadius={76}
                    >
                      {hrData.staffRows.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION D: CUSTOM REPORT BUILDER + FAVORITES + SCHEDULER */}
      {catTab === 'custom' && <AdvancedReportBuilder />}
    </div>
  );
}
