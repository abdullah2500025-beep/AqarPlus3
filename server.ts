import http from 'http';
import path from 'path';
import crypto from 'crypto';
import { AsyncLocalStorage } from 'node:async_hooks';
import express, { NextFunction, Request, Response } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import { AqarStore, ProvisionWorkspaceOptions } from './server/store';
import { extractDocumentDataWithGemini } from './server/ocr';
import { signSessionToken, verifySessionToken } from './server/cryptoAuth';
import { dispatchSyncOperation } from './server/syncDispatcher';

dotenv.config();

const SESSION_COOKIE_NAME = 'aqar_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

function resolvePort(): number {
  const portFlagIdx = process.argv.findIndex((a) => a === '--port' || a === '-p');
  if (portFlagIdx !== -1 && process.argv[portFlagIdx + 1]) {
    const parsed = Number(process.argv[portFlagIdx + 1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const eqFlag = process.argv.find((a) => a.startsWith('--port='));
  if (eqFlag) {
    const parsed = Number(eqFlag.split('=')[1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const envPort = Number(process.env.PORT);
  if (Number.isFinite(envPort) && envPort > 0 && envPort !== 8080) return envPort;
  return 3000;
}

const PORT = resolvePort();

function normalizeWorkspaceId(raw?: string | null): string {
  const clean = (raw || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return clean.length >= 3 && clean.length <= 40 ? clean : 'default';
}

function resolveRequestWorkspaceId(req: http.IncomingMessage): string {
  const headerWs = req.headers['x-workspace-id'];
  if (typeof headerWs === 'string' && headerWs.trim()) {
    return normalizeWorkspaceId(headerWs);
  }
  const rawUrl = req.url || '/';
  const qIdx = rawUrl.indexOf('?');
  if (qIdx >= 0) {
    const params = new URLSearchParams(rawUrl.slice(qIdx + 1));
    const qWs = params.get('workspace');
    if (qWs) return normalizeWorkspaceId(qWs);
  }
  return 'default';
}

const workspaceStores = new Map<string, AqarStore>();
const workspaceAls = new AsyncLocalStorage<{ workspaceId: string; store: AqarStore }>();

function getExistingWorkspaceStore(workspaceId = 'default'): AqarStore | null {
  const clean = normalizeWorkspaceId(workspaceId);
  const cached = workspaceStores.get(clean);
  if (cached) return cached;
  if (clean !== 'default' && !AqarStore.workspaceExists(clean)) {
    return null;
  }
  const created = new AqarStore(clean);
  workspaceStores.set(clean, created);
  return created;
}

function provisionNewWorkspaceStore(workspaceId: string, opts: ProvisionWorkspaceOptions): AqarStore {
  const clean = normalizeWorkspaceId(workspaceId);
  if (clean === 'default' || workspaceStores.has(clean) || AqarStore.workspaceExists(clean)) {
    throw new Error('مساحة العمل هذه مفعّلة مسبقاً — اختر معرّف شركة مختلفاً أو سجّل الدخول');
  }
  const created = new AqarStore(clean, opts);
  workspaceStores.set(clean, created);
  return created;
}

const store = new Proxy({} as AqarStore, {
  get(_target, prop) {
    const active = workspaceAls.getStore()?.store || getExistingWorkspaceStore('default')!;
    const value = (active as unknown as Record<PropertyKey, unknown>)[prop];
    return typeof value === 'function' ? value.bind(active) : value;
  },
});

interface AuthenticatedActor {
  userId: string;
  workspaceId: string;
  role: string;
  sessionId: string;
  rawToken: string;
  deviceName?: string;
  ipAddress: string;
}

type AuthedRequest = Request & { authActor?: AuthenticatedActor };

interface ClientSession {
  ws: WebSocket;
  workspaceId: string;
  sessionId: string;
  userId: string;
  authenticated: boolean;
  deviceName: string;
  ipAddress: string;
  connectedAt: string;
}

const activeSessions = new Map<WebSocket, ClientSession>();

function extractClientIp(req: http.IncomingMessage): string {
  const fwd = req.headers['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.trim()) {
    return fwd.split(',')[0].trim();
  }
  const remote = req.socket?.remoteAddress || '127.0.0.1';
  return remote.replace(/^::ffff:/, '');
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const key = part.slice(0, idx).trim();
    const val = part.slice(idx + 1).trim();
    try {
      result[key] = decodeURIComponent(val);
    } catch {
      result[key] = val;
    }
  }
  return result;
}

function extractSessionToken(req: http.IncomingMessage): string | null {
  const authHeader = req.headers['authorization'];
  if (typeof authHeader === 'string' && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.slice(7).trim();
  }
  const cookies = parseCookies(req.headers['cookie']);
  return cookies[SESSION_COOKIE_NAME] || null;
}

function resolveSessionActor(req: http.IncomingMessage, overrideToken?: string): AuthenticatedActor | null {
  const workspaceId = resolveRequestWorkspaceId(req);
  const wsStore = getExistingWorkspaceStore(workspaceId);
  if (!wsStore) return null;
  const rawToken = overrideToken || extractSessionToken(req);
  if (!rawToken) return null;
  const payload = verifySessionToken(rawToken, wsStore.getSessionSecret());
  if (!payload) return null;
  if (payload.wid && payload.wid !== workspaceId) return null;
  const dbSession = wsStore.getPersistence().isSessionActive(rawToken);
  if (!dbSession || dbSession.userId !== payload.uid) return null;
  const user = wsStore.getState().users.find((u) => u.id === payload.uid && u.active);
  if (!user) return null;

  const rawDevice = req.headers['x-device-name'];
  let deviceName = payload.deviceName;
  if (rawDevice) {
    try {
      deviceName = decodeURIComponent(String(rawDevice));
    } catch {
      deviceName = String(rawDevice);
    }
  }
  return {
    userId: user.id,
    workspaceId,
    role: user.role,
    sessionId: payload.sid,
    rawToken,
    deviceName,
    ipAddress: extractClientIp(req),
  };
}

function issueUserSession(
  res: Response,
  userId: string,
  role: string,
  deviceName = 'Web Terminal',
  workspaceId = workspaceAls.getStore()?.workspaceId || 'default'
): { token: string; expiresAt: string } {
  const wsStore = getExistingWorkspaceStore(workspaceId)!;
  const now = Date.now();
  const exp = now + SESSION_TTL_MS;
  const expiresAt = new Date(exp).toISOString();
  const sid = `ses-${crypto.randomBytes(8).toString('hex')}`;
  const token = signSessionToken(
    { sid, uid: userId, wid: workspaceId, role, deviceName, iat: now, exp },
    wsStore.getSessionSecret()
  );
  wsStore.getPersistence().createSession(token, userId, deviceName, expiresAt);
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_MS,
  });
  return { token, expiresAt };
}

function getPresenceList(workspaceId = workspaceAls.getStore()?.workspaceId || 'default') {
  const wsStore = getExistingWorkspaceStore(workspaceId);
  if (!wsStore) return [];
  const state = wsStore.getState();
  const seen = new Map<
    string,
    {
      sessionId: string;
      userId: string;
      nameAr: string;
      roleLabelAr: string;
      deviceName: string;
      ipAddress: string;
      connectedAt: string;
    }
  >();
  for (const s of activeSessions.values()) {
    if (!s.authenticated || s.workspaceId !== workspaceId) continue;
    const user = state.users.find((u) => u.id === s.userId);
    if (user) {
      seen.set(s.sessionId, {
        sessionId: s.sessionId,
        userId: user.id,
        nameAr: user.nameAr,
        roleLabelAr: user.roleLabelAr,
        deviceName: s.deviceName || user.deviceName,
        ipAddress: s.ipAddress,
        connectedAt: s.connectedAt,
      });
    }
  }
  return Array.from(seen.values());
}

function broadcastPresence(workspaceId = workspaceAls.getStore()?.workspaceId || 'default') {
  const payload = JSON.stringify({ type: 'presence:update', sessions: getPresenceList(workspaceId) });
  for (const [client, session] of activeSessions.entries()) {
    if (session.authenticated && session.workspaceId === workspaceId && client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

function broadcastStateChange(
  actorUserId: string,
  eventSummary: string,
  workspaceId = workspaceAls.getStore()?.workspaceId || 'default'
) {
  const wsStore = getExistingWorkspaceStore(workspaceId);
  if (!wsStore) return;
  for (const [client, session] of activeSessions.entries()) {
    if (session.authenticated && session.workspaceId === workspaceId && client.readyState === WebSocket.OPEN) {
      try {
        client.send(
          JSON.stringify({
            type: 'state:updated',
            actorUserId,
            summary: eventSummary,
            state: wsStore.getStateForUser(session.userId),
          })
        );
      } catch {
        // Skip deactivated or unauthorized WS session
      }
    }
  }
}

function getActor(req: Request): AuthenticatedActor {
  const actor = (req as AuthedRequest).authActor;
  if (!actor) {
    throw new Error('جلسة غير مصرح بها — يرجى تسجيل الدخول');
  }
  return actor;
}

const PUBLIC_API_EXACT = new Set([
  '/api/health',
  '/api/workspaces/provision',
  '/api/auth/session',
  '/api/auth/login',
  '/api/auth/login-pin',
  '/api/auth/logout',
  '/api/public/prospect-context',
  '/api/public/leads',
]);

function handleApi(app: express.Express) {
  app.use(express.json({ limit: '15mb' }));

  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const workspaceId = resolveRequestWorkspaceId(req);
    const fullPath = `/api${req.path}`;
    if (fullPath === '/api/workspaces/provision') {
      return next();
    }
    const wsStore = getExistingWorkspaceStore(workspaceId);
    if (!wsStore) {
      if (fullPath === '/api/auth/session') {
        return res.json({
          authenticated: false,
          workspaceId,
          workspaceExists: false,
          demoLoginEnabled: process.env.AQAR_DEMO_LOGIN === 'true',
          loginProfiles: [],
          companyBranding: {
            nameAr: 'مساحة عمل جديدة',
            nameEn: 'New Workspace',
          },
        });
      }
      if (fullPath === '/api/auth/login' || fullPath === '/api/auth/login-pin') {
        return res.status(401).json({
          error: 'معرّف الشركة غير مسجل بعد — اضغط «شركة جديدة» لتأسيسها أو تأكد من Workspace ID',
        });
      }
      return res.status(401).json({
        error: 'انتهت الجلسة أو لم يتم تسجيل الدخول — يرجى المصادقة للمتابعة',
        code: 'AUTH_REQUIRED',
      });
    }
    workspaceAls.run({ workspaceId, store: wsStore }, () => next());
  });

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      workspaceId: workspaceAls.getStore()?.workspaceId || 'default',
      lastUpdatedAt: store.getState().lastUpdatedAt,
      sqlite: store.getPersistence().getDiagnostics(),
    });
  });

  app.post('/api/workspaces/provision', (req: Request, res: Response) => {
    try {
      const requestedSlug = String(req.body?.workspaceSlug || '');
      const headerWs = req.headers['x-workspace-id'];
      const workspaceId = normalizeWorkspaceId(
        requestedSlug || (typeof headerWs === 'string' ? headerWs : '')
      );
      if (workspaceId === 'default') {
        return res.status(400).json({
          error: 'يرجى اختيار معرّف شركة مخصص باللغة الإنجليزية (3 أحرف على الأقل)',
        });
      }
      const companyNameAr = String(req.body?.companyNameAr || '').trim();
      const companyNameEn = String(req.body?.companyNameEn || companyNameAr || 'AqarPlus Workspace').trim();
      const adminNameAr = String(req.body?.adminNameAr || '').trim();
      const adminEmail = String(req.body?.adminEmail || '').trim().toLowerCase();
      const adminPhone = String(req.body?.adminPhone || '').trim();
      const password = String(req.body?.password || '');
      const pin = String(req.body?.pin || '').trim();

      if (!companyNameAr || !adminNameAr || !adminEmail || password.length < 8) {
        return res.status(400).json({
          error: 'يلزم إدخال اسم الشركة، واسم المدير، والبريد الإلكتروني، وكلمة مرور لا تقل عن 8 أحرف',
        });
      }
      if (pin && !/^\d{4,6}$/.test(pin)) {
        return res.status(400).json({ error: 'رمز PIN يجب أن يتكون من 4 إلى 6 أرقام فقط' });
      }

      const deviceName = String(req.body?.deviceName || 'Web Terminal');
      const provisionedStore = provisionNewWorkspaceStore(workspaceId, {
        companyNameAr,
        companyNameEn,
        adminNameAr,
        adminEmail,
        adminPhone,
        password,
        pin: pin || undefined,
        deviceName,
      });

      return workspaceAls.run({ workspaceId, store: provisionedStore }, () => {
        const adminUser = provisionedStore.getState().users[0];
        const { token, expiresAt } = issueUserSession(
          res,
          adminUser.id,
          adminUser.role,
          deviceName,
          workspaceId
        );
        res.status(201).json({
          ok: true,
          workspaceId,
          authenticated: true,
          user: adminUser,
          token,
          expiresAt,
          state: provisionedStore.getStateForUser(adminUser.id),
        });
      });
    } catch (e: unknown) {
      const msg = (e as Error).message || 'تعذر تأسيس مساحة العمل';
      res.status(msg.includes('مفعّلة مسبقاً') ? 409 : 400).json({ error: msg });
    }
  });

  // Authentication & Session Endpoints
  app.get('/api/auth/session', (req: Request, res: Response) => {
    const settings = store.getState().settings;
    const demoLoginEnabled = process.env.AQAR_DEMO_LOGIN === 'true';
    const workspaceId = workspaceAls.getStore()?.workspaceId || 'default';
    const companyBranding = {
      nameAr: settings.nameAr,
      nameEn: settings.nameEn,
      logoDataUrl: settings.logoDataUrl,
    };
    const actor = resolveSessionActor(req);
    if (!actor) {
      return res.json({
        authenticated: false,
        workspaceId,
        workspaceExists: true,
        demoLoginEnabled,
        loginProfiles: demoLoginEnabled ? store.getLoginProfiles() : [],
        companyBranding,
      });
    }
    const user = store.getState().users.find((u) => u.id === actor.userId);
    res.json({
      authenticated: true,
      workspaceId,
      workspaceExists: true,
      user,
      token: actor.rawToken,
      demoLoginEnabled,
      loginProfiles: demoLoginEnabled ? store.getLoginProfiles() : [],
      companyBranding,
    });
  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    try {
      const identifier = String(req.body?.identifier || req.body?.email || req.body?.userId || '');
      const password = String(req.body?.password || '');
      const deviceName = req.body?.deviceName
        ? String(req.body.deviceName)
        : req.headers['x-device-name']
        ? decodeURIComponent(String(req.headers['x-device-name']))
        : 'Web Terminal';
      const user = store.authenticatePassword(identifier, password, deviceName);
      const { token, expiresAt } = issueUserSession(res, user.id, user.role, deviceName);
      broadcastPresence();
      res.json({
        authenticated: true,
        user,
        token,
        expiresAt,
        state: store.getStateForUser(user.id),
      });
    } catch (e: unknown) {
      const msg = (e as Error).message;
      res.status(msg.includes('قفل الحساب') ? 429 : 401).json({ error: msg });
    }
  });

  app.post('/api/auth/login-pin', (req: Request, res: Response) => {
    try {
      const userId = String(req.body?.userId || req.body?.identifier || '');
      const pin = String(req.body?.pin || '');
      const deviceName = req.body?.deviceName ? String(req.body.deviceName) : 'Web Terminal';
      const user = store.authenticatePin(userId, pin, deviceName);
      const { token, expiresAt } = issueUserSession(res, user.id, user.role, deviceName);
      broadcastPresence();
      res.json({
        authenticated: true,
        user,
        token,
        expiresAt,
        state: store.getStateForUser(user.id),
      });
    } catch (e: unknown) {
      const msg = (e as Error).message;
      res.status(msg.includes('قفل') ? 429 : 401).json({ error: msg });
    }
  });

  app.post('/api/auth/logout', (req: Request, res: Response) => {
    const rawToken = extractSessionToken(req);
    if (rawToken) {
      store.getPersistence().revokeSession(rawToken);
    }
    res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
    res.json({ ok: true });
  });

  // Strict Authentication Middleware for all protected /api/* routes
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    const fullPath = `/api${req.path}`;
    if (PUBLIC_API_EXACT.has(fullPath) || fullPath.startsWith('/api/public/lead-decision/')) {
      return next();
    }
    const actor = resolveSessionActor(req);
    if (!actor) {
      return res.status(401).json({
        error: 'انتهت الجلسة أو لم يتم تسجيل الدخول — يرجى المصادقة للمتابعة',
        code: 'AUTH_REQUIRED',
      });
    }
    (req as AuthedRequest).authActor = actor;
    next();
  });

  app.post('/api/auth/credentials', (req: Request, res: Response) => {
    try {
      const actor = getActor(req);
      const targetUserId = String(req.body?.targetUserId || actor.userId);
      store.updateUserCredentials(
        actor.userId,
        targetUserId,
        {
          currentPassword: req.body?.currentPassword,
          newPassword: req.body?.newPassword,
          newPin: req.body?.newPin,
        },
        actor.deviceName
      );
      res.json({ ok: true, state: store.getStateForUser(actor.userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.get('/api/state', (req: Request, res: Response) => {
    try {
      const { userId } = getActor(req);
      res.json({
        state: store.getStateForUser(userId),
        presence: getPresenceList(),
      });
    } catch (e: unknown) {
      res.status(401).json({ error: (e as Error).message });
    }
  });

  app.post('/api/properties', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const property = store.createProperty(userId, req.body, deviceName);
      broadcastStateChange(userId, `تمت إضافة العقار ${property.nameAr}`);
      res.status(201).json({ property, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/units', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const unit = store.createUnit(userId, req.body, deviceName);
      broadcastStateChange(userId, `تمت إضافة الوحدة ${unit.unitNumber}`);
      res.status(201).json({ unit, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.patch('/api/units/:id/status', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const unit = store.updateUnitStatus(userId, String(req.params.id), req.body.status, req.body.reason, deviceName);
      broadcastStateChange(userId, `تغيير حالة الوحدة ${unit.unitNumber} إلى ${unit.status}`);
      res.json({ unit, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/units/:id/link-tenant', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const unit = store.linkTenantToUnit(userId, String(req.params.id), req.body.tenantId, deviceName);
      broadcastStateChange(userId, `ربط إداري للوحدة ${unit.unitNumber}`);
      res.json({ unit, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/tenants', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const tenant = store.createTenant(userId, req.body, deviceName);
      broadcastStateChange(userId, `تسجيل المستأجر ${tenant.nameAr}`);
      res.status(201).json({ tenant, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.delete('/api/tenants/:id', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      store.deleteTenant(userId, String(req.params.id), deviceName);
      broadcastStateChange(userId, `حذف ملف مستأجر`);
      res.json({ ok: true, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/leads', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const lead = store.createLead(userId, req.body, deviceName);
      broadcastStateChange(userId, `تسجيل عميل محتمل ${lead.nameAr}`);
      res.status(201).json({ lead, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/contracts', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const result = store.createContract(userId, req.body, deviceName);
      broadcastStateChange(userId, `إنشاء العقد ${result.contract.internalNumber}`);
      res.status(201).json({ ...result, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.patch('/api/contracts/:id/ejar', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const contract = store.updateContractEjarStatus(
        userId,
        String(req.params.id),
        req.body.ejarNumber,
        req.body.ejarStatus,
        req.body.lifecycleStatus,
        deviceName
      );
      broadcastStateChange(userId, `تحديث توثيق العقد ${contract.internalNumber}`);
      res.json({ contract, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/handovers', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const handover = store.createHandoverInspection(userId, req.body, deviceName);
      broadcastStateChange(userId, `إنشاء محضر ${handover.type}`);
      res.status(201).json({ handover, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/handovers/:id/approve', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const handover = store.approveHandover(userId, String(req.params.id), req.body.nextUnitStatus, deviceName);
      broadcastStateChange(userId, `اعتماد محضر الاستلام والإخلاء`);
      res.json({ handover, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/payments', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const idempotencyKey =
        String(req.headers['x-idempotency-key'] || req.body.idempotencyKey || '') ||
        `srv-${Date.now()}-${Math.random()}`;
      const payment = store.recordPayment(userId, { ...req.body, idempotencyKey }, deviceName);
      broadcastStateChange(userId, `إصدار سند قبض ${payment.receiptNumber} (${payment.amount.toLocaleString()} ر.س)`);
      res.status(201).json({ payment, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/payments/:id/reverse', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const payment = store.reverseReceipt(userId, String(req.params.id), req.body.reason, deviceName);
      broadcastStateChange(userId, `عكس السند ${payment.receiptNumber}`);
      res.json({ payment, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/expenses', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const expense = store.createExpense(userId, req.body, deviceName);
      broadcastStateChange(userId, `تسجيل مصروف ${expense.expenseNumber}`);
      res.status(201).json({ expense, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/expenses/:id/decision', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const expense = store.decideExpense(userId, String(req.params.id), req.body.decision, req.body.reason, deviceName);
      broadcastStateChange(userId, `قرار اعتماد المصروف ${expense.expenseNumber}: ${expense.approvalStatus}`);
      res.json({ expense, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/tickets', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const ticket = store.createTicket(userId, req.body, deviceName);
      broadcastStateChange(userId, `فتح بلاغ صيانة ${ticket.ticketNumber}`);
      res.status(201).json({ ticket, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.patch('/api/tickets/:id', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const ticket = store.updateTicket(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `تحديث بلاغ الصيانة ${ticket.ticketNumber}`);
      res.json({ ticket, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/tasks', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const task = store.createTask(userId, req.body, deviceName);
      broadcastStateChange(userId, `إضافة مهمة: ${task.title}`);
      res.status(201).json({ task, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.patch('/api/tasks/:id', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const task = store.updateTask(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `تحديث مهمة: ${task.title}`);
      res.json({ task, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/tasks/:id/reassign', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const task = store.reassignTask(
        userId,
        String(req.params.id),
        String(req.body.assignedTo || ''),
        req.body.reason ? String(req.body.reason) : undefined,
        deviceName
      );
      broadcastStateChange(userId, `تحويل مهمة: ${task.title}`);
      res.json({ task, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/tasks/:id/review', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const task = store.reviewTask(
        userId,
        String(req.params.id),
        req.body.decision === 'reject' ? 'reject' : 'approve',
        req.body.reason ? String(req.body.reason) : undefined,
        deviceName
      );
      broadcastStateChange(userId, `مراجعة واعتماد مهمة: ${task.title}`);
      res.json({ task, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/communications', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const log = store.addCommunication(userId, req.body, deviceName);
      broadcastStateChange(userId, `تسجيل تواصل مع ${log.targetName}`);
      res.status(201).json({ log, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/documents', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const doc = store.addDocument(userId, req.body, deviceName);
      broadcastStateChange(userId, `أرشفة مستند ${doc.title}`);
      res.status(201).json({ doc, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/vendors', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const vendor = store.createVendor(userId, req.body, deviceName);
      broadcastStateChange(userId, `إضافة المورد ${vendor.nameAr}`);
      res.status(201).json({ vendor, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/permissions/toggle', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const rolePermissions = store.toggleRolePermission(userId, req.body.role, req.body.permission, deviceName);
      broadcastStateChange(userId, `تحديث صلاحيات الدور ${req.body.role}`);
      res.json({ rolePermissions, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/notifications/read', (req: Request, res: Response) => {
    try {
      const { userId } = getActor(req);
      store.markNotificationsRead(userId);
      res.json({ ok: true, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/backups', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const backup = store.createBackup(
        userId,
        req.body.label,
        deviceName,
        req.body?.encryptPassword ? String(req.body.encryptPassword) : undefined
      );
      broadcastStateChange(userId, `إنشاء نسخة احتياطية`);
      res.status(201).json({ backup, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/backups/:id/restore', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const mode = req.body?.mode === 'merge' ? 'merge' : 'replace';
      const password = req.body?.password ? String(req.body.password) : undefined;
      store.restoreBackup(userId, String(req.params.id), deviceName, mode, password);
      broadcastStateChange(userId, `استعادة نسخة احتياطية (${mode === 'merge' ? 'دمج ذكي' : 'استبدال كامل'})`);
      res.json({ ok: true, mode, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/reminders/rules', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const rule = store.createReminderRule(userId, req.body, deviceName);
      broadcastStateChange(userId, `إضافة قاعدة جدولة تنبيه إيجار: ${rule.nameAr}`);
      res.status(201).json({ rule, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.patch('/api/reminders/rules/:id', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const rule = store.toggleReminderRule(userId, String(req.params.id), Boolean(req.body.enabled), deviceName);
      broadcastStateChange(userId, `تحديث جدولة التنبيه ${rule.nameAr}`);
      res.json({ rule, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.delete('/api/reminders/rules/:id', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      store.deleteReminderRule(userId, String(req.params.id), deviceName);
      broadcastStateChange(userId, `حذف قاعدة تنبيه إيجار`);
      res.json({ ok: true, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/reminders/run', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const logs = store.runReminderScheduler(userId, req.body, deviceName);
      broadcastStateChange(userId, `تشغيل تنبيهات الإيجار (${logs.length} إشعار مرسل)`);
      res.json({ logs, count: logs.length, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/companies', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const company = store.createCompany(userId, req.body, deviceName);
      broadcastStateChange(userId, `إضافة الشركة ${company.nameAr}`);
      res.status(201).json({ company, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.patch('/api/settings', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const settings = store.updateSettings(userId, req.body, deviceName);
      broadcastStateChange(userId, `تحديث إعدادات المنشأة والعملات`);
      res.json({ settings, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/documents/ocr', async (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const result = await extractDocumentDataWithGemini({
        dataUrl: String(req.body?.dataUrl || ''),
        mimeType: req.body?.mimeType ? String(req.body.mimeType) : undefined,
        fileName: req.body?.fileName ? String(req.body.fileName) : undefined,
        categoryHint: req.body?.categoryHint ? String(req.body.categoryHint) : undefined,
      });
      const matches = store.findOcrEntityMatches(result.extracted);

      if (req.body?.autoSync) {
        const synced = store.syncOcrToEntities(
          userId,
          {
            extracted: result.extracted,
            targetTenantId: req.body?.targetTenantId ? String(req.body.targetTenantId) : undefined,
            targetPropertyId: req.body?.targetPropertyId ? String(req.body.targetPropertyId) : undefined,
            applyTenant: req.body?.applyTenant,
            applyProperty: req.body?.applyProperty,
            createMissing: req.body?.createMissing,
          },
          deviceName
        );
        broadcastStateChange(userId, `استخراج OCR وربط البيانات آلياً بالمستأجرين والعقارات`);
        return res.json({
          ...result,
          matches,
          syncSummary: synced.summary,
          state: store.getStateForUser(userId),
        });
      }

      res.json({ ...result, matches });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/documents/sync-ocr', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      if (!req.body?.extracted) {
        throw new Error('بيانات الاستخراج الضوئي (extracted) مطلوبة لعملية الربط');
      }
      const synced = store.syncOcrToEntities(
        userId,
        {
          extracted: req.body.extracted,
          docId: req.body?.docId ? String(req.body.docId) : undefined,
          targetTenantId: req.body?.targetTenantId ? String(req.body.targetTenantId) : undefined,
          targetPropertyId: req.body?.targetPropertyId ? String(req.body.targetPropertyId) : undefined,
          applyTenant: req.body?.applyTenant,
          applyProperty: req.body?.applyProperty,
          createMissing: req.body?.createMissing,
        },
        deviceName
      );
      broadcastStateChange(userId, `ربط نتائج OCR بحقول المستأجرين والعقارات`);
      res.json({ ...synced, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/documents/:id/access', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const doc = store.recordDocumentAccess(userId, String(req.params.id), req.body.action || 'معاينة', deviceName);
      broadcastStateChange(userId, `سجل وصول للمستند ${doc.title}`);
      res.json({ doc, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/documents/:id/ocr', async (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const docExisting = store.getState().documents.find((d) => d.id === String(req.params.id));
      const dataUrl = String(req.body?.dataUrl || docExisting?.dataUrl || '');
      const result = await extractDocumentDataWithGemini({
        dataUrl,
        fileName: docExisting?.fileName,
        categoryHint: docExisting?.category,
      });
      const doc = store.attachDocumentOcr(userId, String(req.params.id), result.extracted, result.rawText, deviceName);
      const matches = store.findOcrEntityMatches(result.extracted);
      let syncSummary;
      if (req.body?.autoSync !== false) {
        const synced = store.syncOcrToEntities(
          userId,
          {
            extracted: result.extracted,
            docId: doc.id,
            createMissing: false,
          },
          deviceName
        );
        syncSummary = synced.summary;
      }
      broadcastStateChange(userId, `تحليل OCR للمستند ${doc.title}`);
      res.json({
        doc,
        extracted: result.extracted,
        matches,
        syncSummary,
        state: store.getStateForUser(userId),
      });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/owners/:id/transfer', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const result = store.recordOwnerTransfer(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `تحويل مستحقات للمالك ${result.owner.nameAr}`);
      res.status(201).json({ ...result, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/contracts/:id/renew', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const result = store.renewContract(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `تجديد العقد ${result.contract.internalNumber}`);
      res.status(201).json({ ...result, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/purchase-orders', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const po = store.createPurchaseOrder(userId, req.body, deviceName);
      broadcastStateChange(userId, `إنشاء طلب شراء ${po.poNumber}`);
      res.status(201).json({ po, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.patch('/api/purchase-orders/:id', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const po = store.updatePurchaseOrder(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `تحديث طلب شراء ${po.poNumber}`);
      res.json({ po, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/decisions', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const decision = store.createDecision(userId, req.body, deviceName);
      broadcastStateChange(userId, `إصدار قرار إداري ${decision.decisionNumber}`);
      res.status(201).json({ decision, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.patch('/api/tenants/:id/checklist', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const tenant = store.updateTenantChecklist(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `تحديث قائمة سياسة التسكين للمستأجر ${tenant.nameAr}`);
      res.json({ tenant, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/import/bulk', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const summary = store.bulkImportRecords(userId, req.body.type, req.body.rows, deviceName);
      broadcastStateChange(userId, `استيراد جماعي من Excel (${summary.inserted} سجل)`);
      res.status(201).json({ ...summary, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/workspace/reset-fresh', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const fresh = store.resetToFreshWorkspace(userId, deviceName);
      broadcastStateChange(userId, 'تهيئة مساحة عمل نظيفة عبر الإعداد الأولي');
      res.json({ ok: true, state: fresh });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  // Smart Archive Center Endpoints
  app.post('/api/archive/move', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const result = store.archiveEntity(userId, req.body, deviceName);
      broadcastStateChange(userId, result.summary);
      res.json({ ...result, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/archive/restore', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const result = store.restoreArchivedEntity(userId, req.body, deviceName);
      broadcastStateChange(userId, result.restoredSummary);
      res.json({ ...result, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      const msg = (e as Error).message || '';
      const isConflict = msg.startsWith('CONFLICT_ACTIVE_CONTRACT:');
      res.status(isConflict ? 409 : 400).json({ error: msg, conflict: isConflict });
    }
  });

  app.post('/api/archive/run-scheduled', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const result = store.runScheduledArchival(userId, deviceName);
      broadcastStateChange(userId, result.summary);
      res.json({ ...result, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/archive/filters', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const filter = store.saveArchiveFilter(userId, req.body, deviceName);
      broadcastStateChange(userId, `حفظ فلتر الأرشيف "${filter.name}"`);
      res.status(201).json({ filter, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.delete('/api/archive/filters/:id', (req: Request, res: Response) => {
    try {
      const { userId } = getActor(req);
      store.deleteArchiveFilter(userId, String(req.params.id));
      res.json({ ok: true, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  // Team & Workforce Management Endpoints
  app.post('/api/team/users', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const user = store.createStaffUser(userId, req.body, deviceName);
      broadcastStateChange(userId, `إضافة موظف جديد: ${user.nameAr}`);
      res.status(201).json({ user, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.patch('/api/team/users/:id', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const user = store.updateStaffUser(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `تحديث ملف الموظف: ${user.nameAr}`);
      res.json({ user, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.delete('/api/team/users/:id', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const result = store.deleteStaffUser(userId, String(req.params.id), deviceName);
      broadcastStateChange(userId, 'حذف حساب مستخدم');
      res.json({ ...result, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.patch('/api/team/security-policy', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const securityPolicy = store.updateSecurityPolicy(userId, req.body, deviceName);
      broadcastStateChange(userId, `تحديث سياسة الأمان وكلمات المرور`);
      res.json({ securityPolicy, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/team/conflicts/:id/resolve', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const resolution =
        req.body.resolution === 'تم الإبقاء على النسخة السابقة'
          ? 'تم الإبقاء على النسخة السابقة'
          : 'تم اعتماد التعديل الأحدث';
      const conflict = store.resolveSyncConflict(userId, String(req.params.id), resolution, deviceName);
      broadcastStateChange(userId, `معالجة تعارض مزامنة: ${conflict.entityLabel}`);
      res.json({ conflict, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/team/sessions/terminate', (req: Request, res: Response) => {
    try {
      const { userId, deviceName, ipAddress } = getActor(req);
      const state = store.getState();
      const actor = state.users.find((u) => u.id === userId);
      if (!actor || !(state.rolePermissions[actor.role] || []).includes('manage_users')) {
        throw new Error('لا تملك صلاحية إنهاء الجلسات عن بُعد');
      }
      const targetUserId = req.body.userId ? String(req.body.userId) : undefined;
      const targetSessionId = req.body.sessionId ? String(req.body.sessionId) : undefined;
      const reason = String(req.body.reason || 'إنهاء جلسة إداري عن بُعد');

      let terminatedCount = 0;
      for (const [client, session] of Array.from(activeSessions.entries())) {
        const matchesSession = targetSessionId && session.sessionId === targetSessionId;
        const matchesUser = !targetSessionId && targetUserId && session.userId === targetUserId;
        if (matchesSession || matchesUser) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                type: 'session:terminated',
                userId: session.userId,
                sessionId: session.sessionId,
                reason,
                terminatedBy: actor.nameAr,
              })
            );
          }
          activeSessions.delete(client);
          try {
            client.close(4001, 'Terminated by administrator');
          } catch {
            // ignore
          }
          terminatedCount += 1;
        }
      }

      if (targetUserId) {
        store.recordLoginEvent({
          userId: targetUserId,
          deviceName: deviceName || 'لوحة إدارة الفريق',
          ipAddress,
          method: 'تسجيل خروج عن بُعد',
          success: true,
        });
      }

      broadcastPresence();
      broadcastStateChange(userId, `إنهاء ${terminatedCount} جلسة نشطة عن بُعد`);
      res.json({
        ok: true,
        terminatedCount,
        presence: getPresenceList(),
        state: store.getStateForUser(userId),
      });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/security/logout-others', (req: Request, res: Response) => {
    try {
      const { userId, deviceName, ipAddress } = getActor(req);
      const keepSessionId = req.body?.keepSessionId ? String(req.body.keepSessionId) : undefined;
      let terminatedCount = 0;
      for (const [client, session] of Array.from(activeSessions.entries())) {
        if (session.userId === userId && (!keepSessionId || session.sessionId !== keepSessionId)) {
          if (client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                type: 'session:terminated',
                userId: session.userId,
                sessionId: session.sessionId,
                reason: 'تم تسجيل الخروج من جميع الأجهزة الأخرى عبر مركز الأمان',
              })
            );
          }
          activeSessions.delete(client);
          try {
            client.close(4001, 'Logged out from security center');
          } catch {
            // ignore
          }
          terminatedCount += 1;
        }
      }
      store.recordLoginEvent({
        userId,
        deviceName: deviceName || 'مركز الأمان',
        ipAddress,
        method: 'تسجيل خروج عن بُعد',
        success: true,
      });
      broadcastPresence();
      broadcastStateChange(userId, `تسجيل الخروج من جميع الأجهزة الأخرى (${terminatedCount} جلسة)`);
      res.json({ ok: true, terminatedCount, presence: getPresenceList(), state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.get('/api/backups/:id/preview', (req: Request, res: Response) => {
    try {
      const password = req.query.password ? String(req.query.password) : undefined;
      const preview = store.previewBackup(String(req.params.id), password);
      res.json(preview);
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/backups/:id/preview', (req: Request, res: Response) => {
    try {
      const password = req.body?.password ? String(req.body.password) : undefined;
      const preview = store.previewBackup(String(req.params.id), password);
      res.json(preview);
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/system/clear-temp', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const settings = store.clearTempCache(userId, deviceName);
      broadcastStateChange(userId, 'تنظيف الملفات المؤقتة من مركز الإعدادات');
      res.json({ settings, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  // Communication Templates Endpoints
  app.post('/api/templates', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const template = store.createTemplate(userId, req.body, deviceName);
      broadcastStateChange(userId, `إنشاء قالب تواصل: ${template.name}`);
      res.status(201).json({ template, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.patch('/api/templates/:id', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const template = store.updateTemplate(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `تحديث قالب التواصل: ${template.name}`);
      res.json({ template, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.delete('/api/templates/:id', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      store.deleteTemplate(userId, String(req.params.id), deviceName);
      broadcastStateChange(userId, 'حذف قالب تواصل');
      res.json({ ok: true, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/templates/:id/use', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const result = store.useTemplate(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `إرسال رسالة لقالب ${result.template?.name || ''}`);
      res.json({ ...result, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/templates/import', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const templates = Array.isArray(req.body?.templates) ? req.body.templates : [];
      const count = store.importTemplates(userId, templates, deviceName);
      broadcastStateChange(userId, `استيراد ${count} قالب تواصل`);
      res.status(201).json({ count, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  // Tenant Files Center Endpoints
  app.patch('/api/tenants/:id', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const tenant = store.updateTenant(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `تحديث ملف المستأجر ${tenant.nameAr}`);
      res.json({ tenant, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/tenants/:id/notes', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const note = store.addTenantViolationNote(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `تسجيل ملاحظة/مخالفة لملف المستأجر`);
      res.status(201).json({ note, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/tenants/:id/appointments', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const log = store.scheduleTenantAppointment(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `جدولة موعد مع المستأجر ${log.targetName}`);
      res.status(201).json({ log, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.patch('/api/contracts/:id', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const contract = store.updateContractDetails(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `تعديل بيانات العقد ${contract.internalNumber}`);
      res.json({ contract, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  // Expenses & Supplier Invoices Center Endpoints
  app.patch('/api/expenses/:id', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const expense = store.updateOrCancelExpense(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `تحديث المصروف ${expense.expenseNumber}`);
      res.json({ expense, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.patch('/api/vendors/:id', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const vendor = store.updateVendor(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `تحديث ملف وتقييم المورد ${vendor.nameAr}`);
      res.json({ vendor, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/supplier-invoices', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const invoice = store.createSupplierInvoice(userId, req.body, deviceName);
      broadcastStateChange(userId, `تسجيل فاتورة مورد ${invoice.invoiceCode}`);
      res.status(201).json({ invoice, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.patch('/api/supplier-invoices/:id', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const invoice = store.updateSupplierInvoice(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `تحديث فاتورة المورد ${invoice.invoiceCode}`);
      res.json({ invoice, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/recurring-expenses', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const rule = store.createRecurringExpense(userId, req.body, deviceName);
      broadcastStateChange(userId, `إضافة مصروف دوري: ${rule.title}`);
      res.status(201).json({ rule, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.patch('/api/recurring-expenses/:id', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const rule = store.toggleRecurringExpense(userId, String(req.params.id), Boolean(req.body.enabled), deviceName);
      broadcastStateChange(userId, `تحديث المصروف الدوري: ${rule.title}`);
      res.json({ rule, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/recurring-expenses/generate', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const created = store.generateDueRecurringExpenses(userId, req.body?.month, deviceName);
      broadcastStateChange(userId, `توليد ${created.length} مسودة مصروف دوري`);
      res.status(201).json({ created, count: created.length, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/property-budgets', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const budget = store.upsertPropertyBudget(userId, req.body, deviceName);
      broadcastStateChange(userId, `تحديث ميزانية العقار لشهر ${budget.month}`);
      res.status(201).json({ budget, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.patch('/api/leads/:id', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const lead = store.updateLead(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `تحديث بيانات المهتم ${lead.nameAr}`);
      res.json({ lead, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/leads/:id/escalate', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const escalation = store.escalateLead(userId, String(req.params.id), req.body, deviceName);
      broadcastStateChange(userId, `إرسال بيانات المهتم ${escalation.snapshot.leadName} للمراجعة`);
      res.status(201).json({ escalation, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/lead-escalations/:id/decision', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const escalation = store.decideLeadEscalation(
        userId,
        String(req.params.id),
        { decision: req.body.decision, decisionNotes: req.body.decisionNotes, isToken: false },
        deviceName
      );
      broadcastStateChange(userId, `قرار طلب المهتم ${escalation.requestCode}: ${escalation.status}`);
      res.json({ escalation, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/leads/:id/convert', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const result = store.convertLeadToTenant(userId, String(req.params.id), deviceName);
      broadcastStateChange(userId, `تحويل المهتم ${result.lead.nameAr} إلى مستأجر`);
      res.status(201).json({ ...result, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/meters/readings', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const reading = store.createMeterReading(userId, req.body, deviceName);
      broadcastStateChange(userId, `تسجيل قراءة عداد ${reading.meterType} (${reading.meterNumber})`);
      res.status(201).json({ reading, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  // Public Prospect Intake & External Owner Decision Portals (Zero leakage)
  app.get('/api/public/prospect-context', (_req: Request, res: Response) => {
    const full = store.getState();
    res.json({
      companyName: full.settings.nameAr,
      companyPhone: full.settings.phone,
      properties: full.properties
        .filter((p) => p.status === 'نشط')
        .map((p) => ({
          id: p.id,
          nameAr: p.nameAr,
          city: p.city,
          district: p.district,
          units: full.units
            .filter((u) => u.propertyId === p.id && u.status === 'شاغرة')
            .map((u) => ({
              id: u.id,
              unitNumber: u.unitNumber,
              unitType: u.unitType,
              rooms: u.rooms,
              suggestedMonthlyRent: u.suggestedMonthlyRent,
            })),
        })),
    });
  });

  app.post('/api/public/leads', (req: Request, res: Response) => {
    try {
      const result = store.createPublicLead(req.body);
      broadcastStateChange('public-portal', `تسجيل مهتم جديد عبر الرابط العام: ${result.lead.nameAr}`);
      res.status(201).json(result);
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.get('/api/public/lead-decision/:token', (req: Request, res: Response) => {
    try {
      const data = store.getLeadEscalationByToken(String(req.params.token));
      res.json(data);
    } catch (e: unknown) {
      res.status(404).json({ error: (e as Error).message });
    }
  });

  app.post('/api/public/lead-decision/:token', (req: Request, res: Response) => {
    try {
      const escalation = store.decideLeadEscalation(
        null,
        String(req.params.token),
        { decision: req.body.decision, decisionNotes: req.body.decisionNotes, isToken: true },
        'External Owner Link'
      );
      broadcastStateChange(escalation.recipientId, `قرار المالك (${escalation.requestCode}): ${escalation.status}`);
      res.json({ escalation });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  // Sync Engine Endpoints (Delta Pull + Batch Conflict-Aware Upload)
  app.get('/api/sync/delta', (req: Request, res: Response) => {
    try {
      const { userId } = getActor(req);
      const since = req.query.since ? String(req.query.since) : undefined;
      res.json(store.getSyncDelta(userId, since));
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/sync/batch', async (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const operations = Array.isArray(req.body?.operations) ? req.body.operations : [];
      const clientLastUpdatedAt = req.body?.clientLastUpdatedAt ? String(req.body.clientLastUpdatedAt) : undefined;
      const beforeRevision = store.getState().syncRevision || 1;
      let uploaded = 0;
      let skippedDuplicates = 0;
      const newConflicts = [];
      const errors: string[] = [];

      for (const op of operations) {
        if (!op || typeof op.endpoint !== 'string' || !op.endpoint.startsWith('/api/')) continue;
        const operationId = String(op.operationId || op.idempotencyKey || '');
        const opMethod: 'POST' | 'PATCH' | 'DELETE' =
          op.method === 'PATCH' ? 'PATCH' : op.method === 'DELETE' ? 'DELETE' : 'POST';
        const evalRes = store.evaluateSyncOperationConflict(
          userId,
          {
            operationId,
            idempotencyKey: String(op.idempotencyKey || operationId),
            method: opMethod,
            endpoint: op.endpoint,
            entityType: op.entityType ? String(op.entityType) : undefined,
            entityId: op.entityId ? String(op.entityId) : undefined,
            baseRevision: typeof op.baseRevision === 'number' ? op.baseRevision : undefined,
            descriptionAr: String(op.descriptionAr || ''),
            queuedAt: String(op.queuedAt || new Date().toISOString()),
            deviceName: op.deviceName || deviceName,
          },
          clientLastUpdatedAt
        );
        if (evalRes.skipDuplicate) {
          skippedDuplicates += 1;
          continue;
        }
        if (evalRes.conflict) {
          newConflicts.push(evalRes.conflict);
        }
        const dispatchRes = dispatchSyncOperation(store, {
          method: opMethod,
          endpoint: op.endpoint,
          body: (op.body && typeof op.body === 'object' ? op.body : {}) as Record<string, unknown>,
          userId,
          deviceName: op.deviceName || deviceName,
          idempotencyKey: String(op.idempotencyKey || operationId),
          operationId,
        });
        if (!dispatchRes.ok) {
          errors.push(`${op.descriptionAr || op.endpoint}: ${String(dispatchRes.data?.error || dispatchRes.status)}`);
        } else {
          if (operationId) {
            store.recordSyncOperationResult(
              operationId,
              userId,
              opMethod,
              op.endpoint,
              dispatchRes.data,
              dispatchRes.entityType,
              dispatchRes.entityId
            );
          }
          uploaded += 1;
        }
      }

      if (uploaded > 0 || newConflicts.length > 0) {
        broadcastStateChange(userId, `مزامنة دفعية (${uploaded} عملية${newConflicts.length ? ` · ${newConflicts.length} تعارض` : ''})`);
      }

      res.json({
        uploaded,
        skippedDuplicates,
        conflictsDetected: newConflicts.length,
        newConflicts,
        errors,
        previousRevision: beforeRevision,
        syncedAt: new Date().toISOString(),
        state: store.getStateForUser(userId),
      });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  // Scheduled Reports Endpoints
  app.post('/api/reports/schedules', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const schedule = store.createScheduledReport(userId, req.body, deviceName);
      broadcastStateChange(userId, `جدولة تقرير تلقائي: ${schedule.title}`);
      res.status(201).json({ schedule, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.delete('/api/reports/schedules/:id', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const result = store.deleteScheduledReport(userId, String(req.params.id), deviceName);
      broadcastStateChange(userId, 'إزالة جدولة تقرير');
      res.json({ ...result, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/reports/schedules/:id/run', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const schedule = store.runScheduledReportNow(userId, String(req.params.id), deviceName);
      broadcastStateChange(userId, `تشغيل تقرير مجدول: ${schedule.title}`);
      res.json({ schedule, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  // ZATCA E-Invoicing & Tax Archive Endpoints
  app.post('/api/zatca/invoices', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const invoice = store.createZatcaInvoice(userId, req.body, deviceName);
      broadcastStateChange(userId, `إصدار فاتورة إلكترونية ZATCA (${invoice.invoiceNumber})`);
      res.status(201).json({ invoice, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  // Favorite Custom Reports & Shared Search Filters
  app.post('/api/reports/favorites', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const preset = store.saveFavoriteReport(userId, req.body, deviceName);
      broadcastStateChange(userId, `حفظ تقرير مفضل: ${preset.title}`);
      res.status(201).json({ preset, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.delete('/api/reports/favorites/:id', (req: Request, res: Response) => {
    try {
      const { userId } = getActor(req);
      const result = store.deleteFavoriteReport(userId, String(req.params.id));
      broadcastStateChange(userId, 'إزالة تقرير مفضل');
      res.json({ ...result, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/search/filters', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const filter = store.saveSharedSearchFilter(userId, req.body, deviceName);
      broadcastStateChange(userId, `حفظ فلتر بحث: ${filter.name}`);
      res.status(201).json({ filter, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.delete('/api/search/filters/:id', (req: Request, res: Response) => {
    try {
      const { userId } = getActor(req);
      const result = store.deleteSharedSearchFilter(userId, String(req.params.id));
      broadcastStateChange(userId, 'حذف فلتر بحث');
      res.json({ ...result, state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  // Custom Disk Storage Endpoints (Backups / Archive / Documents)
  app.get('/api/storage/status', (_req: Request, res: Response) => {
    try {
      res.json(store.getStorageStatus());
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });

  app.post('/api/storage/validate-path', (req: Request, res: Response) => {
    try {
      const result = store.validateStorageFolder(String(req.body?.path || ''));
      res.json(result);
    } catch (e: unknown) {
      res.status(400).json({ ok: false, error: (e as Error).message });
    }
  });

  app.post('/api/storage/sync-folders', (req: Request, res: Response) => {
    try {
      const { userId, deviceName } = getActor(req);
      const result = store.syncFoldersToDisk(userId, deviceName);
      broadcastStateChange(userId, 'مزامنة وتهيئة مجلدات التخزين المحلية على القرص');
      res.json({ ...result, status: store.getStorageStatus(), state: store.getStateForUser(userId) });
    } catch (e: unknown) {
      res.status(400).json({ error: (e as Error).message });
    }
  });
}

export async function startServer(customPort?: number) {
  const listenPort = customPort && Number.isFinite(customPort) ? customPort : PORT;
  const app = express();
  handleApi(app);

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('error', (err) => {
    console.error('WebSocketServer error:', err.message);
  });

  wss.on('connection', (ws, req) => {
    const fallbackSessionId = `ses-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const ipAddress = extractClientIp(req);
    const workspaceId = resolveRequestWorkspaceId(req);
    const wsStore = getExistingWorkspaceStore(workspaceId);
    const upgradeActor = wsStore ? resolveSessionActor(req) : null;

    activeSessions.set(ws, {
      ws,
      workspaceId,
      sessionId: upgradeActor?.sessionId || fallbackSessionId,
      userId: upgradeActor?.userId || '',
      authenticated: Boolean(upgradeActor),
      deviceName: upgradeActor?.deviceName || 'Web Browser',
      ipAddress,
      connectedAt: new Date().toISOString(),
    });

    if (upgradeActor && wsStore) {
      ws.send(
        JSON.stringify({
          type: 'state:init',
          state: wsStore.getStateForUser(upgradeActor.userId),
          presence: getPresenceList(workspaceId),
        })
      );
      broadcastPresence(workspaceId);
    }

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(String(raw));
        if (msg.type === 'session:identify') {
          const prev = activeSessions.get(ws);
          const msgWsId = prev?.workspaceId || workspaceId;
          const activeWsStore = getExistingWorkspaceStore(msgWsId);
          const verifiedActor = activeWsStore
            ? resolveSessionActor(req, typeof msg.token === 'string' ? msg.token : undefined)
            : null;
          if (!verifiedActor || !activeWsStore) {
            ws.send(JSON.stringify({ type: 'auth:required', error: 'جلسة WebSocket غير مصرح بها' }));
            return;
          }
          const nextDevice = String(msg.deviceName || verifiedActor.deviceName || 'Web Browser');
          activeSessions.set(ws, {
            ws,
            workspaceId: msgWsId,
            sessionId: verifiedActor.sessionId || prev?.sessionId || fallbackSessionId,
            userId: verifiedActor.userId,
            authenticated: true,
            deviceName: nextDevice,
            ipAddress,
            connectedAt: prev?.connectedAt || new Date().toISOString(),
          });
          ws.send(
            JSON.stringify({
              type: 'state:init',
              state: activeWsStore.getStateForUser(verifiedActor.userId),
              presence: getPresenceList(msgWsId),
            })
          );
          broadcastPresence(msgWsId);
        }
      } catch {
        // Ignore malformed WS payloads
      }
    });

    ws.on('close', () => {
      const closed = activeSessions.get(ws);
      activeSessions.delete(ws);
      broadcastPresence(closed?.workspaceId || workspaceId);
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = process.env.AQARPLUS_DIST_DIR
      ? path.resolve(process.env.AQARPLUS_DIST_DIR)
      : path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.on('error', (err) => {
    console.error('HTTP Server error:', err);
  });

  server.on('close', () => {
    for (const st of workspaceStores.values()) {
      st.getPersistence().close();
    }
    workspaceStores.clear();
  });

  await new Promise<void>((resolve) => {
    server.listen(listenPort, '0.0.0.0', () => {
      console.log(`AqarPlus centralized server running on http://0.0.0.0:${listenPort}`);
      resolve();
    });
  });

  return { server, port: listenPort };
}

if (process.env.AQARPLUS_NO_AUTO_START !== '1') {
  startServer();
}
