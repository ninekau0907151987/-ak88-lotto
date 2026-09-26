# AK88 Lotto — API Documentation (v1)

AK88 Lotto API v1 — RESTful API ครบทุกด้าน **52 endpoints / 12 หมวด**

## Base URL
```
http://localhost:3000/api/v1
```

## Health / Public (ไม่ต้องใช้ API Key)
| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| GET | `/api/v1/health` | ตรวจสอบสถานะเซิร์ฟเวอร์ + รายชื่อโมดูล |
| GET | `/api/v1/public/results` | ผลรางวัลสาธารณะ (กรอง `?type=`) |

## Authentication
ทุก endpoint (ยกเว้น health / public) ต้องแนบ API Key:
```
Authorization: Bearer ak88_live_xxxxxxxxxx
```
สร้าง/จัดการคีย์ได้ที่หน้า **หลังบ้าน → การตั้งค่า API & นักพัฒนา** (`/admin/api`)

---

## 1. ระบบ (System) — 4 endpoints
| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| GET | `/system/status` | ดูสถานะระบบ (เปิด/ปิด ทุกส่วน) |
| POST | `/system/toggle` | เปิด/ปิดสวิตช์ (`bettingOpen`, `depositOpen`, `withdrawOpen`, `registerOpen`, `systemOpen`) |
| GET | `/system/settings` | ดูการตั้งค่าทั้งหมด |
| POST | `/system/settings` | อัปเดตการตั้งค่า |

## 2. หวย (Lottery) — 5 endpoints
| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| GET | `/lottery/types` | ดูประเภทหวยทั้งหมด |
| GET | `/lottery/types/:id` | ดูประเภทหวยเดียว |
| POST | `/lottery/types` | สร้าง/แก้ไขประเภทหวย |
| POST | `/lottery/types/:id/toggle` | เปิด/ปิดรับแทงหวยตัวนี้ (`{open:true/false}`) |
| POST | `/lottery/types/:id/rates` | ตั้งอัตราจ่าย (`{rates:{...}}`) |

## 3. รอบหวย (Rounds) — 3 endpoints
| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| GET | `/rounds` | ดูรอบหวย (กรอง `?type=`) |
| POST | `/rounds` | สร้างรอบหวยใหม่ |
| POST | `/rounds/:id/close` | ปิดรอบ |

## 4. เลขอั้น (Blocked) — 3 endpoints
| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| GET | `/blocked` | ดูเลขอั้น (กรอง `?type=`) |
| POST | `/blocked` | เพิ่มเลขอั้น |
| DELETE | `/blocked/:id` | ลบเลขอั้น |

## 5. แทง/เล่น (Betting) — 6 endpoints
| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| POST | `/betting/preview` | คำนวณเงิน + เช็คเลข + เช็คเครดิต (ไม่บันทึก) |
| POST | `/betting/bet` | ส่งโพย (ตัดเครดิตจริง + เช็คเลขอั้น + เช็คเปิด-ปิด) |
| GET | `/betting/tickets` | ดูโพย (กรอง `?userId=` `&status=`) |
| GET | `/betting/tickets/:id` | ดูโพยเดียว |
| POST | `/betting/tickets/:id/cancel` | ยกเลิกโพย (คืนเครดิต) |
| POST | `/betting/tickets/:id/status` | อัปเดตสถานะโพย (win/lose/confirmed) |

## 6. ผลรางวัล (Results) — 3 endpoints
| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| GET | `/results` | ดูผลรางวัล (กรอง `?type=` `&date=`) |
| POST | `/results` | บันทึกผลรางวัลใหม่ |
| POST | `/results/settle` | ⭐ ตรวจรางวัล + จ่ายเงินให้โพยทั้งหมดอัตโนมัติ |

## 7. การเงิน (Finance) — 6 endpoints
| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| GET | `/finance/balance/:userId` | เช็คเครดิต |
| POST | `/finance/topup` | เติมเครดิต (แอดมิน) |
| POST | `/finance/deposit` | แจ้งฝาก (รออนุมัติ) |
| POST | `/finance/withdraw` | แจ้งถอน (รออนุมัติ, ตัดเครดิตทันที) |
| POST | `/finance/transactions/:id/review` | อนุมัติ/ปฏิเสธธุรกรรม |
| GET | `/finance/transactions` | ประวัติธุรกรรม (กรอง `?userId=` `&type=` `&status=`) |

## 8. รายงาน (Reports) — 5 endpoints
| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| GET | `/reports/summary` | ภาพรวมระบบ (Dashboard) |
| GET | `/reports/betting` | รายงานการเล่น (ยอดแทง/ถูก/กำไร) |
| GET | `/reports/finance` | รายงานการเงิน (ฝาก/ถอน/เติม) |
| GET | `/reports/agents` | รายชื่อเอเย่นต์ + เครดิต |
| GET | `/reports/members` | รายชื่อสมาชิก |

## 9. ระบบคิว (Queue) — 5 endpoints
| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| POST | `/queue/enqueue` | เข้าคิวโพย |
| GET | `/queue` | ดูคิวทั้งหมด (กรอง `?status=`) |
| GET | `/queue/:id` | ดูสถานะคิว + ตำแหน่งในคิว |
| POST | `/queue/:id/status` | อัปเดตสถานะคิว |
| POST | `/queue/process` | ประมวลผลคิว (worker: queued → tickets) |

## 10. สมาชิก (Users) — 4 endpoints
| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| GET | `/users` | รายชื่อสมาชิก |
| GET | `/users/:id` | ดูสมาชิกเดียว |
| POST | `/users` | สร้าง/อัปเดตสมาชิก |
| POST | `/users/:id/toggle` | เปิด/ปิดสมาชิก |

## 11. เอเย่นต์ (Agents) — 4 endpoints
| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| GET | `/agents` | รายชื่อเอเย่นต์ |
| POST | `/agents` | สร้าง/อัปเดตเอเย่นต์ |
| POST | `/agents/:id/topup` | เติมเครดิตให้เอเย่นต์ |
| POST | `/agents/:id/toggle` | เปิด/ปิดเอเย่นต์ |

## 12. API Keys — 4 endpoints
| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| GET | `/keys` | ดู API Keys ทั้งหมด (ปิดบังคีย์) |
| POST | `/keys` | สร้าง API Key ใหม่ |
| POST | `/keys/:id/toggle` | เปิด/ปิดคีย์ |
| DELETE | `/keys/:id` | ลบคีย์ |

---

## ตัวอย่างการใช้งาน

### ส่งโพย (Betting)
```bash
curl -X POST "http://localhost:3000/api/v1/betting/bet" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "lotteryType": "หวยรัฐบาล",
    "userId": "demo_user",
    "bets": [{"number":"123","type":"3ตัวบน","amount":100}]
  }'
```

### ตรวจรางวัล (Settle)
```bash
curl -X POST "http://localhost:3000/api/v1/results/settle" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "lotteryType": "หวยรัฐบาล",
    "result": {"top3":"123","top2":"23","bottom2":"45"}
  }'
```

### เปิด/ปิดรับแทงทั้งระบบ
```bash
curl -X POST "http://localhost:3000/api/v1/system/toggle" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"key":"bettingOpen","value":false,"message":"ปิดปรับปรุง 30 นาที"}'
```

---

## โครงสร้างไฟล์
```
server/
├── middleware/
│   └── auth.ts          # API Key auth + scope
└── routes/
    ├── system.ts        # ระบบ เปิด/ปิด
    ├── lottery.ts       # หวย + รอบ + เลขอั้น
    ├── betting.ts       # แทง/เล่น
    ├── results.ts       # ผลรางวัล + settle
    ├── finance.ts       # การเงิน
    ├── reports.ts       # รายงาน
    ├── queue.ts         # ระบบคิว
    └── users.ts         # สมาชิก + เอเย่นต์ + API Keys
server.ts                # ประกอบ routes ทั้งหมด
```

## หมายเหตุ Firestore Rules
`firestore.rules` เปิด read/write ให้ collections ที่ API ใช้ **เพราะ server ไม่มี Firebase Auth context**
⚠️ ถ้าไป production ควรเปลี่ยนไปใช้ **Firebase Admin SDK (service account)** แล้วปิด rules ให้เหลือแค่ admin
