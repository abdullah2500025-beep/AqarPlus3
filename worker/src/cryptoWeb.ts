const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export async function hashSecretWeb(secret: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return `pbkdf2$${bytesToHex(salt)}$${bytesToHex(new Uint8Array(derived))}`;
}

export async function verifySecretWeb(secret: string, storedHash: string): Promise<boolean> {
  if (!storedHash || !storedHash.startsWith('pbkdf2$')) return false;
  const parts = storedHash.split('$');
  if (parts.length !== 3) return false;
  const salt = hexToBytes(parts[1]);
  const expected = hexToBytes(parts[2]);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return constantTimeEqual(new Uint8Array(derived), expected);
}

export interface WorkerSessionClaims {
  sid: string;
  uid: string;
  wid?: string;
  role: string;
  deviceName?: string;
  iat: number;
  exp: number;
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function signTokenWeb(claims: WorkerSessionClaims, secret: string): Promise<string> {
  const payloadB64 = toBase64Url(encoder.encode(JSON.stringify(claims)));
  const key = await importHmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64));
  return `${payloadB64}.${toBase64Url(new Uint8Array(sig))}`;
}

export async function verifyTokenWeb(token: string, secret: string): Promise<WorkerSessionClaims | null> {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payloadB64, sigB64] = parts;
  const key = await importHmacKey(secret);
  const expectedSig = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64)));
  let providedSig: Uint8Array;
  try {
    providedSig = fromBase64Url(sigB64);
  } catch {
    return null;
  }
  if (!constantTimeEqual(expectedSig, providedSig)) return null;
  try {
    const claims = JSON.parse(decoder.decode(fromBase64Url(payloadB64))) as WorkerSessionClaims;
    if (!claims?.uid || !claims?.exp || claims.exp < Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

export interface WebEncryptedEnvelope {
  aqarEncrypted: true;
  alg: 'AES-256-GCM';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

export async function encryptBackupWeb(payload: unknown, password: string): Promise<WebEncryptedEnvelope> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  const aesKey = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encoder.encode(JSON.stringify(payload))
  );
  return {
    aqarEncrypted: true,
    alg: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: 100000,
    salt: bytesToHex(salt),
    iv: bytesToHex(iv),
    ciphertext: toBase64Url(new Uint8Array(encrypted)),
  };
}

export async function decryptBackupWeb<T = unknown>(
  envelope: WebEncryptedEnvelope,
  password: string
): Promise<T> {
  const salt = hexToBytes(envelope.salt);
  const iv = hexToBytes(envelope.iv);
  const cipherBytes = fromBase64Url(envelope.ciphertext);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: envelope.iterations || 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    aesKey,
    cipherBytes as BufferSource
  );
  return JSON.parse(decoder.decode(new Uint8Array(plainBuf))) as T;
}
