import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase';

export default function LotteryRules() {
  const { type: routeType } = useParams();
  const navigate = useNavigate();

  // Active tab: 'general' or specific lottery ID/name
  const [selectedTab, setSelectedTab] = useState<string>(routeType ? decodeURIComponent(routeType) : 'general');
  const [generalRules, setGeneralRules] = useState<string>('');
  const [lotteryList, setLotteryList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to general rules from settings/rules
  useEffect(() => {
    let unsubGeneral = () => {};
    let unsubLotteries = () => {};

    try {
      unsubGeneral = onSnapshot(doc(db, 'settings', 'rules'), (snap) => {
        if (snap.exists()) {
          setGeneralRules(snap.data().content || '');
        }
      }, (err) => console.warn('General rules listener warning:', err));

      unsubLotteries = onSnapshot(collection(db, 'lotteryTypes'), (snap) => {
        const list = snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));
        setLotteryList(list);
        setLoading(false);
      }, (err) => {
        console.warn('Lottery types listener warning:', err);
        setLoading(false);
      });
    } catch (e) {
      console.warn('Rules listeners init warning:', e);
      setLoading(false);
    }

    return () => {
      unsubGeneral();
      unsubLotteries();
    };
  }, []);

  // Update selectedTab if route parameter changes
  useEffect(() => {
    if (routeType) {
      setSelectedTab(decodeURIComponent(routeType));
    }
  }, [routeType]);

  // Find active lottery if selected
  const activeLottery = lotteryList.find(
    l => l.id === selectedTab || l.name === selectedTab
  );

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-24">
      {/* Header */}
      <div className="bg-[#0a192f] text-white p-4 border-b border-[#f5c518]/20 sticky top-0 z-40 shadow-md">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate(-1)} 
              className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 transition text-[#f5c518]"
              title="ย้อนกลับ"
            >
              <span className="material-symbols-outlined text-xl">arrow_back</span>
            </button>
            <div>
              <h1 className="text-base md:text-lg font-black tracking-wide text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[#f5c518] text-xl">gavel</span>
                กติกาและวิธีการเล่น
              </h1>
              <p className="text-[11px] text-gray-400">ระบบกติกาและข้อกำหนดมาตรฐาน AK88</p>
            </div>
          </div>

          <Link
            to="/lottery"
            className="text-xs bg-gradient-to-r from-amber-400 via-[#f5c518] to-amber-500 text-[#0a192f] font-black px-3.5 py-1.5 rounded-xl shadow hover:brightness-105 transition flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">casino</span>
            <span>ไปแทงหวย</span>
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-4">
        {/* Navigation Selector Bar (General vs Specific Lotteries) */}
        <div className="bg-[#0a192f] border border-[#f5c518]/30 rounded-2xl p-2 shadow-sm">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedTab('general')}
              className={`px-4 py-2 rounded-xl text-xs font-black shrink-0 transition flex items-center gap-1.5 ${
                selectedTab === 'general'
                  ? 'bg-gradient-to-r from-amber-400 via-[#f5c518] to-amber-500 text-[#0a192f] shadow'
                  : 'bg-white/5 text-gray-300 hover:bg-white/10'
              }`}
            >
              <span className="material-symbols-outlined text-sm">verified_user</span>
              <span>กติกาการเล่นทั่วไป</span>
            </button>

            {lotteryList.map((lot) => {
              const lotName = lot.name || lot.id;
              const isActive = selectedTab === lot.id || selectedTab === lotName;
              return (
                <button
                  key={lot.id}
                  onClick={() => setSelectedTab(lotName)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-gradient-to-r from-amber-400 via-[#f5c518] to-amber-500 text-[#0a192f] font-black shadow'
                      : 'bg-white/5 text-gray-300 hover:bg-white/10'
                  }`}
                >
                  <span className="material-symbols-outlined text-sm">confirmation_number</span>
                  <span>{lotName}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content Section */}
        {loading ? (
          <div className="flex justify-center items-center h-64 bg-white rounded-3xl border border-gray-200">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#0a192f]"></div>
          </div>
        ) : selectedTab === 'general' ? (
          /* ================= 1. General Rules View ================= */
          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-[#0a192f] to-[#112240] p-6 text-white border-b border-[#f5c518]/30">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[#f5c518]/20 text-[#f5c518] flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-2xl">shield</span>
                </div>
                <div>
                  <h2 className="text-lg md:text-xl font-black">กติกาและข้อกำหนดการใช้งานทั่วไป</h2>
                  <p className="text-xs text-amber-300/90 mt-0.5">โปรดอ่านและทำความเข้าใจก่อนเริ่มเดิมพันทุกครั้ง</p>
                </div>
              </div>
            </div>

            <div className="p-6 md:p-8 space-y-6">
              {generalRules ? (
                <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {generalRules}
                </div>
              ) : (
                <div className="space-y-4 text-gray-700 text-sm leading-relaxed">
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                    <h3 className="font-bold text-amber-900 flex items-center gap-2 mb-2 text-base">
                      <span className="material-symbols-outlined text-amber-600">info</span>
                      1. ข้อกำหนดการเดิมพันและการตัดยอด
                    </h3>
                    <ul className="list-disc list-inside space-y-1.5 text-xs text-amber-950">
                      <li>ระบบจะเปิดรับแทงและปิดรับแทงตามเวลาที่กำหนดในแต่ละรอบอย่างเคร่งครัด</li>
                      <li>หากมีการส่งโพยหลังจากเวลาปิดรับแทง ระบบจะถือว่าการแทงในรอบนั้นเป็นโมฆะและคืนเครดิตทันที</li>
                      <li>สมาชิกมีหน้าที่ตรวจสอบความถูกต้องของตัวเลขและยอดเงินก่อนกดยืนยันการแทงเสมอ</li>
                    </ul>
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                    <h3 className="font-bold text-blue-900 flex items-center gap-2 mb-2 text-base">
                      <span className="material-symbols-outlined text-blue-600">account_balance_wallet</span>
                      2. การฝาก-ถอนเงิน และอัตราจ่าย
                    </h3>
                    <ul className="list-disc list-inside space-y-1.5 text-xs text-blue-950">
                      <li>ระบบฝากเงินผ่าน QR Code อัตโนมัติ ปรับยอดเครดิตภายใน 30 วินาที</li>
                      <li>การถอนเงินจะโอนเข้าเฉพาะบัญชีธนาคารที่มีชื่อ-นามสกุลตรงกับที่ลงทะเบียนไว้เท่านั้น</li>
                      <li>อัตราจ่ายสูงสุด 3 ตัวตรง บาทละ 900 - 1,000 และ 2 ตัวตรง บาทละ 90 - 100 ตามประเภทหวย</li>
                    </ul>
                  </div>

                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4">
                    <h3 className="font-bold text-red-900 flex items-center gap-2 mb-2 text-base">
                      <span className="material-symbols-outlined text-red-600">security</span>
                      3. ข้อห้ามและการรักษาความปลอดภัย
                    </h3>
                    <ul className="list-disc list-inside space-y-1.5 text-xs text-red-950">
                      <li>ห้ามใช้โปรแกรมบอท ดัดแปลง หรือทุจริตระบบโดยเด็ดขาด หากตรวจพบจะระงับการใช้งานทันที</li>
                      <li>การตัดสินของคณะทำงาน AK88 ถือเป็นที่สิ้นสุดในกรณีเกิดเหตุขัดข้องทางเทคนิคที่ไม่คาดคิด</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ================= 2. Specific Lottery Rules View ================= */
          <div className="bg-white rounded-3xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header with Lottery Details */}
            <div className="bg-gradient-to-r from-[#0a192f] to-[#112240] p-6 text-white border-b border-[#f5c518]/30">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-[#f5c518]/20 text-[#f5c518] flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-2xl">casino</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider bg-white/10 px-2 py-0.5 rounded-full text-[#f5c518]">
                      กติกาเฉพาะประเภท
                    </span>
                    <h2 className="text-lg md:text-xl font-black mt-0.5">{selectedTab}</h2>
                  </div>
                </div>

                <Link
                  to={`/lottery/${encodeURIComponent(selectedTab)}`}
                  className="bg-[#f5c518] hover:bg-amber-400 text-[#0a192f] text-xs font-black px-4 py-2 rounded-xl transition flex items-center justify-center gap-1.5 self-start sm:self-auto"
                >
                  <span>เข้าห้องแทงหวยนี้</span>
                  <span className="material-symbols-outlined text-sm">arrow_forward</span>
                </Link>
              </div>
            </div>

            {/* Custom Rules Banner Image if provided from backoffice */}
            {activeLottery?.rules?.imageUrl && (
              <div className="w-full bg-black/5 border-b border-gray-200">
                <img 
                  src={activeLottery.rules.imageUrl} 
                  alt={`${selectedTab} Rules Banner`} 
                  className="w-full h-auto max-h-96 object-contain mx-auto" 
                />
              </div>
            )}

            <div className="p-6 md:p-8 space-y-6">
              {/* Custom Rules Text */}
              {activeLottery?.rules?.text ? (
                <div>
                  <h3 className="text-base font-bold text-[#0a192f] mb-3 border-b pb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#f5c518]">description</span>
                    คำชี้แจงและกติกา
                  </h3>
                  <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
                    {activeLottery.rules.text}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 text-center text-gray-500">
                  <span className="material-symbols-outlined text-4xl mb-2 text-gray-400">description</span>
                  <p className="text-sm font-bold text-gray-600">ใช้กติกามาตรฐานระบบสำหรับ {selectedTab}</p>
                  <p className="text-xs text-gray-400 mt-1">สามารถดูตารางอัตราจ่ายและเวลาปิดรับแทงด้านล่าง</p>
                </div>
              )}

              {/* Payout Rates Showcase */}
              {activeLottery?.rates && (
                <div>
                  <h3 className="text-base font-bold text-[#0a192f] mb-3 border-b pb-2 flex items-center gap-2">
                    <span className="material-symbols-outlined text-emerald-600">payments</span>
                    อัตราจ่ายรางวัล
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                    {Object.entries(activeLottery.rates).map(([key, val]: [string, any]) => (
                      <div key={key} className="bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col justify-between">
                        <span className="text-xs text-gray-500 font-bold">{key}</span>
                        <span className="text-sm md:text-base font-black text-emerald-600 mt-1">
                          บาทละ {Number(val).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Standard Policy Notice */}
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-xs text-gray-600 space-y-1">
                <div className="font-bold text-gray-700 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-[#f5c518]">info</span>
                  เงื่อนไขการคืนเงินและยกเลิก
                </div>
                <p>ในกรณีที่ตลาดหลักทรัพย์หรือสำนักงานสลากกินแบ่งไม่มีการออกผลรางวัลตามกำหนด ทางระบบจะทำการยกเลิกโพยและคืนเครดิตให้ลูกค้าเต็มจำนวนโดยอัตโนมัติ</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
