import crypto from 'crypto';

export interface SessionTokenPayload {
  sid: string;
  uid: string;
  wid?: string;
  role: string;
  deviceName?: string;
  iat: number;
  exp: number;
}

export interface EncryptedBackupEnvelope {
  format: 'aqarplus-aes-256-gcm';
  version: 1;
  kdf: 'pbkdf2-sha256';
  iterations: number;
  salt: string;
  iv: string;
  tag: string;
  ciphertext: string;
  createdAt: string;
}

const SCRYPT_KEYLEN = 64;
const PBKDF2_ITERATIONS = 100_000;

export function hashSecret(secret: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(secret, salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

export function verifySecret(secret: string, storedHash: string | null | undefined): boolean {
  if (!storedHash || !secret) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, hexHash] = parts;
  if (!salt || !hexHash) return false;
  try {
    const derived = crypto.scryptSync(secret, salt, SCRYPT_KEYLEN);
    const expected = Buffer.from(hexHash, 'hex');
    if (derived.length !== expected.length) return false;
    return crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function toBase64Url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
  return Buffer.from(padded, 'base64');
}

export function signSessionToken(payload: SessionTokenPayload, secret: string): string {
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', secret).update(encodedPayload).digest();
  return `${encodedPayload}.${toBase64Url(sig)}`;
}

export function verifySessionToken(token: string, secret: string): SessionTokenPayload | null {
  if (!token || !secret) return null;
  const dotIdx = token.indexOf('.');
  if (dotIdx <= 0) return null;
  const encodedPayload = token.slice(0, dotIdx);
  const encodedSig = token.slice(dotIdx + 1);
  if (!encodedPayload || !encodedSig) return null;
  try {
    const expectedSig = crypto.createHmac('sha256', secret).update(encodedPayload).digest();
    const providedSig = fromBase64Url(encodedSig);
    if (expectedSig.length !== providedSig.length) return null;
    if (!crypto.timingSafeEqual(expectedSig, providedSig)) return null;
    const payload = JSON.parse(fromBase64Url(encodedPayload).toString('utf8')) as SessionTokenPayload;
    if (!payload || !payload.uid || !payload.sid || typeof payload.exp !== 'number') return null;
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function encryptBackupPayload(plaintextJson: string, password: string): string {
  const normalized = (password || '').trim();
  if (normalized.length < 4) {
    throw new Error('كلمة مرور التشفير يجب أن لا تقل عن 4 أحرف/أرقام');
  }
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(normalized, salt, PBKDF2_ITERATIONS, 32, 'sha256');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintextJson, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const envelope: EncryptedBackupEnvelope = {
    format: 'aqarplus-aes-256-gcm',
    version: 1,
    kdf: 'pbkdf2-sha256',
    iterations: PBKDF2_ITERATIONS,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: encrypted.toString('base64'),
    createdAt: new Date().toISOString(),
  };
  return JSON.stringify(envelope, null, 2);
}

export function isEncryptedBackupEnvelope(raw: string): boolean {
  try {
    const parsed = JSON.parse(raw) as Partial<EncryptedBackupEnvelope>;
    return parsed?.format === 'aqarplus-aes-256-gcm' && typeof parsed.ciphertext === 'string';
  } catch {
    return false;
  }
}

export function decryptBackupPayload(rawEnvelope: string, password?: string): string {
  const envelope = JSON.parse(rawEnvelope) as EncryptedBackupEnvelope;
  if (envelope.format !== 'aqarplus-aes-256-gcm') {
    return rawEnvelope;
  }
  const normalized = (password || '').trim();
  if (!normalized) {
    throw new Error('هذه النسخة الاحتياطية مشفرة — يرجى إدخال كلمة مرور فك التشفير');
  }
  try {
    const salt = Buffer.from(envelope.salt, 'base64');
    const iv = Buffer.from(envelope.iv, 'base64');
    const tag = Buffer.from(envelope.tag, 'base64');
    const ciphertext = Buffer.from(envelope.ciphertext, 'base64');
    const key = crypto.pbkdf2Sync(
      normalized,
      salt,
      envelope.iterations || PBKDF2_ITERATIONS,
      32,
      'sha256'
    );
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    throw new Error('كلمة مرور فك التشفير غير صحيحة أو أن ملف النسخة تالف');
  }
}
