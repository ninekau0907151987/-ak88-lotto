-- ==============================================================
-- AK88 LOTTO - SUPABASE POSTGRESQL SCHEMA (ตารางระบบหวยมาตรฐาน)
-- ==============================================================

-- 1. ตารางสมาชิกและผู้ใช้งาน (Users)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    phone TEXT,
    password_hash TEXT,
    role TEXT DEFAULT 'member', -- member, agent, staff, master, admin
    balance NUMERIC(14, 2) DEFAULT 0.00,
    status TEXT DEFAULT 'active', -- active, suspended, banned
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. ตารางประเภทหวย (Lottery Types)
CREATE TABLE IF NOT EXISTS lottery_types (
    id TEXT PRIMARY KEY, -- เช่น 'หวยรัฐบาล', 'หวยฮานอย', 'หวยลาว'
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- thai, foreign, stock, yeekee, set
    icon TEXT,
    path TEXT,
    is_open BOOLEAN DEFAULT true,
    is_hidden BOOLEAN DEFAULT false,
    close_time TIMESTAMPTZ,
    bg_gradient TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. ตารางรอบหวย (Lottery Rounds)
CREATE TABLE IF NOT EXISTS lottery_rounds (
    id TEXT PRIMARY KEY,
    lottery_type TEXT NOT NULL,
    round_number INT,
    open_time TIMESTAMPTZ,
    close_time TIMESTAMPTZ,
    status TEXT DEFAULT 'open', -- open, closed, settled, cancelled
    result TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ตารางโพยหวย (Tickets)
CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    ticket_id TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL,
    customer_name TEXT,
    lottery_type TEXT NOT NULL,
    round_id TEXT,
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status TEXT DEFAULT 'pending', -- pending, won, lost, cancelled, refunded
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- 5. ตารางรายการตัวเลขในโพย (Ticket Items / Bets)
CREATE TABLE IF NOT EXISTS ticket_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id TEXT REFERENCES tickets(ticket_id) ON DELETE CASCADE,
    number TEXT NOT NULL,
    bet_type TEXT NOT NULL, -- 3 ตัวบน, 3 ตัวโต๊ด, 2 ตัวบน, 2 ตัวล่าง, วิ่งบน, วิ่งล่าง ฯลฯ
    amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    payout_rate NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    discount_percent NUMERIC(5, 2) DEFAULT 0.00,
    win_amount NUMERIC(12, 2) DEFAULT 0.00,
    status TEXT DEFAULT 'pending' -- pending, won, lost, cancelled
);

CREATE INDEX IF NOT EXISTS idx_ticket_items_number ON ticket_items(number);
CREATE INDEX IF NOT EXISTS idx_ticket_items_ticket ON ticket_items(ticket_id);

-- 6. ตารางหวยยี่กี 88 รอบ (Yeekee Rounds)
CREATE TABLE IF NOT EXISTS yeekee_rounds (
    id TEXT PRIMARY KEY, -- เช่น 'yeekee-2026-10-01-1'
    round_number INT NOT NULL,
    date TEXT NOT NULL,
    open_time TEXT NOT NULL,
    close_time TEXT NOT NULL,
    result_number TEXT,
    status TEXT DEFAULT 'waiting', -- waiting, open, closed, settled
    total_shoots INT DEFAULT 0,
    shoots JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. ตารางเลขอั้น / เต็ม (Blocked Numbers)
CREATE TABLE IF NOT EXISTS blocked_numbers (
    id TEXT PRIMARY KEY,
    lottery_type TEXT NOT NULL,
    number TEXT NOT NULL,
    bet_type TEXT NOT NULL,
    max_amount NUMERIC(12, 2) DEFAULT 0.00,
    current_amount NUMERIC(12, 2) DEFAULT 0.00,
    status TEXT DEFAULT 'active',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. ตารางตั้งค่ารับกิน / สัดส่วน 100% (Risk Intake Configs)
CREATE TABLE IF NOT EXISTS risk_intake_configs (
    id TEXT PRIMARY KEY, -- ชื่อประเภทหวย
    lottery_type TEXT NOT NULL,
    global_risk_budget NUMERIC(14, 2) DEFAULT 50000.00,
    configs JSONB DEFAULT '[]'::jsonb, -- รายการตั้งค่า 14 ประเภทแทง, สัดส่วน %, กินตัวละ, ส่วนลด %
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. ตารางธุรกรรมการเงิน ฝาก-ถอน (Transactions)
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    type TEXT NOT NULL, -- deposit, withdraw, bet, win, refund
    amount NUMERIC(12, 2) NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, completed, rejected, cancelled
    slip_url TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);

-- 10. ตารางการตั้งค่าระบบทั่วไป (System Settings)
CREATE TABLE IF NOT EXISTS system_settings (
    id TEXT PRIMARY KEY,
    key TEXT UNIQUE NOT NULL,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- เปิดสิทธิ์ Realtime สำหรับตารางสำคัญ
ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE lottery_types;
ALTER PUBLICATION supabase_realtime ADD TABLE yeekee_rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE transactions;
