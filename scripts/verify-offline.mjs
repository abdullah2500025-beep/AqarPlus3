import assert from 'node:assert/strict';
import { createInitialSeed } from '../server/seed.ts';
import {
  applyOptimisticOfflineMutation,
  extractEntityTarget,
  generateOperationUuid,
} from '../src/utils/optimisticSync.ts';
import {
  getIdbStorageDiagnostics,
  loadCachedStateIdb,
  loadOfflineQueueIdb,
  migrateLegacyLocalStorageToIdb,
  replaceOfflineQueueIdb,
  saveAttachmentIdb,
  saveCachedStateIdb,
} from '../src/utils/indexedDbStorage.ts';

function createMemoryIndexedDb() {
  const databases = new Map();

  function makeReq(executor) {
    const req = {
      result: undefined,
      error: null,
      onsuccess: null,
      onerror: null,
      onupgradeneeded: null,
    };
    queueMicrotask(() => {
      try {
        req.result = executor();
        req.onsuccess?.({ target: req });
      } catch (err) {
        req.error = err;
        req.onerror?.({ target: req });
      }
    });
    return req;
  }

  return {
    open(name) {
      let isNew = false;
      if (!databases.has(name)) {
        databases.set(name, new Map());
        isNew = true;
      }
      const stores = databases.get(name);
      const storeOptions = new Map();
      const dbApi = {
        objectStoreNames: {
          contains: (s) => stores.has(s),
        },
        createObjectStore: (s, opts) => {
          if (!stores.has(s)) stores.set(s, new Map());
          if (opts) storeOptions.set(s, opts);
          return {};
        },
        transaction: (storeName) => {
          const storeMap = stores.get(storeName);
          const opts = storeOptions.get(storeName);
          const tx = {
            oncomplete: null,
            onerror: null,
            objectStore: () => ({
              get: (key) => makeReq(() => storeMap.get(key)),
              put: (val, explicitKey) =>
                makeReq(() => {
                  const key = explicitKey ?? (opts?.keyPath ? val[opts.keyPath] : undefined);
                  if (!key) throw new Error('Missing IDB key');
                  storeMap.set(String(key), structuredClone(val));
                  queueMicrotask(() => tx.oncomplete?.());
                  return key;
                }),
              getAll: () =>
                makeReq(() => {
                  const arr = Array.from(storeMap.values()).map((v) => structuredClone(v));
                  queueMicrotask(() => tx.oncomplete?.());
                  return arr;
                }),
              clear: () =>
                makeReq(() => {
                  storeMap.clear();
                  queueMicrotask(() => tx.oncomplete?.());
                  return undefined;
                }),
              count: () => makeReq(() => storeMap.size),
            }),
          };
          return tx;
        },
      };

      const req = {
        result: dbApi,
        onsuccess: null,
        onerror: null,
        onupgradeneeded: null,
      };
      queueMicrotask(() => {
        if (isNew) req.onupgradeneeded?.({ target: req });
        req.onsuccess?.({ target: req });
      });
      return req;
    },
  };
}

function createMemoryLocalStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      map.set(k, String(v));
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

async function main() {
  console.log('\n[Verify Offline] Testing IndexedDB workspace scoping, legacy migration & optimistic sync...');

  const fakeStorage = createMemoryLocalStorage();
  const fakeIdb = createMemoryIndexedDb();
  globalThis.window = {
    indexedDB: fakeIdb,
    localStorage: fakeStorage,
  };

  // O1. Workspace-scoped IndexedDB snapshot & queue isolation
  const seed = createInitialSeed();
  const seedAlpha = structuredClone(seed);
  seedAlpha.settings.nameAr = 'شركة ألفا أوفلاين';
  const seedBeta = structuredClone(seed);
  seedBeta.settings.nameAr = 'شركة بيتا أوفلاين';
  seedBeta.properties = [];

  await saveCachedStateIdb(seedAlpha, 'company-alpha');
  await saveCachedStateIdb(seedBeta, 'company-beta');

  const loadedAlpha = await loadCachedStateIdb('company-alpha');
  const loadedBeta = await loadCachedStateIdb('company-beta');
  assert.equal(loadedAlpha?.settings.nameAr, 'شركة ألفا أوفلاين');
  assert.equal(loadedBeta?.settings.nameAr, 'شركة بيتا أوفلاين');
  assert.equal(loadedBeta?.properties.length, 0);

  const actor = seed.users[0];
  await replaceOfflineQueueIdb(
    [
      {
        id: 'q-alpha-1',
        operationId: generateOperationUuid(),
        idempotencyKey: 'idem-alpha-1',
        method: 'POST',
        endpoint: '/api/payments',
        body: { contractId: seed.contracts[0].id, amount: 300, paymentType: 'إيجار' },
        descriptionAr: 'سند ألفا',
        descriptionEn: 'Alpha payment',
        queuedAt: '2026-11-15T10:00:00.000Z',
        userId: actor.id,
        deviceName: 'Offline Device A',
      },
    ],
    'company-alpha'
  );
  await replaceOfflineQueueIdb(
    [
      {
        id: 'q-beta-1',
        operationId: generateOperationUuid(),
        idempotencyKey: 'idem-beta-1',
        method: 'POST',
        endpoint: '/api/tickets',
        body: { title: 'بلاغ بيتا' },
        descriptionAr: 'صيانة بيتا',
        descriptionEn: 'Beta ticket',
        queuedAt: '2026-11-15T10:01:00.000Z',
        userId: actor.id,
        deviceName: 'Offline Device B',
      },
    ],
    'company-beta'
  );

  const alphaQ = await loadOfflineQueueIdb('company-alpha');
  const betaQ = await loadOfflineQueueIdb('company-beta');
  assert.equal(alphaQ.length, 1);
  assert.equal(alphaQ[0].id, 'q-alpha-1');
  assert.equal(betaQ.length, 1);
  assert.equal(betaQ[0].id, 'q-beta-1');
  console.log('✓ O1. IndexedDB snapshots & offline queues strictly isolated per company workspace');

  // O2. Legacy localStorage safe migration + deduplication into IndexedDB
  fakeStorage.setItem('aqarplus_cached_state_v1', JSON.stringify(seed));
  fakeStorage.setItem(
    'aqarplus_offline_queue_v1',
    JSON.stringify([
      {
        id: 'legacy-1',
        idempotencyKey: 'legacy-idem-1',
        method: 'PATCH',
        endpoint: `/api/tenants/${seed.tenants[0].id}`,
        body: { notes: 'Migrated offline edit' },
        descriptionAr: 'تعديل مستأجر',
        descriptionEn: 'Tenant edit',
        queuedAt: '2026-11-15T09:00:00.000Z',
        userId: actor.id,
        deviceName: 'Legacy Tab',
      },
    ])
  );
  const migrated = await migrateLegacyLocalStorageToIdb();
  assert.ok(migrated.migratedState);
  assert.equal(migrated.migratedQueue.length, 1);
  assert.equal(fakeStorage.getItem('aqarplus_cached_state_v1'), null);
  assert.equal(fakeStorage.getItem('aqarplus_offline_queue_v1'), null);
  await saveAttachmentIdb('att-1', 'data:text/plain;base64,QQ==', 'text/plain');
  const diag = await getIdbStorageDiagnostics('company-alpha');
  assert.equal(diag.supported, true);
  assert.equal(diag.hasCachedSnapshot, true);
  assert.equal(diag.queuedCount, 1);
  assert.equal(diag.attachmentsCount, 1);
  console.log('✓ O2. Legacy localStorage migration, attachment persistence & IDB diagnostics verified');

  // O3. Optimistic offline mutation + entity target extraction for conflict detection
  const target = extractEntityTarget(`/api/tenants/${seed.tenants[0].id}`, {});
  assert.deepEqual(target, { entityType: 'tenants', entityId: seed.tenants[0].id });

  const prevCount = seed.payments.length;
  const targetContract =
    seed.contracts.find((c) =>
      seed.installments.some((i) => i.contractId === c.id && i.remainingAmount > 0 && i.status !== 'ملغاة')
    ) || seed.contracts[0];
  const openBefore = seed.installments
    .filter((i) => i.contractId === targetContract.id && i.remainingAmount > 0)
    .reduce((s, i) => s + i.remainingAmount, 0);
  assert.ok(openBefore >= 1000, 'Seed must contain at least one contract with >= 1000 remaining installment');

  const afterPay = applyOptimisticOfflineMutation(
    seed,
    'POST',
    '/api/payments',
    { contractId: targetContract.id, amount: 1000, paymentType: 'إيجار', paymentMethod: 'نقدي' },
    actor,
    'idem-offline-pay-1'
  );
  assert.equal(afterPay.payments.length, prevCount + 1);
  assert.equal(afterPay.payments[0].idempotencyKey, 'idem-offline-pay-1');
  const openAfter = afterPay.installments
    .filter((i) => i.contractId === targetContract.id && i.remainingAmount > 0)
    .reduce((s, i) => s + i.remainingAmount, 0);
  assert.equal(Math.round((openBefore - openAfter) * 100) / 100, 1000);
  console.log('✓ O3. Optimistic offline receipt allocation & target revision extraction verified');

  console.log('\n✅ ALL 3 OFFLINE INDEXEDDB & OPTIMISTIC SYNC CHECKS PASSED!\n');
}

main().catch((err) => {
  console.error('❌ Offline verification failed:', err);
  process.exit(1);
});
