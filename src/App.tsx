/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * App.tsx — Central Router
 * ------------------------------------------------------------------
 * โครงสร้างแยกหน้าบ้าน / หลังบ้าน / shared ชัดเจน:
 *   @/frontend/pages  → หน้าบ้าน (ฝั่งลูกค้า: แทงหวย, ฝาก-ถอน, โปรไฟล์)
 *   @/backend/pages   → หลังบ้าน (ฝั่งแอดมิน: แดชบอร์ด, มาสเตอร์, เอเย่นต์)
 *   @/shared/layouts  → เลย์เอาต์ที่ใช้ร่วมกัน
 *
 * หมายเหตุ: /login, /register, /admin, /master อยู่ "นอก" Layout
 * เพราะไม่ต้องมี bottom-nav ของหน้าบ้าน (กันปุ่มหลังบ้านปนกับหน้าบ้าน)
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// ---- Shared ----
import Layout from '@/shared/layouts/Layout';

// ---- Frontend (หน้าบ้าน) ----
import Home from '@/frontend/pages/Home';
import LotteryList from '@/frontend/pages/LotteryList';
import LotteryBet from '@/frontend/pages/LotteryBet';
import StockLotteryList from '@/frontend/pages/StockLotteryList';
import YeekeeList from '@/frontend/pages/YeekeeList';
import Deposit from '@/frontend/pages/Deposit';
import Login from '@/frontend/pages/Login';
import Register from '@/frontend/pages/Register';
import ForgotPassword from '@/frontend/pages/ForgotPassword';
import LotteryResults from '@/frontend/pages/LotteryResults';
import Withdraw from '@/frontend/pages/Withdraw';
import History from '@/frontend/pages/History';
import FinancialReport from '@/frontend/pages/FinancialReport';
import Profile from '@/frontend/pages/Profile';
import LotteryTickets from '@/frontend/pages/LotteryTickets';
import NumberSetCreate from '@/frontend/pages/NumberSetCreate';
import Referral from '@/frontend/pages/Referral';
import Contact from '@/frontend/pages/Contact';
import LotterySetBet from '@/frontend/pages/LotterySetBet';
import LotteryRules from '@/frontend/pages/LotteryRules';
// ★ หวย 20 ช่อง 6 หลัก
import Game20Guide from '@/frontend/pages/Game20Guide';
import Game20Bet from '@/frontend/pages/Game20Bet';

// ---- Backend (หลังบ้าน) ----
import AdminDashboard from '@/backend/pages/AdminDashboard';
import MasterDashboard from '@/backend/pages/MasterDashboard';
import AgentProfile from '@/backend/pages/AgentProfile';
import DeveloperApi from '@/backend/pages/DeveloperApi';
import ApiDocs from '@/backend/pages/ApiDocs';
// ★ หลังบ้าน: หวย 20 ช่อง 6 หลัก + คู่มือ
import Game20Admin from '@/backend/pages/Game20Admin';
import BackofficeManual from '@/backend/pages/BackofficeManual';
import Game20Report from '@/backend/pages/Game20Report';
// ★ ศูนย์ควบคุมหวยยี่กี 88 รอบ
import YeekeeAdmin from '@/backend/pages/YeekeeAdmin';
import AdminLogin from '@/backend/pages/AdminLogin';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* ================= Auth (ไม่มี bottom-nav) & Redirects ================= */}
        <Route path="/portal" element={<Navigate to="/" replace />} />
        <Route path="/gateway" element={<Navigate to="/" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />

        {/* ================= หลังบ้าน (ไม่มี bottom-nav หน้าบ้าน) ================= */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/api" element={<DeveloperApi />} />
        <Route path="/admin/api/docs" element={<ApiDocs />} />
        <Route path="/master" element={<MasterDashboard />} />
        <Route path="/master/agent-profile" element={<AgentProfile />} />
        {/* ★ หวย 20 ช่อง 6 หลัก — จัดการบอท/ประวัติ/รหัส/กติกา */}
        <Route path="/admin/game20" element={<Game20Admin />} />
        {/* ★ คู่มือการตั้งค่าการใช้งานทุกฟังก์ชันหลังบ้าน */}
        <Route path="/admin/manual" element={<BackofficeManual />} />
        {/* ★ B3: รายงานกำไร-ขาดทุน หวย 20 ช่อง */}
        <Route path="/admin/game20/report" element={<Game20Report />} />
        {/* ★ ศูนย์ควบคุมหวยยี่กี 88 รอบ */}
        <Route path="/admin/yeekee" element={<YeekeeAdmin />} />

        {/* ================= หน้าบ้าน (มี Layout + bottom-nav) ================= */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />

          {/* ---- หวย: แทงหวย ----
           * ★ ลำดับสำคัญ (React Router v6 ให้ static ชนะ dynamic เสมอ
           *   แต่เรียงให้อ่านง่าย + กันพลาด):
           *   1. static ที่เจาะจงที่สุดก่อน  (set, stock, yeekee, game20)
           *   2. dynamic :type เป็นตัวสุดท้าย
           */}
          <Route path="lottery" element={<LotteryList />} />

          {/* 1) ทางเข้าแบบเจาะจง — ต้องมาก่อน lottery/:type */}
          <Route path="lottery/set" element={<Navigate to="/lottery?tab=set" replace />} />
          <Route path="lottery/set/:type" element={<LotterySetBet />} />
          <Route path="lottery/stock" element={<Navigate to="/lottery?tab=stock" replace />} />
          <Route path="lottery/stock/:type" element={<LotteryBet />} />
          <Route path="lottery/yeekee" element={<YeekeeList />} />

          {/* ★ กติกา + วิธีเล่น หวย 20 ช่อง 6 หลัก */}
          <Route path="lottery/game20" element={<Game20Bet />} />
          <Route path="lottery/game20/rules" element={<Game20Guide />} />
          <Route path="game20/guide" element={<Game20Guide />} />

          {/* ★ กติกาและวิธีเล่น เชื่อมหลังบ้าน-หน้าบ้าน */}
          <Route path="rules" element={<LotteryRules />} />
          <Route path="lottery/rules" element={<LotteryRules />} />

          {/* 2) dynamic :type — ต้องอยู่หลัง static ทั้งหมด */}
          <Route path="lottery/:type/rules" element={<LotteryRules />} />
          <Route path="lottery/:type" element={<LotteryBet />} />

          {/* ---- การเงิน ---- */}
          <Route path="deposit" element={<Deposit />} />
          <Route path="withdraw" element={<Withdraw />} />
          <Route path="history" element={<History />} />
          <Route path="financial-report" element={<FinancialReport />} />

          {/* ---- อื่นๆ ---- */}
          <Route path="results" element={<LotteryResults />} />
          <Route path="profile" element={<Profile />} />
          <Route path="tickets" element={<LotteryTickets />} />
          <Route path="number-set" element={<NumberSetCreate />} />
          <Route path="referral" element={<Referral />} />
          <Route path="contact" element={<Contact />} />

          {/* ---- fallback: path แปลกๆ กลับหน้าแรก ---- */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
