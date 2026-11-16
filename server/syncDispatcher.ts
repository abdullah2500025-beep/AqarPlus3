import { AqarStore } from './store';

export interface SyncDispatchInput {
  method: 'POST' | 'PATCH' | 'DELETE';
  endpoint: string;
  body: Record<string, unknown>;
  userId: string;
  deviceName?: string;
  idempotencyKey?: string;
  operationId?: string;
}

export interface SyncDispatchResult {
  ok: boolean;
  status: number;
  data: Record<string, unknown>;
  entityType?: string;
  entityId?: string;
}

/**
 * Direct in-process dispatcher for queued offline mutations & sync batches.
 * Eliminates fragile HTTP self-loopback (`fetch('http://127.0.0.1:...')`) and runs
 * identically inside Node/Express, Electron desktop, and Cloudflare Workers.
 */
export function dispatchSyncOperation(
  store: AqarStore,
  input: SyncDispatchInput
): SyncDispatchResult {
  const { method, userId, deviceName } = input;
  const body = (input.body && typeof input.body === 'object' ? input.body : {}) as Record<string, any>;
  const endpoint = input.endpoint.split('?')[0].trim();

  try {
    if (method === 'POST' && endpoint === '/api/properties') {
      const property = store.createProperty(userId, body as any, deviceName);
      return { ok: true, status: 201, data: { property }, entityType: 'properties', entityId: property.id };
    }
    if (method === 'POST' && endpoint === '/api/units') {
      const unit = store.createUnit(userId, body as any, deviceName);
      return { ok: true, status: 201, data: { unit }, entityType: 'units', entityId: unit.id };
    }
    let m: RegExpExecArray | null;

    if (method === 'PATCH' && (m = /^\/api\/units\/([^/]+)\/status$/.exec(endpoint))) {
      const unit = store.updateUnitStatus(userId, m[1], body.status, body.reason, deviceName);
      return { ok: true, status: 200, data: { unit }, entityType: 'units', entityId: unit.id };
    }
    if (method === 'POST' && (m = /^\/api\/units\/([^/]+)\/link-tenant$/.exec(endpoint))) {
      const unit = store.linkTenantToUnit(userId, m[1], body.tenantId, deviceName);
      return { ok: true, status: 200, data: { unit }, entityType: 'units', entityId: unit.id };
    }
    if (method === 'POST' && endpoint === '/api/tenants') {
      const tenant = store.createTenant(userId, body as any, deviceName);
      return { ok: true, status: 201, data: { tenant }, entityType: 'tenants', entityId: tenant.id };
    }
    if (method === 'PATCH' && (m = /^\/api\/tenants\/([^/]+)$/.exec(endpoint))) {
      const tenant = store.updateTenant(userId, m[1], body, deviceName);
      return { ok: true, status: 200, data: { tenant }, entityType: 'tenants', entityId: tenant.id };
    }
    if (method === 'DELETE' && (m = /^\/api\/tenants\/([^/]+)$/.exec(endpoint))) {
      store.deleteTenant(userId, m[1], deviceName);
      return { ok: true, status: 200, data: { ok: true }, entityType: 'tenants', entityId: m[1] };
    }
    if (method === 'PATCH' && (m = /^\/api\/tenants\/([^/]+)\/checklist$/.exec(endpoint))) {
      const tenant = store.updateTenantChecklist(userId, m[1], body as any, deviceName);
      return { ok: true, status: 200, data: { tenant }, entityType: 'tenants', entityId: tenant.id };
    }
    if (method === 'POST' && (m = /^\/api\/tenants\/([^/]+)\/notes$/.exec(endpoint))) {
      const note = store.addTenantViolationNote(userId, m[1], body as any, deviceName);
      return { ok: true, status: 201, data: { note }, entityType: 'tenants', entityId: m[1] };
    }
    if (method === 'POST' && (m = /^\/api\/tenants\/([^/]+)\/appointments$/.exec(endpoint))) {
      const log = store.scheduleTenantAppointment(userId, m[1], body as any, deviceName);
      return { ok: true, status: 201, data: { log }, entityType: 'tenants', entityId: m[1] };
    }
    if (method === 'POST' && endpoint === '/api/leads') {
      const lead = store.createLead(userId, body as any, deviceName);
      return { ok: true, status: 201, data: { lead }, entityType: 'leads', entityId: lead.id };
    }
    if (method === 'PATCH' && (m = /^\/api\/leads\/([^/]+)$/.exec(endpoint))) {
      const lead = store.updateLead(userId, m[1], body, deviceName);
      return { ok: true, status: 200, data: { lead }, entityType: 'leads', entityId: lead.id };
    }
    if (method === 'POST' && (m = /^\/api\/leads\/([^/]+)\/escalate$/.exec(endpoint))) {
      const escalation = store.escalateLead(userId, m[1], body as any, deviceName);
      return { ok: true, status: 201, data: { escalation }, entityType: 'leads', entityId: m[1] };
    }
    if (method === 'POST' && (m = /^\/api\/leads\/([^/]+)\/convert$/.exec(endpoint))) {
      const result = store.convertLeadToTenant(userId, m[1], deviceName);
      return { ok: true, status: 201, data: { ...result }, entityType: 'leads', entityId: m[1] };
    }
    if (method === 'POST' && (m = /^\/api\/lead-escalations\/([^/]+)\/decision$/.exec(endpoint))) {
      const escalation = store.decideLeadEscalation(
        userId,
        m[1],
        { decision: body.decision, decisionNotes: body.decisionNotes, isToken: false },
        deviceName
      );
      return { ok: true, status: 200, data: { escalation }, entityType: 'leadEscalations', entityId: escalation.id };
    }
    if (method === 'POST' && endpoint === '/api/contracts') {
      const result = store.createContract(userId, body as any, deviceName);
      return { ok: true, status: 201, data: { ...result }, entityType: 'contracts', entityId: result.contract.id };
    }
    if (method === 'PATCH' && (m = /^\/api\/contracts\/([^/]+)$/.exec(endpoint))) {
      const contract = store.updateContractDetails(userId, m[1], body, deviceName);
      return { ok: true, status: 200, data: { contract }, entityType: 'contracts', entityId: contract.id };
    }
    if (method === 'PATCH' && (m = /^\/api\/contracts\/([^/]+)\/ejar$/.exec(endpoint))) {
      const contract = store.updateContractEjarStatus(
        userId,
        m[1],
        body.ejarNumber,
        body.ejarStatus,
        body.lifecycleStatus,
        deviceName
      );
      return { ok: true, status: 200, data: { contract }, entityType: 'contracts', entityId: contract.id };
    }
    if (method === 'POST' && (m = /^\/api\/contracts\/([^/]+)\/renew$/.exec(endpoint))) {
      const result = store.renewContract(userId, m[1], body as any, deviceName);
      return { ok: true, status: 201, data: { ...result }, entityType: 'contracts', entityId: result.contract.id };
    }
    if (method === 'POST' && endpoint === '/api/handovers') {
      const handover = store.createHandoverInspection(userId, body as any, deviceName);
      return { ok: true, status: 201, data: { handover }, entityType: 'handovers', entityId: handover.id };
    }
    if (method === 'POST' && (m = /^\/api\/handovers\/([^/]+)\/approve$/.exec(endpoint))) {
      const handover = store.approveHandover(userId, m[1], body.nextUnitStatus, deviceName);
      return { ok: true, status: 200, data: { handover }, entityType: 'handovers', entityId: handover.id };
    }
    if (method === 'POST' && endpoint === '/api/payments') {
      const idempotencyKey =
        input.idempotencyKey || String(body.idempotencyKey || input.operationId || `sync-${Date.now()}`);
      const payment = store.recordPayment(userId, { ...(body as any), idempotencyKey }, deviceName);
      return { ok: true, status: 201, data: { payment }, entityType: 'payments', entityId: payment.id };
    }
    if (method === 'POST' && (m = /^\/api\/payments\/([^/]+)\/reverse$/.exec(endpoint))) {
      const payment = store.reverseReceipt(userId, m[1], body.reason, deviceName);
      return { ok: true, status: 200, data: { payment }, entityType: 'payments', entityId: payment.id };
    }
    if (method === 'POST' && endpoint === '/api/expenses') {
      const expense = store.createExpense(userId, body as any, deviceName);
      return { ok: true, status: 201, data: { expense }, entityType: 'expenses', entityId: expense.id };
    }
    if (method === 'PATCH' && (m = /^\/api\/expenses\/([^/]+)$/.exec(endpoint))) {
      const expense = store.updateOrCancelExpense(userId, m[1], body as any, deviceName);
      return { ok: true, status: 200, data: { expense }, entityType: 'expenses', entityId: expense.id };
    }
    if (method === 'POST' && (m = /^\/api\/expenses\/([^/]+)\/decision$/.exec(endpoint))) {
      const expense = store.decideExpense(userId, m[1], body.decision, body.reason, deviceName);
      return { ok: true, status: 200, data: { expense }, entityType: 'expenses', entityId: expense.id };
    }
    if (method === 'POST' && endpoint === '/api/tickets') {
      const ticket = store.createTicket(userId, body as any, deviceName);
      return { ok: true, status: 201, data: { ticket }, entityType: 'tickets', entityId: ticket.id };
    }
    if (method === 'PATCH' && (m = /^\/api\/tickets\/([^/]+)$/.exec(endpoint))) {
      const ticket = store.updateTicket(userId, m[1], body, deviceName);
      return { ok: true, status: 200, data: { ticket }, entityType: 'tickets', entityId: ticket.id };
    }
    if (method === 'POST' && endpoint === '/api/tasks') {
      const task = store.createTask(userId, body as any, deviceName);
      return { ok: true, status: 201, data: { task }, entityType: 'tasks', entityId: task.id };
    }
    if (method === 'PATCH' && (m = /^\/api\/tasks\/([^/]+)$/.exec(endpoint))) {
      const task = store.updateTask(userId, m[1], body, deviceName);
      return { ok: true, status: 200, data: { task }, entityType: 'tasks', entityId: task.id };
    }
    if (method === 'POST' && (m = /^\/api\/tasks\/([^/]+)\/reassign$/.exec(endpoint))) {
      const task = store.reassignTask(userId, m[1], String(body.assignedTo || ''), body.reason, deviceName);
      return { ok: true, status: 200, data: { task }, entityType: 'tasks', entityId: task.id };
    }
    if (method === 'POST' && (m = /^\/api\/tasks\/([^/]+)\/review$/.exec(endpoint))) {
      const task = store.reviewTask(
        userId,
        m[1],
        body.decision === 'reject' ? 'reject' : 'approve',
        body.reason,
        deviceName
      );
      return { ok: true, status: 200, data: { task }, entityType: 'tasks', entityId: task.id };
    }
    if (method === 'POST' && endpoint === '/api/communications') {
      const log = store.addCommunication(userId, body as any, deviceName);
      return { ok: true, status: 201, data: { log }, entityType: 'communications', entityId: log.id };
    }
    if (method === 'POST' && endpoint === '/api/documents') {
      const doc = store.addDocument(userId, body as any, deviceName);
      return { ok: true, status: 201, data: { doc }, entityType: 'documents', entityId: doc.id };
    }
    if (method === 'POST' && (m = /^\/api\/documents\/([^/]+)\/access$/.exec(endpoint))) {
      const doc = store.recordDocumentAccess(userId, m[1], body.action || 'معاينة', deviceName);
      return { ok: true, status: 200, data: { doc }, entityType: 'documents', entityId: doc.id };
    }
    if (method === 'POST' && endpoint === '/api/vendors') {
      const vendor = store.createVendor(userId, body as any, deviceName);
      return { ok: true, status: 201, data: { vendor }, entityType: 'vendors', entityId: vendor.id };
    }
    if (method === 'PATCH' && (m = /^\/api\/vendors\/([^/]+)$/.exec(endpoint))) {
      const vendor = store.updateVendor(userId, m[1], body, deviceName);
      return { ok: true, status: 200, data: { vendor }, entityType: 'vendors', entityId: vendor.id };
    }
    if (method === 'POST' && endpoint === '/api/permissions/toggle') {
      const rolePermissions = store.toggleRolePermission(userId, body.role, body.permission, deviceName);
      return { ok: true, status: 200, data: { rolePermissions }, entityType: 'rolePermissions', entityId: String(body.role) };
    }
    if (method === 'POST' && endpoint === '/api/notifications/read') {
      store.markNotificationsRead(userId);
      return { ok: true, status: 200, data: { ok: true } };
    }
    if (method === 'POST' && endpoint === '/api/companies') {
      const company = store.createCompany(userId, body as any, deviceName);
      return { ok: true, status: 201, data: { company }, entityType: 'companies', entityId: company.id };
    }
    if (method === 'PATCH' && endpoint === '/api/settings') {
      const settings = store.updateSettings(userId, body, deviceName);
      return { ok: true, status: 200, data: { settings }, entityType: 'settings', entityId: 'company' };
    }
    if (method === 'POST' && endpoint === '/api/reminders/rules') {
      const rule = store.createReminderRule(userId, body as any, deviceName);
      return { ok: true, status: 201, data: { rule }, entityType: 'reminderRules', entityId: rule.id };
    }
    if (method === 'PATCH' && (m = /^\/api\/reminders\/rules\/([^/]+)$/.exec(endpoint))) {
      const rule = store.toggleReminderRule(userId, m[1], Boolean(body.enabled), deviceName);
      return { ok: true, status: 200, data: { rule }, entityType: 'reminderRules', entityId: rule.id };
    }
    if (method === 'DELETE' && (m = /^\/api\/reminders\/rules\/([^/]+)$/.exec(endpoint))) {
      store.deleteReminderRule(userId, m[1], deviceName);
      return { ok: true, status: 200, data: { ok: true }, entityType: 'reminderRules', entityId: m[1] };
    }
    if (method === 'POST' && endpoint === '/api/reminders/run') {
      const result = store.runReminderScheduler(userId, body as any);
      return { ok: true, status: 200, data: { ...result } };
    }
    if (method === 'POST' && (m = /^\/api\/owners\/([^/]+)\/transfer$/.exec(endpoint))) {
      const result = store.recordOwnerTransfer(userId, m[1], body as any, deviceName);
      return { ok: true, status: 201, data: { ...result }, entityType: 'owners', entityId: m[1] };
    }
    if (method === 'POST' && endpoint === '/api/purchase-orders') {
      const po = store.createPurchaseOrder(userId, body as any, deviceName);
      return { ok: true, status: 201, data: { po }, entityType: 'purchaseOrders', entityId: po.id };
    }
    if (method === 'PATCH' && (m = /^\/api\/purchase-orders\/([^/]+)$/.exec(endpoint))) {
      const po = store.updatePurchaseOrder(userId, m[1], body, deviceName);
      return { ok: true, status: 200, data: { po }, entityType: 'purchaseOrders', entityId: po.id };
    }
    if (method === 'POST' && endpoint === '/api/decisions') {
      const decision = store.createDecision(userId, body as any, deviceName);
      return { ok: true, status: 201, data: { decision }, entityType: 'decisions', entityId: decision.id };
    }
    if (method === 'POST' && endpoint === '/api/archive/move') {
      const result = store.archiveEntity(userId, body as any, deviceName);
      return { ok: true, status: 200, data: { ...result }, entityType: String(body.category || 'archive'), entityId: String(body.id || '') };
    }
    if (method === 'POST' && endpoint === '/api/archive/restore') {
      const result = store.restoreArchivedEntity(userId, body as any, deviceName);
      return { ok: true, status: 200, data: { ...result }, entityType: String(body.category || 'archive'), entityId: String(body.id || '') };
    }
    if (method === 'POST' && endpoint === '/api/archive/filters') {
      const filter = store.saveArchiveFilter(userId, body as any, deviceName);
      return { ok: true, status: 201, data: { filter }, entityType: 'savedArchiveFilters', entityId: filter.id };
    }
    if (method === 'DELETE' && (m = /^\/api\/archive\/filters\/([^/]+)$/.exec(endpoint))) {
      store.deleteArchiveFilter(userId, m[1]);
      return { ok: true, status: 200, data: { ok: true }, entityType: 'savedArchiveFilters', entityId: m[1] };
    }
    if (method === 'POST' && endpoint === '/api/team/users') {
      const user = store.createStaffUser(userId, body as any, deviceName);
      return { ok: true, status: 201, data: { user }, entityType: 'users', entityId: user.id };
    }
    if (method === 'PATCH' && (m = /^\/api\/team\/users\/([^/]+)$/.exec(endpoint))) {
      const user = store.updateStaffUser(userId, m[1], body, deviceName);
      return { ok: true, status: 200, data: { user }, entityType: 'users', entityId: user.id };
    }
    if (method === 'DELETE' && (m = /^\/api\/team\/users\/([^/]+)$/.exec(endpoint))) {
      const result = store.deleteStaffUser(userId, m[1], deviceName);
      return { ok: true, status: 200, data: { ...result }, entityType: 'users', entityId: m[1] };
    }
    if (method === 'PATCH' && endpoint === '/api/team/security-policy') {
      const securityPolicy = store.updateSecurityPolicy(userId, body, deviceName);
      return { ok: true, status: 200, data: { securityPolicy }, entityType: 'securityPolicy', entityId: 'policy' };
    }
    if (method === 'POST' && endpoint === '/api/templates') {
      const template = store.createTemplate(userId, body as any, deviceName);
      return { ok: true, status: 201, data: { template }, entityType: 'communicationTemplates', entityId: template.id };
    }
    if (method === 'PATCH' && (m = /^\/api\/templates\/([^/]+)$/.exec(endpoint))) {
      const template = store.updateTemplate(userId, m[1], body, deviceName);
      return { ok: true, status: 200, data: { template }, entityType: 'communicationTemplates', entityId: template.id };
    }
    if (method === 'DELETE' && (m = /^\/api\/templates\/([^/]+)$/.exec(endpoint))) {
      store.deleteTemplate(userId, m[1], deviceName);
      return { ok: true, status: 200, data: { ok: true }, entityType: 'communicationTemplates', entityId: m[1] };
    }
    if (method === 'POST' && (m = /^\/api\/templates\/([^/]+)\/use$/.exec(endpoint))) {
      const result = store.useTemplate(userId, m[1], body as any, deviceName);
      return { ok: true, status: 200, data: { ...result }, entityType: 'communicationTemplates', entityId: m[1] };
    }
    if (method === 'POST' && endpoint === '/api/supplier-invoices') {
      const invoice = store.createSupplierInvoice(userId, body as any, deviceName);
      return { ok: true, status: 201, data: { invoice }, entityType: 'supplierInvoices', entityId: invoice.id };
    }
    if (method === 'PATCH' && (m = /^\/api\/supplier-invoices\/([^/]+)$/.exec(endpoint))) {
      const invoice = store.updateSupplierInvoice(userId, m[1], body, deviceName);
      return { ok: true, status: 200, data: { invoice }, entityType: 'supplierInvoices', entityId: invoice.id };
    }
    if (method === 'POST' && endpoint === '/api/recurring-expenses') {
      const rule = store.createRecurringExpense(userId, body as any, deviceName);
      return { ok: true, status: 201, data: { rule }, entityType: 'recurringExpenses', entityId: rule.id };
    }
    if (method === 'PATCH' && (m = /^\/api\/recurring-expenses\/([^/]+)$/.exec(endpoint))) {
      const rule = store.toggleRecurringExpense(userId, m[1], Boolean(body.enabled), deviceName);
      return { ok: true, status: 200, data: { rule }, entityType: 'recurringExpenses', entityId: rule.id };
    }
    if (method === 'POST' && endpoint === '/api/property-budgets') {
      const budget = store.upsertPropertyBudget(userId, body as any, deviceName);
      return { ok: true, status: 201, data: { budget }, entityType: 'propertyBudgets', entityId: budget.id };
    }
    if (method === 'POST' && endpoint === '/api/meters/readings') {
      const reading = store.createMeterReading(userId, body as any, deviceName);
      return { ok: true, status: 201, data: { reading }, entityType: 'meterReadings', entityId: reading.id };
    }
    if (method === 'POST' && endpoint === '/api/zatca/invoices') {
      const invoice = store.createZatcaInvoice(userId, body as any, deviceName);
      return { ok: true, status: 201, data: { invoice }, entityType: 'zatcaInvoices', entityId: invoice.id };
    }
    if (method === 'POST' && endpoint === '/api/reports/schedules') {
      const schedule = store.createScheduledReport(userId, body as any, deviceName);
      return { ok: true, status: 201, data: { schedule }, entityType: 'scheduledReports', entityId: schedule.id };
    }
    if (method === 'DELETE' && (m = /^\/api\/reports\/schedules\/([^/]+)$/.exec(endpoint))) {
      const result = store.deleteScheduledReport(userId, m[1], deviceName);
      return { ok: true, status: 200, data: { ...result }, entityType: 'scheduledReports', entityId: m[1] };
    }
    if (method === 'POST' && endpoint === '/api/reports/favorites') {
      const preset = store.saveFavoriteReport(userId, body as any, deviceName);
      return { ok: true, status: 201, data: { preset }, entityType: 'favoriteReports', entityId: preset.id };
    }
    if (method === 'DELETE' && (m = /^\/api\/reports\/favorites\/([^/]+)$/.exec(endpoint))) {
      const result = store.deleteFavoriteReport(userId, m[1]);
      return { ok: true, status: 200, data: { ...result }, entityType: 'favoriteReports', entityId: m[1] };
    }
    if (method === 'POST' && endpoint === '/api/search/filters') {
      const filter = store.saveSharedSearchFilter(userId, body as any, deviceName);
      return { ok: true, status: 201, data: { filter }, entityType: 'sharedSearchFilters', entityId: filter.id };
    }
    if (method === 'DELETE' && (m = /^\/api\/search\/filters\/([^/]+)$/.exec(endpoint))) {
      const result = store.deleteSharedSearchFilter(userId, m[1]);
      return { ok: true, status: 200, data: { ...result }, entityType: 'sharedSearchFilters', entityId: m[1] };
    }

    return {
      ok: false,
      status: 404,
      data: { error: `نقطة النهاية غير مدعومة للمزامنة (${method} ${endpoint})` },
    };
  } catch (err: unknown) {
    return {
      ok: false,
      status: 400,
      data: { error: (err as Error).message },
    };
  }
}
