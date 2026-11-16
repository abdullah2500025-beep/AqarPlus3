import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const TMP_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'aqarplus-auth-'));
const TEST_PORT = 3461;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

process.env.NODE_ENV = 'production';
process.env.AQARPLUS_NO_AUTO_START = '1';
process.env.AQARPLUS_USER_DATA_DIR = TMP_DATA_DIR;
process.env.AQARPLUS_DIST_DIR = path.resolve(process.cwd(), 'dist');
process.env.AQAR_LOCAL_RECOVERY_PREVIEW = 'true';
process.env.AQAR_AUTH_RATE_LIMIT_MAX = '55';

async function startEmbedded(port) {
  const entry = path.resolve(process.cwd(), 'dist-server', 'server.mjs');
  const mod = await import(`${pathToFileURL(entry).href}?t=${Date.now()}`);
  return mod.startServer(port);
}

async function runAuthSuite() {
  console.log(`\n[Verify Auth] Using isolated SQLite WAL directory: ${TMP_DATA_DIR}`);
  const started = await startEmbedded(TEST_PORT);

  try {
    // 1. Wrong password & unknown user must yield uniform non-enumerating 401
    const badKnownRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'owner.sys@aqarplus.sa', password: 'WrongPassword!' }),
    });
    assert.equal(badKnownRes.status, 401);
    const badKnownJson = await badKnownRes.json();

    const badUnknownRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'nobody@aqarplus.sa', password: 'WrongPassword!' }),
    });
    assert.equal(badUnknownRes.status, 401);
    const badUnknownJson = await badUnknownRes.json();
    assert.equal(badKnownJson.error, badUnknownJson.error, 'Login errors must be non-enumerating');
    console.log('✓ 1. Non-enumerating invalid credential response verified');

    // 2. Owner login (Desktop appType) + role landing route + session/refresh cookie flags
    const ownerRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'owner.sys@aqarplus.sa',
        password: 'Aqar@2026',
        rememberMe: true,
        appType: 'desktop',
        deviceId: 'dev-desktop-01',
        deviceName: 'AqarPlus Desktop Windows',
      }),
    });
    assert.equal(ownerRes.status, 200);
    const ownerCookie = ownerRes.headers.get('set-cookie') || '';
    assert.ok(ownerCookie.includes('Max-Age='), 'rememberMe=true must set Max-Age cookie');
    const ownerAuth = await ownerRes.json();
    assert.equal(ownerAuth.landingNav?.nav, 'dashboard');
    assert.ok(ownerAuth.token && ownerAuth.refreshToken);

    const ownerHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerAuth.token}`,
      'x-device-id': 'dev-desktop-01',
    };

    // Session-only login (rememberMe: false) omits Max-Age and omits persistent refreshToken
    const tempWebRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'owner.sys@aqarplus.sa',
        password: 'Aqar@2026',
        rememberMe: false,
        appType: 'web',
        deviceId: 'dev-web-temp',
        deviceName: 'Web Safari Temp',
      }),
    });
    assert.equal(tempWebRes.status, 200);
    const tempWebCookie = tempWebRes.headers.get('set-cookie') || '';
    assert.ok(!tempWebCookie.includes('Max-Age='), 'rememberMe=false must issue session cookie without Max-Age');
    const tempWebJson = await tempWebRes.json();
    assert.ok(!tempWebJson.refreshToken, 'rememberMe=false must not issue persistent refreshToken');

    // Verify /api/profile/sessions reports both desktop & web appType with createdAt & lastSeenAt
    const ownerSessionsRes = await fetch(`${BASE_URL}/api/profile/sessions`, { headers: ownerHeaders });
    assert.equal(ownerSessionsRes.status, 200);
    const ownerSessionsJson = await ownerSessionsRes.json();
    assert.ok(ownerSessionsJson.sessions.some((s) => s.appType === 'desktop' && s.isCurrent));
    assert.ok(ownerSessionsJson.sessions.some((s) => s.appType === 'web' && s.rememberMe === false));
    assert.ok(ownerSessionsJson.sessions.every((s) => Boolean(s.createdAt && s.lastSeenAt)));

    // Revoke the temporary web session explicitly and verify it returns 401
    const tempSessionRow = ownerSessionsJson.sessions.find((s) => s.appType === 'web' && !s.isCurrent);
    assert.ok(tempSessionRow);
    const revokeTempRes = await fetch(`${BASE_URL}/api/profile/sessions/${tempSessionRow.sessionId}`, {
      method: 'DELETE',
      headers: ownerHeaders,
    });
    assert.equal(revokeTempRes.status, 200);
    const deadTempCheck = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tempWebJson.token}` },
    });
    assert.equal(deadTempCheck.status, 401, 'Revoked session token must immediately fail with 401');
    console.log('✓ 2. Remember-Me flags, desktop/web session metadata, and single-session revocation verified');

    // 3. Create Accountant & Technician employees via invitation & verify normalized phone + landing routes
    const accEmpRes = await fetch(`${BASE_URL}/api/team/employees`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        nameAr: 'فهد المحاسب',
        jobTitle: 'محاسب أول',
        department: 'المالية',
        phone: '0557778899',
        email: 'fahad.acc@aqarplus.sa',
        username: 'fahad.acc',
        role: 'accountant',
        channel: 'email',
      }),
    });
    assert.equal(accEmpRes.status, 201);
    const accEmp = await accEmpRes.json();
    const accToken = new URL(accEmp.inviteUrl).searchParams.get('inviteToken');
    const accAccept = await fetch(`${BASE_URL}/api/public/invitations/${encodeURIComponent(accToken)}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        verificationCode: accEmp.verificationCode,
        password: 'FahadPassword!26',
        confirmPassword: 'FahadPassword!26',
        pin: '246810', // 6-digit PIN
        acceptedTerms: true,
      }),
    });
    assert.equal(accAccept.status, 200);

    // Login using normalized +966 phone format, username, and email + verify accountant landing route
    for (const ident of ['0557778899', '+966557778899', '00966557778899', 'fahad.acc', 'fahad.acc@aqarplus.sa']) {
      const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: ident, password: 'FahadPassword!26', rememberMe: true }),
      });
      assert.equal(loginRes.status, 200, `Normalized identifier login failed for: ${ident}`);
      const loginJson = await loginRes.json();
      assert.equal(loginJson.landingNav?.nav, 'leasing_finance');
      assert.equal(loginJson.landingNav?.leasingFinanceTab, 'finance');
    }
    console.log('✓ 3. Normalized phone (+966/00966/05), email, username login & role landing route verified');

    // 4. 6-digit PIN login + Disable PIN + Re-enable PIN + Progressive Lockout -> Password Unlock
    const pin6Res = await fetch(`${BASE_URL}/api/auth/login-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'fahad.acc', pin: '246810', rememberMe: true }),
    });
    assert.equal(pin6Res.status, 200);
    const fahadAuth = await pin6Res.json();
    const fahadHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${fahadAuth.token}`,
      'x-device-id': 'dev-fahad-web',
    };

    // Wrong currentPassword must fail on pin-toggle
    const badToggleRes = await fetch(`${BASE_URL}/api/profile/pin-toggle`, {
      method: 'POST',
      headers: fahadHeaders,
      body: JSON.stringify({ enabled: false, currentPassword: 'WrongPassword!' }),
    });
    assert.equal(badToggleRes.status, 400);

    // Disable PIN with correct password
    const disablePinRes = await fetch(`${BASE_URL}/api/profile/pin-toggle`, {
      method: 'POST',
      headers: fahadHeaders,
      body: JSON.stringify({ enabled: false, currentPassword: 'FahadPassword!26' }),
    });
    assert.equal(disablePinRes.status, 200);

    const disabledPinAttempt = await fetch(`${BASE_URL}/api/auth/login-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'fahad.acc', pin: '246810' }),
    });
    assert.equal(disabledPinAttempt.status, 401, 'Disabled PIN must be rejected');

    // Re-enable PIN with new 4-digit PIN
    const enablePinRes = await fetch(`${BASE_URL}/api/profile/pin-toggle`, {
      method: 'POST',
      headers: fahadHeaders,
      body: JSON.stringify({ enabled: true, currentPassword: 'FahadPassword!26', newPin: '6543' }),
    });
    assert.equal(enablePinRes.status, 200);

    // Test progressive PIN lockout after repeated wrong PINs
    for (let i = 1; i <= 5; i++) {
      const failPin = await fetch(`${BASE_URL}/api/auth/login-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'fahad.acc', pin: '0000' }),
      });
      assert.ok(failPin.status === 401 || failPin.status === 429);
    }
    const lockedPinAttempt = await fetch(`${BASE_URL}/api/auth/login-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'fahad.acc', pin: '6543' }),
    });
    assert.ok(
      lockedPinAttempt.status === 401 || lockedPinAttempt.status === 429,
      'After 5 failed PIN attempts, PIN login must be locked requiring password'
    );

    // Password login succeeds and clears PIN lock!
    const unlockByPwd = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'fahad.acc', password: 'FahadPassword!26' }),
    });
    assert.equal(unlockByPwd.status, 200);
    const unlockedPinCheck = await fetch(`${BASE_URL}/api/auth/login-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'fahad.acc', pin: '6543' }),
    });
    assert.equal(unlockedPinCheck.status, 200, 'Successful password login must unlock temporary PIN lockout');
    console.log('✓ 4. PIN enable/disable toggle, progressive lockout, and password unlock verified');

    // 5. Refresh Token Rotation & Replay Detection
    const preRefreshLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'fahad.acc@aqarplus.sa',
        password: 'FahadPassword!26',
        rememberMe: true,
      }),
    });
    assert.equal(preRefreshLogin.status, 200);
    const preRefreshJson = await preRefreshLogin.json();
    const firstRefresh = preRefreshJson.refreshToken;
    assert.ok(firstRefresh);

    const refreshOk = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: firstRefresh }),
    });
    assert.equal(refreshOk.status, 200);
    const refreshOkJson = await refreshOk.json();
    assert.ok(refreshOkJson.token && refreshOkJson.refreshToken);
    assert.notEqual(refreshOkJson.refreshToken, firstRefresh);

    // Replay of rotated firstRefresh MUST fail with 401
    const replayRefresh = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: firstRefresh }),
    });
    assert.equal(replayRefresh.status, 401, 'Old rotated refresh token replay must fail');
    console.log('✓ 5. Refresh token rotation & replay rejection verified');

    // 6. Adaptive 2FA + Trusted Device lifecycle
    const enable2faRes = await fetch(`${BASE_URL}/api/profile/two-factor`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${refreshOkJson.token}`,
      },
      body: JSON.stringify({
        enabled: true,
        currentPassword: 'FahadPassword!26',
        deviceId: 'dev-fahad-trusted-0',
        deviceName: 'Initial Laptop',
        appType: 'web',
      }),
    });
    assert.equal(enable2faRes.status, 200);

    // Login from a NEW untrusted device -> must require MFA
    const mfaPromptRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'fahad.acc@aqarplus.sa',
        password: 'FahadPassword!26',
        deviceId: 'dev-fahad-new-tablet',
        deviceName: 'New iPad Browser',
        appType: 'web',
      }),
    });
    assert.equal(mfaPromptRes.status, 200);
    const mfaPromptJson = await mfaPromptRes.json();
    assert.equal(mfaPromptJson.authenticated, false);
    assert.equal(mfaPromptJson.requiresMfa, true);
    assert.ok(mfaPromptJson.challengeToken && mfaPromptJson.localSimulationCode);

    // Resend MFA code invalidates previous and issues new code
    const mfaResend = await fetch(`${BASE_URL}/api/auth/mfa/resend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeToken: mfaPromptJson.challengeToken }),
    });
    assert.equal(mfaResend.status, 200);
    const mfaResendJson = await mfaResend.json();
    assert.ok(mfaResendJson.localSimulationCode);

    // Wrong MFA code rejected
    const badMfaVerify = await fetch(`${BASE_URL}/api/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeToken: mfaPromptJson.challengeToken,
        code: '000000',
        trustDevice: true,
      }),
    });
    assert.equal(badMfaVerify.status, 400);

    // Valid MFA code with trustDevice: true logs in & trusts device
    const goodMfaVerify = await fetch(`${BASE_URL}/api/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        challengeToken: mfaPromptJson.challengeToken,
        code: mfaResendJson.localSimulationCode,
        trustDevice: true,
      }),
    });
    assert.equal(goodMfaVerify.status, 200);
    const mfaAuthedJson = await goodMfaVerify.json();
    assert.equal(mfaAuthedJson.authenticated, true);

    // Next login from SAME trusted device skips MFA cleanly!
    const trustedNextLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'fahad.acc@aqarplus.sa',
        password: 'FahadPassword!26',
        deviceId: 'dev-fahad-new-tablet',
        deviceName: 'New iPad Browser',
      }),
    });
    assert.equal(trustedNextLogin.status, 200);
    const trustedNextJson = await trustedNextLogin.json();
    assert.equal(trustedNextJson.authenticated, true);
    assert.ok(!trustedNextJson.requiresMfa);

    // List and revoke trusted device -> next login prompts MFA again
    const listTrustedRes = await fetch(`${BASE_URL}/api/profile/trusted-devices`, {
      headers: {
        Authorization: `Bearer ${trustedNextJson.token}`,
        'x-device-id': 'dev-fahad-new-tablet',
      },
    });
    assert.equal(listTrustedRes.status, 200);
    const listTrustedJson = await listTrustedRes.json();
    const currentTrusted = listTrustedJson.devices.find((d) => d.isCurrent);
    assert.ok(currentTrusted);
    const revokeTrustedRes = await fetch(`${BASE_URL}/api/profile/trusted-devices/${currentTrusted.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${trustedNextJson.token}` },
    });
    assert.equal(revokeTrustedRes.status, 200);

    const untrustedAgainLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'fahad.acc@aqarplus.sa',
        password: 'FahadPassword!26',
        deviceId: 'dev-fahad-new-tablet',
      }),
    });
    const untrustedAgainJson = await untrustedAgainLogin.json();
    assert.equal(untrustedAgainJson.requiresMfa, true, 'Revoking trusted device must require MFA again');
    console.log('✓ 6. Adaptive MFA challenge, resend, trust-device bypass, and trust revocation verified');

    // 7. Multi-company Auto-Discovery & Company Selector + Unauthorized Selection Guard
    const betaWsRes = await fetch(`${BASE_URL}/api/workspaces/provision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-workspace-id': 'alpha-rems' },
      body: JSON.stringify({
        workspaceSlug: 'alpha-rems',
        companyNameAr: 'شركة ألفا العقارية',
        adminNameAr: 'مالك النظام - ألفا',
        adminEmail: 'owner.sys@aqarplus.sa', // same email + password exists in default AND alpha-rems
        password: 'Aqar@2026',
        pin: '1234',
      }),
    });
    assert.equal(betaWsRes.status, 201);

    // Provision a third workspace where owner.sys is NOT a member
    const gammaWsRes = await fetch(`${BASE_URL}/api/workspaces/provision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-workspace-id': 'gamma-rems' },
      body: JSON.stringify({
        workspaceSlug: 'gamma-rems',
        companyNameAr: 'شركة جاما العقارية',
        adminNameAr: 'مالك جاما',
        adminEmail: 'gamma.owner@aqarplus.sa',
        password: 'GammaPassword!26',
      }),
    });
    assert.equal(gammaWsRes.status, 201);

    const autoDiscoverRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'owner.sys@aqarplus.sa',
        password: 'Aqar@2026',
        autoDiscover: true,
        rememberMe: true,
      }),
    });
    assert.equal(autoDiscoverRes.status, 200);
    const autoDiscoverJson = await autoDiscoverRes.json();
    assert.equal(autoDiscoverJson.requiresCompanySelection, true);
    assert.ok(autoDiscoverJson.selectionToken);
    assert.equal(autoDiscoverJson.companies.length, 2);

    // Attempting to select gamma-rems with default+alpha selectionToken must fail 403
    const forbiddenCompanyPick = await fetch(`${BASE_URL}/api/auth/select-company`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectionToken: autoDiscoverJson.selectionToken,
        workspaceId: 'gamma-rems',
      }),
    });
    assert.equal(forbiddenCompanyPick.status, 403, 'Unauthorized company selection must be blocked 403');

    // Selecting alpha-rems succeeds cleanly
    const validCompanyPick = await fetch(`${BASE_URL}/api/auth/select-company`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        selectionToken: autoDiscoverJson.selectionToken,
        workspaceId: 'alpha-rems',
      }),
    });
    assert.equal(validCompanyPick.status, 200);
    const alphaAuth = await validCompanyPick.json();
    assert.equal(alphaAuth.workspaceId, 'alpha-rems');
    assert.equal(alphaAuth.authenticated, true);

    // Cross-workspace token check: alpha-rems token rejected on default
    const crossCheck = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: {
        Authorization: `Bearer ${alphaAuth.token}`,
        'x-workspace-id': 'default',
      },
    });
    assert.equal(crossCheck.status, 401);
    console.log('✓ 7. Multi-company auto-discovery, company selection, 403 guard & cross-company isolation verified');

    // 8. Live RBAC /api/auth/me updates & Account Suspension Lockout
    const techCreate = await fetch(`${BASE_URL}/api/team/employees`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        nameAr: 'يوسف الفني',
        jobTitle: 'فني كهرباء',
        department: 'الصيانة',
        phone: '0552211009',
        email: 'yousef.tech@aqarplus.sa',
        role: 'technician',
        channel: 'copy_link',
      }),
    });
    assert.equal(techCreate.status, 201);
    const techJson = await techCreate.json();
    const techInviteToken = new URL(techJson.inviteUrl).searchParams.get('inviteToken');
    await fetch(`${BASE_URL}/api/public/invitations/${encodeURIComponent(techInviteToken)}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        verificationCode: techJson.verificationCode,
        password: 'TechPassword!26',
        confirmPassword: 'TechPassword!26',
        acceptedTerms: true,
      }),
    });

    const techLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'yousef.tech@aqarplus.sa', password: 'TechPassword!26' }),
    });
    assert.equal(techLoginRes.status, 200);
    const techAuth = await techLoginRes.json();
    assert.equal(techAuth.landingNav?.nav, 'maintenance');
    assert.ok(!techAuth.allowedNavs.includes('team'));

    // Grant custom role or module update -> /api/auth/me reflects it live
    const matrixUpdate = await fetch(`${BASE_URL}/api/roles/module-matrix`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        role: 'technician',
        modulePermissions: {
          dashboard: ['view'],
          maintenance: ['view', 'create', 'edit'],
          tasks: ['view', 'create', 'edit'],
          documents: ['view'],
        },
      }),
    });
    assert.equal(matrixUpdate.status, 200);
    const techMeRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${techAuth.token}` },
    });
    assert.equal(techMeRes.status, 200);
    const techMeJson = await techMeRes.json();
    assert.ok(techMeJson.allowedNavs.includes('documents'), 'Live permission update must appear on /api/auth/me');

    // Suspend technician -> /api/auth/me and /api/auth/login immediately reject
    await fetch(`${BASE_URL}/api/team/employees/${techJson.user.id}`, {
      method: 'PATCH',
      headers: ownerHeaders,
      body: JSON.stringify({ accountStatus: 'موقوف' }),
    });
    const suspendedMe = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${techAuth.token}` },
    });
    assert.equal(suspendedMe.status, 401);
    console.log('✓ 8. Role landing routes, live /api/auth/me permissions, and instant suspension lockout verified');

    // 9. Logout & Auth Rate Limiting (429)
    const ownerLogoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: ownerHeaders,
    });
    assert.equal(ownerLogoutRes.status, 200);
    const postLogoutMe = await fetch(`${BASE_URL}/api/auth/me`, { headers: ownerHeaders });
    assert.equal(postLogoutMe.status, 401);

    let hitRateLimit = false;
    for (let i = 0; i < 65; i++) {
      const r = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'rate-check@aqarplus.sa', password: 'WrongPassword!' }),
      });
      if (r.status === 429) {
        hitRateLimit = true;
        break;
      }
    }
    assert.ok(hitRateLimit, 'Exceeding auth attempt threshold must trigger HTTP 429');
    console.log('✓ 9. Logout token invalidation & brute-force rate limiting (429) verified');

    console.log('\n✅ ALL 9 COMPREHENSIVE AUTHENTICATION & SECURITY SUITES PASSED!\n');
  } finally {
    await new Promise((r) => started.server.close(r));
    fs.rmSync(TMP_DATA_DIR, { recursive: true, force: true });
  }
}

runAuthSuite().catch((err) => {
  console.error('❌ Auth verification failed:', err);
  process.exit(1);
});
