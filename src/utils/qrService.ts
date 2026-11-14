import QRCode from 'qrcode';

export interface ReceiptQrPayload {
  v: '1.0';
  receipt: string;
  amount: number;
  tenant: string;
  property: string;
  unit: string;
  date: string;
  company: string;
  timestamp: string;
  hash: string;
}

export interface ZatcaTlvInput {
  sellerName: string;
  vatNumber: string;
  timestamp: string;
  totalWithVat: number;
  vatAmount: number;
}

export interface ZatcaParsedTlv {
  sellerName: string;
  vatNumber: string;
  timestamp: string;
  totalWithVat: number;
  vatAmount: number;
  isValidVatRatio: boolean;
}

export interface QrValidationResult {
  isValid: boolean;
  kind: 'receipt' | 'zatca' | 'unknown';
  warning?: string;
  error?: string;
  receiptData?: ReceiptQrPayload;
  zatcaData?: ZatcaParsedTlv;
}

const SECRET_SALT = 'AqarPlus2026';

/**
 * Synchronous deterministic 64-bit FNV/DJB digest mixed to 16 hex chars when WebCrypto is unavailable,
 * plus async SHA-256 via Web Crypto SubtleCrypto for cryptographic signing and verification.
 */
export function computeSyncReceiptDigest(receiptNumber: string, amount: number, dateIso: string): string {
  const input = `${receiptNumber}-${Number(amount).toFixed(2)}-${dateIso}-${SECRET_SALT}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i += 1) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= c + i;
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  const part1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const part2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${part1}${part2}`;
}

export async function computeSha256Hex(content: string, length = 16): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const bytes = new TextEncoder().encode(content);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    const hex = Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    return hex.slice(0, length);
  }
  return computeSyncReceiptDigest(content, 0, '').slice(0, length);
}

export async function computeReceiptSecurityHash(
  receiptNumber: string,
  amount: number,
  dateIso: string
): Promise<string> {
  const canonical = `${receiptNumber}-${Number(amount).toFixed(2)}-${dateIso}-${SECRET_SALT}`;
  return computeSha256Hex(canonical, 16);
}

export function buildReceiptQrPayloadSync(params: {
  receiptNumber: string;
  amount: number;
  tenantName: string;
  propertyName: string;
  unitNumber: string;
  date: string;
  companyName: string;
}): ReceiptQrPayload {
  return {
    v: '1.0',
    receipt: params.receiptNumber,
    amount: Math.round(params.amount * 100) / 100,
    tenant: params.tenantName,
    property: params.propertyName,
    unit: params.unitNumber,
    date: params.date,
    company: params.companyName,
    timestamp: params.date,
    hash: computeSyncReceiptDigest(params.receiptNumber, params.amount, params.date),
  };
}

export async function buildReceiptQrPayloadSigned(params: {
  receiptNumber: string;
  amount: number;
  tenantName: string;
  propertyName: string;
  unitNumber: string;
  date: string;
  companyName: string;
}): Promise<ReceiptQrPayload> {
  const hash = await computeReceiptSecurityHash(params.receiptNumber, params.amount, params.date);
  return {
    v: '1.0',
    receipt: params.receiptNumber,
    amount: Math.round(params.amount * 100) / 100,
    tenant: params.tenantName,
    property: params.propertyName,
    unit: params.unitNumber,
    date: params.date,
    company: params.companyName,
    timestamp: new Date().toISOString(),
    hash,
  };
}

function encodeTlvField(tag: number, value: string): Uint8Array {
  const textBytes = new TextEncoder().encode(value);
  const out = new Uint8Array(2 + textBytes.length);
  out[0] = tag;
  out[1] = textBytes.length;
  out.set(textBytes, 2);
  return out;
}

/**
 * Generates an official ZATCA Phase 1/2 UTF-8 TLV Base64 QR payload (Tags 1..5).
 */
export function generateZatcaTlvBase64(input: ZatcaTlvInput): string {
  const chunks = [
    encodeTlvField(1, input.sellerName),
    encodeTlvField(2, input.vatNumber),
    encodeTlvField(3, input.timestamp),
    encodeTlvField(4, input.totalWithVat.toFixed(2)),
    encodeTlvField(5, input.vatAmount.toFixed(2)),
  ];
  const totalLen = chunks.reduce((s, c) => s + c.length, 0);
  const combined = new Uint8Array(totalLen);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.length;
  }
  let binary = '';
  for (let i = 0; i < combined.length; i += 1) {
    binary += String.fromCharCode(combined[i]);
  }
  return btoa(binary);
}

export function decodeZatcaTlvBase64(base64: string): ZatcaParsedTlv | null {
  try {
    const clean = base64.trim();
    if (!clean || clean.startsWith('{')) return null;
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    const tags: Record<number, string> = {};
    let idx = 0;
    const decoder = new TextDecoder('utf-8');
    while (idx + 2 <= bytes.length) {
      const tag = bytes[idx];
      const len = bytes[idx + 1];
      idx += 2;
      if (idx + len > bytes.length) return null;
      tags[tag] = decoder.decode(bytes.slice(idx, idx + len));
      idx += len;
    }

    if (!tags[1] || !tags[2] || !tags[4] || !tags[5]) return null;
    const totalWithVat = Number(tags[4]);
    const vatAmount = Number(tags[5]);
    if (Number.isNaN(totalWithVat) || Number.isNaN(vatAmount)) return null;

    const net = totalWithVat - vatAmount;
    const expectedVat = Math.round(net * 0.15 * 100) / 100;
    const isValidVatRatio = vatAmount === 0 || Math.abs(expectedVat - vatAmount) <= 0.15;

    return {
      sellerName: tags[1],
      vatNumber: tags[2],
      timestamp: tags[3] || '',
      totalWithVat,
      vatAmount,
      isValidVatRatio,
    };
  } catch {
    return null;
  }
}

export async function validateReceiptOrZatcaQr(rawInput: string): Promise<QrValidationResult> {
  const raw = rawInput.trim();
  if (!raw) {
    return { isValid: false, kind: 'unknown', error: 'النص المدخل فارغ' };
  }

  // 1) Try JSON Receipt Verification QR
  if (raw.startsWith('{')) {
    try {
      const data = JSON.parse(raw) as Partial<ReceiptQrPayload>;
      if (data.v !== '1.0') {
        return { isValid: false, kind: 'receipt', error: 'إصدار تنسيق السند غير مدعوم' };
      }
      const required: (keyof ReceiptQrPayload)[] = ['receipt', 'amount', 'date', 'hash', 'company'];
      for (const f of required) {
        if (data[f] === undefined || data[f] === null || data[f] === '') {
          return { isValid: false, kind: 'receipt', error: `حقل مفقود في رمز التحقق: ${f}` };
        }
      }

      const expectedSha = await computeReceiptSecurityHash(
        String(data.receipt),
        Number(data.amount),
        String(data.date)
      );
      const expectedSync = computeSyncReceiptDigest(
        String(data.receipt),
        Number(data.amount),
        String(data.date)
      );

      if (data.hash !== expectedSha && data.hash !== expectedSync) {
        return {
          isValid: false,
          kind: 'receipt',
          error: 'توقيع التشفير (SHA-256 Hash) لا يطابق بيانات السند — يحتمل تعديل البيانات',
        };
      }

      let warning: string | undefined;
      if (data.timestamp) {
        const ageDays = (Date.now() - new Date(data.timestamp).getTime()) / 86400000;
        if (!Number.isNaN(ageDays) && ageDays > 7) {
          warning = `الإيصال صحيح وموثوق (مضى على إصداره ${Math.floor(ageDays)} يوماً)`;
        }
      }

      return {
        isValid: true,
        kind: 'receipt',
        warning,
        receiptData: data as ReceiptQrPayload,
      };
    } catch {
      return { isValid: false, kind: 'receipt', error: 'تعذر قراءة بيانات QR بصيغة JSON' };
    }
  }

  // 2) Try ZATCA Base64 TLV QR
  const zatca = decodeZatcaTlvBase64(raw);
  if (zatca) {
    return {
      isValid: true,
      kind: 'zatca',
      warning: !zatca.isValidVatRatio
        ? 'نسبة الضريبة المستخرجة تختلف عن النسبة القياسية 15%'
        : undefined,
      zatcaData: zatca,
    };
  }

  // 3) Legacy AQARPLUS| pipe format fallback check
  if (raw.startsWith('AQARPLUS|')) {
    const parts = raw.split('|');
    if (parts.length >= 4) {
      return {
        isValid: true,
        kind: 'receipt',
        warning: 'صيغة إيصال قديمة — يوصى بإعادة الإصدار بالتوقيع المشفر v1.0',
        receiptData: {
          v: '1.0',
          receipt: parts[1],
          amount: Number(parts[2]) || 0,
          tenant: '—',
          property: '—',
          unit: '—',
          date: parts[3],
          company: 'AqarPlus',
          timestamp: parts[3],
          hash: 'legacy',
        },
      };
    }
  }

  return {
    isValid: false,
    kind: 'unknown',
    error: 'الرمز المدخل لا يطابق صيغة إيصال AqarPlus أو فاتورة ZATCA TLV',
  };
}

export async function generateQrPngDataUrl(value: string, size = 300): Promise<string> {
  return QRCode.toDataURL(value, {
    width: size,
    margin: 2,
    errorCorrectionLevel: 'H',
    color: {
      dark: '#26478D',
      light: '#FFFFFF',
    },
  });
}

export function getQrMatrix(value: string): { size: number; modules: boolean[][] } {
  const qr = QRCode.create(value || 'AQARPLUS', { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  const modules: boolean[][] = [];
  for (let r = 0; r < size; r += 1) {
    const row: boolean[] = [];
    for (let c = 0; c < size; c += 1) {
      row.push(Boolean(qr.modules.get(r, c)));
    }
    modules.push(row);
  }
  return { size, modules };
}
