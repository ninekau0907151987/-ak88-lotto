import React, { useState, useEffect } from 'react';

export interface OnboardingTourProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export default function OnboardingTour({ forceOpen, onClose }: OnboardingTourProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    // Check if user has already completed tour
    const completed = localStorage.getItem('ak88_tour_completed');
    if (forceOpen) {
      setIsOpen(true);
      setCurrentStep(0);
    } else if (!completed) {
      // First-time visitor - show tour after brief delay
      const timer = setTimeout(() => {
        // Only open if welcome modal isn't blocking or after initial load
        setIsOpen(true);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [forceOpen]);

  // Listen for global open event
  useEffect(() => {
    const handleOpen = () => {
      setCurrentStep(0);
      setIsOpen(true);
    };
    window.addEventListener('open-ak88-tour', handleOpen);
    return () => window.removeEventListener('open-ak88-tour', handleOpen);
  }, []);

  const steps = [
    {
      stepNumber: 1,
      badge: 'ฟังก์ชันที่ 1: แทงหวยออนไลน์',
      title: 'ศูนย์รวมหวยออนไลน์ครบวงจร',
      icon: 'casino',
      iconColor: 'text-[#f5c518]',
      highlight: 'แทงง่าย ออกผลไว ครบทุกประเภทในที่เดียว',
      description: 'เดิมพันหวยยอดนิยมทุกชนิด เช่น หวยรัฐบาลไทย หวยยี่กี 88 รอบ/วัน หวยฮานอยพิเศษ/VIP หวยลาวพัฒนา หวยหุ้นไทยและต่างประเทศ พร้อมระบบหวยชุด 4 ตัว',
      quickTip: 'คลิกเมนู "แทงหวย" ที่แถบเมนูด้านล่าง หรือเลือกห้องหวยจากหน้าแรกเพื่อเริ่มแทงได้ทันที',
      previewComponent: (
        <div className="grid grid-cols-2 gap-2 mt-3 text-left">
          <div className="bg-[#051121] border border-[#f5c518]/30 rounded-xl p-2.5 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center font-bold text-xs">ไทย</span>
            <div>
              <div className="text-white text-xs font-bold">หวยรัฐบาลไทย</div>
              <div className="text-[10px] text-gray-400">บาทละ 900-1,000</div>
            </div>
          </div>
          <div className="bg-[#051121] border border-[#f5c518]/30 rounded-xl p-2.5 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">ยี่กี</span>
            <div>
              <div className="text-white text-xs font-bold">จับยี่กี 88 รอบ</div>
              <div className="text-[10px] text-gray-400">ออกผลทุก 15 นาที</div>
            </div>
          </div>
          <div className="bg-[#051121] border border-[#f5c518]/30 rounded-xl p-2.5 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">ฮานอย</span>
            <div>
              <div className="text-white text-xs font-bold">ฮานอย พิเศษ/ปกติ</div>
              <div className="text-[10px] text-gray-400">ลุ้นได้ทุกวัน</div>
            </div>
          </div>
          <div className="bg-[#051121] border border-[#f5c518]/30 rounded-xl p-2.5 flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">ลาว</span>
            <div>
              <div className="text-white text-xs font-bold">หวยลาวพัฒนา</div>
              <div className="text-[10px] text-gray-400">จันทร์ พุธ ศุกร์</div>
            </div>
          </div>
        </div>
      )
    },
    {
      stepNumber: 2,
      badge: 'ฟังก์ชันที่ 2: นับถอยหลัง & อัตราจ่าย',
      title: 'นาฬิกานับถอยหลัง 3 สี & อัตราจ่ายสูงสุด',
      icon: 'timer',
      iconColor: 'text-emerald-400',
      highlight: '3 สถานะสีชัดเจน ไม่พลาดทุกจังหวะรวย',
      description: 'หน้าแรกและหน้ารายการหวยจะมีแถบนับถอยหลังบอกสถานะเปิด-ปิดชัดเจนด้วยสี 3 ระดับ พร้อมการันตีอัตราจ่ายสูงสุด 2 ตัว 3 ตัว บาทละ 1,000 เต็มจำนวน',
      quickTip: 'สีเขียว = เปิดรับแทงอยู่ | สีส้ม = ปิดรับแทงรอผล | สีฟ้า = กำหนดเวลารอเปิดรับแทง',
      previewComponent: (
        <div className="space-y-2 mt-3">
          <div className="bg-[#051121] border border-emerald-500/40 rounded-xl p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs text-white font-bold">🟢 กำลังเปิดรับแทง</span>
            </div>
            <span className="text-xs text-emerald-400 font-black tracking-wider">เหลือ 03:45:12</span>
          </div>
          <div className="bg-[#051121] border border-amber-500/40 rounded-xl p-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
              <span className="text-xs text-white font-bold">🟠 ปิดรับแทงรอออกผล</span>
            </div>
            <span className="text-xs text-amber-400 font-black">รอการประกาศรางวัล</span>
          </div>
        </div>
      )
    },
    {
      stepNumber: 3,
      badge: 'ฟังก์ชันที่ 3: ระบบฝาก-ถอนเงินออโต้',
      title: 'ฝาก-ถอนอัตโนมัติ รวดเร็ว ภายใน 30 วินาที',
      icon: 'account_balance_wallet',
      iconColor: 'text-cyan-400',
      highlight: 'ระบบความปลอดภัยระดับสถาบันการเงิน ตลอด 24 ชม.',
      description: 'เติมเงินสะดวกด้วยการสแกน QR Code เงินเข้าทันทีไม่ต้องส่งสลิป และถอนเงินตรงเข้าบัญชีธนาคารที่คุณลงทะเบียนไว้ได้ตลอด 24 ชั่วโมง โดยไม่มีค่าธรรมเนียม',
      quickTip: 'สามารถเช็คประวัติการฝากถอนและรายงานบัญชีย้อนหลังได้ตลอดเวลา',
      previewComponent: (
        <div className="bg-[#051121] border border-cyan-500/30 rounded-xl p-3 mt-3 flex items-center justify-around text-center">
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-1">
              <span className="material-symbols-outlined text-xl">qr_code_scanner</span>
            </div>
            <span className="text-white text-xs font-bold">สแกน QR ฝากเงิน</span>
            <span className="text-[10px] text-emerald-400 font-semibold">เข้าทันทีใน 30 วิ</span>
          </div>
          <div className="text-gray-500 font-black text-lg">➜</div>
          <div className="flex flex-col items-center">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-1">
              <span className="material-symbols-outlined text-xl">payments</span>
            </div>
            <span className="text-white text-xs font-bold">ถอนเงินออโต้</span>
            <span className="text-[10px] text-amber-400 font-semibold">เข้าบัญชีโดยตรง</span>
          </div>
        </div>
      )
    },
    {
      stepNumber: 4,
      badge: 'ฟังก์ชันที่ 4: ตรวจโพยหวย & ผลรางวัล',
      title: 'ตรวจสอบโพยหวย & ตัดยอดกำไร-ขาดทุน',
      icon: 'receipt_long',
      iconColor: 'text-purple-400',
      highlight: 'บันทึกโพยละเอียด ตรวจผลแม่นยำอัตโนมัติ',
      description: 'เมื่อแทงหวยเรียบร้อย ระบบจะออกใบโพยดิจิทัลทันที ตรวจสอบเลขแทง อัตราจ่าย และเงินรางวัลที่คาดว่าจะได้รับ เมื่อหวยออกผล ระบบจะปรับยอดเงินเข้ากระเป๋าให้อัตโนมัติ',
      quickTip: 'กดที่ปุ่ม "โพยหวย" บนแถบเมนูเพื่อดูรายการที่แทงไว้ทั้งหมด ทั้งที่รอผลและออกผลแล้ว',
      previewComponent: (
        <div className="bg-[#051121] border border-purple-500/30 rounded-xl p-3 mt-3 text-left">
          <div className="flex justify-between items-center border-b border-white/10 pb-2 mb-2">
            <span className="text-xs text-white font-bold">โพย #AK88-99201</span>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">ชนะรางวัล ฿9,000</span>
          </div>
          <div className="flex justify-between text-[11px] text-gray-300">
            <span>หวยรัฐบาลไทย 3 ตัวบน [789]</span>
            <span className="font-bold text-[#f5c518]">เดิมพัน 10 บ.</span>
          </div>
        </div>
      )
    },
    {
      stepNumber: 5,
      badge: 'ฟังก์ชันที่ 5: ข้อมูลส่วนตัว & ซัพพอร์ต',
      title: 'ข้อมูลส่วนตัว บัญชีธนาคาร & ซัพพอร์ต 24 ชม.',
      icon: 'manage_accounts',
      iconColor: 'text-pink-400',
      highlight: 'ดูแลข้อมูลส่วนบุคคลปลอดภัย 100%',
      description: 'จัดการโปรไฟล์สมาชิก เปลี่ยนรหัสผ่าน ตรวจสอบเลขบัญชีธนาคาร และมีทีมงานมืออาชีพพร้อมให้บริการช่วยเหลือและตอบข้อสงสัยผ่านหน้าติดต่อเราตลอด 24 ชั่วโมง',
      quickTip: 'หากต้องการเปิดคู่มือแนะนำ 5 ฟังก์ชันนี้อีกครั้ง สามารถกดปุ่ม "📖 แนะนำการใช้งาน" ได้ตลอดเวลา',
      previewComponent: (
        <div className="bg-[#051121] border border-pink-500/30 rounded-xl p-3 mt-3 flex items-center justify-between text-left">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#f5c518]/20 text-[#f5c518] flex items-center justify-center font-bold">
              <span className="material-symbols-outlined">support_agent</span>
            </div>
            <div>
              <div className="text-white text-xs font-bold">ทีมงานบริการลูกค้า AK88</div>
              <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                พร้อมให้บริการตลอด 24 ชั่วโมง
              </div>
            </div>
          </div>
          <span className="text-xs bg-white/10 text-white px-2.5 py-1.5 rounded-lg font-bold">ติดต่อเรา</span>
        </div>
      )
    }
  ];

  const handleClose = () => {
    localStorage.setItem('ak88_tour_completed', 'true');
    setIsOpen(false);
    if (onClose) onClose();
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  if (!isOpen) return null;

  const active = steps[currentStep];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
      <div className="bg-[#0a192f] border-2 border-[#f5c518] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative flex flex-col max-h-[92vh]">
        {/* Top Progress bar */}
        <div className="w-full bg-white/10 h-1.5">
          <div 
            className="h-full bg-gradient-to-r from-amber-400 via-[#f5c518] to-emerald-400 transition-all duration-300"
            style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Header */}
        <div className="p-5 pb-2 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase bg-[#f5c518]/20 text-[#f5c518] border border-[#f5c518]/40">
              {active.badge}
            </span>
            <span className="text-xs text-gray-400 font-bold">
              {currentStep + 1} จาก {steps.length}
            </span>
          </div>

          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-white transition w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center"
            title="ปิดไกด์แนะนำ"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Body content */}
        <div className="p-6 overflow-y-auto space-y-4 text-center">
          {/* Main Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center shadow-inner">
              <span className={`material-symbols-outlined text-4xl ${active.iconColor}`}>
                {active.icon}
              </span>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-black text-white">{active.title}</h2>
            <p className="text-xs text-[#f5c518] font-bold mt-1">{active.highlight}</p>
          </div>

          <p className="text-xs md:text-sm text-gray-300 leading-relaxed max-w-md mx-auto">
            {active.description}
          </p>

          {/* Interactive preview illustration */}
          {active.previewComponent}

          {/* Quick Tip */}
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex items-start gap-2.5 text-left">
            <span className="material-symbols-outlined text-amber-400 text-sm mt-0.5 shrink-0">tips_and_updates</span>
            <p className="text-[11px] text-amber-200/90 leading-tight">
              <span className="font-bold text-amber-300">คำแนะนำ: </span>
              {active.quickTip}
            </p>
          </div>
        </div>

        {/* Footer Controls */}
        <div className="p-5 pt-3 border-t border-white/10 bg-[#051121]/50 flex items-center justify-between gap-3">
          {/* Skip button */}
          <button
            onClick={handleClose}
            className="text-xs text-gray-400 hover:text-white px-3 py-2 font-medium transition"
          >
            ข้ามไกด์
          </button>

          {/* Dots Indicator */}
          <div className="flex items-center gap-1.5">
            {steps.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentStep(idx)}
                className={`h-2 rounded-full transition-all ${
                  idx === currentStep
                    ? 'w-6 bg-[#f5c518]'
                    : 'w-2 bg-white/20 hover:bg-white/40'
                }`}
                aria-label={`ไปขั้นตอนที่ ${idx + 1}`}
              />
            ))}
          </div>

          {/* Nav buttons */}
          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <button
                onClick={handlePrev}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-white/10 hover:bg-white/20 transition flex items-center gap-1"
              >
                ย้อนกลับ
              </button>
            )}

            <button
              onClick={handleNext}
              className="px-4 py-2 rounded-xl text-xs font-black text-[#0a192f] bg-gradient-to-r from-amber-400 via-[#f5c518] to-amber-500 hover:brightness-105 shadow transition flex items-center gap-1"
            >
              <span>{currentStep === steps.length - 1 ? 'เริ่มใช้งานทันที' : 'ถัดไป'}</span>
              <span className="material-symbols-outlined text-sm">
                {currentStep === steps.length - 1 ? 'check_circle' : 'arrow_forward'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
