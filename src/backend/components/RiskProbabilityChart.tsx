/**
 * src/backend/components/RiskProbabilityChart.tsx
 * ==================================================================
 * ตารางกราฟวิเคราะห์ความเสี่ยงแบบ Real-time (Risk Probability & Intake Curve)
 *
 * ตามคำขอผู้ใช้:
 *  - "หวยไทยกราฟนี้จะอยู่เปิดขึ้นคู่กับแดชบอร์ด เป็นโอกาสเริ่ม 100% ตอนเปิดหวย"
 *  - "ทำการตั้งค่าลดต่างๆ จะเป็นอีกสี"
 *  - "พอมีคนแทงเข้ามา กราฟจะลงเรื่อยๆ โอกาสที่จะเสียน้อยลงหลังคนแทง"
 *  - "ทำ 2 ที่เลยก็ได้ครับ: ในแดชบอร์ดภาพรวม และ ในมอนิเตอร์รับกินสด"
 * ==================================================================
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  AreaChart, Area, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';

interface Props {
  selectedLottery?: string;
  onSelectLottery?: (lottery: string) => void;
  activeLotteries?: string[];
  currentIntakeTotal?: number;
  maxLiability?: number;
  initialExposurePercent?: number;
  compact?: boolean;
}

export default function RiskProbabilityChart({
  selectedLottery: propLottery,
  onSelectLottery,
  activeLotteries = ['หวยรัฐบาลไทย', 'หวยยี่กี 88 รอบ', 'หวยฮานอยพิเศษ', 'หวยลาวพัฒนา'],
  currentIntakeTotal = 45000,
  maxLiability = 270000,
  compact = false
}: Props) {
  const [currentLottery, setCurrentLottery] = useState(propLottery || activeLotteries[0] || 'หวยรัฐบาลไทย');
  const [simulatedBets, setSimulatedBets] = useState<number>(currentIntakeTotal);
  const [discountPercent, setDiscountPercent] = useState<number>(40); // ลดจ่าย 900 -> 540 (-40%)
  const [targetBudget, setTargetBudget] = useState<number>(500000);

  useEffect(() => {
    if (propLottery) setCurrentLottery(propLottery);
  }, [propLottery]);

  const handleLotteryChange = (lot: string) => {
    setCurrentLottery(lot);
    onSelectLottery?.(lot);
  };

  // คำนวณจุดบนเส้นกราฟความเสี่ยง (X: ยอดแทงสะสมที่เข้ามา 0 ถึง 500,000 บาท)
  const chartData = useMemo(() => {
    const points = [
      { step: 'เปิดหวย (0฿)', intake: 0 },
      { step: '10,000฿', intake: 10000 },
      { step: '25,000฿', intake: 25000 },
      { step: '50,000฿', intake: 50000 },
      { step: '100,000฿', intake: 100000 },
      { step: '200,000฿', intake: 200000 },
      { step: '350,000฿', intake: 350000 },
      { step: '500,000฿ (เต็มงบ)', intake: 500000 },
    ];

    const initialMaxRisk = 100; // 100% ตอนเปิดหวย
    const reducedBase = initialMaxRisk * (1 - (discountPercent / 100)); // ความเสี่ยงหลังตั้งค่าลดเลข

    return points.map(p => {
      // เมื่อคนแทงเข้ามา ยอดแทง (Intake) จะทำหน้าที่เป็น Buffer ดูดซับความเสียหาย
      // อัตราความเสี่ยงสุทธิจะลดลงเรื่อยๆ (Decay curve)
      const intakeBufferFactor = Math.min(0.92, (p.intake / targetBudget) * 0.95);
      
      // เส้นที่ 1: ความเสี่ยงก่อนลดราคา (แดง)
      const unhedgedRisk = Math.max(12, Math.round(initialMaxRisk * (1 - (intakeBufferFactor * 0.7))));
      
      // เส้นที่ 2: ความเสี่ยงหลังตั้งค่าลดอัตราจ่าย/เลขอั้น (ส้มทอง/Cyan)
      const discountedRisk = Math.max(8, Math.round(reducedBase * (1 - (intakeBufferFactor * 0.8))));
      
      // เส้นที่ 3: ความเสี่ยงสุทธิสดจริง (เขียวนีออน Gradient)
      const netRealizedRisk = Math.max(4, Math.round(discountedRisk * (1 - intakeBufferFactor)));

      return {
        step: p.step,
        intake: p.intake,
        // เส้น 1: โอกาสเสี่ยงตั้งต้น (ก่อนลดเลข)
        rawExposure: unhedgedRisk,
        // เส้น 2: โอกาสเสี่ยงหลังตั้งค่าลดเลขต่างๆ
        discountedExposure: discountedRisk,
        // เส้น 3: โอกาสแพ้สุทธิตามยอดแทงจริง (กราฟรูดลงเมื่อคนแทงเพิ่ม)
        realtimeExposure: netRealizedRisk,
      };
    });
  }, [discountPercent, targetBudget]);

  // คำนวณสถานะความเสี่ยงปัจจุบันตาม Slider หรือยอดจริง
  const currentRiskPoint = useMemo(() => {
    const intakeBuffer = Math.min(0.92, (simulatedBets / targetBudget) * 0.95);
    const reducedBase = 100 * (1 - (discountPercent / 100));
    const currentRisk = Math.max(4, Math.round(reducedBase * (1 - intakeBuffer)));
    
    let statusLabel = 'ปลอดภัยมาก (Safe)';
    let statusColor = 'text-emerald-500 bg-emerald-50 border-emerald-200';
    if (currentRisk > 65) {
      statusLabel = 'ความเสี่ยงสูง (High Risk)';
      statusColor = 'text-rose-600 bg-rose-50 border-rose-200';
    } else if (currentRisk > 35) {
      statusLabel = 'ความเสี่ยงปานกลาง (Medium)';
      statusColor = 'text-amber-600 bg-amber-50 border-amber-200';
    }

    return {
      currentRisk,
      statusLabel,
      statusColor,
      netLossChance: `${currentRisk}%`,
      bufferAmount: simulatedBets,
      liabilityReduction: Math.round(100 - currentRisk)
    };
  }, [simulatedBets, discountPercent, targetBudget]);

  return (
    <div className={`bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden ${compact ? 'p-4' : 'p-6'}`}>
      {/* Header bar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 text-white flex items-center justify-center font-black shadow-md shadow-amber-500/20">
            <span className="material-symbols-outlined text-2xl">analytics</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-black text-slate-900">
                กราฟโอกาสและความเสี่ยงรับแทง (Risk Probability & Intake Curve)
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-200 animate-pulse">
                ● เรียลไทม์สด
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              เริ่มต้น 100% เมื่อเปิดหวย ➡️ เปลี่ยนสีเมื่อตั้งค่าลดเลข ➡️ กราฟรูดลงเรื่อยๆ เมื่อมีคนแทงเข้ามา
            </p>
          </div>
        </div>

        {/* Lottery Selector Pills */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-100 rounded-2xl border border-slate-200">
          {activeLotteries.map((lotto) => (
            <button
              key={lotto}
              onClick={() => handleLotteryChange(lotto)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition ${
                currentLottery === lotto
                  ? 'bg-slate-900 text-amber-300 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              {lotto}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ความเสี่ยงตั้งต้น (เปิดหวย)</div>
          <div className="text-2xl font-black text-rose-500 mt-1">100%</div>
          <div className="text-[10px] text-slate-500 mt-0.5">ยังไม่มีคนแทง / ความเสี่ยงเต็ม</div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">หลังตั้งค่าลดจ่าย/เลขอั้น</div>
          <div className="text-2xl font-black text-amber-500 mt-1">-{discountPercent}%</div>
          <div className="text-[10px] text-slate-500 mt-0.5">เพดานความเสี่ยงลดลงเหลือ {100 - discountPercent}%</div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">ยอดแทงสะสมที่ดูดเข้ามา</div>
          <div className="text-2xl font-black text-blue-600 mt-1">฿{simulatedBets.toLocaleString()}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">ดูดซับโอกาสเสียไปแล้ว {currentRiskPoint.liabilityReduction}%</div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">โอกาสที่เจ้าของจะเสียสุทธิ</div>
          <div className="text-2xl font-black text-emerald-600 mt-1">{currentRiskPoint.netLossChance}</div>
          <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[9px] font-black border ${currentRiskPoint.statusColor}`}>
            {currentRiskPoint.statusLabel}
          </span>
        </div>
      </div>

      {/* Main Chart Canvas */}
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <defs>
              {/* Gradient แดง: ความเสี่ยงก่อนลด */}
              <linearGradient id="colorRaw" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.0} />
              </linearGradient>

              {/* Gradient ส้ม: หลังตั้งค่าลดจ่าย */}
              <linearGradient id="colorDiscount" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0} />
              </linearGradient>

              {/* Gradient เขียว: ความเสี่ยงสุทธิเมื่อคนแทงเข้ามา (Realtime Intake) */}
              <linearGradient id="colorRealtime" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.65} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.05} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="step" tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <YAxis unit="%" domain={[0, 100]} tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }} axisLine={false} tickLine={false} />
            <Tooltip
              formatter={(val: any) => [`${val}%`, '']}
              contentStyle={{ borderRadius: '16px', border: '1px solid #cbd5e1', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)', fontWeight: 800, fontSize: '12px' }}
            />
            <Legend
              verticalAlign="top"
              height={36}
              iconType="circle"
              wrapperStyle={{ fontSize: '11px', fontWeight: 800, paddingBottom: '8px' }}
            />

            {/* เส้นเกณฑ์ความปลอดภัย 30% */}
            <ReferenceLine y={30} stroke="#10b981" strokeDasharray="4 4" label={{ value: 'โซนปลอดภัยมาก (<30%)', position: 'insideBottomRight', fill: '#10b981', fontSize: 10, fontWeight: 800 }} />

            {/* 1. เส้นแดง: เริ่มต้น 100% ตอนเปิดหวย */}
            <Area
              type="monotone"
              dataKey="rawExposure"
              name="1. โอกาสเสี่ยงเริ่มต้น 100% (ก่อนลดเลข)"
              stroke="#f43f5e"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorRaw)"
            />

            {/* 2. เส้นส้ม: หลังตั้งค่าลดจ่ายต่างๆ */}
            <Area
              type="monotone"
              dataKey="discountedExposure"
              name="2. หลังตั้งค่าลดเลข / ปิดรับ (สีเหลืองส้ม)"
              stroke="#f59e0b"
              strokeWidth={3}
              strokeDasharray="5 5"
              fillOpacity={1}
              fill="url(#colorDiscount)"
            />

            {/* 3. เส้นเขียว: ความเสี่ยงจริงลดลงเมื่อคนแทงเข้ามา */}
            <Area
              type="monotone"
              dataKey="realtimeExposure"
              name="3. ความเสี่ยงสุทธิตามยอดแทงสด (กราฟรูดลงเมื่อคนแทง)"
              stroke="#10b981"
              strokeWidth={4}
              fillOpacity={1}
              fill="url(#colorRealtime)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Simulator Toolbar for Owner */}
      <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50 p-4 rounded-2xl">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <span className="material-symbols-outlined text-amber-500 text-lg">tune</span>
          <span className="text-xs font-black text-slate-700 whitespace-nowrap">แถบจำลองการแทงเข้า (Intake Simulator):</span>
        </div>

        <div className="flex items-center gap-3 w-full md:flex-1 max-w-md">
          <span className="text-[11px] font-bold text-slate-400">0฿</span>
          <input
            type="range"
            min={0}
            max={500000}
            step={5000}
            value={simulatedBets}
            onChange={(e) => setSimulatedBets(Number(e.target.value))}
            className="w-full accent-amber-500 cursor-pointer"
          />
          <span className="text-[11px] font-bold text-slate-700 whitespace-nowrap">฿{simulatedBets.toLocaleString()}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSimulatedBets(0)}
            className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-slate-500 hover:bg-slate-200 transition"
          >
            รีเซ็ตเป็น 0 (เปิดหวย)
          </button>
          <button
            onClick={() => setSimulatedBets(targetBudget * 0.75)}
            className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition"
          >
            คนแทง 75%
          </button>
        </div>
      </div>
    </div>
  );
}
