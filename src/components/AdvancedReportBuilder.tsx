import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  ArrowDown,
  ArrowUp,
  CalendarClock,
  Download,
  FileSpreadsheet,
  Play,
  Plus,
  Printer,
  SlidersHorizontal,
  Trash2,
} from 'lucide-react';
import { useAqar } from '../context/AqarContext';
import { ScheduledReportConfig } from '../types/aqar';
import { exportToCsv, formatCurrency, formatDateTime } from '../utils/formatters';
import { AQAR_THEME } from '../theme/designTokens';
import { UnifiedButton, UnifiedCard, UnifiedEmptyState, UnifiedSectionHeader } from './ui/UnifiedComponents';
import { triggerHaptic } from '../utils/haptics';

type DatasetKey = ScheduledReportConfig['dataset'];

interface FieldDef {
  key: string;
  labelAr: string;
  numeric?: boolean;
}

const DATASET_META: Record<
  DatasetKey,
  {
    labelAr: string;
    fields: FieldDef[];
    statuses: string[];
  }
> = {
  payments: {
    labelAr: 'سندات القبض والتحصيل',
    fields: [
      { key: 'receiptNumber', labelAr: 'رقم السند' },
      { key: 'tenantName', labelAr: 'المستأجر' },
      { key: 'propertyName', labelAr: 'العقار' },
      { key: 'unitNumber', labelAr: 'الوحدة' },
      { key: 'paymentType', labelAr: 'نوع الدفعة' },
      { key: 'paymentMethod', labelAr: 'طريقة الدفع' },
      { key: 'amount', labelAr: 'المبلغ (ر.س)', numeric: true },
      { key: 'status', labelAr: 'الحالة' },
      { key: 'date', labelAr: 'التاريخ' },
    ],
    statuses: ['معتمد', 'معكوس'],
  },
  installments: {
    labelAr: 'الأقساط والاستحقاقات',
    fields: [
      { key: 'contractNumber', labelAr: 'رقم العقد' },
      { key: 'tenantName', labelAr: 'المستأجر' },
      { key: 'propertyName', labelAr: 'العقار' },
      { key: 'unitNumber', labelAr: 'الوحدة' },
      { key: 'dueDate', labelAr: 'تاريخ الاستحقاق' },
      { key: 'amount', labelAr: 'قيمة القسط (ر.س)', numeric: true },
      { key: 'paidAmount', labelAr: 'المدفوع (ر.س)', numeric: true },
      { key: 'remainingAmount', labelAr: 'المتبقي (ر.س)', numeric: true },
      { key: 'status', labelAr: 'الحالة' },
    ],
    statuses: ['متأخرة', 'مستحقة اليوم', 'مدفوعة جزئياً', 'مدفوعة بالكامل', 'لم تستحق'],
  },
  expenses: {
    labelAr: 'المصروفات والفواتير',
    fields: [
      { key: 'expenseNumber', labelAr: 'رقم المصروف' },
      { key: 'date', labelAr: 'التاريخ' },
      { key: 'propertyName', labelAr: 'العقار' },
      { key: 'category', labelAr: 'التصنيف' },
      { key: 'bearer', labelAr: 'المتحمل' },
      { key: 'amount', labelAr: 'الإجمالي (ر.س)', numeric: true },
      { key: 'status', labelAr: 'حالة الاعتماد' },
    ],
    statuses: ['معتمد', 'بانتظار المشرف', 'بانتظار المدير', 'مرفوض'],
  },
  units: {
    labelAr: 'الوحدات والإشغال',
    fields: [
      { key: 'propertyName', labelAr: 'العقار' },
      { key: 'unitNumber', labelAr: 'رقم الوحدة' },
      { key: 'unitType', labelAr: 'النوع' },
      { key: 'areaSqm', labelAr: 'المساحة (م²)', numeric: true },
      { key: 'suggestedAnnualRent', labelAr: 'الإيجار السنوي (ر.س)', numeric: true },
      { key: 'status', labelAr: 'الحالة' },
    ],
    statuses: ['مؤجرة', 'شاغرة', 'متأخرة في السداد', 'تحت الصيانة'],
  },
  maintenance: {
    labelAr: 'بلاغات الصيانة والمهام',
    fields: [
      { key: 'ticketNumber', labelAr: 'رقم البلاغ' },
      { key: 'propertyName', labelAr: 'العقار' },
      { key: 'unitNumber', labelAr: 'الوحدة' },
      { key: 'title', labelAr: 'العنوان' },
      { key: 'category', labelAr: 'التخصص' },
      { key: 'priority', labelAr: 'الأولوية' },
      { key: 'actualCost', labelAr: 'التكلفة الفعلية (ر.س)', numeric: true },
      { key: 'status', labelAr: 'الحالة' },
    ],
    statuses: ['جديد', 'تم الإسناد', 'قيد التنفيذ', 'مكتمل', 'مغلق'],
  },
};

export function AdvancedReportBuilder() {
  const { state, lang, mutate, pushToast, baseCurrency, convertToBase } = useAqar();

  const [reportTitle, setReportTitle] = useState('تقرير الأداء المالي المخصص');
  const [dataset, setDataset] = useState<DatasetKey>('payments');
  const [selectedFields, setSelectedFields] = useState<string[]>([
    'receiptNumber',
    'tenantName',
    'propertyName',
    'unitNumber',
    'paymentMethod',
    'amount',
    'status',
    'date',
  ]);
  const [propertyFilter, setPropertyFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [groupBy, setGroupBy] = useState<'none' | 'property' | 'status' | 'month'>('none');
  const [sortField, setSortField] = useState<string>('amount');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Schedule modal / inline creation state
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [schedForm, setSchedForm] = useState({
    frequency: 'أسبوعي' as ScheduledReportConfig['frequency'],
    deliveryChannel: 'بريد إلكتروني' as ScheduledReportConfig['deliveryChannel'],
    recipient: '',
  });
  const [savingSched, setSavingSched] = useState(false);

  const meta = DATASET_META[dataset];

  const handleDatasetChange = (next: DatasetKey) => {
    setDataset(next);
    const fields = DATASET_META[next].fields.map((f) => f.key);
    setSelectedFields(fields);
    setStatusFilter('all');
    setSortField(fields[0]);
  };

  const toggleField = (fieldKey: string) => {
    setSelectedFields((prev) => {
      if (prev.includes(fieldKey)) {
        return prev.length > 1 ? prev.filter((f) => f !== fieldKey) : prev;
      }
      return [...prev, fieldKey];
    });
  };

  const moveField = (fieldKey: string, dir: -1 | 1) => {
    setSelectedFields((prev) => {
      const idx = prev.indexOf(fieldKey);
      if (idx < 0) return prev;
      const nextIdx = idx + dir;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(nextIdx, 0, item);
      return copy;
    });
  };

  const rawRows = useMemo(() => {
    if (!state) return [];
    const propName = (pid?: string) => state.properties.find((p) => p.id === pid)?.nameAr || '—';
    const tenantName = (tid?: string) => state.tenants.find((t) => t.id === tid)?.nameAr || '—';
    const unitNumber = (uid?: string) => state.units.find((u) => u.id === uid)?.unitNumber || '—';

    let rows: Record<string, string | number>[] = [];

    if (dataset === 'payments') {
      rows = state.payments.map((p) => ({
        propertyId: p.propertyId,
        receiptNumber: p.receiptNumber,
        tenantName: tenantName(p.tenantId),
        propertyName: propName(p.propertyId),
        unitNumber: unitNumber(p.unitId),
        paymentType: p.paymentType,
        paymentMethod: p.paymentMethod,
        amount: convertToBase(p.amount, p.currency || 'SAR'),
        status: p.status,
        date: p.createdAt.slice(0, 10),
      }));
    } else if (dataset === 'installments') {
      rows = state.installments
        .filter((i) => i.status !== 'ملغاة')
        .map((i) => ({
          propertyId: i.propertyId,
          contractNumber: state.contracts.find((c) => c.id === i.contractId)?.internalNumber || i.contractId,
          tenantName: tenantName(i.tenantId),
          propertyName: propName(i.propertyId),
          unitNumber: unitNumber(i.unitId),
          dueDate: i.dueDate,
          amount: convertToBase(i.amount, i.currency || 'SAR'),
          paidAmount: convertToBase(i.paidAmount, i.currency || 'SAR'),
          remainingAmount: convertToBase(i.remainingAmount, i.currency || 'SAR'),
          status: i.status,
          date: i.dueDate,
        }));
    } else if (dataset === 'expenses') {
      rows = state.expenses.map((e) => ({
        propertyId: e.propertyId,
        expenseNumber: e.expenseNumber,
        date: e.date,
        propertyName: propName(e.propertyId),
        category: e.category,
        bearer: e.bearer,
        amount: convertToBase(e.amount, e.currency || 'SAR'),
        status: e.approvalStatus,
      }));
    } else if (dataset === 'units') {
      rows = state.units.map((u) => ({
        propertyId: u.propertyId,
        propertyName: propName(u.propertyId),
        unitNumber: u.unitNumber,
        unitType: u.unitType,
        areaSqm: u.areaSqm,
        suggestedAnnualRent: u.suggestedAnnualRent,
        status: u.status,
        date: '2026-11',
      }));
    } else if (dataset === 'maintenance') {
      rows = state.tickets.map((t) => ({
        propertyId: t.propertyId,
        ticketNumber: t.ticketNumber,
        propertyName: propName(t.propertyId),
        unitNumber: unitNumber(t.unitId),
        title: t.title,
        category: t.category,
        priority: t.priority,
        actualCost: t.actualCost || t.estimatedCost || 0,
        status: t.status,
        date: t.createdAt.slice(0, 10),
      }));
    }

    const filtered = rows.filter((r) => {
      if (propertyFilter !== 'all' && r.propertyId !== propertyFilter) return false;
      if (statusFilter !== 'all' && String(r.status) !== statusFilter) return false;
      return true;
    });

    filtered.sort((a, b) => {
      const va = a[sortField];
      const vb = b[sortField];
      if (typeof va === 'number' && typeof vb === 'number') {
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      return sortDir === 'asc'
        ? String(va ?? '').localeCompare(String(vb ?? ''), 'ar')
        : String(vb ?? '').localeCompare(String(va ?? ''), 'ar');
    });

    return filtered;
  }, [state, dataset, propertyFilter, statusFilter, sortField, sortDir, convertToBase]);

  const groupedSummary = useMemo(() => {
    if (groupBy === 'none') return [];
    const map = new Map<string, { group: string; count: number; total: number }>();
    const numericKey = meta.fields.find((f) => f.numeric && selectedFields.includes(f.key))?.key ||
      meta.fields.find((f) => f.numeric)?.key;

    for (const row of rawRows) {
      const gKey =
        groupBy === 'property'
          ? String(row.propertyName || '—')
          : groupBy === 'status'
          ? String(row.status || '—')
          : String(row.date || '2026-11').slice(0, 7);
      const cur = map.get(gKey) || { group: gKey, count: 0, total: 0 };
      cur.count += 1;
      if (numericKey) cur.total += Number(row[numericKey] || 0);
      map.set(gKey, cur);
    }
    return Array.from(map.values());
  }, [groupBy, rawRows, meta.fields, selectedFields]);

  if (!state) return null;

  const activeFieldDefs = selectedFields
    .map((key) => meta.fields.find((f) => f.key === key))
    .filter((f): f is FieldDef => Boolean(f));

  const primaryNumericField = activeFieldDefs.find((f) => f.numeric);
  const primaryTotal = primaryNumericField
    ? rawRows.reduce((s, r) => s + Number(r[primaryNumericField.key] || 0), 0)
    : 0;

  const handleExportExcel = () => {
    triggerHaptic('light');
    const wb = XLSX.utils.book_new();
    const headers = activeFieldDefs.map((f) => f.labelAr);
    const dataRows = rawRows.map((r) => activeFieldDefs.map((f) => r[f.key] ?? ''));
    const sheetRows: (string | number)[][] = [
      [reportTitle || meta.labelAr],
      ['المنشأة', state.settings.nameAr, 'تاريخ التوليد', new Date().toISOString().slice(0, 16).replace('T', ' ')],
      ['نطاق البيانات', meta.labelAr, 'عدد السجلات', rawRows.length],
      [],
      headers,
      ...dataRows,
    ];
    if (primaryNumericField) {
      sheetRows.push([
        `الإجمالي (${primaryNumericField.labelAr})`,
        ...activeFieldDefs.slice(1).map((f) => (f.key === primaryNumericField.key ? Math.round(primaryTotal * 100) / 100 : '')),
      ]);
    }
    const ws = XLSX.utils.aoa_to_sheet(sheetRows);
    ws['!cols'] = activeFieldDefs.map(() => ({ wch: 20 }));
    ws['!views'] = [{ rightToLeft: lang === 'ar' }];
    XLSX.utils.book_append_sheet(wb, ws, meta.labelAr.slice(0, 28));

    if (groupedSummary.length > 0) {
      const wsGrp = XLSX.utils.aoa_to_sheet([
        ['المجموعة', 'عدد السجلات', 'الإجمالي'],
        ...groupedSummary.map((g) => [g.group, g.count, Math.round(g.total * 100) / 100]),
      ]);
      wsGrp['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 20 }];
      wsGrp['!views'] = [{ rightToLeft: lang === 'ar' }];
      XLSX.utils.book_append_sheet(wb, wsGrp, 'ملخص التجميع');
    }

    const fileName = `AqarPlus-Custom-Report-${dataset}-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    pushToast('success', `تم تصدير التقرير المخصص إلى Excel (${fileName})`);
  };

  const handleExportCsv = () => {
    triggerHaptic('light');
    exportToCsv(
      `aqarplus-custom-${dataset}.csv`,
      activeFieldDefs.map((f) => f.labelAr),
      rawRows.map((r) => activeFieldDefs.map((f) => r[f.key] ?? ''))
    );
    pushToast('success', 'تم تصدير التقرير المخصص بصيغة CSV');
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSched(true);
    const res = await mutate('POST', '/api/reports/schedules', {
      title: reportTitle || meta.labelAr,
      dataset,
      frequency: schedForm.frequency,
      deliveryChannel: schedForm.deliveryChannel,
      recipient: schedForm.recipient || state.settings.email,
      fields: selectedFields,
      groupBy,
    });
    setSavingSched(false);
    if (res) {
      triggerHaptic('success');
      pushToast('success', 'تمت جدولة التقرير التلقائي وحفظه على الخادم');
      setShowScheduleForm(false);
    }
  };

  return (
    <div className="space-y-6">
      <UnifiedCard className="space-y-5">
        <UnifiedSectionHeader
          title="منشئ التقارير المخصص (Report Builder)"
          subtitle="اختر مصدر البيانات والأعمدة وترتيبها والتجميع ثم صدّر إلى Excel أو CSV أو PDF"
          actions={
            <div className="flex flex-wrap items-center gap-2 no-print">
              <UnifiedButton
                variant="secondary"
                onClick={() => setShowScheduleForm((v) => !v)}
                icon={<CalendarClock className="w-3.5 h-3.5" />}
              >
                جدولة تلقائية
              </UnifiedButton>
              <UnifiedButton variant="secondary" onClick={handleExportCsv} icon={<Download className="w-3.5 h-3.5" />}>
                CSV
              </UnifiedButton>
              <UnifiedButton variant="secondary" onClick={() => window.print()} icon={<Printer className="w-3.5 h-3.5" />}>
                PDF / طباعة
              </UnifiedButton>
              <UnifiedButton onClick={handleExportExcel} icon={<FileSpreadsheet className="w-3.5 h-3.5" />}>
                تصدير Excel احترافي
              </UnifiedButton>
            </div>
          }
        />

        {/* Configuration Controls */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 text-xs no-print">
          <div className="xl:col-span-2">
            <label className={AQAR_THEME.inputs.label}>عنوان التقرير</label>
            <input
              value={reportTitle}
              onChange={(e) => setReportTitle(e.target.value)}
              className={AQAR_THEME.inputs.compact}
              placeholder="عنوان التقرير المخصص"
            />
          </div>
          <div>
            <label className={AQAR_THEME.inputs.label}>مصدر البيانات</label>
            <select
              value={dataset}
              onChange={(e) => handleDatasetChange(e.target.value as DatasetKey)}
              className={AQAR_THEME.inputs.compact}
            >
              {(Object.keys(DATASET_META) as DatasetKey[]).map((key) => (
                <option key={key} value={key}>
                  {DATASET_META[key].labelAr}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={AQAR_THEME.inputs.label}>العقار</label>
            <select
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
              className={AQAR_THEME.inputs.compact}
            >
              <option value="all">جميع العقارات</option>
              {state.properties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nameAr}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={AQAR_THEME.inputs.label}>الحالة</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={AQAR_THEME.inputs.compact}
            >
              <option value="all">جميع الحالات</option>
              {meta.statuses.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Field Selection + Ordering + Grouping */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2 border-t border-slate-200/70 dark:border-white/10 no-print">
          <div className="lg:col-span-8 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#26478D] dark:text-blue-400" />
              <span>الأعمدة المختارة وترتيب الظهور</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {meta.fields.map((field) => {
                const activeIdx = selectedFields.indexOf(field.key);
                const isSelected = activeIdx >= 0;
                return (
                  <div
                    key={field.key}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs transition-colors ${
                      isSelected
                        ? 'border-[#26478D] bg-[#26478D]/10 dark:bg-[#26478D]/30 text-slate-900 dark:text-white font-semibold'
                        : 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <label className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleField(field.key)}
                        className="accent-[#26478D]"
                      />
                      <span>{field.labelAr}</span>
                    </label>
                    {isSelected && (
                      <span className="inline-flex items-center gap-0.5 ps-1 border-s border-slate-300 dark:border-white/15">
                        <button
                          type="button"
                          onClick={() => moveField(field.key, -1)}
                          className="p-0.5 hover:text-[#26478D] cursor-pointer"
                          title="تحريك لليمين/للأعلى"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveField(field.key, 1)}
                          className="p-0.5 hover:text-[#26478D] cursor-pointer"
                          title="تحريك لليسار/للأسفل"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-4 grid grid-cols-2 gap-2.5 text-xs">
            <div>
              <label className={AQAR_THEME.inputs.label}>تجميع البيانات حسب</label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as 'none' | 'property' | 'status' | 'month')}
                className={AQAR_THEME.inputs.compact}
              >
                <option value="none">بدون تجميع</option>
                <option value="property">العقار</option>
                <option value="status">الحالة</option>
                <option value="month">الشهر</option>
              </select>
            </div>
            <div>
              <label className={AQAR_THEME.inputs.label}>الترتيب</label>
              <div className="flex gap-1.5">
                <select
                  value={sortField}
                  onChange={(e) => setSortField(e.target.value)}
                  className={AQAR_THEME.inputs.compact}
                >
                  {meta.fields.map((f) => (
                    <option key={f.key} value={f.key}>
                      {f.labelAr}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))}
                  className="px-2.5 min-h-[38px] rounded-xl border border-slate-200 dark:border-white/15 text-xs font-mono-num cursor-pointer"
                  title="عكس الترتيب"
                >
                  {sortDir === 'desc' ? '↓' : '↑'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Inline Schedule Creation Drawer */}
        {showScheduleForm && (
          <form
            onSubmit={handleCreateSchedule}
            className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 grid grid-cols-1 md:grid-cols-4 gap-3 items-end text-xs no-print"
          >
            <div>
              <label className={AQAR_THEME.inputs.label}>التكرار</label>
              <select
                value={schedForm.frequency}
                onChange={(e) =>
                  setSchedForm({ ...schedForm, frequency: e.target.value as ScheduledReportConfig['frequency'] })
                }
                className={AQAR_THEME.inputs.compact}
              >
                <option value="يومي">يومي</option>
                <option value="أسبوعي">أسبوعي</option>
                <option value="شهري">شهري</option>
              </select>
            </div>
            <div>
              <label className={AQAR_THEME.inputs.label}>قناة الإرسال</label>
              <select
                value={schedForm.deliveryChannel}
                onChange={(e) =>
                  setSchedForm({
                    ...schedForm,
                    deliveryChannel: e.target.value as ScheduledReportConfig['deliveryChannel'],
                  })
                }
                className={AQAR_THEME.inputs.compact}
              >
                <option value="بريد إلكتروني">بريد إلكتروني</option>
                <option value="واتساب">واتساب</option>
                <option value="إشعار داخلي">إشعار داخلي</option>
              </select>
            </div>
            <div>
              <label className={AQAR_THEME.inputs.label}>المستلم (بريد / جوال)</label>
              <input
                value={schedForm.recipient}
                onChange={(e) => setSchedForm({ ...schedForm, recipient: e.target.value })}
                placeholder={state.settings.email}
                className={AQAR_THEME.inputs.compact}
              />
            </div>
            <div className="flex gap-2">
              <UnifiedButton type="submit" loading={savingSched} icon={<Plus className="w-3.5 h-3.5" />}>
                حفظ الجدولة
              </UnifiedButton>
            </div>
          </form>
        )}

        {/* Group Summary Strip if grouped */}
        {groupedSummary.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {groupedSummary.map((g) => (
              <div key={g.group} className={AQAR_THEME.surface.subtleStrip + ' p-3.5'}>
                <div className="text-xs font-bold truncate">{g.group}</div>
                <div className="flex items-baseline justify-between mt-1 text-xs">
                  <span className="text-slate-500 font-mono-num">{g.count} سجل</span>
                  <span className="font-mono-num font-bold text-[#26478D] dark:text-blue-400">
                    {formatCurrency(g.total, baseCurrency, lang)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Live Data Table Preview */}
        {rawRows.length === 0 ? (
          <UnifiedEmptyState
            icon={<SlidersHorizontal className="w-5 h-5" />}
            title="لا توجد بيانات مطابقة للفلاتر"
            description="جرّب تغيير العقار أو الحالة لعرض نتائج في التقرير المخصص."
          />
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-50 dark:bg-white/[0.03] text-slate-500 border-b border-slate-200 dark:border-white/10">
                <tr>
                  {activeFieldDefs.map((f) => (
                    <th key={f.key} className="py-3 px-4 text-start font-medium whitespace-nowrap">
                      {f.labelAr}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {rawRows.slice(0, 50).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02]">
                    {activeFieldDefs.map((f) => (
                      <td
                        key={f.key}
                        className={`py-2.5 px-4 whitespace-nowrap ${
                          f.numeric ? 'font-mono-num font-semibold' : ''
                        }`}
                      >
                        {f.numeric && f.key !== 'areaSqm'
                          ? formatCurrency(Number(row[f.key] || 0), baseCurrency, lang)
                          : row[f.key]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {primaryNumericField && (
                <tfoot className="bg-slate-50/80 dark:bg-white/[0.04] border-t border-slate-200 dark:border-white/10 font-bold">
                  <tr>
                    <td className="py-3 px-4">الإجمالي ({rawRows.length} سجل)</td>
                    {activeFieldDefs.slice(1).map((f) => (
                      <td key={f.key} className="py-3 px-4 font-mono-num text-[#26478D] dark:text-blue-400">
                        {f.key === primaryNumericField.key
                          ? formatCurrency(primaryTotal, baseCurrency, lang)
                          : ''}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </UnifiedCard>

      {/* Scheduled Reports Registry */}
      <UnifiedCard className="space-y-4 no-print">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-[#26478D] dark:text-blue-400" />
            <h3 className="text-sm font-bold">التقارير المجدولة تلقائياً ({(state.scheduledReports || []).length})</h3>
          </div>
        </div>

        {(state.scheduledReports || []).length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            لا توجد تقارير مجدولة حالياً — استخدم زر «جدولة تلقائية» أعلاه لإرسال التقارير بشكل دوري.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-white/5">
            {(state.scheduledReports || []).map((sch) => (
              <div key={sch.id} className="py-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">{sch.title}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {DATASET_META[sch.dataset]?.labelAr} · {sch.frequency} · {sch.deliveryChannel} ({sch.recipient})
                    {sch.lastRunAt && ` · آخر تشغيل: ${formatDateTime(sch.lastRunAt, lang)}`}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await mutate('POST', `/api/reports/schedules/${sch.id}/run`, {});
                      if (res) pushToast('success', `تم تشغيل التقرير «${sch.title}» وإشعار المستلمين`);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#26478D]/10 dark:bg-[#26478D]/30 text-[#26478D] dark:text-blue-300 font-semibold cursor-pointer"
                  >
                    <Play className="w-3 h-3" />
                    <span>تشغيل الآن</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await mutate('DELETE', `/api/reports/schedules/${sch.id}`);
                      if (res) pushToast('info', 'تمت إزالة التقرير المجدول');
                    }}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-500/10 cursor-pointer"
                    aria-label="Delete schedule"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </UnifiedCard>
    </div>
  );
}
