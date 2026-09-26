# คู่มือการติดตั้งและ Deploy ระบบ AK88 LOTTO สู่ Production (VPS / Cloud)

เอกสารนี้รวบรวมขั้นตอนการนำระบบ **AK88 LOTTO** ขึ้นสู่เครื่องเซิร์ฟเวอร์จริง (Production VPS) อย่างสมบูรณ์ รองรับผู้ใช้งานพร้อมกัน มีระบบความปลอดภัย และระบบอัตโนมัติ 24 ชั่วโมง

---

## 1. ข้อมูลสถาปัตยกรรมระบบ (System Architecture)
- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS (Single Page Application เสิร์ฟผ่าน Express Static Caching)
- **Backend API:** Node.js (Express) + TypeScript (คอมไพล์เป็น `dist/server.cjs` ผ่าน esbuild)
- **Database:** Google Cloud Firestore (พร้อม In-memory Atomic Ledger Fallback)
- **Automated Engine:** 24/7 Yeekee Engine Worker (ออกผลทุก 15 นาที 88 รอบต่อวัน, ตัดรอบอัตโนมัติ, ยิงบอท 16 ตัว, คิดผลรวม, จ่ายเงินรางวัลผู้ยิงเลข, ตัดบิลผู้ถูกรางวัล)
- **Payment & Security:** 
  - ระบบสร้าง PromptPay QR Code อัตโนมัติ
  - ระบบตรวจจับและอ่านค่าสลิปโอนเงิน (Slip Verification + Anti-Replay Guard)
  - ระบบ SMS OTP 6 หลัก และรีเซ็ตรหัสผ่านปลอดภัย
  - ระบบถอนเงินเข้าบัญชีธนาคารพร้อมตัดยอด Escrow ทันที

---

## 2. สิ่งที่ต้องเตรียม (Prerequisites)
1. **Server Spec ขั้นต่ำ:**
   - OS: Ubuntu 22.04 LTS หรือ Debian 12
   - CPU: 2 Core ขึ้นไป
   - RAM: 2 GB ขึ้นไป (แนะนำ 4 GB)
   - Disk: SSD 20 GB ขึ้นไป
2. **เครื่องมือที่ต้องติดตั้งใน Server:**
   - Docker & Docker Compose (สำหรับวิธีที่ 1)
   - หรือ Node.js v20.x + npm + PM2 (สำหรับวิธีที่ 2)
   - Nginx (Reverse Proxy) + Certbot (SSL HTTPS)

---

## 3. วิธีที่ 1: Deploy ด้วย Docker & Docker Compose (แนะนำ สะดวกและเสถียรที่สุด)

### ขั้นตอนที่ 1: โคลนโค้ดลงเซิร์ฟเวอร์
```bash
git clone git@github.com:99maker789/ak88-lotto.git /opt/ak88-lotto
cd /opt/ak88-lotto
```

### ขั้นตอนที่ 2: ตั้งค่า Environment (.env)
สร้างหรือแก้ไขไฟล์ `.env`:
```bash
cat << 'EOF' > .env
NODE_ENV=production
PORT=3000

# ข้อมูลบัญชีธนาคารรับเงินของระบบ (แสดงบน PromptPay QR)
BANK_PROMPTPAY_PHONE=0812345678
BANK_NAME=ธนาคารกสิกรไทย (KBANK)
BANK_ACCOUNT=123-4-56789-0
BANK_RECEIVER_NAME=AK88 LOTTO AUTO SYSTEM

# API Keys ภายนอก (ใส่เมื่อเปิดใช้บริการจริง)
SLIP_VERIFY_API_KEY=
SMS_API_KEY=
EOF
```

### ขั้นตอนที่ 3: สั่งรันด้วย Docker Compose
```bash
docker compose up -d --build
```

### ขั้นตอนที่ 4: ตรวจสอบสถานะการทำงาน
```bash
# ดูสถานะคอนเทนเนอร์
docker compose ps

# ดู Live Logs ของระบบและ Yeekee Worker
docker compose logs -f --tail=100
```

---

## 4. วิธีที่ 2: Deploy ด้วย Node.js 20 + PM2

หากไม่ต้องการใช้ Docker สามารถรันบน Node.js โดยตรงได้:

### ขั้นตอนที่ 1: ติดตั้ง Node.js 20 และ PM2
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pm2
```

### ขั้นตอนที่ 2: ติดตั้ง Dependencies และ Build
```bash
cd /opt/ak88-lotto
npm ci
npm run build
```

### ขั้นตอนที่ 3: สั่งรันผ่าน PM2
```bash
PORT=3000 NODE_ENV=production pm2 start dist/server.cjs --name "ak88-lotto" --time
pm2 save
pm2 startup
```

---

## 5. การตั้งค่า Nginx Reverse Proxy และ SSL (HTTPS)

### ขั้นตอนที่ 1: ติดตั้ง Nginx และ Certbot
```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

### ขั้นตอนที่ 2: สร้างไฟล์ Nginx Configuration
สร้างไฟล์ `/etc/nginx/sites-available/ak88-lotto`:
```nginx
server {
    server_name yourdomain.com www.yourdomain.com;

    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### ขั้นตอนที่ 3: เปิดใช้งานและออกใบรับรอง SSL
```bash
sudo ln -s /etc/nginx/sites-available/ak88-lotto /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# ขอ SSL ฟรีจาก Let's Encrypt
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

---

## 6. สรุปเส้นทางเข้าใช้งานระบบ (Access URLs)

| ส่วนงาน | เส้นทาง (URL) | บัญชีเข้าใช้งานเริ่มต้น |
|---|---|---|
| **หน้าหลักสมาชิก** | `https://yourdomain.com/` | สมาชิกทั่วไป |
| **สมัครสมาชิกจริง** | `https://yourdomain.com/register` | สมัครด้วยเบอร์โทร + บัญชีธนาคาร |
| **เข้าสู่ระบบสมาชิก** | `https://yourdomain.com/login` | เข้าด้วยเบอร์โทร/Username |
| **ลืมรหัสผ่าน (SMS OTP)** | `https://yourdomain.com/forgot-password` | ยืนยันรหัส OTP 6 หลัก |
| **ฝากเงินออโต้ (QR Slip)** | `https://yourdomain.com/deposit` | สแกน QR โอนเงินแล้วอัปโหลดสลิป |
| **แจ้งถอนเงิน** | `https://yourdomain.com/withdraw` | ถอนเข้าบัญชีที่ลงทะเบียนไว้ |
| **แทงหวยยี่กี 88 รอบ** | `https://yourdomain.com/lottery/yeekee` | ยิงเลข + ส่งโพยอัตโนมัติ |
| **ศูนย์รวมทางเข้า (Portal)** | `https://yourdomain.com/portal` | ลิงก์แยกหน้าบ้าน / หลังบ้าน |
| **เข้าสู่ระบบผู้ดูแล (Owner)** | `https://yourdomain.com/admin/login` | `admin` / `1234` |
| **หลังบ้านยี่กี (Admin)** | `https://yourdomain.com/admin/yeekee` | จัดการรอบ / ผลรวม / ผู้ยิงเลข |
| **ระบบการเงินแอดมิน** | `https://yourdomain.com/admin/finance` | อนุมัติถอน / ตรวจสลิป |

---

## 7. ตรวจสอบสุขภาพระบบ (Health Check API)
สามารถตรวจสอบการทำงานของเซิร์ฟเวอร์และโมดูลต่างๆ ได้ที่:
```bash
curl http://localhost:3000/api/v1/health
```
ผลลัพธ์:
```json
{
  "status": "success",
  "data": {
    "service": "AK88 Lotto API",
    "version": "2.0.0",
    "modules": ["monitor", "queue", "billing", "numberset", "game20", "yeekee", "system", "lottery", "rounds", "blocked", "betting", "results", "finance", "reports", "users", "agents", "keys"]
  }
}
```
