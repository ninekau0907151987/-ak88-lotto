/**
 * src/shared/hooks/useBreakpoint.ts
 * ------------------------------------------------------------------
 * ★ ตรวจขนาดหน้าจอ — ใช้แยกพฤติกรรม PC / มือถือ ★
 *
 * ทำไมต้องมี: ผู้ใช้ต้องการให้ PC ใช้งานง่ายขึ้น (กว้างขึ้น ตัวใหญ่ขึ้น)
 *             โดยไม่กระทบ layout มือถือเดิมแม้แต่นิดเดียว
 *
 * วิธีใช้:
 *   const { isPC, isTablet, isMobile } = useBreakpoint();
 *   isPC === true  → แสดง layout PC (กว้าง, หลายคอลัมน์)
 *   isMobile       → แสดง layout เดิมทุกจุด
 *
 * ค่า breakpoint (ตรงกับ Tailwind):
 *   mobile  < 768px     → layout เดิม
 *   tablet  768-1279px  → layout 2 คอลัมน์ แคบ
 *   pc      >= 1280px   → layout PC เต็ม (กว้างสุด 1600px)
 */
import { useState, useEffect } from 'react';

export interface Breakpoint {
  width: number;
  isMobile: boolean;
  isTablet: boolean;
  isPC: boolean;
  /** PC จอกว้างมาก >= 1536px */
  isWide: boolean;
}

function measure(): Breakpoint {
  // SSR-safe: ถ้าไม่มี window ให้ถือว่าเป็น mobile
  const width = typeof window !== 'undefined' ? window.innerWidth : 0;
  return {
    width,
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1280,
    isPC: width >= 1280,
    isWide: width >= 1536,
  };
}

export function useBreakpoint(): Breakpoint {
  const [bp, setBp] = useState<Breakpoint>(measure);

  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      // throttle ด้วย requestAnimationFrame — กันกระตุกตอนลากหน้าต่าง
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setBp(measure()));
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  return bp;
}
