import { AqarDatabaseState, StaffUser } from '../types/aqar';

export function generateOperationUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function extractEntityTarget(
  endpoint: string,
  body?: unknown
): { entityType?: string; entityId?: string } {
  const clean = endpoint.split('?')[0];
  let m: RegExpExecArray | null;
  if ((m = /^\/api\/(properties|units|tenants|contracts|payments|expenses|tickets|tasks|vendors|leads|templates|documents)\/([^/]+)/.exec(clean))) {
    const map: Record<string, string> = {
      templates: 'communicationTemplates',
    };
    return { entityType: map[m[1]] || m[1], entityId: m[2] };
  }
  if (clean === '/api/settings') {
    return { entityType: 'settings', entityId: 'company' };
  }
  if (body && typeof body === 'object' && 'id' in body && typeof (body as { id?: unknown }).id === 'string') {
    return { entityType: clean.replace('/api/', ''), entityId: String((body as { id: string }).id) };
  }
  return {};
}

/**
 * Applies optimistic local UI/IndexedDB state updates while offline so users
 * immediately see newly created receipts, tenants, tickets, tasks, or edits
 * before connectivity returns and the sync batch replays against the server.
 */
export function applyOptimisticOfflineMutation(
  prevState: AqarDatabaseState,
  method: 'POST' | 'PATCH' | 'DELETE',
  endpoint: string,
  body: unknown,
  actor: StaffUser,
  idempotencyKey: string
): AqarDatabaseState {
  const next = structuredClone(prevState);
  const payload = (body && typeof body === 'object' ? body : {}) as Record<string, any>;
  const clean = endpoint.split('?')[0];
  const now = new Date().toISOString();
  next.lastUpdatedAt = now;

  if (method === 'PATCH' && clean === '/api/settings') {
    next.settings = { ...next.settings, ...payload };
    return next;
  }

  if (method === 'POST' && clean === '/api/properties') {
    next.properties.unshift({
      ...(payload as any),
      id: `offline-prop-${Date.now().toString(36)}`,
      createdAt: now,
    });
    return next;
  }

  if (method === 'POST' && clean === '/api/units') {
    next.units.unshift({
      ...(payload as any),
      id: `offline-unit-${Date.now().toString(36)}`,
    });
    return next;
  }

  let m: RegExpExecArray | null;
  if (method === 'PATCH' && (m = /^\/api\/units\/([^/]+)\/status$/.exec(clean))) {
    const unit = next.units.find((u) => u.id === m![1]);
    if (unit && payload.status) unit.status = payload.status;
    return next;
  }

  if (method === 'POST' && clean === '/api/tenants') {
    next.tenants.unshift({
      ...(payload as any),
      id: `offline-ten-${Date.now().toString(36)}`,
      rating: 5,
      createdAt: now,
    });
    return next;
  }

  if (method === 'PATCH' && (m = /^\/api\/tenants\/([^/]+)$/.exec(clean))) {
    const t = next.tenants.find((x) => x.id === m![1]);
    if (t) Object.assign(t, payload);
    return next;
  }

  if (method === 'DELETE' && (m = /^\/api\/tenants\/([^/]+)$/.exec(clean))) {
    next.tenants = next.tenants.filter((x) => x.id !== m![1]);
    return next;
  }

  if (method === 'POST' && clean === '/api/payments') {
    next.counters.receipt += 1;
    const contract = next.contracts.find((c) => c.id === payload.contractId);
    const amount = Number(payload.amount || 0);
    if (contract && amount > 0 && payload.paymentType === 'إيجار') {
      let rem = amount;
      const openInsts = next.installments
        .filter((i) => i.contractId === contract.id && i.remainingAmount > 0 && i.status !== 'ملغاة')
        .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      for (const inst of openInsts) {
        if (rem <= 0) break;
        const applied = Math.min(rem, inst.remainingAmount);
        inst.paidAmount = Math.round((inst.paidAmount + applied) * 100) / 100;
        inst.remainingAmount = Math.round((inst.amount - inst.paidAmount) * 100) / 100;
        inst.status = inst.remainingAmount === 0 ? 'مدفوعة بالكامل' : 'مدفوعة جزئياً';
        rem = Math.round((rem - applied) * 100) / 100;
      }
    }
    next.payments.unshift({
      id: `offline-pay-${Date.now().toString(36)}`,
      receiptNumber: `OFFLINE-${String(next.counters.receipt).padStart(4, '0')}`,
      idempotencyKey,
      contractId: String(payload.contractId || ''),
      unitId: contract?.unitId || '',
      propertyId: contract?.propertyId || '',
      tenantId: contract?.tenantId || '',
      allocations: [],
      amount,
      paymentMethod: payload.paymentMethod || 'نقدي',
      paymentType: payload.paymentType || 'إيجار',
      referenceNumber: payload.referenceNumber,
      receivedBy: actor.id,
      deviceName: actor.deviceName || 'Offline Terminal',
      status: 'معتمد',
      notes: payload.notes ? `${payload.notes} (قيد المزامنة)` : 'سند مسجل دون اتصال (قيد المزامنة)',
      createdAt: now,
    });
    return next;
  }

  if (method === 'POST' && clean === '/api/expenses') {
    next.counters.expense += 1;
    next.expenses.unshift({
      ...(payload as any),
      id: `offline-exp-${Date.now().toString(36)}`,
      expenseNumber: `EXP-OFF-${String(next.counters.expense).padStart(4, '0')}`,
      approvalStatus: 'بانتظار المشرف',
      createdBy: actor.id,
      createdAt: now,
    });
    return next;
  }

  if (method === 'POST' && clean === '/api/tickets') {
    next.counters.ticket += 1;
    next.tickets.unshift({
      ...(payload as any),
      id: `offline-tkt-${Date.now().toString(36)}`,
      ticketNumber: `MNT-OFF-${String(next.counters.ticket).padStart(4, '0')}`,
      status: 'جديد',
      createdBy: actor.id,
      createdAt: now,
    });
    return next;
  }

  if (method === 'PATCH' && (m = /^\/api\/tickets\/([^/]+)$/.exec(clean))) {
    const t = next.tickets.find((x) => x.id === m![1]);
    if (t) Object.assign(t, payload);
    return next;
  }

  if (method === 'POST' && clean === '/api/tasks') {
    next.tasks.unshift({
      ...(payload as any),
      id: `offline-tsk-${Date.now().toString(36)}`,
      status: payload.status || 'جديدة',
      checklist: payload.checklist || [],
      comments: [],
      createdBy: actor.id,
      createdAt: now,
    });
    return next;
  }

  if (method === 'PATCH' && (m = /^\/api\/tasks\/([^/]+)$/.exec(clean))) {
    const t = next.tasks.find((x) => x.id === m![1]);
    if (t) Object.assign(t, payload);
    return next;
  }

  if (method === 'POST' && clean === '/api/templates') {
    if (!next.communicationTemplates) next.communicationTemplates = [];
    next.communicationTemplates.unshift({
      ...(payload as any),
      id: `offline-tpl-${Date.now().toString(36)}`,
      usageCount: 0,
      createdBy: actor.id,
      createdAt: now,
    });
    return next;
  }

  if (method === 'DELETE' && (m = /^\/api\/templates\/([^/]+)$/.exec(clean))) {
    next.communicationTemplates = (next.communicationTemplates || []).filter((t) => t.id !== m![1]);
    return next;
  }

  return next;
}
