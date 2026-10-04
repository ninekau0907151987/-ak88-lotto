# 📘 AK88 LOTTO — Master System Architecture & Engine Documentation (DOC)

> **เวอร์ชันเอกสาร:** 2.4 (Production Certified)  
> **อัปเดตล่าสุด:** 04 ตุลาคม 2026  
> **ระบบฐานข้อมูล:** Supabase PostgreSQL / Multi-Region Distributed Engine  
> **สถานะระบบ:** 🟢 **Production Ready (Vercel + Docker Ready)**

---

## สารบัญ (Table of Contents)
1. [ภาพรวมสถาปัตยกรรมระดับองค์กร (Enterprise Architecture Overview)](#1-ภาพรวมสถาปัตยกรรมระดับองค์กร)
2. [ไดอาแกรมวงจรชีวิตหวยและการเปิดรอบ (Lottery Lifecycle & Scheduling)](#2-ไดอาแกรมวงจรชีวิตหวยและการเปิดรอบ)
3. [ไดอาแกรมการตั้งค่าความเสี่ยง งบรับกิน และเลขอั้น (Risk & Intake Management)](#3-ไดอาแกรมการตั้งค่าความเสี่ยง-งบรับกิน-และเลขอั้น)
4. [ไดอาแกรมกระบวนการแทง คิว และความปลอดภัยทางการเงิน (Bet Execution & Idempotency Pipeline)](#4-ไดอาแกรมกระบวนการแทง-คิว-และความปลอดภัยทางการเงิน)
5. [ไดอาแกรมการมอนิเตอร์ยอดรับสูงสุดและระบบยกเลิกโพย (Exposure Monitoring & Cancellation)](#5-ไดอาแกรมการมอนิเตอร์ยอดรับสูงสุดและระบบยกเลิกโพย)
6. [ไดอาแกรมเครื่องจักรออกผล ตัดหวย และจ่ายเงินรางวัล (Result Settlement Engine)](#6-ไดอาแกรมเครื่องจักรออกผล-ตัดหวย-และจ่ายเงินรางวัล)
7. [ไดอาแกรมระบบรายงาน การค้นหา และตรวจสอบบัญชี (Reporting & Audit Hub)](#7-ไดอาแกรมระบบรายงาน-การค้นหา-และตรวจสอบบัญชี)
8. [โครงสร้างตารางฐานข้อมูลและ Data Dictionary (Schema Specifications)](#8-โครงสร้างตารางฐานข้อมูลและ-data-dictionary)
9. [คู่มือการติดตั้งและการรันระบบผ่าน Docker (Container Deployment)](#9-คู่มือการติดตั้งและการรันระบบผ่าน-docker)

---

## 1. ภาพรวมสถาปัตยกรรมระดับองค์กร

ระบบ AK88 LOTTO ออกแบบด้วยหลักการ **Event-Driven & Atomic Financial Ledger** เพื่อรับประกันความถูกต้องแม่นยำทางการเงิน ป้องกันข้อผิดพลาดการแทงซ้ำ (Double Spending) และควบคุมความเสี่ยงของเจ้ามือได้อย่างสมบูรณ์

```mermaid
flowchart TD
    subgraph Layer1["1. Admin & Risk Configuration (การตั้งค่าและการควบคุม)"]
        A1["สร้างหวย / จัดหมวดหมู่<br/>(Catalog Management)"] --> A1_Switch["เปิด - ปิดประเภทหวยหลัก<br/>(Master Lottery Open-Close Switch)"]
        A1_Switch --> A2["เปิดรอบ - ปิดรอบ / จัดตารางรอบ<br/>(Round Open-Close & Cutoff Scheduler)"]
        A2 --> A3["ตั้งค่าจ่าย & สัดส่วนรับกิน<br/>(Base Rates & Intake Budget)"]
        A3 --> A4["ตั้งค่าอั้น / ปิดรับ / ลดจ่าย<br/>(Blocked & Reduced Rules)"]
    end

    subgraph Layer2["2. Betting & Transaction Pipeline (การแทง คิว และความปลอดภัย)"]
        B1["สมาชิกเลือกเลข & รูปแบบแทง<br/>(Betting Form & Expansion)"] --> B2["ตรวจสอบเงื่อนไข & วงเงิน<br/>(Pre-flight Validation)"]
        B2 --> B3["คิวบันทึก & ล็อคยอดหักเงิน<br/>(Atomic Balance Deduction)"]
        B3 --> B4["ออกใบเสร็จโพย 3D & QR Verification<br/>(Idempotent Ticket Confirmation)"]
    end

    subgraph Layer3["3. Real-Time Risk & Monitoring (การมอนิเตอร์และคุมยอดเสี่ยง)"]
        C1["คำนวณยอดแทงสะสมรายเลข<br/>(Live Intake Accumulation)"] --> C2["คำนวณยอดจ่ายสูงสุด<br/>(Worst-Case Liability Matrix)"]
        C2 --> C3["แจ้งเตือน & ปรับลด/ปิดรับออโต้<br/>(Auto Capping / Instant Cutoff)"]
        C4["ระบบยกเลิกโพย & คืนเงิน<br/>(Grace Period Cancel & Refund)"]
    end

    subgraph Layer4["4. Result Settlement & Reporting (การออกผล ตัดบิล และรายงาน)"]
        D1["บันทึกผลรางวัล<br/>(Admin Draw / Yeekee Auto Engine)"] --> D2["Settlement Worker ประมวลผล<br/>(Batch Bet Matching & Tax Deduct)"]
        D2 --> D3["โอนเงินรางวัล & อัปเดตสถานะบิล<br/>(Atomic Credit Win & Close Ticket)"]
        D3 --> D4["สรุปรายงานได้-เสีย & ค้นหาเชิงลึก<br/>(Win/Loss Audit & Search Hub)"]
    end

    Layer1 --> Layer2
    Layer2 --> Layer3
    Layer3 --> Layer4
```

---

## 2. ไดอาแกรมวงจรชีวิตหวย: การเปิด-ปิดประเภทหวยหลัก สู่ การเปิดรอบ-ปิดรอบ (2-Tier Hierarchy)

ตามหลักการทำงานจริงของระบบหวยสากล ขั้นตอนการเปิด-ปิดถูกแยกออกเป็น **2 ระดับชั้น (2 Tiers)** อย่างชัดเจน:

1. **ระดับที่ 1 — เปิด - ปิดประเภทหวยหลัก (Master Lottery Open/Close Switch):**  
   หลังจาก **"สร้างหวย / แค็ตตาล็อก"** เสร็จสิ้นแล้ว จะต้องผ่านสวิตช์เปิด-ปิดหลักของหวยชนิดนั้นก่อน เพื่อควบคุมว่าหวยชนิดนี้ *"เปิดให้บริการ (Active)"* หรือ *"ปิดพักระบบ/ปิดปรับปรุง (Closed/Disabled)"* หากหวยปิดอยู่ในระดับมาสเตอร์ ระบบหน้าบ้านจะไม่เปิดรับแทง และระบบหลังบ้านจะไม่สามารถเปิดรอบใหม่ได้
2. **ระดับที่ 2 — เปิดรอบ และ ปิดรอบ (Round Open & Close Lifecycle):**  
   เมื่อประเภทหวยหลักอยู่ในสถานะ **"เปิด"** แล้วเท่านั้น จึงจะสามารถ:
   - **เปิดรอบ (Open Round):** กำหนดงวดวันที่, เวลาเปิดรับแทง, เวลาปิดรับแทง และเวลาออกผล (ทั้งแบบรอบเดี่ยว, ตาราง 5 งวดล่วงหน้า หรือยี่กี 88 รอบอัตโนมัติ)
   - **ปิดรอบ (Close Round / Cutoff):** เมื่อหมดเวลานับถอยหลัง หรือแอดมินกดสั่งปิดรอบฉุกเฉิน ระบบจะตัดรอบทันที ห้ามส่งโพยเพิ่ม และเปลี่ยนสถานะรอบเป็น *"รอผลรางวัล (Pending Result)"*

```mermaid
flowchart TD
    Step1["1. สร้างหวย / แค็ตตาล็อก<br/>(Catalog Management: ชื่อ, รหัส, ธงชาติ, หมวดหมู่)"] --> MasterSwitch{"2. สวิตช์ เปิด - ปิดประเภทหวยหลัก<br/>(Master Lottery Open-Close Switch)"}

    MasterSwitch -- "สถานะ: ปิด (Closed / Inactive)" --> MasterClosed["⛔ ปิดให้บริการหวยประเภทนี้ชั่วคราว<br/>• หน้าบ้านไม่เปิดรับแทง<br/>• แอดมินไม่สามารถเปิดรอบใหม่ได้"]
    MasterSwitch -- "สถานะ: เปิด (Active / Enabled)" --> MasterOpen["✅ หวยเปิดพร้อมให้บริการ<br/>(อนุญาตให้เปิดรอบและรับแทงได้)"]

    MasterOpen --> RoundScheduler{"3. การจัดการรอบหวย<br/>(Round Open - Close Scheduler)"}

    subgraph RoundLevel["วงจรการเปิดรอบ - ปิดรอบ (Round Level)"]
        RoundScheduler -- "หวยยี่กี 88 รอบ" --> YK_Sweep["ยี่กี Dynamic Sweep Engine<br/>คำนวณรอบ 1-88 วนทุก 15 นาที"]
        RoundScheduler -- "หวยรัฐบาล/หุ้น/ต่างประเทศ" --> SetRoundType{"รูปแบบการเปิดรอบ"}
        
        SetRoundType -- "เปิดรอบเดี่ยว (Single)" --> SetSingle["กำหนด: งวดวันที่, เวลาเปิด, เวลาปิด, เวลาออกผล"]
        SetRoundType -- "เปิดตารางล่วงหน้า (Batch)" --> SetBatch["ตั้งตารางล่วงหน้าสูงสุด 5 งวด"]

        SetSingle & SetBatch & YK_Sweep --> RoundGuard{"Guard System ตรวจสอบ"}
        RoundGuard -- "มีรอบก่อนหน้าค้างไม่ออกผล" --> BlockRound["ระงับเปิดรอบใหม่ชั่วคราว"]
        RoundGuard -- "รอบก่อนหน้าเสร็จสมบูรณ์" --> OpenRound["🟢 เปิดรอบรับแทง (Round Open)<br/>Countdown นับถอยหลัง / สมาชิกส่งโพยได้"]

        OpenRound --> CheckCutoff{"ถึงเวลาปิดรับแทง (Cutoff Time)<br/>หรือ แอดมินสั่งปิดรอบทันที?"}
        CheckCutoff -- "ถึงเวลาปิดรับแทง" --> CloseRound["🔴 ปิดรอบรับแทง (Round Closed / Cutoff)<br/>ห้ามส่งโพยเพิ่ม / เข้าสู่สถานะรอออกผล"]
    end

    CloseRound --> Step4["4. เข้าสู่การตั้งค่าจ่าย-กิน ความเสี่ยง และ ออกผลรางวัล"]
```

---

## 3. ไดอาแกรมการตั้งค่าความเสี่ยง งบรับกิน และเลขอั้น

โครงสร้างการควบคุมความเสี่ยงของเจ้ามือ (Risk Management) คำนวณเป็นเมทริกซ์ 3 ชั้น:

1. **อัตราจ่ายเต็ม (Base Payout Rates):** เช่น 3 ตัวบน ฿900, 2 ตัวบน ฿92
2. **งบรับกินรวม (Global Risk Budget) & การจัดสรรสัดส่วน (Allocation %):**
   $$\text{Max Intake Per Number} = \frac{\text{Global Budget} \times \text{Allocation \%}}{\text{Exposure Weight}}$$
3. **การควบคุมเลขอั้น (Risk Limits):**
   - **เลขปิดรับ 100% (Blocked):** ระบบปฏิเสธการแทงทันที
   - **เลขลดราคาจ่าย (Reduced / Halved Payout):** สมาชิกยังคงแทงได้ แต่อัตราจ่ายถูกปรับลง (เช่น ฿900 เหลือ ฿500) และบันทึก `payoutRate` นั้นลงบิลทันที

```mermaid
flowchart TD
    subgraph Config["การตั้งค่าหลังบ้าน (Risk Settings)"]
        B1["กำหนดงบรับกินรวม (Global Risk Budget)<br/>เช่น ฿200,000"] --> B2["กระจายสัดส่วนรับกิน (Allocation %)<br/>• 3 ตัวบน: 35% (฿70,000)<br/>• 2 ตัวบน: 25% (฿50,000)<br/>• 2 ตัวล่าง: 20% (฿40,000)"]
        B2 --> B3["คำนวณเพดานรับกินต่อตัวเลข<br/>(Max Intake Per Number)"]
        
        R1["กำหนดเลขอั้นรายตัว / กลุ่ม"] --> R2{"ประเภทข้อจำกัด"}
        R2 -- "ปิดรับ 100%" --> BlockedRule["🚫 เลขปิดรับ (Blocked)<br/>สมาชิกกดแทงไม่ได้เด็ดขาด"]
        R2 -- "ลดราคาจ่าย" --> ReducedRule["📉 เลขจ่ายครึ่ง/ลดราคา (Reduced)<br/>รับแทง แต่อัตราจ่ายลดลง (เช่น ฿500)"]
    end

    subgraph RuntimeExposure["การเฝ้าระวังขณะเปิดรับแทง (Live Exposure)"]
        M1["สมาชิกระดมแทงเลขใดเลขหนึ่ง"] --> M2["ระบบคำนวณ Intake สะสมของเลขนั้น"]
        M2 --> M3{"ยอดสะสมเทียบกับเพดาน"}
        M3 -- "< 70%" --> StateGreen["🟢 ระดับปกติ (Normal)"]
        M3 -- "70% - 99%" --> StateNear["🟡 ระดับใกล้เต็ม (Near Full)<br/>แจ้งเตือนแอดมิน"]
        M3 -- "ครบ 100%" --> StateFull["🔴 ระดับเต็มเพดาน (Full Cap)<br/>ระบบปิดรับเลขนี้อัตโนมัติ"]
    end

    Config -.-> RuntimeExposure
```

---

## 4. ไดอาแกรมกระบวนการแทง คิว และความปลอดภัยทางการเงิน

ระบบปฏิบัติตามมาตรฐาน **Financial Idempotency** เพื่อรับประกันว่าไม่มีการแทงซ้ำซ้อน และยอดเงินถูกตัดแบบ Atomic:

```mermaid
sequenceDiagram
    autonumber
    actor User as สมาชิก (User)
    participant UI as แผงแทงหวย (LotteryBet)
    participant Engine as ระบบตรวจคิว (Bet Validator)
    participant Ledger as กระเป๋าเงิน (User Ledger)
    participant DB as ฐานข้อมูลตั๋ว (Tickets / DB)

    User->>UI: เลือกเลข / กระจายเลข / ใส่ราคา (เช่น 5 บ.)
    User->>UI: กดปุ่ม "ส่งโพย"
    UI->>Engine: ตรวจสอบเงื่อนไข (Pre-flight Checks)
    
    rect rgb(240, 248, 255)
        Note over Engine: 1. ตรวจสอบเวลา: currentTime < closeTime?<br/>2. ตรวจสอบเลขอั้น: มีเลขปิดรับหรือไม่?<br/>3. ดึงอัตราจ่าย: เป็นราคาเต็ม หรือ ราคาลด?<br/>4. ตรวจสอบยอดเงิน: balance >= totalBetAmount?
    end

    alt มีข้อผิดพลาด (เช่น เลขปิด / เงินไม่พอ / รอบปิดแล้ว)
        Engine-->>UI: ❌ แจ้งเตือนข้อผิดพลาด & ปฏิเสธรายการ
        UI-->>User: แสดง Pop-up ข้อความผิดพลาด
    else ผ่านการตรวจสอบทุกข้อ
        Engine->>Ledger: 🔒 ขอหักยอดเงินคงเหลือ (Atomic Transaction)
        Note over Ledger: UPDATE users SET balance = balance - totalAmount<br/>WHERE id = ? AND balance >= totalAmount
        Ledger-->>Engine: ✅ หักเงินสำเร็จ บันทึก Transaction 'bet'
        
        Engine->>DB: 📝 บันทึกตั๋วโพย (Create Ticket)
        Note over DB: สร้าง Ticket ID: TK-TH-YYYYMMDD-XXXX<br/>บันทึก: รายการแทง, อัตราจ่ายรายตัว, โอกาสถูกสูงสุด,<br/>สถานะ: pending_cancellation (จับเวลา 60 วินาที)
        DB-->>UI: ✅ ยืนยันโพยเข้าสู่ระบบ 100%
        
        UI->>User: 🎟️ เด้งใบเสร็จโพย 3D นูนขึ้น + QR Code สถานะ
    end
```

---

## 5. ไดอาแกรมการมอนิเตอร์ยอดรับสูงสุดและระบบยกเลิกโพย

```mermaid
flowchart TD
    subgraph Monitor["ระบบมอนิเตอร์ความเสี่ยง (Risk Intake Monitor)"]
        T1["โพยที่ยืนยันแล้วทั้งหมด"] --> T2["คำนวณ ยอดแทงรวม (Total Intake)"]
        T1 --> T3["คำนวณ โอกาสจ่ายสูงสุด (Worst-Case Liability)<br/>Liability = Intake x Payout Rate"]
        T3 --> T4["แสดงแผงสรุปความเสี่ยงแอดมิน<br/>• เลขตัวไหนเสี่ยงขาดทุนสูงสุด<br/>• ปุ่ม One-Click: ปิดรับทันที / ลดราคา / ขยายเพดาน"]
    end

    subgraph CancelFlow["กลไกการยกเลิกโพย (Bet Cancellation / Void)"]
        C_Trigger{"ผู้ขอยกเลิก"}
        
        C_Trigger -- "สมาชิก (User Self-Cancel)" --> UserCheck{"ตรวจเงื่อนไข Grace Period"}
        UserCheck -- "ยังอยู่ในเวลา 60 วินาที และรอบยังเปิดอยู่" --> DoRefund["ดำเนินการยกเลิกโพย"]
        UserCheck -- "เกิน 60 วินาที หรือรอบปิดแล้ว" --> RejectCancel["❌ ปฏิเสธการยกเลิก"]

        C_Trigger -- "แอดมิน (Admin Void / Cancel Round)" --> AdminReason["ระบุเหตุผลการยกเลิก<br/>(เช่น สัญญาณผลมีปัญหา / รอบโมฆะ)"]
        AdminReason --> DoRefund

        DoRefund --> RefundMoney["💰 คืนเงินเข้ากระเป๋าแบบ Atomic<br/>UPDATE users SET balance = balance + totalAmount"]
        RefundMoney --> LogTx["บันทึก Transaction 'refund'"]
        LogTx --> UpdateStatus["เปลี่ยนสถานะโพยเป็น 'cancelled'"]
        UpdateStatus --> ReleaseIntake["คืนโควตายอดรับกินของตัวเลขนั้นทันที"]
    end
```

---

## 6. ไดอาแกรมเครื่องจักรออกผล ตัดหวย และจ่ายเงินรางวัล

```mermaid
flowchart TD
    DrawStart(["ถึงเวลาออกผลรางวัล"]) --> InputResult{"วิธีการออกผล"}

    InputResult -- "หวยรัฐบาล / หุ้น / ต่างประเทศ" --> AdminInput["แอดมินกรอกผลรางวัล<br/>(3 ตัวบน, 2 ตัวล่าง, 3 ตัวหน้า, 3 ตัวล่าง)"]
    InputResult -- "หวยจับยี่กี VIP" --> YeekeeAuto["ระบบยิงเลขประมวลผลสูตรยี่กี<br/>(ผลรวม 16 ลำดับ - ลำดับที่ 16)"]

    AdminInput --> LockRound["🔒 ปิดรอบถาวร (Status: Resulted / Closed)"]
    YeekeeAuto --> LockRound

    LockRound --> QueryTickets["ดึงโพยทั้งหมดในงวดนั้นที่สถานะ 'active' / 'confirmed'"]

    subgraph SettlementLoop["วนประมวลผลทีละโพย (Settlement Worker)"]
        Q1["ดึงรายการแทงแต่ละแถว (Bet Items)"] --> Q2{"ตรวจเงื่อนไขการถูกรางวัล"}
        
        Q2 -- "3 ตัวบน" --> Check3Top["เลขตรงกับ 3 ตัวบน?"]
        Q2 -- "3 ตัวโต๊ด" --> Check3Tod["ตัวเลขเดียวกันสลับตำแหน่งได้?"]
        Q2 -- "2 ตัวบน / ล่าง" --> Check2["เลขตรงกับ 2 ตัวบน / 2 ตัวล่าง?"]
        Q2 -- "วิ่งบน / วิ่งล่าง" --> CheckRun["มีตัวเลขปรากฏในรางวัล?"]

        Check3Top & Check3Tod & Check2 & CheckRun --> CalcWin["คำนวณเงินรางวัล:<br/>Win Amount = ยอดแทง x อัตราจ่ายจริงของตัวนั้น (appliedRate)"]
        
        CalcWin --> TaxCheck{"มีการตั้งค่าภาษี/หัก % หรือไม่?"}
        TaxCheck -- "มี" --> DeductTax["หักภาษีตาม % ที่ตั้งไว้"]
        TaxCheck -- "ไม่มี" --> NetWin["ยอดเงินรางวัลสุทธิ (Net Win)"]

        NetWin --> WinResult{"ยอดชนะ > 0 ?"}
        WinResult -- "ถูกรางวัล" --> CreditUser["🎉 โอนเงินรางวัลเข้ากระเป๋าผู้เล่นทันที<br/>+ บันทึก Transaction 'win'"]
        WinResult -- "ไม่ถูกรางวัล" --> MarkLose["บันทึกสถานะโพยเป็น 'lose'"]
        CreditUser --> MarkWin["บันทึกสถานะโพยเป็น 'win' พร้อมยอดเงินที่ได้"]
    end

    QueryTickets --> SettlementLoop
    SettlementLoop --> SettleSummary["📊 สรุปงบการเงินประจำงวด:<br/>• ยอดแทงรวม (Total Intake)<br/>• ยอดจ่ายรางวัลรวม (Total Payout)<br/>• กำไร/ขาดทุนสุทธิของระบบ (Net Profit/Loss)"]
```

---

## 7. ไดอาแกรมระบบรายงาน การค้นหา และตรวจสอบบัญชี

```mermaid
flowchart LR
    subgraph DataLake["คลังข้อมูลธุรกรรม (Transaction & Audit Ledger)"]
        D_Tickets[("ตารางโพยหวย (tickets)")]
        D_Tx[("ตารางเงิน (transactions)")]
        D_Logs[("ประวัติกิจกรรม (audit_logs)")]
        D_Results[("ประวัติผลรางวัล (lotteryResults)")]
    end

    subgraph SearchEngine["เครื่องมือค้นหา (Deep Search Hub)"]
        S1["🔍 ค้นหาตามเลขที่บิล (Ticket ID)"]
        S2["🔍 ค้นหาตามเบอร์โทร / สมาชิก (User Phone/ID)"]
        S3["🔍 ค้นหาตามตัวเลขที่แทง (Specific Number)"]
        S4["🔍 ค้นหาตามช่วงวันที่ & สถานะบิล"]
    end

    subgraph Reports["ระบบสรุปรายงาน (Management Reports)"]
        R1["📈 รายงานได้-เสียประจำงวด (Round Win/Loss)"]
        R2["🏆 รายงานสรุปตามประเภทหวย (Category Performance)"]
        R3["🤝 รายงานยอดแทงเอเย่นต์ & ค่าคอม (Agent Turnover)"]
        R4["🛡️ รายงานประวัติความเสี่ยง & เลขอั้น (Risk Exposure Log)"]
    end

    DataLake --> SearchEngine
    DataLake --> Reports
```

---

## 8. โครงสร้างตารางฐานข้อมูลและ Data Dictionary

### 8.1 ตาราง `users` (ตารางสมาชิกและกระเป๋าเงิน)
| ฟิลด์ | ชนิดข้อมูล | คำอธิบาย |
|---|---|---|
| `id` | `VARCHAR(64)` | รหัสผู้ใช้ (เช่น `user_a123456`) (Primary Key) |
| `username` | `VARCHAR(50)` | ยูสเซอร์เนมเข้าสู่ระบบ |
| `phone` | `VARCHAR(20)` | เบอร์โทรศัพท์สำหรับเข้าสู่ระบบ |
| `password` | `VARCHAR(100)` | รหัสผ่านผู้ใช้งาน |
| `balance` | `DECIMAL(12, 2)` | ยอดเงินคงเหลือในกระเป๋าหลัก |
| `role` | `VARCHAR(20)` | สิทธิ์การใช้งาน (`user`, `agent`, `admin`, `owner`) |
| `status` | `VARCHAR(20)` | สถานะบัญชี (`active`, `suspended`, `banned`) |

### 8.2 ตาราง `tickets` (ตารางโพยหวย)
| ฟิลด์ | ชนิดข้อมูล | คำอธิบาย |
|---|---|---|
| `id` | `VARCHAR(64)` | Document ID ในระบบ (Primary Key) |
| `ticketId` | `VARCHAR(50)` | รหัสบิลอ้างอิง (เช่น `TK-TH-20261004-8891`) |
| `userId` | `VARCHAR(64)` | รหัสสมาชิกผู้ส่งโพย |
| `lotteryType` | `VARCHAR(50)` | ชื่อประเภทหวย (เช่น `หวยรัฐบาลไทย`) |
| `roundId` | `VARCHAR(64)` | รหัสงวดหวย |
| `totalAmount` | `DECIMAL(10, 2)` | ยอดเงินแทงรวมของบิล |
| `potentialMaxWin` | `DECIMAL(12, 2)` | โอกาสได้รับรางวัลสูงสุดตามอัตราจ่าย |
| `bets` | `JSONB` | อาเรย์รายการแทง `[{type, number, amount, payoutRate}]` |
| `status` | `VARCHAR(30)` | สถานะโพย (`pending_cancellation`, `active`, `win`, `lose`, `cancelled`) |
| `winAmount` | `DECIMAL(12, 2)` | ยอดเงินรางวัลที่ได้รับจริงหลังออกผล |
| `expiresAt` | `TIMESTAMP` | เวลาหมดอายุ Grace Period สำหรับยกเลิกบิล |
| `createdAt` | `TIMESTAMP` | วันที่และเวลาที่บันทึกโพย |

### 8.3 ตาราง `transactions` (ตารางประวัติธุรกรรมการเงิน)
| ฟิลด์ | ชนิดข้อมูล | คำอธิบาย |
|---|---|---|
| `id` | `VARCHAR(64)` | รหัสธุรกรรม (Primary Key) |
| `userId` | `VARCHAR(64)` | รหัสสมาชิก |
| `type` | `VARCHAR(20)` | ประเภทธุรกรรม (`deposit`, `withdraw`, `bet`, `win`, `refund`) |
| `amount` | `DECIMAL(12, 2)` | จำนวนเงินของธุรกรรม |
| `description` | `TEXT` | รายละเอียดธุรกรรม (เช่น `ส่งโพย TK-TH-...`, `คืนเงินยกเลิกโพย`) |
| `createdAt` | `TIMESTAMP` | วันเวลาที่เกิดธุรกรรม |

---

## 9. คู่มือการติดตั้งและการรันระบบผ่าน Docker

ระบบมีไฟล์คอนฟิก **Container Production** รองรับการ Deploy ได้ทันทีทั้งแบบ Standalone Container หรือ Docker Compose:

### 9.1 คำสั่งเริ่มการทำงาน (Start Service)
```bash
# สั่งสร้างอิมเมจและรันโปรดักชันคอนเทนเนอร์ในโหมด Background
docker-compose up -d --build
```

### 9.2 การตรวจสอบสถานะและ Logs
```bash
# ตรวจสอบสถานะคอนเทนเนอร์และ Health Check
docker ps -a --filter name=ak88-lotto-production

# ดูบันทึกการทำงานแบบ Realtime
docker logs -f ak88-lotto-production
```

### 9.3 การหยุดการทำงาน (Graceful Shutdown)
```bash
docker-compose down
```
