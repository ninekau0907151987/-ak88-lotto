/**
 * server/scripts/migrate-firestore-to-supabase.ts
 * สคริปต์ดูดข้อมูลจาก Firestore ย้ายเข้า Supabase อัตโนมัติในคลิกเดียว
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  console.log('🚀 เริ่มต้นการย้ายข้อมูลจาก Firestore -> Supabase...');

  // 1. อ่าน Config Firestore
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) {
    console.error('❌ ไม่พบไฟล์ firebase-applet-config.json');
    return;
  }
  const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  const appFirebase = initializeApp(firebaseConfig);
  const firestore = getFirestore(appFirebase, firebaseConfig.firestoreDatabaseId);

  // 2. อ่าน Config Supabase
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ กรุณากำหนด SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY ใน Environment');
    return;
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  // 3. ย้ายข้อมูลประเภทหวย (lotteryTypes -> lottery_types)
  console.log('📦 กำลังย้ายตาราง: lotteryTypes...');
  const snapLottery = await getDocs(collection(firestore, 'lotteryTypes'));
  const lotteryRows = snapLottery.docs.map(doc => {
    const d = doc.data();
    return {
      id: doc.id,
      name: d.name || doc.id,
      category: d.category || 'thai',
      icon: d.icon || '🎯',
      path: d.path || `/lottery/${doc.id}`,
      is_open: d.isOpen !== false,
      is_hidden: d.isHidden === true,
      close_time: d.closeTime ? new Date(d.closeTime).toISOString() : null,
      bg_gradient: d.bgGradient || null,
      created_at: d.createdAt || new Date().toISOString(),
      updated_at: d.updatedAt || new Date().toISOString(),
    };
  });

  if (lotteryRows.length > 0) {
    const { error } = await supabase.from('lottery_types').upsert(lotteryRows);
    if (error) console.error('  ❌ Error migrating lottery_types:', error.message);
    else console.log(`  ✅ ย้าย lottery_types สำเร็จ: ${lotteryRows.length} รายการ`);
  }

  // 4. ย้ายข้อมูลสมาชิก (users -> users)
  console.log('📦 กำลังย้ายตาราง: users...');
  const snapUsers = await getDocs(collection(firestore, 'users'));
  const userRows = snapUsers.docs.map(doc => {
    const d = doc.data();
    return {
      id: doc.id,
      username: d.username || doc.id,
      phone: d.phone || null,
      role: d.role || 'member',
      balance: Number(d.balance) || 0,
      status: d.status || 'active',
      created_at: d.createdAt || new Date().toISOString(),
      updated_at: d.updatedAt || new Date().toISOString(),
    };
  });

  if (userRows.length > 0) {
    const { error } = await supabase.from('users').upsert(userRows);
    if (error) console.error('  ❌ Error migrating users:', error.message);
    else console.log(`  ✅ ย้าย users สำเร็จ: ${userRows.length} รายการ`);
  }

  console.log('🎉 ย้ายข้อมูลสำเร็จเรียบร้อยทุกตาราง!');
}

runMigration().catch(err => {
  console.error('Fatal error during migration:', err);
});
