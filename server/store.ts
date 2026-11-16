import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  AqarDatabaseState,
  ArchiveCategoryId,
  AuditLog,
  BackupCollectionDiff,
  BackupPreviewResult,
  BackupSnapshot,
  CommunicationLog,
  CommunicationTemplate,
  CompanyProfile,
  CompanySettings,
  CurrencyCode,
  DocumentAccessEntry,
  DocumentRecord,
  ExecutiveDecision,
  Expense,
  FavoriteReportPreset,
  HandoverInspection,
  Installment,
  JournalEntry,
  Lead,
  LeadEscalation,
  LeadEscalationChannel,
  LeadEscalationStatus,
  LeadInteraction,
  LeaseContract,
  LoginAuditEntry,
  LoginProfileSummary,
  MaintenanceTicket,
  NotificationItem,
  OcrEntityMatchResult,
  OcrExtractedData,
  OcrSyncSummary,
  Payment,
  PaymentAllocation,
  PaymentFrequency,
  PaymentMethod,
  PaymentType,
  PermissionKey,
  PermissionLevel,
  PermissionModuleKey,
  Property,
  PropertyBudget,
  PurchaseOrder,
  RecurringExpenseRule,
  ReminderChannel,
  ReminderDispatchLog,
  ReminderRule,
  RoleKey,
  SavedArchiveFilter,
  ScheduledReportConfig,
  SecurityPolicy,
  SharedSearchFilter,
  StaffNotificationPrefs,
  StaffSecurityConfig,
  StaffStatusState,
  StaffUser,
  SupplierInvoice,
  SupplierInvoiceStatus,
  SyncConflictRecord,
  TaskItem,
  Tenant,
  TenantBehaviorScores,
  TenantOnboardingChecklist,
  TenantViolationNote,
  Unit,
  UnitStatus,
  Vendor,
  VendorRatingBreakdown,
  ZatcaInvoiceRecord,
} from '../src/types/aqar';
import { createInitialSeed, DEFAULT_ROLE_PERMISSIONS } from './seed';
import {
  decryptBackupPayload,
  encryptBackupPayload,
  isEncryptedBackupEnvelope,
} from './cryptoAuth';
import { SqlitePersistence } from './sqlitePersistence';

const RATES_TO_SAR: Record<CurrencyCode, number> = {
  SAR: 1,
  AED: 1.021,
  USD: 3.75,
  EGP: 0.077,
  KWD: 12.22,
};

function toSar(amount: number, currency: CurrencyCode = 'SAR', rates?: Partial<Record<CurrencyCode, number>>): number {
  const rate = rates?.[currency] ?? RATES_TO_SAR[currency] ?? 1;
  return Math.round(amount * rate * 100) / 100;
}

function currencyLabelAr(currency: CurrencyCode = 'SAR'): string {
  switch (currency) {
    case 'AED':
      return 'د.إ';
    case 'USD':
      return '$';
    case 'EGP':
      return 'ج.م';
    case 'KWD':
      return 'د.ك';
    default:
      return 'ر.س';
  }
}

function getBaseDataDir(): string {
  return process.env.AQARPLUS_USER_DATA_DIR
    ? path.resolve(process.env.AQARPLUS_USER_DATA_DIR)
    : path.resolve(process.cwd(), 'data');
}

function getWorkspacePaths(workspaceId = 'default') {
  const base = getBaseDataDir();
  const dataDir = workspaceId === 'default' ? base : path.join(base, 'workspaces', workspaceId);
  return {
    dataDir,
    dbFile: path.join(dataDir, 'aqarplus.sqlite'),
    jsonFile: path.join(dataDir, 'aqarplus-db.json'),
    backupDir: path.join(dataDir, 'backups'),
    archiveDir: path.join(dataDir, 'archive'),
    documentsDir: path.join(dataDir, 'documents'),
  };
}

function ensureWorkspaceDirs(paths: ReturnType<typeof getWorkspacePaths>) {
  if (!fs.existsSync(paths.dataDir)) fs.mkdirSync(paths.dataDir, { recursive: true });
  if (!fs.existsSync(paths.backupDir)) fs.mkdirSync(paths.backupDir, { recursive: true });
  if (!fs.existsSync(paths.archiveDir)) fs.mkdirSync(paths.archiveDir, { recursive: true });
  if (!fs.existsSync(paths.documentsDir)) fs.mkdirSync(paths.documentsDir, { recursive: true });
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function pad4(n: number): string {
  return String(n).padStart(4, '0');
}

function pad3(n: number): string {
  return String(n).padStart(3, '0');
}

export interface ProvisionWorkspaceOptions {
  companyNameAr: string;
  companyNameEn?: string;
  adminNameAr: string;
  adminEmail: string;
  adminPhone?: string;
  password: string;
  pin?: string;
  deviceName?: string;
}

export class AqarStore {
  public readonly workspaceId: string;
  private readonly paths: ReturnType<typeof getWorkspacePaths>;
  private sqlite: SqlitePersistence;
  private state: AqarDatabaseState;
  private propIndex = new Map<string, Property>();
  private unitIndex = new Map<string, Unit>();
  private tenantIndex = new Map<string, Tenant>();
  private contractIndex = new Map<string, LeaseContract>();
  private idempotencyIndex = new Set<string>();

  public static workspaceExists(workspaceId: string): boolean {
    if (workspaceId === 'default') return true;
    const paths = getWorkspacePaths(workspaceId);
    return fs.existsSync(paths.dbFile);
  }

  constructor(workspaceId = 'default', provision?: ProvisionWorkspaceOptions) {
    this.workspaceId = workspaceId || 'default';
    this.paths = getWorkspacePaths(this.workspaceId);
    ensureWorkspaceDirs(this.paths);
    this.sqlite = new SqlitePersistence(this.paths.dataDir);
    if (provision) {
      this.state = this.initializeProvisionedWorkspace(provision);
    } else {
      this.state = this.loadInitialState();
      this.sqlite.ensureSeedCredentials(this.state.users);
    }
    this.rebuildIndexes();
  }

  public getPersistence(): SqlitePersistence {
    return this.sqlite;
  }

  public getSessionSecret(): string {
    return this.sqlite.getOrCreateSessionSecret();
  }

  public getLoginProfiles(): LoginProfileSummary[] {
    return this.state.users
      .filter((u) => u.active)
      .map((u) => ({
        id: u.id,
        nameAr: u.nameAr,
        nameEn: u.nameEn,
        email: u.email,
        role: u.role,
        roleLabelAr: u.roleLabelAr,
        roleLabelEn: u.roleLabelEn,
        hasPin: this.sqlite.getCredentialStatus(u.id).hasPin,
      }));
  }

  public authenticatePassword(identifier: string, password: string, deviceName?: string): StaffUser {
    const norm = (identifier || '').trim().toLowerCase();
    const user = this.state.users.find(
      (u) => u.id.toLowerCase() === norm || u.email.toLowerCase() === norm || u.phone === identifier.trim()
    );
    if (!user) {
      throw new Error('بيانات الدخول غير صحيحة');
    }
    if (!user.active) {
      throw new Error('تم إيقاف هذا الحساب من قِبل الإدارة');
    }
    if (user.security?.lockedUntil && new Date(user.security.lockedUntil).getTime() > Date.now()) {
      const waitSec = Math.ceil((new Date(user.security.lockedUntil).getTime() - Date.now()) / 1000);
      throw new Error(`تم قفل الحساب مؤقتاً لكثرة المحاولات الخاطئة. حاول بعد ${waitSec} ثانية.`);
    }
    if (!this.sqlite.verifyUserPassword(user.id, password)) {
      if (!user.security) user.security = {};
      user.security.failedAttempts = (user.security.failedAttempts || 0) + 1;
      if (user.security.failedAttempts >= 5) {
        user.security.lockedUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      }
      this.recordLoginEvent({
        userId: user.id,
        deviceName: deviceName || user.deviceName,
        method: 'كلمة المرور',
        success: false,
      });
      this.persist();
      throw new Error('كلمة المرور غير صحيحة');
    }
    if (user.security) {
      user.security.failedAttempts = 0;
      user.security.lockedUntil = undefined;
    }
    user.statusState = 'متصل';
    this.recordLoginEvent({
      userId: user.id,
      deviceName: deviceName || user.deviceName,
      method: 'كلمة المرور',
      success: true,
    });
    this.persist();
    return user;
  }

  public authenticatePin(userIdOrIdentifier: string, pin: string, deviceName?: string): StaffUser {
    const norm = (userIdOrIdentifier || '').trim().toLowerCase();
    const user = this.state.users.find(
      (u) => u.id.toLowerCase() === norm || u.email.toLowerCase() === norm || u.phone === userIdOrIdentifier.trim()
    );
    if (!user || !user.active) {
      throw new Error('الحساب غير متاح أو موقوف');
    }
    if (user.security?.lockedUntil && new Date(user.security.lockedUntil).getTime() > Date.now()) {
      const waitSec = Math.ceil((new Date(user.security.lockedUntil).getTime() - Date.now()) / 1000);
      throw new Error(`تم قفل الحساب مؤقتاً لكثرة المحاولات الخاطئة. حاول بعد ${waitSec} ثانية.`);
    }
    if (!this.sqlite.verifyUserPin(user.id, pin)) {
      if (!user.security) user.security = {};
      user.security.failedAttempts = (user.security.failedAttempts || 0) + 1;
      if (user.security.failedAttempts >= 5) {
        user.security.lockedUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString();
      }
      this.recordLoginEvent({
        userId: user.id,
        deviceName: deviceName || user.deviceName,
        method: 'بصمة / Face ID',
        success: false,
      });
      this.persist();
      throw new Error('رمز الدخول السريع (PIN) غير صحيح');
    }
    if (user.security) {
      user.security.failedAttempts = 0;
      user.security.lockedUntil = undefined;
    }
    user.statusState = 'متصل';
    this.recordLoginEvent({
      userId: user.id,
      deviceName: deviceName || user.deviceName,
      method: 'بصمة / Face ID',
      success: true,
    });
    this.persist();
    return user;
  }

  public updateUserCredentials(
    actorUserId: string,
    targetUserId: string,
    input: { currentPassword?: string; newPassword?: string; newPin?: string },
    deviceName?: string
  ): void {
    const actor = this.getActingUser(actorUserId);
    const isSelf = actor.id === targetUserId;
    if (!isSelf && actor.role !== 'sys_owner') {
      throw new Error('تعديل بيانات دخول موظف آخر حصري لمالك النظام');
    }
    if (isSelf && input.newPassword && input.currentPassword !== undefined) {
      if (!this.sqlite.verifyUserPassword(actor.id, input.currentPassword)) {
        throw new Error('كلمة المرور الحالية غير صحيحة');
      }
    }
    if (input.newPassword && input.newPassword.length < 6) {
      throw new Error('كلمة المرور الجديدة يجب أن لا تقل عن 6 أحرف');
    }
    if (input.newPin && !/^\d{4,6}$/.test(input.newPin)) {
      throw new Error('رمز الدخول السريع (PIN) يجب أن يتكون من 4 إلى 6 أرقام');
    }
    this.sqlite.updateUserCredentials(targetUserId, {
      password: input.newPassword,
      pin: input.newPin,
    });
    const target = this.state.users.find((u) => u.id === targetUserId);
    if (target) {
      target.security = {
        ...(target.security || {}),
        lastPasswordChangedAt: new Date().toISOString(),
        tempPasswordSet: !isSelf,
      };
    }
    this.addAudit(
      actor,
      'تحديث بيانات الأمان والدخول',
      'StaffUser',
      targetUserId,
      isSelf ? 'تحديث كلمة المرور / رمز PIN الشخصي' : `إعادة تعيين بيانات الدخول للموظف ${target?.nameAr || targetUserId}`,
      { deviceName }
    );
    this.persist();
  }

  public bumpEntityRevision(entityKey: string): number {
    if (!this.state.entityRevisions) this.state.entityRevisions = {};
    const next = (this.state.entityRevisions[entityKey] || 1) + 1;
    this.state.entityRevisions[entityKey] = next;
    return next;
  }

  private rebuildIndexes() {
    this.propIndex = new Map(this.state.properties.map((p) => [p.id, p]));
    this.unitIndex = new Map(this.state.units.map((u) => [u.id, u]));
    this.tenantIndex = new Map(this.state.tenants.map((t) => [t.id, t]));
    this.contractIndex = new Map(this.state.contracts.map((c) => [c.id, c]));
    this.idempotencyIndex = new Set(this.state.processedIdempotencyKeys || []);
  }

  private runTransaction<T>(fn: () => T): T {
    const snapshot = structuredClone(this.state);
    try {
      const result = fn();
      this.rebuildIndexes();
      return result;
    } catch (err) {
      this.state = snapshot;
      this.rebuildIndexes();
      throw err;
    }
  }

  private normalizeParsedState(parsed: Partial<AqarDatabaseState>, seed: AqarDatabaseState): AqarDatabaseState {
    const mergeMissingById = <T extends { id: string }>(existing: T[] = [], seedItems: T[] = []): T[] => {
      const seen = new Set(existing.map((x) => x.id));
      return [...existing, ...seedItems.filter((item) => !seen.has(item.id))];
    };
    const parsedUsers = Array.isArray(parsed.users) ? parsed.users : seed.users;
    const parsedProperties = Array.isArray(parsed.properties) ? parsed.properties : seed.properties;
    const shouldSeedArchive = !parsed.archiveSeeded && parsedProperties.length > 0;
    const shouldSeedTeam = !parsed.teamSeeded && parsedUsers.length > 0;
    const mergedUsers: StaffUser[] = shouldSeedTeam
      ? [
          ...parsedUsers.map((u) => {
            const seedMatch = seed.users.find((su) => su.id === u.id);
            return {
              ...seedMatch,
              ...u,
              statusState: u.statusState || seedMatch?.statusState || 'متصل',
              specialty: u.specialty || seedMatch?.specialty,
              managerRating: u.managerRating ?? seedMatch?.managerRating ?? 4.8,
              lastActivitySummary: u.lastActivitySummary || seedMatch?.lastActivitySummary,
              security: u.security || seedMatch?.security,
              notificationPrefs: u.notificationPrefs || seedMatch?.notificationPrefs,
            };
          }),
          ...seed.users.filter((su) => !parsedUsers.some((pu) => pu.id === su.id)),
        ]
      : parsedUsers;
    const mergedRolePermissions: Record<RoleKey, PermissionKey[]> = {
      ...DEFAULT_ROLE_PERMISSIONS,
      ...(parsed.rolePermissions || {}),
    };
    return {
      ...seed,
      ...parsed,
      users: mergedUsers,
      rolePermissions: mergedRolePermissions,
      properties: parsedProperties,
      units: shouldSeedArchive ? mergeMissingById(parsed.units || [], seed.units) : parsed.units || seed.units,
      payments: shouldSeedArchive ? mergeMissingById(parsed.payments || [], seed.payments) : parsed.payments || seed.payments,
      tickets: shouldSeedArchive ? mergeMissingById(parsed.tickets || [], seed.tickets) : parsed.tickets || seed.tickets,
      tasks: shouldSeedArchive ? mergeMissingById(parsed.tasks || [], seed.tasks) : parsed.tasks || seed.tasks,
      documents: shouldSeedArchive ? mergeMissingById(parsed.documents || [], seed.documents) : parsed.documents || seed.documents,
      savedArchiveFilters:
        Array.isArray(parsed.savedArchiveFilters) && parsed.savedArchiveFilters.length > 0
          ? parsed.savedArchiveFilters
          : shouldSeedArchive
          ? seed.savedArchiveFilters
          : [],
      archiveLastNightlyRun: parsed.archiveLastNightlyRun || seed.archiveLastNightlyRun,
      archiveSeeded: parsed.archiveSeeded ?? true,
      securityPolicy: parsed.securityPolicy || seed.securityPolicy,
      loginHistory:
        this.workspaceId !== 'default'
          ? Array.isArray(parsed.loginHistory)
            ? parsed.loginHistory
            : []
          : Array.isArray(parsed.loginHistory) && parsed.loginHistory.length > 0
          ? parsed.loginHistory
          : seed.loginHistory,
      syncConflicts:
        this.workspaceId !== 'default'
          ? Array.isArray(parsed.syncConflicts)
            ? parsed.syncConflicts
            : []
          : Array.isArray(parsed.syncConflicts) && parsed.syncConflicts.length > 0
          ? parsed.syncConflicts
          : seed.syncConflicts,
      teamSeeded: parsed.teamSeeded ?? true,
      settings: {
        ...seed.settings,
        ...(parsed.settings || {}),
        currencyRatesToSar: {
          ...seed.settings.currencyRatesToSar,
          ...(parsed.settings?.currencyRatesToSar || {}),
        } as Record<CurrencyCode, number>,
        bankAccounts:
          Array.isArray(parsed.settings?.bankAccounts) && parsed.settings.bankAccounts.length > 0
            ? parsed.settings.bankAccounts
            : seed.settings.bankAccounts,
        receiptBranding: {
          ...seed.settings.receiptBranding!,
          ...(parsed.settings?.receiptBranding || {}),
        },
        generalPrefs: {
          ...seed.settings.generalPrefs!,
          ...(parsed.settings?.generalPrefs || {}),
        },
        securityCenter: {
          ...seed.settings.securityCenter!,
          ...(parsed.settings?.securityCenter || {}),
        },
        notificationsCenter: {
          ...seed.settings.notificationsCenter!,
          ...(parsed.settings?.notificationsCenter || {}),
        },
        printShare: {
          ...seed.settings.printShare!,
          ...(parsed.settings?.printShare || {}),
        },
        backupPolicy: {
          ...seed.settings.backupPolicy!,
          ...(parsed.settings?.backupPolicy || {}),
        },
        syncCenter: {
          ...seed.settings.syncCenter!,
          ...(parsed.settings?.syncCenter || {}),
        },
        developerCenter: {
          ...seed.settings.developerCenter!,
          ...(parsed.settings?.developerCenter || {}),
        },
      },
      companies: Array.isArray(parsed.companies) && parsed.companies.length > 0 ? parsed.companies : seed.companies,
      vendors: (parsed.vendors || seed.vendors).map((v) => {
        const seedV = seed.vendors.find((sv) => sv.id === v.id);
        return { ...seedV, ...v };
      }),
      tenants: (shouldSeedArchive ? mergeMissingById(parsed.tenants || [], seed.tenants) : parsed.tenants || seed.tenants).map((t) => {
        const seedT = seed.tenants.find((st) => st.id === t.id);
        return { ...seedT, ...t };
      }),
      contracts: (shouldSeedArchive ? mergeMissingById(parsed.contracts || [], seed.contracts) : parsed.contracts || seed.contracts).map((c) => {
        const seedC = seed.contracts.find((sc) => sc.id === c.id);
        return { ...seedC, ...c };
      }),
      leads: (parsed.leads || seed.leads).map((l) => {
        const seedL = seed.leads.find((sl) => sl.id === l.id);
        return { ...seedL, ...l };
      }),
      leadEscalations:
        Array.isArray(parsed.leadEscalations) && parsed.leadEscalations.length > 0
          ? parsed.leadEscalations
          : seed.leadEscalations,
      supplierInvoices:
        Array.isArray(parsed.supplierInvoices) && parsed.supplierInvoices.length > 0
          ? parsed.supplierInvoices
          : seed.supplierInvoices,
      recurringExpenses:
        Array.isArray(parsed.recurringExpenses) && parsed.recurringExpenses.length > 0
          ? parsed.recurringExpenses
          : seed.recurringExpenses,
      propertyBudgets:
        Array.isArray(parsed.propertyBudgets) && parsed.propertyBudgets.length > 0
          ? parsed.propertyBudgets
          : seed.propertyBudgets,
      purchaseOrders: Array.isArray(parsed.purchaseOrders) ? parsed.purchaseOrders : seed.purchaseOrders,
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions : seed.decisions,
      reminderRules: Array.isArray(parsed.reminderRules) ? parsed.reminderRules : seed.reminderRules,
      reminderLogs: Array.isArray(parsed.reminderLogs) ? parsed.reminderLogs : seed.reminderLogs,
      communicationTemplates:
        Array.isArray(parsed.communicationTemplates) && parsed.communicationTemplates.length > 0
          ? parsed.communicationTemplates
          : seed.communicationTemplates,
      meterReadings:
        this.workspaceId !== 'default'
          ? Array.isArray(parsed.meterReadings)
            ? parsed.meterReadings
            : []
          : Array.isArray(parsed.meterReadings) && parsed.meterReadings.length > 0
          ? parsed.meterReadings
          : seed.meterReadings,
      scheduledReports: Array.isArray(parsed.scheduledReports) ? parsed.scheduledReports : [],
      favoriteReports: Array.isArray(parsed.favoriteReports) ? parsed.favoriteReports : [],
      sharedSearchFilters: Array.isArray(parsed.sharedSearchFilters) ? parsed.sharedSearchFilters : [],
      zatcaInvoices: Array.isArray(parsed.zatcaInvoices) ? parsed.zatcaInvoices : [],
      syncRevision: typeof parsed.syncRevision === 'number' ? parsed.syncRevision : 1,
      entityRevisions: parsed.entityRevisions || {},
    };
  }

  private initializeProvisionedWorkspace(input: ProvisionWorkspaceOptions): AqarDatabaseState {
    const existing = this.sqlite.loadState();
    if (existing && Array.isArray(existing.users) && existing.users.length > 0) {
      throw new Error('مساحة العمل هذه مفعّلة مسبقاً — اختر معرّف شركة مختلفاً أو سجّل الدخول');
    }
    const base = createInitialSeed();
    const now = new Date().toISOString();
    const companyEn = (input.companyNameEn || input.companyNameAr || 'AqarPlus Workspace').trim();
    const adminId = `usr-${this.workspaceId}-owner`;
    const adminUser: StaffUser = {
      id: adminId,
      companyId: `comp-${this.workspaceId}`,
      nameAr: input.adminNameAr.trim(),
      nameEn: input.adminNameAr.trim(),
      email: input.adminEmail.trim().toLowerCase(),
      phone: (input.adminPhone || '').trim(),
      role: 'sys_owner',
      roleLabelAr: 'مالك النظام',
      roleLabelEn: 'System Owner',
      approvalLimitSar: 10000000,
      deviceName: input.deviceName || 'Web Terminal',
      lastActiveAt: now,
      statusState: 'متصل',
      active: true,
      security: {
        hasPin: Boolean(input.pin),
        lastPasswordChangedAt: now,
      },
    };
    const fresh: AqarDatabaseState = {
      ...base,
      settings: {
        ...base.settings,
        nameAr: input.companyNameAr.trim(),
        nameEn: companyEn,
        email: adminUser.email,
        phone: adminUser.phone,
      },
      companies: [
        {
          id: `comp-${this.workspaceId}`,
          nameAr: input.companyNameAr.trim(),
          nameEn: companyEn,
          city: base.settings.city,
          vatNumber: '',
          crNumber: '',
          address: base.settings.address || '',
          phone: adminUser.phone,
          email: adminUser.email,
          bankName: base.settings.bankAccounts?.[0]?.bankName || '',
          iban: base.settings.bankAccounts?.[0]?.iban || '',
          receiptFooterAr: '',
          isDefault: true,
        },
      ],
      users: [adminUser],
      properties: [],
      units: [],
      meterReadings: [],
      owners: [],
      vendors: [],
      tenants: [],
      leads: [],
      leadEscalations: [],
      contracts: [],
      handovers: [],
      installments: [],
      payments: [],
      journals: [],
      expenses: [],
      supplierInvoices: [],
      recurringExpenses: [],
      propertyBudgets: [],
      assets: [],
      tickets: [],
      tasks: [],
      communications: [],
      documents: [],
      purchaseOrders: [],
      decisions: [],
      notifications: [],
      reminderLogs: [],
      auditLogs: [],
      backups: [],
      loginHistory: [],
      syncConflicts: [],
      zatcaInvoices: [],
      archiveSeeded: true,
      teamSeeded: true,
      rolePermissions: JSON.parse(JSON.stringify(DEFAULT_ROLE_PERMISSIONS)),
      counters: {
        receipt: 0,
        expense: 0,
        ticket: 0,
        journal: 0,
        contract: 0,
      },
      processedIdempotencyKeys: [],
      entityRevisions: {},
      syncRevision: 1,
      lastUpdatedAt: now,
    };
    this.sqlite.saveState(fresh);
    const randomPin = crypto.randomInt(100000, 999999).toString();
    this.sqlite.updateUserCredentials(adminId, {
      password: input.password,
      pin: input.pin || randomPin,
    });
    return fresh;
  }

  private loadInitialState(): AqarDatabaseState {
    const seed = createInitialSeed();
    try {
      const fromSqlite = this.sqlite.loadState();
      if (fromSqlite && Array.isArray(fromSqlite.properties) && Array.isArray(fromSqlite.users)) {
        return this.normalizeParsedState(fromSqlite, seed);
      }

      if (this.workspaceId === 'default' && fs.existsSync(this.paths.jsonFile)) {
        const raw = fs.readFileSync(this.paths.jsonFile, 'utf-8');
        const parsed = JSON.parse(raw) as AqarDatabaseState;
        if (parsed && Array.isArray(parsed.properties) && Array.isArray(parsed.users)) {
          const normalized = this.normalizeParsedState(parsed, seed);
          this.sqlite.saveState(normalized);
          try {
            fs.copyFileSync(this.paths.jsonFile, `${this.paths.jsonFile}.migrated.bak`);
          } catch {
            // ignore backup failure during migration
          }
          return normalized;
        }
      }
    } catch (err) {
      console.error('Failed to load SQLite/JSON DB, initializing seed:', err);
    }
    this.persist(seed);
    return seed;
  }

  private persist(nextState: AqarDatabaseState = this.state) {
    ensureWorkspaceDirs(this.paths);
    nextState.syncRevision = (nextState.syncRevision || 0) + 1;
    nextState.lastUpdatedAt = new Date().toISOString();
    this.sqlite.saveState(nextState);
    if (nextState === this.state) {
      this.rebuildIndexes();
    }
  }

  public getState(): AqarDatabaseState {
    return this.state;
  }

  private sanitizeUsersForActor(actor: StaffUser): StaffUser[] {
    const canManageUsers = this.userHasPermission(actor, 'manage_users');
    if (canManageUsers) {
      return this.state.users;
    }
    return this.state.users.map((u) => ({
      id: u.id,
      nameAr: u.nameAr,
      nameEn: u.nameEn,
      role: u.role,
      roleLabelAr: u.roleLabelAr,
      roleLabelEn: u.roleLabelEn,
      email: u.id === actor.id ? u.email : '',
      phone: u.id === actor.id ? u.phone : '',
      approvalLimitSar: u.id === actor.id ? u.approvalLimitSar : 0,
      active: u.active,
      ownerId: u.id === actor.id ? u.ownerId : undefined,
      deviceName: u.id === actor.id ? u.deviceName : '',
      lastActiveAt: u.lastActiveAt,
      statusState: u.statusState,
      specialty: u.specialty,
      notificationPrefs: u.id === actor.id ? u.notificationPrefs : undefined,
    }));
  }

  public getStateForUser(userId?: string): AqarDatabaseState {
    if (!userId) {
      throw new Error('يجب تسجيل الدخول للوصول إلى البيانات');
    }
    const user = this.state.users.find((u) => u.id === userId && u.active);
    if (!user) {
      throw new Error('المستخدم غير مصرح له أو موقوف');
    }

    const canViewAudit = this.userHasPermission(user, 'view_audit');
    const canBackup = this.userHasPermission(user, 'backup_restore');
    const sanitizedUsers = this.sanitizeUsersForActor(user);

    // Property-level isolation for staff members when allowedPropertyIds is restricted
    if (user.role !== 'owner' && user.role !== 'gm' && user.role !== 'sys_owner') {
      const allowedProps = user.allowedPropertyIds;
      if (Array.isArray(allowedProps) && allowedProps.length > 0) {
        const propSet = new Set(allowedProps);
        const unitSet = new Set(this.state.units.filter((u) => propSet.has(u.propertyId)).map((u) => u.id));
        const ctrSet = new Set(this.state.contracts.filter((c) => propSet.has(c.propertyId)).map((c) => c.id));
        const tenantSet = new Set(
          this.state.contracts.filter((c) => propSet.has(c.propertyId)).map((c) => c.tenantId)
        );
        return {
          ...this.state,
          users: sanitizedUsers,
          auditLogs: canViewAudit
            ? this.state.auditLogs.filter((a) => !a.propertyId || propSet.has(a.propertyId))
            : [],
          loginHistory: canViewAudit ? this.state.loginHistory : [],
          backups: canBackup ? this.state.backups : [],
          properties: this.state.properties.filter((p) => propSet.has(p.id)),
          units: this.state.units.filter((u) => unitSet.has(u.id)),
          tenants: this.state.tenants.filter((t) => tenantSet.has(t.id)),
          contracts: this.state.contracts.filter((c) => ctrSet.has(c.id)),
          handovers: this.state.handovers.filter((h) => propSet.has(h.propertyId)),
          installments: this.state.installments.filter((i) => propSet.has(i.propertyId)),
          payments: this.state.payments.filter((p) => propSet.has(p.propertyId)),
          expenses: this.state.expenses.filter((e) => propSet.has(e.propertyId)),
          supplierInvoices: (this.state.supplierInvoices || []).filter((si) => propSet.has(si.propertyId)),
          propertyBudgets: (this.state.propertyBudgets || []).filter((pb) => propSet.has(pb.propertyId)),
          tickets: this.state.tickets.filter((t) => propSet.has(t.propertyId)),
          tasks: this.state.tasks.filter((t) => !t.propertyId || propSet.has(t.propertyId) || t.assignedTo === user.id),
          leads: this.state.leads.filter((l) => propSet.has(l.propertyId)),
          leadEscalations: (this.state.leadEscalations || []).filter((le) => propSet.has(le.propertyId)),
          meterReadings: (this.state.meterReadings || []).filter((mr) => propSet.has(mr.propertyId)),
          documents: this.state.documents.filter(
            (d) =>
              d.relatedType === 'شركة' ||
              (d.relatedType === 'عقار' && propSet.has(d.relatedId)) ||
              (d.relatedType === 'وحدة' && unitSet.has(d.relatedId)) ||
              (d.relatedType === 'عقد' && ctrSet.has(d.relatedId)) ||
              (d.relatedType === 'مستأجر' && tenantSet.has(d.relatedId))
          ),
        };
      }
      return {
        ...this.state,
        users: sanitizedUsers,
        auditLogs: canViewAudit ? this.state.auditLogs : [],
        loginHistory: canViewAudit ? this.state.loginHistory : [],
        backups: canBackup ? this.state.backups : [],
      };
    }

    if (user.role !== 'owner' || !user.ownerId) {
      return {
        ...this.state,
        users: sanitizedUsers,
        auditLogs: canViewAudit ? this.state.auditLogs : [],
        loginHistory: canViewAudit ? this.state.loginHistory : [],
        backups: canBackup ? this.state.backups : [],
      };
    }
    // Owner isolation: owner can ONLY see properties they own and related records
    const ownedPropIds = new Set(
      this.state.properties
        .filter((p) => p.ownerShares.some((s) => s.ownerId === user.ownerId))
        .map((p) => p.id)
    );
    const ownedUnitIds = new Set(
      this.state.units.filter((u) => ownedPropIds.has(u.propertyId)).map((u) => u.id)
    );
    const ownedContractIds = new Set(
      this.state.contracts.filter((c) => ownedPropIds.has(c.propertyId)).map((c) => c.id)
    );
    const ownedTenantIds = new Set(
      this.state.contracts.filter((c) => ownedPropIds.has(c.propertyId)).map((c) => c.tenantId)
    );

    return {
      ...this.state,
      users: sanitizedUsers,
      properties: this.state.properties.filter((p) => ownedPropIds.has(p.id)),
      units: this.state.units.filter((u) => ownedUnitIds.has(u.id)),
      contracts: this.state.contracts.filter((c) => ownedContractIds.has(c.id)),
      handovers: this.state.handovers.filter((h) => ownedPropIds.has(h.propertyId)),
      installments: this.state.installments.filter((i) => ownedPropIds.has(i.propertyId)),
      payments: this.state.payments.filter((p) => ownedPropIds.has(p.propertyId)),
      expenses: this.state.expenses.filter((e) => ownedPropIds.has(e.propertyId) && e.approvalStatus === 'معتمد'),
      supplierInvoices: (this.state.supplierInvoices || []).filter((si) => ownedPropIds.has(si.propertyId)),
      propertyBudgets: (this.state.propertyBudgets || []).filter((pb) => ownedPropIds.has(pb.propertyId)),
      tickets: this.state.tickets.filter((t) => ownedPropIds.has(t.propertyId)),
      leads: this.state.leads.filter((l) => ownedPropIds.has(l.propertyId)),
      leadEscalations: (this.state.leadEscalations || []).filter((le) => ownedPropIds.has(le.propertyId)),
      meterReadings: (this.state.meterReadings || []).filter((mr) => ownedPropIds.has(mr.propertyId)),
      owners: this.state.owners.filter((o) => o.id === user.ownerId),
      tenants: this.state.tenants.filter((t) => ownedTenantIds.has(t.id)),
      documents: this.state.documents.filter(
        (d) =>
          (d.relatedType === 'عقار' && ownedPropIds.has(d.relatedId)) ||
          (d.relatedType === 'وحدة' && ownedUnitIds.has(d.relatedId)) ||
          (d.relatedType === 'عقد' && ownedContractIds.has(d.relatedId)) ||
          (d.relatedType === 'مستأجر' && ownedTenantIds.has(d.relatedId))
      ),
      auditLogs: [],
      loginHistory: [],
      backups: [],
    };
  }

  private getActingUser(userId: string): StaffUser {
    const user = this.state.users.find((u) => u.id === userId && u.active);
    if (!user) throw new Error('المستخدم غير موجود أو موقوف');
    return user;
  }

  private userHasPermission(user: StaffUser, permission: PermissionKey): boolean {
    const perms = this.state.rolePermissions[user.role] || [];
    return perms.includes('view_all') || perms.includes(permission);
  }

  private assertPermission(userId: string, permission: PermissionKey): StaffUser {
    const user = this.getActingUser(userId);
    const perms = this.state.rolePermissions[user.role] || [];
    if (!perms.includes(permission)) {
      throw new Error(`لا تملك صلاحية تنفيذ هذا الإجراء (${permission})`);
    }
    return user;
  }

  private addAudit(
    user: StaffUser,
    action: string,
    entityType: string,
    entityId: string,
    summary: string,
    opts?: {
      oldValue?: string;
      newValue?: string;
      reason?: string;
      deviceName?: string;
      ipAddress?: string;
      geoLocation?: string;
      propertyId?: string;
    }
  ) {
    const now = new Date().toISOString();
    user.lastActiveAt = now;
    user.lastActivitySummary = summary;
    const entry: AuditLog = {
      id: uid('aud'),
      userId: user.id,
      userName: user.nameAr,
      userRole: user.roleLabelAr,
      deviceName: opts?.deviceName || user.deviceName,
      ipAddress: opts?.ipAddress || '192.168.10.1',
      geoLocation: opts?.geoLocation || 'الرياض · المملكة العربية السعودية',
      propertyId: opts?.propertyId,
      action,
      entityType,
      entityId,
      summary,
      oldValue: opts?.oldValue,
      newValue: opts?.newValue,
      reason: opts?.reason,
      createdAt: now,
    };
    this.state.auditLogs.unshift(entry);
    if (this.state.auditLogs.length > 500) {
      this.state.auditLogs = this.state.auditLogs.slice(0, 500);
    }
  }

  private addNotification(
    titleAr: string,
    titleEn: string,
    messageAr: string,
    messageEn: string,
    category: 'مالية' | 'تشغيلية' | 'إدارية',
    targetRoles: RoleKey[],
    relatedView?: string
  ) {
    const item: NotificationItem = {
      id: uid('not'),
      titleAr,
      titleEn,
      messageAr,
      messageEn,
      category,
      targetRoles,
      relatedView,
      isReadBy: [],
      createdAt: new Date().toISOString(),
    };
    this.state.notifications.unshift(item);
    if (this.state.notifications.length > 100) {
      this.state.notifications = this.state.notifications.slice(0, 100);
    }
  }

  // 1. Properties & Units
  public createProperty(userId: string, input: Omit<Property, 'id' | 'createdAt'>, deviceName?: string): Property {
    const user = this.assertPermission(userId, 'manage_properties');
    const prop: Property = {
      ...input,
      id: uid('prop'),
      createdAt: new Date().toISOString(),
    };
    this.state.properties.push(prop);
    this.addAudit(user, 'إضافة عقار جديد', 'Property', prop.id, `إضافة العقار ${prop.nameAr} (${prop.code})`, {
      deviceName,
      newValue: prop.status,
    });
    this.persist();
    return prop;
  }

  public createUnit(userId: string, input: Omit<Unit, 'id'>, deviceName?: string): Unit {
    const user = this.assertPermission(userId, 'manage_properties');
    const prop = this.state.properties.find((p) => p.id === input.propertyId);
    if (!prop) throw new Error('العقار المحدد غير موجود');
    const duplicate = this.state.units.find(
      (u) => u.propertyId === input.propertyId && u.unitNumber.trim() === input.unitNumber.trim()
    );
    if (duplicate) throw new Error('رقم الوحدة مسجل مسبقاً في هذا العقار');

    const unit: Unit = {
      ...input,
      id: uid('unit'),
    };
    this.state.units.push(unit);
    this.addAudit(user, 'إضافة وحدة جديدة', 'Unit', unit.id, `إضافة الوحدة ${unit.unitNumber} في ${prop.nameAr}`, {
      deviceName,
      newValue: unit.status,
    });
    this.persist();
    return unit;
  }

  public updateUnitStatus(
    userId: string,
    unitId: string,
    status: UnitStatus,
    reason?: string,
    deviceName?: string
  ): Unit {
    const user = this.assertPermission(userId, 'manage_properties');
    const unit = this.state.units.find((u) => u.id === unitId);
    if (!unit) throw new Error('الوحدة غير موجودة');

    // Business Rule: Cannot make a leased unit vacant just by flipping status if active contract exists without handover!
    const hasActiveContract = this.state.contracts.some(
      (c) => c.unitId === unitId && (c.lifecycleStatus === 'نشط' || c.lifecycleStatus === 'بانتظار التجديد')
    );
    if (status === 'شاغرة' && hasActiveContract) {
      throw new Error('لا يمكن تحويل الوحدة إلى شاغرة مع وجود عقد نشط؛ يجب إتمام إجراء الإخلاء ومحضر الاستلام أولاً');
    }

    const oldStatus = unit.status;
    unit.status = status;
    if (status === 'موقوفة' || status === 'مؤرشفة') {
      unit.preArchiveStatus = oldStatus;
      unit.archivedAt = new Date().toISOString();
      unit.archivedBy = user.id;
      unit.archiveMode = 'تلقائي';
      unit.archiveReason = reason || (status === 'مؤرشفة' ? 'أرشفة وحدة عقارية' : 'إيقاف الوحدة مؤقتاً');
    } else if (unit.archivedAt) {
      unit.archivedAt = undefined;
      unit.archiveReason = undefined;
      unit.archivedBy = undefined;
      unit.archiveMode = undefined;
    }
    if (status === 'شاغرة') {
      unit.linkedTenantId = undefined;
      unit.vacantSince = new Date().toISOString().slice(0, 10);
    }
    this.addAudit(user, 'تغيير حالة وحدة', 'Unit', unit.id, `تحديث حالة الوحدة ${unit.unitNumber} من ${oldStatus} إلى ${status}`, {
      oldValue: oldStatus,
      newValue: status,
      reason,
      deviceName,
    });
    this.persist();
    return unit;
  }

  public linkTenantToUnit(userId: string, unitId: string, tenantId: string, deviceName?: string): Unit {
    const user = this.assertPermission(userId, 'manage_tenants');
    const unit = this.state.units.find((u) => u.id === unitId);
    const tenant = this.state.tenants.find((t) => t.id === tenantId);
    if (!unit || !tenant) throw new Error('الوحدة أو المستأجر غير موجود');
    if (unit.status === 'مؤجرة') throw new Error('الوحدة مؤجرة حالياً بعقد ساري');

    const oldVal = unit.status;
    unit.linkedTenantId = tenant.id;
    if (unit.status === 'شاغرة' || unit.status === 'تحتاج إلى تنظيف') {
      unit.status = 'محجوزة';
    }
    // Business Rule: Linking tenant to unit NEVER auto-creates a contract!
    this.addAudit(
      user,
      'ربط إداري لمستأجر بوحدة',
      'Unit',
      unit.id,
      `ربط المستأجر ${tenant.nameAr} بالوحدة ${unit.unitNumber} كحجز إداري (دون إنشاء عقد تلقائي)`,
      { oldValue: oldVal, newValue: unit.status, deviceName }
    );
    this.persist();
    return unit;
  }

  // 2. Tenants & Leads
  public createTenant(userId: string, input: Omit<Tenant, 'id' | 'createdAt'>, deviceName?: string): Tenant {
    const user = this.assertPermission(userId, 'manage_tenants');
    const dup = this.state.tenants.find((t) => t.nationalIdOrIqama.trim() === input.nationalIdOrIqama.trim());
    if (dup) {
      throw new Error(`تنبيه تكرار: رقم الهوية/الإقامة مسجل مسبقاً باسم ${dup.nameAr}`);
    }
    const tenant: Tenant = {
      ...input,
      id: uid('ten'),
      createdAt: new Date().toISOString(),
    };
    this.state.tenants.push(tenant);
    this.addAudit(user, 'تسجيل مستأجر جديد', 'Tenant', tenant.id, `إضافة ملف المستأجر ${tenant.nameAr}`, {
      deviceName,
      newValue: tenant.nationalIdOrIqama,
    });
    this.persist();
    return tenant;
  }

  public deleteTenant(userId: string, tenantId: string, deviceName?: string): void {
    const user = this.assertPermission(userId, 'manage_tenants');
    const tenant = this.state.tenants.find((t) => t.id === tenantId);
    if (!tenant) throw new Error('المستأجر غير موجود');

    const hasActiveContract = this.state.contracts.some(
      (c) => c.tenantId === tenantId && (c.lifecycleStatus === 'نشط' || c.lifecycleStatus === 'بانتظار التوثيق')
    );
    if (hasActiveContract) {
      throw new Error('قاعدة حماية: يوجد عقد نشط لهذا المستأجر؛ يجب إنهاء العقد أولاً قبل الأرشفة');
    }
    // Golden rule: Nothing is ever permanently deleted; everything is archived
    const prev = tenant.classification;
    tenant.preArchiveStatus = prev;
    tenant.classification = 'سابق';
    tenant.archivedAt = new Date().toISOString();
    tenant.archivedBy = user.id;
    tenant.archiveMode = 'يدوي';
    tenant.archiveReason = tenant.archiveReason || 'نقل لأرشيف المستأجرين السابقين';
    this.addAudit(user, 'نقل مستأجر للأرشيف الذكي', 'Tenant', tenantId, `أرشفة ملف المستأجر ${tenant.nameAr}`, {
      oldValue: prev,
      newValue: 'سابق (مؤرشف)',
      deviceName,
    });
    this.persist();
  }

  public createLead(userId: string, input: Omit<Lead, 'id'>, deviceName?: string): Lead {
    const user = this.assertPermission(userId, 'manage_contracts');
    const now = new Date().toISOString();
    const lead: Lead = {
      ...input,
      id: uid('lead'),
      approvalState: input.approvalState || 'لم يُرسل',
      rating: input.rating ?? 4,
      createdAt: input.createdAt || now,
      updatedAt: now,
      interactions: input.interactions || [
        {
          id: uid('lint'),
          type: 'visit',
          direction: 'inbound',
          summary: `تسجيل مهتم جديد (${input.source || 'إدخال يدوي'})`,
          actorName: user.nameAr,
          createdAt: now,
        },
      ],
    };
    this.state.leads.unshift(lead);
    this.addAudit(user, 'تسجيل عميل محتمل', 'Lead', lead.id, `تسجيل استفسار/معاينة للعميل ${lead.nameAr}`, {
      propertyId: lead.propertyId,
      deviceName,
    });
    this.persist();
    return lead;
  }

  // 3. Contracts & Installment Schedule
  public createContract(
    userId: string,
    input: Omit<LeaseContract, 'id' | 'internalNumber' | 'version' | 'createdBy' | 'createdAt' | 'installmentsCount'>,
    deviceName?: string
  ): { contract: LeaseContract; installments: Installment[] } {
    return this.runTransaction(() => {
    const user = this.assertPermission(userId, 'manage_contracts');
    const unit = this.unitIndex.get(input.unitId) || this.state.units.find((u) => u.id === input.unitId);
    const tenant = this.tenantIndex.get(input.tenantId) || this.state.tenants.find((t) => t.id === input.tenantId);
    if (!unit || !tenant) throw new Error('الوحدة أو المستأجر غير موجود');

    const activeOnUnit = this.state.contracts.find(
      (c) => c.unitId === unit.id && (c.lifecycleStatus === 'نشط' || c.lifecycleStatus === 'بانتظار التوثيق')
    );
    if (activeOnUnit) {
      throw new Error(`يوجد عقد ساري أو قيد التوثيق بالفعل على الوحدة ${unit.unitNumber} (${activeOnUnit.internalNumber})`);
    }

    this.state.counters.contract += 1;
    const freqMap: Record<string, number> = {
      شهري: 12,
      'ربع سنوي': 4,
      'نصف سنوي': 2,
      سنوي: 1,
    };
    const count = freqMap[input.paymentFrequency] || 2;

    const contractCurrency: CurrencyCode = input.currency || this.state.settings.baseCurrency || 'SAR';
    const contract: LeaseContract = {
      ...input,
      currency: contractCurrency,
      id: uid('ctr'),
      internalNumber: `CNT-2026-${pad3(this.state.counters.contract)}`,
      installmentsCount: count,
      version: 1,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };
    this.state.contracts.unshift(contract);

    // Update unit & tenant classification if active
    if (contract.lifecycleStatus === 'نشط') {
      unit.status = 'مؤجرة';
      unit.linkedTenantId = undefined;
      tenant.classification = 'نشط';
    } else if (contract.lifecycleStatus === 'بانتظار التوثيق') {
      unit.status = 'قيد التأجير';
      unit.linkedTenantId = tenant.id;
    }

    // Generate installment schedule
    const start = new Date(contract.startDate);
    const perInst = Math.round((contract.annualRent / count) * 100) / 100;
    const createdInstallments: Installment[] = [];
    const todayStr = new Date().toISOString().slice(0, 10);

    for (let i = 0; i < count; i++) {
      const due = new Date(start);
      due.setMonth(due.getMonth() + i * (12 / count));
      const dueStr = due.toISOString().slice(0, 10);
      const amt = i === count - 1 ? Math.round((contract.annualRent - perInst * (count - 1)) * 100) / 100 : perInst;
      const status = dueStr < todayStr ? 'متأخرة' : dueStr === todayStr ? 'مستحقة اليوم' : 'لم تستحق';
      const inst: Installment = {
        id: uid('inst'),
        contractId: contract.id,
        unitId: contract.unitId,
        propertyId: contract.propertyId,
        tenantId: contract.tenantId,
        installmentNumber: i + 1,
        dueDate: dueStr,
        amount: amt,
        paidAmount: 0,
        remainingAmount: amt,
        currency: contractCurrency,
        status,
      };
      this.state.installments.push(inst);
      createdInstallments.push(inst);
    }

    this.addAudit(
      user,
      'إنشاء عقد إيجار',
      'LeaseContract',
      contract.id,
      `إنشاء العقد ${contract.internalNumber} للوحدة ${unit.unitNumber} (${contract.lifecycleStatus} · إيجار: ${contract.ejarStatus})`,
      { deviceName, newValue: contract.lifecycleStatus }
    );
    this.addNotification(
      `تم تسجيل عقد ${contract.internalNumber}`,
      `Contract ${contract.internalNumber} created`,
      `الوحدة ${unit.unitNumber} للمستأجر ${tenant.nameAr} بقيمة ${contract.annualRent.toLocaleString()} ر.س`,
      `Unit ${unit.unitNumber} for ${tenant.nameEn} (${contract.annualRent.toLocaleString()} SAR)`,
      'تشغيلية',
      ['gm', 'accountant', 'supervisor'],
      'leasing'
    );
    this.persist();
    return { contract, installments: createdInstallments };
    });
  }

  public updateContractEjarStatus(
    userId: string,
    contractId: string,
    ejarNumber: string,
    ejarStatus: LeaseContract['ejarStatus'],
    lifecycleStatus: LeaseContract['lifecycleStatus'],
    deviceName?: string
  ): LeaseContract {
    const user = this.assertPermission(userId, 'manage_contracts');
    const contract = this.state.contracts.find((c) => c.id === contractId);
    if (!contract) throw new Error('العقد غير موجود');

    const oldVal = `${contract.lifecycleStatus} / ${contract.ejarStatus}`;
    const prevLifecycle = contract.lifecycleStatus;
    contract.ejarNumber = ejarNumber;
    contract.ejarStatus = ejarStatus;
    contract.lifecycleStatus = lifecycleStatus;
    contract.version += 1;

    if (lifecycleStatus === 'منتهي' || lifecycleStatus === 'منتهٍ بالإخلاء' || lifecycleStatus === 'ملغي') {
      contract.preArchiveStatus = prevLifecycle;
      contract.archivedAt = contract.archivedAt || new Date().toISOString();
      contract.archivedBy = user.id;
      contract.archiveMode = 'تلقائي';
      contract.archiveReason = contract.archiveReason || `تحويل العقد إلى ${lifecycleStatus}`;
    }

    const unit = this.state.units.find((u) => u.id === contract.unitId);
    if (unit && lifecycleStatus === 'نشط') {
      unit.status = 'مؤجرة';
      unit.linkedTenantId = undefined;
    }

    this.addAudit(
      user,
      'تحديث توثيق وحالة العقد',
      'LeaseContract',
      contract.id,
      `تحديث العقد ${contract.internalNumber} (الإصدار ${contract.version}) إلى ${lifecycleStatus} · إيجار: ${ejarStatus}`,
      { oldValue: oldVal, newValue: `${lifecycleStatus} / ${ejarStatus}`, deviceName }
    );
    this.persist();
    return contract;
  }

  // 4. Handover / Eviction Inspection
  public createHandoverInspection(
    userId: string,
    input: Omit<HandoverInspection, 'id' | 'createdAt' | 'status' | 'netRefundOrDue' | 'inspectorId'>,
    deviceName?: string
  ): HandoverInspection {
    const user = this.assertPermission(userId, 'manage_properties');
    const contract = this.state.contracts.find((c) => c.id === input.contractId);
    const unit = this.state.units.find((u) => u.id === input.unitId);
    if (!contract || !unit) throw new Error('العقد أو الوحدة غير موجودة');

    const netRefundOrDue = input.depositHeld - input.damageCost - input.unpaidRentDue;
    const handover: HandoverInspection = {
      ...input,
      id: uid('hnd'),
      inspectorId: user.id,
      netRefundOrDue,
      status: 'بانتظار الاعتماد',
      createdAt: new Date().toISOString(),
    };
    this.state.handovers.unshift(handover);
    this.addAudit(
      user,
      'إعداد محضر استلام/إخلاء',
      'HandoverInspection',
      handover.id,
      `محضر ${handover.type} للوحدة ${unit.unitNumber} - صافي التسوية: ${netRefundOrDue} ر.س`,
      { deviceName, newValue: handover.status }
    );
    this.addNotification(
      `محضر ${handover.type} بانتظار الاعتماد`,
      `Handover inspection awaiting approval`,
      `الوحدة ${unit.unitNumber} جاهزة لمراجعة التسوية المالية وحالة الوحدة`,
      `Unit ${unit.unitNumber} inspection ready for approval`,
      'تشغيلية',
      ['gm', 'supervisor'],
      'leasing'
    );
    this.persist();
    return handover;
  }

  public approveHandover(
    userId: string,
    handoverId: string,
    nextUnitStatus: UnitStatus,
    deviceName?: string
  ): HandoverInspection {
    return this.runTransaction(() => {
    const user = this.assertPermission(userId, 'approve_expense_supervisor');
    const handover = this.state.handovers.find((h) => h.id === handoverId);
    if (!handover) throw new Error('المحضر غير موجود');
    handover.status = 'معتمد';
    handover.approvedBy = user.id;

    const unit = this.unitIndex.get(handover.unitId) || this.state.units.find((u) => u.id === handover.unitId);
    const contract = this.contractIndex.get(handover.contractId) || this.state.contracts.find((c) => c.id === handover.contractId);
    if (handover.type === 'إخلاء واستلام') {
      if (contract) {
        contract.preArchiveStatus = contract.lifecycleStatus;
        contract.lifecycleStatus = 'منتهٍ بالإخلاء';
        contract.archivedAt = new Date().toISOString();
        contract.archivedBy = user.id;
        contract.archiveMode = 'تلقائي';
        contract.archiveReason = 'انتهاء العقد بمحضر إخلاء واستلام معتمد';

        const tenant = this.tenantIndex.get(contract.tenantId) || this.state.tenants.find((t) => t.id === contract.tenantId);
        const stillHasOtherActiveContract = this.state.contracts.some(
          (c) => c.id !== contract.id && c.tenantId === contract.tenantId && (c.lifecycleStatus === 'نشط' || c.lifecycleStatus === 'بانتظار التوثيق')
        );
        if (tenant && !stillHasOtherActiveContract) {
          tenant.preArchiveStatus = tenant.classification;
          tenant.classification = 'سابق';
          tenant.archivedAt = new Date().toISOString();
          tenant.archivedBy = user.id;
          tenant.archiveMode = 'تلقائي';
          tenant.archiveReason = `إخلاء الوحدة ${unit?.unitNumber || handover.unitId}`;
        }
      }
      if (unit) {
        unit.status = nextUnitStatus;
        unit.linkedTenantId = undefined;
        if (nextUnitStatus === 'شاغرة') {
          unit.vacantSince = new Date().toISOString().slice(0, 10);
        }
      }
    }

    this.addAudit(
      user,
      'اعتماد محضر استلام وإخلاء',
      'HandoverInspection',
      handover.id,
      `اعتماد محضر الوحدة ${unit?.unitNumber || handover.unitId} وتحديث حالة الوحدة إلى ${nextUnitStatus}`,
      { deviceName, oldValue: 'بانتظار الاعتماد', newValue: 'معتمد' }
    );
    this.persist();
    return handover;
    });
  }

  // 5. Payments, Partial Allocation, Receipts & Reversal
  public recordPayment(
    userId: string,
    input: {
      idempotencyKey: string;
      contractId: string;
      installmentId?: string;
      amount: number;
      paymentMethod: PaymentMethod;
      paymentType: PaymentType;
      referenceNumber?: string;
      autoAllocateOldest?: boolean;
      signatureDataUrl?: string;
      notes?: string;
    },
    deviceName?: string
  ): Payment {
    return this.runTransaction(() => {
    const user = this.assertPermission(userId, 'collect_payments');

    // O(1) idempotency protection against duplicate sync / double click
    if (this.idempotencyIndex.has(input.idempotencyKey) || this.state.processedIdempotencyKeys.includes(input.idempotencyKey)) {
      const existing = this.state.payments.find((p) => p.idempotencyKey === input.idempotencyKey);
      if (existing) return existing;
    }
    const cleanRef = input.referenceNumber ? input.referenceNumber.trim() : '';
    if (cleanRef) {
      const dupRef = this.state.payments.find(
        (p) => p.contractId === input.contractId && p.referenceNumber === cleanRef && p.amount === input.amount && p.status === 'معتمد'
      );
      if (dupRef) return dupRef;
    }

    if (!input.amount || input.amount <= 0) throw new Error('يجب أن يكون المبلغ أكبر من صفر');

    const contract = this.contractIndex.get(input.contractId) || this.state.contracts.find((c) => c.id === input.contractId);
    if (!contract) throw new Error('العقد المحدد غير موجود');
    const property = this.propIndex.get(contract.propertyId) || this.state.properties.find((p) => p.id === contract.propertyId);
    const unit = this.unitIndex.get(contract.unitId) || this.state.units.find((u) => u.id === contract.unitId);

    const allocations: PaymentAllocation[] = [];
    let remainingToAllocate = input.amount;

    if (input.paymentType === 'إيجار') {
      const contractInstallments = this.state.installments
        .filter((i) => i.contractId === contract.id && i.remainingAmount > 0 && i.status !== 'ملغاة')
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

      if (input.installmentId && !input.autoAllocateOldest) {
        const target = contractInstallments.find((i) => i.id === input.installmentId);
        if (!target) throw new Error('الاستحقاق المحدد غير موجود أو مسدد بالكامل');
        if (input.amount > target.remainingAmount) {
          throw new Error(
            `المبلغ المدخل (${input.amount}) يتجاوز المتبقي على الاستحقاق (${target.remainingAmount})؛ فعّل التوزيع على أقدم استحقاق إذا أردت سداد عدة دفعات.`
          );
        }
        const applied = Math.min(remainingToAllocate, target.remainingAmount);
        target.paidAmount = Math.round((target.paidAmount + applied) * 100) / 100;
        target.remainingAmount = Math.round((target.amount - target.paidAmount) * 100) / 100;
        target.lastPaymentDate = new Date().toISOString().slice(0, 10);
        target.status = target.remainingAmount === 0 ? 'مدفوعة بالكامل' : 'مدفوعة جزئياً';
        allocations.push({ installmentId: target.id, amount: applied });
        remainingToAllocate -= applied;
      } else {
        // Auto-allocate oldest due installments first!
        const totalOpen = contractInstallments.reduce((acc, i) => acc + i.remainingAmount, 0);
        if (contractInstallments.length > 0 && input.amount > totalOpen) {
          throw new Error(`المبلغ المدخل يتجاوز إجمالي الاستحقاقات المتبقية على العقد (${totalOpen} ر.س)`);
        }
        for (const inst of contractInstallments) {
          if (remainingToAllocate <= 0) break;
          const applied = Math.min(remainingToAllocate, inst.remainingAmount);
          inst.paidAmount = Math.round((inst.paidAmount + applied) * 100) / 100;
          inst.remainingAmount = Math.round((inst.amount - inst.paidAmount) * 100) / 100;
          inst.lastPaymentDate = new Date().toISOString().slice(0, 10);
          inst.status = inst.remainingAmount === 0 ? 'مدفوعة بالكامل' : 'مدفوعة جزئياً';
          allocations.push({ installmentId: inst.id, amount: applied });
          remainingToAllocate = Math.round((remainingToAllocate - applied) * 100) / 100;
        }
      }
    }

    this.state.counters.receipt += 1;
    const receiptNumber = `RCP-2026-${pad4(this.state.counters.receipt)}`;
    const payCurrency: CurrencyCode = contract.currency || this.state.settings.baseCurrency || 'SAR';
    const amountSar = toSar(input.amount, payCurrency, this.state.settings.currencyRatesToSar);

    const payment: Payment = {
      id: uid('pay'),
      receiptNumber,
      idempotencyKey: input.idempotencyKey,
      contractId: contract.id,
      unitId: contract.unitId,
      propertyId: contract.propertyId,
      tenantId: contract.tenantId,
      allocations,
      amount: input.amount,
      currency: payCurrency,
      paymentMethod: input.paymentMethod,
      paymentType: input.paymentType,
      referenceNumber: input.referenceNumber,
      receivedBy: user.id,
      deviceName: deviceName || user.deviceName,
      status: 'معتمد',
      signatureDataUrl: input.signatureDataUrl,
      notes: input.notes,
      createdAt: new Date().toISOString(),
    };

    this.state.payments.unshift(payment);
    this.state.processedIdempotencyKeys.push(input.idempotencyKey);
    this.idempotencyIndex.add(input.idempotencyKey);

    // Update unit overdue flag if all overdue installments cleared
    if (unit && unit.status === 'متأخرة في السداد') {
      const stillOverdue = this.state.installments.some(
        (i) => i.unitId === unit.id && i.status === 'متأخرة' && i.remainingAmount > 0
      );
      if (!stillOverdue) {
        unit.status = 'مؤجرة';
      }
    }

    // Automated Double-Entry Accounting Journal (Converted to SAR GL base)
    this.state.counters.journal += 1;
    const debitAccountId = input.paymentMethod === 'نقدي' ? 'acc-1020' : 'acc-1010';
    const debitAccount = this.state.accounts.find((a) => a.id === debitAccountId)!;
    const mgmtPct = property?.managementFeePercent ?? contract.managementCommissionPercent ?? 5;
    const mgmtFee = input.paymentType === 'إيجار' ? Math.round(amountSar * (mgmtPct / 100) * 100) / 100 : 0;
    const ownerNet = Math.round((amountSar - mgmtFee) * 100) / 100;

    const lines = [{ accountId: debitAccount.id, accountName: debitAccount.nameAr, debit: amountSar, credit: 0 }];
    if (input.paymentType === 'تأمين') {
      const depAcc = this.state.accounts.find((a) => a.id === 'acc-2100')!;
      lines.push({ accountId: depAcc.id, accountName: depAcc.nameAr, debit: 0, credit: amountSar });
      depAcc.balance += amountSar;
    } else if (input.paymentType === 'رسوم مكتب وسعي' || input.paymentType === 'عمولة فسخ') {
      const feeAcc = this.state.accounts.find((a) => a.id === 'acc-4200')!;
      lines.push({ accountId: feeAcc.id, accountName: feeAcc.nameAr, debit: 0, credit: amountSar });
      feeAcc.balance += amountSar;
    } else {
      const ownerAcc = this.state.accounts.find((a) => a.id === 'acc-2200')!;
      const commAcc = this.state.accounts.find((a) => a.id === 'acc-4100')!;
      lines.push({ accountId: ownerAcc.id, accountName: ownerAcc.nameAr, debit: 0, credit: ownerNet });
      if (mgmtFee > 0) {
        lines.push({ accountId: commAcc.id, accountName: commAcc.nameAr, debit: 0, credit: mgmtFee });
        commAcc.balance += mgmtFee;
      }
      ownerAcc.balance += ownerNet;
    }
    debitAccount.balance += amountSar;

    const journal: JournalEntry = {
      id: uid('jrn'),
      entryNumber: `JRN-2026-${pad4(this.state.counters.journal)}`,
      date: new Date().toISOString().slice(0, 10),
      description: `سند قبض ${receiptNumber} (${input.paymentType}) للوحدة ${unit?.unitNumber || ''} - ${input.paymentMethod}${payCurrency !== 'SAR' ? ` [${input.amount} ${payCurrency}]` : ''}`,
      referenceType: 'تحصيل',
      referenceId: payment.id,
      propertyId: contract.propertyId,
      ownerId: property?.ownerShares[0]?.ownerId,
      createdBy: user.id,
      lines,
    };
    this.state.journals.unshift(journal);

    this.addAudit(
      user,
      'تسجيل دفعة وإصدار سند قبض',
      'Payment',
      payment.id,
      `إصدار سند ${receiptNumber} بمبلغ ${input.amount.toLocaleString()} ر.س للوحدة ${unit?.unitNumber || ''}`,
      { deviceName: payment.deviceName, newValue: `${input.amount} ر.س` }
    );
    this.addNotification(
      `سند قبض جديد ${receiptNumber}`,
      `New Receipt ${receiptNumber}`,
      `تم تحصيل ${input.amount.toLocaleString()} ر.س للوحدة ${unit?.unitNumber || ''} بواسطة ${user.nameAr}`,
      `Collected ${input.amount.toLocaleString()} SAR for unit ${unit?.unitNumber || ''}`,
      'مالية',
      ['gm', 'accountant', 'supervisor', 'owner'],
      'finance'
    );

    this.persist();
    return payment;
    });
  }

  public reverseReceipt(userId: string, paymentId: string, reason: string, deviceName?: string): Payment {
    return this.runTransaction(() => {
    const user = this.assertPermission(userId, 'reverse_receipts');
    if (!reason || reason.trim().length < 5) {
      throw new Error('يجب إدخال سبب واضح لإلغاء السند وإصدار حركة عكسية');
    }
    const original = this.state.payments.find((p) => p.id === paymentId);
    if (!original) throw new Error('السند المطلوب غير موجود');
    if (original.status === 'معكوس') throw new Error('هذا السند تم عكسه مسبقاً');

    original.preArchiveStatus = 'معتمد';
    original.status = 'معكوس';
    original.reversalReason = reason;
    original.archivedAt = new Date().toISOString();
    original.archivedBy = user.id;
    original.archiveMode = 'تلقائي';
    original.archiveReason = `سند ملغى بقيد عكسي: ${reason}`;

    // Roll back installment allocations accurately
    for (const alloc of original.allocations) {
      const inst = this.state.installments.find((i) => i.id === alloc.installmentId);
      if (inst) {
        inst.paidAmount = Math.max(0, Math.round((inst.paidAmount - alloc.amount) * 100) / 100);
        inst.remainingAmount = Math.round((inst.amount - inst.paidAmount) * 100) / 100;
        const todayStr = new Date().toISOString().slice(0, 10);
        if (inst.paidAmount > 0) {
          inst.status = 'مدفوعة جزئياً';
        } else {
          inst.status = inst.dueDate < todayStr ? 'متأخرة' : inst.dueDate === todayStr ? 'مستحقة اليوم' : 'لم تستحق';
        }
      }
    }

    this.state.counters.receipt += 1;
    const revReceiptNo = `REV-2026-${pad4(this.state.counters.receipt)}`;
    original.reversedByReceiptId = revReceiptNo;

    // Reversal journal entry
    const origJournal = this.state.journals.find((j) => j.referenceId === original.id);
    if (origJournal) {
      this.state.counters.journal += 1;
      const revLines = origJournal.lines.map((l) => {
        const acc = this.state.accounts.find((a) => a.id === l.accountId);
        if (acc) {
          if (acc.type === 'أصول' || acc.type === 'مصروفات') {
            acc.balance += l.credit - l.debit;
          } else {
            acc.balance += l.debit - l.credit;
          }
        }
        return {
          accountId: l.accountId,
          accountName: l.accountName,
          debit: l.credit,
          credit: l.debit,
        };
      });
      this.state.journals.unshift({
        id: uid('jrn'),
        entryNumber: `JRN-2026-${pad4(this.state.counters.journal)}`,
        date: new Date().toISOString().slice(0, 10),
        description: `قيد عكسي لإلغاء السند ${original.receiptNumber} (${revReceiptNo}) - السبب: ${reason}`,
        referenceType: 'سند عكسي',
        referenceId: original.id,
        propertyId: original.propertyId,
        createdBy: user.id,
        lines: revLines,
      });
    }

    this.addAudit(
      user,
      'إصدار سند عكسي وإلغاء تحصيل',
      'Payment',
      original.id,
      `عكس السند ${original.receiptNumber} بسند عكسي ${revReceiptNo} بمبلغ ${original.amount.toLocaleString()} ر.س`,
      { oldValue: 'معتمد', newValue: 'معكوس', reason, deviceName }
    );
    this.addNotification(
      `حركة عكسية للسند ${original.receiptNumber}`,
      `Receipt ${original.receiptNumber} reversed`,
      `أصدر ${user.nameAr} سنداً عكسياً (${revReceiptNo}) بسبب: ${reason}`,
      `${user.nameEn} issued reversal ${revReceiptNo}: ${reason}`,
      'إدارية',
      ['gm', 'accountant'],
      'finance'
    );

    this.persist();
    return original;
    });
  }

  // 6. Expenses & Multi-Stage Approval
  public createExpense(
    userId: string,
    input: Omit<
      Expense,
      'id' | 'expenseNumber' | 'approvalStatus' | 'createdBy' | 'createdAt' | 'approvedBySupervisor' | 'approvedByManager'
    > & { isDraft?: boolean },
    deviceName?: string
  ): Expense {
    const user = this.assertPermission(userId, 'create_expense');
    const { isDraft, ...restInput } = input;

    // Prevent duplicate invoice registration
    const dupInvoice = this.state.expenses.find(
      (e) =>
        e.invoiceNumber.trim() &&
        e.invoiceNumber.trim().toLowerCase() === restInput.invoiceNumber.trim().toLowerCase() &&
        (e.vendorId || '') === (restInput.vendorId || '') &&
        e.approvalStatus !== 'مرفوض' &&
        e.approvalStatus !== 'ملغى'
    );
    if (dupInvoice) {
      throw new Error(`تنبيه: رقم الفاتورة ${restInput.invoiceNumber} مسجل مسبقاً (${dupInvoice.expenseNumber})`);
    }

    const expCurrency: CurrencyCode = restInput.currency || this.state.settings.baseCurrency || 'SAR';
    const amountSar = toSar(restInput.amount, expCurrency, this.state.settings.currencyRatesToSar);
    const expMonth = (restInput.date || new Date().toISOString().slice(0, 10)).slice(0, 7);

    // Budget enforcement / alert check
    const budget = (this.state.propertyBudgets || []).find(
      (b) => b.propertyId === restInput.propertyId && b.month === expMonth
    );
    if (budget && budget.monthlyLimitSar > 0 && !isDraft) {
      const spentSoFar = this.state.expenses
        .filter(
          (e) =>
            e.propertyId === restInput.propertyId &&
            e.date.startsWith(expMonth) &&
            e.approvalStatus !== 'مرفوض' &&
            e.approvalStatus !== 'ملغى'
        )
        .reduce((s, e) => s + toSar(e.amount, e.currency || 'SAR', this.state.settings.currencyRatesToSar), 0);
      const nextTotal = spentSoFar + amountSar;
      if (budget.blockAt100Percent && nextTotal > budget.monthlyLimitSar && user.role !== 'gm' && user.role !== 'sys_owner') {
        throw new Error(
          `تجاوز الميزانية الشهرية للعقار (${budget.monthlyLimitSar.toLocaleString()} ر.س): المصروف الحالي سيصل بالإجمالي إلى ${Math.round(nextTotal).toLocaleString()} ر.س. يتطلب استثناء المدير العام.`
        );
      }
      const pct = Math.round((nextTotal / budget.monthlyLimitSar) * 100);
      if (pct >= (budget.alertThresholdPercent || 80)) {
        const prop = this.state.properties.find((p) => p.id === restInput.propertyId);
        this.addNotification(
          `تنبيه ميزانية ${prop?.nameAr || restInput.propertyId} (${pct}%)`,
          `Budget Alert (${pct}%)`,
          `وصل إجمالي مصروفات شهر ${expMonth} إلى ${Math.round(nextTotal).toLocaleString()} من أصل ${budget.monthlyLimitSar.toLocaleString()} ر.س`,
          `Monthly spending reached ${pct}% of limit`,
          'مالية',
          ['gm', 'sys_owner', 'accountant', 'supervisor'],
          'accounting'
        );
      }
    }

    const vatAmount =
      restInput.vatAmount !== undefined
        ? restInput.vatAmount
        : Math.round((restInput.amount - restInput.amount / 1.15) * 100) / 100;
    const netAmount =
      restInput.netAmount !== undefined
        ? restInput.netAmount
        : Math.round((restInput.amount - vatAmount) * 100) / 100;
    const paymentStatus = restInput.paymentStatus || (restInput.paymentMethod === 'آجل' ? 'لم يُدفع' : 'لم يُدفع');
    const paidAmount =
      restInput.paidAmount !== undefined
        ? restInput.paidAmount
        : paymentStatus === 'مدفوع بالكامل'
        ? restInput.amount
        : 0;
    const remainingAmount = Math.max(0, Math.round((restInput.amount - paidAmount) * 100) / 100);

    this.state.counters.expense += 1;
    const expense: Expense = {
      ...restInput,
      vatAmount,
      netAmount,
      paymentStatus,
      paidAmount,
      remainingAmount,
      currency: expCurrency,
      id: uid('exp'),
      expenseNumber: `EXP-2026-${pad4(this.state.counters.expense)}`,
      approvalStatus: isDraft ? 'مسودة' : 'بانتظار المشرف',
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };
    this.state.expenses.unshift(expense);

    if (restInput.ticketId && !isDraft) {
      const tkt = this.state.tickets.find((t) => t.id === restInput.ticketId);
      if (tkt) {
        tkt.linkedExpenseId = expense.id;
        tkt.actualCost = expense.amount;
        tkt.status = 'بانتظار اعتماد التكلفة';
        tkt.updatedAt = new Date().toISOString();
      }
    }

    this.addAudit(
      user,
      isDraft ? 'حفظ مسودة مصروف' : 'تسجيل مصروف بانتظار الاعتماد',
      'Expense',
      expense.id,
      `${isDraft ? 'مسودة' : 'رفع'} المصروف ${expense.expenseNumber} بمبلغ ${expense.amount.toLocaleString()} ر.س (${expense.category})`,
      { deviceName, propertyId: expense.propertyId, newValue: expense.approvalStatus }
    );
    if (!isDraft) {
      this.addNotification(
        `مصروف جديد ${expense.expenseNumber} ينتظر المراجعة`,
        `New expense ${expense.expenseNumber} pending`,
        `مبلغ ${expense.amount.toLocaleString()} ر.س - ${expense.category}`,
        `${expense.amount.toLocaleString()} SAR - ${expense.category}`,
        'مالية',
        ['supervisor', 'maint_manager', 'gm'],
        'accounting'
      );
    }
    this.persist();
    return expense;
  }

  private postExpenseJournal(user: StaffUser, expense: Expense) {
    const expCurrency: CurrencyCode = expense.currency || 'SAR';
    const expAmountSar = toSar(expense.amount, expCurrency, this.state.settings.currencyRatesToSar);
    this.state.counters.journal += 1;
    const isMaint = expense.category === 'صيانة' || expense.category === 'مصروفات الصيانة';
    const expAccId = isMaint ? 'acc-5100' : 'acc-5200';
    const expAcc = this.state.accounts.find((a) => a.id === expAccId)!;
    const creditAccId =
      expense.bearer === 'المالك'
        ? 'acc-2200'
        : expense.paymentMethod === 'نقدي'
        ? 'acc-1020'
        : expense.paymentMethod === 'آجل'
        ? 'acc-2300'
        : 'acc-1010';
    const creditAcc = this.state.accounts.find((a) => a.id === creditAccId)!;

    if (expense.bearer === 'المالك') {
      const bankAcc = this.state.accounts.find((a) => a.id === 'acc-1010')!;
      const ownerAcc = this.state.accounts.find((a) => a.id === 'acc-2200')!;
      ownerAcc.balance -= expAmountSar;
      bankAcc.balance -= expAmountSar;
      this.state.journals.unshift({
        id: uid('jrn'),
        entryNumber: `JRN-2026-${pad4(this.state.counters.journal)}`,
        date: expense.date,
        description: `اعتماد مصروف ${expense.expenseNumber} (${expense.category}) محمل على المالك${expCurrency !== 'SAR' ? ` [${expense.amount} ${expCurrency}]` : ''}`,
        referenceType: 'مصروف',
        referenceId: expense.id,
        propertyId: expense.propertyId,
        createdBy: user.id,
        lines: [
          { accountId: ownerAcc.id, accountName: ownerAcc.nameAr, debit: expAmountSar, credit: 0 },
          { accountId: bankAcc.id, accountName: bankAcc.nameAr, debit: 0, credit: expAmountSar },
        ],
      });
    } else {
      expAcc.balance += expAmountSar;
      creditAcc.balance -= expAmountSar;
      this.state.journals.unshift({
        id: uid('jrn'),
        entryNumber: `JRN-2026-${pad4(this.state.counters.journal)}`,
        date: expense.date,
        description: `اعتماد مصروف ${expense.expenseNumber} (${expense.category}) على حساب ${expense.bearer}${expCurrency !== 'SAR' ? ` [${expense.amount} ${expCurrency}]` : ''}`,
        referenceType: 'مصروف',
        referenceId: expense.id,
        propertyId: expense.propertyId,
        createdBy: user.id,
        lines: [
          { accountId: expAcc.id, accountName: expAcc.nameAr, debit: expAmountSar, credit: 0 },
          { accountId: creditAcc.id, accountName: creditAcc.nameAr, debit: 0, credit: expAmountSar },
        ],
      });
    }

    if (expense.registerAsAsset && expense.unitId) {
      this.state.assets.unshift({
        id: uid('ast'),
        propertyId: expense.propertyId,
        unitId: expense.unitId,
        name: expense.subCategory || expense.notes || `أصل رأسمالي ${expense.expenseNumber}`,
        category: 'أصول ومعدات رأسمالية',
        serialNumber: expense.invoiceNumber || expense.expenseNumber,
        brand: this.state.vendors.find((v) => v.id === expense.vendorId)?.nameAr || 'توريد مباشر',
        purchaseDate: expense.date,
        warrantyExpiry: `${Number(expense.date.slice(0, 4)) + 2}${expense.date.slice(4)}`,
        condition: 'ممتاز',
      });
    }

    if (expense.ticketId) {
      const tkt = this.state.tickets.find((t) => t.id === expense.ticketId);
      if (tkt) {
        if (expense.paymentStatus === 'مدفوع بالكامل') {
          tkt.status = 'مكتمل';
        } else if (tkt.status === 'بانتظار اعتماد التكلفة') {
          tkt.status = 'قيد التنفيذ';
        }
        tkt.actualCost = expense.amount;
        tkt.updatedAt = new Date().toISOString();
      }
    }
  }

  public decideExpense(
    userId: string,
    expenseId: string,
    decision: 'approve' | 'reject' | 'submit',
    reason?: string,
    deviceName?: string
  ): Expense {
    return this.runTransaction(() => {
    const user = this.getActingUser(userId);
    const expense = this.state.expenses.find((e) => e.id === expenseId);
    if (!expense) throw new Error('المصروف غير موجود');
    if (expense.approvalStatus === 'معتمد' || expense.approvalStatus === 'مرفوض' || expense.approvalStatus === 'ملغى') {
      throw new Error('تم حسم هذا المصروف مسبقاً');
    }

    const oldStatus = expense.approvalStatus;

    if (decision === 'submit') {
      if (expense.approvalStatus !== 'مسودة') throw new Error('يمكن إرسال المسودات فقط للاعتماد');
      expense.approvalStatus = 'بانتظار المشرف';
      this.addAudit(user, 'إرسال مسودة مصروف للاعتماد', 'Expense', expense.id, `إرسال المصروف ${expense.expenseNumber} للاعتماد`, {
        oldValue: oldStatus,
        newValue: expense.approvalStatus,
        propertyId: expense.propertyId,
        deviceName,
      });
      this.persist();
      return expense;
    }

    // Segregation of duties: creator cannot self-approve sensitive expense unless GM/sys_owner override
    if (decision === 'approve' && expense.createdBy === user.id && user.role !== 'gm' && user.role !== 'sys_owner') {
      throw new Error('الفصل بين المهام: لا يمكن للموظف اعتماد مصروف قام برفعه بنفسه');
    }

    if (decision === 'reject') {
      if (!reason) throw new Error('يجب ذكر سبب الرفض');
      this.assertPermission(userId, 'approve_expense_supervisor');
      expense.approvalStatus = 'مرفوض';
      expense.rejectionReason = reason;
      this.addAudit(user, 'رفض مصروف', 'Expense', expense.id, `رفض المصروف ${expense.expenseNumber}`, {
        oldValue: oldStatus,
        newValue: 'مرفوض',
        reason,
        propertyId: expense.propertyId,
        deviceName,
      });
      this.persist();
      return expense;
    }

    const expAmountSar = toSar(expense.amount, expense.currency || 'SAR', this.state.settings.currencyRatesToSar);
    const isTopExec = user.role === 'gm' || user.role === 'sys_owner';

    if (expense.approvalStatus === 'بانتظار المشرف') {
      if (isTopExec) {
        this.assertPermission(userId, 'approve_expense_manager');
        expense.approvedBySupervisor = user.id;
        expense.approvedByDeptManager = user.id;
        expense.approvedByManager = user.id;
        expense.approvalStatus = expAmountSar > 20000 ? 'بانتظار المالك' : 'معتمد';
      } else {
        this.assertPermission(userId, 'approve_expense_supervisor');
        expense.approvedBySupervisor = user.id;
        if (expAmountSar < 1000) {
          expense.approvalStatus = 'معتمد';
        } else if (expAmountSar <= 5000) {
          expense.approvalStatus = user.role === 'maint_manager' ? 'معتمد' : 'بانتظار مدير القسم';
          if (user.role === 'maint_manager') expense.approvedByDeptManager = user.id;
        } else {
          expense.approvalStatus = 'بانتظار المدير';
        }
      }
    } else if (expense.approvalStatus === 'بانتظار مدير القسم') {
      if (isTopExec) {
        this.assertPermission(userId, 'approve_expense_manager');
        expense.approvedByDeptManager = user.id;
        expense.approvedByManager = user.id;
        expense.approvalStatus = expAmountSar > 20000 ? 'بانتظار المالك' : 'معتمد';
      } else {
        this.assertPermission(userId, 'approve_expense_supervisor');
        expense.approvedByDeptManager = user.id;
        expense.approvalStatus = expAmountSar > 5000 ? 'بانتظار المدير' : 'معتمد';
      }
    } else if (expense.approvalStatus === 'بانتظار المدير') {
      this.assertPermission(userId, 'approve_expense_manager');
      expense.approvedByManager = user.id;
      expense.approvalStatus = expAmountSar > 20000 ? 'بانتظار المالك' : 'معتمد';
    } else if (expense.approvalStatus === 'بانتظار المالك') {
      if (user.role !== 'owner' && user.role !== 'sys_owner' && user.role !== 'gm') {
        throw new Error('الموافقة النهائية للمصروفات فوق 20,000 ر.س مخصصة للمالك أو مالك النظام');
      }
      expense.approvedByOwner = user.id;
      expense.approvalStatus = 'معتمد';
    }

    if (expense.approvalStatus === 'معتمد') {
      this.postExpenseJournal(user, expense);
    }

    this.addAudit(
      user,
      'اعتماد مصروف',
      'Expense',
      expense.id,
      `تحديث اعتماد المصروف ${expense.expenseNumber} من ${oldStatus} إلى ${expense.approvalStatus}`,
      { oldValue: oldStatus, newValue: expense.approvalStatus, propertyId: expense.propertyId, deviceName }
    );
    this.persist();
    return expense;
    });
  }

  // 7. Maintenance Tickets & Tasks
  public createTicket(
    userId: string,
    input: Omit<MaintenanceTicket, 'id' | 'ticketNumber' | 'createdBy' | 'createdAt' | 'updatedAt'> & {
      createLinkedTask?: boolean;
    },
    deviceName?: string
  ): MaintenanceTicket {
    const user = this.assertPermission(userId, 'manage_maintenance');
    this.state.counters.ticket += 1;
    const now = new Date().toISOString();
    const { createLinkedTask, ...ticketData } = input;

    const ticket: MaintenanceTicket = {
      ...ticketData,
      id: uid('tkt'),
      ticketNumber: `MNT-2026-${pad3(this.state.counters.ticket)}`,
      createdBy: user.id,
      createdAt: now,
      updatedAt: now,
    };

    if (createLinkedTask !== false) {
      const task: TaskItem = {
        id: uid('tsk'),
        title: `تنفيذ صيانة ${ticket.ticketNumber}: ${ticket.title}`,
        description: ticket.description,
        type: 'صيانة',
        propertyId: ticket.propertyId,
        unitId: ticket.unitId,
        assignedTo: ticket.assignedTo || 'usr-tech',
        createdBy: user.id,
        dueDate: ticket.scheduledDate || new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
        priority: ticket.priority,
        status: ticket.assignedTo ? 'مسندة' : 'جديدة',
        checklist: [
          { text: 'معاينة العطل وتسجيل التشخيص', done: false },
          { text: 'تنفيذ الإصلاح وتوثيق صور قبل وبعد', done: false },
        ],
        comments: [],
        linkedTicketId: ticket.id,
        createdAt: now,
      };
      this.state.tasks.unshift(task);
      ticket.linkedTaskId = task.id;
    }

    this.state.tickets.unshift(ticket);
    this.addAudit(
      user,
      'فتح بلاغ صيانة',
      'MaintenanceTicket',
      ticket.id,
      `فتح البلاغ ${ticket.ticketNumber}: ${ticket.title} (الأولوية: ${ticket.priority})`,
      { deviceName, newValue: ticket.status }
    );
    this.addNotification(
      `بلاغ صيانة ${ticket.priority}: ${ticket.ticketNumber}`,
      `Maintenance ticket ${ticket.ticketNumber}`,
      ticket.title,
      ticket.title,
      'تشغيلية',
      ['supervisor', 'technician', 'gm'],
      'maintenance'
    );
    this.persist();
    return ticket;
  }

  public updateTicket(
    userId: string,
    ticketId: string,
    patch: Partial<Pick<MaintenanceTicket, 'status' | 'diagnosis' | 'actualCost' | 'assignedTo' | 'rating'>>,
    deviceName?: string
  ): MaintenanceTicket {
    const user = this.assertPermission(userId, 'execute_maintenance');
    const ticket = this.state.tickets.find((t) => t.id === ticketId);
    if (!ticket) throw new Error('بلاغ الصيانة غير موجود');
    const oldStatus = ticket.status;
    Object.assign(ticket, patch, { updatedAt: new Date().toISOString() });

    if (patch.status === 'مكتمل' || patch.status === 'مغلق') {
      ticket.preArchiveStatus = oldStatus;
      ticket.archivedAt = ticket.archivedAt || new Date().toISOString();
      ticket.archivedBy = user.id;
      ticket.archiveMode = 'تلقائي';
      ticket.archiveReason = ticket.archiveReason || `إغلاق بلاغ الصيانة (${patch.status})`;
    }
    if (ticket.linkedTaskId && (patch.status === 'مكتمل' || patch.status === 'مغلق')) {
      const tsk = this.state.tasks.find((t) => t.id === ticket.linkedTaskId);
      if (tsk) {
        tsk.preArchiveStatus = tsk.status;
        tsk.status = 'مكتملة';
        tsk.archivedAt = tsk.archivedAt || new Date().toISOString();
        tsk.archivedBy = user.id;
        tsk.archiveMode = 'تلقائي';
        tsk.archiveReason = `اكتمل البلاغ المرتبط ${ticket.ticketNumber}`;
      }
    }

    this.addAudit(
      user,
      'تحديث بلاغ صيانة',
      'MaintenanceTicket',
      ticket.id,
      `تحديث البلاغ ${ticket.ticketNumber} إلى ${ticket.status}`,
      { oldValue: oldStatus, newValue: ticket.status, deviceName }
    );
    this.persist();
    return ticket;
  }

  private pickSmartAssignee(taskType: string, propertyId?: string): { user?: StaffUser; reason: string } {
    const typeLower = taskType.toLowerCase();
    const preferredRoles: RoleKey[] =
      typeLower.includes('صيانة') || typeLower.includes('تكييف') || typeLower.includes('سباكة')
        ? ['technician', 'maint_manager', 'supervisor']
        : typeLower.includes('تأجير') || typeLower.includes('عقد') || typeLower.includes('معاينة')
        ? ['leasing', 'supervisor', 'receptionist']
        : typeLower.includes('مالي') || typeLower.includes('تحصيل') || typeLower.includes('فاتورة')
        ? ['accountant', 'gm']
        : typeLower.includes('تسليم') || typeLower.includes('إخلاء') || typeLower.includes('استلام')
        ? ['supervisor', 'leasing']
        : ['supervisor', 'leasing', 'receptionist', 'gm'];

    const candidates = this.state.users.filter((u) => {
      if (!u.active || u.role === 'owner' || u.role === 'auditor') return false;
      if (u.statusState === 'غير متصل') return false;
      if (propertyId && Array.isArray(u.allowedPropertyIds) && u.allowedPropertyIds.length > 0) {
        if (!u.allowedPropertyIds.includes(propertyId)) return false;
      }
      return true;
    });

    if (candidates.length === 0) {
      return { reason: 'لا يوجد موظف متصل متاح حالياً — تم الحفظ في قائمة الانتظار' };
    }

    const activeLoad = (uidStr: string) =>
      this.state.tasks.filter((t) => t.assignedTo === uidStr && t.status !== 'مكتملة' && !t.archivedAt).length;

    const scored = candidates
      .map((u) => {
        const roleIdx = preferredRoles.indexOf(u.role);
        const roleScore = roleIdx === -1 ? 10 : roleIdx * 20;
        const loadScore = activeLoad(u.id) * 15;
        const statusScore = u.statusState === 'مشغول' ? 25 : 0;
        return { user: u, score: roleScore + loadScore + statusScore, load: activeLoad(u.id) };
      })
      .sort((a, b) => a.score - b.score);

    const best = scored[0];
    return {
      user: best.user,
      reason: `إسناد ذكي لـ ${best.user.nameAr} (${best.user.roleLabelAr}) · عبء العمل الحالي: ${best.load} مهام`,
    };
  }

  public createTask(
    userId: string,
    input: Omit<TaskItem, 'id' | 'createdBy' | 'createdAt' | 'comments'> & { autoAssignSmart?: boolean },
    deviceName?: string
  ): TaskItem {
    const user = this.assertPermission(userId, 'manage_tasks');
    const { autoAssignSmart, ...rawInput } = input;
    let finalAssignee = rawInput.assignedTo;
    let isQueued = false;
    let smartReason: string | undefined;

    if (autoAssignSmart || !finalAssignee) {
      const picked = this.pickSmartAssignee(rawInput.type, rawInput.propertyId);
      if (picked.user) {
        finalAssignee = picked.user.id;
        smartReason = picked.reason;
      } else {
        finalAssignee = '';
        isQueued = true;
        smartReason = picked.reason;
      }
    }

    const task: TaskItem = {
      ...rawInput,
      assignedTo: finalAssignee,
      status: isQueued ? 'جديدة' : rawInput.status || (finalAssignee ? 'مسندة' : 'جديدة'),
      isQueued,
      smartAssignedReason: smartReason,
      id: uid('tsk'),
      createdBy: user.id,
      comments: [],
      createdAt: new Date().toISOString(),
    };
    this.state.tasks.unshift(task);
    this.addAudit(
      user,
      isQueued ? 'إضافة مهمة لقائمة الانتظار' : 'إنشاء وإسناد مهمة فريق',
      'TaskItem',
      task.id,
      `إسناد مهمة "${task.title}"${smartReason ? ` (${smartReason})` : ''}`,
      {
        deviceName,
        propertyId: task.propertyId,
        newValue: task.status,
      }
    );
    if (isQueued) {
      this.addNotification(
        `مهمة في قائمة الانتظار: ${task.title}`,
        `Queued Task: ${task.title}`,
        `لم يتم العثور على موظف متاح حالياً، بانتظار توجيه المدير.`,
        `No eligible staff available right now; task placed in queue.`,
        'تشغيلية',
        ['gm', 'sys_owner', 'supervisor', 'maint_manager'],
        'team'
      );
    } else if (finalAssignee) {
      const targetUser = this.state.users.find((u) => u.id === finalAssignee);
      if (targetUser) {
        this.addNotification(
          task.priority === 'عاجل' ? `مهمة عاجلة: ${task.title}` : `مهمة جديدة مسندة: ${task.title}`,
          `New task assigned: ${task.title}`,
          `تم إسناد مهمة (${task.type}) إلى ${targetUser.nameAr} — الموعد النهائي: ${task.dueDate}`,
          `Assigned to ${targetUser.nameEn} · Due: ${task.dueDate}`,
          'تشغيلية',
          [targetUser.role, 'supervisor', 'gm'],
          'team'
        );
      }
    }
    this.persist();
    return task;
  }

  public updateTask(
    userId: string,
    taskId: string,
    patch: Partial<Pick<TaskItem, 'status' | 'checklist' | 'assignedTo' | 'actualHours' | 'photoNotes'>> & {
      commentText?: string;
    },
    deviceName?: string
  ): TaskItem {
    const user = this.assertPermission(userId, 'manage_tasks');
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (!task) throw new Error('المهمة غير موجودة');
    const oldStatus = task.status;

    if (patch.status) {
      task.status = patch.status;
      if (patch.status === 'مكتملة') {
        task.completedAt = task.completedAt || new Date().toISOString();
        task.preArchiveStatus = oldStatus;
        task.archivedAt = task.archivedAt || new Date().toISOString();
        task.archivedBy = user.id;
        task.archiveMode = 'تلقائي';
        task.archiveReason = task.archiveReason || 'إنجاز المهمة بنجاح';
      }
    }
    if (patch.checklist) task.checklist = patch.checklist;
    if (patch.actualHours !== undefined) task.actualHours = patch.actualHours;
    if (patch.photoNotes) task.photoNotes = patch.photoNotes;
    if (patch.assignedTo !== undefined) {
      task.assignedTo = patch.assignedTo;
      if (patch.assignedTo) task.isQueued = false;
    }
    if (patch.commentText) {
      task.comments.push({
        id: uid('cmt'),
        authorName: user.nameAr,
        text: patch.commentText,
        createdAt: new Date().toISOString(),
      });
      const assignee = this.state.users.find((u) => u.id === task.assignedTo);
      if (assignee && assignee.id !== user.id) {
        this.addNotification(
          `تعليق جديد على مهمة: ${task.title}`,
          `Comment on task: ${task.title}`,
          `${user.nameAr} أضاف تعليقاً: "${patch.commentText}"`,
          `${user.nameEn} commented: "${patch.commentText}"`,
          'تشغيلية',
          [assignee.role],
          'team'
        );
      }
    }

    this.addAudit(user, 'تحديث مهمة', 'TaskItem', task.id, `تحديث المهمة "${task.title}" (${task.status})`, {
      oldValue: oldStatus,
      newValue: task.status,
      propertyId: task.propertyId,
      deviceName,
    });
    this.persist();
    return task;
  }

  public reassignTask(
    userId: string,
    taskId: string,
    newAssigneeId: string,
    reason?: string,
    deviceName?: string
  ): TaskItem {
    const user = this.assertPermission(userId, 'manage_tasks');
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (!task) throw new Error('المهمة غير موجودة');
    const targetUser = this.state.users.find((u) => u.id === newAssigneeId && u.active);
    if (!targetUser) throw new Error('الموظف المستهدف غير متاح');

    const prevAssignee = this.state.users.find((u) => u.id === task.assignedTo);
    task.assignedTo = targetUser.id;
    task.isQueued = false;
    if (task.status === 'جديدة') task.status = 'مسندة';
    task.smartAssignedReason = `إعادة إسناد يدوية إلى ${targetUser.nameAr}${reason ? ` · ${reason}` : ''}`;

    this.addAudit(
      user,
      'إعادة إسناد مهمة',
      'TaskItem',
      task.id,
      `إعادة إسناد المهمة "${task.title}" إلى ${targetUser.nameAr}`,
      {
        oldValue: prevAssignee?.nameAr || 'قائمة الانتظار',
        newValue: targetUser.nameAr,
        reason,
        propertyId: task.propertyId,
        deviceName,
      }
    );
    this.addNotification(
      `إعادة إسناد مهمة إليك: ${task.title}`,
      `Task reassigned to you: ${task.title}`,
      `أُسندت المهمة إلى ${targetUser.nameAr} من قِبل ${user.nameAr}`,
      `Reassigned to ${targetUser.nameEn} by ${user.nameEn}`,
      'تشغيلية',
      [targetUser.role],
      'team'
    );
    this.persist();
    return task;
  }

  public reviewTask(
    userId: string,
    taskId: string,
    decision: 'approve' | 'reject',
    reason?: string,
    deviceName?: string
  ): TaskItem {
    const user = this.assertPermission(userId, 'approve_expense_supervisor');
    const task = this.state.tasks.find((t) => t.id === taskId);
    if (!task) throw new Error('المهمة غير موجودة');
    const oldStatus = task.status;
    const now = new Date().toISOString();
    const assignee = this.state.users.find((u) => u.id === task.assignedTo);

    if (decision === 'approve') {
      task.status = 'مكتملة';
      task.approvedBy = user.id;
      task.approvedAt = now;
      task.completedAt = task.completedAt || now;
      task.rejectedReason = undefined;
      task.preArchiveStatus = oldStatus;
      task.archivedAt = task.archivedAt || now;
      task.archivedBy = user.id;
      task.archiveMode = 'تلقائي';
      task.archiveReason = reason || 'اعتماد وإغلاق المهمة بعد مراجعة المشرف';
      if (assignee) {
        this.addNotification(
          `تم اعتماد المهمة: ${task.title}`,
          `Task approved: ${task.title}`,
          `اعتمد ${user.nameAr} إنجاز المهمة وأُغلقت في الأرشيف.`,
          `${user.nameEn} approved task completion.`,
          'تشغيلية',
          [assignee.role],
          'team'
        );
      }
    } else {
      task.status = 'قيد التنفيذ';
      task.rejectedReason = reason || 'يرجى استكمال الملاحظات وإعادة الرفع للمراجعة';
      task.comments.push({
        id: uid('cmt'),
        authorName: user.nameAr,
        text: `ملاحظة مراجعة: ${task.rejectedReason}`,
        createdAt: now,
      });
      if (assignee) {
        this.addNotification(
          `إعادة مهمة للاستكمال: ${task.title}`,
          `Task returned for follow-up: ${task.title}`,
          `ملاحظة ${user.nameAr}: ${task.rejectedReason}`,
          `Review note: ${task.rejectedReason}`,
          'تشغيلية',
          [assignee.role],
          'team'
        );
      }
    }

    this.addAudit(
      user,
      decision === 'approve' ? 'اعتماد وإغلاق مهمة' : 'إرجاع مهمة للمراجعة',
      'TaskItem',
      task.id,
      `${decision === 'approve' ? 'اعتماد' : 'إرجاع'} المهمة "${task.title}"`,
      { oldValue: oldStatus, newValue: task.status, reason, propertyId: task.propertyId, deviceName }
    );
    this.persist();
    return task;
  }

  // 8. Documents, Communications, Vendors, Permissions, Backups
  public addCommunication(userId: string, input: Omit<CommunicationLog, 'id' | 'sentBy' | 'createdAt'>, deviceName?: string): CommunicationLog {
    const user = this.getActingUser(userId);
    const log: CommunicationLog = {
      ...input,
      id: uid('com'),
      sentBy: user.id,
      createdAt: new Date().toISOString(),
    };
    this.state.communications.unshift(log);
    this.addAudit(user, 'تسجيل مراسلة', 'Communication', log.id, `تسجيل ${log.channel} مع ${log.targetName}`, {
      deviceName,
    });
    this.persist();
    return log;
  }

  public addDocument(userId: string, input: Omit<DocumentRecord, 'id' | 'uploadedBy' | 'createdAt'>, deviceName?: string): DocumentRecord {
    const user = this.assertPermission(userId, 'manage_documents');
    const doc: DocumentRecord = {
      ...input,
      id: uid('doc'),
      uploadedBy: user.id,
      createdAt: new Date().toISOString(),
    };
    const writtenPath = this.writeDocumentToDisk(doc);
    if (writtenPath) doc.diskPath = writtenPath;
    this.state.documents.unshift(doc);
    this.addAudit(user, 'أرشفة مستند', 'Document', doc.id, `رفع المستند "${doc.title}" (${doc.category})`, { deviceName });
    this.persist();
    return doc;
  }

  public createVendor(userId: string, input: Omit<Vendor, 'id'>, deviceName?: string): Vendor {
    const user = this.assertPermission(userId, 'manage_maintenance');
    const vendor: Vendor = { ...input, id: uid('vnd') };
    this.state.vendors.push(vendor);
    this.addAudit(user, 'إضافة مقاول/مورد', 'Vendor', vendor.id, `إضافة المورد ${vendor.nameAr}`, { deviceName });
    this.persist();
    return vendor;
  }

  public toggleRolePermission(userId: string, role: RoleKey, permission: PermissionKey, deviceName?: string): Record<RoleKey, PermissionKey[]> {
    const user = this.assertPermission(userId, 'manage_users');
    if (user.role !== 'sys_owner' && user.role !== 'gm') {
      throw new Error('تعديل مصفوفة الصلاحيات متاح لمالك النظام أو مدير الشركة فقط');
    }
    if (user.role === role) {
      throw new Error('لا يمكن لأي مستخدم تعديل صلاحيات دوره الحالي لضمان الحوكمة');
    }
    if (user.role === 'gm' && (role === 'sys_owner' || role === 'gm')) {
      throw new Error('يستطيع مدير الشركة تعديل صلاحيات الموظفين التابعين له فقط');
    }
    if (role === 'sys_owner' && permission === 'manage_users') {
      throw new Error('لا يمكن سحب صلاحية إدارة المستخدمين من مالك النظام');
    }
    const list = this.state.rolePermissions[role] || [];
    if (list.includes(permission)) {
      this.state.rolePermissions[role] = list.filter((p) => p !== permission);
    } else {
      this.state.rolePermissions[role] = [...list, permission];
    }
    this.addAudit(
      user,
      'تعديل مصفوفة الصلاحيات',
      'RolePermissions',
      role,
      `تعديل صلاحية ${permission} للدور ${role}`,
      { deviceName }
    );
    this.persist();
    return this.state.rolePermissions;
  }

  public markNotificationsRead(userId: string): void {
    for (const n of this.state.notifications) {
      if (!n.isReadBy.includes(userId)) n.isReadBy.push(userId);
    }
    this.persist();
  }

  public createBackup(
    userId: string,
    label?: string,
    deviceName?: string,
    encryptPassword?: string
  ): BackupSnapshot {
    const user = this.assertPermission(userId, 'backup_restore');
    ensureWorkspaceDirs(this.paths);
    const id = uid('bkp');
    const json = JSON.stringify(this.state, null, 2);
    const shouldEncrypt = Boolean(this.state.settings.backupPolicy?.encryptBackups || encryptPassword?.trim());
    const ext = shouldEncrypt ? '.enc.json' : '.json';
    const payloadToWrite = shouldEncrypt
      ? encryptBackupPayload(json, encryptPassword?.trim() || 'AqarBackup@2026')
      : json;

    const defaultPath = path.join(this.paths.backupDir, `${id}${ext}`);
    fs.writeFileSync(defaultPath, payloadToWrite, 'utf-8');
    const targetDir = this.getBackupsDir();
    if (targetDir !== this.paths.backupDir) {
      try {
        fs.mkdirSync(targetDir, { recursive: true });
        fs.writeFileSync(path.join(targetDir, `${id}${ext}`), payloadToWrite, 'utf-8');
      } catch {
        // Keep local backup even if external/NAS target is unreachable
      }
    }

    const recordCount =
      this.state.properties.length +
      this.state.units.length +
      this.state.tenants.length +
      this.state.contracts.length +
      this.state.payments.length +
      this.state.expenses.length +
      this.state.tickets.length;

    const snap: BackupSnapshot = {
      id,
      label: label || `نسخة احتياطية ${shouldEncrypt ? 'مشفرة ' : 'يدوية '}· ${new Date().toLocaleDateString('ar-SA')}`,
      createdAt: new Date().toISOString(),
      createdBy: user.nameAr,
      recordCount,
      sizeKb: Math.max(1, Math.round(Buffer.byteLength(payloadToWrite, 'utf-8') / 1024)),
      encrypted: shouldEncrypt,
    };
    this.state.backups.unshift(snap);
    this.addAudit(
      user,
      shouldEncrypt ? 'إنشاء نسخة احتياطية مشفرة AES-256' : 'إنشاء نسخة احتياطية',
      'Backup',
      snap.id,
      `حفظ نسخة احتياطية (${snap.sizeKb} KB${shouldEncrypt ? ' · AES-256-GCM' : ''})`,
      { deviceName }
    );
    this.persist();
    return snap;
  }

  public restoreBackup(
    userId: string,
    backupId: string,
    deviceName?: string,
    mode: 'replace' | 'merge' = 'replace',
    password?: string
  ): AqarDatabaseState {
    const user = this.assertPermission(userId, 'backup_restore');
    const filePath = this.resolveBackupFile(backupId);
    if (!filePath) {
      throw new Error('ملف النسخة الاحتياطية غير موجود على الخادم (جرب إنشاء نسخة جديدة أولاً)');
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const decryptedRaw = isEncryptedBackupEnvelope(raw) ? decryptBackupPayload(raw, password) : raw;
    const restored = JSON.parse(decryptedRaw) as AqarDatabaseState;

    // Create automatic safety snapshot before destructive replace/merge
    try {
      this.createBackup(userId, `نسخة أمان تلقائية قبل الاستعادة (${backupId})`, deviceName);
    } catch {
      // Do not block restore if safety snapshot fails
    }

    const currentBackups = this.state.backups;

    if (mode === 'merge') {
      const mergeArrays = <T extends { id: string }>(current: T[] = [], incoming: T[] = []): T[] => {
        const ids = new Set(current.map((x) => x.id));
        return [...current, ...incoming.filter((x) => !ids.has(x.id))];
      };
      this.state.properties = mergeArrays(this.state.properties, restored.properties);
      this.state.units = mergeArrays(this.state.units, restored.units);
      this.state.tenants = mergeArrays(this.state.tenants, restored.tenants);
      this.state.contracts = mergeArrays(this.state.contracts, restored.contracts);
      this.state.installments = mergeArrays(this.state.installments, restored.installments);
      this.state.payments = mergeArrays(this.state.payments, restored.payments);
      this.state.expenses = mergeArrays(this.state.expenses, restored.expenses);
      this.state.tickets = mergeArrays(this.state.tickets, restored.tickets);
      this.state.tasks = mergeArrays(this.state.tasks, restored.tasks);
      this.state.documents = mergeArrays(this.state.documents, restored.documents);
      this.state.vendors = mergeArrays(this.state.vendors, restored.vendors);
      this.state.owners = mergeArrays(this.state.owners, restored.owners);
      this.state.accounts = mergeArrays(this.state.accounts, restored.accounts);
      this.state.journals = mergeArrays(this.state.journals, restored.journals);
      this.state.communicationTemplates = mergeArrays(
        this.state.communicationTemplates || [],
        restored.communicationTemplates || []
      );
      this.state.reminderRules = mergeArrays(this.state.reminderRules || [], restored.reminderRules || []);
      this.state.zatcaInvoices = mergeArrays(this.state.zatcaInvoices || [], restored.zatcaInvoices || []);
      this.state.meterReadings = mergeArrays(this.state.meterReadings || [], restored.meterReadings || []);
      if (restored.counters) {
        this.state.counters = {
          receipt: Math.max(this.state.counters.receipt, restored.counters.receipt || 0),
          contract: Math.max(this.state.counters.contract, restored.counters.contract || 0),
          ticket: Math.max(this.state.counters.ticket, restored.counters.ticket || 0),
          expense: Math.max(this.state.counters.expense, restored.counters.expense || 0),
          journal: Math.max(this.state.counters.journal, restored.counters.journal || 0),
        };
      }
      this.addAudit(
        user,
        'دمج ذكي من نسخة احتياطية',
        'Backup',
        backupId,
        'تم دمج السجلات الجديدة من النسخة الاحتياطية مع الإبقاء على البيانات الحالية',
        { deviceName }
      );
    } else {
      this.state = restored;
      this.state.backups = currentBackups;
      this.sqlite.ensureSeedCredentials(this.state.users);
      this.addAudit(
        user,
        'استعادة نسخة احتياطية (استبدال كامل)',
        'Backup',
        backupId,
        'تمت استعادة النظام واستبدال الحالة الحالية بالنسخة المختارة',
        { deviceName }
      );
    }
    this.persist();
    return this.state;
  }

  // 9. Automated Rent Due Reminder Scheduler (Linked to Contracts)
  public createReminderRule(
    userId: string,
    input: Omit<ReminderRule, 'id' | 'createdBy' | 'createdAt'>,
    deviceName?: string
  ): ReminderRule {
    const user = this.assertPermission(userId, 'manage_contracts');
    if (!this.state.reminderRules) this.state.reminderRules = [];
    const rule: ReminderRule = {
      ...input,
      id: uid('rem'),
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };
    this.state.reminderRules.unshift(rule);
    this.addAudit(user, 'إنشاء قاعدة جدولة تنبيهات', 'ReminderRule', rule.id, `جدولة تنبيه إيجار: ${rule.nameAr}`, {
      deviceName,
      newValue: `${rule.daysBeforeDue} يوم · ${rule.channels.join(', ')}`,
    });
    this.persist();
    return rule;
  }

  public toggleReminderRule(userId: string, ruleId: string, enabled: boolean, deviceName?: string): ReminderRule {
    const user = this.assertPermission(userId, 'manage_contracts');
    const rule = (this.state.reminderRules || []).find((r) => r.id === ruleId);
    if (!rule) throw new Error('قاعدة الجدولة غير موجودة');
    rule.enabled = enabled;
    this.addAudit(
      user,
      'تعديل حالة جدولة التنبيه',
      'ReminderRule',
      rule.id,
      `${enabled ? 'تفعيل' : 'إيقاف'} قاعدة التنبيه: ${rule.nameAr}`,
      { deviceName }
    );
    this.persist();
    return rule;
  }

  public deleteReminderRule(userId: string, ruleId: string, deviceName?: string): void {
    const user = this.assertPermission(userId, 'manage_contracts');
    this.state.reminderRules = (this.state.reminderRules || []).filter((r) => r.id !== ruleId);
    this.addAudit(user, 'حذف قاعدة جدولة تنبيهات', 'ReminderRule', ruleId, `حذف قاعدة تنبيه مجدولة`, { deviceName });
    this.persist();
  }

  public runReminderScheduler(
    userId: string,
    opts?: {
      contractId?: string;
      ruleId?: string;
      channels?: ReminderChannel[];
      customMessage?: string;
    },
    deviceName?: string
  ): ReminderDispatchLog[] {
    const user = this.getActingUser(userId);
    if (!this.state.reminderRules) this.state.reminderRules = [];
    if (!this.state.reminderLogs) this.state.reminderLogs = [];

    const nowIso = new Date().toISOString();
    const todayMs = new Date('2026-11-14T00:00:00Z').getTime();
    const createdLogs: ReminderDispatchLog[] = [];

    const openInstallments = this.state.installments.filter((i) => {
      if (i.remainingAmount <= 0 || i.status === 'ملغاة') return false;
      if (opts?.contractId && i.contractId !== opts.contractId) return false;
      const ctr = this.state.contracts.find((c) => c.id === i.contractId);
      return ctr && (ctr.lifecycleStatus === 'نشط' || ctr.lifecycleStatus === 'بانتظار التجديد');
    });

    const activeRules = opts?.ruleId
      ? this.state.reminderRules.filter((r) => r.id === opts.ruleId)
      : this.state.reminderRules.filter((r) => r.enabled);

    // Direct manual / contract-scoped dispatch if custom channels provided or single contract triggered
    if (opts?.contractId && opts?.channels && opts.channels.length > 0) {
      const targetInst = openInstallments[0];
      const ctr = this.state.contracts.find((c) => c.id === opts.contractId);
      if (!ctr) throw new Error('العقد غير موجود');
      const tenant = this.state.tenants.find((t) => t.id === ctr.tenantId);
      const unit = this.state.units.find((u) => u.id === ctr.unitId);
      const curr: CurrencyCode = targetInst?.currency || ctr.currency || 'SAR';
      const amt = targetInst ? targetInst.remainingAmount : 0;
      const dueStr = targetInst ? targetInst.dueDate : ctr.endDate;

      for (const ch of opts.channels) {
        const msg = (
          opts.customMessage ||
          `تذكير تلقائي من AqarPlus: عزيزي ${tenant?.nameAr || ''}, يستحق القسط رقم ${targetInst?.installmentNumber || 1} لعقد ${ctr.internalNumber} (وحدة ${unit?.unitNumber || ''}) بمبلغ ${amt.toLocaleString()} ${currencyLabelAr(curr)} بتاريخ ${dueStr}.`
        )
          .replace(/\{tenant\}/g, tenant?.nameAr || '')
          .replace(/\{contract\}/g, ctr.internalNumber)
          .replace(/\{unit\}/g, unit?.unitNumber || '')
          .replace(/\{installment\}/g, String(targetInst?.installmentNumber || 1))
          .replace(/\{amount\}/g, `${amt.toLocaleString()} ${currencyLabelAr(curr)}`)
          .replace(/\{dueDate\}/g, dueStr);

        const recipient = ch === 'بريد إلكتروني' ? tenant?.email || '—' : tenant?.phone || '—';
        const log: ReminderDispatchLog = {
          id: uid('rlog'),
          ruleId: opts.ruleId || 'manual-contract',
          ruleName: opts.ruleId
            ? activeRules[0]?.nameAr || 'تنبيه عقد فوري'
            : `إشعار مجدول للعقد ${ctr.internalNumber}`,
          contractId: ctr.id,
          installmentId: targetInst?.id || ctr.id,
          tenantId: ctr.tenantId,
          tenantName: tenant?.nameAr || '—',
          channel: ch,
          recipient,
          messagePreview: msg,
          dueDate: dueStr,
          amount: amt,
          currency: curr,
          status: 'تم الإرسال (محاكاة)',
          sentAt: nowIso,
        };
        this.state.reminderLogs.unshift(log);
        createdLogs.push(log);

        this.state.communications.unshift({
          id: uid('com'),
          targetType: 'مستأجر',
          targetId: ctr.tenantId,
          targetName: tenant?.nameAr || '—',
          channel: ch === 'بريد إلكتروني' ? 'بريد إلكتروني' : 'رسالة نصية / واتساب',
          templateUsed: 'تذكير استحقاق الإيجار المجدول',
          language: 'ar',
          summary: `[${ch}] ${msg}`,
          sentBy: user.id,
          createdAt: nowIso,
        });
      }
    } else {
      for (const rule of activeRules) {
        for (const inst of openInstallments) {
          if (rule.contractId && rule.contractId !== inst.contractId) continue;
          if (rule.propertyId && rule.propertyId !== 'all' && rule.propertyId !== inst.propertyId) continue;

          const dueMs = new Date(`${inst.dueDate}T00:00:00Z`).getTime();
          const daysDiff = Math.ceil((dueMs - todayMs) / 86400000);
          if (daysDiff > rule.daysBeforeDue) continue;

          const ctr = this.state.contracts.find((c) => c.id === inst.contractId);
          const tenant = this.state.tenants.find((t) => t.id === inst.tenantId);
          const unit = this.state.units.find((u) => u.id === inst.unitId);
          const curr: CurrencyCode = inst.currency || ctr?.currency || 'SAR';

          for (const ch of rule.channels) {
            const msg = rule.templateAr
              .replace(/\{tenant\}/g, tenant?.nameAr || '')
              .replace(/\{contract\}/g, ctr?.internalNumber || '')
              .replace(/\{unit\}/g, unit?.unitNumber || '')
              .replace(/\{installment\}/g, String(inst.installmentNumber))
              .replace(/\{amount\}/g, `${inst.remainingAmount.toLocaleString()} ${currencyLabelAr(curr)}`)
              .replace(/\{dueDate\}/g, inst.dueDate);

            const recipient = ch === 'بريد إلكتروني' ? tenant?.email || '—' : tenant?.phone || '—';
            const log: ReminderDispatchLog = {
              id: uid('rlog'),
              ruleId: rule.id,
              ruleName: rule.nameAr,
              contractId: inst.contractId,
              installmentId: inst.id,
              tenantId: inst.tenantId,
              tenantName: tenant?.nameAr || '—',
              channel: ch,
              recipient,
              messagePreview: msg,
              dueDate: inst.dueDate,
              amount: inst.remainingAmount,
              currency: curr,
              status: 'تم الإرسال (محاكاة)',
              sentAt: nowIso,
            };
            this.state.reminderLogs.unshift(log);
            createdLogs.push(log);

            this.state.communications.unshift({
              id: uid('com'),
              targetType: 'مستأجر',
              targetId: inst.tenantId,
              targetName: tenant?.nameAr || '—',
              channel: ch === 'بريد إلكتروني' ? 'بريد إلكتروني' : 'رسالة نصية / واتساب',
              templateUsed: rule.nameAr,
              language: 'ar',
              summary: `[${ch}] ${msg}`,
              sentBy: user.id,
              createdAt: nowIso,
            });
          }
        }
        rule.lastRunAt = nowIso;
      }
    }

    if (this.state.reminderLogs.length > 200) {
      this.state.reminderLogs = this.state.reminderLogs.slice(0, 200);
    }

    if (createdLogs.length > 0) {
      this.addAudit(
        user,
        'تشغيل جدولة تنبيهات الإيجار',
        'ReminderScheduler',
        opts?.contractId || 'all',
        `تم إرسال ${createdLogs.length} تنبيه استحقاق إيجار تلقائي للمستأجرين`,
        { deviceName }
      );
      this.addNotification(
        `إرسال ${createdLogs.length} تنبيه استحقاق إيجار`,
        `Dispatched ${createdLogs.length} rent reminders`,
        `تم توثيق تنبيهات الإيجار المجدولة عبر البريد / SMS / واتساب في سجل التواصل.`,
        `Automated rent reminders recorded in communication logs.`,
        'مالية',
        ['gm', 'accountant', 'leasing'],
        'leasing'
      );
    }
    this.persist();
    return createdLogs;
  }

  // 10. Multi-Company & Settings Management
  public createCompany(userId: string, input: Omit<CompanyProfile, 'id'>, deviceName?: string): CompanyProfile {
    const user = this.assertPermission(userId, 'manage_users');
    if (!this.state.companies) this.state.companies = [];
    const comp: CompanyProfile = {
      ...input,
      id: uid('comp'),
    };
    this.state.companies.push(comp);
    this.addAudit(user, 'إضافة شركة عقارية', 'CompanyProfile', comp.id, `إضافة الشركة ${comp.nameAr} (سجل: ${comp.crNumber})`, {
      deviceName,
    });
    this.persist();
    return comp;
  }

  public updateSettings(userId: string, patch: Partial<CompanySettings>, deviceName?: string): CompanySettings {
    const user = this.assertPermission(userId, 'manage_users');
    const prev = this.state.settings;
    this.state.settings = {
      ...prev,
      ...patch,
      baseCurrency: 'SAR',
      currencyRatesToSar: RATES_TO_SAR,
      receiptBranding: patch.receiptBranding
        ? { ...(prev.receiptBranding || {}), ...patch.receiptBranding } as CompanySettings['receiptBranding']
        : prev.receiptBranding,
      generalPrefs: patch.generalPrefs
        ? { ...(prev.generalPrefs || {}), ...patch.generalPrefs } as CompanySettings['generalPrefs']
        : prev.generalPrefs,
      securityCenter: patch.securityCenter
        ? { ...(prev.securityCenter || {}), ...patch.securityCenter } as CompanySettings['securityCenter']
        : prev.securityCenter,
      notificationsCenter: patch.notificationsCenter
        ? { ...(prev.notificationsCenter || {}), ...patch.notificationsCenter } as CompanySettings['notificationsCenter']
        : prev.notificationsCenter,
      printShare: patch.printShare
        ? { ...(prev.printShare || {}), ...patch.printShare } as CompanySettings['printShare']
        : prev.printShare,
      backupPolicy: patch.backupPolicy
        ? { ...(prev.backupPolicy || {}), ...patch.backupPolicy } as CompanySettings['backupPolicy']
        : prev.backupPolicy,
      syncCenter: patch.syncCenter
        ? { ...(prev.syncCenter || {}), ...patch.syncCenter } as CompanySettings['syncCenter']
        : prev.syncCenter,
      developerCenter: patch.developerCenter
        ? { ...(prev.developerCenter || {}), ...patch.developerCenter } as CompanySettings['developerCenter']
        : prev.developerCenter,
    };

    const defaultComp = (this.state.companies || []).find((c) => c.isDefault) || this.state.companies?.[0];
    if (defaultComp) {
      if (patch.nameAr) defaultComp.nameAr = patch.nameAr;
      if (patch.nameEn) defaultComp.nameEn = patch.nameEn;
      if (patch.crNumber) defaultComp.crNumber = patch.crNumber;
      if (patch.vatNumber) defaultComp.vatNumber = patch.vatNumber;
      if (patch.city) defaultComp.city = patch.city;
      if (patch.address) defaultComp.address = patch.address;
      if (patch.phone) defaultComp.phone = patch.phone;
      if (patch.email) defaultComp.email = patch.email;
      if (patch.logoDataUrl !== undefined) defaultComp.logoDataUrl = patch.logoDataUrl;
    }

    if (patch.securityCenter?.autoLockTiming && this.state.securityPolicy) {
      const minsMap: Record<string, number> = { immediate: 0, '1m': 1, '5m': 5, '15m': 15, '30m': 30 };
      if (patch.securityCenter.autoLockTiming in minsMap) {
        this.state.securityPolicy.autoLockMinutes = minsMap[patch.securityCenter.autoLockTiming];
      }
    }

    this.addAudit(
      user,
      'تحديث إعدادات النظام والمركز',
      'CompanySettings',
      'settings',
      `تحديث إعدادات المنشأة والعملة الأساسية (${this.state.settings.baseCurrency || 'SAR'})`,
      { deviceName }
    );
    this.persist();
    return this.state.settings;
  }

  // 11. Document Archive Access Log & OCR Attachment
  public recordDocumentAccess(
    userId: string,
    docId: string,
    action: DocumentAccessEntry['action'],
    deviceName?: string
  ): DocumentRecord {
    const user = this.getActingUser(userId);
    const doc = this.state.documents.find((d) => d.id === docId);
    if (!doc) throw new Error('المستند غير موجود');
    if (!doc.accessLog) doc.accessLog = [];
    const entry: DocumentAccessEntry = {
      id: uid('dacc'),
      userId: user.id,
      userName: user.nameAr,
      deviceName: deviceName || user.deviceName,
      action,
      accessedAt: new Date().toISOString(),
    };
    doc.accessLog.unshift(entry);
    if (doc.accessLog.length > 50) doc.accessLog = doc.accessLog.slice(0, 50);
    this.addAudit(user, `${action} مستند`, 'Document', doc.id, `${action} المستند "${doc.title}"`, { deviceName });
    this.persist();
    return doc;
  }

  public attachDocumentOcr(
    userId: string,
    docId: string,
    ocrExtracted: OcrExtractedData,
    ocrRawText: string,
    deviceName?: string
  ): DocumentRecord {
    const user = this.assertPermission(userId, 'manage_documents');
    const doc = this.state.documents.find((d) => d.id === docId);
    if (!doc) throw new Error('المستند غير موجود');
    doc.ocrStatus = 'تم الاستخراج آلياً';
    doc.ocrExtracted = ocrExtracted;
    doc.ocrRawText = ocrRawText;
    if (!doc.expiryDate && ocrExtracted.expiryDate) {
      doc.expiryDate = ocrExtracted.expiryDate;
    }
    this.recordDocumentAccess(user.id, doc.id, 'تحليل OCR', deviceName);
    this.persist();
    return doc;
  }

  // 12. Owner Payout Transfers (تحويل مستحقات الملاك + قيد محاسبي متوازن)
  public recordOwnerTransfer(
    userId: string,
    ownerId: string,
    input: {
      amount: number;
      currency?: CurrencyCode;
      paymentMethod?: PaymentMethod;
      referenceNumber?: string;
      notes?: string;
    },
    deviceName?: string
  ) {
    return this.runTransaction(() => {
    const user = this.assertPermission(userId, 'manage_accounting');
    const owner = this.state.owners.find((o) => o.id === ownerId);
    if (!owner) throw new Error('المالك غير موجود');
    if (!input.amount || input.amount <= 0) throw new Error('يجب إدخال مبلغ تحويل أكبر من صفر');

    const curr: CurrencyCode = input.currency || 'SAR';
    const amountSar = toSar(input.amount, curr, this.state.settings.currencyRatesToSar);

    owner.totalTransferred = Math.round((owner.totalTransferred + amountSar) * 100) / 100;

    const cashAccountId = input.paymentMethod === 'نقدي' ? 'acc-1010' : 'acc-1020';
    const cashAcc = this.state.accounts.find((a) => a.id === cashAccountId) || this.state.accounts[0];
    const payableAcc = this.state.accounts.find((a) => a.id === 'acc-2200');

    if (cashAcc) cashAcc.balance = Math.round((cashAcc.balance - amountSar) * 100) / 100;
    if (payableAcc) payableAcc.balance = Math.round((payableAcc.balance - amountSar) * 100) / 100;

    this.state.counters.journal += 1;
    const journal: JournalEntry = {
      id: uid('jrn'),
      entryNumber: `JRN-2026-${pad4(this.state.counters.journal)}`,
      date: new Date().toISOString().slice(0, 10),
      description: `تحويل مستحقات للمالك ${owner.nameAr} (${input.paymentMethod || 'تحويل بنكي'}${input.referenceNumber ? ` · مرجع ${input.referenceNumber}` : ''})${input.notes ? ` - ${input.notes}` : ''}`,
      referenceType: 'تحويل مالك',
      referenceId: owner.id,
      ownerId: owner.id,
      createdBy: user.id,
      lines: [
        { accountId: 'acc-2200', accountName: payableAcc?.nameAr || 'مستحقات الملاك', debit: amountSar, credit: 0 },
        { accountId: cashAcc.id, accountName: cashAcc.nameAr, debit: 0, credit: amountSar },
      ],
    };
    this.state.journals.unshift(journal);

    this.addAudit(
      user,
      'تحويل مستحقات مالك',
      'Owner',
      owner.id,
      `تحويل مبلغ ${input.amount.toLocaleString()} ${currencyLabelAr(curr)} (${amountSar.toLocaleString()} ر.س) للمالك ${owner.nameAr}`,
      { deviceName, newValue: `${amountSar} ر.س` }
    );
    this.addNotification(
      `تحويل مستحقات للمالك ${owner.nameAr}`,
      `Payout transferred to ${owner.nameEn}`,
      `تم تسجيل تحويل مالي بقيمة ${input.amount.toLocaleString()} ${currencyLabelAr(curr)} وتحديث كشف حساب المالك.`,
      `Transferred ${input.amount.toLocaleString()} ${curr} to owner account.`,
      'مالية',
      ['gm', 'accountant', 'owner'],
      'accounting'
    );
    this.persist();
    return { owner, journal };
    });
  }

  // 13. Fast Contract Renewal (التجديد دون تكرار الإدخال)
  public renewContract(
    userId: string,
    contractId: string,
    input: {
      startDate: string;
      endDate: string;
      annualRent: number;
      currency?: CurrencyCode;
      paymentFrequency: LeaseContract['paymentFrequency'];
      ejarNumber?: string;
      notes?: string;
    },
    deviceName?: string
  ): { contract: LeaseContract; installments: Installment[] } {
    return this.runTransaction(() => {
    const user = this.assertPermission(userId, 'manage_contracts');
    const prev = this.contractIndex.get(contractId) || this.state.contracts.find((c) => c.id === contractId);
    if (!prev) throw new Error('العقد الأساسي غير موجود');

    if (prev.lifecycleStatus === 'نشط' || prev.lifecycleStatus === 'بانتظار التجديد') {
      prev.lifecycleStatus = 'منتهي';
    }

    const freqMap: Record<LeaseContract['paymentFrequency'], number> = {
      شهري: 12,
      'ربع سنوي': 4,
      'نصف سنوي': 2,
      سنوي: 1,
    };
    const count = freqMap[input.paymentFrequency] || 2;
    this.state.counters.contract += 1;
    const contractCurrency: CurrencyCode = input.currency || prev.currency || 'SAR';

    const renewed: LeaseContract = {
      id: uid('ctr'),
      internalNumber: `CNT-2026-${pad3(this.state.counters.contract)}`,
      ejarNumber: input.ejarNumber || '',
      ejarStatus: input.ejarNumber ? 'موثق في إيجار' : 'قيد التوثيق',
      lifecycleStatus: 'نشط',
      propertyId: prev.propertyId,
      unitId: prev.unitId,
      tenantId: prev.tenantId,
      startDate: input.startDate,
      endDate: input.endDate,
      annualRent: input.annualRent,
      currency: contractCurrency,
      paymentFrequency: input.paymentFrequency,
      installmentsCount: count,
      securityDeposit: prev.securityDeposit,
      officeFee: 0,
      managementCommissionPercent: prev.managementCommissionPercent,
      includedServices: prev.includedServices,
      version: prev.version + 1,
      renewedFromContractId: prev.id,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
      notes: input.notes || `تجديد مباشر للعقد ${prev.internalNumber}`,
    };
    this.state.contracts.unshift(renewed);

    const start = new Date(renewed.startDate);
    const perInst = Math.round((renewed.annualRent / count) * 100) / 100;
    const createdInstallments: Installment[] = [];
    const todayStr = new Date().toISOString().slice(0, 10);

    for (let i = 0; i < count; i++) {
      const due = new Date(start);
      due.setMonth(due.getMonth() + i * (12 / count));
      const dueStr = due.toISOString().slice(0, 10);
      const amt = i === count - 1 ? Math.round((renewed.annualRent - perInst * (count - 1)) * 100) / 100 : perInst;
      const inst: Installment = {
        id: uid('inst'),
        contractId: renewed.id,
        unitId: renewed.unitId,
        propertyId: renewed.propertyId,
        tenantId: renewed.tenantId,
        installmentNumber: i + 1,
        dueDate: dueStr,
        amount: amt,
        paidAmount: 0,
        remainingAmount: amt,
        currency: contractCurrency,
        status: dueStr < todayStr ? 'متأخرة' : dueStr === todayStr ? 'مستحقة اليوم' : 'لم تستحق',
      };
      this.state.installments.push(inst);
      createdInstallments.push(inst);
    }

    const unit = this.state.units.find((u) => u.id === renewed.unitId);
    if (unit) unit.status = 'مؤجرة';

    this.addAudit(
      user,
      'تجديد عقد إيجار',
      'LeaseContract',
      renewed.id,
      `تجديد العقد ${prev.internalNumber} إلى ${renewed.internalNumber} (إصدار v${renewed.version}) بقيمة ${renewed.annualRent.toLocaleString()} ${currencyLabelAr(contractCurrency)}`,
      { deviceName, oldValue: prev.internalNumber, newValue: renewed.internalNumber }
    );
    this.persist();
    return { contract: renewed, installments: createdInstallments };
    });
  }

  // 14. Purchase Orders & Contractor Quotes
  public createPurchaseOrder(
    userId: string,
    input: Omit<PurchaseOrder, 'id' | 'poNumber' | 'createdBy' | 'createdAt'>,
    deviceName?: string
  ): PurchaseOrder {
    const user = this.assertPermission(userId, 'manage_maintenance');
    if (!this.state.purchaseOrders) this.state.purchaseOrders = [];
    const po: PurchaseOrder = {
      ...input,
      id: uid('po'),
      poNumber: `PO-2026-${pad3(this.state.purchaseOrders.length + 1)}`,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };
    this.state.purchaseOrders.unshift(po);
    this.addAudit(user, 'إنشاء طلب شراء ومقارنة عروض', 'PurchaseOrder', po.id, `إنشاء ${po.poNumber}: ${po.title}`, {
      deviceName,
    });
    this.persist();
    return po;
  }

  public updatePurchaseOrder(
    userId: string,
    poId: string,
    patch: Partial<Pick<PurchaseOrder, 'status' | 'selectedVendorId' | 'approvedAmount' | 'quotes'>>,
    deviceName?: string
  ): PurchaseOrder {
    const user = this.getActingUser(userId);
    if (!this.state.purchaseOrders) this.state.purchaseOrders = [];
    const po = this.state.purchaseOrders.find((p) => p.id === poId);
    if (!po) throw new Error('طلب الشراء غير موجود');

    if (patch.status) po.status = patch.status;
    if (patch.selectedVendorId) po.selectedVendorId = patch.selectedVendorId;
    if (typeof patch.approvedAmount === 'number') po.approvedAmount = patch.approvedAmount;
    if (patch.quotes) po.quotes = patch.quotes;
    if (patch.status === 'معتمد' || patch.status === 'أمر شراء') {
      po.approvedBy = user.id;
    }

    this.addAudit(user, 'تحديث طلب شراء', 'PurchaseOrder', po.id, `تحديث ${po.poNumber} إلى الحالة: ${po.status}`, {
      deviceName,
      newValue: po.status,
    });
    this.persist();
    return po;
  }

  // 15. Executive Decisions Log
  public createDecision(
    userId: string,
    input: Omit<ExecutiveDecision, 'id' | 'decisionNumber' | 'issuedBy' | 'issuedByName' | 'createdAt'>,
    deviceName?: string
  ): ExecutiveDecision {
    const user = this.assertPermission(userId, 'manage_users');
    if (!this.state.decisions) this.state.decisions = [];
    const dec: ExecutiveDecision = {
      ...input,
      id: uid('dec'),
      decisionNumber: `DEC-2026-${pad3(this.state.decisions.length + 14)}`,
      issuedBy: user.id,
      issuedByName: user.nameAr,
      createdAt: new Date().toISOString(),
    };
    this.state.decisions.unshift(dec);
    this.addAudit(user, 'إصدار قرار إداري', 'ExecutiveDecision', dec.id, `${dec.decisionNumber}: ${dec.title}`, {
      deviceName,
    });
    this.addNotification(
      `قرار إداري جديد: ${dec.title}`,
      `New Executive Decision: ${dec.title}`,
      dec.summary,
      dec.summary,
      'إدارية',
      ['gm', 'accountant', 'leasing', 'supervisor', 'technician'],
      'admin'
    );
    this.persist();
    return dec;
  }

  // 16. Tenant Onboarding Policy Checklist
  public updateTenantChecklist(
    userId: string,
    tenantId: string,
    checklist: TenantOnboardingChecklist,
    deviceName?: string
  ): Tenant {
    const user = this.assertPermission(userId, 'manage_tenants');
    const tenant = this.state.tenants.find((t) => t.id === tenantId);
    if (!tenant) throw new Error('المستأجر غير موجود');
    tenant.onboardingChecklist = checklist;
    const completedCount = Object.values(checklist).filter(Boolean).length;
    this.addAudit(
      user,
      'تحديث قائمة سياسة التسكين',
      'Tenant',
      tenant.id,
      `اكتمال ${completedCount}/6 بنود تسكين للمستأجر ${tenant.nameAr}`,
      { deviceName }
    );
    this.persist();
    return tenant;
  }

  // 17. Bulk Excel/CSV Import (Units & Tenants)
  public bulkImportRecords(
    userId: string,
    type: 'units' | 'tenants',
    rows: Record<string, unknown>[],
    deviceName?: string
  ): { inserted: number; skipped: number } {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('الملف لا يحتوي على صفوف صالحة للاستيراد');
    }
    let inserted = 0;
    let skipped = 0;

    if (type === 'tenants') {
      const user = this.assertPermission(userId, 'manage_tenants');
      for (const r of rows) {
        const nameAr = String(r.nameAr || r['الاسم'] || r['اسم المستأجر'] || '').trim();
        const nationalIdOrIqama = String(r.nationalIdOrIqama || r['رقم الهوية'] || r['الهوية'] || '').trim();
        const phone = String(r.phone || r['الجوال'] || r['رقم الجوال'] || '').trim();
        if (!nameAr || !nationalIdOrIqama) {
          skipped += 1;
          continue;
        }
        const exists = this.state.tenants.some((t) => t.nationalIdOrIqama === nationalIdOrIqama);
        if (exists) {
          skipped += 1;
          continue;
        }
        this.state.tenants.push({
          id: uid('ten'),
          nameAr,
          nameEn: String(r.nameEn || r['الاسم بالإنجليزية'] || nameAr),
          nationalIdOrIqama,
          nationality: String(r.nationality || r['الجنسية'] || 'سعودي'),
          phone: phone || '0500000000',
          email: String(r.email || r['البريد'] || ''),
          employer: String(r.employer || r['جهة العمل'] || ''),
          classification: 'محتمل',
          rating: 4,
          onboardingChecklist: {
            idVerified: false,
            docsArchived: false,
            depositPaid: false,
            contractSigned: false,
            ejarRegistered: false,
            handoverSigned: false,
          },
          createdAt: new Date().toISOString(),
        });
        inserted += 1;
      }
      this.addAudit(
        user,
        'استيراد جماعي للمستأجرين من Excel',
        'Tenant',
        'bulk',
        `تم استيراد ${inserted} مستأجر وتخطي ${skipped} صف مكرر أو ناقص`,
        { deviceName }
      );
    } else {
      const user = this.assertPermission(userId, 'manage_properties');
      const fallbackPropId = this.state.properties[0]?.id;
      for (const r of rows) {
        const unitNumber = String(r.unitNumber || r['رقم الوحدة'] || r['الوحدة'] || '').trim();
        const propNameOrId = String(r.propertyId || r['العقار'] || '').trim();
        const prop =
          this.state.properties.find((p) => p.id === propNameOrId || p.nameAr === propNameOrId) ||
          this.state.properties.find((p) => p.id === fallbackPropId);
        if (!unitNumber || !prop) {
          skipped += 1;
          continue;
        }
        const exists = this.state.units.some((u) => u.propertyId === prop.id && u.unitNumber === unitNumber);
        if (exists) {
          skipped += 1;
          continue;
        }
        const annual = Number(r.suggestedAnnualRent || r['الإيجار السنوي'] || 36000) || 36000;
        this.state.units.push({
          id: uid('unit'),
          propertyId: prop.id,
          buildingName: String(r.buildingName || r['المبنى'] || 'المبنى الرئيسي'),
          floor: Number(r.floor || r['الدور'] || 1) || 1,
          unitNumber,
          unitType: (String(r.unitType || r['النوع'] || 'شقة') as Unit['unitType']),
          areaSqm: Number(r.areaSqm || r['المساحة'] || 120) || 120,
          rooms: Number(r.rooms || r['الغرف'] || 3) || 3,
          bathrooms: Number(r.bathrooms || r['دورات المياه'] || 2) || 2,
          furnished: Boolean(r.furnished),
          acCount: Number(r.acCount || 3) || 3,
          electricityMeter: String(r.electricityMeter || r['عداد الكهرباء'] || ''),
          waterMeter: String(r.waterMeter || r['عداد المياه'] || ''),
          keyCount: 3,
          acRemoteCount: 3,
          suggestedMonthlyRent: Math.round(annual / 12),
          suggestedAnnualRent: annual,
          officeFee: 1000,
          status: 'شاغرة',
        });
        inserted += 1;
      }
      this.addAudit(
        user,
        'استيراد جماعي للوحدات من Excel',
        'Unit',
        'bulk',
        `تم استيراد ${inserted} وحدة وتخطي ${skipped} صف مكرر أو ناقص`,
        { deviceName }
      );
    }

    this.persist();
    return { inserted, skipped };
  }

  // 18. Gemini OCR Entity Matching & Automatic Field Sync (Tenants & Properties)
  public findOcrEntityMatches(extracted: OcrExtractedData): OcrEntityMatchResult {
    const cleanDigits = (s?: string) => (s || '').replace(/\D+/g, '');
    const norm = (s?: string) => (s || '').trim().toLowerCase();

    const idDigits = cleanDigits(extracted.nationalIdOrIqama);
    const phoneDigits = cleanDigits(extracted.phone);
    const tenantNameNorm = norm(extracted.tenantNameAr);

    let matchedTenant: Tenant | undefined;
    let tenantReason = '';
    if (idDigits.length >= 6) {
      matchedTenant = this.state.tenants.find((t) => cleanDigits(t.nationalIdOrIqama) === idDigits);
      if (matchedTenant) tenantReason = 'مطابقة رقم الهوية / الإقامة';
    }
    if (!matchedTenant && phoneDigits.length >= 8) {
      matchedTenant = this.state.tenants.find((t) => cleanDigits(t.phone).endsWith(phoneDigits.slice(-9)));
      if (matchedTenant) tenantReason = 'مطابقة رقم الجوال';
    }
    if (!matchedTenant && tenantNameNorm.length >= 4) {
      matchedTenant = this.state.tenants.find(
        (t) => norm(t.nameAr) === tenantNameNorm || norm(t.nameAr).includes(tenantNameNorm) || tenantNameNorm.includes(norm(t.nameAr))
      );
      if (matchedTenant) tenantReason = 'مطابقة الاسم بالعربية';
    }

    const tenantFieldsToUpdate: string[] = [];
    if (matchedTenant) {
      if (extracted.tenantNameAr && extracted.tenantNameAr.trim() && matchedTenant.nameAr !== extracted.tenantNameAr.trim()) {
        tenantFieldsToUpdate.push('الاسم بالعربية');
      }
      if (extracted.tenantNameEn && extracted.tenantNameEn.trim() && (!matchedTenant.nameEn || matchedTenant.nameEn === matchedTenant.nameAr)) {
        tenantFieldsToUpdate.push('الاسم بالإنجليزية');
      }
      if (extracted.nationalIdOrIqama && !matchedTenant.nationalIdOrIqama) {
        tenantFieldsToUpdate.push('رقم الهوية/الإقامة');
      }
      if (extracted.nationality && extracted.nationality.trim() && !matchedTenant.nationality) {
        tenantFieldsToUpdate.push('الجنسية');
      }
      if (extracted.phone && (!matchedTenant.phone || matchedTenant.phone === '0500000000')) {
        tenantFieldsToUpdate.push('رقم الجوال');
      }
      if (extracted.email && !matchedTenant.email) {
        tenantFieldsToUpdate.push('البريد الإلكتروني');
      }
      if (extracted.employer && !matchedTenant.employer) {
        tenantFieldsToUpdate.push('جهة العمل');
      }
    }

    const deedDigits = cleanDigits(extracted.deedNumber);
    const propNameNorm = norm(extracted.propertyNameAr || extracted.buildingName);
    let matchedProperty: Property | undefined;
    let propertyReason = '';

    if (deedDigits.length >= 4) {
      matchedProperty = this.state.properties.find((p) => cleanDigits(p.deedNumber) === deedDigits);
      if (matchedProperty) propertyReason = 'مطابقة رقم الصك';
    }
    if (!matchedProperty && propNameNorm.length >= 3) {
      matchedProperty = this.state.properties.find(
        (p) => norm(p.nameAr) === propNameNorm || norm(p.nameAr).includes(propNameNorm) || propNameNorm.includes(norm(p.nameAr))
      );
      if (matchedProperty) propertyReason = 'مطابقة اسم العقار';
    }

    const propertyFieldsToUpdate: string[] = [];
    if (matchedProperty) {
      if (extracted.deedNumber && !matchedProperty.deedNumber) propertyFieldsToUpdate.push('رقم الصك');
      if (extracted.city && !matchedProperty.city) propertyFieldsToUpdate.push('المدينة');
      if (extracted.district && !matchedProperty.district) propertyFieldsToUpdate.push('الحي');
      if (extracted.street && !matchedProperty.street) propertyFieldsToUpdate.push('الشارع');
      if (extracted.nationalAddress && !matchedProperty.nationalAddress) propertyFieldsToUpdate.push('العنوان الوطني');
    }

    let matchedUnit: Unit | undefined;
    if (extracted.unitNumber) {
      const unitNumNorm = norm(extracted.unitNumber);
      matchedUnit = this.state.units.find(
        (u) => (!matchedProperty || u.propertyId === matchedProperty.id) && norm(u.unitNumber) === unitNumNorm
      );
    }

    const hasTenantData = Boolean(extracted.tenantNameAr || extracted.nationalIdOrIqama);
    const hasPropertyData = Boolean(extracted.propertyNameAr || extracted.deedNumber);

    return {
      matchedTenant: matchedTenant
        ? {
            id: matchedTenant.id,
            nameAr: matchedTenant.nameAr,
            nationalIdOrIqama: matchedTenant.nationalIdOrIqama,
            matchReason: tenantReason,
            fieldsToUpdate: tenantFieldsToUpdate,
          }
        : undefined,
      matchedProperty: matchedProperty
        ? {
            id: matchedProperty.id,
            nameAr: matchedProperty.nameAr,
            deedNumber: matchedProperty.deedNumber,
            matchReason: propertyReason,
            fieldsToUpdate: propertyFieldsToUpdate,
          }
        : undefined,
      matchedUnit: matchedUnit
        ? {
            id: matchedUnit.id,
            unitNumber: matchedUnit.unitNumber,
            propertyId: matchedUnit.propertyId,
          }
        : undefined,
      suggestedTenantAction: matchedTenant ? 'update' : hasTenantData ? 'create' : 'none',
      suggestedPropertyAction: matchedProperty ? 'update' : hasPropertyData ? 'create' : 'none',
    };
  }

  public syncOcrToEntities(
    userId: string,
    input: {
      extracted: OcrExtractedData;
      docId?: string;
      targetTenantId?: string;
      targetPropertyId?: string;
      applyTenant?: boolean;
      applyProperty?: boolean;
      createMissing?: boolean;
    },
    deviceName?: string
  ): {
    summary: OcrSyncSummary;
    tenant?: Tenant;
    property?: Property;
    doc?: DocumentRecord;
  } {
    const user = this.assertPermission(userId, 'manage_documents');
    const extracted = input.extracted;
    const matches = this.findOcrEntityMatches(extracted);
    const summary: OcrSyncSummary = {
      tenantAction: 'skipped',
      tenantUpdatedFields: [],
      propertyAction: 'skipped',
      propertyUpdatedFields: [],
    };

    let linkedTenant: Tenant | undefined;
    let linkedProperty: Property | undefined;

    // 1. Sync Tenant Fields (from National ID / Iqama / Lease Contract)
    if (input.applyTenant !== false) {
      const targetId = input.targetTenantId || matches.matchedTenant?.id;
      if (targetId) {
        const tenant = this.state.tenants.find((t) => t.id === targetId);
        if (tenant) {
          const updatedFields: string[] = [];
          if (extracted.tenantNameAr?.trim() && (!tenant.nameAr || tenant.nameAr.length < 3)) {
            tenant.nameAr = extracted.tenantNameAr.trim();
            updatedFields.push('nameAr');
          }
          if (extracted.tenantNameEn?.trim() && (!tenant.nameEn || tenant.nameEn === tenant.nameAr)) {
            tenant.nameEn = extracted.tenantNameEn.trim();
            updatedFields.push('nameEn');
          }
          if (extracted.nationalIdOrIqama?.trim() && !tenant.nationalIdOrIqama) {
            tenant.nationalIdOrIqama = extracted.nationalIdOrIqama.trim();
            updatedFields.push('nationalIdOrIqama');
          }
          if (extracted.nationality?.trim() && (!tenant.nationality || tenant.nationality === 'غير محدد')) {
            tenant.nationality = extracted.nationality.trim();
            updatedFields.push('nationality');
          }
          if (extracted.phone?.trim() && (!tenant.phone || tenant.phone === '0500000000')) {
            tenant.phone = extracted.phone.trim();
            updatedFields.push('phone');
          }
          if (extracted.email?.trim() && !tenant.email) {
            tenant.email = extracted.email.trim();
            updatedFields.push('email');
          }
          if (extracted.employer?.trim() && !tenant.employer) {
            tenant.employer = extracted.employer.trim();
            updatedFields.push('employer');
          }
          if (!tenant.onboardingChecklist) {
            tenant.onboardingChecklist = {
              idVerified: false,
              docsArchived: false,
              depositPaid: false,
              contractSigned: false,
              ejarRegistered: false,
              handoverSigned: false,
            };
          }
          if (extracted.docType === 'هوية / إقامة' || extracted.nationalIdOrIqama) {
            tenant.onboardingChecklist.idVerified = true;
            updatedFields.push('idVerified');
          }
          tenant.onboardingChecklist.docsArchived = true;
          linkedTenant = tenant;
          summary.tenantAction = 'updated';
          summary.tenantId = tenant.id;
          summary.tenantName = tenant.nameAr;
          summary.tenantUpdatedFields = updatedFields;
          this.addAudit(
            user,
            'تحديث بيانات مستأجر آلياً من OCR',
            'Tenant',
            tenant.id,
            `ربط نتائج Gemini OCR بملف المستأجر ${tenant.nameAr} (${updatedFields.join(', ') || 'تأكيد الهوية والأرشفة'})`,
            { deviceName }
          );
        }
      } else if (
        input.createMissing !== false &&
        (extracted.tenantNameAr || extracted.nationalIdOrIqama) &&
        this.userHasPermission(user, 'manage_tenants')
      ) {
        const tenant = this.createTenant(
          userId,
          {
            nameAr: extracted.tenantNameAr?.trim() || `مستأجر ${extracted.nationalIdOrIqama}`,
            nameEn: extracted.tenantNameEn?.trim() || extracted.tenantNameAr?.trim() || '',
            nationalIdOrIqama: extracted.nationalIdOrIqama?.trim() || `TMP-${Date.now().toString().slice(-6)}`,
            nationality: extracted.nationality?.trim() || 'سعودي',
            phone: extracted.phone?.trim() || '0500000000',
            email: extracted.email?.trim() || '',
            employer: extracted.employer?.trim() || '',
            classification: extracted.docType === 'عقد إيجار' ? 'نشط' : 'محتمل',
            rating: 4,
            onboardingChecklist: {
              idVerified: Boolean(extracted.nationalIdOrIqama),
              docsArchived: true,
              depositPaid: false,
              contractSigned: extracted.docType === 'عقد إيجار',
              ejarRegistered: Boolean(extracted.ejarNumber),
              handoverSigned: false,
            },
            notes: `تم إنشاؤه وربط حقوله آلياً عبر Gemini OCR (${extracted.docType})`,
          },
          deviceName
        );
        linkedTenant = tenant;
        summary.tenantAction = 'created';
        summary.tenantId = tenant.id;
        summary.tenantName = tenant.nameAr;
        summary.tenantUpdatedFields = ['nameAr', 'nationalIdOrIqama', 'nationality', 'phone', 'employer'];
      }
    }

    // 2. Sync Property Fields (from Deed / Lease Contract)
    if (input.applyProperty !== false) {
      const targetPropId = input.targetPropertyId || matches.matchedProperty?.id;
      if (targetPropId) {
        const prop = this.state.properties.find((p) => p.id === targetPropId);
        if (prop) {
          const updatedFields: string[] = [];
          if (extracted.deedNumber?.trim() && !prop.deedNumber) {
            prop.deedNumber = extracted.deedNumber.trim();
            updatedFields.push('deedNumber');
          }
          if (extracted.city?.trim() && (!prop.city || prop.city === 'غير محدد')) {
            prop.city = extracted.city.trim();
            updatedFields.push('city');
          }
          if (extracted.district?.trim() && (!prop.district || prop.district === 'غير محدد')) {
            prop.district = extracted.district.trim();
            updatedFields.push('district');
          }
          if (extracted.street?.trim() && !prop.street) {
            prop.street = extracted.street.trim();
            updatedFields.push('street');
          }
          if (extracted.nationalAddress?.trim() && !prop.nationalAddress) {
            prop.nationalAddress = extracted.nationalAddress.trim();
            updatedFields.push('nationalAddress');
          }
          linkedProperty = prop;
          summary.propertyAction = 'updated';
          summary.propertyId = prop.id;
          summary.propertyName = prop.nameAr;
          summary.propertyUpdatedFields = updatedFields;
          this.addAudit(
            user,
            'تحديث بيانات عقار آلياً من OCR',
            'Property',
            prop.id,
            `ربط نتائج Gemini OCR بالعقار ${prop.nameAr} (${updatedFields.join(', ') || 'تحقق الصك والموقع'})`,
            { deviceName }
          );
        }
      } else if (
        input.createMissing !== false &&
        (extracted.propertyNameAr || extracted.deedNumber) &&
        this.userHasPermission(user, 'manage_properties')
      ) {
        const propName = extracted.propertyNameAr?.trim() || extracted.buildingName?.trim() || `عقار صك ${extracted.deedNumber}`;
        const prop = this.createProperty(
          userId,
          {
            companyId: this.state.companies?.[0]?.id,
            ownershipMode: 'إدارة للغير',
            code: `PRP-OCR-${Math.floor(100 + Math.random() * 899)}`,
            nameAr: propName,
            nameEn: propName,
            city: extracted.city?.trim() || 'الرياض',
            district: extracted.district?.trim() || 'غير محدد',
            street: extracted.street?.trim() || '',
            nationalAddress: extracted.nationalAddress?.trim() || '',
            type: 'سكني',
            deedNumber: extracted.deedNumber?.trim() || '',
            status: 'نشط',
            buildingsCount: 1,
            floorsCount: 3,
            managementFeePercent: this.state.settings.defaultManagementFeePercent || 5,
            ownerShares: this.state.owners[0] ? [{ ownerId: this.state.owners[0].id, sharePercent: 100 }] : [],
            electricityMeterMain: '',
            waterMeterMain: '',
            caretakerName: '',
            caretakerPhone: '',
          },
          deviceName
        );
        linkedProperty = prop;
        summary.propertyAction = 'created';
        summary.propertyId = prop.id;
        summary.propertyName = prop.nameAr;
        summary.propertyUpdatedFields = ['nameAr', 'deedNumber', 'city', 'district', 'street', 'nationalAddress'];
      }
    }

    // 3. Link archived document record if docId provided
    let linkedDoc: DocumentRecord | undefined;
    if (input.docId) {
      const doc = this.state.documents.find((d) => d.id === input.docId);
      if (doc) {
        if (linkedTenant && (extracted.docType === 'هوية / إقامة' || !linkedProperty)) {
          doc.relatedType = 'مستأجر';
          doc.relatedId = linkedTenant.id;
        } else if (linkedProperty) {
          doc.relatedType = 'عقار';
          doc.relatedId = linkedProperty.id;
        }
        linkedDoc = doc;
      }
    }

    this.persist();
    return {
      summary,
      tenant: linkedTenant,
      property: linkedProperty,
      doc: linkedDoc,
    };
  }

  public resetToFreshWorkspace(userId: string, deviceName?: string): AqarDatabaseState {
    const user = this.assertPermission(userId, 'manage_properties');
    if (this.state.properties.length > 0 || this.state.payments.length > 0) {
      this.createBackup(userId, 'نسخة تلقائية قبل الإعداد الأولي', deviceName);
    }

    this.state.properties = [];
    this.state.units = [];
    this.state.meterReadings = [];
    this.state.tenants = [];
    this.state.leads = [];
    this.state.leadEscalations = [];
    this.state.contracts = [];
    this.state.handovers = [];
    this.state.installments = [];
    this.state.payments = [];
    this.state.journals = [];
    this.state.expenses = [];
    this.state.supplierInvoices = [];
    this.state.recurringExpenses = [];
    this.state.propertyBudgets = [];
    this.state.assets = [];
    this.state.tickets = [];
    this.state.tasks = [];
    this.state.communications = [];
    this.state.documents = [];
    this.state.purchaseOrders = [];
    this.state.decisions = [];
    this.state.notifications = [];
    this.state.reminderLogs = [];
    this.state.accounts = this.state.accounts.map((acc) => ({ ...acc, balance: 0 }));
    this.state.counters = {
      receipt: 1,
      contract: 1,
      ticket: 1,
      expense: 1,
      journal: 1,
    };

    this.addAudit(
      user,
      'تهيئة مساحة عمل جديدة',
      'Workspace',
      'fresh-onboarding',
      'بدء مساحة عمل نظيفة عبر رحلة الإعداد الأولي',
      { deviceName }
    );
    this.state.archiveSeeded = true;
    this.persist();
    return this.getStateForUser(userId);
  }

  // 14. Smart Archive Center (Manual Archive, Restore with Conflict Check, Scheduled Job, Saved Filters)
  private assertArchiveAccess(user: StaffUser, category: ArchiveCategoryId, action: 'view' | 'write'): void {
    const allowedByRole: Record<RoleKey, ArchiveCategoryId[]> = {
      sys_owner: ['contracts', 'tenants', 'receipts', 'tickets', 'documents', 'units'],
      gm: ['contracts', 'tenants', 'receipts', 'tickets', 'documents', 'units'],
      accountant: ['contracts', 'receipts'],
      supervisor: ['units', 'tenants'],
      leasing: ['tenants'],
      maint_manager: ['tickets', 'units'],
      technician: ['tickets'],
      receptionist: ['tenants', 'documents'],
      auditor: ['contracts', 'tenants', 'receipts', 'tickets', 'documents', 'units'],
      owner: ['contracts', 'receipts', 'units'],
    };
    const allowed = allowedByRole[user.role] || [];
    if (!allowed.includes(category)) {
      throw new Error(`لا تملك صلاحية الوصول إلى قسم الأرشيف (${category})`);
    }
    if (action === 'write' && (user.role === 'owner' || user.role === 'auditor' || (user.role === 'leasing' && category !== 'tenants'))) {
      throw new Error('صلاحيتك في هذا القسم للعرض المرجعي فقط');
    }
  }

  public archiveEntity(
    userId: string,
    input: { category: ArchiveCategoryId; entityId: string; reason?: string; targetKind?: 'ticket' | 'task' },
    deviceName?: string
  ): { archivedAt: string; summary: string } {
    return this.runTransaction(() => {
      const user = this.getActingUser(userId);
      this.assertArchiveAccess(user, input.category, 'write');
      const now = new Date().toISOString();
      const reason = (input.reason || '').trim() || 'نقل يدوي للأرشيف الذكي';
      let summary = '';

      if (input.category === 'contracts') {
        const ctr = this.state.contracts.find((c) => c.id === input.entityId);
        if (!ctr) throw new Error('العقد غير موجود');
        ctr.preArchiveStatus = ctr.lifecycleStatus;
        if (ctr.lifecycleStatus === 'نشط' || ctr.lifecycleStatus === 'بانتظار التجديد' || ctr.lifecycleStatus === 'بانتظار التوثيق') {
          ctr.lifecycleStatus = 'منتهي';
          const unit = this.state.units.find((u) => u.id === ctr.unitId);
          if (unit && unit.status === 'مؤجرة') {
            unit.status = 'شاغرة';
            unit.vacantSince = now.slice(0, 10);
          }
        }
        ctr.archivedAt = now;
        ctr.archivedBy = user.id;
        ctr.archiveMode = 'يدوي';
        ctr.archiveReason = reason;
        summary = `أرشفة العقد ${ctr.internalNumber}`;
      } else if (input.category === 'tenants') {
        const ten = this.state.tenants.find((t) => t.id === input.entityId);
        if (!ten) throw new Error('المستأجر غير موجود');
        const hasActiveCtr = this.state.contracts.some(
          (c) => c.tenantId === ten.id && (c.lifecycleStatus === 'نشط' || c.lifecycleStatus === 'بانتظار التوثيق')
        );
        if (hasActiveCtr) throw new Error('لا يمكن أرشفة مستأجر لديه عقد نشط حالياً؛ قم بإنهاء أو أرشفة العقد أولاً');
        ten.preArchiveStatus = ten.classification;
        ten.classification = 'سابق';
        ten.archivedAt = now;
        ten.archivedBy = user.id;
        ten.archiveMode = 'يدوي';
        ten.archiveReason = reason;
        summary = `أرشفة المستأجر ${ten.nameAr}`;
      } else if (input.category === 'receipts') {
        const pay = this.state.payments.find((p) => p.id === input.entityId);
        if (!pay) throw new Error('الإيصال غير موجود');
        pay.preArchiveStatus = pay.status;
        pay.archivedAt = now;
        pay.archivedBy = user.id;
        pay.archiveMode = 'يدوي';
        pay.archiveReason = reason;
        summary = `أرشفة الإيصال ${pay.receiptNumber}`;
      } else if (input.category === 'tickets') {
        if (input.targetKind === 'task') {
          const tsk = this.state.tasks.find((t) => t.id === input.entityId);
          if (!tsk) throw new Error('المهمة غير موجودة');
          tsk.preArchiveStatus = tsk.status;
          tsk.status = 'مكتملة';
          tsk.archivedAt = now;
          tsk.archivedBy = user.id;
          tsk.archiveMode = 'يدوي';
          tsk.archiveReason = reason;
          summary = `أرشفة المهمة "${tsk.title}"`;
        } else {
          const tkt = this.state.tickets.find((t) => t.id === input.entityId);
          if (!tkt) throw new Error('البلاغ غير موجود');
          tkt.preArchiveStatus = tkt.status;
          if (tkt.status !== 'مكتمل' && tkt.status !== 'مغلق') tkt.status = 'مغلق';
          tkt.archivedAt = now;
          tkt.archivedBy = user.id;
          tkt.archiveMode = 'يدوي';
          tkt.archiveReason = reason;
          summary = `أرشفة بلاغ الصيانة ${tkt.ticketNumber}`;
        }
      } else if (input.category === 'documents') {
        const doc = this.state.documents.find((d) => d.id === input.entityId);
        if (!doc) throw new Error('المستند غير موجود');
        doc.preArchiveStatus = 'نشط';
        doc.archivedAt = now;
        doc.archivedBy = user.id;
        doc.archiveMode = 'يدوي';
        doc.archiveReason = reason;
        summary = `أرشفة المستند "${doc.title}"`;
      } else if (input.category === 'units') {
        const unit = this.state.units.find((u) => u.id === input.entityId);
        if (!unit) throw new Error('الوحدة غير موجودة');
        const hasActiveCtr = this.state.contracts.some(
          (c) => c.unitId === unit.id && (c.lifecycleStatus === 'نشط' || c.lifecycleStatus === 'بانتظار التوثيق')
        );
        if (hasActiveCtr) throw new Error('لا يمكن إخراج وحدة مؤجرة بعقد نشط للأرشيف قبل إغلاق العقد');
        unit.preArchiveStatus = unit.status;
        unit.status = 'مؤرشفة';
        unit.archivedAt = now;
        unit.archivedBy = user.id;
        unit.archiveMode = 'يدوي';
        unit.archiveReason = reason;
        summary = `نقل الوحدة ${unit.unitNumber} إلى أرشيف الوحدات المتوقفة`;
      }

      this.addAudit(user, 'نقل إلى الأرشيف الذكي', input.category, input.entityId, `${summary} — السبب: ${reason}`, {
        reason,
        newValue: 'مؤرشف',
        deviceName,
      });
      this.writeArchiveBundleToDisk();
      this.persist();
      return { archivedAt: now, summary };
    });
  }

  public restoreArchivedEntity(
    userId: string,
    input: {
      category: ArchiveCategoryId;
      entityId: string;
      referenceOnly?: boolean;
      reason?: string;
      targetKind?: 'ticket' | 'task';
    },
    deviceName?: string
  ): { restoredSummary: string; referenceOnly: boolean } {
    return this.runTransaction(() => {
      const user = this.getActingUser(userId);
      this.assertArchiveAccess(user, input.category, 'write');
      const reason = (input.reason || '').trim() || 'استعادة من الأرشيف الذكي';
      let restoredSummary = '';
      let referenceOnly = Boolean(input.referenceOnly);

      if (input.category === 'contracts') {
        const ctr = this.state.contracts.find((c) => c.id === input.entityId);
        if (!ctr) throw new Error('العقد غير موجود');
        const conflictingActive = this.state.contracts.find(
          (c) =>
            c.id !== ctr.id &&
            c.unitId === ctr.unitId &&
            (c.lifecycleStatus === 'نشط' || c.lifecycleStatus === 'بانتظار التوثيق')
        );
        if (conflictingActive && !input.referenceOnly) {
          throw new Error(
            `CONFLICT_ACTIVE_CONTRACT: الوحدة مرتبطة حالياً بعقد أحدث (${conflictingActive.internalNumber}). يمكنك استعادته كسجل مرجعي فقط.`
          );
        }
        if (referenceOnly) {
          ctr.restoredAsReference = true;
          ctr.archivedAt = undefined;
          ctr.archiveReason = undefined;
          ctr.lifecycleStatus = 'منتهي';
          restoredSummary = `استعادة العقد ${ctr.internalNumber} كسجل مرجعي فقط`;
        } else {
          ctr.lifecycleStatus =
            ctr.preArchiveStatus === 'بانتظار التوثيق' || ctr.preArchiveStatus === 'نشط'
              ? (ctr.preArchiveStatus as LeaseContract['lifecycleStatus'])
              : 'بانتظار التجديد';
          ctr.archivedAt = undefined;
          ctr.archiveReason = undefined;
          ctr.restoredAsReference = false;
          const unit = this.state.units.find((u) => u.id === ctr.unitId);
          if (unit && ctr.lifecycleStatus === 'نشط') {
            unit.status = 'مؤجرة';
          }
          restoredSummary = `استعادة العقد ${ctr.internalNumber} إلى قائمة العقود (${ctr.lifecycleStatus})`;
        }
      } else if (input.category === 'tenants') {
        const ten = this.state.tenants.find((t) => t.id === input.entityId);
        if (!ten) throw new Error('المستأجر غير موجود');
        ten.classification = ten.preArchiveStatus === 'محتمل' ? 'محتمل' : 'نشط';
        ten.archivedAt = undefined;
        ten.archiveReason = undefined;
        restoredSummary = `استعادة ملف المستأجر ${ten.nameAr} إلى السجل النشط`;
      } else if (input.category === 'receipts') {
        const pay = this.state.payments.find((p) => p.id === input.entityId);
        if (!pay) throw new Error('الإيصال غير موجود');
        if (pay.status === 'معكوس') {
          referenceOnly = true;
          pay.archivedAt = undefined;
          restoredSummary = `استعادة الإيصال المعكوس ${pay.receiptNumber} للعرض المرجعي دون تغيير الأرصدة المحاسبية`;
        } else {
          pay.archivedAt = undefined;
          pay.archiveReason = undefined;
          restoredSummary = `استعادة الإيصال ${pay.receiptNumber} من الأرشيف المالي`;
        }
      } else if (input.category === 'tickets') {
        if (input.targetKind === 'task') {
          const tsk = this.state.tasks.find((t) => t.id === input.entityId);
          if (!tsk) throw new Error('المهمة غير موجودة');
          tsk.status = 'قيد التنفيذ';
          tsk.archivedAt = undefined;
          tsk.archiveReason = undefined;
          restoredSummary = `إعادة فتح المهمة "${tsk.title}"`;
        } else {
          const tkt = this.state.tickets.find((t) => t.id === input.entityId);
          if (!tkt) throw new Error('البلاغ غير موجود');
          tkt.status = 'قيد التنفيذ';
          tkt.archivedAt = undefined;
          tkt.archiveReason = undefined;
          tkt.updatedAt = new Date().toISOString();
          restoredSummary = `إعادة فتح بلاغ الصيانة ${tkt.ticketNumber}`;
        }
      } else if (input.category === 'documents') {
        const doc = this.state.documents.find((d) => d.id === input.entityId);
        if (!doc) throw new Error('المستند غير موجود');
        doc.archivedAt = undefined;
        doc.archiveReason = undefined;
        restoredSummary = `استعادة المستند "${doc.title}" للمستندات النشطة`;
      } else if (input.category === 'units') {
        const unit = this.state.units.find((u) => u.id === input.entityId);
        if (!unit) throw new Error('الوحدة غير موجودة');
        unit.status = 'شاغرة';
        unit.vacantSince = new Date().toISOString().slice(0, 10);
        unit.archivedAt = undefined;
        unit.archiveReason = undefined;
        restoredSummary = `إعادة تفعيل الوحدة ${unit.unitNumber} كوحدة شاغرة`;
      }

      this.addAudit(user, 'استعادة من الأرشيف الذكي', input.category, input.entityId, `${restoredSummary} — ${reason}`, {
        reason,
        newValue: referenceOnly ? 'سجل مرجعي' : 'نشط',
        deviceName,
      });
      this.persist();
      return { restoredSummary, referenceOnly };
    });
  }

  public runScheduledArchival(userId: string, deviceName?: string): { archivedCount: number; summary: string } {
    return this.runTransaction(() => {
      const user = this.assertPermission(userId, 'manage_contracts');
      const now = new Date();
      const nowIso = now.toISOString();
      const todayStr = nowIso.slice(0, 10);
      const oneYearAgoMs = now.getTime() - 365 * 86400000;
      const thirtyDaysAgoMs = now.getTime() - 30 * 86400000;
      let count = 0;

      for (const ctr of this.state.contracts) {
        if (!ctr.archivedAt && (ctr.lifecycleStatus === 'منتهي' || ctr.lifecycleStatus === 'منتهٍ بالإخلاء' || ctr.lifecycleStatus === 'ملغي')) {
          ctr.archivedAt = nowIso;
          ctr.archiveMode = 'مجدول';
          ctr.archiveReason = ctr.archiveReason || 'أرشفة تلقائية لعقد منتهي';
          count += 1;
        } else if (!ctr.archivedAt && ctr.endDate < todayStr && !ctr.restoredAsReference && ctr.lifecycleStatus === 'نشط') {
          ctr.preArchiveStatus = ctr.lifecycleStatus;
          ctr.lifecycleStatus = 'منتهي';
          ctr.archivedAt = nowIso;
          ctr.archiveMode = 'مجدول';
          ctr.archiveReason = 'انتهاء مدة العقد (أرشفة ليلية مجدولة)';
          count += 1;
        }
      }

      for (const pay of this.state.payments) {
        const payTime = new Date(pay.createdAt).getTime();
        if (!pay.archivedAt && (pay.status === 'معكوس' || payTime < oneYearAgoMs)) {
          pay.archivedAt = nowIso;
          pay.archiveMode = 'مجدول';
          pay.archiveReason = pay.status === 'معكوس' ? 'سند معكوس محاسبياً' : 'إقفال سنة مالية سابقة (> سنة)';
          count += 1;
        }
      }

      for (const doc of this.state.documents) {
        if (!doc.archivedAt && doc.expiryDate && doc.expiryDate < todayStr) {
          doc.archivedAt = nowIso;
          doc.archiveMode = 'مجدول';
          doc.archiveReason = 'انتهاء تاريخ صلاحية الوثيقة';
          count += 1;
        }
      }

      for (const tkt of this.state.tickets) {
        const updTime = new Date(tkt.updatedAt).getTime();
        if (!tkt.archivedAt && (tkt.status === 'مكتمل' || tkt.status === 'مغلق') && updTime < thirtyDaysAgoMs) {
          tkt.archivedAt = nowIso;
          tkt.archiveMode = 'مجدول';
          tkt.archiveReason = 'أرشفة دورية لبلاغ منجز';
          count += 1;
        }
      }

      this.state.archiveLastNightlyRun = nowIso;
      const summary =
        count > 0
          ? `تم تنفيذ الجدولة الليلية ونقل ${count} سجل منتهي إلى الأرشيف الذكي`
          : 'تم فحص كافة السجلات ولا توجد عناصر منتهية جديدة للأرشفة';

      this.addAudit(user, 'تشغيل الأرشفة الليلية المجدولة', 'SmartArchive', 'nightly-job', summary, { deviceName });
      this.persist();
      return { archivedCount: count, summary };
    });
  }

  public saveArchiveFilter(
    userId: string,
    input: Omit<SavedArchiveFilter, 'id' | 'createdBy' | 'createdAt'>,
    deviceName?: string
  ): SavedArchiveFilter {
    const user = this.getActingUser(userId);
    if (!this.state.savedArchiveFilters) this.state.savedArchiveFilters = [];
    const filter: SavedArchiveFilter = {
      ...input,
      id: uid('af'),
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };
    this.state.savedArchiveFilters.unshift(filter);
    this.addAudit(user, 'حفظ فلتر بحث في الأرشيف', 'SavedArchiveFilter', filter.id, `حفظ الفلتر "${filter.name}"`, {
      deviceName,
    });
    this.persist();
    return filter;
  }

  public deleteArchiveFilter(userId: string, filterId: string): void {
    this.getActingUser(userId);
    this.state.savedArchiveFilters = (this.state.savedArchiveFilters || []).filter((f) => f.id !== filterId);
    this.persist();
  }

  // 15. Team & Workforce Management (Users, 5-Level Permissions, Property Scope, Security Policy, Conflicts)
  public createStaffUser(
    userId: string,
    input: {
      nameAr: string;
      nameEn?: string;
      email: string;
      phone: string;
      role: RoleKey;
      roleLabelAr: string;
      roleLabelEn: string;
      specialty?: string;
      approvalLimitSar?: number;
      allowedPropertyIds?: string[];
      customModulePermissions?: Partial<Record<PermissionModuleKey, PermissionLevel[]>>;
      twoFactorEnabled?: boolean;
      biometricEnabled?: boolean;
      avatarDataUrl?: string;
    },
    deviceName?: string
  ): StaffUser {
    const actor = this.assertPermission(userId, 'manage_users');
    if (actor.role !== 'sys_owner') {
      throw new Error('إنشاء المستخدمين الجدد صلاحية حصرية لمالك النظام (System Owner) فقط');
    }
    if (!input.nameAr?.trim() || !input.phone?.trim()) {
      throw new Error('الاسم الكامل ورقم الجوال مطلوبان لإضافة الموظف');
    }
    const now = new Date().toISOString();
    const newUser: StaffUser = {
      id: uid('usr'),
      nameAr: input.nameAr.trim(),
      nameEn: (input.nameEn || input.nameAr).trim(),
      role: input.role,
      roleLabelAr: input.roleLabelAr,
      roleLabelEn: input.roleLabelEn,
      email: input.email?.trim() || `staff-${Date.now().toString().slice(-4)}@aqarplus.sa`,
      phone: input.phone.trim(),
      approvalLimitSar: Number(input.approvalLimitSar || 0),
      active: true,
      deviceName: 'جهاز مسجل جديد · ويب/جوال',
      lastActiveAt: now,
      statusState: 'متصل',
      specialty: input.specialty?.trim() || input.roleLabelAr,
      avatarDataUrl: input.avatarDataUrl,
      allowedPropertyIds: input.allowedPropertyIds && input.allowedPropertyIds.length > 0 ? input.allowedPropertyIds : undefined,
      customModulePermissions: input.customModulePermissions,
      managerRating: 5,
      lastActivitySummary: 'تم إنشاء الحساب وتفعيل الصلاحيات',
      security: {
        twoFactorEnabled: Boolean(input.twoFactorEnabled),
        biometricEnabled: Boolean(input.biometricEnabled),
        failedAttempts: 0,
        lastPasswordChangedAt: now,
        requirePasswordChange90d: true,
        tempPasswordSet: true,
      },
      notificationPrefs: {
        dndEnabled: false,
        taskAssigned: true,
        taskReminder: true,
        taskApproved: true,
        taskComment: true,
        urgentTicket: true,
      },
    };
    this.state.users.push(newUser);
    this.sqlite.updateUserCredentials(newUser.id, {
      password: (input as { tempPassword?: string }).tempPassword || 'Aqar@2026',
      pin: '1234',
    });
    this.addAudit(
      actor,
      'إضافة موظف جديد',
      'StaffUser',
      newUser.id,
      `إضافة الموظف ${newUser.nameAr} بدور (${newUser.roleLabelAr})${newUser.allowedPropertyIds ? ` · مقيد بـ ${newUser.allowedPropertyIds.length} عقارات` : ''}`,
      { newValue: newUser.roleLabelAr, deviceName }
    );
    this.addNotification(
      `انضمام موظف جديد: ${newUser.nameAr}`,
      `New staff added: ${newUser.nameEn}`,
      `تمت إضافة ${newUser.nameAr} (${newUser.roleLabelAr}) وإرسال بيانات الدخول المؤقتة.`,
      `${newUser.nameEn} joined as ${newUser.roleLabelEn}.`,
      'إدارية',
      ['gm', 'sys_owner'],
      'team'
    );
    this.persist();
    return newUser;
  }

  public deleteStaffUser(userId: string, targetUserId: string, deviceName?: string): { deletedId: string } {
    const actor = this.assertPermission(userId, 'manage_users');
    if (actor.role !== 'sys_owner') {
      throw new Error('حذف المستخدمين صلاحية حصرية لمالك النظام (System Owner) فقط');
    }
    if (actor.id === targetUserId) {
      throw new Error('لا يمكن حذف حسابك الحالي');
    }
    const target = this.state.users.find((u) => u.id === targetUserId);
    if (!target) throw new Error('الموظف غير موجود');
    if (target.role === 'sys_owner') {
      const ownerCount = this.state.users.filter((u) => u.role === 'sys_owner').length;
      if (ownerCount <= 1) {
        throw new Error('لا يمكن حذف مالك النظام الوحيد');
      }
    }
    this.state.users = this.state.users.filter((u) => u.id !== targetUserId);
    this.addAudit(
      actor,
      'حذف حساب مستخدم',
      'StaffUser',
      targetUserId,
      `حذف حساب المستخدم ${target.nameAr} (${target.roleLabelAr}) بواسطة مالك النظام`,
      { oldValue: target.roleLabelAr, deviceName }
    );
    this.persist();
    return { deletedId: targetUserId };
  }

  public updateStaffUser(
    userId: string,
    targetUserId: string,
    patch: {
      nameAr?: string;
      nameEn?: string;
      email?: string;
      phone?: string;
      role?: RoleKey;
      roleLabelAr?: string;
      roleLabelEn?: string;
      specialty?: string;
      approvalLimitSar?: number;
      active?: boolean;
      statusState?: StaffStatusState;
      managerRating?: number;
      allowedPropertyIds?: string[];
      customModulePermissions?: Partial<Record<PermissionModuleKey, PermissionLevel[]>>;
      security?: Partial<StaffSecurityConfig>;
      notificationPrefs?: Partial<StaffNotificationPrefs>;
    },
    deviceName?: string
  ): StaffUser {
    const actor = this.getActingUser(userId);
    const target = this.state.users.find((u) => u.id === targetUserId);
    if (!target) throw new Error('الموظف غير موجود');

    const touchesPermissionsOrGovernance =
      patch.role !== undefined ||
      patch.active !== undefined ||
      patch.allowedPropertyIds !== undefined ||
      patch.customModulePermissions !== undefined ||
      patch.approvalLimitSar !== undefined;

    if (actor.id === targetUserId && touchesPermissionsOrGovernance) {
      throw new Error('لا يستطيع أي مستخدم تعديل صلاحياته أو دوره الخاص');
    }

    const isSelfOnlyUpdate =
      actor.id === targetUserId &&
      !touchesPermissionsOrGovernance &&
      patch.managerRating === undefined;
    if (!isSelfOnlyUpdate) {
      this.assertPermission(userId, 'manage_users');
      if (actor.role !== 'sys_owner' && actor.role !== 'gm') {
        throw new Error('تعديل صلاحيات الموظفين متاح لمالك النظام أو مدير الشركة فقط');
      }
      if (actor.role === 'gm') {
        if (target.role === 'sys_owner' || target.role === 'gm') {
          throw new Error('يستطيع مدير الشركة تعديل صلاحيات الموظفين التابعين له فقط');
        }
        if (patch.role === 'sys_owner' || patch.role === 'gm') {
          throw new Error('لا يملك مدير الشركة صلاحية ترقية مستخدم إلى مدير شركة أو مالك نظام');
        }
      }
    }

    const oldRole = target.roleLabelAr;
    if (patch.nameAr !== undefined) target.nameAr = patch.nameAr.trim();
    if (patch.nameEn !== undefined) target.nameEn = patch.nameEn.trim();
    if (patch.email !== undefined) target.email = patch.email.trim();
    if (patch.phone !== undefined) target.phone = patch.phone.trim();
    if (patch.role !== undefined) target.role = patch.role;
    if (patch.roleLabelAr !== undefined) target.roleLabelAr = patch.roleLabelAr;
    if (patch.roleLabelEn !== undefined) target.roleLabelEn = patch.roleLabelEn;
    if (patch.specialty !== undefined) target.specialty = patch.specialty;
    if (patch.approvalLimitSar !== undefined) target.approvalLimitSar = Number(patch.approvalLimitSar);
    if (patch.active !== undefined) target.active = patch.active;
    if (patch.statusState !== undefined) target.statusState = patch.statusState;
    if (patch.managerRating !== undefined) target.managerRating = Math.min(5, Math.max(1, Number(patch.managerRating)));
    if (patch.allowedPropertyIds !== undefined) {
      target.allowedPropertyIds = patch.allowedPropertyIds.length > 0 ? patch.allowedPropertyIds : undefined;
    }
    if (patch.customModulePermissions !== undefined) {
      target.customModulePermissions = patch.customModulePermissions;
    }
    if (patch.security) {
      target.security = { ...(target.security || {}), ...patch.security };
    }
    if (patch.notificationPrefs) {
      target.notificationPrefs = { ...(target.notificationPrefs || {}), ...patch.notificationPrefs };
    }

    this.addAudit(
      actor,
      'تحديث ملف وصلاحيات موظف',
      'StaffUser',
      target.id,
      `تحديث بيانات/صلاحيات ${target.nameAr}${patch.roleLabelAr ? ` (${oldRole} ← ${patch.roleLabelAr})` : ''}`,
      { oldValue: oldRole, newValue: target.roleLabelAr, deviceName }
    );
    this.persist();
    return target;
  }

  public updateSecurityPolicy(userId: string, patch: Partial<SecurityPolicy>, deviceName?: string): SecurityPolicy {
    const actor = this.assertPermission(userId, 'manage_users');
    const current: SecurityPolicy = this.state.securityPolicy || {
      minPasswordLength: 8,
      requireSpecialChars: true,
      passwordExpiryDays: 90,
      autoLockMinutes: 5,
      maxFailedAttempts: 5,
      require2faForManagersAndAccountants: true,
    };
    this.state.securityPolicy = { ...current, ...patch };
    this.addAudit(
      actor,
      'تحديث سياسة الأمان وكلمات المرور',
      'SecurityPolicy',
      'company-security',
      `تحديث سياسات الأمان: الطول الأدنى ${this.state.securityPolicy.minPasswordLength}، القفل ${this.state.securityPolicy.autoLockMinutes} د`,
      { deviceName }
    );
    this.persist();
    return this.state.securityPolicy;
  }

  public recordLoginEvent(input: {
    userId: string;
    deviceName: string;
    ipAddress?: string;
    method?: LoginAuditEntry['method'];
    success?: boolean;
  }): void {
    const user = this.state.users.find((u) => u.id === input.userId);
    if (!user) return;
    if (!this.state.loginHistory) this.state.loginHistory = [];
    const entry: LoginAuditEntry = {
      id: uid('lgn'),
      userId: user.id,
      userName: user.nameAr,
      userRole: user.roleLabelAr,
      deviceName: input.deviceName || user.deviceName,
      ipAddress: input.ipAddress || '192.168.10.1',
      geoLocation: 'الرياض · المملكة العربية السعودية',
      method: input.method || 'كلمة المرور',
      success: input.success !== false,
      createdAt: new Date().toISOString(),
    };
    this.state.loginHistory.unshift(entry);
    if (this.state.loginHistory.length > 100) {
      this.state.loginHistory = this.state.loginHistory.slice(0, 100);
    }
    user.lastActiveAt = entry.createdAt;
    this.persist();
  }

  public resolveSyncConflict(
    userId: string,
    conflictId: string,
    resolution: 'تم اعتماد التعديل الأحدث' | 'تم الإبقاء على النسخة السابقة',
    deviceName?: string
  ): SyncConflictRecord {
    const actor = this.assertPermission(userId, 'manage_users');
    const cnf = (this.state.syncConflicts || []).find((c) => c.id === conflictId);
    if (!cnf) throw new Error('سجل التعارض غير موجود');
    cnf.status = resolution;
    cnf.resolvedBy = actor.nameAr;
    cnf.resolvedAt = new Date().toISOString();
    this.addAudit(actor, 'معالجة تعارض مزامنة', 'SyncConflict', cnf.id, `${resolution} لـ ${cnf.entityLabel}`, {
      newValue: resolution,
      deviceName,
    });
    this.persist();
    return cnf;
  }

  // 14. Communication Templates Library & System Maintenance
  public createTemplate(
    userId: string,
    input: Omit<CommunicationTemplate, 'id' | 'usageCount' | 'createdBy' | 'updatedAt'>,
    deviceName?: string
  ): CommunicationTemplate {
    const actor = this.getActingUser(userId);
    if (!this.state.communicationTemplates) this.state.communicationTemplates = [];
    const now = new Date().toISOString();
    const tpl: CommunicationTemplate = {
      ...input,
      id: uid('tpl'),
      usageCount: 0,
      createdBy: actor.id,
      updatedBy: actor.nameAr,
      updatedAt: now,
      editHistory: [{ editedBy: actor.nameAr, editedAt: now, summary: 'إنشاء القالب' }],
    };
    this.state.communicationTemplates.unshift(tpl);
    this.addAudit(actor, 'إنشاء قالب تواصل', 'CommunicationTemplate', tpl.id, `إنشاء القالب "${tpl.name}" (${tpl.category})`, {
      deviceName,
    });
    this.persist();
    return tpl;
  }

  public updateTemplate(
    userId: string,
    templateId: string,
    patch: Partial<CommunicationTemplate>,
    deviceName?: string
  ): CommunicationTemplate {
    const actor = this.getActingUser(userId);
    const list = this.state.communicationTemplates || [];
    const tpl = list.find((t) => t.id === templateId);
    if (!tpl) throw new Error('القالب غير موجود');
    const now = new Date().toISOString();
    Object.assign(tpl, patch, {
      updatedBy: actor.nameAr,
      updatedAt: now,
    });
    if (!tpl.editHistory) tpl.editHistory = [];
    tpl.editHistory.unshift({
      editedBy: actor.nameAr,
      editedAt: now,
      summary: patch.isFavorite !== undefined && Object.keys(patch).length === 1 ? 'تحديث المفضلة' : 'تحديث محتوى/إعدادات القالب',
    });
    if (tpl.editHistory.length > 20) tpl.editHistory = tpl.editHistory.slice(0, 20);
    this.addAudit(actor, 'تحديث قالب تواصل', 'CommunicationTemplate', tpl.id, `تحديث القالب "${tpl.name}"`, {
      deviceName,
    });
    this.persist();
    return tpl;
  }

  public deleteTemplate(userId: string, templateId: string, deviceName?: string): void {
    const actor = this.getActingUser(userId);
    const existing = (this.state.communicationTemplates || []).find((t) => t.id === templateId);
    this.state.communicationTemplates = (this.state.communicationTemplates || []).filter((t) => t.id !== templateId);
    this.addAudit(actor, 'حذف قالب تواصل', 'CommunicationTemplate', templateId, `حذف القالب "${existing?.name || templateId}"`, {
      deviceName,
    });
    this.persist();
  }

  public useTemplate(
    userId: string,
    templateId: string,
    input: {
      targetType: CommunicationLog['targetType'];
      targetId: string;
      targetName: string;
      channel: CommunicationLog['channel'];
      language: 'ar' | 'en' | 'bn';
      summary: string;
      localOnly?: boolean;
    },
    deviceName?: string
  ): { template?: CommunicationTemplate; log?: CommunicationLog } {
    const actor = this.getActingUser(userId);
    const tpl = (this.state.communicationTemplates || []).find((t) => t.id === templateId);
    if (tpl) {
      tpl.usageCount = (tpl.usageCount || 0) + 1;
    }
    let log: CommunicationLog | undefined;
    if (!input.localOnly) {
      log = {
        id: uid('com'),
        targetType: input.targetType,
        targetId: input.targetId,
        targetName: input.targetName,
        channel: input.channel,
        templateId,
        templateUsed: tpl?.name || 'قالب تواصل',
        language: input.language,
        summary: input.summary,
        status: 'مرسل',
        sentBy: actor.id,
        createdAt: new Date().toISOString(),
      };
      this.state.communications.unshift(log);
    }
    this.addAudit(actor, 'استخدام قالب تواصل', 'CommunicationTemplate', templateId, `إرسال رسالة عبر "${tpl?.name || templateId}" إلى ${input.targetName}`, {
      deviceName,
    });
    this.persist();
    return { template: tpl, log };
  }

  public importTemplates(userId: string, templates: Partial<CommunicationTemplate>[], deviceName?: string): number {
    const actor = this.getActingUser(userId);
    if (!this.state.communicationTemplates) this.state.communicationTemplates = [];
    const now = new Date().toISOString();
    let count = 0;
    for (const raw of templates) {
      if (!raw.name || !raw.contentAr) continue;
      this.state.communicationTemplates.unshift({
        id: uid('tpl'),
        name: String(raw.name),
        category: raw.category || 'custom',
        channel: raw.channel || 'whatsapp',
        language: raw.language || 'ar',
        contentAr: String(raw.contentAr),
        contentEn: raw.contentEn ? String(raw.contentEn) : undefined,
        isFavorite: Boolean(raw.isFavorite),
        isSeasonal: Boolean(raw.isSeasonal),
        usageCount: 0,
        createdBy: actor.id,
        updatedBy: actor.nameAr,
        updatedAt: now,
        editHistory: [{ editedBy: actor.nameAr, editedAt: now, summary: 'استيراد قالب' }],
      });
      count += 1;
    }
    this.addAudit(actor, 'استيراد قوالب تواصل', 'CommunicationTemplate', 'bulk-import', `استيراد ${count} قالب تواصل`, {
      deviceName,
    });
    this.persist();
    return count;
  }

  private diffCollection<T extends { id: string }>(current: T[] = [], incoming: T[] = []): BackupCollectionDiff {
    const curMap = new Map(current.map((item) => [item.id, JSON.stringify(item)]));
    let added = 0;
    let updated = 0;
    let unchanged = 0;
    for (const item of incoming) {
      const existing = curMap.get(item.id);
      if (existing === undefined) {
        added += 1;
      } else if (existing !== JSON.stringify(item)) {
        updated += 1;
      } else {
        unchanged += 1;
      }
    }
    return { added, updated, unchanged };
  }

  public previewBackup(backupId: string, password?: string): BackupPreviewResult {
    const filePath = this.resolveBackupFile(backupId);
    if (!filePath) {
      return {
        id: backupId,
        exists: false,
        propertiesCount: 0,
        unitsCount: 0,
        tenantsCount: 0,
        contractsCount: 0,
        paymentsCount: 0,
        templatesCount: 0,
      };
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    const encrypted = isEncryptedBackupEnvelope(raw);
    let decryptedRaw = raw;
    if (encrypted) {
      if (!password?.trim()) {
        return {
          id: backupId,
          exists: true,
          encrypted: true,
          requiresPassword: true,
          propertiesCount: 0,
          unitsCount: 0,
          tenantsCount: 0,
          contractsCount: 0,
          paymentsCount: 0,
          templatesCount: 0,
        };
      }
      try {
        decryptedRaw = decryptBackupPayload(raw, password);
      } catch (err) {
        return {
          id: backupId,
          exists: true,
          encrypted: true,
          requiresPassword: true,
          decryptionError: (err as Error).message,
          propertiesCount: 0,
          unitsCount: 0,
          tenantsCount: 0,
          contractsCount: 0,
          paymentsCount: 0,
          templatesCount: 0,
        };
      }
    }

    const parsed = JSON.parse(decryptedRaw) as AqarDatabaseState;
    const diff = {
      properties: this.diffCollection(this.state.properties, parsed.properties || []),
      units: this.diffCollection(this.state.units, parsed.units || []),
      tenants: this.diffCollection(this.state.tenants, parsed.tenants || []),
      contracts: this.diffCollection(this.state.contracts, parsed.contracts || []),
      payments: this.diffCollection(this.state.payments, parsed.payments || []),
      expenses: this.diffCollection(this.state.expenses, parsed.expenses || []),
      tickets: this.diffCollection(this.state.tickets, parsed.tickets || []),
    };
    const totalChanged = Object.values(diff).reduce((s, d) => s + d.added + d.updated, 0);

    return {
      id: backupId,
      exists: true,
      encrypted,
      requiresPassword: false,
      propertiesCount: parsed.properties?.length || 0,
      unitsCount: parsed.units?.length || 0,
      tenantsCount: parsed.tenants?.length || 0,
      contractsCount: parsed.contracts?.length || 0,
      paymentsCount: parsed.payments?.length || 0,
      templatesCount: parsed.communicationTemplates?.length || 0,
      lastUpdatedAt: parsed.lastUpdatedAt,
      diff: { ...diff, totalChanged },
    };
  }

  public clearTempCache(userId: string, deviceName?: string): CompanySettings {
    const actor = this.assertPermission(userId, 'manage_users');
    if (!this.state.settings.developerCenter) {
      this.state.settings.developerCenter = { tempCacheSizeKb: 0, errorLogs: [] };
    }
    this.state.settings.developerCenter.tempCacheSizeKb = 0;
    this.state.settings.developerCenter.errorLogs.unshift({
      id: uid('err'),
      timestamp: new Date().toISOString(),
      source: 'StorageManager',
      message: 'تم تنظيف الملفات المؤقتة وذاكرة التخزين المرحلي بنجاح',
      severity: 'info',
    });
    this.addAudit(actor, 'تنظيف الملفات المؤقتة', 'SystemMaintenance', 'cache', 'تنظيف ذاكرة التخزين المؤقتة', { deviceName });
    this.persist();
    return this.state.settings;
  }

  // 16. Tenant Files Center (Update Profile, Violations/Notes, Appointments, Contract Edits)
  public updateTenant(
    userId: string,
    tenantId: string,
    patch: Partial<Omit<Tenant, 'id' | 'createdAt'>>,
    deviceName?: string
  ): Tenant {
    const user = this.assertPermission(userId, 'manage_tenants');
    const tenant = this.state.tenants.find((t) => t.id === tenantId);
    if (!tenant) throw new Error('المستأجر غير موجود');

    if (patch.nationalIdOrIqama && patch.nationalIdOrIqama.trim() !== tenant.nationalIdOrIqama) {
      const dup = this.state.tenants.find(
        (t) => t.id !== tenantId && t.nationalIdOrIqama.trim() === patch.nationalIdOrIqama!.trim()
      );
      if (dup) throw new Error(`رقم الهوية/الإقامة مسجل مسبقاً للمستأجر ${dup.nameAr}`);
    }

    const oldSnapshot = JSON.stringify({
      nameAr: tenant.nameAr,
      phone: tenant.phone,
      email: tenant.email,
      nationalIdOrIqama: tenant.nationalIdOrIqama,
      tenantType: tenant.tenantType,
    });

    Object.assign(tenant, patch);
    if (patch.behaviorScores) {
      const bs = patch.behaviorScores;
      tenant.rating = Math.round(((bs.paymentCommitment + bs.unitCare + bs.cooperation) / 3) * 10) / 10;
    }

    this.addAudit(user, 'تحديث بيانات ملف المستأجر', 'Tenant', tenant.id, `تعديل بيانات المستأجر ${tenant.nameAr}`, {
      oldValue: oldSnapshot,
      newValue: JSON.stringify({
        nameAr: tenant.nameAr,
        phone: tenant.phone,
        email: tenant.email,
        nationalIdOrIqama: tenant.nationalIdOrIqama,
        tenantType: tenant.tenantType,
      }),
      deviceName,
    });
    this.persist();
    return tenant;
  }

  public addTenantViolationNote(
    userId: string,
    tenantId: string,
    input: { title: string; category: TenantViolationNote['category']; details: string },
    deviceName?: string
  ): TenantViolationNote {
    const user = this.assertPermission(userId, 'manage_tenants');
    const tenant = this.state.tenants.find((t) => t.id === tenantId);
    if (!tenant) throw new Error('المستأجر غير موجود');
    if (!tenant.violationNotes) tenant.violationNotes = [];
    const entry: TenantViolationNote = {
      id: uid('vn'),
      title: input.title,
      category: input.category,
      details: input.details,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };
    tenant.violationNotes.unshift(entry);
    this.addAudit(user, 'إضافة ملاحظة / مخالفة مستأجر', 'Tenant', tenant.id, `${input.category}: ${input.title} (${tenant.nameAr})`, {
      deviceName,
    });
    this.persist();
    return entry;
  }

  public scheduleTenantAppointment(
    userId: string,
    tenantId: string,
    input: { title: string; scheduledAt: string; notes?: string; createTask?: boolean; propertyId?: string; unitId?: string },
    deviceName?: string
  ): CommunicationLog {
    const user = this.getActingUser(userId);
    const tenant = this.state.tenants.find((t) => t.id === tenantId);
    if (!tenant) throw new Error('المستأجر غير موجود');

    const log: CommunicationLog = {
      id: uid('com'),
      targetType: 'مستأجر',
      targetId: tenant.id,
      targetName: tenant.nameAr,
      channel: 'موعد مجدول',
      direction: 'صادر',
      language: 'ar',
      summary: `${input.title} — ${input.scheduledAt}${input.notes ? ` · ${input.notes}` : ''}`,
      scheduledAt: input.scheduledAt,
      status: 'مجدول',
      sentBy: user.id,
      createdAt: new Date().toISOString(),
    };
    this.state.communications.unshift(log);

    if (input.createTask && this.userHasPermission(user, 'manage_tasks')) {
      this.state.tasks.unshift({
        id: uid('tsk'),
        title: `موعد مع المستأجر ${tenant.nameAr}: ${input.title}`,
        description: input.notes || input.title,
        type: 'متابعة مستأجر',
        propertyId: input.propertyId,
        unitId: input.unitId,
        assignedTo: user.id,
        createdBy: user.id,
        dueDate: input.scheduledAt.slice(0, 10),
        priority: 'متوسط',
        status: 'مسندة',
        checklist: [{ text: 'تأكيد حضور الموعد وتوثيق النتيجة', done: false }],
        comments: [],
        createdAt: new Date().toISOString(),
      });
    }

    this.addAudit(user, 'جدولة موعد مع مستأجر', 'Communication', log.id, `جدولة موعد (${input.title}) مع ${tenant.nameAr} بتاريخ ${input.scheduledAt}`, {
      deviceName,
      propertyId: input.propertyId,
    });
    this.persist();
    return log;
  }

  public updateContractDetails(
    userId: string,
    contractId: string,
    patch: Partial<
      Pick<
        LeaseContract,
        | 'ejarNumber'
        | 'ejarStatus'
        | 'ejarPortalUrl'
        | 'handoverDate'
        | 'occupancyStartDate'
        | 'occupancyStatus'
        | 'keysDeliveredCount'
        | 'remotesDeliveredCount'
        | 'earlyTerminationFee'
        | 'securityDeposit'
        | 'officeFee'
        | 'includedServices'
        | 'notes'
      >
    >,
    deviceName?: string
  ): LeaseContract {
    const user = this.assertPermission(userId, 'manage_contracts');
    const contract = this.state.contracts.find((c) => c.id === contractId);
    if (!contract) throw new Error('العقد غير موجود');

    const prevSummary = `${contract.ejarNumber || '-'} / ${contract.occupancyStatus || 'نشط'}`;
    Object.assign(contract, patch);
    contract.version += 1;

    this.addAudit(
      user,
      'تعديل بنود وبيانات إشغال العقد',
      'LeaseContract',
      contract.id,
      `تحديث العقد ${contract.internalNumber} (الإصدار ${contract.version})`,
      { oldValue: prevSummary, newValue: JSON.stringify(patch), propertyId: contract.propertyId, deviceName }
    );
    this.persist();
    return contract;
  }

  // 17. Expenses Edit, Payment Voucher & Reasoned Cancellation + Vendors + Invoices + Budgets
  public updateOrCancelExpense(
    userId: string,
    expenseId: string,
    input: {
      action: 'edit' | 'pay' | 'cancel';
      patch?: Partial<Expense>;
      paidAmount?: number;
      paymentMethod?: Expense['paymentMethod'];
      paidFromAccount?: string;
      referenceNumber?: string;
      reason?: string;
    },
    deviceName?: string
  ): Expense {
    return this.runTransaction(() => {
      const user = this.getActingUser(userId);
      const expense = this.state.expenses.find((e) => e.id === expenseId);
      if (!expense) throw new Error('المصروف غير موجود');

      if (input.action === 'pay') {
        if (expense.approvalStatus !== 'معتمد') {
          throw new Error('لا يمكن تسجيل سداد لمصروف قبل اعتماده');
        }
        const addedPay = Number(input.paidAmount || expense.remainingAmount || expense.amount);
        if (addedPay <= 0) throw new Error('يجب إدخال مبلغ سداد أكبر من صفر');
        const nextPaid = Math.min(expense.amount, Math.round(((expense.paidAmount || 0) + addedPay) * 100) / 100);
        expense.paidAmount = nextPaid;
        expense.remainingAmount = Math.max(0, Math.round((expense.amount - nextPaid) * 100) / 100);
        expense.paymentStatus = expense.remainingAmount === 0 ? 'مدفوع بالكامل' : 'مدفوع جزئياً';
        if (input.paymentMethod) expense.paymentMethod = input.paymentMethod;
        if (input.paidFromAccount) expense.paidFromAccount = input.paidFromAccount;
        if (input.referenceNumber) expense.referenceNumber = input.referenceNumber;

        if (expense.ticketId && expense.paymentStatus === 'مدفوع بالكامل') {
          const tkt = this.state.tickets.find((t) => t.id === expense.ticketId);
          if (tkt) {
            tkt.status = 'مكتمل';
            tkt.actualCost = expense.amount;
            tkt.updatedAt = new Date().toISOString();
          }
        }

        this.addAudit(
          user,
          'تسجيل سند صرف / سداد مصروف',
          'Expense',
          expense.id,
          `سداد ${addedPay.toLocaleString()} ر.س للمصروف ${expense.expenseNumber} (${expense.paymentStatus})`,
          { propertyId: expense.propertyId, newValue: `${nextPaid} / ${expense.amount}`, deviceName }
        );
        this.persist();
        return expense;
      }

      if (input.action === 'cancel') {
        if (!input.reason || input.reason.trim().length < 4) {
          throw new Error('يجب كتابة سبب واضح لإلغاء/حذف المصروف');
        }
        const prevStatus = expense.approvalStatus;
        if (prevStatus === 'معتمد') {
          this.assertPermission(userId, 'approve_expense_manager');
          // Reverse financial impact if it was already posted
          const origJournal = this.state.journals.find((j) => j.referenceId === expense.id && j.referenceType === 'مصروف');
          if (origJournal) {
            this.state.counters.journal += 1;
            const revLines = origJournal.lines.map((l) => {
              const acc = this.state.accounts.find((a) => a.id === l.accountId);
              if (acc) {
                if (acc.type === 'أصول' || acc.type === 'مصروفات') acc.balance += l.credit - l.debit;
                else acc.balance += l.debit - l.credit;
              }
              return { accountId: l.accountId, accountName: l.accountName, debit: l.credit, credit: l.debit };
            });
            this.state.journals.unshift({
              id: uid('jrn'),
              entryNumber: `JRN-2026-${pad4(this.state.counters.journal)}`,
              date: new Date().toISOString().slice(0, 10),
              description: `عكس وإلغاء مصروف معتمد ${expense.expenseNumber} - السبب: ${input.reason}`,
              referenceType: 'سند عكسي',
              referenceId: expense.id,
              propertyId: expense.propertyId,
              createdBy: user.id,
              lines: revLines,
            });
          }
        } else {
          this.assertPermission(userId, 'create_expense');
        }
        expense.approvalStatus = 'ملغى';
        expense.cancellationReason = input.reason.trim();
        this.addAudit(
          user,
          'إلغاء وحفظ أرشيفي لمصروف',
          'Expense',
          expense.id,
          `إلغاء المصروف ${expense.expenseNumber} (${expense.amount.toLocaleString()} ر.س)`,
          { oldValue: prevStatus, newValue: 'ملغى', reason: input.reason.trim(), propertyId: expense.propertyId, deviceName }
        );
        this.persist();
        return expense;
      }

      // Edit action
      this.assertPermission(userId, 'create_expense');
      if (expense.approvalStatus === 'معتمد' && user.role !== 'gm' && user.role !== 'sys_owner') {
        throw new Error('تعديل مصروف معتمد يتطلب صلاحية المدير العام');
      }
      const oldSummary = `${expense.category} / ${expense.amount} / ${expense.invoiceNumber}`;
      if (input.patch) {
        Object.assign(expense, input.patch);
      }
      this.addAudit(
        user,
        'تعديل بيانات مصروف',
        'Expense',
        expense.id,
        `تعديل المصروف ${expense.expenseNumber}`,
        { oldValue: oldSummary, newValue: `${expense.category} / ${expense.amount} / ${expense.invoiceNumber}`, propertyId: expense.propertyId, deviceName }
      );
      this.persist();
      return expense;
    });
  }

  public updateVendor(
    userId: string,
    vendorId: string,
    patch: Partial<Omit<Vendor, 'id'>> & { ratingBreakdown?: VendorRatingBreakdown },
    deviceName?: string
  ): Vendor {
    const user = this.assertPermission(userId, 'manage_maintenance');
    const vendor = this.state.vendors.find((v) => v.id === vendorId);
    if (!vendor) throw new Error('المورد غير موجود');

    const oldRating = vendor.rating;
    Object.assign(vendor, patch);
    if (patch.ratingBreakdown) {
      const b = patch.ratingBreakdown;
      vendor.ratingBreakdown = b;
      vendor.rating = Math.round(((b.quality + b.punctuality + b.pricing + b.cooperation) / 4) * 10) / 10;
    }

    this.addAudit(user, 'تحديث ملف وتقييم مورد', 'Vendor', vendor.id, `تحديث المورد ${vendor.nameAr} (التقييم: ${vendor.rating}/5)`, {
      oldValue: String(oldRating),
      newValue: String(vendor.rating),
      deviceName,
    });
    this.persist();
    return vendor;
  }

  public createSupplierInvoice(
    userId: string,
    input: Omit<SupplierInvoice, 'id' | 'invoiceCode' | 'createdBy' | 'createdAt'>,
    deviceName?: string
  ): SupplierInvoice {
    const user = this.assertPermission(userId, 'create_expense');
    if (!this.state.supplierInvoices) this.state.supplierInvoices = [];
    const invoiceCode = `SINV-2026-${pad3(this.state.supplierInvoices.length + 1)}`;
    const inv: SupplierInvoice = {
      ...input,
      id: uid('sinv'),
      invoiceCode,
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };
    this.state.supplierInvoices.unshift(inv);
    this.addAudit(
      user,
      'تسجيل فاتورة مورد تفصيلية',
      'SupplierInvoice',
      inv.id,
      `فاتورة ${inv.invoiceCode} (${inv.supplierInvoiceNumber}) بقيمة ${inv.totalAmount.toLocaleString()} ر.س`,
      { propertyId: inv.propertyId, newValue: inv.status, deviceName }
    );
    this.persist();
    return inv;
  }

  public updateSupplierInvoice(
    userId: string,
    invoiceId: string,
    patch: { status?: SupplierInvoiceStatus; payAmount?: number; cancellationReason?: string },
    deviceName?: string
  ): SupplierInvoice {
    const user = this.getActingUser(userId);
    if (!this.state.supplierInvoices) this.state.supplierInvoices = [];
    const inv = this.state.supplierInvoices.find((i) => i.id === invoiceId);
    if (!inv) throw new Error('فاتورة المورد غير موجودة');

    const oldStatus = inv.status;
    if (patch.payAmount && patch.payAmount > 0) {
      this.assertPermission(userId, 'manage_accounting');
      inv.paidAmount = Math.min(inv.totalAmount, Math.round((inv.paidAmount + patch.payAmount) * 100) / 100);
      inv.remainingAmount = Math.max(0, Math.round((inv.totalAmount - inv.paidAmount) * 100) / 100);
      inv.status = inv.remainingAmount === 0 ? 'مدفوعة بالكامل' : 'مدفوعة جزئياً';
    } else if (patch.status) {
      if (patch.status === 'معتمدة') {
        this.assertPermission(userId, 'approve_expense_supervisor');
        inv.approvedBy = user.id;
      }
      if (patch.status === 'ملغاة') {
        if (!patch.cancellationReason?.trim()) throw new Error('يجب إدخال سبب إلغاء الفاتورة');
        inv.cancellationReason = patch.cancellationReason.trim();
      }
      inv.status = patch.status;
    }

    this.addAudit(
      user,
      'تحديث فاتورة مورد',
      'SupplierInvoice',
      inv.id,
      `تحديث الفاتورة ${inv.invoiceCode} إلى ${inv.status}`,
      { oldValue: oldStatus, newValue: inv.status, reason: patch.cancellationReason, propertyId: inv.propertyId, deviceName }
    );
    this.persist();
    return inv;
  }

  public createRecurringExpense(
    userId: string,
    input: Omit<RecurringExpenseRule, 'id' | 'createdBy' | 'createdAt'>,
    deviceName?: string
  ): RecurringExpenseRule {
    const user = this.assertPermission(userId, 'create_expense');
    if (!this.state.recurringExpenses) this.state.recurringExpenses = [];
    const rule: RecurringExpenseRule = {
      ...input,
      id: uid('rexp'),
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };
    this.state.recurringExpenses.unshift(rule);
    this.addAudit(user, 'جدولة مصروف دوري متكرر', 'RecurringExpenseRule', rule.id, `إضافة مصروف متكرر: ${rule.title}`, {
      propertyId: rule.propertyId,
      deviceName,
    });
    this.persist();
    return rule;
  }

  public toggleRecurringExpense(userId: string, ruleId: string, enabled: boolean, deviceName?: string): RecurringExpenseRule {
    const user = this.assertPermission(userId, 'create_expense');
    const rule = (this.state.recurringExpenses || []).find((r) => r.id === ruleId);
    if (!rule) throw new Error('قاعدة المصروف المتكرر غير موجودة');
    rule.enabled = enabled;
    this.addAudit(user, 'تحديث حالة مصروف متكرر', 'RecurringExpenseRule', rule.id, `${enabled ? 'تفعيل' : 'إيقاف'}: ${rule.title}`, {
      propertyId: rule.propertyId,
      deviceName,
    });
    this.persist();
    return rule;
  }

  public generateDueRecurringExpenses(userId: string, targetMonth?: string, deviceName?: string): Expense[] {
    const user = this.assertPermission(userId, 'create_expense');
    const month = targetMonth || new Date().toISOString().slice(0, 7);
    const created: Expense[] = [];

    for (const rule of this.state.recurringExpenses || []) {
      if (!rule.enabled || rule.lastGeneratedMonth === month) continue;
      const dayStr = String(Math.min(28, Math.max(1, rule.dayOfMonth))).padStart(2, '0');
      const vat = Math.round((rule.estimatedAmount - rule.estimatedAmount / 1.15) * 100) / 100;
      this.state.counters.expense += 1;
      const exp: Expense = {
        id: uid('exp'),
        expenseNumber: `EXP-2026-${pad4(this.state.counters.expense)}`,
        date: `${month}-${dayStr}`,
        category: rule.category,
        subCategory: rule.subCategory,
        propertyId: rule.propertyId,
        unitId: rule.unitId,
        vendorId: rule.vendorId,
        invoiceNumber: `REC-${month.replace('-', '')}-${pad3(this.state.counters.expense)}`,
        amount: rule.estimatedAmount,
        vatAmount: vat,
        netAmount: Math.round((rule.estimatedAmount - vat) * 100) / 100,
        currency: rule.currency,
        paymentMethod: 'تحويل بنكي',
        paymentStatus: 'لم يُدفع',
        paidAmount: 0,
        remainingAmount: rule.estimatedAmount,
        dueDate: `${month}-${dayStr}`,
        bearer: rule.bearer,
        approvalStatus: 'مسودة',
        isRecurringInstance: true,
        recurringRuleId: rule.id,
        createdBy: user.id,
        notes: `توليد تلقائي لمصروف متكرر (${rule.frequency}): ${rule.title}`,
        createdAt: new Date().toISOString(),
      };
      this.state.expenses.unshift(exp);
      rule.lastGeneratedMonth = month;
      created.push(exp);
    }

    if (created.length > 0) {
      this.addAudit(
        user,
        'توليد مسودات المصروفات الدورية',
        'RecurringExpenseRule',
        month,
        `تم توليد ${created.length} مسودة مصروف دوري لشهر ${month}`,
        { deviceName }
      );
      this.persist();
    }
    return created;
  }

  public upsertPropertyBudget(
    userId: string,
    input: { propertyId: string; month: string; monthlyLimitSar: number; alertThresholdPercent?: number; blockAt100Percent?: boolean },
    deviceName?: string
  ): PropertyBudget {
    const user = this.assertPermission(userId, 'manage_accounting');
    if (!this.state.propertyBudgets) this.state.propertyBudgets = [];
    let existing = this.state.propertyBudgets.find((b) => b.propertyId === input.propertyId && b.month === input.month);
    const now = new Date().toISOString();
    if (existing) {
      existing.monthlyLimitSar = Number(input.monthlyLimitSar);
      if (input.alertThresholdPercent !== undefined) existing.alertThresholdPercent = input.alertThresholdPercent;
      if (input.blockAt100Percent !== undefined) existing.blockAt100Percent = input.blockAt100Percent;
      existing.updatedBy = user.id;
      existing.updatedAt = now;
    } else {
      existing = {
        id: uid('pbdg'),
        propertyId: input.propertyId,
        month: input.month,
        monthlyLimitSar: Number(input.monthlyLimitSar),
        alertThresholdPercent: input.alertThresholdPercent ?? 80,
        blockAt100Percent: Boolean(input.blockAt100Percent),
        updatedBy: user.id,
        updatedAt: now,
      };
      this.state.propertyBudgets.unshift(existing);
    }
    this.addAudit(
      user,
      'تحديد ميزانية شهرية للعقار',
      'PropertyBudget',
      existing.id,
      `تحديد ميزانية ${existing.month} بمبلغ ${existing.monthlyLimitSar.toLocaleString()} ر.س`,
      { propertyId: existing.propertyId, deviceName }
    );
    this.persist();
    return existing;
  }

  // 18. Lead Management, Smart Escalation to Owner/Manager & Public Prospect Intake
  public updateLead(
    userId: string,
    leadId: string,
    patch: Partial<Lead> & { newInteraction?: Omit<LeadInteraction, 'id' | 'actorName' | 'createdAt'> },
    deviceName?: string
  ): Lead {
    const user = this.assertPermission(userId, 'manage_contracts');
    const lead = this.state.leads.find((l) => l.id === leadId);
    if (!lead) throw new Error('ملف المهتم غير موجود');

    const { newInteraction, ...rest } = patch;
    Object.assign(lead, rest);
    lead.updatedAt = new Date().toISOString();

    if (newInteraction) {
      if (!lead.interactions) lead.interactions = [];
      lead.interactions.unshift({
        id: uid('lint'),
        type: newInteraction.type,
        direction: newInteraction.direction,
        summary: newInteraction.summary,
        actorName: user.nameAr,
        createdAt: new Date().toISOString(),
      });
    }

    this.addAudit(
      user,
      newInteraction ? 'تسجيل تواصل مع مهتم' : 'تحديث ملف مهتم',
      'Lead',
      lead.id,
      newInteraction ? `${newInteraction.summary} (${lead.nameAr})` : `تحديث بيانات المهتم ${lead.nameAr}`,
      { propertyId: lead.propertyId, deviceName }
    );
    this.persist();
    return lead;
  }

  public createPublicLead(input: {
    nameAr: string;
    phone: string;
    email?: string;
    nationalIdOrIqama?: string;
    birthDate?: string;
    idImageDataUrl?: string;
    tenantType?: Lead['tenantType'];
    familyMembersCount?: number;
    companyCrNumber?: string;
    propertyId?: string;
    unitId?: string;
    budgetMonthly?: number;
    roomsRequired?: number;
    moveInDate?: string;
    notes?: string;
    source?: string;
  }): { lead: Lead; merged: boolean; propertyName: string } {
    if (!input.nameAr?.trim() || !input.phone?.trim()) {
      throw new Error('يرجى إدخال الاسم ورقم الجوال');
    }
    const cleanPhone = input.phone.trim();
    const now = new Date().toISOString();

    const targetUnit =
      (input.unitId && this.state.units.find((u) => u.id === input.unitId)) ||
      (input.propertyId && this.state.units.find((u) => u.propertyId === input.propertyId && u.status === 'شاغرة')) ||
      this.state.units.find((u) => u.status === 'شاغرة') ||
      this.state.units[0];

    const targetProp =
      (input.propertyId && this.state.properties.find((p) => p.id === input.propertyId)) ||
      (targetUnit && this.state.properties.find((p) => p.id === targetUnit.propertyId)) ||
      this.state.properties[0];

    // Smart duplicate phone detection: merge into existing lead instead of creating duplicate
    const existingLead = this.state.leads.find((l) => l.phone.trim() === cleanPhone);
    if (existingLead) {
      existingLead.updatedAt = now;
      if (input.nationalIdOrIqama?.trim()) existingLead.nationalIdOrIqama = input.nationalIdOrIqama.trim();
      if (input.birthDate?.trim()) existingLead.birthDate = input.birthDate.trim();
      if (input.idImageDataUrl) existingLead.idImageDataUrl = input.idImageDataUrl;
      if (input.notes) {
        existingLead.notes = `${existingLead.notes ? `${existingLead.notes} | ` : ''}اهتمام جديد (${now.slice(0, 10)}): ${input.notes}`;
      }
      if (!existingLead.interactions) existingLead.interactions = [];
      existingLead.interactions.unshift({
        id: uid('lint'),
        type: 'visit',
        direction: 'inbound',
        summary: `إعادة تسجيل اهتمام عبر ${input.source || 'رابط التسجيل العام'}${targetProp ? ` (${targetProp.nameAr})` : ''}`,
        actorName: 'بوابة التسجيل الذكية',
        createdAt: now,
      });
      this.addNotification(
        `تجديد اهتمام عميل مسجل: ${existingLead.nameAr}`,
        `Returning lead inquiry: ${existingLead.nameAr}`,
        `تم ربط طلب جديد برقم الجوال ${cleanPhone} تلقائياً دون تكرار.`,
        `Linked duplicate phone ${cleanPhone} automatically.`,
        'تشغيلية',
        ['leasing', 'gm', 'supervisor'],
        'tenants'
      );
      this.persist();
      return { lead: existingLead, merged: true, propertyName: targetProp?.nameAr || 'العقار' };
    }

    const lead: Lead = {
      id: uid('lead'),
      nameAr: input.nameAr.trim(),
      phone: cleanPhone,
      email: input.email?.trim() || undefined,
      nationalIdOrIqama: input.nationalIdOrIqama?.trim() || undefined,
      birthDate: input.birthDate?.trim() || undefined,
      idImageDataUrl: input.idImageDataUrl || undefined,
      tenantType: input.tenantType || 'فرد',
      familyMembersCount: input.familyMembersCount,
      companyCrNumber: input.companyCrNumber,
      source: input.source || 'رابط التسجيل العام',
      propertyId: targetProp?.id || '',
      unitId: targetUnit?.id || '',
      offeredRent: targetUnit?.suggestedMonthlyRent || input.budgetMonthly || 3500,
      paymentFrequency: 'شهري',
      officeFee: targetUnit?.officeFee || 500,
      earlyTerminationFee: 1000,
      budgetMonthly: input.budgetMonthly,
      roomsRequired: input.roomsRequired,
      moveInDate: input.moveInDate,
      viewingDate: now.slice(0, 10),
      status: 'جديد',
      approvalState: 'لم يُرسل',
      rating: 4,
      assignedTo: 'usr-lease',
      notes: input.notes?.trim() || 'مسجل ذاتياً عبر نموذج الاستقطاب العام',
      createdAt: now,
      updatedAt: now,
      interactions: [
        {
          id: uid('lint'),
          type: 'visit',
          direction: 'inbound',
          summary: `تسجيل ذاتي من بوابة المهتمين (${input.source || 'رابط عام'})`,
          actorName: input.nameAr.trim(),
          createdAt: now,
        },
      ],
    };

    this.state.leads.unshift(lead);
    this.addNotification(
      `مهتم جديد عبر البوابة العامة: ${lead.nameAr}`,
      `New Public Prospect: ${lead.nameAr}`,
      `${targetProp?.nameAr || ''} ${targetUnit ? `· وحدة ${targetUnit.unitNumber}` : ''} · ${lead.phone}`,
      `${lead.phone} · ${lead.source}`,
      'تشغيلية',
      ['leasing', 'gm', 'supervisor'],
      'tenants'
    );
    this.persist();
    return { lead, merged: false, propertyName: targetProp?.nameAr || 'العقار' };
  }

  public escalateLead(
    userId: string,
    leadId: string,
    input: {
      recipientType: 'internal' | 'owner';
      recipientId: string;
      channel: LeadEscalationChannel;
      priority?: 'عادي' | 'عاجل';
      employeeNotes?: string;
      rentAmount?: number;
      paymentFrequency?: PaymentFrequency;
      officeFee?: number;
      earlyTerminationFee?: number;
      unitId?: string;
      nationalIdOrIqama?: string;
      birthDate?: string;
      idImageDataUrl?: string;
    },
    deviceName?: string
  ): LeadEscalation {
    const user = this.assertPermission(userId, 'manage_contracts');
    const lead = this.state.leads.find((l) => l.id === leadId);
    if (!lead) throw new Error('ملف المهتم غير موجود');

    const unit = this.state.units.find((u) => u.id === (input.unitId || lead.unitId)) || this.state.units[0];
    const prop = this.state.properties.find((p) => p.id === (unit?.propertyId || lead.propertyId)) || this.state.properties[0];
    if (!prop || !unit) throw new Error('يرجى تحديد العقار والوحدة قبل الإرسال');

    if (input.rentAmount !== undefined) lead.offeredRent = input.rentAmount;
    if (input.paymentFrequency) lead.paymentFrequency = input.paymentFrequency;
    if (input.officeFee !== undefined) lead.officeFee = input.officeFee;
    if (input.earlyTerminationFee !== undefined) lead.earlyTerminationFee = input.earlyTerminationFee;
    if (input.nationalIdOrIqama !== undefined) lead.nationalIdOrIqama = input.nationalIdOrIqama.trim() || undefined;
    if (input.birthDate !== undefined) lead.birthDate = input.birthDate.trim() || undefined;
    if (input.idImageDataUrl !== undefined) lead.idImageDataUrl = input.idImageDataUrl || undefined;
    lead.unitId = unit.id;
    lead.propertyId = prop.id;

    let recipientName = '';
    let recipientPhone = '';
    let recipientEmail = '';
    let targetRoles: RoleKey[] = ['gm', 'supervisor'];

    if (input.recipientType === 'owner') {
      const owner = this.state.owners.find((o) => o.id === input.recipientId);
      if (!owner) throw new Error('المالك المختار غير موجود');
      recipientName = owner.nameAr;
      recipientPhone = owner.phone;
      recipientEmail = owner.email;
      targetRoles = ['owner', 'gm'];
    } else {
      const mgr = this.state.users.find((u) => u.id === input.recipientId);
      if (!mgr) throw new Error('المسؤول المختار غير موجود');
      recipientName = mgr.nameAr;
      recipientPhone = mgr.phone;
      recipientEmail = mgr.email;
      targetRoles = [mgr.role];
    }

    if (!this.state.leadEscalations) this.state.leadEscalations = [];
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
    const requestCode = `ESC-2026-${pad3(this.state.leadEscalations.length + 1)}`;
    const token = `tok-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

    const company = (prop.companyId && this.state.companies?.find((c) => c.id === prop.companyId)) || undefined;
    const companyName = company?.nameAr || this.state.settings.nameAr;

    const esc: LeadEscalation = {
      id: uid('lesc'),
      requestCode,
      leadId: lead.id,
      propertyId: prop.id,
      unitId: unit.id,
      recipientType: input.recipientType,
      recipientId: input.recipientId,
      recipientName,
      recipientPhone,
      recipientEmail,
      channel: input.channel,
      status: 'بانتظار الموافقة',
      priority: input.priority || 'عادي',
      employeeNotes: input.employeeNotes?.trim() || lead.notes || undefined,
      token,
      tokenExpiresAt: expiresAt,
      snapshot: {
        companyName,
        propertyName: prop.nameAr,
        unitNumber: unit.unitNumber,
        leadName: lead.nameAr,
        nationalIdOrIqama: lead.nationalIdOrIqama,
        hasIdPhoto: Boolean(lead.idImageDataUrl),
        idImageDataUrl: lead.idImageDataUrl,
        birthDate: lead.birthDate,
        phone: lead.phone,
        rentAmount: lead.offeredRent,
        paymentFrequency: lead.paymentFrequency || 'شهري',
        officeFee: lead.officeFee ?? unit.officeFee ?? 0,
        earlyTerminationFee: lead.earlyTerminationFee ?? 1000,
        employeeNotes: input.employeeNotes?.trim() || lead.notes || undefined,
        registrationDate: (lead.createdAt || now).slice(0, 10),
        registrationSource: lead.source || 'إدخال يدوي',
      },
      createdBy: user.id,
      createdByName: user.nameAr,
      createdAt: now,
    };

    this.state.leadEscalations.unshift(esc);
    lead.approvalState = 'بانتظار الموافقة';
    lead.updatedAt = now;
    if (!lead.interactions) lead.interactions = [];
    lead.interactions.unshift({
      id: uid('lint'),
      type: 'escalation',
      direction: 'outbound',
      summary: `إرسال بطاقة بيانات المهتم (${esc.requestCode}) عبر ${esc.channel} إلى ${recipientName}`,
      actorName: user.nameAr,
      createdAt: now,
    });

    this.addNotification(
      `طلب مراجعة مهتم جديد ${esc.requestCode}: ${lead.nameAr}`,
      `Lead Approval Request ${esc.requestCode}`,
      `${prop.nameAr} · وحدة ${unit.unitNumber} · الإيجار ${esc.snapshot.rentAmount.toLocaleString()} ر.س (${esc.snapshot.paymentFrequency})`,
      `${lead.nameAr} · ${unit.unitNumber}`,
      'تشغيلية',
      targetRoles,
      'tenants'
    );

    this.addAudit(
      user,
      'إرسال بيانات مهتم للمالك أو المسؤول',
      'LeadEscalation',
      esc.id,
      `تصعيد ملف المهتم ${lead.nameAr} (${esc.requestCode}) إلى ${recipientName} عبر ${esc.channel}`,
      { propertyId: prop.id, newValue: esc.status, deviceName }
    );
    this.persist();
    return esc;
  }

  public getLeadEscalationByToken(token: string): {
    escalation: LeadEscalation;
    expired: boolean;
    propertyName: string;
    unitNumber: string;
    unitType: string;
  } {
    const esc = (this.state.leadEscalations || []).find((e) => e.token === token);
    if (!esc) throw new Error('رابط المراجعة غير صالح أو غير موجود');
    const expired = new Date(esc.tokenExpiresAt).getTime() < Date.now() && esc.status === 'بانتظار الموافقة';
    const unit = this.state.units.find((u) => u.id === esc.unitId);
    return {
      escalation: esc,
      expired,
      propertyName: esc.snapshot.propertyName,
      unitNumber: esc.snapshot.unitNumber,
      unitType: unit?.unitType || 'شقة',
    };
  }

  public decideLeadEscalation(
    actorUserId: string | null,
    escalationIdOrToken: string,
    input: { decision: Exclude<LeadEscalationStatus, 'بانتظار الموافقة'>; decisionNotes?: string; isToken?: boolean },
    deviceName?: string
  ): LeadEscalation {
    if (!this.state.leadEscalations) this.state.leadEscalations = [];
    const esc = input.isToken
      ? this.state.leadEscalations.find((e) => e.token === escalationIdOrToken)
      : this.state.leadEscalations.find((e) => e.id === escalationIdOrToken);

    if (!esc) throw new Error('طلب المراجعة غير موجود');
    if (input.isToken && new Date(esc.tokenExpiresAt).getTime() < Date.now() && esc.status === 'بانتظار الموافقة') {
      throw new Error('انتهت صلاحية رابط الموافقة (72 ساعة)');
    }
    if ((input.decision === 'مرفوض' || input.decision === 'أريد تعديلات') && !input.decisionNotes?.trim()) {
      throw new Error(input.decision === 'مرفوض' ? 'يرجى كتابة سبب الرفض' : 'يرجى توضيح التعديلات المطلوبة');
    }

    const actingUser = actorUserId ? this.state.users.find((u) => u.id === actorUserId && u.active) : undefined;
    if (!input.isToken && !actingUser) {
      throw new Error('يجب تسجيل الدخول للبت في الطلب');
    }

    const deciderName = input.isToken ? esc.recipientName : actingUser!.nameAr;
    const now = new Date().toISOString();
    const oldStatus = esc.status;
    esc.status = input.decision;
    esc.decisionNotes = input.decisionNotes?.trim() || undefined;
    esc.decidedBy = deciderName;
    esc.decidedAt = now;

    const lead = this.state.leads.find((l) => l.id === esc.leadId);
    if (lead) {
      lead.approvalState =
        input.decision === 'موافق'
          ? 'موافق'
          : input.decision === 'مرفوض'
          ? 'مرفوض'
          : 'مطلوب تعديلات';
      lead.updatedAt = now;
      if (!lead.interactions) lead.interactions = [];
      lead.interactions.unshift({
        id: uid('lint'),
        type: 'decision',
        direction: 'inbound',
        summary: `قرار ${deciderName} (${esc.requestCode}): ${input.decision}${esc.decisionNotes ? ` — ${esc.decisionNotes}` : ''}`,
        actorName: deciderName,
        createdAt: now,
      });
    }

    this.addNotification(
      `قرار طلب المهتم ${esc.requestCode}: ${input.decision}`,
      `Lead Decision ${esc.requestCode}: ${input.decision}`,
      `${esc.snapshot.leadName} · ${deciderName}${esc.decisionNotes ? ` · "${esc.decisionNotes}"` : ''}`,
      `${esc.snapshot.leadName} · ${input.decision}`,
      'تشغيلية',
      ['leasing', 'supervisor', 'gm'],
      'tenants'
    );

    const auditActor: StaffUser = actingUser || {
      id: esc.recipientId,
      nameAr: deciderName,
      nameEn: deciderName,
      role: 'owner',
      roleLabelAr: 'مالك عبر رابط آمن',
      roleLabelEn: 'External Owner Link',
      email: esc.recipientEmail || '',
      phone: esc.recipientPhone || '',
      approvalLimitSar: 0,
      active: true,
      deviceName: deviceName || 'External Owner Portal',
      lastActiveAt: now,
    };

    this.addAudit(
      auditActor,
      `قرار المراجع على طلب مهتم (${input.decision})`,
      'LeadEscalation',
      esc.id,
      `بت ${deciderName} في طلب المهتم ${esc.snapshot.leadName} (${esc.requestCode}): ${input.decision}`,
      { oldValue: oldStatus, newValue: esc.status, reason: esc.decisionNotes, propertyId: esc.propertyId, deviceName }
    );
    this.persist();
    return esc;
  }

  public convertLeadToTenant(userId: string, leadId: string, deviceName?: string): { lead: Lead; tenant: Tenant } {
    return this.runTransaction(() => {
      const user = this.assertPermission(userId, 'manage_tenants');
      const lead = this.state.leads.find((l) => l.id === leadId);
      if (!lead) throw new Error('ملف المهتم غير موجود');
      if (lead.convertedToTenantId) {
        const existing = this.state.tenants.find((t) => t.id === lead.convertedToTenantId);
        if (existing) return { lead, tenant: existing };
      }

      const dupTenant = lead.nationalIdOrIqama
        ? this.state.tenants.find((t) => t.nationalIdOrIqama === lead.nationalIdOrIqama)
        : this.state.tenants.find((t) => t.phone === lead.phone);

      let tenant: Tenant;
      const now = new Date().toISOString();
      if (dupTenant) {
        tenant = dupTenant;
      } else {
        tenant = {
          id: uid('ten'),
          nameAr: lead.nameAr,
          nameEn: '',
          nationalIdOrIqama: lead.nationalIdOrIqama || `10${Math.floor(10000000 + Math.random() * 89999999)}`,
          nationality: 'سعودي',
          phone: lead.phone,
          email: lead.email || '',
          tenantType: lead.tenantType || 'فرد',
          birthDate: lead.birthDate,
          familyMembersCount: lead.familyMembersCount,
          classification: 'محتمل',
          rating: lead.rating ?? 4,
          behaviorScores: { paymentCommitment: 4, unitCare: 4, cooperation: 4, penaltyTotal: 0 },
          onboardingChecklist: {
            idVerified: Boolean(lead.nationalIdOrIqama),
            docsArchived: Boolean(lead.idImageDataUrl),
            depositPaid: false,
            contractSigned: false,
            ejarRegistered: false,
            handoverSigned: false,
          },
          notes: lead.notes ? `محوّل من مهتم (${lead.source}): ${lead.notes}` : `محوّل من مهتم (${lead.source})`,
          createdAt: now,
        };
        this.state.tenants.unshift(tenant);
      }

      lead.status = 'تحويل لعقد';
      lead.convertedToTenantId = tenant.id;
      lead.updatedAt = now;
      if (!lead.interactions) lead.interactions = [];
      lead.interactions.unshift({
        id: uid('lint'),
        type: 'decision',
        direction: 'outbound',
        summary: `تم تحويل المهتم إلى ملف مستأجر رسمي (${tenant.nameAr})`,
        actorName: user.nameAr,
        createdAt: now,
      });

      this.addAudit(
        user,
        'تحويل مهتم إلى مستأجر',
        'Lead',
        lead.id,
        `تحويل المهتم ${lead.nameAr} إلى ملف مستأجر (${tenant.id})`,
        { propertyId: lead.propertyId, newValue: tenant.id, deviceName }
      );
      this.persist();
      return { lead, tenant };
    });
  }

  // 19. Utility Meters & Readings (Exclusive Currency Selector)
  public createMeterReading(
    userId: string,
    input: {
      propertyId: string;
      unitId?: string;
      meterType: 'كهرباء' | 'مياه';
      meterNumber: string;
      previousReading: number;
      currentReading: number;
      billAmount: number;
      currency: CurrencyCode;
      billingPeriod: string;
      paidBy?: 'المستأجر' | 'المالك' | 'الشركة';
      notes?: string;
    },
    deviceName?: string
  ) {
    const user = this.assertPermission(userId, 'manage_properties');
    const prop = this.state.properties.find((p) => p.id === input.propertyId);
    if (!prop) throw new Error('العقار غير موجود');
    if (!input.meterNumber?.trim()) throw new Error('يرجى إدخال رقم العداد');
    const prevVal = Number(input.previousReading || 0);
    const currVal = Number(input.currentReading || 0);
    if (currVal < prevVal) throw new Error('القراءة الحالية يجب أن تكون أكبر من أو تساوي القراءة السابقة');

    if (!this.state.meterReadings) this.state.meterReadings = [];
    const reading = {
      id: uid('mr'),
      readingNumber: `MTR-2026-${pad3(this.state.meterReadings.length + 1)}`,
      propertyId: prop.id,
      unitId: input.unitId || undefined,
      meterType: input.meterType,
      meterNumber: input.meterNumber.trim(),
      previousReading: prevVal,
      currentReading: currVal,
      consumption: Math.max(0, currVal - prevVal),
      billAmount: Number(input.billAmount || 0),
      currency: input.currency || 'SAR',
      billingPeriod: input.billingPeriod || '2026-11',
      paidBy: input.paidBy || 'المستأجر',
      recordedBy: user.nameAr,
      notes: input.notes?.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    this.state.meterReadings.unshift(reading);
    this.addAudit(
      user,
      'تسجيل قراءة عداد',
      'MeterReading',
      reading.id,
      `قراءة عداد ${reading.meterType} (${reading.meterNumber}) بقيمة ${reading.billAmount} ${reading.currency}`,
      { propertyId: prop.id, newValue: String(reading.currentReading), deviceName }
    );
    this.persist();
    return reading;
  }

  // 20. Sync Engine (Delta Pull & Multi-Device Conflict Evaluation)
  public getSyncDelta(userId: string, sinceIso?: string) {
    const conflicts = this.state.syncConflicts || [];
    const pendingConflictsCount = conflicts.filter((c) => c.status === 'بانتظار مراجعة المدير').length;
    const hasChanges = !sinceIso || this.state.lastUpdatedAt > sinceIso;
    return {
      hasChanges,
      serverRevision: this.state.syncRevision || 1,
      lastUpdatedAt: this.state.lastUpdatedAt,
      pendingConflictsCount,
      syncConflicts: conflicts,
      state: hasChanges ? this.getStateForUser(userId) : undefined,
    };
  }

  public evaluateSyncOperationConflict(
    userId: string,
    op: {
      operationId?: string;
      idempotencyKey: string;
      method: 'POST' | 'PATCH' | 'DELETE';
      endpoint: string;
      entityType?: string;
      entityId?: string;
      baseRevision?: number;
      descriptionAr: string;
      queuedAt: string;
      deviceName?: string;
    },
    clientLastUpdatedAt?: string
  ): { skipDuplicate: boolean; cachedResult?: unknown; conflict?: SyncConflictRecord } {
    const opKey = op.operationId || op.idempotencyKey;
    const existingOp = this.sqlite.hasOperation(opKey);
    if (existingOp || this.idempotencyIndex.has(op.idempotencyKey)) {
      let cachedResult: unknown;
      if (existingOp?.resultJson) {
        try {
          cachedResult = JSON.parse(existingOp.resultJson);
        } catch {
          cachedResult = undefined;
        }
      }
      return { skipDuplicate: true, cachedResult };
    }

    const isMutationOnExisting = op.method === 'PATCH' || op.method === 'DELETE';
    const entityKey =
      op.entityType && op.entityId ? `${op.entityType}:${op.entityId}` : undefined;
    const serverEntityRev = entityKey ? this.state.entityRevisions?.[entityKey] || 1 : undefined;
    const revisionMismatch =
      isMutationOnExisting &&
      typeof op.baseRevision === 'number' &&
      typeof serverEntityRev === 'number' &&
      serverEntityRev > op.baseRevision;
    const timestampMismatch =
      isMutationOnExisting &&
      typeof op.baseRevision !== 'number' &&
      Boolean(clientLastUpdatedAt && this.state.lastUpdatedAt > clientLastUpdatedAt);

    if (revisionMismatch || timestampMismatch) {
      const user = this.state.users.find((u) => u.id === userId);
      const policy = this.state.settings.syncCenter?.conflictResolution || 'latest_wins';
      const status: SyncConflictRecord['status'] =
        policy === 'manual_review'
          ? 'بانتظار مراجعة المدير'
          : 'تم اعتماد التعديل الأحدث';
      const conflict: SyncConflictRecord = {
        id: uid('cnf'),
        entityType: op.entityType || 'SyncBatch',
        entityId: op.entityId || op.endpoint,
        entityLabel: op.descriptionAr || op.endpoint,
        firstActorName: 'الخادم المركزي (تعديل متزامن)',
        secondActorName: `${user?.nameAr || userId} (${op.deviceName || 'جهاز طرفي'})`,
        firstChangeSummary: revisionMismatch
          ? `نسخة الخادم الحالية رقم ${serverEntityRev} مقابل نسخة العميل ${op.baseRevision}`
          : `تعديل سابق على الخادم بتاريخ ${this.state.lastUpdatedAt.slice(0, 16).replace('T', ' ')}`,
        secondChangeSummary: `مزامنة من وضع عدم الاتصال (${op.descriptionAr})`,
        status,
        resolvedBy: status === 'بانتظار مراجعة المدير' ? undefined : 'محرك المزامنة التلقائي',
        resolvedAt: status === 'بانتظار مراجعة المدير' ? undefined : new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      if (!this.state.syncConflicts) this.state.syncConflicts = [];
      this.state.syncConflicts.unshift(conflict);
      this.persist();
      return { skipDuplicate: false, conflict };
    }
    return { skipDuplicate: false };
  }

  public recordSyncOperationResult(
    operationId: string,
    userId: string,
    method: string,
    endpoint: string,
    result: unknown,
    entityType?: string,
    entityId?: string
  ) {
    if (!operationId) return;
    if (!this.state.processedIdempotencyKeys.includes(operationId)) {
      this.state.processedIdempotencyKeys.push(operationId);
      if (this.state.processedIdempotencyKeys.length > 2000) {
        this.state.processedIdempotencyKeys = this.state.processedIdempotencyKeys.slice(-2000);
      }
    }
    this.idempotencyIndex.add(operationId);
    if (entityType && entityId) {
      this.bumpEntityRevision(`${entityType}:${entityId}`);
    }
    this.sqlite.recordOperation({
      operationId,
      userId,
      method,
      endpoint,
      entityType,
      entityId,
      resultJson: JSON.stringify(result),
      status: 'completed',
      createdAt: new Date().toISOString(),
    });
  }

  // 21. Advanced Report Builder — Scheduled Reports
  public createScheduledReport(
    userId: string,
    input: {
      title: string;
      dataset: ScheduledReportConfig['dataset'];
      frequency: ScheduledReportConfig['frequency'];
      deliveryChannel: ScheduledReportConfig['deliveryChannel'];
      recipient: string;
      fields: string[];
      groupBy?: ScheduledReportConfig['groupBy'];
    },
    deviceName?: string
  ): ScheduledReportConfig {
    const user = this.assertPermission(userId, 'view_audit');
    if (!input.title?.trim()) throw new Error('يرجى إدخال عنوان التقرير المجدول');
    if (!this.state.scheduledReports) this.state.scheduledReports = [];
    const schedule: ScheduledReportConfig = {
      id: uid('sch'),
      title: input.title.trim(),
      dataset: input.dataset,
      frequency: input.frequency || 'أسبوعي',
      deliveryChannel: input.deliveryChannel || 'بريد إلكتروني',
      recipient: input.recipient?.trim() || user.email,
      fields: Array.isArray(input.fields) && input.fields.length > 0 ? input.fields : ['id'],
      groupBy: input.groupBy || 'none',
      enabled: true,
      createdBy: user.nameAr,
      createdAt: new Date().toISOString(),
    };
    this.state.scheduledReports.unshift(schedule);
    this.addAudit(
      user,
      'إنشاء جدولة تقرير تلقائي',
      'ScheduledReport',
      schedule.id,
      `جدولة التقرير (${schedule.title}) بتكرار ${schedule.frequency} عبر ${schedule.deliveryChannel}`,
      { deviceName }
    );
    this.persist();
    return schedule;
  }

  public deleteScheduledReport(userId: string, scheduleId: string, deviceName?: string) {
    const user = this.assertPermission(userId, 'view_audit');
    const list = this.state.scheduledReports || [];
    const target = list.find((s) => s.id === scheduleId);
    if (!target) throw new Error('التقرير المجدول غير موجود');
    this.state.scheduledReports = list.filter((s) => s.id !== scheduleId);
    this.addAudit(
      user,
      'حذف جدولة تقرير',
      'ScheduledReport',
      scheduleId,
      `إزالة التقرير المجدول: ${target.title}`,
      { deviceName }
    );
    this.persist();
    return { deletedId: scheduleId };
  }

  public runScheduledReportNow(userId: string, scheduleId: string, deviceName?: string): ScheduledReportConfig {
    const user = this.assertPermission(userId, 'view_audit');
    const target = (this.state.scheduledReports || []).find((s) => s.id === scheduleId);
    if (!target) throw new Error('التقرير المجدول غير موجود');
    target.lastRunAt = new Date().toISOString();
    this.state.notifications.unshift({
      id: uid('ntf'),
      titleAr: `تقرير مجدول جاهز: ${target.title}`,
      titleEn: `Scheduled Report Ready: ${target.title}`,
      messageAr: `تم توليد وإرسال التقرير (${target.title}) إلى ${target.recipient} عبر ${target.deliveryChannel}.`,
      messageEn: `Generated report (${target.title}) for ${target.recipient}.`,
      category: 'مالية',
      targetRoles: ['gm', 'accountant', 'sys_owner'],
      relatedView: 'reports',
      isReadBy: [],
      createdAt: target.lastRunAt,
    });
    this.addAudit(
      user,
      'تشغيل فوري لتقرير مجدول',
      'ScheduledReport',
      target.id,
      `تم تشغيل التقرير المجدول (${target.title}) وإرساله عبر ${target.deliveryChannel}`,
      { deviceName }
    );
    this.persist();
    return target;
  }

  // 22. ZATCA Phase 1/2 TLV QR E-Invoicing & Tax Archive
  private buildZatcaTlvBase64(
    sellerName: string,
    vatNumber: string,
    timestamp: string,
    totalWithVat: number,
    vatAmount: number
  ): string {
    const encodeTag = (tag: number, value: string) => {
      const buf = Buffer.from(value, 'utf-8');
      return Buffer.concat([Buffer.from([tag, buf.length]), buf]);
    };
    return Buffer.concat([
      encodeTag(1, sellerName),
      encodeTag(2, vatNumber),
      encodeTag(3, timestamp),
      encodeTag(4, totalWithVat.toFixed(2)),
      encodeTag(5, vatAmount.toFixed(2)),
    ]).toString('base64');
  }

  public createZatcaInvoice(
    userId: string,
    input: {
      invoiceType: ZatcaInvoiceRecord['invoiceType'];
      buyerName: string;
      buyerVatNumber?: string;
      propertyId?: string;
      unitId?: string;
      relatedPaymentId?: string;
      subtotal: number;
      vatRate?: number;
      notes?: string;
    },
    deviceName?: string
  ): ZatcaInvoiceRecord {
    const user = this.assertPermission(userId, 'manage_accounting');
    const subtotal = Number(input.subtotal || 0);
    if (subtotal <= 0) throw new Error('يجب أن يكون صافي مبلغ الفاتورة أكبر من صفر');
    if (!input.buyerName?.trim()) throw new Error('يرجى إدخال اسم العميل / المشتري');

    const vatRate = input.vatRate !== undefined ? Number(input.vatRate) : 15;
    const vatAmount = Math.round(subtotal * (vatRate / 100) * 100) / 100;
    const totalWithVat = Math.round((subtotal + vatAmount) * 100) / 100;
    const now = new Date().toISOString();

    if (!this.state.zatcaInvoices) this.state.zatcaInvoices = [];
    const invNum = `INV-ZATCA-${new Date().getFullYear()}-${pad4(this.state.zatcaInvoices.length + 1)}`;
    const sellerName = this.state.settings.nameAr;
    const vatNumber = this.state.settings.vatNumber || '310489211400003';

    const tlvBase64 = this.buildZatcaTlvBase64(sellerName, vatNumber, now, totalWithVat, vatAmount);
    const invoiceHash = crypto
      .createHash('sha256')
      .update(`${invNum}|${vatNumber}|${now}|${totalWithVat.toFixed(2)}|${vatAmount.toFixed(2)}`)
      .digest('hex');

    const clearanceStatus: ZatcaInvoiceRecord['clearanceStatus'] =
      this.state.settings.zatcaPhase.includes('الثانية')
        ? 'تم الربط والتحقق (المرحلة 2)'
        : 'مؤرشف (المرحلة 1)';

    const record: ZatcaInvoiceRecord = {
      id: uid('zatca'),
      invoiceNumber: invNum,
      invoiceType: input.invoiceType || 'فاتورة ضريبية مبسطة (B2C)',
      issueDate: now.slice(0, 10),
      sellerName,
      vatNumber,
      buyerName: input.buyerName.trim(),
      buyerVatNumber: input.buyerVatNumber?.trim() || undefined,
      propertyId: input.propertyId || undefined,
      unitId: input.unitId || undefined,
      relatedPaymentId: input.relatedPaymentId || undefined,
      subtotal,
      vatRate,
      vatAmount,
      totalWithVat,
      currency: 'SAR',
      tlvBase64,
      invoiceHash,
      clearanceStatus,
      notes: input.notes?.trim() || undefined,
      createdBy: user.nameAr,
      createdAt: now,
    };

    this.state.zatcaInvoices.unshift(record);

    // Save automatically to Tax Documents Archive
    this.state.documents.unshift({
      id: uid('doc'),
      title: `فاتورة ضريبية إلكترونية ${record.invoiceNumber} — ${record.buyerName}`,
      category: 'فواتير',
      fileName: `${record.invoiceNumber}.json`,
      fileType: 'application/json',
      fileSizeKb: 4,
      relatedType: record.propertyId ? 'عقار' : 'شركة',
      relatedId: record.propertyId || 'company',
      version: 1,
      uploadedBy: user.id,
      ocrStatus: 'تم الاستخراج آلياً',
      ocrRawText: `ZATCA TLV: ${tlvBase64}\nSHA256: ${invoiceHash}\nTotal: ${totalWithVat} SAR`,
      createdAt: now,
    });

    this.addAudit(
      user,
      'إصدار فاتورة إلكترونية ZATCA',
      'ZatcaInvoice',
      record.id,
      `إصدار ${record.invoiceNumber} للعميل ${record.buyerName} بإجمالي ${totalWithVat} ر.س (ضريبة ${vatAmount} ر.س) وأرشفتها ضريبياً`,
      { propertyId: record.propertyId, newValue: record.invoiceHash.slice(0, 12), deviceName }
    );
    this.persist();
    return record;
  }

  // 23. Favorite Custom Reports & Shared Compound Search Filters
  public saveFavoriteReport(
    userId: string,
    input: Omit<FavoriteReportPreset, 'id' | 'createdBy' | 'createdAt'>,
    deviceName?: string
  ): FavoriteReportPreset {
    const user = this.getActingUser(userId);
    if (!this.state.favoriteReports) this.state.favoriteReports = [];
    const preset: FavoriteReportPreset = {
      ...input,
      id: uid('favr'),
      createdBy: user.id,
      createdAt: new Date().toISOString(),
    };
    this.state.favoriteReports.unshift(preset);
    this.addAudit(user, 'حفظ تقرير مفضل', 'FavoriteReport', preset.id, `حفظ التقرير المفضل "${preset.title}"`, {
      deviceName,
    });
    this.persist();
    return preset;
  }

  public deleteFavoriteReport(userId: string, presetId: string): { deletedId: string } {
    this.getActingUser(userId);
    this.state.favoriteReports = (this.state.favoriteReports || []).filter((r) => r.id !== presetId);
    this.persist();
    return { deletedId: presetId };
  }

  public saveSharedSearchFilter(
    userId: string,
    input: Omit<SharedSearchFilter, 'id' | 'createdBy' | 'createdByName' | 'createdAt'>,
    deviceName?: string
  ): SharedSearchFilter {
    const user = this.getActingUser(userId);
    if (!this.state.sharedSearchFilters) this.state.sharedSearchFilters = [];
    const filter: SharedSearchFilter = {
      ...input,
      id: uid('sf'),
      createdBy: user.id,
      createdByName: user.nameAr,
      createdAt: new Date().toISOString(),
    };
    this.state.sharedSearchFilters.unshift(filter);
    this.addAudit(
      user,
      filter.isShared ? 'مشاركة فلتر بحث موحد' : 'حفظ فلتر بحث مفضل',
      'SharedSearchFilter',
      filter.id,
      `حفظ الفلتر "${filter.name}"`,
      { deviceName }
    );
    this.persist();
    return filter;
  }

  public deleteSharedSearchFilter(userId: string, filterId: string): { deletedId: string } {
    this.getActingUser(userId);
    this.state.sharedSearchFilters = (this.state.sharedSearchFilters || []).filter((f) => f.id !== filterId);
    this.persist();
    return { deletedId: filterId };
  }

  // ==================== CUSTOM LOCAL / DESKTOP DISK STORAGE ====================
  private resolveStorageDir(configuredPath: string | undefined, fallbackDir: string): string {
    const raw = (configuredPath || '').trim();
    if (!raw) return fallbackDir;
    // On non-Windows hosts, avoid creating local directories for Windows UNC/drive paths
    if (process.platform !== 'win32' && (/^[A-Za-z]:[\\/]/.test(raw) || raw.startsWith('\\\\'))) {
      return fallbackDir;
    }
    try {
      const resolved = path.resolve(raw);
      if (!fs.existsSync(resolved)) fs.mkdirSync(resolved, { recursive: true });
      return resolved;
    } catch {
      return fallbackDir;
    }
  }

  public getBackupsDir(): string {
    return this.resolveStorageDir(this.state.settings.backupPolicy?.customPath, this.paths.backupDir);
  }

  public getArchiveDir(): string {
    return this.resolveStorageDir(this.state.settings.backupPolicy?.archivePath, this.paths.archiveDir);
  }

  public getDocumentsDir(): string {
    return this.resolveStorageDir(this.state.settings.backupPolicy?.documentsPath, this.paths.documentsDir);
  }

  private resolveBackupFile(backupId: string): string | null {
    const candidates = [
      path.join(this.getBackupsDir(), `${backupId}.enc.json`),
      path.join(this.getBackupsDir(), `${backupId}.json`),
      path.join(this.paths.backupDir, `${backupId}.enc.json`),
      path.join(this.paths.backupDir, `${backupId}.json`),
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
    return null;
  }

  private writeDocumentToDisk(doc: DocumentRecord): string | null {
    try {
      const dir = this.getDocumentsDir();
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const safeBase = (doc.fileName || `${doc.id}.json`).replace(/[<>:"/\\|?*]+/g, '_');
      const targetFile = path.join(dir, `${doc.id}_${safeBase}`);
      if (doc.dataUrl && doc.dataUrl.includes(';base64,')) {
        const base64Part = doc.dataUrl.split(';base64,')[1];
        fs.writeFileSync(targetFile, Buffer.from(base64Part, 'base64'));
      } else {
        const metaFile = path.join(dir, `${doc.id}_${safeBase}.meta.json`);
        fs.writeFileSync(metaFile, JSON.stringify({ id: doc.id, title: doc.title, category: doc.category, fileName: doc.fileName, createdAt: doc.createdAt }, null, 2), 'utf-8');
        return metaFile;
      }
      return targetFile;
    } catch {
      return null;
    }
  }

  private writeArchiveBundleToDisk(): number {
    try {
      const dir = this.getArchiveDir();
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const bundles = {
        contracts: this.state.contracts.filter((c) => Boolean(c.archivedAt)),
        tenants: this.state.tenants.filter((t) => Boolean(t.archivedAt)),
        receipts: this.state.payments.filter((p) => Boolean(p.archivedAt)),
        tickets: this.state.tickets.filter((t) => Boolean(t.archivedAt)),
        documents: this.state.documents.filter((d) => Boolean(d.archivedAt)),
        units: this.state.units.filter((u) => Boolean(u.archivedAt)),
      };
      let written = 0;
      for (const [key, items] of Object.entries(bundles)) {
        const filePath = path.join(dir, `archive-${key}.json`);
        fs.writeFileSync(filePath, JSON.stringify({ updatedAt: new Date().toISOString(), count: items.length, items }, null, 2), 'utf-8');
        written += 1;
      }
      return written;
    } catch {
      return 0;
    }
  }

  public validateStorageFolder(targetPath: string): { ok: boolean; resolvedPath: string; error?: string } {
    const raw = (targetPath || '').trim();
    if (!raw) return { ok: false, resolvedPath: '', error: 'يرجى إدخال مسار المجلد أولاً' };
    if (process.platform !== 'win32' && (/^[A-Za-z]:[\\/]/.test(raw) || raw.startsWith('\\\\'))) {
      return {
        ok: true,
        resolvedPath: raw,
      };
    }
    try {
      const resolved = path.resolve(raw);
      if (!fs.existsSync(resolved)) fs.mkdirSync(resolved, { recursive: true });
      const probe = path.join(resolved, `.aqarplus-probe-${Date.now()}.tmp`);
      fs.writeFileSync(probe, 'ok', 'utf-8');
      fs.unlinkSync(probe);
      return { ok: true, resolvedPath: resolved };
    } catch (err) {
      return { ok: false, resolvedPath: raw, error: (err as Error).message };
    }
  }

  public getStorageStatus() {
    ensureWorkspaceDirs(this.paths);
    const backupsDir = this.getBackupsDir();
    const archiveDir = this.getArchiveDir();
    const documentsDir = this.getDocumentsDir();
    const countFiles = (dir: string) => {
      try {
        return fs.existsSync(dir) ? fs.readdirSync(dir).length : 0;
      } catch {
        return 0;
      }
    };
    return {
      dataDir: this.paths.dataDir,
      backupsDir,
      archiveDir,
      documentsDir,
      backupsFilesCount: countFiles(backupsDir),
      archiveFilesCount: countFiles(archiveDir),
      documentsFilesCount: countFiles(documentsDir),
      platform: process.platform,
      sqlite: this.sqlite.getDiagnostics(),
    };
  }

  public syncFoldersToDisk(userId: string, deviceName?: string) {
    const user = this.assertPermission(userId, 'backup_restore');
    ensureWorkspaceDirs(this.paths);
    const backupsDir = this.getBackupsDir();
    let backupsSynced = 0;
    try {
      if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });
      for (const bkp of this.state.backups) {
        const src = path.join(this.paths.backupDir, `${bkp.id}.json`);
        const dst = path.join(backupsDir, `${bkp.id}.json`);
        if (fs.existsSync(src) && src !== dst) {
          fs.copyFileSync(src, dst);
          backupsSynced += 1;
        } else if (fs.existsSync(dst)) {
          backupsSynced += 1;
        }
      }
    } catch {
      // ignore individual copy errors
    }
    const archiveFilesSynced = this.writeArchiveBundleToDisk();
    let documentsSynced = 0;
    for (const doc of this.state.documents) {
      const written = this.writeDocumentToDisk(doc);
      if (written) {
        doc.diskPath = written;
        documentsSynced += 1;
      }
    }
    this.addAudit(
      user,
      'مزامنة مجلدات التخزين على القرص',
      'StoragePaths',
      'sync',
      `نسخ احتياطي (${backupsSynced}) · أرشيف (${archiveFilesSynced}) · مستندات (${documentsSynced})`,
      { deviceName }
    );
    this.persist();
    return {
      backupsSynced,
      archiveFilesSynced,
      documentsSynced,
      status: this.getStorageStatus(),
    };
  }
}
