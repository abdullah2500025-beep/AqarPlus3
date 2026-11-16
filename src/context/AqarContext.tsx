import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AqarDatabaseState,
  CurrencyCode,
  LoginProfileSummary,
  OfflineQueuedAction,
  PermissionKey,
  StaffUser,
} from '../types/aqar';
import {
  convertCurrency,
  DEFAULT_CURRENCY_RATES_TO_SAR,
  DisplayFormatPrefs,
  formatCurrency,
  setDisplayFormatPrefs,
} from '../utils/formatters';
import {
  loadCachedStateIdb,
  loadMetaIdb,
  loadOfflineQueueIdb,
  migrateLegacyLocalStorageToIdb,
  replaceOfflineQueueIdb,
  saveCachedStateIdb,
  saveMetaIdb,
} from '../utils/indexedDbStorage';
import {
  applyOptimisticOfflineMutation,
  extractEntityTarget,
  generateOperationUuid,
} from '../utils/optimisticSync';
import { applyStaticModeMutation } from '../utils/staticModeFallback';
import { SyncBatchUploadResult, SyncEngine } from '../utils/syncEngine';

export interface ActiveSessionInfo {
  sessionId?: string;
  userId: string;
  nameAr: string;
  roleLabelAr: string;
  deviceName: string;
  ipAddress?: string;
  connectedAt: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info';
  text: string;
}

export interface CompanyBrandingSummary {
  nameAr: string;
  nameEn: string;
  logoDataUrl?: string;
}

export type PrimaryNavSection =
  | 'dashboard'
  | 'daily_hub'
  | 'properties'
  | 'leasing_finance'
  | 'tenants'
  | 'maintenance'
  | 'reports'
  | 'team'
  | 'documents'
  | 'archive'
  | 'templates'
  | 'settings'
  | 'about';

export type NavSection =
  | PrimaryNavSection
  | 'leasing'
  | 'finance'
  | 'accounting'
  | 'admin';

export type LeasingFinanceTab = 'leasing' | 'finance' | 'accounting';

interface AqarContextValue {
  state: AqarDatabaseState | null;
  loading: boolean;
  authChecking: boolean;
  isAuthenticated: boolean;
  authToken: string | null;
  workspaceId: string;
  setWorkspaceId: (nextWorkspaceId: string) => void;
  demoLoginEnabled: boolean;
  loginProfiles: LoginProfileSummary[];
  companyBranding: CompanyBrandingSummary | null;
  loginWithPassword: (identifier: string, password: string, workspaceOverride?: string) => Promise<{ ok: boolean; error?: string }>;
  loginWithPin: (userId: string, pin: string, workspaceOverride?: string) => Promise<{ ok: boolean; error?: string }>;
  provisionWorkspace: (params: {
    workspaceSlug: string;
    companyNameAr: string;
    companyNameEn?: string;
    adminNameAr: string;
    adminEmail: string;
    adminPhone?: string;
    password: string;
    pin?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  changeCredentials: (params: {
    targetUserId?: string;
    currentPassword?: string;
    newPassword?: string;
    newPin?: string;
  }) => Promise<{ ok: boolean; error?: string }>;
  apiFetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  currentUser: StaffUser | null;
  switchUser: (userId: string) => void;
  hasPermission: (perm: PermissionKey) => boolean;
  lang: 'ar' | 'en';
  setLang: (lang: 'ar' | 'en') => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  activeNav: PrimaryNavSection;
  setActiveNav: (nav: NavSection) => void;
  leasingFinanceTab: LeasingFinanceTab;
  setLeasingFinanceTab: (tab: LeasingFinanceTab) => void;
  leasingWizardUnitId: string | null;
  setLeasingWizardUnitId: (unitId: string | null) => void;
  startLeasingWizardForUnit: (unitId: string) => void;
  baseCurrency: CurrencyCode;
  setBaseCurrency: (currency: CurrencyCode) => void;
  currencyRates: Record<CurrencyCode, number>;
  displayPrefs: DisplayFormatPrefs;
  convertToBase: (amount: number, fromCurrency?: CurrencyCode) => number;
  formatInCurrency: (amount: number, currency?: CurrencyCode) => string;
  formatConvertedBase: (amount: number, fromCurrency?: CurrencyCode) => string;
  tenantsTabHint: 'tenants' | 'leads' | 'reports';
  setTenantsTabHint: (tab: 'tenants' | 'leads' | 'reports') => void;
  openLeadsHub: () => void;
  activeCompanyId: string;
  setActiveCompanyId: (companyId: string) => void;
  wsStatus: 'connected' | 'connecting' | 'offline';
  isBrowserOnline: boolean;
  isOfflineSimulated: boolean;
  toggleOfflineSimulation: () => void;
  offlineQueue: OfflineQueuedAction[];
  syncOfflineQueue: () => Promise<void>;
  runFullSync: () => Promise<SyncBatchUploadResult | null>;
  lastSyncAt: string | null;
  lastSyncResult: SyncBatchUploadResult | null;
  pendingMutationsCount: number;
  presence: ActiveSessionInfo[];
  toasts: ToastMessage[];
  pushToast: (type: ToastMessage['type'], text: string) => void;
  dismissToast: (id: string) => void;
  mutate: <T = unknown>(
    method: 'POST' | 'PATCH' | 'DELETE',
    endpoint: string,
    body?: unknown,
    opts?: { idempotencyKey?: string; offlineDescAr?: string; offlineDescEn?: string }
  ) => Promise<T | null>;
  refreshState: () => Promise<void>;
  onboardingConfig: {
    open: boolean;
    initialStage: 'splash' | 'company' | 'property' | 'units';
    isLockMode: boolean;
  };
  openOnboarding: (initialStage?: 'splash' | 'company' | 'property' | 'units', isLockMode?: boolean) => void;
  closeOnboarding: () => void;
}

const AqarContext = createContext<AqarContextValue | null>(null);

const USER_STORAGE_KEY = 'aqarplus_active_user_v1';
const AUTH_TOKEN_STORAGE_KEY = 'aqarplus_auth_token_v1';
const WORKSPACE_STORAGE_KEY = 'aqarplus_workspace_id_v1';
const DEVICE_ID_STORAGE_KEY = 'aqarplus_device_id_v1';
const THEME_STORAGE_KEY = 'aqarplus_theme_v1';
const LANG_STORAGE_KEY = 'aqarplus_lang_v1';
const BASE_CURRENCY_STORAGE_KEY = 'aqarplus_base_currency_v1';

function normalizeWorkspaceSlug(raw?: string | null): string {
  const clean = (raw || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return clean.length >= 3 && clean.length <= 40 ? clean : 'default';
}

function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return 'server-device';
  const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;
  const generated = `dev-${generateOperationUuid().slice(0, 12)}`;
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
  return generated;
}

export function AqarProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AqarDatabaseState | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(() =>
    typeof window !== 'undefined' ? window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) : null
  );
  const [workspaceId, setWorkspaceIdState] = useState<string>(() => {
    if (typeof window === 'undefined') return 'default';
    const urlWs = new URLSearchParams(window.location.search).get('workspace');
    if (urlWs) return normalizeWorkspaceSlug(urlWs);
    return normalizeWorkspaceSlug(window.localStorage.getItem(WORKSPACE_STORAGE_KEY));
  });
  const [demoLoginEnabled, setDemoLoginEnabled] = useState(false);
  const [loginProfiles, setLoginProfiles] = useState<LoginProfileSummary[]>([]);
  const [companyBranding, setCompanyBranding] = useState<CompanyBrandingSummary | null>(null);

  const [isBrowserOnline, setIsBrowserOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingMutationsCount, setPendingMutationsCount] = useState(0);
  const [activeUserId, setActiveUserId] = useState<string>(
    () => (typeof window !== 'undefined' ? window.localStorage.getItem(USER_STORAGE_KEY) : null) || 'usr-sys_owner'
  );
  const [lang, setLangState] = useState<'ar' | 'en'>(
    () => ((typeof window !== 'undefined' ? window.localStorage.getItem(LANG_STORAGE_KEY) : null) as 'ar' | 'en') || 'ar'
  );
  const [theme, setTheme] = useState<'dark' | 'light'>(
    () => ((typeof window !== 'undefined' ? window.localStorage.getItem(THEME_STORAGE_KEY) : null) as 'dark' | 'light') || 'dark'
  );
  const baseCurrency: CurrencyCode = 'SAR';
  const [activeCompanyId, setActiveCompanyId] = useState<string>('all');
  const [activeNav, setActiveNavState] = useState<PrimaryNavSection>('dashboard');
  const [tenantsTabHint, setTenantsTabHint] = useState<'tenants' | 'leads' | 'reports'>('tenants');
  const [leasingFinanceTab, setLeasingFinanceTab] = useState<LeasingFinanceTab>('leasing');
  const [leasingWizardUnitId, setLeasingWizardUnitId] = useState<string | null>(null);
  const [onboardingConfig, setOnboardingConfig] = useState<{
    open: boolean;
    initialStage: 'splash' | 'company' | 'property' | 'units';
    isLockMode: boolean;
  }>(() => ({
    open: typeof window !== 'undefined' ? window.localStorage.getItem('aqarplus_onboarding_v1') !== 'done' : false,
    initialStage: 'splash',
    isLockMode: false,
  }));

  const [wsStatus, setWsStatus] = useState<'connected' | 'connecting' | 'offline'>('offline');
  const [isStaticMode, setIsStaticMode] = useState(false);
  const [isOfflineSimulated, setIsOfflineSimulated] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SyncBatchUploadResult | null>(null);
  const [presence, setPresence] = useState<ActiveSessionInfo[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<OfflineQueuedAction[]>([]);
  const [idbReady, setIdbReady] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const activeUserIdRef = useRef(activeUserId);
  activeUserIdRef.current = activeUserId;
  const authTokenRef = useRef(authToken);
  authTokenRef.current = authToken;
  const workspaceIdRef = useRef(workspaceId);
  workspaceIdRef.current = workspaceId;
  const stateRef = useRef(state);
  stateRef.current = state;
  const inFlightKeysRef = useRef<Set<string>>(new Set());
  const deviceIdRef = useRef<string>(getOrCreateDeviceId());

  const openOnboarding = useCallback(
    (initialStage: 'splash' | 'company' | 'property' | 'units' = 'splash', isLockMode = false) => {
      setOnboardingConfig({ open: true, initialStage, isLockMode });
    },
    []
  );

  const closeOnboarding = useCallback(() => {
    setOnboardingConfig((prev) => ({ ...prev, open: false }));
  }, []);

  const setActiveNav = useCallback((nav: NavSection) => {
    if (nav === 'leasing' || nav === 'finance' || nav === 'accounting') {
      setLeasingFinanceTab(nav);
      setActiveNavState('leasing_finance');
      return;
    }
    if (nav === 'admin') {
      setActiveNavState('reports');
      return;
    }
    if (nav === 'settings' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('aqar:settings-hub'));
    }
    setActiveNavState(nav);
  }, []);

  const startLeasingWizardForUnit = useCallback((unitId: string) => {
    setLeasingWizardUnitId(unitId);
    setLeasingFinanceTab('leasing');
    setActiveNavState('leasing_finance');
  }, []);

  const openLeadsHub = useCallback(() => {
    setTenantsTabHint('leads');
    setActiveNavState('tenants');
  }, []);

  const setWorkspaceId = useCallback((nextWorkspaceId: string) => {
    const clean = normalizeWorkspaceSlug(nextWorkspaceId);
    workspaceIdRef.current = clean;
    setWorkspaceIdState(clean);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, clean);
    }
  }, []);

  const persistAuthToken = useCallback((token: string | null, userId?: string) => {
    setAuthToken(token);
    authTokenRef.current = token;
    if (typeof window !== 'undefined') {
      if (token) window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
      else window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      if (userId) window.localStorage.setItem(USER_STORAGE_KEY, userId);
    }
    if (userId) {
      setActiveUserId(userId);
      activeUserIdRef.current = userId;
    }
  }, []);

  const cacheStateSnapshot = useCallback((nextState: AqarDatabaseState) => {
    setState(nextState);
    stateRef.current = nextState;
    setCompanyBranding({
      nameAr: nextState.settings.nameAr,
      nameEn: nextState.settings.nameEn,
      logoDataUrl: nextState.settings.logoDataUrl,
    });
    void saveCachedStateIdb(nextState, workspaceIdRef.current);
  }, []);

  useEffect(() => {
    const onOnline = () => setIsBrowserOnline(true);
    const onOffline = () => setIsBrowserOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const pushToast = useCallback((type: ToastMessage['type'], text: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    html.lang = lang;
    html.dir = lang === 'ar' ? 'rtl' : 'ltr';
    window.localStorage.setItem(LANG_STORAGE_KEY, lang);
  }, [lang]);

  useEffect(() => {
    const html = document.documentElement;
    if (theme === 'dark') html.classList.add('dark');
    else html.classList.remove('dark');
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (!idbReady) return;
    void replaceOfflineQueueIdb(offlineQueue, workspaceIdRef.current);
  }, [offlineQueue, idbReady]);

  const setLang = useCallback((next: 'ar' | 'en') => {
    setLangState(next);
  }, []);

  const setBaseCurrency = useCallback((_next: CurrencyCode) => {
    window.localStorage.removeItem(BASE_CURRENCY_STORAGE_KEY);
  }, []);

  const currencyRates = useMemo<Record<CurrencyCode, number>>(
    () => ({
      ...DEFAULT_CURRENCY_RATES_TO_SAR,
      ...(state?.settings?.currencyRatesToSar || {}),
    }),
    [state?.settings?.currencyRatesToSar]
  );

  const displayPrefs = useMemo<DisplayFormatPrefs>(() => {
    const calCfg = state?.settings?.calendarConfig;
    const genCfg = state?.settings?.generalPrefs;
    const calType: DisplayFormatPrefs['calendarType'] =
      calCfg?.calendarType ||
      genCfg?.calendar ||
      (state?.settings?.dateCalendar === 'ميلادي فقط' ? 'gregorian' : 'both');
    const dateFmt: DisplayFormatPrefs['dateFormat'] =
      calCfg?.dateFormat || genCfg?.dateFormat || 'DD/MM/YYYY';
    const numerals: DisplayFormatPrefs['numerals'] =
      calCfg?.numerals || genCfg?.numeralFormat || 'en';
    return setDisplayFormatPrefs({
      calendarType: calType,
      dateFormat: dateFmt,
      numerals,
    });
  }, [
    state?.settings?.calendarConfig,
    state?.settings?.generalPrefs,
    state?.settings?.dateCalendar,
  ]);

  const convertToBase = useCallback(
    (amount: number, fromCurrency: CurrencyCode = 'SAR') => {
      return convertCurrency(amount, fromCurrency, baseCurrency, currencyRates);
    },
    [baseCurrency, currencyRates]
  );

  const formatInCurrency = useCallback(
    (amount: number, currency: CurrencyCode = 'SAR') => {
      return formatCurrency(amount, currency, lang);
    },
    [lang]
  );

  const formatConvertedBase = useCallback(
    (amount: number, fromCurrency: CurrencyCode = 'SAR') => {
      const converted = convertCurrency(amount, fromCurrency, baseCurrency, currencyRates);
      return formatCurrency(converted, baseCurrency, lang);
    },
    [baseCurrency, currencyRates, lang]
  );

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const currentUser = useMemo(() => {
    if (!state) return null;
    return state.users.find((u) => u.id === activeUserId) || state.users[0] || null;
  }, [state, activeUserId]);

  const apiFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const headers = new Headers(init?.headers || undefined);
      if (authTokenRef.current && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${authTokenRef.current}`);
      }
      if (!headers.has('x-workspace-id')) {
        headers.set('x-workspace-id', workspaceIdRef.current);
      }
      const res = await fetch(input, {
        ...init,
        credentials: 'include',
        headers,
      });
      if (res.status === 401) {
        const clone = res.clone();
        try {
          const body = await clone.json();
          if (body?.code === 'AUTH_REQUIRED') {
            persistAuthToken(null);
            setIsAuthenticated(false);
          }
        } catch {
          // ignore non-json 401
        }
      }
      return res;
    },
    [persistAuthToken]
  );

  const fetchState = useCallback(async () => {
    try {
      const res = await apiFetch('/api/state');
      const contentType = res.headers.get('content-type') || '';
      if (res.status === 401) {
        setIsAuthenticated(false);
        return;
      }
      if (!res.ok || !contentType.includes('application/json')) {
        throw new Error('Static host or backend unavailable');
      }
      const data = await res.json();
      setIsStaticMode(false);
      setIsAuthenticated(true);
      cacheStateSnapshot(data.state);
      if (data.presence) setPresence(data.presence);
    } catch {
      const cached = await loadCachedStateIdb(workspaceIdRef.current);
      if (cached && authTokenRef.current) {
        cacheStateSnapshot(cached);
        setWsStatus('offline');
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch, cacheStateSnapshot]);

  // Initial bootstrap: IndexedDB migration + Session check
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const activeWs = workspaceIdRef.current;
      try {
        const { migratedState, migratedQueue } = await migrateLegacyLocalStorageToIdb();
        const [idbState, idbQueue, savedLastSync] = await Promise.all([
          loadCachedStateIdb(activeWs),
          loadOfflineQueueIdb(activeWs),
          loadMetaIdb<string>(`lastSyncAt:${activeWs}`),
        ]);
        if (cancelled) return;
        const effectiveQueue = idbQueue.length > 0 ? idbQueue : activeWs === 'default' ? migratedQueue : [];
        setOfflineQueue(effectiveQueue);
        if (savedLastSync) setLastSyncAt(savedLastSync);
        const cached = idbState || (activeWs === 'default' ? migratedState : null);
        if (cached) {
          stateRef.current = cached;
        }
        setIdbReady(true);

        // Check live session against server/Worker
        const headers: Record<string, string> = {
          'x-workspace-id': activeWs,
        };
        if (authTokenRef.current) {
          headers['Authorization'] = `Bearer ${authTokenRef.current}`;
        }
        const sessionRes = await fetch('/api/auth/session', {
          credentials: 'include',
          headers,
        });
        const ct = sessionRes.headers.get('content-type') || '';
        if (sessionRes.status === 404 || !ct.includes('application/json')) {
          // Pure static hosting without backend API
          if (cancelled) return;
          setIsStaticMode(true);
          setIsAuthenticated(true);
          if (cached) {
            cacheStateSnapshot(cached);
          } else {
            const { createInitialSeed } = await import('../../server/seed');
            cacheStateSnapshot(createInitialSeed());
          }
          setWsStatus('offline');
          setLoading(false);
          return;
        }
        const sessionData = await sessionRes.json();
        if (cancelled) return;

        setDemoLoginEnabled(Boolean(sessionData.demoLoginEnabled));
        setLoginProfiles(Array.isArray(sessionData.loginProfiles) ? sessionData.loginProfiles : []);
        if (sessionData.companyBranding) {
          setCompanyBranding(sessionData.companyBranding);
        }

        if (sessionData.authenticated && sessionData.user) {
          persistAuthToken(sessionData.token || authTokenRef.current, sessionData.user.id);
          setIsAuthenticated(true);
          setIsStaticMode(false);
          await fetchState();
        } else {
          persistAuthToken(null);
          setIsAuthenticated(false);
          setLoading(false);
        }
      } catch {
        // Offline startup with prior authenticated device session stored in IndexedDB
        if (cancelled) return;
        const cached = await loadCachedStateIdb(activeWs);
        if (cached && authTokenRef.current) {
          cacheStateSnapshot(cached);
          setIsAuthenticated(true);
          setWsStatus('offline');
          setLoading(false);
        } else {
          setIsAuthenticated(false);
          setWsStatus('offline');
          setLoading(false);
        }
      } finally {
        if (!cancelled) {
          setAuthChecking(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cacheStateSnapshot, fetchState, persistAuthToken]);

  const refreshState = useCallback(async () => {
    await fetchState();
  }, [fetchState]);

  const loginWithPassword = useCallback(
    async (
      identifier: string,
      password: string,
      workspaceOverride?: string
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        const wsTarget = workspaceOverride ? normalizeWorkspaceSlug(workspaceOverride) : workspaceIdRef.current;
        if (workspaceOverride) setWorkspaceId(wsTarget);
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-workspace-id': wsTarget,
          },
          body: JSON.stringify({
            identifier,
            password,
            deviceName: typeof navigator !== 'undefined' ? navigator.platform || 'Web Terminal' : 'Web Terminal',
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { ok: false, error: data?.error || 'تعذر تسجيل الدخول' };
        }
        persistAuthToken(data.token || null, data.user?.id);
        setIsAuthenticated(true);
        setIsStaticMode(false);
        if (data.state) {
          cacheStateSnapshot(data.state);
        } else {
          await fetchState();
        }
        setLoading(false);
        return { ok: true };
      } catch {
        return { ok: false, error: 'تعذر الوصول إلى الخادم لتسجيل الدخول' };
      }
    },
    [cacheStateSnapshot, fetchState, persistAuthToken, setWorkspaceId]
  );

  const loginWithPin = useCallback(
    async (
      userId: string,
      pin: string,
      workspaceOverride?: string
    ): Promise<{ ok: boolean; error?: string }> => {
      try {
        const wsTarget = workspaceOverride ? normalizeWorkspaceSlug(workspaceOverride) : workspaceIdRef.current;
        if (workspaceOverride) setWorkspaceId(wsTarget);
        const res = await fetch('/api/auth/login-pin', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-workspace-id': wsTarget,
          },
          body: JSON.stringify({
            userId,
            identifier: userId,
            pin,
            deviceName: typeof navigator !== 'undefined' ? navigator.platform || 'Web Terminal' : 'Web Terminal',
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { ok: false, error: data?.error || 'رمز PIN غير صحيح' };
        }
        persistAuthToken(data.token || null, data.user?.id);
        setIsAuthenticated(true);
        setIsStaticMode(false);
        if (data.state) {
          cacheStateSnapshot(data.state);
        } else {
          await fetchState();
        }
        setLoading(false);
        return { ok: true };
      } catch {
        return { ok: false, error: 'تعذر الوصول إلى الخادم للتحقق من الرمز' };
      }
    },
    [cacheStateSnapshot, fetchState, persistAuthToken, setWorkspaceId]
  );

  const provisionWorkspace = useCallback(
    async (params: {
      workspaceSlug: string;
      companyNameAr: string;
      companyNameEn?: string;
      adminNameAr: string;
      adminEmail: string;
      adminPhone?: string;
      password: string;
      pin?: string;
    }): Promise<{ ok: boolean; error?: string }> => {
      try {
        const cleanSlug = normalizeWorkspaceSlug(params.workspaceSlug);
        if (cleanSlug === 'default') {
          return { ok: false, error: 'اختر معرّف شركة مخصصاً (3 أحرف إنجليزية وأرقام على الأقل)' };
        }
        const res = await fetch('/api/workspaces/provision', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-workspace-id': cleanSlug,
          },
          body: JSON.stringify({
            ...params,
            deviceName: typeof navigator !== 'undefined' ? navigator.platform || 'Web Terminal' : 'Web Terminal',
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { ok: false, error: data?.error || 'تعذر تأسيس مساحة عمل الشركة' };
        }
        setWorkspaceId(cleanSlug);
        persistAuthToken(data.token || null, data.user?.id);
        setIsAuthenticated(true);
        setIsStaticMode(false);
        if (data.state) cacheStateSnapshot(data.state);
        setLoading(false);
        return { ok: true };
      } catch {
        return { ok: false, error: 'تعذر الاتصال بالخادم السحابي لتأسيس مساحة العمل' };
      }
    },
    [cacheStateSnapshot, persistAuthToken, setWorkspaceId]
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore offline logout request failure
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    persistAuthToken(null);
    setIsAuthenticated(false);
    setState(null);
    stateRef.current = null;
    setPresence([]);
    setWsStatus('offline');
  }, [apiFetch, persistAuthToken]);

  const changeCredentials = useCallback(
    async (params: {
      targetUserId?: string;
      currentPassword?: string;
      newPassword?: string;
      newPin?: string;
    }): Promise<{ ok: boolean; error?: string }> => {
      try {
        const res = await apiFetch('/api/auth/credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        });
        const data = await res.json();
        if (!res.ok) {
          return { ok: false, error: data?.error || 'تعذر تحديث بيانات الاعتماد' };
        }
        if (data.state) cacheStateSnapshot(data.state);
        return { ok: true };
      } catch {
        return { ok: false, error: 'تعذر الاتصال بالخادم لتحديث بيانات الدخول' };
      }
    },
    [apiFetch, cacheStateSnapshot]
  );

  // WebSocket live connection (authenticated only)
  useEffect(() => {
    if (!isAuthenticated || isOfflineSimulated || isStaticMode) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setWsStatus('offline');
      return;
    }

    let closedByUser = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closedByUser) return;
      setWsStatus('connecting');
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${proto}//${window.location.host}/ws?workspace=${encodeURIComponent(workspaceIdRef.current)}`);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsStatus('connected');
        const userObj = stateRef.current?.users.find((u) => u.id === activeUserIdRef.current);
        ws.send(
          JSON.stringify({
            type: 'session:identify',
            token: authTokenRef.current,
            deviceName: userObj?.deviceName || 'Web Terminal',
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'auth:required') {
            setWsStatus('offline');
            return;
          }
          if (msg.type === 'state:init' || msg.type === 'state:updated') {
            if (msg.state) cacheStateSnapshot(msg.state);
            if (msg.presence) setPresence(msg.presence);
            if (msg.type === 'state:updated' && msg.actorUserId !== activeUserIdRef.current && msg.summary) {
              pushToast('info', `تحديث مباشر: ${msg.summary}`);
            }
          } else if (msg.type === 'presence:update') {
            setPresence(msg.sessions || []);
          } else if (msg.type === 'session:terminated') {
            if (!msg.userId || msg.userId === activeUserIdRef.current) {
              pushToast('error', `تم إنهاء جلستك عن بُعد بواسطة ${msg.terminatedBy || 'الإدارة'}: ${msg.reason || ''}`);
              void logout();
            }
          }
        } catch {
          // ignore malformed ws message
        }
      };

      ws.onclose = () => {
        if (!closedByUser) {
          setWsStatus('offline');
          reconnectTimer = setTimeout(connect, 2500);
        }
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    return () => {
      closedByUser = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [isAuthenticated, isOfflineSimulated, isStaticMode, pushToast, cacheStateSnapshot, logout]);

  // Identify updated token on WS when switching users
  useEffect(() => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN && authToken) {
      const userObj = state?.users.find((u) => u.id === activeUserId);
      ws.send(
        JSON.stringify({
          type: 'session:identify',
          token: authToken,
          deviceName: userObj?.deviceName || 'Web Terminal',
        })
      );
    }
  }, [activeUserId, authToken, state?.users]);

  const switchUser = useCallback(
    (userId: string) => {
      if (isStaticMode) {
        setActiveUserId(userId);
        window.localStorage.setItem(USER_STORAGE_KEY, userId);
        setActiveNav('dashboard');
        return;
      }
      if (demoLoginEnabled) {
        void (async () => {
          const pinRes = await loginWithPin(userId, '1234');
          if (!pinRes.ok) {
            const target = stateRef.current?.users.find((u) => u.id === userId);
            if (target?.email) {
              const pwRes = await loginWithPassword(target.email, 'Aqar@2026');
              if (!pwRes.ok) {
                pushToast(
                  'error',
                  lang === 'ar'
                    ? 'تم تعديل كلمة مرور هذا الحساب — سجّل الخروج وأدخل بيانات الدخول الجديدة'
                    : 'Custom credentials set for this user — sign in with updated credentials'
                );
                return;
              }
            } else {
              pushToast('error', pinRes.error || 'تعذر تبديل الحساب');
              return;
            }
          }
          setActiveNav('dashboard');
          pushToast('success', lang === 'ar' ? 'تم تبديل الجلسة الموثقة بنجاح' : 'Authenticated session switched');
        })();
      } else {
        void logout();
      }
    },
    [demoLoginEnabled, isStaticMode, lang, loginWithPassword, loginWithPin, logout, pushToast, setActiveNav]
  );

  const hasPermission = useCallback(
    (perm: PermissionKey) => {
      if (!state || !currentUser) return false;
      const perms = state.rolePermissions[currentUser.role] || [];
      return perms.includes(perm);
    },
    [state, currentUser]
  );

  const syncOfflineQueue = useCallback(async () => {
    if (!isAuthenticated || offlineQueue.length === 0 || isOfflineSimulated) return;
    try {
      const result = await SyncEngine.uploadPendingOperations(
        offlineQueue,
        stateRef.current?.lastUpdatedAt,
        authTokenRef.current,
        workspaceIdRef.current
      );
      setLastSyncAt(result.syncedAt);
      void saveMetaIdb(`lastSyncAt:${workspaceIdRef.current}`, result.syncedAt);
      setLastSyncResult(result);
      if (result.state) cacheStateSnapshot(result.state);
      if (result.errors.length === 0) {
        setOfflineQueue([]);
      } else {
        pushToast('error', result.errors[0]);
      }
      if (result.uploaded > 0) {
        pushToast(
          'success',
          lang === 'ar'
            ? `تمت مزامنة ${result.uploaded} عملية عبر Sync Engine${result.conflictsDetected > 0 ? ` (${result.conflictsDetected} تعارض)` : ''}`
            : `Synced ${result.uploaded} offline operations`
        );
      } else if (result.skippedDuplicates > 0 && result.errors.length === 0) {
        setOfflineQueue([]);
      }
      await fetchState();
    } catch {
      // keep queued items for retry
    }
  }, [isAuthenticated, offlineQueue, isOfflineSimulated, lang, pushToast, fetchState, cacheStateSnapshot]);

  const runFullSync = useCallback(async (): Promise<SyncBatchUploadResult | null> => {
    if (isOfflineSimulated) {
      pushToast('error', lang === 'ar' ? 'لا يمكن المزامنة أثناء وضع عدم الاتصال المحاكى' : 'Disable offline mode first');
      return null;
    }
    try {
      const uploadResult = await SyncEngine.uploadPendingOperations(
        offlineQueue,
        stateRef.current?.lastUpdatedAt,
        authTokenRef.current,
        workspaceIdRef.current
      );
      if (uploadResult.errors.length === 0 && offlineQueue.length > 0) {
        setOfflineQueue([]);
      }
      const delta = await SyncEngine.fetchDelta(
        lastSyncAt || undefined,
        authTokenRef.current,
        workspaceIdRef.current
      );
      if (delta.state) {
        cacheStateSnapshot(delta.state);
      } else if (uploadResult.state) {
        cacheStateSnapshot(uploadResult.state);
      }
      setLastSyncAt(uploadResult.syncedAt);
      void saveMetaIdb(`lastSyncAt:${workspaceIdRef.current}`, uploadResult.syncedAt);
      setLastSyncResult(uploadResult);
      pushToast(
        'success',
        lang === 'ar'
          ? `اكتملت المزامنة (الإصدار #${delta.serverRevision} · مرفوع: ${uploadResult.uploaded} · تعارضات معلقة: ${delta.pendingConflictsCount})`
          : `Sync completed (rev #${delta.serverRevision})`
      );
      return uploadResult;
    } catch (err) {
      pushToast('error', (err as Error).message);
      return null;
    }
  }, [isOfflineSimulated, offlineQueue, lastSyncAt, lang, pushToast, cacheStateSnapshot]);

  const toggleOfflineSimulation = useCallback(() => {
    setIsOfflineSimulated((prev) => {
      const next = !prev;
      if (next) {
        pushToast(
          'info',
          lang === 'ar'
            ? 'تم تفعيل وضع العمل دون إنترنت — تحفظ العمليات محلياً وتُزامن عند عودة الاتصال'
            : 'Offline mode enabled — mutations queue locally for sync'
        );
      }
      return next;
    });
  }, [lang, pushToast]);

  // Auto-sync when returning online respecting syncCenter behavior settings
  useEffect(() => {
    if (!isAuthenticated || isOfflineSimulated || !isBrowserOnline || wsStatus !== 'connected' || offlineQueue.length === 0) {
      return;
    }
    const behavior = state?.settings?.syncCenter?.behavior || 'auto';
    if (behavior === 'manual') return;
    if (behavior === 'wifi_only') {
      const navConn = (navigator as unknown as { connection?: { type?: string } }).connection;
      if (navConn?.type === 'cellular') return;
    }
    void syncOfflineQueue();
  }, [isAuthenticated, isOfflineSimulated, isBrowserOnline, wsStatus, offlineQueue.length, state?.settings?.syncCenter?.behavior, syncOfflineQueue]);

  const mutate = useCallback(
    async <T = unknown>(
      method: 'POST' | 'PATCH' | 'DELETE',
      endpoint: string,
      body?: unknown,
      opts?: { idempotencyKey?: string; offlineDescAr?: string; offlineDescEn?: string }
    ): Promise<T | null> => {
      const operationId = opts?.idempotencyKey || generateOperationUuid();

      if (inFlightKeysRef.current.has(operationId)) {
        return null;
      }

      const actorObj = stateRef.current?.users.find((u) => u.id === activeUserIdRef.current) || stateRef.current?.users[0];
      const deviceName = actorObj?.deviceName || 'Web Terminal';

      if (isStaticMode && stateRef.current) {
        try {
          const localResult = applyStaticModeMutation(
            stateRef.current,
            activeUserIdRef.current,
            method,
            endpoint,
            body
          );
          cacheStateSnapshot(localResult.state);
          return localResult as T;
        } catch (err) {
          pushToast('error', (err as Error).message || 'تعذر تنفيذ العملية');
          return null;
        }
      }

      if (isOfflineSimulated || !navigator.onLine) {
        const target = extractEntityTarget(endpoint, body);
        const revKey = target.entityType && target.entityId ? `${target.entityType}:${target.entityId}` : undefined;
        const baseRevision = revKey ? stateRef.current?.entityRevisions?.[revKey] : undefined;

        const queued: OfflineQueuedAction = {
          id: `off-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          operationId,
          idempotencyKey: operationId,
          method,
          endpoint,
          body,
          entityType: target.entityType,
          entityId: target.entityId,
          baseRevision,
          deviceId: deviceIdRef.current,
          descriptionAr: opts?.offlineDescAr || 'عملية محلية',
          descriptionEn: opts?.offlineDescEn || 'Queued operation',
          queuedAt: new Date().toISOString(),
          userId: activeUserIdRef.current,
          deviceName,
        };
        setOfflineQueue((prev) => [...prev, queued]);

        if (stateRef.current && actorObj) {
          const optimisticState = applyOptimisticOfflineMutation(
            stateRef.current,
            method,
            endpoint,
            body,
            actorObj,
            operationId
          );
          cacheStateSnapshot(optimisticState);
        }

        pushToast(
          'info',
          lang === 'ar'
            ? `تم الحفظ محلياً في IndexedDB (${queued.descriptionAr}) وستتم مزامنته عند عودة الاتصال`
            : `Saved locally to IndexedDB (${queued.descriptionEn}) for sync`
        );
        return null;
      }

      inFlightKeysRef.current.add(operationId);
      setPendingMutationsCount((c) => c + 1);
      try {
        const res = await apiFetch(endpoint, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'x-device-name': encodeURIComponent(deviceName),
            'x-idempotency-key': operationId,
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json') && stateRef.current) {
          setIsStaticMode(true);
          const localResult = applyStaticModeMutation(
            stateRef.current,
            activeUserIdRef.current,
            method,
            endpoint,
            body
          );
          cacheStateSnapshot(localResult.state);
          return localResult as T;
        }
        const data = await res.json();
        if (!res.ok) {
          pushToast('error', data.error || 'تعذر تنفيذ العملية');
          return null;
        }
        if (data.state) cacheStateSnapshot(data.state);
        return data as T;
      } catch {
        const target = extractEntityTarget(endpoint, body);
        const revKey = target.entityType && target.entityId ? `${target.entityType}:${target.entityId}` : undefined;
        const baseRevision = revKey ? stateRef.current?.entityRevisions?.[revKey] : undefined;
        const queued: OfflineQueuedAction = {
          id: `off-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          operationId,
          idempotencyKey: operationId,
          method,
          endpoint,
          body,
          entityType: target.entityType,
          entityId: target.entityId,
          baseRevision,
          deviceId: deviceIdRef.current,
          descriptionAr: opts?.offlineDescAr || 'عملية معلقة عند انقطاع الخادم',
          descriptionEn: opts?.offlineDescEn || 'Queued offline mutation',
          queuedAt: new Date().toISOString(),
          userId: activeUserIdRef.current,
          deviceName,
        };
        setOfflineQueue((prev) => [...prev, queued]);
        if (stateRef.current && actorObj) {
          const optimisticState = applyOptimisticOfflineMutation(
            stateRef.current,
            method,
            endpoint,
            body,
            actorObj,
            operationId
          );
          cacheStateSnapshot(optimisticState);
        }
        pushToast(
          'info',
          lang === 'ar'
            ? 'انقطع الاتصال بالخادم — تم حفظ العملية في IndexedDB للمزامنة التلقائية'
            : 'Network unavailable — operation saved to IndexedDB for auto-sync'
        );
        return null;
      } finally {
        inFlightKeysRef.current.delete(operationId);
        setPendingMutationsCount((c) => Math.max(0, c - 1));
      }
    },
    [apiFetch, isOfflineSimulated, isStaticMode, lang, pushToast, cacheStateSnapshot]
  );

  const value = useMemo<AqarContextValue>(
    () => ({
      state,
      loading,
      authChecking,
      isAuthenticated,
      authToken,
      workspaceId,
      setWorkspaceId,
      demoLoginEnabled,
      loginProfiles,
      companyBranding,
      loginWithPassword,
      loginWithPin,
      provisionWorkspace,
      logout,
      changeCredentials,
      apiFetch,
      currentUser,
      switchUser,
      hasPermission,
      lang,
      setLang,
      theme,
      toggleTheme,
      activeNav,
      setActiveNav,
      leasingFinanceTab,
      setLeasingFinanceTab,
      leasingWizardUnitId,
      setLeasingWizardUnitId,
      startLeasingWizardForUnit,
      baseCurrency,
      setBaseCurrency,
      currencyRates,
      displayPrefs,
      convertToBase,
      formatInCurrency,
      formatConvertedBase,
      tenantsTabHint,
      setTenantsTabHint,
      openLeadsHub,
      activeCompanyId,
      setActiveCompanyId,
      wsStatus,
      isBrowserOnline,
      isOfflineSimulated,
      toggleOfflineSimulation,
      offlineQueue,
      syncOfflineQueue,
      runFullSync,
      lastSyncAt,
      lastSyncResult,
      pendingMutationsCount,
      presence,
      toasts,
      pushToast,
      dismissToast,
      mutate,
      refreshState,
      onboardingConfig,
      openOnboarding,
      closeOnboarding,
    }),
    [
      state,
      loading,
      authChecking,
      isAuthenticated,
      authToken,
      workspaceId,
      setWorkspaceId,
      demoLoginEnabled,
      loginProfiles,
      companyBranding,
      loginWithPassword,
      loginWithPin,
      provisionWorkspace,
      logout,
      changeCredentials,
      apiFetch,
      currentUser,
      switchUser,
      hasPermission,
      lang,
      setLang,
      theme,
      toggleTheme,
      activeNav,
      setActiveNav,
      leasingFinanceTab,
      leasingWizardUnitId,
      startLeasingWizardForUnit,
      baseCurrency,
      setBaseCurrency,
      currencyRates,
      displayPrefs,
      convertToBase,
      formatInCurrency,
      formatConvertedBase,
      tenantsTabHint,
      setTenantsTabHint,
      openLeadsHub,
      activeCompanyId,
      wsStatus,
      isBrowserOnline,
      isOfflineSimulated,
      toggleOfflineSimulation,
      offlineQueue,
      syncOfflineQueue,
      runFullSync,
      lastSyncAt,
      lastSyncResult,
      pendingMutationsCount,
      presence,
      toasts,
      pushToast,
      dismissToast,
      mutate,
      refreshState,
      onboardingConfig,
      openOnboarding,
      closeOnboarding,
    ]
  );

  return <AqarContext.Provider value={value}>{children}</AqarContext.Provider>;
}

export function useAqar() {
  const ctx = useContext(AqarContext);
  if (!ctx) throw new Error('useAqar must be used within AqarProvider');
  return ctx;
}
