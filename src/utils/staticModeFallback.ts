import {
  AqarDatabaseState,
  CommunicationLog,
  CommunicationTemplate,
  CompanySettings,
  DocumentRecord,
  Expense,
  Lead,
  LeaseContract,
  MaintenanceTicket,
  Payment,
  PermissionKey,
  Property,
  ReminderChannel,
  ReminderRule,
  RoleKey,
  TaskItem,
  Tenant,
  Unit,
} from '../types/aqar';

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

/**
 * Local-First browser fallback mutation handler used ONLY when running on
 * static hosting (such as GitHub Pages) with no Express/Node backend server.
 */
export function applyStaticModeMutation(
  currentState: AqarDatabaseState,
  userId: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  endpoint: string,
  rawBody?: unknown
): { state: AqarDatabaseState; [key: string]: unknown } {
  const body = (rawBody && typeof rawBody === 'object' ? rawBody : {}) as Record<string, unknown>;
  const now = new Date().toISOString();
  const next: AqarDatabaseState = JSON.parse(JSON.stringify(currentState)) as AqarDatabaseState;
  next.lastUpdatedAt = now;
  next.syncRevision = (next.syncRevision || 1) + 1;
  const actor = next.users.find((u) => u.id === userId) || next.users[0];

  // 1. Settings update
  if (method === 'PATCH' && endpoint === '/api/settings') {
    const patch = body as Partial<CompanySettings>;
    next.settings = {
      ...next.settings,
      ...patch,
      generalPrefs: patch.generalPrefs
        ? { ...(next.settings.generalPrefs || ({} as NonNullable<CompanySettings['generalPrefs']>)), ...patch.generalPrefs }
        : next.settings.generalPrefs,
      calendarConfig: patch.calendarConfig
        ? { ...(next.settings.calendarConfig || ({} as NonNullable<CompanySettings['calendarConfig']>)), ...patch.calendarConfig }
        : next.settings.calendarConfig,
      backupPolicy: patch.backupPolicy
        ? { ...(next.settings.backupPolicy || ({} as NonNullable<CompanySettings['backupPolicy']>)), ...patch.backupPolicy }
        : next.settings.backupPolicy,
    };
    return { settings: next.settings, state: next };
  }

  // 2. Properties & Units
  if (method === 'POST' && endpoint === '/api/properties') {
    const property: Property = {
      id: uid('prop'),
      code: String(body.code || `PR-${next.properties.length + 101}`),
      nameAr: String(body.nameAr || 'عقار جديد'),
      nameEn: String(body.nameEn || 'New Property'),
      city: String(body.city || next.settings.city || 'الرياض'),
      district: String(body.district || 'حي العليا'),
      street: String(body.street || ''),
      nationalAddress: String(body.nationalAddress || ''),
      type: (body.type as Property['type']) || 'سكني',
      deedNumber: String(body.deedNumber || ''),
      status: 'نشط',
      buildingsCount: Number(body.buildingsCount || 1),
      floorsCount: Number(body.floorsCount || 1),
      managementFeePercent: Number(body.managementFeePercent ?? next.settings.defaultManagementFeePercent ?? 5),
      ownershipMode: (body.ownershipMode as Property['ownershipMode']) || 'إدارة للغير',
      ownerShares: Array.isArray(body.ownerShares)
        ? (body.ownerShares as Property['ownerShares'])
        : [{ ownerId: String(body.ownerId || next.owners[0]?.id || 'own-1'), sharePercent: 100 }],
      electricityMeterMain: String(body.electricityMeterMain || ''),
      waterMeterMain: String(body.waterMeterMain || ''),
      caretakerName: String(body.caretakerName || ''),
      caretakerPhone: String(body.caretakerPhone || ''),
      createdAt: now,
    };
    next.properties.unshift(property);
    return { property, state: next };
  }

  if (method === 'POST' && endpoint === '/api/units') {
    const monthly = Number(body.suggestedMonthlyRent || 2500);
    const unit: Unit = {
      id: uid('unit'),
      propertyId: String(body.propertyId || next.properties[0]?.id || ''),
      buildingName: String(body.buildingName || 'المبنى الرئيسي'),
      floor: Number(body.floor || 1),
      unitNumber: String(body.unitNumber || `${next.units.length + 101}`),
      unitType: (body.unitType as Unit['unitType']) || 'شقة',
      areaSqm: Number(body.areaSqm || 120),
      rooms: Number(body.rooms || 3),
      bathrooms: Number(body.bathrooms || 2),
      furnished: Boolean(body.furnished),
      acCount: Number(body.acCount || 2),
      electricityMeter: String(body.electricityMeter || ''),
      waterMeter: String(body.waterMeter || ''),
      keyCount: Number(body.keyCount || 2),
      acRemoteCount: Number(body.acRemoteCount || 2),
      suggestedMonthlyRent: monthly,
      suggestedAnnualRent: Number(body.suggestedAnnualRent || monthly * 12),
      officeFee: Number(body.officeFee || 0),
      status: (body.status as Unit['status']) || 'شاغرة',
    };
    next.units.push(unit);
    return { unit, state: next };
  }

  const unitStatusMatch = endpoint.match(/^\/api\/units\/([^/]+)\/status$/);
  if (method === 'PATCH' && unitStatusMatch) {
    const unit = next.units.find((u) => u.id === unitStatusMatch[1]);
    if (unit && body.status) {
      unit.status = body.status as Unit['status'];
      return { unit, state: next };
    }
  }

  // 3. Tenants & Leads
  if (method === 'POST' && endpoint === '/api/tenants') {
    const tenant: Tenant = {
      id: uid('ten'),
      nameAr: String(body.nameAr || 'مستأجر جديد'),
      nameEn: String(body.nameEn || body.nameAr || 'Tenant'),
      nationalIdOrIqama: String(body.nationalIdOrIqama || body.nationalId || ''),
      nationality: String(body.nationality || 'سعودي'),
      phone: String(body.phone || ''),
      email: String(body.email || ''),
      tenantType: (body.tenantType as Tenant['tenantType']) || 'فرد',
      classification: 'نشط',
      rating: Number(body.rating ?? 5),
      notes: String(body.notes || ''),
      createdAt: now,
    };
    next.tenants.unshift(tenant);
    return { tenant, state: next };
  }

  const tenantMatch = endpoint.match(/^\/api\/tenants\/([^/]+)$/);
  if (method === 'PATCH' && tenantMatch) {
    const tenant = next.tenants.find((t) => t.id === tenantMatch[1]);
    if (tenant) {
      Object.assign(tenant, body);
      return { tenant, state: next };
    }
  }
  if (method === 'DELETE' && tenantMatch) {
    next.tenants = next.tenants.filter((t) => t.id !== tenantMatch[1]);
    return { ok: true, state: next };
  }

  if (method === 'POST' && endpoint === '/api/leads') {
    const lead: Lead = {
      id: uid('lead'),
      nameAr: String(body.nameAr || 'مهتم جديد'),
      phone: String(body.phone || ''),
      source: String(body.source || 'تواصل مباشر'),
      propertyId: String(body.propertyId || next.properties[0]?.id || ''),
      unitId: String(body.unitId || next.units[0]?.id || ''),
      offeredRent: Number(body.offeredRent || body.budgetMonthly || 2500),
      budgetMonthly: Number(body.budgetMonthly || body.offeredRent || 2500),
      viewingDate: String(body.viewingDate || now.slice(0, 10)),
      status: 'جديد',
      assignedTo: String(body.assignedTo || userId),
      notes: String(body.notes || ''),
      createdAt: now,
    };
    next.leads.unshift(lead);
    return { lead, state: next };
  }

  // 4. Contracts & Payments
  if (method === 'POST' && endpoint === '/api/contracts') {
    const unitId = String(body.unitId || '');
    const contract: LeaseContract = {
      id: uid('con'),
      internalNumber: String(body.internalNumber || `CNT-${next.contracts.length + 1001}`),
      ejarNumber: String(body.ejarNumber || ''),
      ejarStatus: (body.ejarStatus as LeaseContract['ejarStatus']) || 'غير موثق',
      lifecycleStatus: 'نشط',
      propertyId: String(body.propertyId || next.properties[0]?.id || ''),
      unitId,
      tenantId: String(body.tenantId || next.tenants[0]?.id || ''),
      startDate: String(body.startDate || now.slice(0, 10)),
      endDate: String(body.endDate || now.slice(0, 10)),
      annualRent: Number(body.annualRent || 30000),
      paymentFrequency: (body.paymentFrequency as LeaseContract['paymentFrequency']) || 'شهري',
      installmentsCount: Number(body.installmentsCount || 12),
      securityDeposit: Number(body.securityDeposit || 2000),
      officeFee: Number(body.officeFee || 0),
      managementCommissionPercent: Number(body.managementCommissionPercent ?? next.settings.defaultManagementFeePercent ?? 5),
      includedServices: String(body.includedServices || ''),
      version: 1,
      createdBy: actor?.nameAr || 'مستخدم محلي',
      createdAt: now,
    };
    next.contracts.unshift(contract);
    const unit = next.units.find((u) => u.id === unitId);
    if (unit) unit.status = 'مؤجرة';
    return { contract, state: next };
  }

  if (method === 'POST' && endpoint === '/api/payments') {
    const amount = Number(body.amount || 0);
    const installmentId = body.installmentId ? String(body.installmentId) : undefined;
    const payment: Payment = {
      id: uid('pay'),
      receiptNumber: `REC-${new Date().getFullYear()}-${String(next.payments.length + 101).padStart(4, '0')}`,
      idempotencyKey: uid('idem'),
      contractId: String(body.contractId || ''),
      unitId: String(body.unitId || ''),
      propertyId: String(body.propertyId || ''),
      tenantId: String(body.tenantId || ''),
      allocations: installmentId ? [{ installmentId, amount }] : [],
      amount,
      currency: (body.currency as Payment['currency']) || 'SAR',
      paymentMethod: (body.paymentMethod as Payment['paymentMethod']) || (body.method as Payment['paymentMethod']) || 'تحويل بنكي',
      paymentType: (body.paymentType as Payment['paymentType']) || 'إيجار',
      referenceNumber: body.referenceNumber ? String(body.referenceNumber) : undefined,
      receivedBy: actor?.nameAr || 'مستخدم محلي',
      deviceName: 'Browser (Local Mode)',
      status: 'معتمد',
      notes: body.notes ? String(body.notes) : undefined,
      createdAt: now,
    };
    next.payments.unshift(payment);
    if (installmentId) {
      const inst = next.installments.find((i) => i.id === installmentId);
      if (inst) {
        inst.paidAmount = Math.min(inst.amount, inst.paidAmount + amount);
        inst.remainingAmount = Math.max(0, inst.amount - inst.paidAmount);
        inst.status = inst.paidAmount >= inst.amount ? 'مدفوعة بالكامل' : 'مدفوعة جزئياً';
      }
    }
    return { payment, state: next };
  }

  // 5. Expenses & Tickets & Tasks
  if (method === 'POST' && endpoint === '/api/expenses') {
    const expense: Expense = {
      id: uid('exp'),
      expenseNumber: `EXP-${String(next.expenses.length + 201)}`,
      date: String(body.date || now.slice(0, 10)),
      category: (body.category as Expense['category']) || 'صيانة',
      propertyId: String(body.propertyId || next.properties[0]?.id || ''),
      unitId: body.unitId ? String(body.unitId) : undefined,
      vendorId: body.vendorId ? String(body.vendorId) : undefined,
      invoiceNumber: String(body.invoiceNumber || `INV-${Date.now().toString().slice(-5)}`),
      amount: Number(body.amount || 0),
      currency: (body.currency as Expense['currency']) || 'SAR',
      paymentMethod: (body.paymentMethod as Expense['paymentMethod']) || 'تحويل بنكي',
      bearer: (body.bearer as Expense['bearer']) || 'المالك',
      approvalStatus: 'معتمد',
      notes: body.notes ? String(body.notes) : body.description ? String(body.description) : undefined,
      createdBy: actor?.nameAr || 'مستخدم محلي',
      createdAt: now,
    };
    next.expenses.unshift(expense);
    return { expense, state: next };
  }

  if (method === 'POST' && endpoint === '/api/tickets') {
    const ticket: MaintenanceTicket = {
      id: uid('tkt'),
      ticketNumber: `MNT-${String(next.tickets.length + 101)}`,
      propertyId: String(body.propertyId || next.properties[0]?.id || ''),
      unitId: String(body.unitId || next.units[0]?.id || ''),
      source: (body.source as MaintenanceTicket['source']) || 'المشرف',
      category: String(body.category || 'أخرى'),
      priority: (body.priority as MaintenanceTicket['priority']) || 'متوسط',
      title: String(body.title || 'بلاغ صيانة جديد'),
      description: String(body.description || body.notes || ''),
      estimatedCost: Number(body.estimatedCost || 0),
      actualCost: 0,
      status: 'جديد',
      createdBy: actor?.nameAr || 'مستخدم محلي',
      createdAt: now,
      updatedAt: now,
    };
    next.tickets.unshift(ticket);
    return { ticket, state: next };
  }

  const ticketMatch = endpoint.match(/^\/api\/tickets\/([^/]+)$/);
  if (method === 'PATCH' && ticketMatch) {
    const ticket = next.tickets.find((t) => t.id === ticketMatch[1]);
    if (ticket) {
      Object.assign(ticket, body, { updatedAt: now });
      return { ticket, state: next };
    }
  }

  if (method === 'POST' && endpoint === '/api/tasks') {
    const task: TaskItem = {
      id: uid('tsk'),
      title: String(body.title || 'مهمة جديدة'),
      description: String(body.description || ''),
      type: String(body.type || 'متابعة'),
      priority: (body.priority as TaskItem['priority']) || 'متوسط',
      assignedTo: String(body.assignedTo || userId),
      createdBy: userId,
      dueDate: String(body.dueDate || now.slice(0, 10)),
      status: 'جديدة',
      checklist: [],
      comments: [],
      createdAt: now,
    };
    next.tasks.unshift(task);
    return { task, state: next };
  }

  const taskMatch = endpoint.match(/^\/api\/tasks\/([^/]+)$/);
  if (method === 'PATCH' && taskMatch) {
    const task = next.tasks.find((t) => t.id === taskMatch[1]);
    if (task) {
      Object.assign(task, body);
      return { task, state: next };
    }
  }

  // 6. Communications & Documents
  if (method === 'POST' && endpoint === '/api/communications') {
    const log: CommunicationLog = {
      id: uid('com'),
      targetType: (body.targetType as CommunicationLog['targetType']) || 'مستأجر',
      targetId: String(body.targetId || ''),
      targetName: String(body.targetName || ''),
      channel: (body.channel as CommunicationLog['channel']) || 'رسالة نصية / واتساب',
      language: 'ar',
      summary: String(body.summary || ''),
      sentBy: actor?.nameAr || 'مستخدم محلي',
      createdAt: now,
    };
    next.communications.unshift(log);
    return { log, state: next };
  }

  if (method === 'POST' && endpoint === '/api/documents') {
    const doc: DocumentRecord = {
      id: uid('doc'),
      title: String(body.title || 'مستند جديد'),
      category: (body.category as DocumentRecord['category']) || 'مراسلات الشركة',
      fileName: String(body.fileName || 'document.pdf'),
      fileType: String(body.fileType || 'application/pdf'),
      fileSizeKb: Number(body.fileSizeKb || 128),
      relatedType: (body.relatedType as DocumentRecord['relatedType']) || 'شركة',
      relatedId: String(body.relatedId || ''),
      version: 1,
      dataUrl: body.dataUrl ? String(body.dataUrl) : undefined,
      uploadedBy: actor?.nameAr || 'مستخدم محلي',
      createdAt: now,
      accessLog: [],
    };
    next.documents.unshift(doc);
    return { doc, state: next };
  }

  // 7. Backups & Notifications & Templates & Reminders
  if (method === 'POST' && endpoint === '/api/backups') {
    const backup = {
      id: uid('bkp'),
      label: String(body.label || `نسخة متصفح محلية · ${new Date().toLocaleDateString('ar-SA')}`),
      createdAt: now,
      createdBy: actor?.nameAr || 'مستخدم محلي',
      sizeKb: Math.max(32, Math.round(JSON.stringify(next).length / 1024)),
      recordCount: next.properties.length + next.units.length + next.tenants.length + next.contracts.length + next.payments.length,
    };
    next.backups.unshift(backup);
    return { backup, state: next };
  }

  if (method === 'POST' && endpoint === '/api/notifications/read') {
    next.notifications = next.notifications.map((n) => ({
      ...n,
      isReadBy: n.isReadBy.includes(userId) ? n.isReadBy : [...n.isReadBy, userId],
    }));
    return { ok: true, state: next };
  }

  if (method === 'POST' && endpoint === '/api/permissions/toggle') {
    const allowedPerms = next.rolePermissions[actor?.role || 'gm'] || [];
    if (!allowedPerms.includes('manage_users') && actor?.role !== 'sys_owner' && actor?.role !== 'gm') {
      throw new Error('صلاحية إدارة المستخدمين والصلاحيات مطلوبة لتنفيذ هذا الإجراء');
    }
    const role = body.role as RoleKey;
    const perm = body.permission as PermissionKey;
    const currentPerms = next.rolePermissions[role] || [];
    next.rolePermissions[role] = currentPerms.includes(perm)
      ? currentPerms.filter((p) => p !== perm)
      : [...currentPerms, perm];
    return { rolePermissions: next.rolePermissions, state: next };
  }

  if (method === 'POST' && endpoint === '/api/templates') {
    const template: CommunicationTemplate = {
      id: uid('tpl'),
      name: String(body.name || 'قالب جديد'),
      category: (body.category as CommunicationTemplate['category']) || 'custom',
      channel: (body.channel as CommunicationTemplate['channel']) || 'whatsapp',
      language: (body.language as CommunicationTemplate['language']) || 'ar',
      contentAr: String(body.contentAr || body.bodyAr || ''),
      contentEn: body.contentEn ? String(body.contentEn) : undefined,
      usageCount: 0,
      createdBy: actor?.nameAr || 'مستخدم محلي',
      updatedAt: now,
    };
    next.communicationTemplates = [template, ...(next.communicationTemplates || [])];
    return { template, state: next };
  }

  const tplMatch = endpoint.match(/^\/api\/templates\/([^/]+)$/);
  if (method === 'PATCH' && tplMatch) {
    const tpl = (next.communicationTemplates || []).find((t) => t.id === tplMatch[1]);
    if (tpl) {
      Object.assign(tpl, body, { updatedAt: now });
      return { template: tpl, state: next };
    }
  }
  if (method === 'DELETE' && tplMatch) {
    next.communicationTemplates = (next.communicationTemplates || []).filter((t) => t.id !== tplMatch[1]);
    return { ok: true, state: next };
  }

  if (method === 'POST' && endpoint === '/api/reminders/rules') {
    const rule: ReminderRule = {
      id: uid('rem'),
      nameAr: String(body.nameAr || 'قاعدة تنبيه'),
      nameEn: String(body.nameEn || body.nameAr || 'Reminder Rule'),
      enabled: true,
      daysBeforeDue: Number(body.daysBeforeDue || body.offsetDays || 3),
      channels: Array.isArray(body.channels) ? (body.channels as ReminderChannel[]) : ['واتساب'],
      templateAr: String(body.templateAr || body.template || ''),
      templateEn: String(body.templateEn || ''),
      createdBy: actor?.nameAr || 'مستخدم محلي',
      createdAt: now,
    };
    next.reminderRules = [rule, ...(next.reminderRules || [])];
    return { rule, state: next };
  }

  if (method === 'POST' && endpoint === '/api/storage/sync-folders') {
    return {
      backupsSynced: next.backups.length,
      archiveFilesSynced: 0,
      documentsSynced: next.documents.length,
      state: next,
    };
  }

  if (method === 'POST' && endpoint === '/api/workspace/reset-fresh') {
    const allowedPerms = next.rolePermissions[actor?.role || 'gm'] || [];
    if (!allowedPerms.includes('backup_restore') && actor?.role !== 'sys_owner' && actor?.role !== 'gm') {
      throw new Error('صلاحية مالك النظام أو المدير مطلوبة لإعادة تهيئة مساحة العمل');
    }
    next.properties = [];
    next.units = [];
    next.tenants = [];
    next.leads = [];
    next.contracts = [];
    next.installments = [];
    next.payments = [];
    next.expenses = [];
    next.tickets = [];
    next.tasks = [];
    next.documents = [];
    return { ok: true, state: next };
  }

  return { ok: true, state: next };
}
