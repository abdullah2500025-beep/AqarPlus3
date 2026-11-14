import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { CheckCircle2, Download, FileSpreadsheet, Plus, QrCode, ReceiptText, ShieldCheck, X } from 'lucide-react';
import { useAqar } from '../context/AqarContext';
import { ZatcaInvoiceRecord } from '../types/aqar';
import { formatSar } from '../utils/formatters';
import { AQAR_THEME } from '../theme/designTokens';
import { UnifiedButton, UnifiedCard, UnifiedEmptyState, UnifiedSectionHeader } from './ui/UnifiedComponents';
import { QrCodeSvg } from './QrCodeSvg';
import { QrVerifyModal } from './QrVerifyModal';
import { triggerHaptic } from '../utils/haptics';

export function ZatcaCompliancePanel() {
  const { state, lang, hasPermission, mutate, pushToast } = useAqar();
  const [showCreate, setShowCreate] = useState(false);
  const [verifyPayload, setVerifyPayload] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    invoiceType: 'فاتورة ضريبية مبسطة (B2C)' as ZatcaInvoiceRecord['invoiceType'],
    buyerName: '',
    buyerVatNumber: '',
    propertyId: '',
    unitId: '',
    relatedPaymentId: '',
    subtotal: 2500,
    vatRate: 15,
    notes: '',
  });

  if (!state) return null;

  const invoices = state.zatcaInvoices || [];

  const handleIssueInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    const res = await mutate<{ invoice?: ZatcaInvoiceRecord }>('POST', '/api/zatca/invoices', form, {
      offlineDescAr: `إصدار فاتورة إلكترونية ZATCA للعميل ${form.buyerName}`,
    });
    setSubmitting(false);
    if (res) {
      triggerHaptic('success');
      pushToast('success', 'تم إصدار الفاتورة الضريبية ZATCA مع QR TLV وأرشفتها في الأرشيف الضريبي');
      setShowCreate(false);
      setForm({
        invoiceType: 'فاتورة ضريبية مبسطة (B2C)',
        buyerName: '',
        buyerVatNumber: '',
        propertyId: '',
        unitId: '',
        relatedPaymentId: '',
        subtotal: 2500,
        vatRate: 15,
        notes: '',
      });
    }
  };

  const handleExportTaxArchiveExcel = () => {
    triggerHaptic('light');
    const wb = XLSX.utils.book_new();
    const rows = invoices.map((inv) => [
      inv.invoiceNumber,
      inv.invoiceType,
      inv.issueDate,
      inv.buyerName,
      inv.buyerVatNumber || '—',
      inv.subtotal,
      inv.vatAmount,
      inv.totalWithVat,
      inv.clearanceStatus,
      inv.invoiceHash,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([
      [
        'رقم الفاتورة',
        'النوع',
        'التاريخ',
        'العميل',
        'الرقم الضريبي للعميل',
        'الصافي (ر.س)',
        'الضريبة 15% (ر.س)',
        'الإجمالي (ر.س)',
        'حالة ZATCA',
        'بصمة SHA-256',
      ],
      ...rows,
    ]);
    ws['!cols'] = Array(10).fill({ wch: 20 });
    ws['!views'] = [{ rightToLeft: lang === 'ar' }];
    XLSX.utils.book_append_sheet(wb, ws, 'الأرشيف الضريبي ZATCA');
    XLSX.writeFile(wb, `AqarPlus-ZATCA-Tax-Archive-${new Date().toISOString().slice(0, 10)}.xlsx`);
    pushToast('success', 'تم تصدير سجل الفواتير الضريبية ZATCA بنجاح');
  };

  const totalVatCollected = invoices.reduce((s, inv) => s + inv.vatAmount, 0);
  const totalGrossInvoiced = invoices.reduce((s, inv) => s + inv.totalWithVat, 0);

  return (
    <div className="space-y-6">
      <UnifiedCard className="space-y-5">
        <UnifiedSectionHeader
          title="الفوترة الإلكترونية والتكامل مع هيئة الزكاة والضريبة والجمارك (ZATCA)"
          subtitle={`المرحلة المفعلة: ${state.settings.zatcaPhase} · الرقم الضريبي للمنشأة: ${state.settings.vatNumber}`}
          actions={
            <div className="flex flex-wrap items-center gap-2 no-print">
              <UnifiedButton
                variant="secondary"
                onClick={() => setVerifyPayload('')}
                icon={<QrCode className="w-3.5 h-3.5" />}
              >
                فحص QR فاتورة
              </UnifiedButton>
              <UnifiedButton
                variant="secondary"
                onClick={handleExportTaxArchiveExcel}
                icon={<FileSpreadsheet className="w-3.5 h-3.5" />}
              >
                الأرشيف الضريبي Excel
              </UnifiedButton>
              {hasPermission('manage_accounting') && (
                <UnifiedButton onClick={() => setShowCreate(true)} icon={<Plus className="w-3.5 h-3.5" />}>
                  إصدار فاتورة ضريبية
                </UnifiedButton>
              )}
            </div>
          }
        />

        {/* Tax Archive KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className={AQAR_THEME.surface.subtleStrip + ' p-4'}>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">عدد الفواتير المؤرشفة ضريبياً</div>
            <div className="text-xl font-bold font-mono-num mt-1">{invoices.length}</div>
          </div>
          <div className={AQAR_THEME.surface.subtleStrip + ' p-4'}>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">إجمالي الفواتير شامل الضريبة</div>
            <div className="text-xl font-bold font-mono-num text-[#26478D] dark:text-blue-400 mt-1">
              {formatSar(totalGrossInvoiced, lang)}
            </div>
          </div>
          <div className={AQAR_THEME.surface.subtleStrip + ' p-4'}>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">إجمالي ضريبة القيمة المضافة (15%)</div>
            <div className="text-xl font-bold font-mono-num text-emerald-600 dark:text-emerald-400 mt-1">
              {formatSar(totalVatCollected, lang)}
            </div>
          </div>
        </div>

        {/* ZATCA Invoices List */}
        {invoices.length === 0 ? (
          <UnifiedEmptyState
            icon={<ReceiptText className="w-5 h-5" />}
            title="لا توجد فواتير ضريبية مصدرة حتى الآن"
            description="يمكنك إصدار فاتورة إلكترونية متوافقة مع المرحلة الأولى/الثانية من ZATCA مع توليد رمز QR بصيغة TLV Base64 وحفظها تلقائياً في الأرشيف الضريبي."
            action={
              hasPermission('manage_accounting') ? (
                <UnifiedButton onClick={() => setShowCreate(true)} icon={<Plus className="w-3.5 h-3.5" />}>
                  إصدار أول فاتورة إلكترونية
                </UnifiedButton>
              ) : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/60 dark:bg-white/[0.03] flex items-start justify-between gap-4"
              >
                <div className="space-y-1.5 min-w-0 flex-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono-num font-bold text-[#26478D] dark:text-blue-400">
                      {inv.invoiceNumber}
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-500 dark:text-slate-400">{inv.issueDate}</span>
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white truncate">{inv.buyerName}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {inv.invoiceType}
                    {inv.buyerVatNumber ? ` · ضريبي العميل: ${inv.buyerVatNumber}` : ''}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 pt-1 font-mono-num">
                    <span>الصافي: {formatSar(inv.subtotal, lang)}</span>
                    <span>الضريبة: {formatSar(inv.vatAmount, lang)}</span>
                    <strong className="text-emerald-600 dark:text-emerald-400">
                      الإجمالي: {formatSar(inv.totalWithVat, lang)}
                    </strong>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold pt-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{inv.clearanceStatus}</span>
                  </div>
                  <div className="pt-1 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setVerifyPayload(inv.tlvBase64)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#26478D]/10 dark:bg-[#26478D]/30 text-[#26478D] dark:text-blue-300 text-[11px] font-semibold cursor-pointer"
                    >
                      <ShieldCheck className="w-3 h-3" />
                      <span>التحقق من TLV QR</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const blob = new Blob([JSON.stringify(inv, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${inv.invoiceNumber}-ZATCA.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-white/15 text-[11px] cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>ملف الأرشيف JSON</span>
                    </button>
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-center gap-1">
                  <QrCodeSvg value={inv.tlvBase64} size={90} />
                  <span className="text-[10px] font-mono-num text-slate-400">TLV Base64</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </UnifiedCard>

      {/* Issue ZATCA Invoice Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 overflow-y-auto">
          <form
            onSubmit={handleIssueInvoice}
            className={`${AQAR_THEME.surface.panel} w-full max-w-lg p-6 space-y-4 shadow-2xl animate-aqar-fade-scale`}
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-3">
              <h3 className="text-sm font-bold">إصدار فاتورة إلكترونية متوافقة مع ZATCA</h3>
              <button type="button" onClick={() => setShowCreate(false)} className="cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className={AQAR_THEME.inputs.label}>نوع الفاتورة</label>
                <select
                  value={form.invoiceType}
                  onChange={(e) =>
                    setForm({ ...form, invoiceType: e.target.value as ZatcaInvoiceRecord['invoiceType'] })
                  }
                  className={AQAR_THEME.inputs.compact}
                >
                  <option value="فاتورة ضريبية مبسطة (B2C)">فاتورة ضريبية مبسطة (B2C)</option>
                  <option value="فاتورة ضريبية (B2B)">فاتورة ضريبية (B2B)</option>
                  <option value="إشعار دائن">إشعار دائن</option>
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={AQAR_THEME.inputs.label}>اسم العميل / المستأجر *</label>
                  <input
                    required
                    value={form.buyerName}
                    onChange={(e) => setForm({ ...form, buyerName: e.target.value })}
                    placeholder="مثال: شركة النخبة التجارية"
                    className={AQAR_THEME.inputs.compact}
                  />
                </div>
                <div>
                  <label className={AQAR_THEME.inputs.label}>الرقم الضريبي للعميل (للفاتورة B2B)</label>
                  <input
                    dir="ltr"
                    value={form.buyerVatNumber}
                    onChange={(e) => setForm({ ...form, buyerVatNumber: e.target.value })}
                    placeholder="300000000000003"
                    className={`${AQAR_THEME.inputs.compact} font-mono-num`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className={AQAR_THEME.inputs.label}>المبلغ الصافي قبل الضريبة (ر.س)</label>
                  <input
                    required
                    type="number"
                    min={1}
                    step="0.01"
                    value={form.subtotal}
                    onChange={(e) => setForm({ ...form, subtotal: Number(e.target.value) })}
                    className={`${AQAR_THEME.inputs.compact} font-mono-num`}
                  />
                </div>
                <div>
                  <label className={AQAR_THEME.inputs.label}>نسبة الضريبة (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={15}
                    value={form.vatRate}
                    onChange={(e) => setForm({ ...form, vatRate: Number(e.target.value) })}
                    className={`${AQAR_THEME.inputs.compact} font-mono-num`}
                  />
                </div>
              </div>

              <div className={AQAR_THEME.surface.subtleStrip + ' p-3 flex items-center justify-between font-mono-num'}>
                <span>الضريبة: {formatSar(Math.round(form.subtotal * (form.vatRate / 100) * 100) / 100, lang)}</span>
                <strong className="text-[#26478D] dark:text-blue-400">
                  الإجمالي: {formatSar(Math.round(form.subtotal * (1 + form.vatRate / 100) * 100) / 100, lang)}
                </strong>
              </div>

              <div>
                <label className={AQAR_THEME.inputs.label}>ربط بعقار (اختياري)</label>
                <select
                  value={form.propertyId}
                  onChange={(e) => setForm({ ...form, propertyId: e.target.value })}
                  className={AQAR_THEME.inputs.compact}
                >
                  <option value="">بدون ربط بعقار محدد</option>
                  {state.properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nameAr}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <UnifiedButton type="button" variant="secondary" onClick={() => setShowCreate(false)}>
                إلغاء
              </UnifiedButton>
              <UnifiedButton type="submit" loading={submitting} icon={<ShieldCheck className="w-3.5 h-3.5" />}>
                اعتماد وتوليد ZATCA QR
              </UnifiedButton>
            </div>
          </form>
        </div>
      )}

      <QrVerifyModal
        open={verifyPayload !== null}
        initialPayload={verifyPayload || ''}
        onClose={() => setVerifyPayload(null)}
      />
    </div>
  );
}
