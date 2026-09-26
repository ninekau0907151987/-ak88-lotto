# AK88 Lotto — คู่มือสถาปัตยกรรมฉบับสมบูรณ์

> เอกสารนี้ตอบทุกคำถาม: อยู่ไฟล์ไหน · ทำอะไรไปแล้ว · ขั้นตอนคู่มือ · ภาษา · สถาปัตย์ · ฐานข้อมูล · API · ฟังก์ชัน · ความต้องการผู้สั่งงาน · ระบบรองรับ · ความปลอดภัย · ความเร็ว · จำนวน · ความยืดหยุ่น
>
> **ตรวจสอบจากโค้ดจริงทั้งหมด** — วันที่ 27 ก.ย. 2026

---

## 1. โปรเจกต์อยู่ไฟล์ไหน

```
C:\Users\User\Projects\ak88-lotto\ตรีมหวย-นิก\
```

- `C:\Users\User\Projects\ak88-lotto\` มีโปรเจกต์เดียวคือ `ตรีมหวย-นิก`
- ชื่อโฟลเดอร์เป็นภาษาไทย — **ระวัง**: เครื่องมือบางตัว (Firebase emulator, Java) อ่าน path ไทย/MSYS ไม่ได้ ต้องใช้ path แบบ `C:/...`

### ไฟล์เอกสารที่มีอยู่

| ไฟล์ | บรรทัด | เนื้อหา |
|------|--------|---------|
| `ARCHITECTURE.md` | 242 | สถาปัตย์ API v2, 6 กฎเหล็ก, ตาราง API, scopes |
| `API.md` | 181 | รายการ API |
| `PERMISSIONS.md` | 313 | ระบบสิทธิ์พนักงาน |
| `NAVIGATION.md` | 130 | แผนผังการนำทาง |
| `AGENTS.md` | 52 | กติกาสำหรับ AI agent |
| `README.md` | 20 | ภาพรวม |

---

## 2. ทำอะไรไปแล้ว (สรุปงานสะสม)

### งาน A — โครงสร้างพื้นฐาน

| # | งาน | สถานะ |
|---|-----|--------|
| A1 | แยกเส้น API เป็นโมดูล ไม่ชนกัน | ✅ |
| A2 | UI หน้าหวย + หวยชุด ใช้จริง PC+มือถือ | ✅ |
| A3 | ธีมหลังบ้านสีครีม + ค้นหา/รายงาน/กราฟ/ประวัติ/บิล | ✅ |
| A4 | ระบบสิทธิ์พนักงาน (ปิดสิทธิ์รายคน) | ✅ |
| A5 | บอท 2 ตัว + เปิด/ปิดรอบหลังบ้าน | ✅ |
| A6 | **หวย 20 ช่อง 6 หลัก** ครบวงจร | ✅ |
| A7 | วางดาต้าบสเป็นระบบ + seed + คู่มือ | ✅ |

### งาน B — ทีละข้อ (ตามที่พี่สั่ง)

| # | งาน | เทสต์ | สถานะ |
|---|-----|-------|--------|
| B1 | หน้าวางเลขลูกค้า 20 ช่อง | 64/64 | ✅ |
| B2 | จำกัดความเสี่ยง 4 ชั้น | 54/54 | ✅ |
| B3 | รายงานกำไร-ขาดทุน + กราฟ | 90/90 | ✅ |
| B4 | แจ้งเตือน LINE | 82/82 | ✅ |
| B5 | **ตรวจสิทธิ์ฝั่งเซิร์ฟเวอร์** | 113/113 | ✅ |

---

## 3. ขั้นตอนคู่มือ (เรียงลำดับ)

### 3.1 เริ่มระบบครั้งแรก

```bash
# 1) เข้าโปรเจกต์
cd "C:/Users/User/Projects/ak88-lotto/ตรีมหวย-นิก"

# 2) ติดตั้ง (ถ้ายังไม่ติดตั้ง)
npm install

# 3) เปิด Firestore emulator (สำหรับพัฒนา)
#    ★ ต้องใช้ path แบบ Windows และรัน .jar ตรงๆ
"C:/Users/User/AppData/Local/Temp/jre/jdk-21.0.12.1+1-jre/bin/java.exe" \
  -jar "C:/Users/User/.cache/firebase/emulators/cloud-firestore-emulator-v1.22.0.jar" \
  --host 127.0.0.1 --port 8085 --project_id demo-ak88 \
  --rules "C:/Users/User/AppData/Local/Temp/g20emu/rules.txt"

# 4) ใส่ข้อมูลตั้งต้น
npx tsx scripts/seed-game20.mjs --emulator --reset

# 5) เปิดเซิร์ฟเวอร์
PORT=3000 DISABLE_HMR=true FIRESTORE_EMULATOR_HOST=127.0.0.1:8085 npx tsx server.ts
```

### 3.2 ตรวจสอบคุณภาพก่อนส่งงาน

```bash
npx tsc --noEmit      # ต้องได้ EXIT 0
npx vite build        # ต้องได้ EXIT 0
npx tsx __test_*.mjs  # เทสต์ทั้งหมด
```

### 3.3 ใช้งานหลังบ้าน

| หน้า | ที่อยู่ | ใช้ทำอะไร |
|------|---------|-----------|
| คู่มือหลังบ้าน | `/admin/manual` | คู่มือ 13 หมวด + ตารางรหัส |
| แอดมินหวย 20 ช่อง | `/admin/game20` | 6 แท็บ: ภาพรวม/บอท/อัตราจ่าย/ประวัติ/รหัส/กติกา |
| รายงานกำไร-ขาดทุน | `/admin/game20/report` | 4 แท็บ + กราฟ SVG + ส่งออก CSV |
| สิทธิ์พนักงาน | `/admin` → แท็บพนักงาน | เปิด/ปิดสิทธิ์รายคน |

### 3.4 หวย 20 ช่อง ทำงานอย่างไร

```
ผลลัพธ์ = (ผลรวม 20 ช่อง − ช่องที่ 17) mod 1,000,000
```

- 20 ช่อง ช่องละ **6 หลัก** (000000–999999)
- **ช่องที่ 17** ถูกหักออก (แสดงไฮไลต์แดง ⊖ ในหน้าวางเลข)
- ผลลัพธ์เป็นเลข 6 หลัก → ใช้ตัดสิน 4 รางวัล

**อัตราจ่ายเริ่มต้น** (margin บ้าน 19.6%)

| ประเภท | จ่าย | โอกาสจริง |
|--------|------|-----------|
| 3 ตัวบน | 900× | 1:1000 |
| 2 ตัวบน | 95× | 1:100 |
| 2 ตัวล่าง | 95× | 1:100 |
| 1 ตัว | 3.2× | 1:10 |
| 3 ตัวโต๊ด | 150× | 6:1000 |

> ⚠️ **2 ตัวล่าง = หลักกลาง** (`slice(2,4)`) ไม่ใช่หลักแรก — ตัวนี้เคยเขียนผิดตอนแรก

---

## 4. ภาษาที่ใช้

| ส่วน | ภาษา | หมายเหตุ |
|------|------|----------|
| ทั้งโปรเจกต์ | **TypeScript** | เป็นหลัก |
| Backend | TypeScript + Express 4 | `server.ts` + `server/**/*.ts` |
| Frontend | React 19 + TypeScript | Vite 6 |
| Styling | Tailwind CSS 4 + CSS Variables | ไม่ใช้ CSS-in-JS |
| ฐานข้อมูล | Firestore (Firebase 12) | NoSQL |
| เทสต์ | `.mjs` รันด้วย `tsx` | เขียน assertion เอง ไม่ใช้ framework |
| บิลด์ production | esbuild (server) + Vite (client) | |

**เวอร์ชันหลัก:** React 19.0 · Vite 6.2 · Express 4.21 · Firebase 12.12 · TypeScript 5.8 · React Router 7.14 · Tailwind 4.1

---

## 5. สถาปัตยกรรมที่ใช้

### Modular Monolith + Domain Layer

**ไม่ใช่ microservice** — เป็นโมโนลิธที่แยกชั้นชัดเจน

```
┌─────────────────────────────────────────────┐
│  Frontend (React)                            │
│  src/frontend/pages/  ← ลูกค้า (22 หน้า)      │
│  src/backend/pages/   ← หลังบ้าน (9 หน้า)      │
├─────────────────────────────────────────────┤
│  Shared Layer (ใช้ร่วม)                       │
│  src/shared/lib/       ← ตรรกะธุรกิจ 14 ไฟล์   │
│  src/shared/components/ hooks/ types/         │
├─────────────────────────────────────────────┤
│  HTTP Layer                                  │
│  server.ts → /api/v1                         │
│  server/middleware/  auth · permission · error │
├─────────────────────────────────────────────┤
│  Domain Layer  (ห้าม route แตะ Firestore ตรง)  │
│  server/domains/*/   ← 7 โดเมน                │
├─────────────────────────────────────────────┤
│  Data Layer                                  │
│  server/lib/db.ts (Repository)                │
│  server/config/collections.ts (ชื่อจริง)       │
├─────────────────────────────────────────────┤
│  Firestore                                   │
└─────────────────────────────────────────────┘
```

### 6 กฎเหล็ก (จาก `ARCHITECTURE.md`)

| # | กฎ | ทำไม |
|---|----|------|
| 1 | Route ห้ามแตะ Firestore ตรง — ผ่าน `domains/*` | เปลี่ยนสคีมาที่เดียว |
| 2 | Static path ต้องมาก่อน Param path | `/queue/process` ต้องมาก่อน `/queue/:id` |
| 3 | เปลี่ยนเครดิตต้องผ่าน `wallet.ts` | `runTransaction` กันเครดิตติดลบ |
| 4 | 1 collection = 1 domain เจ้าของ | กันเขียนทับกัน |
| 5 | Version ที่ path (`/api/v1/`) | ลูกค้าเก่าไม่พัง |
| 6 | ชื่อ field/collection รวมที่ `collections.ts` | เลิกปัญหา `ticketType` vs `lotteryType` |

### เส้นทาง versioned

```
/api/v1/health          ← health check
/api/v1/game20/*        ← หวย 20 ช่อง
/api/v1/monitor/*       ← มอนิเตอร์
/api/v1/queue/*         ← คิวโพย
/api/v1/betting/*       ← แทง
/api/v1/billing/*       ← ส่งบิล
/api/v1/numberset/*     ← ลดเลข
/api/v1/finance/*       ← การเงิน
/api/v1/results/*       ← ผลรางวัล
/api/v1/system/*
/api/v1/lottery/*
/api/v1/rounds/*
/api/v1/blocked/*
/api/v1/reports/*
/api/v1/users/* · agents/* · keys/*
```

**16 โมดูล** — เส้นที่กว้างกว่าอยู่บน, static ก่อน param เสมอ (บังคับด้วยเทสต์ `__test_routes.mjs`)

---

## 6. ฐานข้อมูล

### Firestore Collections (จาก `server/config/collections.ts`)

| กลุ่ม | Collection | เก็บอะไร |
|-------|-----------|----------|
| **ระบบ** | `settings` | เปิด/ปิดสวิตช์ทั้งระบบ (doc: `settings/global`) |
| | `api_keys` | คีย์ API + scopes |
| | `api_logs` | audit log การเรียก API |
| | `staff` | พนักงาน + role + perms + grantedExtra + revoked |
| | `adminLogs` | ประวัติการตั้งค่า (ก่อน→หลัง) |
| | `manuals` | เนื้อหาคู่มือที่แก้ไขได้ |
| **หวย** | `lotteryTypes` | ประเภทหวย (doc id = slug) |
| | `lotteryRounds` | รอบ/งวด |
| | `lotteryResults` | ผลรางวัล (ผูก roundId) |
| | `blocked_numbers` | เลขอั้น (limbo) |
| | `tickets` | โพยที่ยืนยันแล้ว (ตัดเครดิตแล้ว) |
| | `bet_queue` | คิวโพยรอประมวลผล |
| **เงิน** | `transactions` | ธุรกรรมเข้า-ออกทั้งหมด |
| | `invoices` | บิล/ใบเสร็จ |
| | `users` · `agents` | สมาชิก · เอเย่นต์ |
| **เลขชุด** | `numberSets` · `numberSetItems` | ชุดเลข + ประวัติลดเลข |
| **หวย 20 ช่อง** | `game20Rounds` | รอบ (doc id = roundId) |
| | `game20Config` | ค่าบอท/อัตราจ่าย/ขีดจำกัด (doc: `main`) |
| | `game20History` | **ทุกเหตุการณ์ + checksum** |
| | `game20Codes` | รหัส — **เก็บเฉพาะ hash** |
| | `game20BotLogs` | บันทึกการใช้บอท |

### Repository Pattern (`server/lib/db.ts` — 560 บรรทัด)

```ts
const repo = createRepositories(fs);
repo.rounds.get(id) · .insert() · .find() · .count()
```

**สิ่งที่ layer นี้จัดการให้:**
- ลบ `undefined` แบบ recursive (Firestore ปฏิเสธ `undefined`)
- แปลง `NaN` / `Infinity` → `null`
- ตัด string ยาวเกิน
- ใส่ `createdAt` / `updatedAt` / `createdBy` อัตโนมัติ
- `find()` กรองฝั่ง client ถ้า index ไม่พอ
- `seedOnce()` — seed ซ้ำได้ ไม่พัง (idempotent)

### กฎการตั้งชื่อ

- **camelCase** ทั้งระบบ (`lotteryTypes` ไม่ใช่ `lottery_types`)
- ชื่อเก่าเป็น snake_case มี alias กำกับ
- ห้ามพิมพ์ชื่อ collection เป็น string ตรงๆ — import จาก `collections.ts` เสมอ

---

## 7. API ฟังก์ชันทั้งหมด

### จำนวนเส้น

| ไฟล์ | เส้น |
|------|------|
| `game20.routes.ts` | 21 |
| `game20History.routes.ts` | 17 |
| `betting.routes.ts` | 7 |
| `finance.routes.ts` | 7 |
| `queue.routes.ts` | 7 |
| `billing.routes.ts` | 6 |
| `monitor.routes.ts` | 4 |
| `numberset.routes.ts` | 4 |
| `results.routes.ts` | 4 |
| **รวม** | **77** |

### ฟังก์ชันหวย 20 ช่อง

**แกนหลัก**
- `/health` — ข้อมูลโมดูล
- `/guide` — กติกา
- `/compute` — คำนวณผลจาก 20 ช่อง
- `/validate` — ตรวจ 20 ช่อง
- `/evaluate` — ตรวจโพย
- `/exposure` — ความเสี่ยงที่รับไว้
- `/slots/random` · `/slots/solve` · `/slots/natural` — สร้าง 20 ช่อง
- `/config` · `/rates` — ตั้งค่า/อัตราจ่าย

**บอท 2 ตัว**
- `/bot/config` — อ่าน/ตั้งค่าบอท
- `/bot/result` — บอทออกผล (5 โหมด: ยุติธรรม/กำไรสูงสุด/คุมกำไรตามเป้า/ห้ามมีคนถูก/ตั้งผลเอง)
- `/bot/number` — บอทวางเลข (6 แผนสลับ: สับทั้งชุด/หมุนวงกลม/กลับด้าน/แบ่งกลุ่ม/…)
- `/bot/report` — รายงานสรุปบอททั้ง 2 ตัว + เศรษฐศาสตร์

**รอบ/ประวัติ/รหัส**
- `/rounds` · `/rounds/close` · `/rounds/:id` · `/stats`
- ประวัติ + checksum ตรวจย้อนหลังได้
- รหัส 5 ชนิด: `result_lock` · `round_code` · `admin_code` · `open_close` · `custom`
- แก้ไขผล (ต้องมีสิทธิ์ `game20.edit_result`)

### API Key Scopes

| Scope | เข้าถึง |
|-------|--------|
| `monitor` | `/monitor/*` |
| `bet` | `/queue/*`, `/betting/*` |
| `billing` | `/billing/*` |
| `numberset` | `/numberset/*` |
| `result` | `/results/*` |
| `finance` | `/finance/*` |
| `lottery` | `/game20/*` |
| `user` / `agent` / `admin` | `/users`, `/agents`, `/keys` |

> คีย์เก่าที่ `scopes: null` ยังเข้าได้ทุกเส้น (backward compatible)

---

## 8. หน้าจอในระบบ

**ลูกค้า 22 หน้า:** Login · Register · ForgotPassword · Home · Profile · Deposit · Withdraw · History · FinancialReport · Referral · Contact · LotteryList · LotteryBet · LotteryRules · LotteryResults · LotteryTickets · LotterySetBet · NumberSetCreate · StockLotteryList · YeekeeList · **Game20Bet** · **Game20Guide**

**หลังบ้าน 9 หน้า:** AdminDashboard · MasterDashboard · **Game20Admin** · **Game20Report** · AgentProfile · ApiDocs · DeveloperApi · StaffPermission · **BackofficeManual**

**เส้นทางทั้งหมด 34 เส้นทาง** (ตรวจด้วย `__test_routes.mjs` 38/38)

---

## 9. ความต้องการของผู้สั่งงาน → ระบบรองรับ

| ความต้องการ | รองรับด้วย | สถานะ |
|-------------|-----------|--------|
| หน้าหวยใช้งานจริง PC + มือถือ | ใช้ `useBreakpoint()` + class string — **ไม่แตะ markup มือถือ** | ✅ |
| "ดูง่ายไม่ทับกัน" | แยกกล่องเครดิตด้วย `pt-4 / -top-2 / z-10` | ✅ |
| ตามรูปแบบเดิม ไม่เปลี่ยนดีไซน์ | คง navy frame เดิมของหน้าหวย | ✅ |
| หวยชุด พื้นขาว กรอบ กดเลข→เลือกเงิน | `--bet-*` variables + auto-detect ประเภท | ✅ |
| ระบบสิทธิ์ปิดรายคนได้ | deny by default + **revoked ชนะเสมอ** | ✅ |
| หวย 20 ช่อง 6 หลัก | สูตรหักช่อง 17 + ตารางจ่าย + ประวัติ + ภาพกติกา | ✅ |
| บอท 2 ตัว เปิด/ปิดได้ | resultBot + numberBot + สวิตช์หลังบ้าน | ✅ |
| วางดาต้าบสเป็นระบบ | Repository + seed คำสั่งเดียว + คู่มือ | ✅ |
| ตารางรหัสผ่าน + ทางเข้า | `/admin/manual` 13 หมวด + ตารางรหัส | ✅ |
| จำกัดความเสี่ยง | B2 — 4 ชั้น | ✅ |
| รายงานกำไร-ขาดทุน | B3 — 4 แท็บ + กราฟ + CSV | ✅ |
| แจ้งเตือน LINE | B4 — 6 ข้อความ + retry | ✅ |
| ตรวจสิทธิ์ฝั่ง server | B5 — 25 เส้นมี guard | ✅ |

---

## 10. ความปลอดภัย

### ชั้นการป้องกัน

1. **Deny by default** — ไม่มีสิทธิ์ = เข้าไม่ได้
2. **Revoked ชนะเสมอ** — ถอดสิทธิ์แล้วกู้ไม่ได้จนกว่าจะให้ใหม่
3. **API Key Scopes** — คีย์แต่ละตัวเข้าได้แค่เส้นที่อนุญาต
4. **Session** — `x-staff-session` (base64 JSON)
5. **Guard 2 ชั้น** ทุกเส้นสำคัญ — `requirePermission()` + handler
6. **Firestore Rules** — ชั้นสุดท้ายที่ฐานข้อมูล
7. **checksum + ประวัติ** — แก้ผลทุกครั้งมีร่องรอย

### ระบบสิทธิ์

**83 สิทธิ์ (16 หมวด)** — เพิ่ม `game20.*` 11 ตัวใหม่

| Role | สิทธิ์ |
|------|-------|
| owner | 83 (ทั้งหมด) |
| master | 83 (ทั้งหมด) |
| admin | 76 |
| staff | 19 |
| agent | 14 |
| viewer | 17 |

> **สำคัญ:** `server/middleware/permission.ts` **import จาก `src/shared/lib/permissions.ts`** โดยตรง — แหล่งความจริงเดียว ป้องกันไม่ให้ server กับ UI เพี้ยนกัน
>
> ตอนพิมพ์ซ้ำเองครั้งแรก **เพี้ยน 21 รายการ** และ `hasPermission` ของ owner/master **ไม่สนใจ `revoked`** → ช่องโหว่จริง แก้แล้ว

### เส้นที่มี guard (25 เส้น)

`PUT /config` · `PUT /rates` · `POST /bot/result` · `PUT /bot/config` · `POST /bot/number` · `POST /rounds/close` · `GET /stats` และอื่นๆ

---

## 11. ความเร็ว

| ตัวชี้วัด | ค่า |
|----------|-----|
| Production bundle (JS) | 2,121 kB → **gzip 536 kB** |
| CSS | 108.75 kB → gzip 17.79 kB |
| เวลาบิลด์ | **16.9 วินาที** |
| เทสต์ทั้งชุด | ~100 วินาที |

**กลไกความเร็ว:**
- คิว `bet_queue` + worker แยก — กัน thundering herd ตอนยี่กีปิดรอบ
- `runTransaction` สำหรับเครดิต — กัน race condition
- Index กรองฝั่ง Firestore, fallback กรองฝั่ง client
- เชื่อมต่อ emulator ผ่าน `connectFirestoreEmulator()` แบบ explicit

> ⚠️ **ข้อจำกัดที่พบ:** Windows เครื่องนี้มี TIME_WAIT สะสมสูง (~24,000) ทำให้ port หมดชั่วคราว (`EADDRINUSE`) — **แก้ด้วย Admin:**
> ```powershell
> netsh int ipv4 set dynamicport tcp start=10000 num=55535
> ```

---

## 12. จำนวน

| รายการ | จำนวน |
|--------|-------|
| **บรรทัดโค้ดรวม** | **32,032** |
| — frontend | 7,927 |
| — backend | 10,100 |
| — shared | 7,118 |
| — server | 6,751 |
| หน้าจอ | 31 (22 ลูกค้า + 9 หลังบ้าน) |
| เส้นทาง | 34 |
| เส้น API | 77 |
| โมดูล API | 16 |
| โดเมน | 7 |
| Collection | 24 |
| สิทธิ์ | 83 (16 หมวด) |
| ไฟล์เทสต์ | 14 |
| **เทสต์ที่ผ่าน** | **1,262** |
| ไฟล์เอกสาร | 6 |

### ผลเทสต์ล่าสุด (ตรวจสด)

| ชุดเทสต์ | ผล |
|---------|-----|
| `__test_lottery20.mjs` | 139 ✅ |
| `__test_bots.mjs` | 82 ✅ |
| `__test_permissions.mjs` | 58 ✅ |
| `__test_betcount.mjs` | 27 ✅ |
| `__test_game20_api.mjs` | 139 ✅ |
| `__test_game20_hist.mjs` | 200 ✅ |
| `__test_db.mjs` | 115 ✅ |
| `__test_routes.mjs` | 38 ✅ |
| `__test_pages.mjs` | 65 ✅ |
| `__test_betslip.mjs` | 64 ✅ |
| `__test_risk.mjs` | 54 ✅ |
| `__test_report.mjs` | 90 ✅ |
| `__test_line.mjs` | 82 ✅ |
| `__test_perm_server.mjs` | 113 ✅ |
| **รวม** | **1,266 ผ่าน / 0 ตก** |

`npx tsc --noEmit` = **EXIT 0** · `npx vite build` = **EXIT 0**

---

## 13. ความยืดหยุ่นและการขยาย

### ระดับที่ 1 — เปลี่ยนค่าตั้งต้น (ไม่แตะโค้ด)

- อัตราจ่ายทั้ง 5 ประเภท → `/admin/game20`
- สวิตช์บอท 2 ตัว + โหมด + แผนสลับ
- เพดานความเสี่ยง 4 ชั้น
- เปิด/ปิดรอบ
- สิทธิ์พนักงานรายคน

### ระดับที่ 2 — เพิ่มหวยใหม่ (ไม่แตะ API เดิม)

1. เพิ่ม slug ใน `lotteryTypes`
2. UI: เพิ่ม route ใน `App.tsx`
3. Domain: เพิ่มใน `server/domains/`
4. ออก `v2` ถ้าสคีมาเปลี่ยน

### ระดับที่ 3 — ขยายระบบ

- **เพิ่มเจ้ามือ/แบรนด์** — ระบบMaster → หลายแบรนด์ → หลายสาขา
- **เพิ่มโมดูล** — สร้าง `server/domains/<ใหม่>/` + `routes/v1/<ใหม่>.routes.ts` + ลงทะเบียนใน `index.ts`
- **รับโหลดสูง** — เพิ่ม worker ของ `bet_queue` แนวนอนได้เลย

### จุดที่ออกแบบมาให้ยืดหยุ่น

| จุด | ยืดหยุ่นอย่างไร |
|-----|-----------------|
| `collections.ts` | เปลี่ยนชื่อ collection ที่เดียวทั้งระบบเปลี่ยนตาม |
| Repository pattern | เปลี่ยน DB ได้โดยไม่แตะ domain |
| Domain layer | แต่ละโดเมนแยกขาด แก้โดเมนหนึ่งไม่กระทบอื่น |
| Version ที่ path | ออก v2 ได้โดยลูกค้าเก่าไม่พัง |
| `permissions.ts` | เพิ่มสิทธิ์ใหม่ → server ได้อัตโนมัติ |
| บอท | เพิ่มโหมด/แผนใหม่ = เพิ่ม entry ใน array |
| Seed script | `seedOnce()` — รันซ้ำได้ไม่พัง |

---

## 14. สิ่งที่ยังค้าง

| # | เรื่อง | ต้องทำอะไร |
|---|--------|-----------|
| 1 | **TIME_WAIT ล้น** | Admin รัน `netsh int ipv4 set dynamicport tcp start=10000 num=55535` |
| 2 | **Firestore Rules บน Firebase จริง** | `PERMISSION_DENIED` → `npx firebase deploy --only firestore:rules` |
| 3 | **ทดสอบโหลด 50 พร้อมกัน** | ยังไม่ได้รัน |
| 4 | **port 8099** | เป็นแอป PHP แยก (`php.exe`) — ห้ามแตะ |

---

## 15. บัญชีและรหัส

> **ห้ามบันทึกค่ารหัสจริงในเอกสารนี้** — เก็บใน `.env.local` และ `firebase-applet-config.json` เท่านั้น
>
> ตารางรหัสสำหรับใช้งานดูได้ที่หน้า `/admin/manual` ในระบบ

**Session keys:**
- ใหม่: `ak88_staff_session` (JSON)
- เก่า: `adminAuth` (`'true'`) → ถือเป็น role admin

**Ports:**
- `3000` — dev server
- `8085` — Firestore emulator
- `8088` — production build
- `8099` — ⛔ php.exe แอปอื่น ห้ามแตะ

---

*จบเอกสาร — ตรวจสอบจากโค้ดจริง ณ วันที่ 27 กันยายน 2026*
