# AK88 Lotto — สถาปัตยกรรม API v2 (Architecture & Structure)

> เอกสารนี้กำหนดโครงสร้างระบบ เพื่อให้ **API ไม่ชนกัน**, **เก็บข้อมูลเป็นระเบียบ**,
> และ **รองรับการเติบโตแบบยืดหยุ่น** (เพิ่มหวย/เอเย่นต์/เส้นงานใหม่ได้โดยไม่พังของเดิม)

---

## 1. หลักคิด 6 ข้อ (กฎเหล็ก)

| # | กฎ | ทำไม |
|---|----|------|
| **1** | **Route ห้ามแตะ Firestore ตรง** — ต้องผ่าน `server/domains/*` | เปลี่ยนสคีมาที่เดียว ไม่ต้องแก้ 12 ไฟล์ |
| **2** | **Static path ต้องมาก่อน Param path** | `/queue/process` ต้องมาก่อน `/queue/:id` ไม่งั้นถูกกลืน |
| **3** | **ทุกการเปลี่ยนเครดิตต้องผ่าน `wallet.ts`** | ใช้ `runTransaction` กันเครดิตติดลบ/หายจาก race condition |
| **4** | **1 collection = 1 domain เป็นเจ้าของ** | ใครไม่ใช่เจ้าของห้ามเขียน กันเขียนทับกัน |
| **5** | **Version ที่ path** — `/api/v1/`, `/api/v2/` | เปลี่ยนสคีมา = ออก v2 ไม่แตะ v1 → ลูกค้าเก่าไม่พัง |
| **6** | **ชื่อ field/collection รวมที่ `config/collections.ts`** | เลิกปัญหา `ticketType` vs `lotteryType` ปนกัน |

---

## 2. การแบ่ง "เส้น" (Lines) — แยกขาดจากกัน

ผู้ใช้ถามว่า *"แยกเส้นมอนิเตอร์ คิว ส่งบิล ลดเลข ออกจากกันดีไหม"*
**คำตอบ: ดี — และแยกแล้ว** แต่แยกที่ชั้น **domain + route prefix** ไม่ใช่แยกเป็น 4 process

เพราะการแยกเป็นหลาย server ตั้งแต่ต้นจะเพิ่มภาระ (deploy, log, auth ซ้ำ 4 ที่)
โดยที่ยังไม่จำเป็น — แต่ละเส้นโหลดไม่เท่ากัน ควรแยก**เมื่อ** คิวเริ่มหนักจริง

```
                         ┌─────────────────────────────┐
   /api/v1/monitor/*  ──► │  monitor   อ่านอย่างเดียว    │  ห้ามเขียนข้อมูลธุรกิจ
   /api/v1/queue/*    ──► │  queue     คิวโพย            │  → เรียก betting.placeBet
   /api/v1/billing/*  ──► │  billing   บิล/ใบเสร็จ        │  ห้ามแตะ balance
   /api/v1/numberset/*──► │  numberset ลดเลข/ความเสี่ยง   │  ห้ามแตะ balance ของ users
                         └─────────────────────────────┘
                                        │
                                        ▼
                         ┌─────────────────────────────┐
                         │  domains/  ← ตรรกะธุรกิจ      │
                         │   wallet ← ★ atomic ทุกอย่าง │
                         └─────────────────────────────┘
                                        │
                                        ▼
                              Firestore (ผ่าน lib/wallet)
```

### 4 เส้นพิเศษ ทำงานอะไร

| เส้น | Prefix | หน้าที่ | ขอบเขต |
|------|--------|---------|--------|
| **มอนิเตอร์** | `/monitor` | เฝ้าสุขภาพระบบ, หาเครดิตติดลบ, audit ยอดเงิน | **อ่านเท่านั้น** |
| **คิว** | `/queue` | รับโพยเข้าคิว, worker ประมวลผล, ดูตำแหน่งคิว | เช็คเครดิตครบ |
| **ส่งบิล** | `/billing` | ออกบิล, พิมพ์ซ้ำ, ใบแจ้งยอดลูกค้า | **ห้ามแตะ balance** |
| **ลดเลข** | `/numberset` | ชุดลดเลข, ความเสี่ยงคงเหลือ, เจ้าหนี้เจ้าใหญ่ | **ห้ามแตะ balance ของ users** |

---

## 3. โครงสร้างไฟล์

```
server/
├── config/
│   └── collections.ts        ★ ชื่อ collection + field ทั้งหมด (ที่เดียว)
├── lib/
│   ├── wallet.ts             ★ หัวใจการเงิน — runTransaction
│   └── response.ts           ★ ok()/fail() + รหัส error มาตรฐาน
├── middleware/
│   ├── auth.ts                 ตรวจ API Key + scope
│   └── error-handler.ts      ★ requestId + asyncHandler + error กลาง
├── domains/                  ★ ตรรกะธุรกิจ (ห้าม route แตะ Firestore ตรง)
│   ├── betting/
│   │   ├── betting.service.ts     placeBet() — ที่เดียวที่สร้างโพย
│   │   ├── evaluate.ts            ตรวจรางวัล (pure function ทดสอบได้)
│   │   └── settlement.service.ts  settle idempotent
│   ├── queue/queue.service.ts
│   ├── finance/finance.service.ts
│   ├── billing/billing.service.ts
│   ├── numberset/numberset.service.ts
│   └── monitor/monitor.service.ts
└── routes/
    ├── v1/
    │   ├── index.ts          ★ รวมเส้น + กำหนด scope + แผนที่โมดูล
    │   ├── betting.routes.ts
    │   ├── queue.routes.ts
    │   ├── results.routes.ts
    │   ├── finance.routes.ts
    │   ├── billing.routes.ts
    │   ├── numberset.routes.ts
    │   └── monitor.routes.ts
    ├── system.ts   (เดิม — โครงสร้างเดิมยังใช้ได้)
    ├── lottery.ts
    ├── reports.ts
    └── users.ts
```

---

## 4. ตาราง API v2 (เส้นใหม่)

### 4.1 มอนิเตอร์ `/api/v1/monitor`
| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| GET | `/monitor/health` | สุขภาพระบบ + รายการปัญหา (issues) |
| GET | `/monitor/queue` | สุขภาพคิวละเอียด + งานล้มล่าสุด |
| GET | `/monitor/negative-balances` | ★ หาเครดิตติดลบ (ต้องได้ 0 เสมอ) |
| GET | `/monitor/audit/:userId` | ตรวจยอดเงินเทียบ ledger |

### 4.2 คิว `/api/v1/queue`
| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| POST | `/queue/enqueue` | เข้าคิว (idempotencyKey กันซ้ำได้) |
| POST | `/queue/process` | ★ ประมวลผล — เช็คเครดิต/เลขอั้นครบ |
| GET | `/queue/stats` | สรุปสถานะคิว |
| GET | `/queue/failed` | คิวที่ล้ม (ให้ admin แก้) |
| GET | `/queue` | ดูคิวทั้งหมด |
| GET | `/queue/:id` | ตำแหน่งในคิว |
| POST | `/queue/:id/status` | อัปเดตสถานะด้วยมือ |

### 4.3 ส่งบิล `/api/v1/billing`
| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| POST | `/billing/issue/ticket` | ออกบิลจากโพย (1 โพย = 1 บิล) |
| POST | `/billing/issue/transaction` | ออกบิลจากธุรกรรม |
| POST | `/billing/issue/statement` | ใบสรุปยอดทั้งรอบ |
| GET | `/billing/invoices` | รายการบิล |
| GET | `/billing/statement/:userId` | ใบแจ้งยอดลูกค้า |
| GET | `/billing/:id` | พิมพ์บิลซ้ำ |

### 4.4 ลดเลข `/api/v1/numberset`
| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| POST | `/numberset/sets` | สร้างชุดลดเลขใหม่ |
| GET | `/numberset/sets` | รายการชุดลดเลข |
| GET | `/numberset/exposure` | ★ ความเสี่ยงคงเหลือของรอบ |
| POST | `/numberset/sets/:id/status` | เปลี่ยนสถานะ (sent/confirmed/paid) |

### 4.5 เส้นธุรกิจ (ปรับปรุง)
| Method | Endpoint | สิ่งที่แก้ |
|--------|----------|-----------|
| POST | `/betting/bet` | ★ ตัดเครดิต atomic + validate เลข 1-6 หลัก |
| POST | `/betting/preview` | เพิ่ม `canBet` + `shortfall` + `closedReason` |
| GET | `/betting/tickets` | ★ รองรับ `lotterySlug` และ `lotteryType` |
| GET | `/betting/summary` | 🆕 สรุปยอดโพย |
| POST | `/betting/tickets/:id/cancel` | ★ atomic + กันยกเลิกซ้ำ |
| POST | `/results/preview-settle` | 🆕 ★ ลองตรวจก่อนจ่ายจริง (dryRun) |
| POST | `/results/settle` | ★ ต้องมี roundId + idempotent |
| GET | `/finance/pending` | 🆕 ธุรกรรมรออนุมัติ (สำหรับแอดมิน) |
| POST | `/finance/withdraw` | ★ atomic |
| POST | `/finance/transactions/:id/review` | ★ กัน review ซ้ำ |
| POST | `/finance/topup` | ★ atomic |

---

## 5. ตัวอย่าง: thundering herd ตอนยี่กีปิดรอบ

หวยยี่กีออกทุก 15 นาที → ช่วง 10 วินาทีก่อนปิด มีคนยิงพร้อมกันได้ 1,000+ request

```
                    ก่อนแก้ (v1)                     หลังแก้ (v2)
                ┌──────────────────┐          ┌──────────────────┐
  1000 req ────►│ อ่าน balance      │          │ POST /queue      │
                │ เช็ค >= 100       │          │  → เข้าคิวก่อน     │
                │ เขียน balance-100 │          └────────┬─────────┘
                └──────────────────┘                   │
                        │                              ▼
                   ❌ ยอดเพี้ยน              ┌──────────────────┐
                   ❌ ติดลบ                 │ worker ทีละรายการ │
                   ❌ เครดิตหาย              │ runTransaction    │
                                            │ อ่าน-เช็ค-เขียน   │
                                            │ อยู่ในล็อกเดียว    │
                                            └────────┬─────────┘
                                                     ▼
                                            ✅ ยอดถูกต้อง 100%
                                            ✅ ไม่ติดลบ
                                            ✅ ไม่หาย
```

---

## 6. Firestore Collections

| Collection | เจ้าของ (domain) | หมายเหตุ |
|------------|------------------|----------|
| `settings` | system | doc `global` |
| `lotteryTypes` | lottery | id = slug หวย |
| `lotteryRounds` | lottery | ★ เพิ่ม `settlementStatus` |
| `lotteryResults` | betting/settlement | ★ ผูก `roundId` |
| `blocked_numbers` | lottery | เลขอั้น |
| `tickets` | betting | ★ เพิ่ม `lotterySlug`, `roundId`, `settledAt` |
| `bet_queue` | queue | ★ เพิ่ม `attempts`, `idempotencyKey` |
| `transactions` | wallet | ★ เพิ่ม `balanceBefore`/`balanceAfter`/`idempotencyKey` |
| `users` | users | — |
| `agents` | users | — |
| `api_keys` | users | — |
| `api_logs` | monitor | 🆕 log การเรียก API |
| `invoices` | billing | 🆕 บิล/ใบเสร็จ |
| `numberSets` | numberset | 🆕 ชุดลดเลข |
| `counters` | billing/numberset | 🆕 รันนิ่งนัมเบอร์ |

### Migration ที่ต้องรัน (ข้อมูลเดิมยังไม่มี field ใหม่)

```js
// tickets: เพิ่ม lotterySlug จาก ticketType เดิม
// bet_queue: เพิ่ม attempts = 0
// transactions: เพิ่ม balanceBefore/balanceAfter (คำนวณย้อนหลังได้ยาก — เว้นว่างได้)
```

---

## 7. ข้อควรทำต่อ (Priority)

| ลำดับ | งาน | เหตุผล |
|-------|-----|--------|
| 🔴 1 | Deploy `firestore.rules` ที่แก้แล้ว (ปัจจุบัน deny → API ใช้งานไม่ได้) | บล็อกทุกอย่าง |
| 🔴 2 | Hash API Key (SHA-256) ไม่เก็บ plaintext | DB รั่ว = คีย์รั่วหมด |
| 🔴 3 | Worker รันอัตโนมัติ (cron ทุก 30 วิ) แทนเรียก `/queue/process` มือ | คิวจะได้ไหล |
| 🟡 4 | Pagination ทุก endpoint ที่ list | โพย 100k แถวจะพัง |
| 🟡 5 | ย้ายไป Firebase Admin SDK + ปิด rules | Security จริงจัง |
| 🟡 6 | เพิ่ม rate limit | กันยิงรัว/DDoS |

---

## 8. API Key Scopes

ตอนนี้บังคับใช้แล้วผ่าน `requireScope()` — คีย์เก่าที่ `scopes: null` ยังเข้าได้ทุกเส้น (backward compatible)

```json
{
  "name": "เว็บลูกค้า A",
  "scopes": ["bet", "finance", "billing"]
}
```

| Scope | เข้าถึง |
|-------|--------|
| `monitor` | `/monitor/*` |
| `bet` | `/queue/*`, `/betting/*` |
| `billing` | `/billing/*` |
| `numberset` | `/numberset/*` |
| `result` | `/results/*` |
| `finance` | `/finance/*` |
| `user` / `agent` / `admin` | `/users`, `/agents`, `/keys` |
