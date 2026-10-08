-- ==============================================================
-- AK88 LOTTO - SCHEMA MIGRATION SCRIPT (2026-10-09)
-- เพิ่มคอลัมน์ที่ขาดหายไปเพื่อให้ฐานข้อมูล หน้าบ้าน และหลังบ้าน สอดคล้องกัน 100%
-- สามารถนำไปรันใน Supabase Dashboard -> SQL Editor ได้ทันที
-- ==============================================================

-- 1. อัปเดตตารางโพยหวย (tickets)
-- เพิ่มคอลัมน์เก็บรายการแทง (bets) และรายการถูกรางวัล (winning_bets)
ALTER TABLE tickets 
    ADD COLUMN IF NOT EXISTS bets JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS winning_bets JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS note TEXT;

-- 2. อัปเดตตารางประเภทหวย (lottery_types)
-- เพิ่มคอลัมน์ส่วนลด (discounts), เพดานเดิมพัน 1-14 ประเภท, และรูปธง (flag_url)
ALTER TABLE lottery_types 
    ADD COLUMN IF NOT EXISTS discounts JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS min_bets JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS max_bets JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS max_per_users JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS sub_items JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS flag_url TEXT;

-- 3. อัปเดตตารางตั้งค่าความเสี่ยงและอัตราจ่าย (risk_intake_configs)
-- เพิ่มคอลัมน์อัตราจ่าย, ส่วนลด, เพดานเดิมพัน และรอบหวย
ALTER TABLE risk_intake_configs 
    ADD COLUMN IF NOT EXISTS rates JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS discounts JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS min_bets JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS max_bets JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS max_per_users JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS round_id TEXT;

-- 4. อัปเดตตารางสมาชิกและผู้ใช้ (users)
-- เพิ่มคอลัมน์ข้อมูลส่วนตัว, ธนาคาร และตัวแทน
ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS first_name TEXT,
    ADD COLUMN IF NOT EXISTS last_name TEXT,
    ADD COLUMN IF NOT EXISTS name TEXT,
    ADD COLUMN IF NOT EXISTS bank_name TEXT,
    ADD COLUMN IF NOT EXISTS bank_account TEXT,
    ADD COLUMN IF NOT EXISTS agent_id TEXT,
    ADD COLUMN IF NOT EXISTS line_id TEXT;

-- 5. อัปเดตตารางธุรกรรมการเงิน (transactions)
-- เพิ่มคอลัมน์ธนาคาร และรหัสอ้างอิงสลิป
ALTER TABLE transactions 
    ADD COLUMN IF NOT EXISTS bank_name TEXT,
    ADD COLUMN IF NOT EXISTS bank_account TEXT,
    ADD COLUMN IF NOT EXISTS trans_ref TEXT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 6. อัปเดตตารางเลขอั้น (blocked_numbers)
ALTER TABLE blocked_numbers 
    ADD COLUMN IF NOT EXISTS created_by TEXT;

-- 7. อัปเดตตารางรอบหวย (lottery_rounds)
ALTER TABLE lottery_rounds 
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 8. อัปเดตตารางผลรางวัล (lottery_results)
ALTER TABLE lottery_results 
    ADD COLUMN IF NOT EXISTS settled_by TEXT;

-- 9. สร้าง Helper RPC Function สำหรับรันคำสั่ง SQL ในอนาคต
CREATE OR REPLACE FUNCTION exec_sql(query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    EXECUTE query;
    RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 10. รีเฟรช Schema Cache ให้ PostgREST อัปเดตทันที
NOTIFY pgrst, 'reload schema';
