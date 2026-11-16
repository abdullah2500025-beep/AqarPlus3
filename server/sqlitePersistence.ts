import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import { AqarDatabaseState } from '../src/types/aqar';
import { hashSecret, sha256Hex, verifySecret } from './cryptoAuth';

export interface StoredOperationRecord {
  operationId: string;
  userId: string;
  method: string;
  endpoint: string;
  entityType?: string;
  entityId?: string;
  resultJson?: string;
  status: string;
  createdAt: string;
}

export interface StoredSessionRecord {
  tokenHash: string;
  sessionId?: string;
  userId: string;
  deviceName: string;
  appType?: 'web' | 'desktop';
  deviceId?: string;
  ipAddress?: string;
  rememberMe?: boolean;
  refreshTokenHash?: string | null;
  refreshExpiresAt?: string | null;
  createdAt: string;
  lastSeenAt?: string;
  expiresAt: string;
  revokedAt?: string | null;
}

export interface StoredInviteSecretRecord {
  invitationId: string;
  userId: string;
  companyId: string;
  tokenHash: string;
  codeHash: string;
  expiresAt: string;
  usedAt?: string | null;
  canceledAt?: string | null;
  failedAttempts: number;
  createdAt: string;
}

export type RecoveryPurpose = 'password_reset' | 'pin_reset' | 'verify_email' | 'verify_phone' | 'mfa_challenge';

export interface StoredRecoveryTokenRecord {
  id: string;
  userId: string;
  purpose: RecoveryPurpose;
  targetValue?: string | null;
  codeHash: string;
  expiresAt: string;
  usedAt?: string | null;
  failedAttempts: number;
  createdAt: string;
}

export interface UserCredentialStatus {
  userId: string;
  hasPassword: boolean;
  hasPin: boolean;
  updatedAt?: string;
}

const ARRAY_COLLECTIONS: (keyof AqarDatabaseState)[] = [
  'companies',
  'users',
  'employeeInvitations',
  'customRoles',
  'properties',
  'units',
  'meterReadings',
  'owners',
  'vendors',
  'tenants',
  'leads',
  'leadEscalations',
  'contracts',
  'handovers',
  'installments',
  'payments',
  'accounts',
  'journals',
  'expenses',
  'supplierInvoices',
  'recurringExpenses',
  'propertyBudgets',
  'assets',
  'tickets',
  'tasks',
  'communications',
  'documents',
  'purchaseOrders',
  'decisions',
  'notifications',
  'reminderRules',
  'reminderLogs',
  'auditLogs',
  'backups',
  'savedArchiveFilters',
  'loginHistory',
  'syncConflicts',
  'scheduledReports',
  'favoriteReports',
  'sharedSearchFilters',
  'zatcaInvoices',
  'communicationTemplates',
];

const SINGLETON_KEYS: (keyof AqarDatabaseState)[] = [
  'settings',
  'rolePermissions',
  'roleModulePermissions',
  'counters',
  'processedIdempotencyKeys',
  'archiveLastNightlyRun',
  'archiveSeeded',
  'securityPolicy',
  'communicationTemplates',
  'teamSeeded',
  'syncRevision',
  'entityRevisions',
  'lastUpdatedAt',
];

export class SqlitePersistence {
  private db: DatabaseSync;
  public readonly dbPath: string;

  constructor(dataDir: string) {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    this.dbPath = path.join(dataDir, 'aqarplus.sqlite');
    this.db = new DatabaseSync(this.dbPath);
    this.initSchema();
  }

  private initSchema() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS entities (
        collection TEXT NOT NULL,
        id TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        revision INTEGER NOT NULL DEFAULT 1,
        updated_at TEXT NOT NULL,
        data TEXT NOT NULL,
        PRIMARY KEY (collection, id)
      );

      CREATE INDEX IF NOT EXISTS idx_entities_collection ON entities (collection, sort_order);

      CREATE TABLE IF NOT EXISTS operations_log (
        operation_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        method TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        result_json TEXT,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        session_id TEXT,
        user_id TEXT NOT NULL,
        device_name TEXT NOT NULL,
        app_type TEXT DEFAULT 'web',
        device_id TEXT,
        ip_address TEXT,
        remember_me INTEGER NOT NULL DEFAULT 1,
        refresh_token_hash TEXT,
        refresh_expires_at TEXT,
        created_at TEXT NOT NULL,
        last_seen_at TEXT,
        expires_at TEXT NOT NULL,
        revoked_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id, revoked_at);

      CREATE TABLE IF NOT EXISTS trusted_devices (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        device_hash TEXT NOT NULL,
        device_name TEXT NOT NULL,
        app_type TEXT NOT NULL DEFAULT 'web',
        trusted_at TEXT NOT NULL,
        last_used_at TEXT NOT NULL,
        revoked_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_trusted_devices_user ON trusted_devices (user_id, device_hash, revoked_at);

      CREATE TABLE IF NOT EXISTS user_credentials (
        user_id TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL,
        pin_hash TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS invite_secrets (
        invitation_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        company_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        code_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        canceled_at TEXT,
        failed_attempts INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_invite_token_hash ON invite_secrets (token_hash);

      CREATE TABLE IF NOT EXISTS recovery_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        purpose TEXT NOT NULL,
        target_value TEXT,
        code_hash TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        used_at TEXT,
        failed_attempts INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_recovery_user_purpose ON recovery_tokens (user_id, purpose, used_at);

      CREATE TABLE IF NOT EXISTS attachments (
        id TEXT PRIMARY KEY,
        related_type TEXT,
        related_id TEXT,
        mime_type TEXT,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        content_base64 TEXT,
        disk_path TEXT,
        created_at TEXT NOT NULL
      );
    `);

    const cols = (this.db.prepare(`PRAGMA table_info(sessions)`).all() as { name: string }[]).map((c) => c.name);
    if (!cols.includes('session_id')) this.db.exec(`ALTER TABLE sessions ADD COLUMN session_id TEXT`);
    if (!cols.includes('ip_address')) this.db.exec(`ALTER TABLE sessions ADD COLUMN ip_address TEXT`);
    if (!cols.includes('remember_me')) this.db.exec(`ALTER TABLE sessions ADD COLUMN remember_me INTEGER NOT NULL DEFAULT 1`);
    if (!cols.includes('last_seen_at')) this.db.exec(`ALTER TABLE sessions ADD COLUMN last_seen_at TEXT`);
    if (!cols.includes('app_type')) this.db.exec(`ALTER TABLE sessions ADD COLUMN app_type TEXT DEFAULT 'web'`);
    if (!cols.includes('device_id')) this.db.exec(`ALTER TABLE sessions ADD COLUMN device_id TEXT`);
    if (!cols.includes('refresh_token_hash')) this.db.exec(`ALTER TABLE sessions ADD COLUMN refresh_token_hash TEXT`);
    if (!cols.includes('refresh_expires_at')) this.db.exec(`ALTER TABLE sessions ADD COLUMN refresh_expires_at TEXT`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_refresh ON sessions (refresh_token_hash);`);
  }

  public getOrCreateSessionSecret(): string {
    if (process.env.AQAR_SESSION_SECRET && process.env.AQAR_SESSION_SECRET.length >= 16) {
      return process.env.AQAR_SESSION_SECRET;
    }
    const row = this.db.prepare(`SELECT value FROM meta WHERE key = 'session_secret'`).get() as
      | { value: string }
      | undefined;
    if (row?.value) return row.value;
    const generated = crypto.randomBytes(32).toString('hex');
    this.db
      .prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES ('session_secret', ?)`)
      .run(generated);
    return generated;
  }

  public hasState(): boolean {
    const row = this.db.prepare(`SELECT value FROM meta WHERE key = 'singleton:settings'`).get() as
      | { value: string }
      | undefined;
    return Boolean(row?.value);
  }

  public loadState(): Partial<AqarDatabaseState> | null {
    if (!this.hasState()) return null;
    const result: Record<string, unknown> = {};

    const metaRows = this.db
      .prepare(`SELECT key, value FROM meta WHERE key LIKE 'singleton:%'`)
      .all() as { key: string; value: string }[];
    for (const row of metaRows) {
      const prop = row.key.slice('singleton:'.length);
      try {
        result[prop] = JSON.parse(row.value);
      } catch {
        result[prop] = row.value;
      }
    }

    for (const col of ARRAY_COLLECTIONS) {
      if (col === 'communicationTemplates' && Array.isArray(result[col])) continue;
      const rows = this.db
        .prepare(`SELECT data FROM entities WHERE collection = ? ORDER BY sort_order ASC`)
        .all(String(col)) as { data: string }[];
      result[String(col)] = rows.map((r) => JSON.parse(r.data));
    }

    return result as Partial<AqarDatabaseState>;
  }

  public saveState(state: AqarDatabaseState): void {
    const now = state.lastUpdatedAt || new Date().toISOString();
    const revisions = state.entityRevisions || {};
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const upsertMeta = this.db.prepare(`INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)`);
      for (const key of SINGLETON_KEYS) {
        const val = state[key];
        if (val !== undefined) {
          upsertMeta.run(`singleton:${String(key)}`, JSON.stringify(val));
        }
      }

      const deleteCollection = this.db.prepare(`DELETE FROM entities WHERE collection = ?`);
      const insertEntity = this.db.prepare(
        `INSERT INTO entities (collection, id, sort_order, revision, updated_at, data) VALUES (?, ?, ?, ?, ?, ?)`
      );
      const upsertAttachment = this.db.prepare(
        `INSERT OR REPLACE INTO attachments (id, related_type, related_id, mime_type, size_bytes, content_base64, disk_path, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );

      for (const col of ARRAY_COLLECTIONS) {
        const list = (state[col] as unknown[] | undefined) || [];
        deleteCollection.run(String(col));
        for (let idx = 0; idx < list.length; idx++) {
          const item = list[idx] as Record<string, unknown>;
          const entityId = String(item?.id || `${String(col)}-${idx}`);
          const revKey = `${String(col)}:${entityId}`;
          const rev = revisions[revKey] || 1;
          insertEntity.run(String(col), entityId, idx, rev, now, JSON.stringify(item));

          if (col === 'documents' && typeof item?.dataUrl === 'string' && item.dataUrl.length > 0) {
            upsertAttachment.run(
              entityId,
              String(item.relatedType || 'document'),
              String(item.relatedId || ''),
              String(item.fileType || 'application/octet-stream'),
              Math.round(Buffer.byteLength(item.dataUrl, 'utf8')),
              item.dataUrl,
              typeof item.diskPath === 'string' ? item.diskPath : null,
              String(item.createdAt || now)
            );
          }
        }
      }

      this.db.exec('COMMIT');
    } catch (err) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // ignore rollback error
      }
      throw err;
    }
  }

  public hasOperation(operationId: string): StoredOperationRecord | null {
    if (!operationId) return null;
    const row = this.db
      .prepare(
        `SELECT operation_id as operationId, user_id as userId, method, endpoint, entity_type as entityType, entity_id as entityId, result_json as resultJson, status, created_at as createdAt FROM operations_log WHERE operation_id = ?`
      )
      .get(operationId) as StoredOperationRecord | undefined;
    return row || null;
  }

  public recordOperation(entry: StoredOperationRecord): void {
    this.db
      .prepare(
        `INSERT OR IGNORE INTO operations_log (operation_id, user_id, method, endpoint, entity_type, entity_id, result_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        entry.operationId,
        entry.userId,
        entry.method,
        entry.endpoint,
        entry.entityType || null,
        entry.entityId || null,
        entry.resultJson || null,
        entry.status,
        entry.createdAt
      );
  }

  public ensureSeedCredentials(users: { id: string; role: string }[]): void {
    const defaultPasswordHash = hashSecret('Aqar@2026');
    const defaultPinHash = hashSecret('1234');
    const now = new Date().toISOString();
    const check = this.db.prepare(`SELECT user_id FROM user_credentials WHERE user_id = ?`);
    const insert = this.db.prepare(
      `INSERT INTO user_credentials (user_id, password_hash, pin_hash, updated_at) VALUES (?, ?, ?, ?)`
    );
    for (const u of users) {
      const existing = check.get(u.id);
      if (!existing) {
        insert.run(u.id, defaultPasswordHash, defaultPinHash, now);
      }
    }
  }

  public verifyUserPassword(userId: string, password: string): boolean {
    const row = this.db
      .prepare(`SELECT password_hash as passwordHash FROM user_credentials WHERE user_id = ?`)
      .get(userId) as { passwordHash: string } | undefined;
    return verifySecret(password, row?.passwordHash);
  }

  public verifyUserPin(userId: string, pin: string): boolean {
    const row = this.db
      .prepare(`SELECT pin_hash as pinHash FROM user_credentials WHERE user_id = ?`)
      .get(userId) as { pinHash: string | null } | undefined;
    return verifySecret(pin, row?.pinHash);
  }

  public updateUserCredentials(userId: string, input: { password?: string; pin?: string }): void {
    const now = new Date().toISOString();
    const existing = this.db
      .prepare(`SELECT password_hash as passwordHash, pin_hash as pinHash FROM user_credentials WHERE user_id = ?`)
      .get(userId) as { passwordHash: string; pinHash: string | null } | undefined;

    const nextPasswordHash = input.password ? hashSecret(input.password) : existing?.passwordHash || hashSecret('Aqar@2026');
    const nextPinHash = input.pin ? hashSecret(input.pin) : existing?.pinHash || null;

    this.db
      .prepare(
        `INSERT OR REPLACE INTO user_credentials (user_id, password_hash, pin_hash, updated_at) VALUES (?, ?, ?, ?)`
      )
      .run(userId, nextPasswordHash, nextPinHash, now);
  }

  public disableUserPin(userId: string): void {
    const now = new Date().toISOString();
    this.db
      .prepare(`UPDATE user_credentials SET pin_hash = NULL, updated_at = ? WHERE user_id = ?`)
      .run(now, userId);
  }

  public getCredentialStatus(userId: string): UserCredentialStatus {
    const row = this.db
      .prepare(`SELECT user_id as userId, password_hash as passwordHash, pin_hash as pinHash, updated_at as updatedAt FROM user_credentials WHERE user_id = ?`)
      .get(userId) as { userId: string; passwordHash: string; pinHash: string | null; updatedAt: string } | undefined;
    return {
      userId,
      hasPassword: Boolean(row?.passwordHash),
      hasPin: Boolean(row?.pinHash),
      updatedAt: row?.updatedAt,
    };
  }

  public createSession(
    rawToken: string,
    userId: string,
    deviceName: string,
    expiresAt: string,
    opts?: {
      sessionId?: string;
      rememberMe?: boolean;
      ipAddress?: string;
      appType?: 'web' | 'desktop';
      deviceId?: string;
      rawRefreshToken?: string;
      refreshExpiresAt?: string;
    }
  ): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT OR REPLACE INTO sessions (token_hash, session_id, user_id, device_name, app_type, device_id, ip_address, remember_me, refresh_token_hash, refresh_expires_at, created_at, last_seen_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)`
      )
      .run(
        sha256Hex(rawToken),
        opts?.sessionId || null,
        userId,
        deviceName,
        opts?.appType === 'desktop' ? 'desktop' : 'web',
        opts?.deviceId || null,
        opts?.ipAddress || null,
        opts?.rememberMe === false ? 0 : 1,
        opts?.rawRefreshToken ? sha256Hex(opts.rawRefreshToken) : null,
        opts?.refreshExpiresAt || null,
        now,
        now,
        expiresAt
      );
  }

  public isSessionActive(rawToken: string): StoredSessionRecord | null {
    const row = this.db
      .prepare(
        `SELECT token_hash as tokenHash, session_id as sessionId, user_id as userId, device_name as deviceName, app_type as appType, device_id as deviceId, ip_address as ipAddress, remember_me as rememberMeInt, refresh_token_hash as refreshTokenHash, refresh_expires_at as refreshExpiresAt, created_at as createdAt, last_seen_at as lastSeenAt, expires_at as expiresAt, revoked_at as revokedAt FROM sessions WHERE token_hash = ?`
      )
      .get(sha256Hex(rawToken)) as (StoredSessionRecord & { rememberMeInt?: number }) | undefined;
    if (!row || row.revokedAt) return null;
    if (Date.now() > new Date(row.expiresAt).getTime()) return null;
    return {
      tokenHash: row.tokenHash,
      sessionId: row.sessionId,
      userId: row.userId,
      deviceName: row.deviceName,
      appType: row.appType === 'desktop' ? 'desktop' : 'web',
      deviceId: row.deviceId,
      ipAddress: row.ipAddress,
      rememberMe: row.rememberMeInt !== 0,
      refreshTokenHash: row.refreshTokenHash,
      refreshExpiresAt: row.refreshExpiresAt,
      createdAt: row.createdAt,
      lastSeenAt: row.lastSeenAt || row.createdAt,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
    };
  }

  public findSessionByRefreshToken(rawRefreshToken: string): StoredSessionRecord | null {
    if (!rawRefreshToken) return null;
    const row = this.db
      .prepare(
        `SELECT token_hash as tokenHash, session_id as sessionId, user_id as userId, device_name as deviceName, app_type as appType, device_id as deviceId, ip_address as ipAddress, remember_me as rememberMeInt, refresh_token_hash as refreshTokenHash, refresh_expires_at as refreshExpiresAt, created_at as createdAt, last_seen_at as lastSeenAt, expires_at as expiresAt, revoked_at as revokedAt FROM sessions WHERE refresh_token_hash = ?`
      )
      .get(sha256Hex(rawRefreshToken)) as (StoredSessionRecord & { rememberMeInt?: number }) | undefined;
    if (!row || row.revokedAt) return null;
    const refExp = row.refreshExpiresAt || row.expiresAt;
    if (Date.now() > new Date(refExp).getTime()) return null;
    return {
      tokenHash: row.tokenHash,
      sessionId: row.sessionId,
      userId: row.userId,
      deviceName: row.deviceName,
      appType: row.appType === 'desktop' ? 'desktop' : 'web',
      deviceId: row.deviceId,
      ipAddress: row.ipAddress,
      rememberMe: row.rememberMeInt !== 0,
      refreshTokenHash: row.refreshTokenHash,
      refreshExpiresAt: row.refreshExpiresAt,
      createdAt: row.createdAt,
      lastSeenAt: row.lastSeenAt || row.createdAt,
      expiresAt: row.expiresAt,
      revokedAt: row.revokedAt,
    };
  }

  public rotateSessionTokens(
    oldRefreshToken: string,
    newAccessToken: string,
    newRefreshToken: string,
    newExpiresAt: string,
    newRefreshExpiresAt: string
  ): boolean {
    const now = new Date().toISOString();
    const info = this.db
      .prepare(
        `UPDATE sessions SET token_hash = ?, refresh_token_hash = ?, expires_at = ?, refresh_expires_at = ?, last_seen_at = ? WHERE refresh_token_hash = ? AND revoked_at IS NULL`
      )
      .run(
        sha256Hex(newAccessToken),
        sha256Hex(newRefreshToken),
        newExpiresAt,
        newRefreshExpiresAt,
        now,
        sha256Hex(oldRefreshToken)
      );
    return Number(info.changes || 0) > 0;
  }

  public updateSessionLastSeen(rawToken: string): void {
    this.db
      .prepare(`UPDATE sessions SET last_seen_at = ? WHERE token_hash = ? AND revoked_at IS NULL`)
      .run(new Date().toISOString(), sha256Hex(rawToken));
  }

  public listActiveSessionsForUser(userId: string, currentRawToken?: string) {
    const now = new Date().toISOString();
    const currentHash = currentRawToken ? sha256Hex(currentRawToken) : '';
    const rows = this.db
      .prepare(
        `SELECT token_hash as tokenHash, session_id as sessionId, user_id as userId, device_name as deviceName, app_type as appType, device_id as deviceId, ip_address as ipAddress, remember_me as rememberMeInt, created_at as createdAt, last_seen_at as lastSeenAt, expires_at as expiresAt FROM sessions WHERE user_id = ? AND revoked_at IS NULL AND expires_at > ? ORDER BY created_at DESC`
      )
      .all(userId, now) as {
      tokenHash: string;
      sessionId?: string | null;
      userId: string;
      deviceName: string;
      appType?: string | null;
      deviceId?: string | null;
      ipAddress?: string | null;
      rememberMeInt: number;
      createdAt: string;
      lastSeenAt?: string | null;
      expiresAt: string;
    }[];
    return rows.map((r) => ({
      id: r.sessionId || r.tokenHash.slice(0, 16),
      sessionId: r.sessionId || r.tokenHash.slice(0, 16),
      userId: r.userId,
      deviceName: r.deviceName,
      appType: (r.appType === 'desktop' ? 'desktop' : 'web') as 'web' | 'desktop',
      deviceId: r.deviceId || undefined,
      ipAddress: r.ipAddress || undefined,
      rememberMe: r.rememberMeInt !== 0,
      createdAt: r.createdAt,
      lastSeenAt: r.lastSeenAt || r.createdAt,
      expiresAt: r.expiresAt,
      isCurrent: Boolean(currentHash && r.tokenHash === currentHash),
    }));
  }

  public revokeSession(rawToken: string): void {
    this.db
      .prepare(`UPDATE sessions SET revoked_at = ? WHERE token_hash = ?`)
      .run(new Date().toISOString(), sha256Hex(rawToken));
  }

  public revokeSessionById(userId: string, sessionIdOrPrefix: string): number {
    const now = new Date().toISOString();
    const info = this.db
      .prepare(
        `UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL AND (session_id = ? OR substr(token_hash, 1, 16) = ?)`
      )
      .run(now, userId, sessionIdOrPrefix, sessionIdOrPrefix);
    return Number(info.changes || 0);
  }

  public revokeOtherSessionsForUser(userId: string, keepRawToken?: string): number {
    const now = new Date().toISOString();
    if (keepRawToken) {
      const info = this.db
        .prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL AND token_hash != ?`)
        .run(now, userId, sha256Hex(keepRawToken));
      return Number(info.changes || 0);
    }
    const info = this.db
      .prepare(`UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`)
      .run(now, userId);
    return Number(info.changes || 0);
  }

  public registerOrTouchTrustedDevice(
    userId: string,
    deviceId: string,
    deviceName: string,
    appType: 'web' | 'desktop' = 'web'
  ): void {
    if (!deviceId) return;
    const deviceHash = sha256Hex(`${userId}:${deviceId}`);
    const now = new Date().toISOString();
    const existing = this.db
      .prepare(`SELECT id FROM trusted_devices WHERE user_id = ? AND device_hash = ? AND revoked_at IS NULL`)
      .get(userId, deviceHash) as { id: string } | undefined;
    if (existing) {
      this.db
        .prepare(`UPDATE trusted_devices SET device_name = ?, app_type = ?, last_used_at = ? WHERE id = ?`)
        .run(deviceName, appType, now, existing.id);
      return;
    }
    this.db
      .prepare(
        `INSERT INTO trusted_devices (id, user_id, device_hash, device_name, app_type, trusted_at, last_used_at, revoked_at) VALUES (?, ?, ?, ?, ?, ?, ?, NULL)`
      )
      .run(`td-${crypto.randomBytes(6).toString('hex')}`, userId, deviceHash, deviceName, appType, now, now);
  }

  public isTrustedDevice(userId: string, deviceId?: string): boolean {
    if (!deviceId) return false;
    const deviceHash = sha256Hex(`${userId}:${deviceId}`);
    const row = this.db
      .prepare(`SELECT id FROM trusted_devices WHERE user_id = ? AND device_hash = ? AND revoked_at IS NULL`)
      .get(userId, deviceHash) as { id: string } | undefined;
    return Boolean(row);
  }

  public listTrustedDevices(userId: string, currentDeviceId?: string) {
    const currentHash = currentDeviceId ? sha256Hex(`${userId}:${currentDeviceId}`) : '';
    const rows = this.db
      .prepare(
        `SELECT id, user_id as userId, device_hash as deviceHash, device_name as deviceName, app_type as appType, trusted_at as trustedAt, last_used_at as lastUsedAt FROM trusted_devices WHERE user_id = ? AND revoked_at IS NULL ORDER BY last_used_at DESC`
      )
      .all(userId) as {
      id: string;
      userId: string;
      deviceHash: string;
      deviceName: string;
      appType: string;
      trustedAt: string;
      lastUsedAt: string;
    }[];
    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      deviceName: r.deviceName,
      appType: (r.appType === 'desktop' ? 'desktop' : 'web') as 'web' | 'desktop',
      trustedAt: r.trustedAt,
      lastUsedAt: r.lastUsedAt,
      isCurrent: Boolean(currentHash && r.deviceHash === currentHash),
    }));
  }

  public revokeTrustedDevice(userId: string, trustedDeviceId: string): number {
    const info = this.db
      .prepare(`UPDATE trusted_devices SET revoked_at = ? WHERE user_id = ? AND id = ? AND revoked_at IS NULL`)
      .run(new Date().toISOString(), userId, trustedDeviceId);
    return Number(info.changes || 0);
  }

  public createInviteSecret(input: {
    invitationId: string;
    userId: string;
    companyId: string;
    rawToken: string;
    verificationCode: string;
    expiresAt: string;
  }): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `INSERT OR REPLACE INTO invite_secrets (invitation_id, user_id, company_id, token_hash, code_hash, expires_at, used_at, canceled_at, failed_attempts, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, 0, ?)`
      )
      .run(
        input.invitationId,
        input.userId,
        input.companyId,
        sha256Hex(input.rawToken),
        hashSecret(input.verificationCode),
        input.expiresAt,
        now
      );
  }

  public findInviteSecretByToken(rawToken: string): StoredInviteSecretRecord | null {
    if (!rawToken) return null;
    const row = this.db
      .prepare(
        `SELECT invitation_id as invitationId, user_id as userId, company_id as companyId, token_hash as tokenHash, code_hash as codeHash, expires_at as expiresAt, used_at as usedAt, canceled_at as canceledAt, failed_attempts as failedAttempts, created_at as createdAt FROM invite_secrets WHERE token_hash = ?`
      )
      .get(sha256Hex(rawToken)) as StoredInviteSecretRecord | undefined;
    return row || null;
  }

  public verifyAndConsumeInviteSecret(
    rawToken: string,
    verificationCode: string
  ): { ok: true; record: StoredInviteSecretRecord } | { ok: false; reason: string; expired?: boolean } {
    const rec = this.findInviteSecretByToken(rawToken);
    if (!rec) return { ok: false, reason: 'رابط الدعوة غير صالح أو غير موجود' };
    if (rec.canceledAt) return { ok: false, reason: 'تم إلغاء هذه الدعوة من قِبل الإدارة' };
    if (rec.usedAt) return { ok: false, reason: 'تم استخدام هذه الدعوة وتفعيل الحساب مسبقاً' };
    if (Date.now() > new Date(rec.expiresAt).getTime()) {
      return { ok: false, reason: 'انتهت صلاحية رابط الدعوة — اطلب من مدير الشركة إعادة الإرسال', expired: true };
    }
    if (rec.failedAttempts >= 5) {
      return { ok: false, reason: 'تم تعليق رمز التحقق لهذه الدعوة لكثرة المحاولات الخاطئة' };
    }
    if (!verifySecret(verificationCode.trim(), rec.codeHash)) {
      this.db
        .prepare(`UPDATE invite_secrets SET failed_attempts = failed_attempts + 1 WHERE invitation_id = ?`)
        .run(rec.invitationId);
      return { ok: false, reason: 'رمز التحقق المكون من 6 أرقام غير صحيح' };
    }
    this.db
      .prepare(`UPDATE invite_secrets SET used_at = ? WHERE invitation_id = ?`)
      .run(new Date().toISOString(), rec.invitationId);
    return { ok: true, record: rec };
  }

  public cancelInviteSecret(invitationId: string): void {
    this.db
      .prepare(`UPDATE invite_secrets SET canceled_at = ? WHERE invitation_id = ? AND used_at IS NULL`)
      .run(new Date().toISOString(), invitationId);
  }

  public createRecoveryToken(input: {
    id: string;
    userId: string;
    purpose: RecoveryPurpose;
    targetValue?: string;
    code: string;
    expiresAt: string;
  }): void {
    const now = new Date().toISOString();
    // Invalidate any previous unused tokens for the same user & purpose
    this.db
      .prepare(`UPDATE recovery_tokens SET used_at = ? WHERE user_id = ? AND purpose = ? AND used_at IS NULL`)
      .run(now, input.userId, input.purpose);

    this.db
      .prepare(
        `INSERT INTO recovery_tokens (id, user_id, purpose, target_value, code_hash, expires_at, used_at, failed_attempts, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, 0, ?)`
      )
      .run(
        input.id,
        input.userId,
        input.purpose,
        input.targetValue || null,
        hashSecret(input.code),
        input.expiresAt,
        now
      );
  }

  public verifyAndConsumeRecoveryToken(
    userId: string,
    purpose: RecoveryPurpose,
    code: string
  ): { ok: true; record: StoredRecoveryTokenRecord } | { ok: false; reason: string } {
    const row = this.db
      .prepare(
        `SELECT id, user_id as userId, purpose, target_value as targetValue, code_hash as codeHash, expires_at as expiresAt, used_at as usedAt, failed_attempts as failedAttempts, created_at as createdAt FROM recovery_tokens WHERE user_id = ? AND purpose = ? AND used_at IS NULL ORDER BY created_at DESC LIMIT 1`
      )
      .get(userId, purpose) as StoredRecoveryTokenRecord | undefined;

    if (!row) {
      return { ok: false, reason: 'لا يوجد طلب رمز تحقق نشط — اطلب رمزاً جديداً' };
    }
    if (Date.now() > new Date(row.expiresAt).getTime()) {
      return { ok: false, reason: 'انتهت صلاحية رمز التحقق — اطلب رمزاً جديداً' };
    }
    if (row.failedAttempts >= 5) {
      return { ok: false, reason: 'تم تجاوز الحد الأقصى لمحاولات إدخال الرمز (5 محاولات) — اطلب رمزاً جديداً' };
    }
    if (!verifySecret(code.trim(), row.codeHash)) {
      this.db
        .prepare(`UPDATE recovery_tokens SET failed_attempts = failed_attempts + 1 WHERE id = ?`)
        .run(row.id);
      return { ok: false, reason: 'رمز التحقق غير صحيح' };
    }
    this.db
      .prepare(`UPDATE recovery_tokens SET used_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), row.id);
    return { ok: true, record: row };
  }

  public getDiagnostics() {
    const entitiesCount = (
      this.db.prepare(`SELECT COUNT(*) as c FROM entities`).get() as { c: number }
    ).c;
    const operationsCount = (
      this.db.prepare(`SELECT COUNT(*) as c FROM operations_log`).get() as { c: number }
    ).c;
    const activeSessionsCount = (
      this.db
        .prepare(`SELECT COUNT(*) as c FROM sessions WHERE revoked_at IS NULL AND expires_at > ?`)
        .get(new Date().toISOString()) as { c: number }
    ).c;
    const pragmaRow = this.db.prepare(`PRAGMA journal_mode`).get() as { journal_mode?: string } | undefined;
    const journalMode = String(pragmaRow?.journal_mode || 'wal').toLowerCase();
    const dbSizeBytes = fs.existsSync(this.dbPath) ? fs.statSync(this.dbPath).size : 0;
    return {
      engine: 'sqlite-wal',
      journalMode,
      dbPath: this.dbPath,
      entitiesCount,
      operationsCount,
      activeSessionsCount,
      dbSizeKb: Math.max(1, Math.round(dbSizeBytes / 1024)),
    };
  }

  public close() {
    try {
      this.db.close();
    } catch {
      // ignore close error
    }
  }
}
