/**
 * test_production_e2e.mjs
 * -------------------------------------------------------------
 * Automated End-to-End Verification Suite for AK88 LOTTO Production
 * Tests live APIs, Yeekee engine, slip verification, wallet, OTP, and SPA.
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    testsFailed++;
    throw new Error(message);
  } else {
    console.log(`✅ PASS: ${message}`);
    testsPassed++;
  }
}

async function run() {
  console.log('=====================================================');
  console.log(`🚀 Starting AK88 LOTTO E2E Verification on: ${BASE_URL}`);
  console.log('=====================================================\n');

  // TEST 1: Health Check
  console.log('--- [1] API HEALTH & MODULE CHECK ---');
  try {
    const res = await fetch(`${BASE_URL}/api/v1/health`);
    assert(res.status === 200, `Health check HTTP ${res.status}`);
    const data = await res.json();
    assert(data.status === 'success', 'Health status is success');
    assert(data.data.service === 'AK88 Lotto API', 'Service name is AK88 Lotto API');
    assert(Array.isArray(data.data.modules) && data.data.modules.includes('yeekee'), 'Yeekee module is active');
    assert(data.data.modules.includes('finance'), 'Finance module is active');
  } catch (e) {
    console.error('Test 1 failed:', e.message);
  }

  // TEST 2: Yeekee Rounds & Bot Engine
  console.log('\n--- [2] YEEKEE 24/7 AUTOMATED ENGINE ---');
  let targetRound = null;
  try {
    const res = await fetch(`${BASE_URL}/api/v1/yeekee/rounds`);
    assert(res.status === 200, `Yeekee rounds HTTP ${res.status}`);
    const json = await res.json();
    assert(json.status === 'success', 'Yeekee rounds query success');
    assert(Array.isArray(json.data) && json.data.length > 0, `Returned ${json.data?.length} rounds`);
    
    // Pick an active or open round
    targetRound = json.data.find(r => r.status === 'open') || json.data[0];
    const rNum = targetRound.id || targetRound.roundNumber;
    assert(targetRound && rNum, `Identified active round #${rNum}`);

    // Shoot a number
    const shootRes = await fetch(`${BASE_URL}/api/v1/yeekee/shoot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roundNumber: rNum,
        number: '55888',
        userId: 'e2e_tester',
        userName: 'E2E Tester',
      }),
    });
    const shootJson = await shootRes.json();
    assert(shootRes.status === 200 || shootRes.status === 400, `Yeekee shoot endpoint response: ${shootJson.status || shootRes.status}`);
  } catch (e) {
    console.error('Test 2 failed:', e.message);
  }

  // TEST 3: SMS OTP System
  console.log('\n--- [3] SMS OTP & AUTH RECOVERY ---');
  let testPhone = '0812345678';
  let otpRef = '';
  let otpCode = '';
  try {
    const sendRes = await fetch(`${BASE_URL}/api/v1/auth/otp/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: testPhone }),
    });
    const sendJson = await sendRes.json();
    assert(sendJson.status === 'success', `OTP requested successfully (Ref: ${sendJson.data?.ref})`);
    otpRef = sendJson.data?.ref;
    otpCode = sendJson.data?.debugCode;

    if (otpCode) {
      const verifyRes = await fetch(`${BASE_URL}/api/v1/auth/otp/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone, code: otpCode }),
      });
      const verifyJson = await verifyRes.json();
      assert(verifyJson.status === 'success', 'OTP verification passed with correct 6-digit code');
    }
  } catch (e) {
    console.error('Test 3 failed:', e.message);
  }

  // TEST 4: Auto-Deposit & Slip Verification (Atomic Wallet Credit)
  console.log('\n--- [4] SLIP VERIFICATION & ATOMIC WALLET DEPOSIT ---');
  const testUserId = `member_${Date.now()}`;
  try {
    const slipRes = await fetch(`${BASE_URL}/api/v1/finance/slip/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUserId,
        amount: 2500,
        senderBank: 'SCB',
        bankAccount: '987-6-54321-0',
        note: 'E2E Slip Test Verification',
      }),
    });
    const slipJson = await slipRes.json();
    assert(slipJson.status === 'success', `Slip verified and credited: ฿${slipJson.data?.amount}`);

    // Verify balance
    const balRes = await fetch(`${BASE_URL}/api/v1/finance/balance/${testUserId}`);
    const balJson = await balRes.json();
    assert(balJson.status === 'success', 'Retrieved member balance');
    assert(balJson.data?.balance === 2500, `Balance verified: ฿${balJson.data?.balance} (expected 2500)`);
  } catch (e) {
    console.error('Test 4 failed:', e.message);
  }

  // TEST 5: Withdrawal & Atomic Escrow Debit
  console.log('\n--- [5] REAL WITHDRAWAL & ESCROW LOCKING ---');
  try {
    // 5.1 Test overdraft rejection
    const failWithdraw = await fetch(`${BASE_URL}/api/v1/finance/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUserId,
        amount: 50000, // over balance
        bankName: 'KBANK',
        bankAccount: '123-4-56789-0',
      }),
    });
    const failJson = await failWithdraw.json();
    assert(failWithdraw.status === 400 && failJson.code === 'INSUFFICIENT_CREDIT', 'Overdraft withdrawal correctly rejected (INSUFFICIENT_CREDIT)');

    // 5.2 Test valid withdrawal
    const okWithdraw = await fetch(`${BASE_URL}/api/v1/finance/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: testUserId,
        amount: 1000,
        bankName: 'KBANK',
        bankAccount: '123-4-56789-0',
        note: 'E2E withdrawal testing',
      }),
    });
    const okJson = await okWithdraw.json();
    assert(okWithdraw.status === 200 && okJson.status === 'success', `Withdrawal submitted to escrow (TxID: ${okJson.data?.id})`);

    // 5.3 Verify balance deduction (2500 - 1000 = 1500)
    const balRes2 = await fetch(`${BASE_URL}/api/v1/finance/balance/${testUserId}`);
    const balJson2 = await balRes2.json();
    assert(balJson2.data?.balance === 1500, `Wallet balance debited to escrow: ฿${balJson2.data?.balance} (expected 1500)`);
  } catch (e) {
    console.error('Test 5 failed:', e.message);
  }

  // TEST 6: Static Assets & Production Single Page App Routing
  console.log('\n--- [6] PRODUCTION WEB ROUTING & BUNDLES ---');
  try {
    const rootRes = await fetch(`${BASE_URL}/`);
    assert(rootRes.status === 200, 'Frontend root index.html delivers HTTP 200');
    const rootHtml = await rootRes.text();
    assert(rootHtml.includes('<div id="root">') || rootHtml.includes('assets/'), 'Contains root container and bundle links');

    // Test SPA fallback routes
    const routes = ['/login', '/register', '/admin/login', '/portal', '/deposit', '/withdraw'];
    for (const r of routes) {
      const res = await fetch(`${BASE_URL}${r}`);
      assert(res.status === 200, `SPA route ${r} successfully serves index.html (HTTP 200)`);
    }
  } catch (e) {
    console.error('Test 6 failed:', e.message);
  }

  console.log('\n=====================================================');
  console.log(`📊 TEST RESULTS: ${testsPassed} PASSED, ${testsFailed} FAILED`);
  console.log('=====================================================');

  if (testsFailed > 0) {
    process.exit(1);
  } else {
    console.log('🎉 ALL PRODUCTION E2E TESTS PASSED SUCCESSFULLY! 🚀');
    process.exit(0);
  }
}

run();
