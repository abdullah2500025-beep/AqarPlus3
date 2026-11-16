import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 8791;
      srv.close(() => resolve(port));
    });
  });
}

const WORKER_PORT = await getFreePort();
const BASE_URL = `http://127.0.0.1:${WORKER_PORT}`;
const TMP_PERSIST = fs.mkdtempSync(path.join(os.tmpdir(), 'aqarplus-wrangler-'));

async function waitForWorkerReady(proc) {
  for (let i = 0; i < 45; i++) {
    if (proc.exitCode !== null) {
      throw new Error(`wrangler dev exited prematurely with code ${proc.exitCode}`);
    }
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return res.json();
    } catch {
      // still booting
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('Timed out waiting for wrangler dev on port ' + WORKER_PORT);
}

async function main() {
  console.log(`\n[Verify Worker] Starting local Cloudflare workerd + Durable Objects SQLite on port ${WORKER_PORT}...`);

  const wranglerBin = path.resolve(process.cwd(), 'node_modules', 'wrangler', 'bin', 'wrangler.js');
  const wranglerProc = spawn(
    process.execPath,
    [wranglerBin, 'dev', '--local', '--port', String(WORKER_PORT), '--persist-to', TMP_PERSIST, '--show-interactive-dev-session=false'],
    {
      cwd: process.cwd(),
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, CI: 'true', WRANGLER_SEND_METRICS: 'false' },
    }
  );

  let logs = '';
  wranglerProc.stdout.on('data', (d) => { logs += d.toString(); });
  wranglerProc.stderr.on('data', (d) => { logs += d.toString(); });

  try {
    const health = await waitForWorkerReady(wranglerProc);
    assert.equal(health.ok, true);
    assert.equal(health.runtime, 'cloudflare-workers-durable-objects');
    assert.equal(health.storageEngine, 'do-sqlite-normalized');
    console.log('✓ W1. Cloudflare Worker & normalized DO SQLite runtime confirmed');

    // W2. Verify Static PWA assets + Demo Login disabled by default + 401 guard
    const htmlRes = await fetch(`${BASE_URL}/`);
    assert.equal(htmlRes.status, 200);
    const htmlText = await htmlRes.text();
    assert.ok(htmlText.includes('<div id="root">'), 'SPA index.html must be served from ASSETS');

    const manifestRes = await fetch(`${BASE_URL}/manifest.webmanifest`);
    assert.equal(manifestRes.status, 200);

    const sessionRes = await fetch(`${BASE_URL}/api/auth/session`);
    const sessionJson = await sessionRes.json();
    assert.equal(sessionJson.demoLoginEnabled, false, 'Worker AQAR_DEMO_LOGIN must default to false');
    assert.deepEqual(sessionJson.loginProfiles, [], 'Worker must not enumerate users');

    const unauthState = await fetch(`${BASE_URL}/api/state`);
    assert.equal(unauthState.status, 401);
    console.log('✓ W2. Worker static PWA assets served, Demo Login disabled, unauthenticated access blocked (401)');

    // W3. Multi-Company Workspace Isolation (Company Alpha vs Company Beta)
    const provAlphaRes = await fetch(`${BASE_URL}/api/workspaces/provision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-workspace-id': 'company-alpha' },
      body: JSON.stringify({
        workspaceSlug: 'company-alpha',
        companyNameAr: 'شركة ألفا العقارية',
        adminNameAr: 'أحمد ألفا',
        adminEmail: 'alpha@aqarplus.sa',
        password: 'AlphaStrongPassword!99',
        pin: '2468',
      }),
    });
    assert.equal(provAlphaRes.status, 201);
    const alphaAuth = await provAlphaRes.json();
    assert.equal(alphaAuth.workspaceId, 'company-alpha');
    assert.equal(alphaAuth.state.properties.length, 0, 'Fresh provisioned company must have 0 leaked properties');

    const provBetaRes = await fetch(`${BASE_URL}/api/workspaces/provision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-workspace-id': 'company-beta' },
      body: JSON.stringify({
        workspaceSlug: 'company-beta',
        companyNameAr: 'شركة بيتا العقارية',
        adminNameAr: 'سعد بيتا',
        adminEmail: 'beta@aqarplus.sa',
        password: 'BetaStrongPassword!99',
      }),
    });
    assert.equal(provBetaRes.status, 201);
    const betaAuth = await provBetaRes.json();
    assert.equal(betaAuth.workspaceId, 'company-beta');

    // Re-provisioning existing workspace must fail with 409
    const hijackRes = await fetch(`${BASE_URL}/api/workspaces/provision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-workspace-id': 'company-alpha' },
      body: JSON.stringify({
        workspaceSlug: 'company-alpha',
        companyNameAr: 'شركة مزورة',
        adminNameAr: 'مخترق',
        adminEmail: 'hacker@evil.com',
        password: 'Password1234',
      }),
    });
    assert.equal(hijackRes.status, 409);

    // Cross-workspace token replay must fail with 401
    const crossReplay = await fetch(`${BASE_URL}/api/state`, {
      headers: {
        Authorization: `Bearer ${alphaAuth.token}`,
        'x-workspace-id': 'company-beta',
      },
    });
    assert.equal(crossReplay.status, 401, 'Token bound to company-alpha must be rejected by company-beta DO');

    // Create Property, Unit, Tenant, Contract & Payment inside Company Alpha
    const alphaHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${alphaAuth.token}`,
      'x-workspace-id': 'company-alpha',
    };
    const propRes = await fetch(`${BASE_URL}/api/properties`, {
      method: 'POST',
      headers: alphaHeaders,
      body: JSON.stringify({ nameAr: 'برج ألفا التجاري', city: 'الرياض' }),
    }).then((r) => r.json());
    const unitRes = await fetch(`${BASE_URL}/api/units`, {
      method: 'POST',
      headers: alphaHeaders,
      body: JSON.stringify({ propertyId: propRes.property.id, unitNumber: 'A-101', suggestedAnnualRent: 60000 }),
    }).then((r) => r.json());
    const tenRes = await fetch(`${BASE_URL}/api/tenants`, {
      method: 'POST',
      headers: alphaHeaders,
      body: JSON.stringify({ nameAr: 'شركة النخبة', phone: '0500000001' }),
    }).then((r) => r.json());
    const conRes = await fetch(`${BASE_URL}/api/contracts`, {
      method: 'POST',
      headers: alphaHeaders,
      body: JSON.stringify({
        propertyId: propRes.property.id,
        unitId: unitRes.unit.id,
        tenantId: tenRes.tenant.id,
        annualRent: 60000,
      }),
    }).then((r) => r.json());

    // Verify Company Beta still has 0 properties and 0 contracts
    const betaState = await fetch(`${BASE_URL}/api/state`, {
      headers: {
        Authorization: `Bearer ${betaAuth.token}`,
        'x-workspace-id': 'company-beta',
      },
    }).then((r) => r.json());
    assert.equal(betaState.state.properties.length, 0);
    assert.equal(betaState.state.contracts.length, 0);
    console.log('✓ W3. Multi-company DO SQLite isolation & cross-workspace token rejection verified');

    // W4. Offline sync deduplication & conflict detection on Cloudflare DO
    const opId = `cf-op-${Date.now()}`;
    const batch1 = await fetch(`${BASE_URL}/api/sync/batch`, {
      method: 'POST',
      headers: alphaHeaders,
      body: JSON.stringify({
        operations: [
          {
            id: 'q-cf-1',
            operationId: opId,
            idempotencyKey: opId,
            method: 'POST',
            endpoint: '/api/payments',
            body: { contractId: conRes.contract.id, amount: 2500, paymentMethod: 'تحويل بنكي', paymentType: 'إيجار' },
            queuedAt: new Date().toISOString(),
          },
        ],
      }),
    }).then((r) => r.json());
    assert.equal(batch1.uploaded, 1);

    const batchDup = await fetch(`${BASE_URL}/api/sync/batch`, {
      method: 'POST',
      headers: alphaHeaders,
      body: JSON.stringify({
        operations: [
          {
            id: 'q-cf-1',
            operationId: opId,
            idempotencyKey: opId,
            method: 'POST',
            endpoint: '/api/payments',
            body: { contractId: conRes.contract.id, amount: 2500, paymentMethod: 'تحويل بنكي', paymentType: 'إيجار' },
            queuedAt: new Date().toISOString(),
          },
        ],
      }),
    }).then((r) => r.json());
    assert.equal(batchDup.uploaded, 0);
    assert.equal(batchDup.skippedDuplicates, 1);

    // Bump tenant revision then replay stale baseRevision=0 -> conflict logged & resolved
    await fetch(`${BASE_URL}/api/tenants/${tenRes.tenant.id}`, {
      method: 'PATCH',
      headers: alphaHeaders,
      body: JSON.stringify({ notes: 'DO edit 1' }),
    });
    await fetch(`${BASE_URL}/api/tenants/${tenRes.tenant.id}`, {
      method: 'PATCH',
      headers: alphaHeaders,
      body: JSON.stringify({ notes: 'DO edit 2' }),
    });
    const confBatch = await fetch(`${BASE_URL}/api/sync/batch`, {
      method: 'POST',
      headers: alphaHeaders,
      body: JSON.stringify({
        operations: [
          {
            id: 'q-cf-conf',
            operationId: `cf-conf-${Date.now()}`,
            method: 'PATCH',
            endpoint: `/api/tenants/${tenRes.tenant.id}`,
            entityType: 'tenants',
            entityId: tenRes.tenant.id,
            baseRevision: 0,
            body: { notes: 'Stale client edit' },
            queuedAt: new Date().toISOString(),
          },
        ],
      }),
    }).then((r) => r.json());
    assert.ok(confBatch.conflictsDetected >= 1);
    console.log('✓ W4. Cloudflare DO sync/batch deduplication & conflict detection verified');

    // W5. Rate-limiting lockout (5 failed attempts -> HTTP 429) on Cloudflare DO
    for (let i = 0; i < 5; i++) {
      await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-workspace-id': 'company-alpha' },
        body: JSON.stringify({ identifier: 'alpha@aqarplus.sa', password: 'WrongPassword!' }),
      });
    }
    const lockedRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-workspace-id': 'company-alpha' },
      body: JSON.stringify({ identifier: 'alpha@aqarplus.sa', password: 'AlphaStrongPassword!99' }),
    });
    assert.equal(lockedRes.status, 429);
    console.log('✓ W5. Cloudflare DO brute-force lockout (5 attempts -> HTTP 429) verified');

    console.log('\n✅ ALL 5 CLOUDFLARE WORKER + DURABLE OBJECT SQLITE VERIFICATION CHECKS PASSED!\n');
  } catch (err) {
    console.error('❌ Worker verification failed:', err);
    console.error('--- Wrangler logs ---\n' + logs);
    process.exitCode = 1;
  } finally {
    if (wranglerProc.pid) {
      try {
        process.kill(-wranglerProc.pid, 'SIGTERM');
      } catch {
        // already exited
      }
      await new Promise((r) => setTimeout(r, 400));
      try {
        process.kill(-wranglerProc.pid, 'SIGKILL');
      } catch {
        // already exited
      }
    }
    try {
      fs.rmSync(TMP_PERSIST, { recursive: true, force: true });
    } catch {
      // ignore cleanup lock on exit
    }
    process.exit(process.exitCode || 0);
  }
}

main();
