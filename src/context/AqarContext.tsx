import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AqarDatabaseState,
  CurrencyCode,
  LoginProfileSummary,
  OfflineQueuedAction,
  PermissionKey,
  PermissionLevel,
  PermissionModuleKey,
  StaffUser,
} from '../types/aqar';
import {
  getRecommendedLandingNav,
  userCanAccessNav,
  userHasLegacyPermission,
  userHasModuleAction,
} from '../utils/rbac';
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

export interface CompanyDiscoveryOption {
  workspaceId: string;
  companyNameAr: string;
  companyNameEn: string;
  logoDataUrl?: string;
  userNameAr?: string;
  roleLabelAr: string;
  roleLabelEn?: string;
}

export interface MfaChallengeDetails {
  challengeToken: string;
  reason: string;
  workspaceId: string;
  companyBranding?: CompanyBrandingSummary;
  maskedEmail: string;
  expiresAt: string;
  deliveryNotice: string;
  localSimulationCode?: string;
}

export interface LoginActionResult {
  ok: boolean;
  error?: string;
  retryAfterSec?: number;
  requiresCompanySelection?: boolean;
  selectionToken?: string;
  companies?: CompanyDiscoveryOption[];
  requiresMfa?: boolean;
  mfaChallenge?: MfaChallengeDetails;
}

export interface LastCompanyMeta {
  workspaceId: string;
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
  | 'profile'
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
  lastCompanyMeta: LastCompanyMeta | null;
  rememberedIdentifier: string;
  saveRememberedIdentifier: (identifier: string | null) => void;
  sessionExpiredReason: string | null;
  clearSessionExpiredReason: () => void;
  appType: 'web' | 'desktop';
  deviceId: string;
  desktopProtectedStorage: boolean;
  loginWithPassword: (
    identifier: string,
    password: string,
    workspaceOverride?: string,
    rememberMe?: boolean,
    opts?: { autoDiscover?: boolean; selectedWorkspaceId?: string }
  ) => Promise<LoginActionResult>;
  loginWithPin: (
    userIdOrIdentifier: string,
    pin: string,
    workspaceOverride?: string,
    rememberMe?: boolean,
    opts?: { autoDiscover?: boolean; selectedWorkspaceId?: string }
  ) => Promise<LoginActionResult>;
  selectCompanyForLogin: (
    selectionToken: string,
    selectedWorkspaceId: string,
    rememberMe?: boolean
  ) => Promise<LoginActionResult>;
  verifyMfaForLogin: (
    challengeToken: string,
    code: string,
    trustDevice?: boolean
  ) => Promise<LoginActionResult>;
  resendMfaCode: (challengeToken: string) => Promise<{
    ok: boolean;
    error?: string;
    deliveryNotice?: string;
    localSimulationCode?: string;
    expiresAt?: string;
  }>;
  refreshSession: () => Promise<boolean>;
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
  logoutAllDevices: () => Promise<void>;
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
  hasModulePermission: (module: PermissionModuleKey, action?: PermissionLevel) => boolean;
  canAccessNav: (nav: NavSection) => boolean;
  lang: 'ar' | 'en';
  setLang: (lang: 'ar' | 'en') => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;
  activeNav: PrimaryNavSection;
  setActiveNav: (nav: NavSection) => void;
  canGoBackNav: boolean;
  goBackNav: () => void;
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
const REFRESH_TOKEN_STORAGE_KEY = 'aqarplus_refresh_token_v1';
const DESKTOP_ENCRYPTED_REFRESH_KEY = 'aqarplus_desktop_refresh_cipher_v1';
const TRUSTED_OFFLINE_META_KEY = 'aqarplus_trusted_offline_meta_v1';
const REMEMBERED_IDENTIFIER_KEY = 'aqarplus_remembered_identifier_v1';
const LAST_COMPANY_META_KEY = 'aqarplus_last_company_meta_v1';
const WORKSPACE_STORAGE_KEY = 'aqarplus_workspace_id_v1';
const DEVICE_ID_STORAGE_KEY = 'aqarplus_device_id_v1';
const THEME_STORAGE_KEY = 'aqarplus_theme_v1';
const LANG_STORAGE_KEY = 'aqarplus_lang_v1';
const BASE_CURRENCY_STORAGE_KEY = 'aqarplus_base_currency_v1';

const SERVER_ONLY_OFFLINE_BLOCKED_PREFIXES = [
  '/api/profile/',
  '/api/team/',
  '/api/roles',
  '/api/workspaces/',
  '/api/auth/',
  '/api/backups/',
];

interface TrustedOfflineMeta {
  workspaceId: string;
  userId: string;
  expiresAt: string;
  rememberMe: boolean;
}

function safeParseJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function getClientAppType(): 'web' | 'desktop' {
  if (typeof window !== 'undefined' && window.aqarDesktop?.isElectron) {
    return 'desktop';
  }
  return 'web';
}

function getReadableDeviceName(appType: 'web' | 'desktop'): string {
  if (typeof navigator === 'undefined') return appType === 'desktop' ? 'AqarPlus Desktop' : 'Web Terminal';
  const plat = navigator.platform || '';
  if (appType === 'desktop') {
    return plat ? `AqarPlus Desktop (${plat})` : 'AqarPlus Desktop';
  }
  return plat ? `Web (${plat})` : 'Web Terminal';
}

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
    typeof window !== 'undefined'
      ? window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) || window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
      : null
  );
  const [workspaceId, setWorkspaceIdState] = useState<string>(() => {
    if (typeof window === 'undefined') return 'default';
    const urlWs = new URLSearchParams(window.location.search).get('workspace');
    if (urlWs) return normalizeWorkspaceSlug(urlWs);
    return normalizeWorkspaceSlug(window.localStorage.getItem(WORKSPACE_STORAGE_KEY));
  });
  const [demoLoginEnabled, setDemoLoginEnabled] = useState(false);
  const [loginProfiles, setLoginProfiles] = useState<LoginProfileSummary[]>([]);
  const [lastCompanyMeta, setLastCompanyMeta] = useState<LastCompanyMeta | null>(() =>
    typeof window !== 'undefined' ? safeParseJson<LastCompanyMeta>(window.localStorage.getItem(LAST_COMPANY_META_KEY)) : null
  );
  const [companyBranding, setCompanyBranding] = useState<CompanyBrandingSummary | null>(() => {
    if (typeof window === 'undefined') return null;
    const saved = safeParseJson<LastCompanyMeta>(window.localStorage.getItem(LAST_COMPANY_META_KEY));
    return saved ? { nameAr: saved.nameAr, nameEn: saved.nameEn, logoDataUrl: saved.logoDataUrl } : null;
  });
  const [rememberedIdentifier, setRememberedIdentifier] = useState<string>(() =>
    typeof window !== 'undefined' ? window.localStorage.getItem(REMEMBERED_IDENTIFIER_KEY) || '' : ''
  );
  const [sessionExpiredReason, setSessionExpiredReason] = useState<string | null>(null);
  const [desktopProtectedStorage, setDesktopProtectedStorage] = useState(false);

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
  const refreshTokenRef = useRef<string | null>(
    typeof window !== 'undefined' ? window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY) : null
  );
  const singleFlightRefreshRef = useRef<Promise<boolean> | null>(null);
  const workspaceIdRef = useRef(workspaceId);
  workspaceIdRef.current = workspaceId;
  const stateRef = useRef(state);
  stateRef.current = state;
  const inFlightKeysRef = useRef<Set<string>>(new Set());
  const deviceIdRef = useRef<string>(getOrCreateDeviceId());
  const appTypeRef = useRef<'web' | 'desktop'>(getClientAppType());

  const openOnboarding = useCallback(
    (initialStage: 'splash' | 'company' | 'property' | 'units' = 'splash', isLockMode = false) => {
      setOnboardingConfig({ open: true, initialStage, isLockMode });
    },
    []
  );

  const closeOnboarding = useCallback(() => {
    setOnboardingConfig((prev) => ({ ...prev, open: false }));
  }, []);

  const [navHistory, setNavHistory] = useState<PrimaryNavSection[]>([]);
  const activeNavRef = useRef<PrimaryNavSection>(activeNav);
  activeNavRef.current = activeNav;

  const setActiveNav = useCallback((nav: NavSection) => {
    let resolved: PrimaryNavSection;
    if (nav === 'leasing' || nav === 'finance' || nav === 'accounting') {
      setLeasingFinanceTab(nav);
      resolved = 'leasing_finance';
    } else if (nav === 'admin') {
      resolved = 'reports';
    } else {
      if (nav === 'settings' && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('aqar:settings-hub'));
      }
      resolved = nav;
    }
    const prev = activeNavRef.current;
    if (prev !== resolved) {
      setNavHistory((hist) => [...hist.slice(-14), prev]);
    }
    setActiveNavState(resolved);
  }, []);

  const goBackNav = useCallback(() => {
    setNavHistory((hist) => {
      if (hist.length > 0) {
        const prev = hist[hist.length - 1];
        setActiveNavState(prev);
        return hist.slice(0, -1);
      }
      setActiveNavState('dashboard');
      return hist;
    });
  }, []);

  const canGoBackNav = activeNav !== 'dashboard' || navHistory.length > 0;

  const startLeasingWizardForUnit = useCallback((unitId: string) => {
    setLeasingWizardUnitId(unitId);
    setLeasingFinanceTab('leasing');
    setActiveNav('leasing_finance');
  }, [setActiveNav]);

  const openLeadsHub = useCallback(() => {
    setTenantsTabHint('leads');
    setActiveNav('tenants');
  }, [setActiveNav]);

  const setWorkspaceId = useCallback((nextWorkspaceId: string) => {
    const clean = normalizeWorkspaceSlug(nextWorkspaceId);
    workspaceIdRef.current = clean;
    setWorkspaceIdState(clean);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, clean);
    }
  }, []);

  const saveRememberedIdentifier = useCallback((identifier: string | null) => {
    const clean = (identifier || '').trim();
    setRememberedIdentifier(clean);
    if (typeof window !== 'undefined') {
      if (clean) window.localStorage.setItem(REMEMBERED_IDENTIFIER_KEY, clean);
      else window.localStorage.removeItem(REMEMBERED_IDENTIFIER_KEY);
    }
  }, []);

  const clearSessionExpiredReason = useCallback(() => {
    setSessionExpiredReason(null);
  }, []);

  const persistAuthToken = useCallback(
    (
      token: string | null,
      userId?: string,
      rememberMe?: boolean,
      sessionExtras?: {
        refreshToken?: string | null;
        expiresAt?: string;
        refreshExpiresAt?: string;
        workspaceId?: string;
      }
    ) => {
      setAuthToken(token);
      authTokenRef.current = token;
      if (typeof window !== 'undefined') {
        if (token) {
          const useLocal =
            rememberMe !== undefined
              ? rememberMe
              : Boolean(window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)) ||
                Boolean(window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY)) ||
                Boolean(window.localStorage.getItem(DESKTOP_ENCRYPTED_REFRESH_KEY)) ||
                !window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
          if (useLocal) {
            window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
            window.sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
            const offlineExpiry =
              sessionExtras?.refreshExpiresAt ||
              sessionExtras?.expiresAt ||
              new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString();
            const targetWs = sessionExtras?.workspaceId || workspaceIdRef.current;
            const targetUid = userId || activeUserIdRef.current;
            window.localStorage.setItem(
              TRUSTED_OFFLINE_META_KEY,
              JSON.stringify({
                workspaceId: targetWs,
                userId: targetUid,
                expiresAt: offlineExpiry,
                rememberMe: true,
              } satisfies TrustedOfflineMeta)
            );
            if (sessionExtras?.refreshToken) {
              const rToken = sessionExtras.refreshToken;
              refreshTokenRef.current = rToken;
              if (window.aqarDesktop?.protectSecret) {
                void window.aqarDesktop.protectSecret(rToken).then((res) => {
                  if (res?.protected && res.cipher) {
                    window.localStorage.setItem(DESKTOP_ENCRYPTED_REFRESH_KEY, res.cipher);
                    window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
                    setDesktopProtectedStorage(true);
                  } else {
                    window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, rToken);
                    window.localStorage.removeItem(DESKTOP_ENCRYPTED_REFRESH_KEY);
                    setDesktopProtectedStorage(false);
                  }
                });
              } else {
                window.localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, rToken);
              }
            }
          } else {
            window.sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
            window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
            window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
            window.localStorage.removeItem(DESKTOP_ENCRYPTED_REFRESH_KEY);
            window.localStorage.removeItem(TRUSTED_OFFLINE_META_KEY);
            refreshTokenRef.current = null;
          }
        } else {
          window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
          window.sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
          window.localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
          window.localStorage.removeItem(DESKTOP_ENCRYPTED_REFRESH_KEY);
          window.localStorage.removeItem(TRUSTED_OFFLINE_META_KEY);
          refreshTokenRef.current = null;
        }
        if (userId) window.localStorage.setItem(USER_STORAGE_KEY, userId);
      }
      if (userId) {
        setActiveUserId(userId);
        activeUserIdRef.current = userId;
      }
    },
    []
  );

  const cacheStateSnapshot = useCallback((nextState: AqarDatabaseState) => {
    setState(nextState);
    stateRef.current = nextState;
    const branding: CompanyBrandingSummary = {
      nameAr: nextState.settings.nameAr,
      nameEn: nextState.settings.nameEn,
      logoDataUrl: nextState.settings.logoDataUrl,
    };
    setCompanyBranding(branding);
    const meta: LastCompanyMeta = {
      workspaceId: workspaceIdRef.current,
      nameAr: nextState.settings.nameAr,
      nameEn: nextState.settings.nameEn,
      logoDataUrl: nextState.settings.logoDataUrl,
    };
    setLastCompanyMeta(meta);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(LAST_COMPANY_META_KEY, JSON.stringify(meta));
      } catch {
        // ignore storage quota errors on large logos
      }
    }
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

  const applyLandingRoute = useCallback(
    (
      nextState: AqarDatabaseState | null | undefined,
      user: StaffUser | null | undefined,
      explicitLanding?: { nav: string; leasingFinanceTab?: 'leasing' | 'finance' | 'accounting' },
      forceApply = true
    ) => {
      if (!nextState || !user) return;
      if (!forceApply && activeNavRef.current !== 'dashboard') return;
      const target = explicitLanding || getRecommendedLandingNav(nextState, user);
      const navName = (target?.nav || 'dashboard') as PrimaryNavSection;
      if (target?.leasingFinanceTab) {
        setLeasingFinanceTab(target.leasingFinanceTab);
      }
      if (navName === 'leasing_finance' || userCanAccessNav(nextState, user, navName)) {
        setNavHistory([]);
        setActiveNavState(navName);
      } else {
        setNavHistory([]);
        setActiveNavState('dashboard');
      }
    },
    []
  );

  const loadStoredRefreshToken = useCallback(async (): Promise<string | null> => {
    if (refreshTokenRef.current) return refreshTokenRef.current;
    if (typeof window === 'undefined') return null;
    const plain = window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
    if (plain) {
      refreshTokenRef.current = plain;
      return plain;
    }
    const cipher = window.localStorage.getItem(DESKTOP_ENCRYPTED_REFRESH_KEY);
    if (cipher && window.aqarDesktop?.unprotectSecret) {
      const decrypted = await window.aqarDesktop.unprotectSecret(cipher);
      if (decrypted) {
        refreshTokenRef.current = decrypted;
        setDesktopProtectedStorage(true);
        return decrypted;
      }
    }
    return null;
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    if (singleFlightRefreshRef.current) {
      return singleFlightRefreshRef.current;
    }
    const runner = (async () => {
      try {
        const storedRefresh = await loadStoredRefreshToken();
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-workspace-id': workspaceIdRef.current,
          },
          body: JSON.stringify(storedRefresh ? { refreshToken: storedRefresh } : {}),
        });
        if (!res.ok) {
          return false;
        }
        const data = await res.json();
        if (!data?.authenticated || !data?.token || !data?.user) {
          return false;
        }
        persistAuthToken(data.token, data.user.id, data.rememberMe !== false, {
          refreshToken: data.refreshToken,
          expiresAt: data.expiresAt,
          refreshExpiresAt: data.refreshExpiresAt,
          workspaceId: data.workspaceId || workspaceIdRef.current,
        });
        setSessionExpiredReason(null);
        setIsAuthenticated(true);
        setIsStaticMode(false);
        if (data.state) {
          cacheStateSnapshot(data.state);
          applyLandingRoute(data.state, data.user, data.landingNav, false);
        }
        return true;
      } catch {
        return false;
      } finally {
        singleFlightRefreshRef.current = null;
      }
    })();
    singleFlightRefreshRef.current = runner;
    return runner;
  }, [applyLandingRoute, cacheStateSnapshot, loadStoredRefreshToken, persistAuthToken]);

  const apiFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const doFetch = () => {
        const headers = new Headers(init?.headers || undefined);
        if (authTokenRef.current && !headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${authTokenRef.current}`);
        }
        if (!headers.has('x-workspace-id')) {
          headers.set('x-workspace-id', workspaceIdRef.current);
        }
        if (!headers.has('x-device-id')) {
          headers.set('x-device-id', deviceIdRef.current);
        }
        return fetch(input, {
          ...init,
          credentials: 'include',
          headers,
        });
      };

      let res = await doFetch();
      const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.toString() : '';
      if (res.status === 401 && !urlStr.includes('/api/auth/refresh') && !urlStr.includes('/api/auth/login')) {
        const refreshed = await refreshSession();
        if (refreshed) {
          res = await doFetch();
        }
      }

      if (res.status === 401) {
        const clone = res.clone();
        try {
          const body = await clone.json();
          if (body?.code === 'AUTH_REQUIRED') {
            persistAuthToken(null);
            setIsAuthenticated(false);
            setSessionExpiredReason(
              body?.error || 'انتهت صلاحية الجلسة أو تم إنهاؤها — يرجى تسجيل الدخول للمتابعة'
            );
          }
        } catch {
          // ignore non-json 401
        }
      }
      return res;
    },
    [persistAuthToken, refreshSession]
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
      const trustedMeta =
        typeof window !== 'undefined'
          ? safeParseJson<TrustedOfflineMeta>(window.localStorage.getItem(TRUSTED_OFFLINE_META_KEY))
          : null;
      const validOfflineTrust =
        Boolean(cached) &&
        Boolean(trustedMeta?.rememberMe) &&
        trustedMeta?.workspaceId === workspaceIdRef.current &&
        (!trustedMeta?.expiresAt || Date.parse(trustedMeta.expiresAt) > Date.now());
      if (cached && validOfflineTrust) {
        cacheStateSnapshot(cached);
        setWsStatus('offline');
      }
    } finally {
      setLoading(false);
    }
  }, [apiFetch, cacheStateSnapshot]);

  // Initial bootstrap: IndexedDB migration + Session check (with Refresh + Strict Offline Policy)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const activeWs = workspaceIdRef.current;
      const hadPriorSessionHint =
        typeof window !== 'undefined' &&
        Boolean(
          authTokenRef.current ||
            window.localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY) ||
            window.localStorage.getItem(DESKTOP_ENCRYPTED_REFRESH_KEY) ||
            window.localStorage.getItem(TRUSTED_OFFLINE_META_KEY)
        );
      try {
        const { migratedState, migratedQueue } = await migrateLegacyLocalStorageToIdb();
        const [idbState, idbQueue, savedLastSync, storedRefresh] = await Promise.all([
          loadCachedStateIdb(activeWs),
          loadOfflineQueueIdb(activeWs),
          loadMetaIdb<string>(`lastSyncAt:${activeWs}`),
          loadStoredRefreshToken(),
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
          'x-device-id': deviceIdRef.current,
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
          persistAuthToken(sessionData.token || authTokenRef.current, sessionData.user.id, undefined, {
            workspaceId: activeWs,
          });
          setIsAuthenticated(true);
          setIsStaticMode(false);
          setSessionExpiredReason(null);
          await fetchState();
          if (stateRef.current && sessionData.user) {
            applyLandingRoute(stateRef.current, sessionData.user, sessionData.landingNav, false);
          }
        } else if (storedRefresh || hadPriorSessionHint) {
          const refreshed = await refreshSession();
          if (cancelled) return;
          if (refreshed) {
            setIsAuthenticated(true);
            setIsStaticMode(false);
            if (!stateRef.current) await fetchState();
            setLoading(false);
          } else {
            persistAuthToken(null);
            setIsAuthenticated(false);
            setSessionExpiredReason('انتهت صلاحية الجلسة السابقة أو تم إنهاؤها — يرجى تسجيل الدخول');
            setLoading(false);
          }
        } else {
          persistAuthToken(null);
          setIsAuthenticated(false);
          setLoading(false);
        }
      } catch {
        // Strict Offline Startup: cached snapshot alone NEVER grants login without an unexpired trusted session
        if (cancelled) return;
        const cached = await loadCachedStateIdb(activeWs);
        const trustedMeta =
          typeof window !== 'undefined'
            ? safeParseJson<TrustedOfflineMeta>(window.localStorage.getItem(TRUSTED_OFFLINE_META_KEY))
            : null;
        const hasUnexpiredTrust =
          Boolean(cached) &&
          Boolean(trustedMeta?.rememberMe) &&
          trustedMeta?.workspaceId === activeWs &&
          (!trustedMeta?.expiresAt || Date.parse(trustedMeta.expiresAt) > Date.now()) &&
          Boolean(authTokenRef.current || refreshTokenRef.current);

        if (cached && hasUnexpiredTrust) {
          cacheStateSnapshot(cached);
          setIsAuthenticated(true);
          setWsStatus('offline');
          setLoading(false);
        } else {
          setIsAuthenticated(false);
          if (hadPriorSessionHint) {
            setSessionExpiredReason('الجلسة غير موثقة للعمل دون اتصال — اتصل بالإنترنت لتجديد تسجيل الدخول');
          }
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
  }, [applyLandingRoute, cacheStateSnapshot, fetchState, loadStoredRefreshToken, persistAuthToken, refreshSession]);

  const refreshState = useCallback(async () => {
    await fetchState();
  }, [fetchState]);

  const consumeAuthPayload = useCallback(
    async (
      data: Record<string, unknown>,
      rememberMeFlag: boolean,
      fallbackWorkspaceId: string
    ): Promise<LoginActionResult> => {
      if (data.requiresCompanySelection) {
        return {
          ok: false,
          requiresCompanySelection: true,
          selectionToken: String(data.selectionToken || ''),
          companies: Array.isArray(data.companies) ? (data.companies as CompanyDiscoveryOption[]) : [],
        };
      }
      if (data.requiresMfa) {
        return {
          ok: false,
          requiresMfa: true,
          mfaChallenge: {
            challengeToken: String(data.challengeToken || ''),
            reason: String(data.reason || 'new_device'),
            workspaceId: String(data.workspaceId || fallbackWorkspaceId),
            companyBranding: data.companyBranding as CompanyBrandingSummary | undefined,
            maskedEmail: String(data.maskedEmail || '***'),
            expiresAt: String(data.expiresAt || ''),
            deliveryNotice: String(data.deliveryNotice || ''),
            localSimulationCode: data.localSimulationCode ? String(data.localSimulationCode) : undefined,
          },
        };
      }

      const targetWs = normalizeWorkspaceSlug(String(data.workspaceId || fallbackWorkspaceId));
      setWorkspaceId(targetWs);
      const userObj = data.user as StaffUser | undefined;
      const effectiveRemember =
        typeof data.rememberMe === 'boolean' ? data.rememberMe : rememberMeFlag;
      persistAuthToken((data.token as string) || null, userObj?.id, effectiveRemember, {
        refreshToken: (data.refreshToken as string) || null,
        expiresAt: data.expiresAt as string | undefined,
        refreshExpiresAt: data.refreshExpiresAt as string | undefined,
        workspaceId: targetWs,
      });
      setSessionExpiredReason(null);
      setIsAuthenticated(true);
      setIsStaticMode(false);
      if (data.state) {
        cacheStateSnapshot(data.state as AqarDatabaseState);
        applyLandingRoute(
          data.state as AqarDatabaseState,
          userObj,
          data.landingNav as { nav: string; leasingFinanceTab?: 'leasing' | 'finance' | 'accounting' } | undefined,
          true
        );
      } else {
        await fetchState();
        if (stateRef.current && userObj) {
          applyLandingRoute(
            stateRef.current,
            userObj,
            data.landingNav as { nav: string; leasingFinanceTab?: 'leasing' | 'finance' | 'accounting' } | undefined,
            true
          );
        }
      }
      setLoading(false);
      return { ok: true };
    },
    [applyLandingRoute, cacheStateSnapshot, fetchState, persistAuthToken, setWorkspaceId]
  );

  const loginWithPassword = useCallback(
    async (
      identifier: string,
      password: string,
      workspaceOverride?: string,
      rememberMe = true,
      opts?: { autoDiscover?: boolean; selectedWorkspaceId?: string }
    ): Promise<LoginActionResult> => {
      try {
        const wsTarget = workspaceOverride ? normalizeWorkspaceSlug(workspaceOverride) : workspaceIdRef.current;
        if (workspaceOverride) setWorkspaceId(wsTarget);
        const appType = appTypeRef.current;
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-workspace-id': opts?.selectedWorkspaceId ? normalizeWorkspaceSlug(opts.selectedWorkspaceId) : wsTarget,
            'x-device-id': deviceIdRef.current,
          },
          body: JSON.stringify({
            identifier,
            password,
            rememberMe,
            autoDiscover: opts?.autoDiscover,
            selectedWorkspaceId: opts?.selectedWorkspaceId,
            appType,
            deviceId: deviceIdRef.current,
            deviceName: getReadableDeviceName(appType),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          return {
            ok: false,
            error: data?.error || 'بيانات الدخول غير صحيحة',
            retryAfterSec: data?.retryAfterSec,
          };
        }
        return await consumeAuthPayload(data, rememberMe, wsTarget);
      } catch {
        return { ok: false, error: 'تعذر الوصول إلى الخادم لتسجيل الدخول' };
      }
    },
    [consumeAuthPayload, setWorkspaceId]
  );

  const loginWithPin = useCallback(
    async (
      userIdOrIdentifier: string,
      pin: string,
      workspaceOverride?: string,
      rememberMe = true,
      opts?: { autoDiscover?: boolean; selectedWorkspaceId?: string }
    ): Promise<LoginActionResult> => {
      try {
        const wsTarget = workspaceOverride ? normalizeWorkspaceSlug(workspaceOverride) : workspaceIdRef.current;
        if (workspaceOverride) setWorkspaceId(wsTarget);
        const appType = appTypeRef.current;
        const res = await fetch('/api/auth/login-pin', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-workspace-id': opts?.selectedWorkspaceId ? normalizeWorkspaceSlug(opts.selectedWorkspaceId) : wsTarget,
            'x-device-id': deviceIdRef.current,
          },
          body: JSON.stringify({
            userId: userIdOrIdentifier,
            identifier: userIdOrIdentifier,
            pin,
            rememberMe,
            autoDiscover: opts?.autoDiscover,
            selectedWorkspaceId: opts?.selectedWorkspaceId,
            appType,
            deviceId: deviceIdRef.current,
            deviceName: getReadableDeviceName(appType),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          return {
            ok: false,
            error: data?.error || 'رمز PIN غير صحيح',
            retryAfterSec: data?.retryAfterSec,
          };
        }
        return await consumeAuthPayload(data, rememberMe, wsTarget);
      } catch {
        return { ok: false, error: 'تعذر الوصول إلى الخادم للتحقق من الرمز' };
      }
    },
    [consumeAuthPayload, setWorkspaceId]
  );

  const selectCompanyForLogin = useCallback(
    async (selectionToken: string, selectedWorkspaceId: string, rememberMe = true): Promise<LoginActionResult> => {
      try {
        const appType = appTypeRef.current;
        const res = await fetch('/api/auth/select-company', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-device-id': deviceIdRef.current,
          },
          body: JSON.stringify({
            selectionToken,
            workspaceId: selectedWorkspaceId,
            rememberMe,
            appType,
            deviceId: deviceIdRef.current,
            deviceName: getReadableDeviceName(appType),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { ok: false, error: data?.error || 'تعذر فتح مساحة عمل الشركة المحددة' };
        }
        return await consumeAuthPayload(data, rememberMe, selectedWorkspaceId);
      } catch {
        return { ok: false, error: 'تعذر الاتصال بالخادم لاختيار الشركة' };
      }
    },
    [consumeAuthPayload]
  );

  const verifyMfaForLogin = useCallback(
    async (challengeToken: string, code: string, trustDevice = true): Promise<LoginActionResult> => {
      try {
        const appType = appTypeRef.current;
        const res = await fetch('/api/auth/mfa/verify', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-device-id': deviceIdRef.current,
          },
          body: JSON.stringify({
            challengeToken,
            code,
            trustDevice,
            deviceId: deviceIdRef.current,
            deviceName: getReadableDeviceName(appType),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          return {
            ok: false,
            error: data?.error || 'رمز التحقق الإضافي غير صحيح',
            retryAfterSec: data?.retryAfterSec,
          };
        }
        return await consumeAuthPayload(data, data.rememberMe !== false, String(data.workspaceId || workspaceIdRef.current));
      } catch {
        return { ok: false, error: 'تعذر الاتصال بالخادم لإتمام التحقق الإضافي' };
      }
    },
    [consumeAuthPayload]
  );

  const resendMfaCode = useCallback(async (challengeToken: string) => {
    try {
      const res = await fetch('/api/auth/mfa/resend', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeToken }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data?.error || 'تعذر إعادة إرسال رمز التحقق' };
      }
      return {
        ok: true,
        deliveryNotice: data.deliveryNotice as string | undefined,
        localSimulationCode: data.localSimulationCode ? String(data.localSimulationCode) : undefined,
        expiresAt: data.expiresAt as string | undefined,
      };
    } catch {
      return { ok: false, error: 'تعذر الاتصال بالخادم' };
    }
  }, []);

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
        const appType = appTypeRef.current;
        const res = await fetch('/api/workspaces/provision', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-workspace-id': cleanSlug,
            'x-device-id': deviceIdRef.current,
          },
          body: JSON.stringify({
            ...params,
            appType,
            deviceId: deviceIdRef.current,
            deviceName: getReadableDeviceName(appType),
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          return { ok: false, error: data?.error || 'تعذر تأسيس مساحة عمل الشركة' };
        }
        setWorkspaceId(cleanSlug);
        persistAuthToken(data.token || null, data.user?.id, true, {
          refreshToken: data.refreshToken || null,
          expiresAt: data.expiresAt,
          refreshExpiresAt: data.refreshExpiresAt,
          workspaceId: cleanSlug,
        });
        setSessionExpiredReason(null);
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
    setNavHistory([]);
    setActiveNavState('dashboard');
  }, [apiFetch, persistAuthToken]);

  const logoutAllDevices = useCallback(async () => {
    try {
      await apiFetch('/api/auth/logout-all', { method: 'POST' });
    } catch {
      // ignore offline logout-all failure
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
    setNavHistory([]);
    setActiveNavState('dashboard');
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
            if (msg.state) {
              cacheStateSnapshot(msg.state);
              const nextState = msg.state as AqarDatabaseState;
              const updatedMe = nextState.users.find((u) => u.id === activeUserIdRef.current);
              if (updatedMe && (!updatedMe.active || (updatedMe.accountStatus && updatedMe.accountStatus !== 'نشط'))) {
                setSessionExpiredReason('تم إيقاف الحساب أو سحب العضوية — تم إغلاق الجلسة');
                void logout();
                return;
              }
              if (
                msg.type === 'state:updated' &&
                updatedMe &&
                activeNavRef.current !== 'dashboard' &&
                activeNavRef.current !== 'profile' &&
                !userCanAccessNav(nextState, updatedMe, activeNavRef.current)
              ) {
                pushToast(
                  'info',
                  lang === 'ar' ? 'تم تحديث صلاحياتك — تم تحويلك للقسم المتاح' : 'Your permissions were updated'
                );
                applyLandingRoute(nextState, updatedMe, undefined, true);
              }
            }
            if (msg.presence) setPresence(msg.presence);
            if (msg.type === 'state:updated' && msg.actorUserId !== activeUserIdRef.current && msg.summary) {
              pushToast('info', `تحديث مباشر: ${msg.summary}`);
            }
          } else if (msg.type === 'presence:update') {
            setPresence(msg.sessions || []);
          } else if (msg.type === 'session:terminated') {
            if (!msg.userId || msg.userId === activeUserIdRef.current) {
              const reasonText = String(msg.reason || 'تم إنهاء جلستك عن بُعد');
              setSessionExpiredReason(reasonText);
              pushToast('error', reasonText);
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
  }, [isAuthenticated, isOfflineSimulated, isStaticMode, lang, pushToast, cacheStateSnapshot, applyLandingRoute, logout]);

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
      return userHasLegacyPermission(state, currentUser, perm);
    },
    [state, currentUser]
  );

  const hasModulePermission = useCallback(
    (module: PermissionModuleKey, action: PermissionLevel = 'view') => {
      if (!state || !currentUser) return false;
      return userHasModuleAction(state, currentUser, module, action);
    },
    [state, currentUser]
  );

  const canAccessNav = useCallback(
    (nav: NavSection) => {
      if (!state || !currentUser) return false;
      return userCanAccessNav(state, currentUser, nav);
    },
    [state, currentUser]
  );

  const verifySessionBeforeSync = useCallback(async (): Promise<boolean> => {
    try {
      const meRes = await apiFetch('/api/auth/me');
      if (!meRes.ok) {
        if (meRes.status === 401 || meRes.status === 403) {
          pushToast(
            'error',
            lang === 'ar'
              ? 'تم رفض مزامنة العمليات المحلية لأن الحساب موقوف أو انتهت صلاحية الجلسة'
              : 'Sync blocked: account suspended or session expired'
          );
          if (meRes.status === 401) {
            setSessionExpiredReason('انتهت صلاحية الجلسة — سجّل الدخول مجدداً قبل مزامنة العمليات المحلية');
            setIsAuthenticated(false);
          }
        }
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }, [apiFetch, lang, pushToast]);

  const syncOfflineQueue = useCallback(async () => {
    if (!isAuthenticated || offlineQueue.length === 0 || isOfflineSimulated) return;
    try {
      const sessionValid = await verifySessionBeforeSync();
      if (!sessionValid) return;

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
  }, [isAuthenticated, offlineQueue, isOfflineSimulated, lang, pushToast, fetchState, cacheStateSnapshot, verifySessionBeforeSync]);

  const runFullSync = useCallback(async (): Promise<SyncBatchUploadResult | null> => {
    if (isOfflineSimulated) {
      pushToast('error', lang === 'ar' ? 'لا يمكن المزامنة أثناء وضع عدم الاتصال المحاكى' : 'Disable offline mode first');
      return null;
    }
    try {
      const sessionValid = await verifySessionBeforeSync();
      if (!sessionValid) return null;

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
  }, [isOfflineSimulated, offlineQueue, lastSyncAt, lang, pushToast, cacheStateSnapshot, verifySessionBeforeSync]);

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
        if (SERVER_ONLY_OFFLINE_BLOCKED_PREFIXES.some((prefix) => endpoint.startsWith(prefix))) {
          pushToast(
            'error',
            lang === 'ar'
              ? 'هذا الإجراء الأمني أو الإداري يتطلب اتصالاً مباشراً بالخادم ولا يمكن تنفيذه دون إنترنت'
              : 'This security or admin action requires an active server connection'
          );
          return null;
        }
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
        if (SERVER_ONLY_OFFLINE_BLOCKED_PREFIXES.some((prefix) => endpoint.startsWith(prefix))) {
          pushToast(
            'error',
            lang === 'ar'
              ? 'تعذر الوصول للخادم — لا يمكن حفظ التغييرات الأمنية أو الإدارية محلياً'
              : 'Server unreachable — security/admin actions cannot be queued offline'
          );
          return null;
        }
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
      lastCompanyMeta,
      rememberedIdentifier,
      saveRememberedIdentifier,
      sessionExpiredReason,
      clearSessionExpiredReason,
      appType: appTypeRef.current,
      deviceId: deviceIdRef.current,
      desktopProtectedStorage,
      loginWithPassword,
      loginWithPin,
      selectCompanyForLogin,
      verifyMfaForLogin,
      resendMfaCode,
      refreshSession,
      provisionWorkspace,
      logout,
      logoutAllDevices,
      changeCredentials,
      apiFetch,
      currentUser,
      switchUser,
      hasPermission,
      hasModulePermission,
      canAccessNav,
      lang,
      setLang,
      theme,
      toggleTheme,
      activeNav,
      setActiveNav,
      canGoBackNav,
      goBackNav,
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
      lastCompanyMeta,
      rememberedIdentifier,
      saveRememberedIdentifier,
      sessionExpiredReason,
      clearSessionExpiredReason,
      desktopProtectedStorage,
      loginWithPassword,
      loginWithPin,
      selectCompanyForLogin,
      verifyMfaForLogin,
      resendMfaCode,
      refreshSession,
      provisionWorkspace,
      logout,
      logoutAllDevices,
      changeCredentials,
      apiFetch,
      currentUser,
      switchUser,
      hasPermission,
      hasModulePermission,
      canAccessNav,
      lang,
      setLang,
      theme,
      toggleTheme,
      activeNav,
      setActiveNav,
      canGoBackNav,
      goBackNav,
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
