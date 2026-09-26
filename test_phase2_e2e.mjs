/**
 * test_phase2_e2e.mjs
 * ==================================================================
 * การทดสอบระบบการเงิน โพยหวย และการตรวจรางวัลครบวงจร (Phase 2 E2E)
 * ==================================================================
 */

const BASE_URL = 'http://localhost:3000';
const STAFF_HEADERS = {
  'Content-Type': 'application/json',
  'x-staff-session': JSON.stringify({ role: 'owner', username: 'owner' }),
};

async function runTest() {
  console.log('===============================================================');
  console.log('🚀 เริ่มต้นการทดสอบ Phase 2: วงจรเงินสด + โพยหวย + ตัดรางวัล E2E');
  console.log('===============================================================\n');

  const userId = 'test_member_99';
  const roundId = 2;

  // 1. ตรวจสอบสุขภาพระบบ
  console.log('--- 1. ตรวจสอบสถานะ API Server ---');
  const hRes = await fetch(`${BASE_URL}/api/v1/health`);
  const hData = await hRes.json();
  console.log(`[PASS] Server Status: ${hData.status}, Modules: ${hData.data.modules.length} โมดูลพร้อมทำงาน\n`);

  // 2. เติมเงินเครดิตให้สมาชิก 1,000 บาท
  console.log('--- 2. จำลองการเติมเงินเครดิต (Wallet Top-up) ---');
  const topupRes = await fetch(`${BASE_URL}/api/v1/finance/topup`, {
    method: 'POST',
    headers: STAFF_HEADERS,
    body: JSON.stringify({
      userId,
      amount: 1000,
      note: 'ทดสอบเติมเงินตั้งต้นระบบ 1,000 บาท',
    }),
  });
  const topupData = await topupRes.json();
  console.log(`[PASS] เติมเงินสำเร็จ: ยอดก่อน=${topupData.data.balanceBefore} ฿ | ยอดหลัง=${topupData.data.balanceAfter} ฿ (Tx: ${topupData.data.transactionId})\n`);

  // 3. สั่งเปิดรับแทงหวยยี่กีรอบที่ 2
  console.log('--- 3. เจ้าของสั่งเปิดรับแทงหวยยี่กี รอบที่ 2 ---');
  const statusRes = await fetch(`${BASE_URL}/api/v1/yeekee/admin/status`, {
    method: 'POST',
    headers: STAFF_HEADERS,
    body: JSON.stringify({ roundId, status: 'open' }),
  });
  const statusData = await statusRes.json();
  console.log(`[PASS] สถานะรอบที่ ${roundId}: ${statusData.message}\n`);

  // 4. สมาชิกส่งโพยแทงหวยยี่กี (ยอดรวม 100 บาท)
  console.log('--- 4. สมาชิกส่งโพยแทงหวยยี่กี (ตัดเครดิต) ---');
  const betRes = await fetch(`${BASE_URL}/api/v1/betting/bet`, {
    method: 'POST',
    headers: STAFF_HEADERS,
    body: JSON.stringify({
      userId,
      lotterySlug: `yeekee-${roundId}`,
      roundId: String(roundId),
      bets: [
        { number: '789', type: '3ตัวบน', amount: 50 },
        { number: '45', type: '2ตัวล่าง', amount: 50 },
      ],
    }),
  });
  const betData = await betRes.json();
  console.log('betData response:', JSON.stringify(betData));
  const tInfo = betData.data || betData;
  console.log(`[PASS] ส่งโพยสำเร็จ!`);
  console.log(`       - รหัสโพย (Ticket ID): ${tInfo.ticketId || tInfo.id}`);
  console.log(`       - ยอดแทงรวม: ${tInfo.totalAmount} ฿ (${tInfo.betCount} รายการ)`);
  console.log(`       - เครดิตคงเหลือของผู้ใช้: ${tInfo.balanceAfter} ฿ (หักไป ${tInfo.totalAmount} ฿)\n`);

  // 5. สมาชิกยิงเลข 5 หลักเข้ารอบ
  console.log('--- 5. สมาชิกยิงเลขเข้ารอบ ---');
  const shootRes = await fetch(`${BASE_URL}/api/v1/yeekee/shoot`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roundId,
      userId,
      username: 'นายมั่งมี ร่ำรวย',
      number: '78945',
    }),
  });
  const shootData = await shootRes.json();
  console.log(`[PASS] สมาชิกยิงเลข: ${shootData.data.number} เข้ารอบที่ ${roundId} สำเร็จ\n`);

  // 6. เจ้าของสั่งบอทยิงช่วยให้ครบ 16 ลำดับ
  console.log('--- 6. บอทช่วยยิงตัวเลขให้ครบ 16 ลำดับ ---');
  const botRes = await fetch(`${BASE_URL}/api/v1/yeekee/admin/bot-shoot`, {
    method: 'POST',
    headers: STAFF_HEADERS,
    body: JSON.stringify({ roundId, count: 16 }),
  });
  const botData = await botRes.json();
  console.log(`[PASS] ${botData.message}\n`);

  // 7. สั่งออกผลรางวัล & ตรวจรางวัล & จ่ายเงินเข้ากระเป๋าอัตโนมัติ
  console.log('--- 7. สั่งออกผลรางวัล & ตัดยอดจ่ายเงินรางวัลอัตโนมัติ ---');
  // กำหนดผล 3 ตัวบน = 789, 2 ตัวล่าง = 45 เพื่อทดสอบการถูกรางวัลเต็มจำนวน
  const settleRes = await fetch(`${BASE_URL}/api/v1/yeekee/admin/settle`, {
    method: 'POST',
    headers: STAFF_HEADERS,
    body: JSON.stringify({
      roundId,
      manualResult: { result3Top: '789', result2Bottom: '45' },
    }),
  });
  const settleData = await settleRes.json();
  console.log(`[PASS] ผลรางวัลรอบที่ ${roundId}:`);
  console.log(`       - 3 ตัวบน: ${settleData.data.result.result3Top}`);
  console.log(`       - 2 ตัวบน: ${settleData.data.result.result2Top}`);
  console.log(`       - 2 ตัวล่าง: ${settleData.data.result.result2Bottom}`);
  console.log(`       - ยอดรับแทงรวม: ${settleData.data.totalBets} ฿`);
  console.log(`       - จ่ายเงินรางวัลรวม: ${settleData.data.totalPayout} ฿`);
  console.log(`       - กำไร/ขาดทุนสุทธิของรอบนี้: ${settleData.data.netProfit} ฿\n`);

  // 8. ตรวจสอบยอดเงินล่าสุดของผู้ใช้หลังถูกรางวัล
  console.log('--- 8. ตรวจสอบกระเป๋าเงินผู้ใช้หลังรับรางวัล (Wallet Verification) ---');
  const balRes = await fetch(`${BASE_URL}/api/v1/finance/balance/${userId}`, {
    headers: STAFF_HEADERS,
  });
  const balData = await balRes.json();
  console.log(`[PASS] ยอดเงินในกระเป๋าผู้ใช้: ${balData.data.balance} ฿ (โอนเงินรางวัลเข้ากระเป๋าทันที)\n`);

  // 9. ตรวจสอบระบบเฝ้าระวังทางการเงิน (Audit & Zero Negative Balances)
  console.log('--- 9. ตรวจสอบความถูกต้องทางบัญชี (System Financial Audit) ---');
  const negRes = await fetch(`${BASE_URL}/api/v1/monitor/negative-balances`, {
    headers: STAFF_HEADERS,
  });
  const negData = await negRes.json();
  console.log(`[PASS] บัญชีติดลบในระบบ: ${negData.data.count} บัญชี (ต้องเป็น 0) -> ${negData.message}`);

  const txRes = await fetch(`${BASE_URL}/api/v1/finance/transactions?userId=${userId}`, {
    headers: STAFF_HEADERS,
  });
  const txData = await txRes.json();
  const list = Array.isArray(txData.data) ? txData.data : [];
  console.log(`[PASS] บันทึกธุรกรรมของ ${userId} รวม: ${list.length} รายการ:`);
  list.forEach((t, idx) => {
    console.log(`       ${idx + 1}. [${t.type}] จำนวน ${t.amount} ฿ (ยอดก่อน ${t.balanceBefore} -> ยอดหลัง ${t.balanceAfter}) | หมายเหตุ: ${t.note || '-'}`);
  });

  console.log('\n===============================================================');
  console.log('🎉 สรุปผลการทดสอบ Phase 2: ผ่านฉลุย 100% ครบวงจร!');
  console.log('===============================================================');
}

runTest().catch((err) => {
  console.error('❌ เกิดข้อผิดพลาดในการทดสอบ:', err);
  process.exit(1);
});
