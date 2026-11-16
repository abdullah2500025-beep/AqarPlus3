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
  userId: string;
  deviceName: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string | null;
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
        user_id TEXT NOT NULL,
        device_name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id, revoked_at);

      CREATE TABLE IF NOT EXISTS user_credentials (
        user_id TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL,
        pin_hash TEXT,
        updated_at TEXT NOT NULL
      );

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

  public createSession(rawToken: string, userId: string, deviceName: string, expiresAt: string): void {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO sessions (token_hash, user_id, device_name, created_at, expires_at, revoked_at) VALUES (?, ?, ?, ?, ?, NULL)`
      )
      .run(sha256Hex(rawToken), userId, deviceName, new Date().toISOString(), expiresAt);
  }

  public isSessionActive(rawToken: string): StoredSessionRecord | null {
    const row = this.db
      .prepare(
        `SELECT token_hash as tokenHash, user_id as userId, device_name as deviceName, created_at as createdAt, expires_at as expiresAt, revoked_at as revokedAt FROM sessions WHERE token_hash = ?`
      )
      .get(sha256Hex(rawToken)) as StoredSessionRecord | undefined;
    if (!row || row.revokedAt) return null;
    if (Date.now() > new Date(row.expiresAt).getTime()) return null;
    return row;
  }

  public revokeSession(rawToken: string): void {
    this.db
      .prepare(`UPDATE sessions SET revoked_at = ? WHERE token_hash = ?`)
      .run(new Date().toISOString(), sha256Hex(rawToken));
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
