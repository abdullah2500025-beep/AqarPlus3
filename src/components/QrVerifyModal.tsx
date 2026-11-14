import React, { useState } from 'react';
import { CheckCircle2, QrCode, ShieldAlert, ShieldCheck, X } from 'lucide-react';
import { useAqar } from '../context/AqarContext';
import { QrValidationResult, validateReceiptOrZatcaQr } from '../utils/qrService';
import { formatSar } from '../utils/formatters';
import { AQAR_THEME } from '../theme/designTokens';
import { UnifiedButton } from './ui/UnifiedComponents';

interface QrVerifyModalProps {
  open: boolean;
  initialPayload?: string;
  onClose: () => void;
}

export function QrVerifyModal({ open, initialPayload = '', onClose }: QrVerifyModalProps) {
  const { state, lang } = useAqar();
  const [rawInput, setRawInput] = useState(initialPayload);
  const [result, setResult] = useState<QrValidationResult | null>(null);
  const [checking, setChecking] = useState(false);

  React.useEffect(() => {
    if (open) {
      setRawInput(initialPayload);
      setResult(null);
      if (initialPayload.trim()) {
        validateReceiptOrZatcaQr(initialPayload).then(setResult);
      }
    }
  }, [open, initialPayload]);

  if (!open) return null;

  const isAr = lang === 'ar';

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    const res = await validateReceiptOrZatcaQr(rawInput);
    setResult(res);
    setChecking(false);
  };

  const matchedPayment =
    result?.receiptData?.receipt && state
      ? state.payments.find((p) => p.receiptNumber === result.receiptData?.receipt)
      : undefined;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4 overflow-y-auto">
      <div className={`${AQAR_THEME.surface.panel} w-full max-w-xl shadow-2xl overflow-hidden animate-aqar-fade-scale`}>
        <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#26478D]/15 text-[#26478D] dark:text-blue-400 flex items-center justify-center">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isAr ? 'التحقق الأمني من رمز QR (الإيصالات والفواتير الضريبية ZATCA)' : 'QR Integrity & ZATCA Verifier'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {isAr
                  ? 'يدعم التحقق من التوقيع المشفر SHA-256 للسندات أو فك ترميز Base64 TLV لهيئة الزكاة والضريبة'
                  : 'Validates SHA-256 Receipt Signatures or ZATCA Phase 1/2 TLV Base64 payloads'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleVerify} className="p-6 space-y-4">
          <div>
            <label className={AQAR_THEME.inputs.label}>
              {isAr ? 'بيانات رمز QR المقروءة (JSON الإيصال أو Base64 ZATCA TLV)' : 'Scanned QR Payload'}
            </label>
            <textarea
              rows={4}
              dir="ltr"
              value={rawInput}
              onChange={(e) => setRawInput(e.target.value)}
              placeholder='{"v":"1.0","receipt":"AQ-2026-...","hash":"..."} OR Base64 TLV'
              className={`${AQAR_THEME.inputs.base} font-mono text-xs min-h-[96px]`}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-2">
              {state?.payments[0] && (
                <button
                  type="button"
                  onClick={() => {
                    const p = state.payments[0];
                    const t = state.tenants.find((x) => x.id === p.tenantId);
                    const prop = state.properties.find((x) => x.id === p.propertyId);
                    const unit = state.units.find((x) => x.id === p.unitId);
                    import('../utils/qrService').then(async ({ buildReceiptQrPayloadSigned }) => {
                      const payload = await buildReceiptQrPayloadSigned({
                        receiptNumber: p.receiptNumber,
                        amount: p.amount,
                        tenantName: t?.nameAr || '—',
                        propertyName: prop?.nameAr || '—',
                        unitNumber: unit?.unitNumber || '—',
                        date: p.createdAt,
                        companyName: state.settings.nameAr,
                      });
                      const json = JSON.stringify(payload);
                      setRawInput(json);
                      setResult(await validateReceiptOrZatcaQr(json));
                    });
                  }}
                  className="text-[11px] font-semibold text-[#26478D] dark:text-blue-400 hover:underline cursor-pointer"
                >
                  {isAr ? 'اختبار بأحدث سند قبض' : 'Load latest receipt'}
                </button>
              )}
              {state?.zatcaInvoices?.[0] && (
                <button
                  type="button"
                  onClick={async () => {
                    const tlv = state.zatcaInvoices![0].tlvBase64;
                    setRawInput(tlv);
                    setResult(await validateReceiptOrZatcaQr(tlv));
                  }}
                  className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                >
                  {isAr ? 'اختبار بأحدث فاتورة ZATCA' : 'Load latest ZATCA TLV'}
                </button>
              )}
            </div>

            <UnifiedButton type="submit" loading={checking} icon={<ShieldCheck className="w-3.5 h-3.5" />}>
              {isAr ? 'فحص والتحقق الآن' : 'Verify QR'}
            </UnifiedButton>
          </div>

          {result && (
            <div
              className={`p-4 rounded-xl border text-xs space-y-2.5 ${
                result.isValid
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-200'
                  : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
              }`}
            >
              <div className="flex items-center gap-2 font-bold text-sm">
                {result.isValid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : (
                  <ShieldAlert className="w-4 h-4 text-red-500 shrink-0" />
                )}
                <span>
                  {result.isValid
                    ? result.kind === 'zatca'
                      ? 'رمز فاتورة إلكترونية ZATCA TLV صحيح ومعتمد'
                      : 'رمز التحقق الأمني للسند صحيح ومطابق (SHA-256)'
                    : result.error || 'فشل التحقق من الرمز'}
                </span>
              </div>

              {result.warning && (
                <div className="text-[11px] text-amber-600 dark:text-amber-300 font-medium">
                  ملاحظة: {result.warning}
                </div>
              )}

              {result.receiptData && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-500/20 text-[11px]">
                  <div>
                    <span className="opacity-70 block">رقم السند</span>
                    <strong className="font-mono-num">{result.receiptData.receipt}</strong>
                  </div>
                  <div>
                    <span className="opacity-70 block">المبلغ</span>
                    <strong className="font-mono-num">{formatSar(result.receiptData.amount, lang)}</strong>
                  </div>
                  <div>
                    <span className="opacity-70 block">المستأجر</span>
                    <strong>{result.receiptData.tenant}</strong>
                  </div>
                  <div>
                    <span className="opacity-70 block">العقار والوحدة</span>
                    <strong>
                      {result.receiptData.property} · {result.receiptData.unit}
                    </strong>
                  </div>
                  <div className="col-span-2">
                    <span className="opacity-70 block">مطابقة السجل المركزي</span>
                    <strong>
                      {matchedPayment
                        ? `متطابق مع قاعدة البيانات (${matchedPayment.status}) — المبلغ: ${formatSar(matchedPayment.amount, lang)}`
                        : 'صحيح التشفير (معاينة مستقلة)'}
                    </strong>
                  </div>
                </div>
              )}

              {result.zatcaData && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-500/20 text-[11px]">
                  <div>
                    <span className="opacity-70 block">اسم البائع / المنشأة</span>
                    <strong>{result.zatcaData.sellerName}</strong>
                  </div>
                  <div>
                    <span className="opacity-70 block">الرقم الضريبي</span>
                    <strong className="font-mono-num">{result.zatcaData.vatNumber}</strong>
                  </div>
                  <div>
                    <span className="opacity-70 block">الإجمالي شامل الضريبة</span>
                    <strong className="font-mono-num">{formatSar(result.zatcaData.totalWithVat, lang)}</strong>
                  </div>
                  <div>
                    <span className="opacity-70 block">مبلغ ضريبة القيمة المضافة (15%)</span>
                    <strong className="font-mono-num">{formatSar(result.zatcaData.vatAmount, lang)}</strong>
                  </div>
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
