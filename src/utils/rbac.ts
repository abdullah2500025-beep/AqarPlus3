import {
  AqarDatabaseState,
  CustomRoleDefinition,
  PermissionKey,
  PermissionLevel,
  PermissionModuleKey,
  RoleKey,
  StaffUser,
} from '../types/aqar';

export interface RbacModuleMeta {
  key: PermissionModuleKey;
  labelAr: string;
  labelEn: string;
  groupAr: string;
}

export interface RbacActionMeta {
  key: PermissionLevel;
  labelAr: string;
  labelEn: string;
}

export interface RoleTemplateMeta {
  key: RoleKey;
  labelAr: string;
  labelEn: string;
  tierAr: string;
  descAr: string;
  defaultLimitSar: number;
}

export const RBAC_MODULES: RbacModuleMeta[] = [
  { key: 'dashboard', labelAr: 'لوحة التحكم', labelEn: 'Dashboard', groupAr: 'العمليات' },
  { key: 'properties', labelAr: 'العقارات', labelEn: 'Properties', groupAr: 'المحفظة' },
  { key: 'units', labelAr: 'الوحدات', labelEn: 'Units', groupAr: 'المحفظة' },
  { key: 'tenants', labelAr: 'المستأجرون والمهتمون', labelEn: 'Tenants & Leads', groupAr: 'التأجير' },
  { key: 'contracts', labelAr: 'العقود وإيجار', labelEn: 'Contracts', groupAr: 'التأجير' },
  { key: 'payments', labelAr: 'الدفعات والتحصيل', labelEn: 'Payments', groupAr: 'المالية' },
  { key: 'finance', labelAr: 'المالية والمحاسبة', labelEn: 'Finance & Ledger', groupAr: 'المالية' },
  { key: 'receipts', labelAr: 'الإيصالات والسندات', labelEn: 'Receipts', groupAr: 'المالية' },
  { key: 'expenses', labelAr: 'المصروفات والموافقات', labelEn: 'Expenses', groupAr: 'المالية' },
  { key: 'maintenance', labelAr: 'الصيانة والبلاغات', labelEn: 'Maintenance', groupAr: 'التشغيل' },
  { key: 'tasks', labelAr: 'المهام اليومية', labelEn: 'Tasks', groupAr: 'التشغيل' },
  { key: 'reports', labelAr: 'التقارير والتحليلات', labelEn: 'Reports', groupAr: 'التقارير' },
  { key: 'documents', labelAr: 'خزنة المستندات', labelEn: 'Documents', groupAr: 'الأرشفة' },
  { key: 'archive', labelAr: 'الأرشيف الذكي', labelEn: 'Smart Archive', groupAr: 'الأرشفة' },
  { key: 'team', labelAr: 'المستخدمون وفريق العمل', labelEn: 'Team & Workforce', groupAr: 'الإدارة' },
  { key: 'audit', labelAr: 'سجل التدقيق', labelEn: 'Audit Logs', groupAr: 'الإدارة' },
  { key: 'settings', labelAr: 'الإعدادات', labelEn: 'Settings', groupAr: 'الإدارة' },
  { key: 'backups', labelAr: 'النسخ الاحتياطي', labelEn: 'Backups', groupAr: 'الإدارة' },
];

export const RBAC_ACTIONS: RbacActionMeta[] = [
  { key: 'view', labelAr: 'عرض', labelEn: 'View' },
  { key: 'create', labelAr: 'إنشاء', labelEn: 'Create' },
  { key: 'edit', labelAr: 'تعديل', labelEn: 'Edit' },
  { key: 'delete_void', labelAr: 'حذف / إلغاء', labelEn: 'Delete' },
  { key: 'approve', labelAr: 'اعتماد', labelEn: 'Approve' },
  { key: 'export', labelAr: 'تصدير / طباعة', labelEn: 'Export' },
  { key: 'manage', labelAr: 'إدارة كاملة', labelEn: 'Manage' },
];

export const ROLE_TEMPLATES: RoleTemplateMeta[] = [
  {
    key: 'sys_owner',
    labelAr: 'مالك النظام',
    labelEn: 'System Owner',
    tierAr: 'تحكم كامل',
    descAr: 'التحكم الكامل بالمنشأة، إدارة الحسابات والأدوار، الأمان، والنسخ الاحتياطي',
    defaultLimitSar: 9999999,
  },
  {
    key: 'gm',
    labelAr: 'مدير الشركة',
    labelEn: 'Company Manager',
    tierAr: 'مرتفع',
    descAr: 'الإشراف العام، التقارير المالية، واعتماد المصروفات الكبرى والقرارات',
    defaultLimitSar: 500000,
  },
  {
    key: 'supervisor',
    labelAr: 'المشرف العقاري',
    labelEn: 'Property Supervisor',
    tierAr: 'متوسط-مرتفع',
    descAr: 'إدارة العقارات والوحدات، متابعة الإشغال ومحاضر الاستلام والإخلاء',
    defaultLimitSar: 25000,
  },
  {
    key: 'accountant',
    labelAr: 'المحاسب',
    labelEn: 'Accountant',
    tierAr: 'مالي فقط',
    descAr: 'التحصيل، سندات القبض، المصروفات، القيود المحاسبية وتقارير الملاك',
    defaultLimitSar: 50000,
  },
  {
    key: 'leasing',
    labelAr: 'موظف التأجير',
    labelEn: 'Leasing Agent',
    tierAr: 'متوسط',
    descAr: 'تسجيل المستأجرين، إبرام العقود، التوثيق في إيجار ومتابعة المتأخرات',
    defaultLimitSar: 0,
  },
  {
    key: 'maint_manager',
    labelAr: 'مسؤول الصيانة',
    labelEn: 'Maintenance Manager',
    tierAr: 'تشغيلي',
    descAr: 'استقبال بلاغات الصيانة، إسناد المهام للفنيين، وإدارة الموردين',
    defaultLimitSar: 15000,
  },
  {
    key: 'technician',
    labelAr: 'فني الصيانة',
    labelEn: 'Technician',
    tierAr: 'محدود',
    descAr: 'تنفيذ المهام الميدانية المسندة ورفع التقارير والتشخيص والصور',
    defaultLimitSar: 0,
  },
  {
    key: 'receptionist',
    labelAr: 'موظف الاستقبال',
    labelEn: 'Receptionist',
    tierAr: 'أساسي',
    descAr: 'تسجيل البيانات الأولية للعملاء، رفع المستندات، وتوجيه البلاغات',
    defaultLimitSar: 0,
  },
  {
    key: 'auditor',
    labelAr: 'المراجع',
    labelEn: 'Auditor',
    tierAr: 'للقراءة فقط',
    descAr: 'الاطلاع الكامل على السجلات المالية والتشغيلية وسجل التدقيق دون تعديل',
    defaultLimitSar: 0,
  },
  {
    key: 'owner',
    labelAr: 'بوابة المالك',
    labelEn: 'Owner Portal',
    tierAr: 'محفظة المالك',
    descAr: 'متابعة عوائد وإشغال العقارات المملوكة ومستندات التسوية فقط',
    defaultLimitSar: 0,
  },
];

const ALL_ACTIONS: PermissionLevel[] = ['view', 'create', 'edit', 'delete_void', 'approve', 'export', 'manage'];

export function getDefaultModulePermissionsForRole(
  role: RoleKey
): Partial<Record<PermissionModuleKey, PermissionLevel[]>> {
  if (role === 'sys_owner' || role === 'gm') {
    return Object.fromEntries(RBAC_MODULES.map((m) => [m.key, [...ALL_ACTIONS]]));
  }
  if (role === 'auditor') {
    return Object.fromEntries(
      RBAC_MODULES.filter((m) => m.key !== 'settings' && m.key !== 'backups').map((m) => [
        m.key,
        ['view', 'export'] as PermissionLevel[],
      ])
    );
  }
  if (role === 'accountant') {
    return {
      dashboard: ['view'],
      properties: ['view'],
      units: ['view'],
      tenants: ['view'],
      contracts: ['view'],
      payments: ['view', 'create', 'edit', 'approve', 'export'],
      finance: ['view', 'create', 'edit', 'approve', 'export', 'manage'],
      receipts: ['view', 'create', 'delete_void', 'export'],
      expenses: ['view', 'create', 'edit', 'export'],
      reports: ['view', 'export'],
      documents: ['view', 'create', 'export'],
      archive: ['view', 'export'],
      audit: ['view'],
    };
  }
  if (role === 'supervisor') {
    return {
      dashboard: ['view'],
      properties: ['view', 'create', 'edit', 'export'],
      units: ['view', 'create', 'edit', 'export'],
      tenants: ['view', 'create', 'edit'],
      contracts: ['view', 'create', 'edit', 'approve'],
      maintenance: ['view', 'create', 'edit', 'approve'],
      tasks: ['view', 'create', 'edit', 'approve'],
      expenses: ['view', 'create', 'approve'],
      reports: ['view', 'export'],
      documents: ['view', 'create'],
      archive: ['view', 'create'],
    };
  }
  if (role === 'leasing') {
    return {
      dashboard: ['view'],
      properties: ['view', 'edit'],
      units: ['view', 'create', 'edit'],
      tenants: ['view', 'create', 'edit', 'export'],
      contracts: ['view', 'create', 'edit', 'export'],
      tasks: ['view', 'create'],
      documents: ['view', 'create'],
      archive: ['view'],
    };
  }
  if (role === 'maint_manager') {
    return {
      dashboard: ['view'],
      properties: ['view'],
      units: ['view'],
      maintenance: ['view', 'create', 'edit', 'approve', 'manage'],
      tasks: ['view', 'create', 'edit', 'approve', 'manage'],
      expenses: ['view', 'create', 'approve'],
      documents: ['view', 'create'],
      reports: ['view'],
    };
  }
  if (role === 'technician') {
    return {
      dashboard: ['view'],
      units: ['view'],
      maintenance: ['view', 'create', 'edit'],
      tasks: ['view', 'create', 'edit'],
      expenses: ['view', 'create'],
    };
  }
  if (role === 'receptionist') {
    return {
      dashboard: ['view'],
      properties: ['view'],
      units: ['view'],
      tenants: ['view', 'create', 'edit'],
      tasks: ['view', 'create'],
      documents: ['view', 'create'],
      maintenance: ['view', 'create'],
    };
  }
  if (role === 'owner') {
    return {
      dashboard: ['view'],
      properties: ['view'],
      units: ['view'],
      tenants: ['view'],
      contracts: ['view'],
      payments: ['view'],
      finance: ['view'],
      receipts: ['view'],
      reports: ['view', 'export'],
      documents: ['view'],
      archive: ['view'],
    };
  }
  return { dashboard: ['view'] };
}

export function buildAllDefaultRoleModulePermissions(): Partial<
  Record<RoleKey, Partial<Record<PermissionModuleKey, PermissionLevel[]>>>
> {
  const out: Partial<Record<RoleKey, Partial<Record<PermissionModuleKey, PermissionLevel[]>>>> = {};
  for (const r of ROLE_TEMPLATES) {
    out[r.key] = getDefaultModulePermissionsForRole(r.key);
  }
  return out;
}

function mergeModulePermissions(
  base: Partial<Record<PermissionModuleKey, PermissionLevel[]>>,
  overlay?: Partial<Record<PermissionModuleKey, PermissionLevel[]>>
): Partial<Record<PermissionModuleKey, PermissionLevel[]>> {
  if (!overlay) return { ...base };
  const merged: Partial<Record<PermissionModuleKey, PermissionLevel[]>> = {};
  for (const m of RBAC_MODULES) {
    const key = m.key;
    if (overlay[key] !== undefined) {
      merged[key] = Array.from(new Set(overlay[key] || []));
    } else if (base[key] !== undefined) {
      merged[key] = Array.from(new Set(base[key] || []));
    }
  }
  return merged;
}

export function deriveLegacyPermissionsFromModules(
  modulePerms: Partial<Record<PermissionModuleKey, PermissionLevel[]>>
): PermissionKey[] {
  const set = new Set<PermissionKey>();
  const hasAny = (mod: PermissionModuleKey, actions: PermissionLevel[]) => {
    const list = modulePerms[mod] || [];
    return list.includes('manage') || actions.some((a) => list.includes(a));
  };

  if (hasAny('properties', ['create', 'edit', 'delete_void', 'manage']) || hasAny('units', ['create', 'edit', 'manage'])) {
    set.add('manage_properties');
  }
  if (hasAny('tenants', ['create', 'edit', 'delete_void', 'manage'])) {
    set.add('manage_tenants');
  }
  if (hasAny('contracts', ['create', 'edit', 'approve', 'manage'])) {
    set.add('manage_contracts');
  }
  if (hasAny('payments', ['create', 'edit', 'manage'])) {
    set.add('collect_payments');
  }
  if (hasAny('receipts', ['delete_void', 'approve', 'manage'])) {
    set.add('reverse_receipts');
  }
  if (hasAny('finance', ['create', 'edit', 'approve', 'manage'])) {
    set.add('manage_accounting');
  }
  if (hasAny('expenses', ['create'])) {
    set.add('create_expense');
  }
  if (hasAny('expenses', ['approve'])) {
    set.add('approve_expense_supervisor');
  }
  if (hasAny('expenses', ['manage'])) {
    set.add('approve_expense_manager');
  }
  if (hasAny('maintenance', ['manage', 'approve'])) {
    set.add('manage_maintenance');
  }
  if (hasAny('maintenance', ['create', 'edit'])) {
    set.add('execute_maintenance');
  }
  if (hasAny('tasks', ['create', 'edit', 'approve', 'manage'])) {
    set.add('manage_tasks');
  }
  if (hasAny('documents', ['create', 'edit', 'delete_void', 'manage'])) {
    set.add('manage_documents');
  }
  if (hasAny('team', ['create', 'edit', 'delete_void', 'manage']) || hasAny('settings', ['manage'])) {
    set.add('manage_users');
  }
  if (hasAny('backups', ['create', 'manage', 'approve'])) {
    set.add('backup_restore');
  }
  if (hasAny('audit', ['view', 'export', 'manage'])) {
    set.add('view_audit');
  }
  if (hasAny('reports', ['view']) && hasAny('finance', ['view'])) {
    set.add('view_all');
  }
  return Array.from(set);
}

/**
 * Computes effective 18-module x 7-action permissions for a user.
 * Note: Changing `jobTitle` NEVER grants or modifies any permission.
 */
export function getEffectiveModulePermissions(
  state: Pick<AqarDatabaseState, 'roleModulePermissions' | 'customRoles' | 'rolePermissions'> | null | undefined,
  user: StaffUser | null | undefined
): Partial<Record<PermissionModuleKey, PermissionLevel[]>> {
  if (!user) return {};

  const customRole: CustomRoleDefinition | undefined = user.customRoleId
    ? state?.customRoles?.find((r) => r.id === user.customRoleId)
    : undefined;

  const baseTemplate = customRole
    ? customRole.modulePermissions
    : state?.roleModulePermissions?.[user.role] || getDefaultModulePermissionsForRole(user.role);

  // Explicit per-user customModulePermissions overrides template module keys where specified
  const effective = mergeModulePermissions(baseTemplate, user.customModulePermissions);

  // Keep legacy permission toggles in sync if no customModulePermissions overrode that module
  const legacyList = customRole
    ? customRole.legacyPermissions
    : state?.rolePermissions?.[user.role] || [];

  const ensureLegacy = (perm: PermissionKey, mod: PermissionModuleKey, actions: PermissionLevel[]) => {
    if (!legacyList.includes(perm)) return;
    if (user.customModulePermissions && user.customModulePermissions[mod] !== undefined) return;
    const cur = new Set(effective[mod] || []);
    for (const a of actions) cur.add(a);
    effective[mod] = Array.from(cur);
  };

  ensureLegacy('manage_properties', 'properties', ['view', 'create', 'edit']);
  ensureLegacy('manage_properties', 'units', ['view', 'create', 'edit']);
  ensureLegacy('manage_tenants', 'tenants', ['view', 'create', 'edit']);
  ensureLegacy('manage_contracts', 'contracts', ['view', 'create', 'edit']);
  ensureLegacy('collect_payments', 'payments', ['view', 'create']);
  ensureLegacy('collect_payments', 'receipts', ['view', 'create']);
  ensureLegacy('reverse_receipts', 'receipts', ['view', 'delete_void']);
  ensureLegacy('manage_accounting', 'finance', ['view', 'create', 'edit']);
  ensureLegacy('create_expense', 'expenses', ['view', 'create']);
  ensureLegacy('approve_expense_supervisor', 'expenses', ['view', 'approve']);
  ensureLegacy('approve_expense_manager', 'expenses', ['view', 'approve', 'manage']);
  ensureLegacy('manage_maintenance', 'maintenance', ['view', 'create', 'edit', 'approve', 'manage']);
  ensureLegacy('execute_maintenance', 'maintenance', ['view', 'edit']);
  ensureLegacy('manage_tasks', 'tasks', ['view', 'create', 'edit']);
  ensureLegacy('manage_documents', 'documents', ['view', 'create', 'edit']);
  ensureLegacy('manage_users', 'team', ['view', 'create', 'edit', 'delete_void', 'manage']);
  ensureLegacy('backup_restore', 'backups', ['view', 'create', 'approve', 'manage']);
  ensureLegacy('view_audit', 'audit', ['view', 'export']);

  return effective;
}

export function userHasModuleAction(
  state: Pick<AqarDatabaseState, 'roleModulePermissions' | 'customRoles' | 'rolePermissions'> | null | undefined,
  user: StaffUser | null | undefined,
  module: PermissionModuleKey,
  action: PermissionLevel = 'view'
): boolean {
  if (!user || !user.active) return false;
  if (user.accountStatus && user.accountStatus !== 'نشط') return false;
  if (user.role === 'sys_owner' && !user.customModulePermissions && !user.customRoleId) {
    return true;
  }
  const effective = getEffectiveModulePermissions(state, user);
  const actions = effective[module] || [];
  if (actions.includes('manage')) return true;
  return actions.includes(action);
}

export function userHasLegacyPermission(
  state: Pick<AqarDatabaseState, 'roleModulePermissions' | 'customRoles' | 'rolePermissions'> | null | undefined,
  user: StaffUser | null | undefined,
  permission: PermissionKey
): boolean {
  if (!user || !user.active) return false;
  if (user.accountStatus && user.accountStatus !== 'نشط') return false;
  if (user.customRoleId) {
    const customRole = state?.customRoles?.find((r) => r.id === user.customRoleId);
    if (customRole) {
      const derived = deriveLegacyPermissionsFromModules(
        getEffectiveModulePermissions(state, user)
      );
      return (
        customRole.legacyPermissions.includes(permission) ||
        derived.includes(permission)
      );
    }
  }
  if (user.customModulePermissions) {
    const derived = deriveLegacyPermissionsFromModules(
      getEffectiveModulePermissions(state, user)
    );
    if (derived.includes(permission)) return true;
  }
  const perms = state?.rolePermissions?.[user.role] || [];
  return perms.includes(permission);
}

export function getNavRequiredModules(nav: string): PermissionModuleKey[] {
  switch (nav) {
    case 'dashboard':
      return ['dashboard'];
    case 'daily_hub':
      return ['tasks', 'dashboard'];
    case 'properties':
      return ['properties', 'units'];
    case 'leasing_finance':
    case 'leasing':
    case 'finance':
    case 'accounting':
      return ['contracts', 'payments', 'finance', 'receipts', 'expenses'];
    case 'tenants':
      return ['tenants'];
    case 'maintenance':
      return ['maintenance', 'tasks'];
    case 'reports':
    case 'admin':
      return ['reports', 'audit'];
    case 'team':
      return ['team'];
    case 'documents':
      return ['documents'];
    case 'archive':
      return ['archive'];
    case 'templates':
      return ['tenants', 'contracts', 'settings'];
    case 'settings':
      return ['settings', 'backups'];
    case 'about':
    case 'profile':
      return ['dashboard'];
    default:
      return ['dashboard'];
  }
}

export function userCanAccessNav(
  state: Pick<AqarDatabaseState, 'roleModulePermissions' | 'customRoles' | 'rolePermissions'> | null | undefined,
  user: StaffUser | null | undefined,
  nav: string
): boolean {
  if (!user || !user.active) return false;
  if (user.accountStatus && user.accountStatus !== 'نشط') return false;
  if (nav === 'profile' || nav === 'about' || nav === 'dashboard') return true;
  if (user.role === 'owner') {
    const ownerAllowed = new Set(['dashboard', 'properties', 'leasing_finance', 'tenants', 'reports', 'documents', 'archive', 'profile', 'about']);
    return ownerAllowed.has(nav);
  }
  const modules = getNavRequiredModules(nav);
  return modules.some((m) => userHasModuleAction(state, user, m, 'view'));
}

export function getRecommendedLandingNav(
  state: Pick<AqarDatabaseState, 'roleModulePermissions' | 'customRoles' | 'rolePermissions'> | null | undefined,
  user: StaffUser | null | undefined
): { nav: string; leasingFinanceTab?: 'leasing' | 'finance' | 'accounting' } {
  if (!user || !user.active || (user.accountStatus && user.accountStatus !== 'نشط')) {
    return { nav: 'dashboard' };
  }
  if (user.role === 'accountant' && userCanAccessNav(state, user, 'leasing_finance')) {
    return { nav: 'leasing_finance', leasingFinanceTab: 'finance' };
  }
  if ((user.role === 'maint_manager' || user.role === 'technician') && userCanAccessNav(state, user, 'maintenance')) {
    return { nav: 'maintenance' };
  }
  if (user.role === 'leasing' && userCanAccessNav(state, user, 'tenants')) {
    return { nav: 'tenants' };
  }
  if (user.role === 'supervisor' && userCanAccessNav(state, user, 'properties')) {
    return { nav: 'properties' };
  }
  if (user.role === 'receptionist' && userCanAccessNav(state, user, 'daily_hub')) {
    return { nav: 'daily_hub' };
  }
  return { nav: 'dashboard' };
}

export function getAllowedNavsForUser(
  state: Pick<AqarDatabaseState, 'roleModulePermissions' | 'customRoles' | 'rolePermissions'> | null | undefined,
  user: StaffUser | null | undefined
): string[] {
  const allNavs = [
    'dashboard',
    'daily_hub',
    'properties',
    'leasing_finance',
    'tenants',
    'maintenance',
    'reports',
    'team',
    'documents',
    'archive',
    'templates',
    'settings',
    'profile',
    'about',
  ];
  return allNavs.filter((n) => userCanAccessNav(state, user, n));
}
