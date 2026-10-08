-- ==============================================================
-- AK88 LOTTO - COMPLETE SUPABASE POSTGRESQL SCHEMA (ตารางระบบหวยมาตรฐานครบวงจร)
-- ==============================================================

-- 0. ล้างตารางเก่าที่ว่างเปล่าเพื่อป้องกันคอลัมน์ไม่ตรง (Clean Slate Migration)
DROP TABLE IF EXISTS ticket_items CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS lottery_results CASCADE;
DROP TABLE IF EXISTS lottery_rounds CASCADE;
DROP TABLE IF EXISTS yeekee_rounds CASCADE;
DROP TABLE IF EXISTS blocked_numbers CASCADE;
DROP TABLE IF EXISTS risk_intake_configs CASCADE;
DROP TABLE IF EXISTS lottery_types CASCADE;
DROP TABLE IF EXISTS staff CASCADE;
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS permission_logs CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 1. ตารางสมาชิกและผู้ใช้งาน (Users)
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    phone TEXT,
    password_hash TEXT,
    role TEXT DEFAULT 'member', -- member, agent, staff, master, admin
    balance NUMERIC(14, 2) DEFAULT 0.00,
    status TEXT DEFAULT 'active', -- active, suspended, banned
    first_name TEXT,
    last_name TEXT,
    name TEXT,
    bank_name TEXT,
    bank_account TEXT,
    agent_id TEXT,
    line_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ตารางพนักงานและผู้ดูแลระบบ (Staff & Admins)
CREATE TABLE staff (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL DEFAULT 'Password@123',
    display_name TEXT NOT NULL,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'staff', -- staff, cashier, risk_officer, accounting, super_admin, owner
    granted_extra JSONB DEFAULT '[]'::jsonb,
    revoked JSONB DEFAULT '[]'::jsonb,
    scope_project_ids JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'active', -- active, suspended
    note TEXT,
    last_login TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ตารางประเภทหวย (Lottery Types)
CREATE TABLE lottery_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'thai', -- thai, foreign, stock, yeekee, set
    icon TEXT,
    path TEXT,
    is_open BOOLEAN DEFAULT true,
    is_hidden BOOLEAN DEFAULT false,
    close_time TIMESTAMPTZ,
    open_time TEXT,
    bg_gradient TEXT,
    rates JSONB DEFAULT '{}'::jsonb,
    median_rates JSONB DEFAULT '{}'::jsonb,
    discounts JSONB DEFAULT '{}'::jsonb,
    min_bets JSONB DEFAULT '{}'::jsonb,
    max_bets JSONB DEFAULT '{}'::jsonb,
    max_per_users JSONB DEFAULT '{}'::jsonb,
    sub_items JSONB DEFAULT '[]'::jsonb,
    flag_url TEXT,
    min_bet NUMERIC(10, 2) DEFAULT 1.00,
    max_bet NUMERIC(10, 2) DEFAULT 5000.00,
    max_per_ticket NUMERIC(12, 2) DEFAULT 50000.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ตารางรอบหวย (Lottery Rounds)
CREATE TABLE lottery_rounds (
    id TEXT PRIMARY KEY,
    lottery_type TEXT NOT NULL,
    round_number TEXT,
    open_time TIMESTAMPTZ,
    close_time TIMESTAMPTZ,
    result_time TIMESTAMPTZ,
    status TEXT DEFAULT 'open', -- open, closed, settled, cancelled
    result TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ตารางผลรางวัลหวย (Lottery Results)
CREATE TABLE lottery_results (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    lottery_type TEXT NOT NULL,
    round_id TEXT,
    result_3top TEXT,
    result_2bottom TEXT,
    result_3bottom TEXT,
    result_3front TEXT,
    summary JSONB DEFAULT '{}'::jsonb,
    settled_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. ตารางโพยหวย (Tickets)
CREATE TABLE tickets (
    id TEXT PRIMARY KEY,
    ticket_id TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    customer_name TEXT DEFAULT 'ลูกค้าทั่วไป',
    lottery_type TEXT NOT NULL,
    lottery_slug TEXT,
    round_id TEXT,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status TEXT DEFAULT 'pending', -- pending, pending_cancellation, confirmed, win, lose, cancelled, refunded
    win_amount NUMERIC(12, 2) DEFAULT 0.00,
    gross_win_amount NUMERIC(12, 2) DEFAULT 0.00,
    tax_amount NUMERIC(12, 2) DEFAULT 0.00,
    tax_rate NUMERIC(5, 2) DEFAULT 0.00,
    bets JSONB DEFAULT '[]'::jsonb,
    winning_bets JSONB DEFAULT '[]'::jsonb,
    note TEXT,
    settled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- 7. ตารางรายการตัวเลขในโพย (Ticket Items / Bets)
CREATE TABLE ticket_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id TEXT REFERENCES tickets(ticket_id) ON DELETE CASCADE,
    number TEXT NOT NULL,
    bet_type TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    payout_rate NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    win_amount NUMERIC(12, 2) DEFAULT 0.00,
    status TEXT DEFAULT 'pending'
);

CREATE INDEX idx_ticket_items_number ON ticket_items(number);
CREATE INDEX idx_ticket_items_ticket ON ticket_items(ticket_id);

-- 8. ตารางหวยยี่กี 88 รอบ (Yeekee Rounds)
CREATE TABLE yeekee_rounds (
    id TEXT PRIMARY KEY,
    round_number INT NOT NULL,
    date TEXT NOT NULL,
    open_time TEXT NOT NULL,
    close_time TEXT NOT NULL,
    result_number TEXT,
    status TEXT DEFAULT 'waiting',
    total_shoots INT DEFAULT 0,
    shoots JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. ตารางเลขอั้น / ลดราคาจ่าย / ปิดรับ (Blocked Numbers)
CREATE TABLE blocked_numbers (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    lottery_type TEXT NOT NULL,
    number TEXT NOT NULL,
    bet_type TEXT NOT NULL DEFAULT 'ทุกประเภท',
    restriction_type TEXT DEFAULT 'blocked', -- blocked, reduced, limited, special
    payout_rate NUMERIC(10, 2) DEFAULT 0.00,
    custom_payout_rate NUMERIC(10, 2) DEFAULT 0.00,
    max_amount NUMERIC(12, 2) DEFAULT 0.00,
    current_amount NUMERIC(12, 2) DEFAULT 0.00,
    status TEXT DEFAULT 'active',
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_blocked_numbers_lottery ON blocked_numbers(lottery_type, number);

-- 10. ตารางตั้งค่ารับกิน / สัดส่วน 100% (Risk Intake Configs / Bet Limits)
CREATE TABLE risk_intake_configs (
    id TEXT PRIMARY KEY,
    lottery_id TEXT,
    lottery_type TEXT,
    round_id TEXT,
    is_thai BOOLEAN DEFAULT false,
    rates JSONB DEFAULT '{}'::jsonb,
    discounts JSONB DEFAULT '{}'::jsonb,
    min_bets JSONB DEFAULT '{}'::jsonb,
    max_bets JSONB DEFAULT '{}'::jsonb,
    max_per_users JSONB DEFAULT '{}'::jsonb,
    min_bet NUMERIC(10, 2) DEFAULT 1.00,
    max_bet NUMERIC(10, 2) DEFAULT 5000.00,
    max_user_limit NUMERIC(12, 2) DEFAULT 50000.00,
    total_risk_budget NUMERIC(14, 2) DEFAULT 200000.00,
    sub_items JSONB DEFAULT '[]'::jsonb,
    note TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. ตารางธุรกรรมการเงิน ฝาก-ถอน (Transactions)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    username TEXT,
    type TEXT NOT NULL, -- deposit, withdraw, bet, win, refund
    amount NUMERIC(12, 2) NOT NULL,
    gross_amount NUMERIC(12, 2),
    tax_amount NUMERIC(12, 2),
    tax_rate NUMERIC(5, 2),
    bank_name TEXT,
    bank_account TEXT,
    trans_ref TEXT,
    status TEXT DEFAULT 'pending',
    slip_url TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_user ON transactions(user_id);

-- 12. ตารางการตั้งค่าระบบทั่วไป (System Settings)
CREATE TABLE system_settings (
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. ตารางบันทึกกิจกรรมแอดมินและการแก้สิทธิ์ (Permission Logs)
CREATE TABLE permission_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_uid TEXT,
    target_name TEXT,
    actor_name TEXT,
    action TEXT,
    note TEXT,
    at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- เปิด Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE lottery_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE lottery_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE lottery_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE yeekee_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_intake_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE permission_logs ENABLE ROW LEVEL SECURITY;

-- สร้าง Policies (อนุญาต SELECT/INSERT/UPDATE สำหรับ Public/Anon Key และ Service Role)
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT tablename FROM pg_tables WHERE schemaname = 'public' 
        AND tablename IN ('users', 'staff', 'lottery_types', 'lottery_rounds', 'lottery_results', 
                         'tickets', 'ticket_items', 'yeekee_rounds', 'blocked_numbers', 
                         'risk_intake_configs', 'transactions', 'system_settings', 'permission_logs')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS "allow_all_%s" ON %I;', tbl, tbl);
        EXECUTE format('CREATE POLICY "allow_all_%s" ON %I FOR ALL USING (true) WITH CHECK (true);', tbl, tbl);
    END LOOP;
END $$;

-- เปิด Realtime Publication
DO $$
DECLARE
    tbl text;
BEGIN
    FOR tbl IN 
        SELECT unnest(ARRAY['tickets', 'lottery_types', 'lottery_rounds', 'lottery_results', 
                            'yeekee_rounds', 'blocked_numbers', 'transactions', 'staff'])
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables 
            WHERE pubname = 'supabase_realtime' AND tablename = tbl
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I;', tbl);
        END IF;
    END LOOP;
END $$;

-- Seed ข้อมูลผู้ดูแลระบบหลัก (Default Owner Account & Admin Account)
INSERT INTO staff (id, username, password, display_name, phone, role, status, note)
VALUES 
    ('staff_owner_01', 'owner', '0614284727', 'เจ้าของระบบ (Owner)', '0614284727', 'owner', 'active', 'บัญชีเจ้าของระบบหลัก'),
    ('staff_admin_01', 'admin', 'Password@123', 'ผู้ดูแลระบบ (Admin)', '0800000000', 'super_admin', 'active', 'บัญชีแอดมินสำหรับจัดการทั่วไป')
ON CONFLICT (username) DO UPDATE 
SET password = EXCLUDED.password, role = EXCLUDED.role, status = 'active';

-- Seed ข้อมูลตั้งค่าระบบเบื้องต้น
INSERT INTO system_settings (id, key, value)
VALUES 
    ('global', 'global', '{"systemOpen": true, "bettingOpen": true, "minBet": 1, "maxBet": 5000, "maxBetPerUser": 50000, "taxRate": 1}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Seed ข้อมูลประเภทหวยยอดนิยมเริ่มต้น (Lottery Types)
INSERT INTO lottery_types (id, name, category, icon, path, is_open, min_bet, max_bet, max_per_ticket, rates)
VALUES 
    ('หวยรัฐบาลไทย', 'หวยรัฐบาลไทย', 'thai', '🇹🇭', '/lottery/thai', true, 1.00, 5000.00, 50000.00, '{"3 ตัวบน": 900, "3 ตัวโต๊ด": 150, "3 ตัวล่าง": 450, "3 ตัวหน้า": 450, "2 ตัวบน": 90, "2 ตัวล่าง": 90, "วิ่งบน": 3.2, "วิ่งล่าง": 4.2}'::jsonb),
    ('หวยฮานอย', 'หวยฮานอย', 'foreign', '🇻🇳', '/lottery/hanoi', true, 1.00, 5000.00, 50000.00, '{"3 ตัวบน": 850, "3 ตัวโต๊ด": 120, "2 ตัวบน": 92, "2 ตัวล่าง": 92, "วิ่งบน": 3.2, "วิ่งล่าง": 4.2}'::jsonb),
    ('ฮานอยพิเศษ', 'ฮานอยพิเศษ', 'foreign', '🇻🇳', '/lottery/hanoi-special', true, 1.00, 5000.00, 50000.00, '{"3 ตัวบน": 850, "3 ตัวโต๊ด": 120, "2 ตัวบน": 92, "2 ตัวล่าง": 92, "วิ่งบน": 3.2, "วิ่งล่าง": 4.2}'::jsonb),
    ('ฮานอย(VIP)', 'ฮานอย(VIP)', 'foreign', '🇻🇳', '/lottery/hanoi-vip', true, 1.00, 5000.00, 50000.00, '{"3 ตัวบน": 850, "3 ตัวโต๊ด": 120, "2 ตัวบน": 92, "2 ตัวล่าง": 92, "วิ่งบน": 3.2, "วิ่งล่าง": 4.2}'::jsonb),
    ('หวยลาวพัฒนา', 'หวยลาวพัฒนา', 'foreign', '🇱🇦', '/lottery/lao', true, 1.00, 5000.00, 50000.00, '{"3 ตัวบน": 850, "3 ตัวโต๊ด": 120, "2 ตัวบน": 92, "2 ตัวล่าง": 92, "วิ่งบน": 3.2, "วิ่งล่าง": 4.2}'::jsonb),
    ('หวยมาเลย์ 4D', 'หวยมาเลย์ 4D', 'foreign', '🇲🇾', '/lottery/malay', true, 1.00, 5000.00, 50000.00, '{"3 ตัวบน": 850, "3 ตัวโต๊ด": 120, "2 ตัวบน": 92, "2 ตัวล่าง": 92, "วิ่งบน": 3.2, "วิ่งล่าง": 4.2}'::jsonb),
    ('หวยยี่กี 88 รอบ', 'หวยยี่กี 88 รอบ', 'yeekee', '⏱️', '/lottery/yeekee', true, 1.00, 5000.00, 50000.00, '{"3 ตัวบน": 850, "3 ตัวโต๊ด": 120, "2 ตัวบน": 92, "2 ตัวล่าง": 92, "วิ่งบน": 3.2, "วิ่งล่าง": 4.2}'::jsonb),
    ('หวยธกส.', 'หวยธกส.', 'thai', '🏦', '/lottery/baac', true, 1.00, 5000.00, 50000.00, '{"3 ตัวบน": 900, "3 ตัวโต๊ด": 150, "2 ตัวบน": 90, "2 ตัวล่าง": 90, "วิ่งบน": 3.2, "วิ่งล่าง": 4.2}'::jsonb),
    ('หวยออมสิน', 'หวยออมสิน', 'thai', '🏦', '/lottery/gsb', true, 1.00, 5000.00, 50000.00, '{"3 ตัวบน": 900, "3 ตัวโต๊ด": 150, "2 ตัวบน": 90, "2 ตัวล่าง": 90, "วิ่งบน": 3.2, "วิ่งล่าง": 4.2}'::jsonb)
ON CONFLICT (id) DO UPDATE 
SET is_open = true, rates = EXCLUDED.rates;

-- Seed รอบหวยเริ่มต้นที่เปิดรับแทงทันที (Lottery Rounds)
INSERT INTO lottery_rounds (id, lottery_type, round_number, open_time, close_time, result_time, status)
VALUES 
    ('round-thai-current', 'หวยรัฐบาลไทย', 'งวดประจำวัน', NOW() - INTERVAL '1 day', NOW() + INTERVAL '12 days', NOW() + INTERVAL '12 days 1 hour', 'open'),
    ('round-hanoi-current', 'หวยฮานอย', 'งวดประจำวัน', NOW() - INTERVAL '2 hours', NOW() + INTERVAL '6 hours', NOW() + INTERVAL '7 hours', 'open'),
    ('round-hanoispec-current', 'ฮานอยพิเศษ', 'งวดประจำวัน', NOW() - INTERVAL '2 hours', NOW() + INTERVAL '5 hours', NOW() + INTERVAL '6 hours', 'open'),
    ('round-hanoivip-current', 'ฮานอย(VIP)', 'งวดประจำวัน', NOW() - INTERVAL '2 hours', NOW() + INTERVAL '7 hours', NOW() + INTERVAL '8 hours', 'open'),
    ('round-lao-current', 'หวยลาวพัฒนา', 'งวดประจำวัน', NOW() - INTERVAL '2 hours', NOW() + INTERVAL '8 hours', NOW() + INTERVAL '9 hours', 'open'),
    ('round-malay-current', 'หวยมาเลย์ 4D', 'งวดประจำสัปดาห์', NOW() - INTERVAL '2 hours', NOW() + INTERVAL '8 hours', NOW() + INTERVAL '9 hours', 'open')
ON CONFLICT (id) DO UPDATE 
SET status = 'open';

-- Seed สมาชิกตัวอย่างสำหรับทดสอบแทง (Test Member with 10,000 THB Credit)
INSERT INTO users (id, username, phone, role, balance, status)
VALUES 
    ('user_test_01', 'user_test', '0899999999', 'member', 10000.00, 'active')
ON CONFLICT (username) DO UPDATE 
SET balance = 10000.00, status = 'active';
