import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import WebSocket from 'ws';

const TMP_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'aqarplus-workforce-'));
const TEST_PORT = 3459;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

process.env.NODE_ENV = 'production';
process.env.AQARPLUS_NO_AUTO_START = '1';
process.env.AQARPLUS_USER_DATA_DIR = TMP_DATA_DIR;
process.env.AQARPLUS_DIST_DIR = path.resolve(process.cwd(), 'dist');
process.env.AQAR_LOCAL_RECOVERY_PREVIEW = 'true';

async function startEmbedded(port) {
  const entry = path.resolve(process.cwd(), 'dist-server', 'server.mjs');
  const mod = await import(`${pathToFileURL(entry).href}?t=${Date.now()}`);
  return mod.startServer(port);
}

function extractInviteToken(inviteUrl) {
  const u = new URL(inviteUrl);
  return u.searchParams.get('inviteToken');
}

async function runWorkforceVerification() {
  console.log(`\n[Verify Workforce] Using isolated SQLite WAL directory: ${TMP_DATA_DIR}`);
  const started = await startEmbedded(TEST_PORT);

  try {
    // Login as sys_owner
    const ownerLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'owner.sys@aqarplus.sa',
        password: 'Aqar@2026',
        rememberMe: true,
        deviceName: 'Owner Workstation',
      }),
    });
    assert.equal(ownerLoginRes.status, 200);
    const ownerAuth = await ownerLoginRes.json();
    const ownerHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ownerAuth.token}`,
    };

    // Check rememberMe cookie Max-Age presence vs absence
    const rememberCookie = ownerLoginRes.headers.get('set-cookie') || '';
    assert.ok(rememberCookie.includes('Max-Age='), 'rememberMe: true must set Max-Age on session cookie');

    const sessionOnlyRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'owner.sys@aqarplus.sa',
        password: 'Aqar@2026',
        rememberMe: false,
        deviceName: 'Temp Browser',
      }),
    });
    assert.equal(sessionOnlyRes.status, 200);
    const sessionOnlyCookie = sessionOnlyRes.headers.get('set-cookie') || '';
    assert.ok(!sessionOnlyCookie.includes('Max-Age='), 'rememberMe: false must issue session-only cookie without Max-Age');
    console.log('✓ 1. Remember-Me cookie retention vs session-only cookie verified');

    // 2. Employee creation + invitation + pending lockout + wrong code + activation + single-use check
    const createEmpRes = await fetch(`${BASE_URL}/api/team/employees`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        nameAr: 'سارة المنصور',
        nameEn: 'Sara Al-Mansour',
        jobTitle: 'منسقة تأجير أولى',
        department: 'التأجير والمبيعات',
        phone: '0559988771',
        secondaryPhone: '0559988772',
        email: 'sara.mansour@aqarplus.sa',
        username: 'sara.m',
        role: 'leasing',
        channel: 'whatsapp',
      }),
    });
    assert.equal(createEmpRes.status, 201);
    const createdEmp = await createEmpRes.json();
    assert.equal(createdEmp.user.accountStatus, 'بانتظار التفعيل');
    assert.equal(createdEmp.user.active, false);
    assert.ok(createdEmp.inviteUrl && createdEmp.verificationCode);
    const saraToken1 = extractInviteToken(createdEmp.inviteUrl);
    assert.ok(saraToken1);

    // Pending user cannot log in
    const pendingLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'sara.m', password: 'AnyPassword!1' }),
    });
    assert.equal(pendingLogin.status, 401, 'Pending employee must be blocked before invite activation');

    // Invalid token check
    const badInviteInfo = await fetch(`${BASE_URL}/api/public/invitations/invalid-token-999`);
    assert.equal(badInviteInfo.status, 400);

    // Valid token info check
    const goodInviteInfo = await fetch(`${BASE_URL}/api/public/invitations/${encodeURIComponent(saraToken1)}`);
    assert.equal(goodInviteInfo.status, 200);
    const inviteMeta = await goodInviteInfo.json();
    assert.equal(inviteMeta.valid, true);
    assert.equal(inviteMeta.invitation.fullName, 'سارة المنصور');

    // Wrong 6-digit verification code rejected
    const wrongCodeAccept = await fetch(`${BASE_URL}/api/public/invitations/${encodeURIComponent(saraToken1)}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        verificationCode: '000000',
        password: 'SaraStrongPassword!26',
        confirmPassword: 'SaraStrongPassword!26',
        pin: '4321',
        acceptedTerms: true,
      }),
    });
    assert.equal(wrongCodeAccept.status, 400);

    // Valid activation succeeds
    const validAccept = await fetch(`${BASE_URL}/api/public/invitations/${encodeURIComponent(saraToken1)}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        verificationCode: createdEmp.verificationCode,
        password: 'SaraStrongPassword!26',
        confirmPassword: 'SaraStrongPassword!26',
        pin: '4321',
        acceptedTerms: true,
      }),
    });
    assert.equal(validAccept.status, 200);
    const acceptJson = await validAccept.json();
    assert.equal(acceptJson.user.accountStatus, 'نشط');

    // Replay single-use invite token must fail
    const replayAccept = await fetch(`${BASE_URL}/api/public/invitations/${encodeURIComponent(saraToken1)}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        verificationCode: createdEmp.verificationCode,
        password: 'SaraStrongPassword!26',
        confirmPassword: 'SaraStrongPassword!26',
        acceptedTerms: true,
      }),
    });
    assert.equal(replayAccept.status, 400, 'Single-use invite token cannot be reused');
    console.log('✓ 2. Multi-channel invitation creation, pending lockout, wrong code check, and single-use activation verified');

    // 3. Login via username, email, phone & PIN
    for (const identifier of ['sara.m', 'sara.mansour@aqarplus.sa', '0559988771']) {
      const r = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password: 'SaraStrongPassword!26', rememberMe: true }),
      });
      assert.equal(r.status, 200, `Login via identifier (${identifier}) must succeed`);
    }
    const saraPinLogin = await fetch(`${BASE_URL}/api/auth/login-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'sara.m', pin: '4321' }),
    });
    assert.equal(saraPinLogin.status, 200);
    const saraAuth = await saraPinLogin.json();
    const saraHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${saraAuth.token}`,
    };
    console.log('✓ 3. Unified login via username, email, phone, and PIN verified');

    // 4. Resend & Cancel invitation flow on a second employee
    const emp2Res = await fetch(`${BASE_URL}/api/team/employees`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        nameAr: 'نواف الدوسري',
        jobTitle: 'محاسب متابعة',
        department: 'المالية',
        phone: '0554433221',
        email: 'nawaf@aqarplus.sa',
        username: 'nawaf.d',
        role: 'accountant',
        channel: 'email',
      }),
    });
    assert.equal(emp2Res.status, 201);
    const emp2 = await emp2Res.json();
    const oldToken = extractInviteToken(emp2.inviteUrl);

    const resendRes = await fetch(`${BASE_URL}/api/team/invitations/${emp2.invitation.id}/resend`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ channel: 'sms' }),
    });
    assert.equal(resendRes.status, 200);
    const resendJson = await resendRes.json();
    const newToken = extractInviteToken(resendJson.inviteUrl);
    assert.notEqual(newToken, oldToken);

    const oldTokenCheck = await fetch(`${BASE_URL}/api/public/invitations/${encodeURIComponent(oldToken)}`);
    assert.equal(oldTokenCheck.status, 400, 'Old invite token must be invalidated after resend');

    const cancelRes = await fetch(`${BASE_URL}/api/team/invitations/${emp2.invitation.id}/cancel`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({}),
    });
    assert.equal(cancelRes.status, 200);
    const canceledTokenCheck = await fetch(`${BASE_URL}/api/public/invitations/${encodeURIComponent(newToken)}`);
    assert.equal(canceledTokenCheck.status, 400, 'Canceled invite token must be rejected');
    console.log('✓ 4. Invitation resend invalidates previous token and cancel revokes invite link');

    // 5. Personal profile edit + self-escalation block (403) + 2-step email/phone verification
    const selfPatchOk = await fetch(`${BASE_URL}/api/profile/me`, {
      method: 'PATCH',
      headers: saraHeaders,
      body: JSON.stringify({
        nameAr: 'سارة المنصور المطيري',
        secondaryPhone: '0559988779',
      }),
    });
    assert.equal(selfPatchOk.status, 200);

    const selfEscalate = await fetch(`${BASE_URL}/api/profile/me`, {
      method: 'PATCH',
      headers: saraHeaders,
      body: JSON.stringify({ role: 'sys_owner' }),
    });
    assert.equal(selfEscalate.status, 403, 'Attempting to escalate own role via profile must return 403');

    const reqEmailRes = await fetch(`${BASE_URL}/api/profile/verify-contact/request`, {
      method: 'POST',
      headers: saraHeaders,
      body: JSON.stringify({ type: 'email', newValue: 'sara.verified@aqarplus.sa' }),
    });
    assert.equal(reqEmailRes.status, 200);
    const reqEmailJson = await reqEmailRes.json();
    assert.ok(reqEmailJson.localSimulationCode);

    const badVerify = await fetch(`${BASE_URL}/api/profile/verify-contact/confirm`, {
      method: 'POST',
      headers: saraHeaders,
      body: JSON.stringify({ type: 'email', code: '111111' }),
    });
    assert.equal(badVerify.status, 400);

    const goodVerify = await fetch(`${BASE_URL}/api/profile/verify-contact/confirm`, {
      method: 'POST',
      headers: saraHeaders,
      body: JSON.stringify({ type: 'email', code: reqEmailJson.localSimulationCode }),
    });
    assert.equal(goodVerify.status, 200);
    const verifiedUserJson = await goodVerify.json();
    assert.equal(verifiedUserJson.user.email, 'sara.verified@aqarplus.sa');
    console.log('✓ 5. Self-profile update, 403 privilege-escalation block, and 2-step contact verification verified');

    // 6. Changing jobTitle alone NEVER grants permissions
    const jobTitleRes = await fetch(`${BASE_URL}/api/team/employees/${createdEmp.user.id}`, {
      method: 'PATCH',
      headers: ownerHeaders,
      body: JSON.stringify({ jobTitle: 'المدير التنفيذي للعمليات' }),
    });
    assert.equal(jobTitleRes.status, 200);
    const jobTitleJson = await jobTitleRes.json();
    assert.equal(jobTitleJson.user.jobTitle, 'المدير التنفيذي للعمليات');
    assert.equal(jobTitleJson.user.role, 'leasing');

    const forbiddenExpenseRes = await fetch(`${BASE_URL}/api/team/employees/${createdEmp.user.id}`, {
      method: 'PATCH',
      headers: saraHeaders,
      body: JSON.stringify({ jobTitle: 'محاولة غير مصرحة' }),
    });
    assert.equal(forbiddenExpenseRes.status, 403, 'Changing jobTitle must NOT grant team management permissions');
    console.log('✓ 6. jobTitle updates display label only and never alters RBAC enforcement');

    // 7. Custom Role CRUD + protected deletion while assigned + live 18x7 matrix API enforcement
    const customRoleRes = await fetch(`${BASE_URL}/api/roles`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        nameAr: 'مراجع عقود وصيانة مخصص',
        nameEn: 'Custom Lease Auditor',
        baseRoleKey: 'leasing',
        descriptionAr: 'دور اختبار مخصص مع صلاحية إنشاء العقارات',
        modulePermissions: {
          dashboard: ['view'],
          properties: ['view', 'create'],
          units: ['view'],
          tenants: ['view'],
        },
      }),
    });
    assert.equal(customRoleRes.status, 201);
    const customRoleJson = await customRoleRes.json();
    const customRoleId = customRoleJson.role.id;

    // Assign custom role to Sara
    const assignCustomRes = await fetch(`${BASE_URL}/api/team/employees/${createdEmp.user.id}`, {
      method: 'PATCH',
      headers: ownerHeaders,
      body: JSON.stringify({ customRoleId }),
    });
    assert.equal(assignCustomRes.status, 200);

    // Sara can now create a property because custom role allows properties:create
    const saraPropRes = await fetch(`${BASE_URL}/api/properties`, {
      method: 'POST',
      headers: saraHeaders,
      body: JSON.stringify({
        code: 'TST-99',
        nameAr: 'برج الاختبار الصلاحيات',
        nameEn: 'RBAC Test Tower',
        type: 'تجاري',
        city: 'الرياض',
        district: 'العليا',
        ownershipMode: 'مملوك للشركة',
      }),
    });
    assert.equal(saraPropRes.status, 201, 'Custom role permission properties:create must allow POST /api/properties');

    // Cannot delete custom role while assigned
    const delAssignedRole = await fetch(`${BASE_URL}/api/roles/${customRoleId}`, {
      method: 'DELETE',
      headers: ownerHeaders,
    });
    assert.equal(delAssignedRole.status, 400, 'Deleting custom role while assigned to employee must fail cleanly');

    // Edit custom role to remove properties:create -> live API immediately blocks Sara with 403
    const revokeCustomPropRes = await fetch(`${BASE_URL}/api/roles/${customRoleId}`, {
      method: 'PATCH',
      headers: ownerHeaders,
      body: JSON.stringify({
        modulePermissions: {
          dashboard: ['view'],
          properties: ['view'],
        },
      }),
    });
    assert.equal(revokeCustomPropRes.status, 200);

    const saraPropBlocked = await fetch(`${BASE_URL}/api/properties`, {
      method: 'POST',
      headers: saraHeaders,
      body: JSON.stringify({
        code: 'TST-100',
        nameAr: 'محاولة بعد السحب',
        type: 'تجاري',
        city: 'الرياض',
        district: 'العليا',
        ownershipMode: 'مملوك للشركة',
      }),
    });
    assert.equal(saraPropBlocked.status, 403, 'Revoking properties:create on custom role must immediately return 403');

    // Reassign Sara back to standard role, then delete custom role cleanly
    await fetch(`${BASE_URL}/api/team/employees/${createdEmp.user.id}`, {
      method: 'PATCH',
      headers: ownerHeaders,
      body: JSON.stringify({ customRoleId: null, role: 'leasing' }),
    });
    const delFreedRole = await fetch(`${BASE_URL}/api/roles/${customRoleId}`, {
      method: 'DELETE',
      headers: ownerHeaders,
    });
    assert.equal(delFreedRole.status, 200);

    // Live 18x7 matrix update on standard role 'leasing'
    const matrixEnable = await fetch(`${BASE_URL}/api/roles/module-matrix`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({
        role: 'leasing',
        modulePermissions: {
          dashboard: ['view'],
          properties: ['view', 'create'],
          tenants: ['view', 'create', 'edit'],
          contracts: ['view', 'create', 'edit'],
        },
      }),
    });
    assert.equal(matrixEnable.status, 200);
    const saraPropRes2 = await fetch(`${BASE_URL}/api/properties`, {
      method: 'POST',
      headers: saraHeaders,
      body: JSON.stringify({
        code: 'TST-101',
        nameAr: 'برج المصفوفة الحية',
        type: 'سكني',
        city: 'جدة',
        district: 'الروضة',
        ownershipMode: 'مملوك للشركة',
      }),
    });
    assert.equal(saraPropRes2.status, 201, 'Standard role 18x7 matrix update must take effect immediately');
    console.log('✓ 7. Custom Roles CRUD, assigned-delete guard, and live 18x7 RBAC matrix enforcement verified');

    // 8. Active sessions list, single revoke, WebSocket termination on suspension
    const sessionsListRes = await fetch(`${BASE_URL}/api/profile/sessions`, { headers: saraHeaders });
    assert.equal(sessionsListRes.status, 200);
    const sessionsListJson = await sessionsListRes.json();
    assert.ok(sessionsListJson.sessions.length >= 2);
    const otherSession = sessionsListJson.sessions.find((s) => !s.isCurrent);
    if (otherSession) {
      const revokeSingleRes = await fetch(`${BASE_URL}/api/profile/sessions/${otherSession.sessionId}`, {
        method: 'DELETE',
        headers: saraHeaders,
      });
      assert.equal(revokeSingleRes.status, 200);
    }

    // Open WebSocket as Sara, then suspend her -> must receive session:terminated & close, and HTTP returns 401
    await new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://127.0.0.1:${TEST_PORT}/ws`);
      let seenInit = false;
      let sawTerminated = false;
      const timer = setTimeout(() => {
        try {
          ws.terminate();
        } catch {
          // ignore
        }
        reject(new Error('WebSocket suspension termination timeout'));
      }, 6000);

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'session:identify', token: saraAuth.token, deviceName: 'Sara WS' }));
      });

      ws.on('message', async (raw) => {
        const msg = JSON.parse(String(raw));
        if (msg.type === 'auth:required') {
          ws.send(JSON.stringify({ type: 'session:identify', token: saraAuth.token, deviceName: 'Sara WS' }));
          return;
        }
        if (msg.type === 'state:init' && !seenInit) {
          seenInit = true;
          const suspRes = await fetch(`${BASE_URL}/api/team/employees/${createdEmp.user.id}`, {
            method: 'PATCH',
            headers: ownerHeaders,
            body: JSON.stringify({ accountStatus: 'موقوف', terminationReason: 'مراجعة إدارية' }),
          });
          assert.equal(suspRes.status, 200);
          return;
        }
        if (msg.type === 'session:terminated') {
          sawTerminated = true;
        }
      });

      ws.on('close', () => {
        clearTimeout(timer);
        assert.ok(sawTerminated, 'Suspended user WebSocket must receive session:terminated before closing');
        resolve();
      });
      ws.on('error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });

    const suspendedHttpRes = await fetch(`${BASE_URL}/api/state`, { headers: saraHeaders });
    assert.equal(suspendedHttpRes.status, 401, 'Suspended user token must immediately return 401');

    const suspendedLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'sara.m', password: 'SaraStrongPassword!26' }),
    });
    assert.equal(suspendedLogin.status, 401, 'Suspended employee must be blocked from login');
    console.log('✓ 8. Session revocation & immediate WebSocket + HTTP termination upon account suspension verified');

    // Reactivate Sara so we can verify recovery + logout-all
    const reactivateRes = await fetch(`${BASE_URL}/api/team/employees/${createdEmp.user.id}`, {
      method: 'PATCH',
      headers: ownerHeaders,
      body: JSON.stringify({ accountStatus: 'نشط' }),
    });
    assert.equal(reactivateRes.status, 200);

    // 9. Password & PIN recovery (non-enumerating unknown email + wrong code + password reset revokes prior sessions)
    const unknownRecRes = await fetch(`${BASE_URL}/api/auth/recovery/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@aqarplus.sa', purpose: 'password_reset' }),
    });
    assert.equal(unknownRecRes.status, 200);
    const unknownRecJson = await unknownRecRes.json();
    assert.ok(!unknownRecJson.localSimulationCode, 'Unknown account must NOT return any recovery code');

    const saraLoginBeforeReset = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'sara.m', password: 'SaraStrongPassword!26' }),
    });
    assert.equal(saraLoginBeforeReset.status, 200);
    const saraPreResetAuth = await saraLoginBeforeReset.json();

    const recReqRes = await fetch(`${BASE_URL}/api/auth/recovery/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'sara.verified@aqarplus.sa', purpose: 'password_reset' }),
    });
    assert.equal(recReqRes.status, 200);
    const recReqJson = await recReqRes.json();
    assert.equal(recReqJson.message, unknownRecJson.message, 'Recovery response message must be uniform');
    assert.ok(recReqJson.localSimulationCode);

    const recBadCode = await fetch(`${BASE_URL}/api/auth/recovery/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'sara.verified@aqarplus.sa',
        purpose: 'password_reset',
        code: '999999',
        newSecret: 'SaraNewPassword!99',
        confirmSecret: 'SaraNewPassword!99',
      }),
    });
    assert.equal(recBadCode.status, 400);

    const recResetOk = await fetch(`${BASE_URL}/api/auth/recovery/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: 'sara.verified@aqarplus.sa',
        purpose: 'password_reset',
        code: recReqJson.localSimulationCode,
        newSecret: 'SaraNewPassword!99',
        confirmSecret: 'SaraNewPassword!99',
      }),
    });
    assert.equal(recResetOk.status, 200);

    // Old token revoked after password reset
    const oldTokenAfterReset = await fetch(`${BASE_URL}/api/state`, {
      headers: { Authorization: `Bearer ${saraPreResetAuth.token}` },
    });
    assert.equal(oldTokenAfterReset.status, 401, 'Previous sessions must be revoked after password reset');

    // Old password fails, new password succeeds
    const oldPwdRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'sara.m', password: 'SaraStrongPassword!26' }),
    });
    assert.equal(oldPwdRes.status, 401);

    const newPwdRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: 'sara.m', password: 'SaraNewPassword!99' }),
    });
    assert.equal(newPwdRes.status, 200);
    const saraPostResetAuth = await newPwdRes.json();

    // Logout-all revokes current session
    const logoutAllRes = await fetch(`${BASE_URL}/api/auth/logout-all`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${saraPostResetAuth.token}`,
      },
      body: JSON.stringify({}),
    });
    assert.equal(logoutAllRes.status, 200);
    const postLogoutAllState = await fetch(`${BASE_URL}/api/state`, {
      headers: { Authorization: `Bearer ${saraPostResetAuth.token}` },
    });
    assert.equal(postLogoutAllState.status, 401);
    console.log('✓ 9. Non-enumerating password recovery, session invalidation, and logout-all verified');

    // 10. Multi-company workspace isolation for invitations & sessions
    const wsProvRes = await fetch(`${BASE_URL}/api/workspaces/provision`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-workspace-id': 'workforce-beta' },
      body: JSON.stringify({
        workspaceSlug: 'workforce-beta',
        companyNameAr: 'شركة بيتا العقارية',
        adminNameAr: 'مدير بيتا',
        adminEmail: 'beta@aqarplus.sa',
        password: 'BetaPassword!99',
        pin: '1357',
      }),
    });
    assert.equal(wsProvRes.status, 201);
    const betaAuth = await wsProvRes.json();

    const betaEmpRes = await fetch(`${BASE_URL}/api/team/employees`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${betaAuth.token}`,
        'x-workspace-id': 'workforce-beta',
      },
      body: JSON.stringify({
        nameAr: 'موظف بيتا',
        jobTitle: 'مشرف عقار',
        department: 'التشغيل',
        phone: '0551122334',
        email: 'emp.beta@aqarplus.sa',
        role: 'supervisor',
        channel: 'copy_link',
      }),
    });
    assert.equal(betaEmpRes.status, 201);
    const betaEmpJson = await betaEmpRes.json();
    const betaInviteToken = extractInviteToken(betaEmpJson.inviteUrl);

    // Cross-workspace invite lookup on default workspace must fail!
    const crossInviteRes = await fetch(`${BASE_URL}/api/public/invitations/${encodeURIComponent(betaInviteToken)}`, {
      headers: { 'x-workspace-id': 'default' },
    });
    assert.equal(crossInviteRes.status, 400, 'Invite token from company B must not resolve inside company A');

    // Cross-workspace session token check
    const crossSessionRes = await fetch(`${BASE_URL}/api/profile/sessions`, {
      headers: {
        Authorization: `Bearer ${betaAuth.token}`,
        'x-workspace-id': 'default',
      },
    });
    assert.equal(crossSessionRes.status, 401, 'Company B token must be rejected inside company A');
    console.log('✓ 10. Multi-company invitation & session isolation verified');

    console.log('\n✅ ALL 10 WORKFORCE, INVITATIONS, RBAC, PROFILE & RECOVERY CHECKS PASSED!\n');
  } finally {
    started.server.closeAllConnections?.();
    await new Promise((r) => started.server.close(r));
    fs.rmSync(TMP_DATA_DIR, { recursive: true, force: true });
  }
}

runWorkforceVerification().catch((err) => {
  console.error('❌ Workforce verification failed:', err);
  process.exit(1);
});
