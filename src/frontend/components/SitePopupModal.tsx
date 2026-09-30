import React, { useState, useEffect } from 'react';
import { db } from '@/shared/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

export interface PopupData {
  active?: boolean;
  title?: string;
  body?: string;
  imageUrl?: string;
  type?: 'general' | 'promotion' | 'maintenance' | 'urgent';
  target?: 'all' | 'specific';
  targetUsers?: string;
  showOnce?: boolean;
  linkUrl?: string;
  actionText?: string;
  updatedAt?: string;
}

export interface WelcomeData {
  enabled?: boolean;
  title?: string;
  subtitle?: string;
  bonusNotice?: string;
  imageUrl?: string;
  buttonText?: string;
  features?: string[];
  updatedAt?: string;
}

export default function SitePopupModal() {
  const navigate = useNavigate();

  const [popup, setPopup] = useState<PopupData | null>(null);
  const [welcome, setWelcome] = useState<WelcomeData | null>(null);

  const [showPopupModal, setShowPopupModal] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);

  // Subscribe to popup and welcome settings in Firestore
  useEffect(() => {
    let unsubPopup = () => {};
    let unsubWelcome = () => {};

    try {
      unsubPopup = onSnapshot(doc(db, 'settings', 'popup'), (snap) => {
        if (snap.exists()) {
          setPopup(snap.data() as PopupData);
        } else {
          setPopup(null);
        }
      }, (err) => console.warn('Popup stream warning:', err));

      unsubWelcome = onSnapshot(doc(db, 'settings', 'welcome'), (snap) => {
        if (snap.exists()) {
          setWelcome(snap.data() as WelcomeData);
        } else {
          setWelcome(null);
        }
      }, (err) => console.warn('Welcome modal stream warning:', err));
    } catch (e) {
      console.warn('Popup listener init warning:', e);
    }

    return () => {
      unsubPopup();
      unsubWelcome();
    };
  }, []);

  // Evaluate Welcome Modal & Announcement Popup Display
  useEffect(() => {
    // 1. Check Welcome Modal for First-time / New Members
    const welcomeSeen = localStorage.getItem('ak88_welcome_seen');
    if (welcome && welcome.enabled !== false && !welcomeSeen) {
      setShowWelcomeModal(true);
      return; // Do not show regular announcement popup while welcome modal is pending
    }

    // 2. Check Announcement Popup
    if (!popup || !popup.active) {
      setShowPopupModal(false);
      return;
    }

    // Check targeting (ทั้งหมด vs เฉพาะคน)
    if (popup.target === 'specific') {
      let currentUsername = (localStorage.getItem('username') || '').toLowerCase().trim();
      let currentPhone = (localStorage.getItem('phoneNumber') || '').trim();
      let currentUid = (localStorage.getItem('userId') || '').toLowerCase().trim();

      try {
        const cu = JSON.parse(localStorage.getItem('currentUser') || '{}');
        if (cu.phone && !currentPhone) currentPhone = String(cu.phone).trim();
        if (cu.username && !currentUsername) currentUsername = String(cu.username).toLowerCase().trim();
        if (cu.userId && !currentUid) currentUid = String(cu.userId).toLowerCase().trim();
      } catch (e) {}

      const rawTargets = (popup.targetUsers || '').toLowerCase();
      
      const targetList = rawTargets
        .split(/[\n,;\s]+/)
        .map(t => t.trim())
        .filter(Boolean);

      const isMatch = targetList.some(t => 
        (currentUsername && t === currentUsername) || 
        (currentPhone && t === currentPhone) ||
        (currentUid && t === currentUid)
      );

      if (!isMatch) {
        setShowPopupModal(false);
        return;
      }
    }

    // Check showOnce frequency
    if (popup.showOnce) {
      const popupKey = `ak88_popup_seen_${popup.updatedAt || 'active'}`;
      if (sessionStorage.getItem(popupKey) || localStorage.getItem(popupKey)) {
        setShowPopupModal(false);
        return;
      }
    }

    setShowPopupModal(true);
  }, [popup, welcome]);

  // Handle closing welcome modal
  const handleCloseWelcome = (startTour: boolean = false) => {
    localStorage.setItem('ak88_welcome_seen', 'true');
    setShowWelcomeModal(false);

    if (startTour) {
      // Trigger the 5-step onboarding tour
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('open-ak88-tour'));
      }, 300);
    }
  };

  // Handle closing announcement popup
  const handleClosePopup = () => {
    if (popup?.showOnce) {
      const popupKey = `ak88_popup_seen_${popup.updatedAt || 'active'}`;
      sessionStorage.setItem(popupKey, 'true');
    }
    setShowPopupModal(false);
  };

  // Badge and icon config for announcement types
  const getTypeConfig = (type?: string) => {
    switch (type) {
      case 'promotion':
        return {
          label: '🎁 โปรโมชั่นพิเศษ',
          badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
          icon: 'redeem',
          iconColor: 'text-emerald-400',
          borderClass: 'border-emerald-500',
        };
      case 'maintenance':
        return {
          label: '⚠️ แจ้งเตือนปิดปรับปรุงระบบ',
          badgeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
          icon: 'construction',
          iconColor: 'text-amber-400',
          borderClass: 'border-amber-500',
        };
      case 'urgent':
        return {
          label: '🚨 ประกาศด่วนสำคัญ',
          badgeClass: 'bg-red-500/20 text-red-400 border-red-500/40',
          icon: 'emergency_home',
          iconColor: 'text-red-400',
          borderClass: 'border-red-500',
        };
      case 'general':
      default:
        return {
          label: '📢 ประกาศจากระบบ',
          badgeClass: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
          icon: 'campaign',
          iconColor: 'text-[#f5c518]',
          borderClass: 'border-[#f5c518]',
        };
    }
  };

  // ================= RENDER: 1. Welcome Modal =================
  if (showWelcomeModal && welcome) {
    return (
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in font-sans">
        <div className="bg-[#0a192f] border-2 border-[#f5c518] rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative flex flex-col max-h-[92vh]">
          {/* Header Banner Image or Gradient Header */}
          {welcome.imageUrl ? (
            <div className="w-full h-40 overflow-hidden relative border-b border-[#f5c518]/30">
              <img src={welcome.imageUrl} alt="Welcome Banner" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a192f] via-transparent to-black/30" />
            </div>
          ) : (
            <div className="bg-gradient-to-r from-[#0a192f] via-[#112240] to-[#0a192f] p-6 text-center border-b border-[#f5c518]/30 relative">
              <div className="w-16 h-16 mx-auto rounded-full bg-[#f5c518]/15 border border-[#f5c518]/40 flex items-center justify-center mb-2 shadow-inner">
                <span className="material-symbols-outlined text-[#f5c518] text-3xl">celebration</span>
              </div>
              <span className="inline-block px-3 py-1 rounded-full text-[10px] font-black tracking-wider uppercase bg-[#f5c518]/20 text-[#f5c518] border border-[#f5c518]/40">
                ยินดีต้อนรับสมาชิกใหม่
              </span>
            </div>
          )}

          {/* Close button */}
          <button
            onClick={() => handleCloseWelcome(false)}
            className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center transition border border-white/20"
            title="ปิดหน้าต่าง"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>

          {/* Content */}
          <div className="p-6 overflow-y-auto space-y-4 text-center">
            <h2 className="text-xl md:text-2xl font-black text-white">
              {welcome.title || 'ยินดีต้อนรับสู่ AK88 LOTTO! 🎉'}
            </h2>
            <p className="text-xs md:text-sm text-gray-300">
              {welcome.subtitle || 'เว็บแทงหวยออนไลน์มาตรฐานระดับสากล อัตราจ่ายสูงสุด บาทละ 1,000'}
            </p>

            {/* Special Bonus / Notice */}
            {welcome.bonusNotice && (
              <div className="bg-gradient-to-r from-amber-500/20 via-[#f5c518]/20 to-amber-500/20 border border-[#f5c518]/50 rounded-2xl p-3.5 text-left flex items-center gap-3 shadow-inner">
                <span className="material-symbols-outlined text-[#f5c518] text-2xl shrink-0">military_tech</span>
                <div>
                  <div className="text-xs font-black text-[#f5c518]">สิทธิพิเศษสำหรับคุณ</div>
                  <div className="text-[11px] text-amber-100 font-medium leading-tight">{welcome.bonusNotice}</div>
                </div>
              </div>
            )}

            {/* Features Highlight */}
            <div className="space-y-2 text-left mt-2">
              <div className="text-xs font-black text-gray-400 uppercase tracking-wider">จุดเด่นของระบบ</div>
              {(welcome.features && welcome.features.length > 0 ? welcome.features : [
                'ครบทุกหวยดัง: รัฐบาลไทย ยี่กี 88 รอบ ฮานอย ลาว หุ้น',
                'ระบบฝาก-ถอนเงินออโต้ QR Code สแกนจ่ายปรับยอดไวใน 30 วิ',
                'จ่ายเต็ม ปลอดภัย 100% พร้อมบริการซัพพอร์ตตลอด 24 ชั่วโมง'
              ]).map((feat, idx) => (
                <div key={idx} className="flex items-center gap-2.5 text-xs text-gray-200 bg-[#051121] border border-white/5 p-2.5 rounded-xl">
                  <span className="material-symbols-outlined text-emerald-400 text-sm shrink-0">check_circle</span>
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="p-5 pt-3 border-t border-white/10 bg-[#051121]/60 flex flex-col sm:flex-row gap-2.5">
            <button
              onClick={() => handleCloseWelcome(true)}
              className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-white bg-white/10 hover:bg-white/20 transition flex items-center justify-center gap-1.5 border border-white/15"
            >
              <span className="material-symbols-outlined text-base">explore</span>
              <span>ดูไกด์แนะนำระบบ (5 ฟังก์ชัน)</span>
            </button>

            <button
              onClick={() => handleCloseWelcome(false)}
              className="flex-1 py-3 px-4 rounded-xl text-xs font-black text-[#0a192f] bg-gradient-to-r from-amber-400 via-[#f5c518] to-amber-500 hover:brightness-105 shadow transition flex items-center justify-center gap-1.5"
            >
              <span>{welcome.buttonText || 'เริ่มต้นใช้งานทันที'}</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ================= RENDER: 2. Announcement Popup =================
  if (showPopupModal && popup) {
    const config = getTypeConfig(popup.type);

    return (
      <div className="fixed inset-0 z-[105] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-sans">
        <div className={`bg-[#0a192f] border-2 ${config.borderClass} rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative flex flex-col max-h-[90vh]`}>
          {/* Header image if provided */}
          {popup.imageUrl && (
            <div className="w-full h-44 overflow-hidden relative border-b border-white/10">
              <img src={popup.imageUrl} alt="Popup Banner" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a192f] via-transparent to-black/20" />
            </div>
          )}

          {/* Close button */}
          <button
            onClick={handleClosePopup}
            className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-black/60 hover:bg-black/90 text-white flex items-center justify-center transition border border-white/20"
            title="ปิดประกาศ"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>

          {/* Body */}
          <div className="p-6 overflow-y-auto space-y-4">
            {/* Tag badge */}
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border ${config.badgeClass} flex items-center gap-1`}>
                <span className="material-symbols-outlined text-xs">{config.icon}</span>
                <span>{config.label}</span>
              </span>
              {popup.target === 'specific' && (
                <span className="text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full">
                  เฉพาะคุณ
                </span>
              )}
            </div>

            <h3 className="text-lg md:text-xl font-black text-white leading-snug">
              {popup.title || 'ประกาศสำคัญจากระบบ'}
            </h3>

            <div className="bg-[#051121] border border-white/5 rounded-2xl p-4 text-xs md:text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
              {popup.body || 'ไม่มีรายละเอียดประกาศ'}
            </div>
          </div>

          {/* Actions */}
          <div className="p-5 pt-3 border-t border-white/10 bg-[#051121]/60 flex items-center gap-3">
            <button
              onClick={handleClosePopup}
              className="flex-1 py-3 px-4 rounded-xl text-xs font-bold text-gray-300 hover:text-white bg-white/10 hover:bg-white/20 transition"
            >
              รับทราบ / ปิด
            </button>

            {popup.linkUrl && (
              <button
                onClick={() => {
                  handleClosePopup();
                  if (popup.linkUrl?.startsWith('http')) {
                    window.open(popup.linkUrl, '_blank');
                  } else {
                    navigate(popup.linkUrl || '/');
                  }
                }}
                className="flex-1 py-3 px-4 rounded-xl text-xs font-black text-[#0a192f] bg-gradient-to-r from-amber-400 via-[#f5c518] to-amber-500 hover:brightness-105 shadow transition flex items-center justify-center gap-1"
              >
                <span>{popup.actionText || 'ดูรายละเอียด'}</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
