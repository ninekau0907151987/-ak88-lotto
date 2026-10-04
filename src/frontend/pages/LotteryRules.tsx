import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { doc, onSnapshot, collection } from 'firebase/firestore';
import { db } from '@/shared/lib/firebase';
import NationalFlag from '@/shared/components/NationalFlag';

interface PrizeGuide {
  title: string;
  badge: string;
  desc: string;
  example: string;
  badgeColor: string;
}

interface LotteryPresetRule {
  name: string;
  category: string;
  flagKey: string;
  closeTimeDesc: string;
  resultTimeDesc: string;
  sourceDesc: string;
  overview: string;
  defaultRates: Record<string, number>;
  prizes: PrizeGuide[];
  terms: string[];
}

const LOTTERY_RULES_PRESETS: Record<string, LotteryPresetRule> = {
  'หวยรัฐบาลไทย': {
    name: 'หวยรัฐบาลไทย',
    category: 'หวยไทย / สลากกินแบ่ง',
    flagKey: 'th',
    closeTimeDesc: 'ปิดรับแทงทุกวันที่ 1 และ 16 ของเดือน เวลา 15:20 น.',
    resultTimeDesc: 'ออกผลรางวัลตั้งแต่เวลา 15:40 น. เป็นต้นไป',
    sourceDesc: 'อ้างอิงผลสลากกินแบ่งรัฐบาลไทยอย่างเป็นทางการจากสำนักงานสลากกินแบ่งรัฐบาล',
    overview: 'หวยรัฐบาลไทยเปิดรับแทง 2 งวดต่อเดือน คือทุกวันที่ 1 และ 16 (หากตรงกับวันหยุดอาจมีการเลื่อนตามประกาศกองสลาก) มีรูปแบบการเล่นครบทั้ง 3 ตัวบน, 3 ตัวโต๊ด, 3 ตัวล่าง, 3 ตัวหน้า, 2 ตัวบน, 2 ตัวล่าง และเลขวิ่ง',
    defaultRates: {
      '3 ตัวบน': 900,
      '3 ตัวโต๊ด': 150,
      '3 ตัวหน้า': 450,
      '3 ตัวล่าง': 450,
      '2 ตัวบน': 90,
      '2 ตัวล่าง': 90,
      'วิ่งบน': 3.2,
      'วิ่งล่าง': 4.2,
    },
    prizes: [
      {
        title: '3 ตัวบน (ตรง)',
        badge: '3 ตัวตรง',
        badgeColor: 'bg-emerald-600 text-white',
        desc: 'ตัวเลข 3 ตัวท้ายของรางวัลที่ 1 ต้องตรงกันทั้ง 3 หลักและตำแหน่งเดียวกันทั้งหมด',
        example: 'สมมุติรางวัลที่ 1 ออก [123456] → ผล 3 ตัวบนคือ "456"',
      },
      {
        title: '3 ตัวโต๊ด',
        badge: 'สลับตำแหน่ง',
        badgeColor: 'bg-blue-600 text-white',
        desc: 'ตัวเลข 3 ตัวท้ายของรางวัลที่ 1 มีตัวเลขครบทั้ง 3 ตัวแต่ตำแหน่งสามารถสลับที่กันได้',
        example: 'สมมุติ 3 ตัวบนออก 456 → เลขโต๊ดที่ถูกคือ 465, 546, 564, 645, 654',
      },
      {
        title: '3 ตัวหน้า',
        badge: 'หมุน 2 ครั้ง',
        badgeColor: 'bg-amber-600 text-white',
        desc: 'ตัวเลขตรงกับรางวัลเลขหน้า 3 ตัว ที่หมุนออก 2 ครั้ง',
        example: 'ผลสลากหมุนเลขหน้า 3 ตัว 2 ครั้ง ออกครั้งใดตรงกับโพยถือว่าถูกรางวัลทันที',
      },
      {
        title: '3 ตัวล่าง',
        badge: 'หมุน 2 ครั้ง',
        badgeColor: 'bg-amber-600 text-white',
        desc: 'ตัวเลขตรงกับรางวัลเลขท้าย 3 ตัว ที่หมุนออก 2 ครั้ง',
        example: 'ผลสลากหมุนเลขท้าย 3 ตัว 2 ครั้ง ออกครั้งใดตรงกับโพยถือว่าถูกรางวัลทันที',
      },
      {
        title: '2 ตัวบน',
        badge: 'ท้ายรางวัลที่ 1',
        badgeColor: 'bg-purple-600 text-white',
        desc: 'ตัวเลข 2 ตัวท้ายของรางวัลที่ 1 ต้องตรงทั้ง 2 หลักและตำแหน่งตรงกัน',
        example: 'สมมุติรางวัลที่ 1 ออก [123456] → ผล 2 ตัวบนคือ "56"',
      },
      {
        title: '2 ตัวล่าง',
        badge: 'รางวัลเลขท้าย 2 ตัว',
        badgeColor: 'bg-rose-600 text-white',
        desc: 'ตัวเลขตรงกับรางวัลเลขท้าย 2 ตัวของสลากกินแบ่งรัฐบาลตรงทั้ง 2 หลัก',
        example: 'สมมุติผลเลขท้าย 2 ตัวออก [89] → ผล 2 ตัวล่างคือ "89"',
      },
      {
        title: 'วิ่งบน',
        badge: 'เลขเดี่ยวบน',
        badgeColor: 'bg-teal-600 text-white',
        desc: 'มีตัวเลขที่แทงปรากฏอยู่ใน 3 ตัวท้ายของรางวัลที่ 1 อย่างน้อย 1 หลัก',
        example: 'แทงวิ่งบน 5 แล้ว 3 ตัวบนออก 456 → มีเลข 5 อยู่ ได้รับรางวัลทันที',
      },
      {
        title: 'วิ่งล่าง',
        badge: 'เลขเดี่ยวล่าง',
        badgeColor: 'bg-cyan-600 text-white',
        desc: 'มีตัวเลขที่แทงปรากฏอยู่ในเลขท้าย 2 ตัว อย่างน้อย 1 หลัก',
        example: 'แทงวิ่งล่าง 8 แล้ว 2 ตัวล่างออก 89 → มีเลข 8 อยู่ ได้รับรางวัลทันที',
      },
    ],
    terms: [
      'ระบบปิดรับแทงเวลา 15:20 น. ของวันออกสลาก หลังเวลาดังกล่าวจะไม่สามารถส่งโพยหรือแก้ไขได้',
      'สามารถกดยกเลิกโพยได้ภายในระยะเวลา 5 นาทีหลังการส่งโพย (เฉพาะก่อนเวลาปิดรับแทง)',
      'กรณีมีเลขอั้นหรือลดราคาจ่าย ระบบจะแสดงอัตราจ่ายที่แท้จริงให้ยืนยันก่อนกดส่งโพยเสมอ',
      'หากสำนักงานสลากกินแบ่งรัฐบาลเลื่อนการออกรางวัล โพยจะถูกรอตัดสินตามวันที่เลื่อนออกไป',
    ],
  },

  'หวยฮานอย': {
    name: 'หวยฮานอย (ปกติ)',
    category: 'หวยต่างประเทศ / เวียดนาม',
    flagKey: 'vn',
    closeTimeDesc: 'ปิดรับแทงทุกวัน เวลา 18:00 น.',
    resultTimeDesc: 'ออกผลรางวัลทุกวันเวลา 18:15 น. เป็นต้นไป',
    sourceDesc: 'อ้างอิงผลสลากรางวัล Xổ số Truyền Thống ประเทศเวียดนามอย่างเป็นทางการ',
    overview: 'หวยฮานอย (ปกติ) เป็นหวยต่างประเทศยอดนิยมสูงสุด ออกรางวัลทุกวันไม่มีวันหยุด อ้างอิงผลการออกสลากกินแบ่งของประเทศเวียดนาม โดยใช้รางวัลพิเศษและรางวัลที่ 1 ในการตัดสินผลรางวัล',
    defaultRates: {
      '3 ตัวบน': 850,
      '3 ตัวโต๊ด': 120,
      '2 ตัวบน': 92,
      '2 ตัวล่าง': 92,
      'วิ่งบน': 3.2,
      'วิ่งล่าง': 4.2,
    },
    prizes: [
      {
        title: '3 ตัวบน',
        badge: 'ท้ายรางวัลพิเศษ',
        badgeColor: 'bg-emerald-600 text-white',
        desc: 'ใช้ตัวเลข 3 ตัวท้ายของรางวัลพิเศษ (Đặc biệt) ของสลากเวียดนาม',
        example: 'รางวัลพิเศษออก [87654] → 3 ตัวบนคือ "654"',
      },
      {
        title: '3 ตัวโต๊ด',
        badge: 'สลับตำแหน่ง',
        badgeColor: 'bg-blue-600 text-white',
        desc: 'ตัวเลขตรงกับ 3 ตัวท้ายของรางวัลพิเศษ สลับตำแหน่งกันได้ทั้ง 3 หลัก',
        example: 'ผล 654 → โต๊ดที่ถูกคือ 645, 564, 546, 465, 456',
      },
      {
        title: '2 ตัวบน',
        badge: 'ท้ายรางวัลพิเศษ',
        badgeColor: 'bg-purple-600 text-white',
        desc: 'ใช้ตัวเลข 2 ตัวท้ายของรางวัลพิเศษ (Đặc biệt)',
        example: 'รางวัลพิเศษออก [87654] → 2 ตัวบนคือ "54"',
      },
      {
        title: '2 ตัวล่าง',
        badge: 'ท้ายรางวัลที่ 1',
        badgeColor: 'bg-rose-600 text-white',
        desc: 'ใช้ตัวเลข 2 ตัวท้ายของรางวัลที่ 1 (Giải nhất)',
        example: 'รางวัลที่ 1 ออก [98321] → 2 ตัวล่างคือ "21"',
      },
      {
        title: 'วิ่งบน / วิ่งล่าง',
        badge: 'เลขเดี่ยว',
        badgeColor: 'bg-teal-600 text-white',
        desc: 'วิ่งบน: มีเลขตรงกับ 3 ตัวบนหลักใดก็ได้ / วิ่งล่าง: มีเลขตรงกับ 2 ตัวล่างหลักใดก็ได้',
        example: 'แทงวิ่งบน 6 ถูกทันทีเมื่อ 3 ตัวบนออก 654',
      },
    ],
    terms: [
      'เปิดรับแทงทุกวัน ตั้งแต่เวลา 01:00 น. ถึง 18:00 น.',
      'การตัดสินผลจะอ้างอิงจากช่องทางทางการของสลากเวียดนามทันทีที่ออกผลเสร็จสิ้น',
      'หากสลากเวียดนามงดออกรางวัลในวันดังกล่าว ระบบจะคืนเครดิตเต็มจำนวนโดยอัตโนมัติ',
    ],
  },

  'ฮานอยพิเศษ': {
    name: 'ฮานอยพิเศษ',
    category: 'หวยต่างประเทศ / เวียดนาม',
    flagKey: 'vn',
    closeTimeDesc: 'ปิดรับแทงทุกวัน เวลา 17:00 น.',
    resultTimeDesc: 'ออกผลรางวัลเวลา 17:15 น. - 17:30 น.',
    sourceDesc: 'อ้างอิงผลสลากฮานอยพิเศษ (Hanoi Special) อย่างเป็นทางการ',
    overview: 'ฮานอยพิเศษออกผลเร็วกว่าฮานอยปกติ 1 ชั่วโมง เล่นได้ทุกวันไม่มีวันหยุด รูปแบบการดูผลเหมือนหวยฮานอยปกติทุกประการ',
    defaultRates: {
      '3 ตัวบน': 850,
      '3 ตัวโต๊ด': 120,
      '2 ตัวบน': 92,
      '2 ตัวล่าง': 92,
      'วิ่งบน': 3.2,
      'วิ่งล่าง': 4.2,
    },
    prizes: [
      {
        title: '3 ตัวบน / 3 ตัวโต๊ด',
        badge: 'รางวัลพิเศษ',
        badgeColor: 'bg-emerald-600 text-white',
        desc: 'ใช้เลข 3 ตัวท้ายของรางวัลพิเศษ Đặc biệt',
        example: 'รางวัลพิเศษ [12345] → 3 ตัวบนคือ "345"',
      },
      {
        title: '2 ตัวบน / 2 ตัวล่าง',
        badge: 'ท้ายพิเศษ & ท้ายที่ 1',
        badgeColor: 'bg-purple-600 text-white',
        desc: '2 ตัวบน = 2 ตัวท้ายรางวัลพิเศษ, 2 ตัวล่าง = 2 ตัวท้ายรางวัลที่ 1',
        example: 'รางวัลพิเศษ [12345] / รางวัลที่ 1 [67890] → 2 ตัวบน "45", 2 ตัวล่าง "90"',
      },
    ],
    terms: [
      'ปิดรับแทงตรงเวลา 17:00 น. ทุกวัน',
      'คิดผลและจ่ายเงินรางวัลทันทีที่ออกผลรางวัลเสร็จสิ้น',
    ],
  },

  'ฮานอย(VIP)': {
    name: 'ฮานอย VIP',
    category: 'หวยต่างประเทศ / เวียดนาม',
    flagKey: 'vn',
    closeTimeDesc: 'ปิดรับแทงทุกวัน เวลา 19:00 น.',
    resultTimeDesc: 'ออกผลรางวัลเวลา 19:15 น. - 19:30 น.',
    sourceDesc: 'อ้างอิงผลสลากฮานอย VIP อย่างเป็นทางการ',
    overview: 'ฮานอย VIP เป็นรอบยอดนิยมช่วงค่ำ ปิดรับแทง 19:00 น. เหมาะสำหรับผู้ที่ต้องการแทงต่อจากรอบฮานอยปกติ ออกผลทุกวัน',
    defaultRates: {
      '3 ตัวบน': 850,
      '3 ตัวโต๊ด': 120,
      '2 ตัวบน': 92,
      '2 ตัวล่าง': 92,
      'วิ่งบน': 3.2,
      'วิ่งล่าง': 4.2,
    },
    prizes: [
      {
        title: '3 ตัวบน & 2 ตัวบน',
        badge: 'รางวัลพิเศษ',
        badgeColor: 'bg-emerald-600 text-white',
        desc: 'ใช้เลขท้าย 3 ตัว และ 2 ตัว ของรางวัลพิเศษ Đặc biệt',
        example: 'รางวัลพิเศษ [55678] → 3 ตัวบน "678", 2 ตัวบน "78"',
      },
      {
        title: '2 ตัวล่าง',
        badge: 'ท้ายรางวัลที่ 1',
        badgeColor: 'bg-rose-600 text-white',
        desc: 'ใช้เลขท้าย 2 ตัว ของรางวัลที่ 1 Giải nhất',
        example: 'รางวัลที่ 1 [44312] → 2 ตัวล่างคือ "12"',
      },
    ],
    terms: [
      'ปิดรับแทง 19:00 น. ผลออกทันทีหลังปิดรับแทงประมาณ 15-20 นาที',
    ],
  },

  'หวยลาวพัฒนา': {
    name: 'หวยลาวพัฒนา',
    category: 'หวยต่างประเทศ / ลาว',
    flagKey: 'la',
    closeTimeDesc: 'ปิดรับแทงทุกวันจันทร์ พุธ และศุกร์ เวลา 20:00 น.',
    resultTimeDesc: 'ออกผลรางวัลเวลา 20:30 น. เป็นต้นไป',
    sourceDesc: 'อ้างอิงผลสลากพัฒนา รัฐวิสาหกิจหวยพัฒนา กระทรวงการเงิน สปป.ลาว',
    overview: 'หวยลาวพัฒนา หรือ หวยพัฒนา ออกรางวัลสัปดาห์ละ 3 วัน คือ ทุกวันจันทร์ พุธ และศุกร์ อ้างอิงผลการออกเลข 4 หรือ 6 หลักของทางการลาว',
    defaultRates: {
      '3 ตัวบน': 850,
      '3 ตัวโต๊ด': 120,
      '2 ตัวบน': 92,
      '2 ตัวล่าง': 92,
      'วิ่งบน': 3.2,
      'วิ่งล่าง': 4.2,
    },
    prizes: [
      {
        title: '3 ตัวบน',
        badge: 'ท้าย 3 หลัก',
        badgeColor: 'bg-emerald-600 text-white',
        desc: 'ใช้ตัวเลข 3 ตัวท้ายของผลสลากพัฒนา',
        example: 'สมมุติผลสลากออก [8923] → 3 ตัวบนคือ "923"',
      },
      {
        title: '3 ตัวโต๊ด',
        badge: 'สลับตำแหน่ง',
        badgeColor: 'bg-blue-600 text-white',
        desc: 'ตัวเลขตรงกับ 3 ตัวบน สามารถสลับตำแหน่งกันได้',
        example: 'ผล 923 → โต๊ดที่ถูกคือ 932, 293, 239, 392, 329',
      },
      {
        title: '2 ตัวบน',
        badge: 'ท้าย 2 หลัก',
        badgeColor: 'bg-purple-600 text-white',
        desc: 'ใช้ตัวเลข 2 ตัวท้ายสุดของผลสลากพัฒนา',
        example: 'ผลสลากออก [8923] → 2 ตัวบนคือ "23"',
      },
      {
        title: '2 ตัวล่าง',
        badge: 'หน้า 2 หลัก',
        badgeColor: 'bg-rose-600 text-white',
        desc: 'ใช้ตัวเลข 2 ตัวหน้าของผลสลาก 4 หลัก',
        example: 'ผลสลากออก [8923] → 2 ตัวล่างคือ "89"',
      },
      {
        title: 'วิ่งบน / วิ่งล่าง',
        badge: 'เลขเดี่ยว',
        badgeColor: 'bg-teal-600 text-white',
        desc: 'วิ่งบน: มีเลขตรงกับ 3 ตัวบนหลักใดก็ได้ / วิ่งล่าง: มีเลขตรงกับ 2 ตัวล่างหลักใดก็ได้',
        example: 'แทงวิ่งบน 9 ถูกทันทีเมื่อ 3 ตัวบนออก 923',
      },
    ],
    terms: [
      'ออกรางวัลทุกวันจันทร์ พุธ ศุกร์ เวลา 20:30 น. (ปิดรับ 20:00 น.)',
      'หากตรงกับวันหยุดสำคัญของ สปป.ลาว จะมีการเลื่อนวันออกรางวัลตามประกาศทางการ',
    ],
  },

  'หวยยี่กี 88 รอบ': {
    name: 'หวยยี่กี 88 รอบ',
    category: 'หวยจับยี่กี / ออกทุก 15 นาที',
    flagKey: 'th',
    closeTimeDesc: 'ออกรางวัลทุก 15 นาที วันละ 88 รอบ (รอบแรก 06:00 น. ถึง 03:45 น.)',
    resultTimeDesc: 'ออกผลทันทีหลังปิดรอบในแต่ละ 15 นาที',
    sourceDesc: 'คำนวณจากผลรวมตัวเลขที่สมาชิกยิงเลขเข้ามา หักลบด้วยเลขลำดับที่ 16',
    overview: 'หวยจับยี่กี (ปิงปอง) ออกรางวัลตลอด 24 ชั่วโมง วันละ 88 รอบ สมาชิกทุกคนสามารถร่วมยิงตัวเลข 5 หลักเพื่อชิงรางวัลยิงเลขและมีส่วนร่วมในการกำหนดผลรางวัลได้อย่างโปร่งใส',
    defaultRates: {
      '3 ตัวบน': 850,
      '3 ตัวโต๊ด': 120,
      '2 ตัวบน': 92,
      '2 ตัวล่าง': 92,
      'วิ่งบน': 3.2,
      'วิ่งล่าง': 4.2,
    },
    prizes: [
      {
        title: 'สูตรการคำนวณผลยี่กี',
        badge: 'สูตรมาตรฐาน',
        badgeColor: 'bg-amber-600 text-white',
        desc: 'นำ [ผลรวมเลขทั้งหมดที่สมาชิกยิงเข้ามา] ลบด้วย [เลขของสมาชิกลำดับที่ 16]',
        example: 'ผลรวมยิงเลข (12345678) - เลขลำดับที่ 16 (45678) = ผลลัพธ์สุดท้าย [12300000]',
      },
      {
        title: '3 ตัวบน & 3 ตัวโต๊ด',
        badge: 'ท้าย 3 หลัก',
        badgeColor: 'bg-emerald-600 text-white',
        desc: 'นำตัวเลข 3 ตัวท้ายสุดของผลลัพธ์มาเป็นผล 3 ตัวบน',
        example: 'ผลลัพธ์ออก [..12345] → 3 ตัวบนคือ "345"',
      },
      {
        title: '2 ตัวล่าง',
        badge: 'หลักหมื่นและหลักพัน',
        badgeColor: 'bg-rose-600 text-white',
        desc: 'นำตัวเลขหลักที่ 4 และ 5 นับจากท้าย (เลข 2 ตัวหน้าของ 3 ตัวบน) มาเป็นผล 2 ตัวล่าง',
        example: 'ผลลัพธ์ออก [..12345] → 2 ตัวล่างคือ "12"',
      },
    ],
    terms: [
      'รอบยี่กีเปิดแทงล่วงหน้าได้ตลอดเวลา',
      'หากในรอบนั้นมีการยิงเลขไม่ถึงเกณฑ์ที่กำหนด ระบบจะทำการสุ่มตัวเลขเสริมเพื่อให้รอบออกผลได้อย่างต่อเนื่อง',
    ],
  },


  'หวยธกส.': {
    name: 'หวย ธ.ก.ส.',
    category: 'หวยไทย / สลากออมทรัพย์',
    flagKey: 'th',
    closeTimeDesc: 'ปิดรับแทงทุกวันที่ 16 ของเดือน เวลา 09:00 น.',
    resultTimeDesc: 'ออกผลรางวัลเวลาประมาณ 09:30 น. - 11:00 น.',
    sourceDesc: 'อ้างอิงผลการออกรางวัลสลากออมทรัพย์ ธนาคารเพื่อการเกษตรและสหกรณ์การเกษตร (ธ.ก.ส.)',
    overview: 'หวย ธ.ก.ส. ออกรางวัลทุกวันที่ 16 ของทุกเดือน อ้างอิงผลสลากออมทรัพย์ ธ.ก.ส. ใช้เลขท้ายรางวัลที่ 1 ในการตัดสินผลรางวัล',
    defaultRates: {
      '3 ตัวบน': 900,
      '3 ตัวโต๊ด': 150,
      '2 ตัวบน': 90,
      '2 ตัวล่าง': 90,
      'วิ่งบน': 3.2,
      'วิ่งล่าง': 4.2,
    },
    prizes: [
      {
        title: '3 ตัวบน / 2 ตัวบน',
        badge: 'รางวัลที่ 1 ธ.ก.ส.',
        badgeColor: 'bg-emerald-600 text-white',
        desc: 'ใช้ตัวเลข 3 ตัวท้าย และ 2 ตัวท้าย ของรางวัลที่ 1 สลาก ธ.ก.ส.',
        example: 'รางวัลที่ 1 ออก [7654321] → 3 ตัวบน "321", 2 ตัวบน "21"',
      },
      {
        title: '2 ตัวล่าง',
        badge: 'เลขท้าย 2 ตัว ธ.ก.ส.',
        badgeColor: 'bg-rose-600 text-white',
        desc: 'ใช้เลขท้าย 2 ตัว ของผลการหมุนรางวัลเลขท้าย 2 ตัว',
        example: 'เลขท้าย 2 ตัวออก [45] → 2 ตัวล่างคือ "45"',
      },
    ],
    terms: [
      'ปิดรับแทงช่วงเช้า 09:00 น. ของทุกวันที่ 16',
    ],
  },

  'หวยออมสิน': {
    name: 'หวยออมสิน',
    category: 'หวยไทย / สลากออมทรัพย์',
    flagKey: 'th',
    closeTimeDesc: 'ปิดรับแทงทุกวันที่ 1 และ 16 ของเดือน เวลา 12:30 น.',
    resultTimeDesc: 'ออกผลรางวัลเวลา 13:00 น. - 14:00 น.',
    sourceDesc: 'อ้างอิงผลการออกรางวัลสลากออมสินพิเศษ ธนาคารออมสิน',
    overview: 'หวยออมสิน ออกรางวัลทุกวันที่ 1 (สลากออมสินพิเศษ 2 ปี) และวันที่ 16 (สลากออมสินพิเศษ 1 ปี) ของทุกเดือน อ้างอิงผลรางวัลสลากออมสินอย่างเป็นทางการ',
    defaultRates: {
      '3 ตัวบน': 900,
      '3 ตัวโต๊ด': 150,
      '2 ตัวบน': 90,
      '2 ตัวล่าง': 90,
      'วิ่งบน': 3.2,
      'วิ่งล่าง': 4.2,
    },
    prizes: [
      {
        title: '3 ตัวบน / 2 ตัวบน',
        badge: 'สลากออมสินพิเศษ',
        badgeColor: 'bg-emerald-600 text-white',
        desc: 'ใช้ตัวเลข 3 ตัวท้าย และ 2 ตัวท้าย ของผลรางวัลสลากออมสิน',
        example: 'ผลสลากออก [98765] → 3 ตัวบน "765", 2 ตัวบน "65"',
      },
      {
        title: '2 ตัวล่าง',
        badge: 'เลขท้าย 2 ตัว',
        badgeColor: 'bg-rose-600 text-white',
        desc: 'ใช้เลขท้าย 2 ตัว ของผลรางวัล',
        example: 'เลขท้าย 2 ตัวออก [33] → 2 ตัวล่างคือ "33"',
      },
    ],
    terms: [
      'ปิดรับแทง 12:30 น. ทุกวันที่ 1 และ 16 ของเดือน',
    ],
  },
};

/** แปลง slug เช่น 'thai', 'hanoi' ให้เป็นชื่อหวยมาตรฐานภาษาไทย */
function resolveLotteryStandardName(slugOrName?: string): string | null {
  if (!slugOrName) return null;
  const s = decodeURIComponent(slugOrName).toLowerCase().trim();

  if (s === 'thai' || s === 'thailand' || s.includes('รัฐบาล')) return 'หวยรัฐบาลไทย';
  if (s === 'hanoi' || s === 'hanoivn' || (s.includes('ฮานอย') && !s.includes('พิเศษ') && !s.includes('vip'))) return 'หวยฮานอย';
  if (s === 'hanoi-special' || s === 'hanoispecial' || s.includes('ฮานอยพิเศษ')) return 'ฮานอยพิเศษ';
  if (s === 'hanoi-vip' || s === 'hanoivip' || s.includes('ฮานอยvip') || s.includes('ฮานอย(vip)')) return 'ฮานอย(VIP)';
  if (s === 'lao' || s === 'laos' || s.includes('ลาว')) return 'หวยลาวพัฒนา';
  if (s === 'yeekee' || s === 'yiki' || s.includes('ยี่กี')) return 'หวยยี่กี 88 รอบ';
  if (s === 'baac' || s.includes('ธกส') || s.includes('ธ.ก.ส')) return 'หวยธกส.';
  if (s === 'gsb' || s.includes('ออมสิน')) return 'หวยออมสิน';

  // ค้นหาใน Keys ของ presets
  for (const k of Object.keys(LOTTERY_RULES_PRESETS)) {
    if (k.toLowerCase() === s || s.includes(k.toLowerCase()) || k.toLowerCase().includes(s)) {
      return k;
    }
  }

  return decodeURIComponent(slugOrName);
}

export default function LotteryRules() {
  const { type: routeType } = useParams();
  const navigate = useNavigate();

  // ตรวจสอบว่าผู้ใช้ระบุหวยเฉพาะเจาะจงมาทาง URL หรือไม่ (เช่น /lottery/thai/rules)
  const isDirectLotteryView = Boolean(routeType && routeType !== 'rules');
  const targetLotteryName = resolveLotteryStandardName(routeType);

  const [selectedTab, setSelectedTab] = useState<string>(
    targetLotteryName || 'general'
  );
  const [generalRules, setGeneralRules] = useState<string>('');
  const [lotteryList, setLotteryList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Subscribe to general rules and lottery types
  useEffect(() => {
    let unsubGeneral = () => {};
    let unsubLotteries = () => {};

    try {
      unsubGeneral = onSnapshot(doc(db, 'settings', 'rules'), (snap) => {
        if (snap.exists()) {
          setGeneralRules(snap.data().content || '');
        }
      }, (err) => console.warn('General rules warning:', err));

      unsubLotteries = onSnapshot(collection(db, 'lotteryTypes'), (snap) => {
        const list = snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
        }));
        setLotteryList(list);
        setLoading(false);
      }, (err) => {
        console.warn('Lottery types warning:', err);
        setLoading(false);
      });
    } catch {
      setLoading(false);
    }

    return () => {
      unsubGeneral();
      unsubLotteries();
    };
  }, []);

  // Update selected tab if route changes
  useEffect(() => {
    if (targetLotteryName) {
      setSelectedTab(targetLotteryName);
    }
  }, [targetLotteryName]);

  // Find active lottery data from DB or Preset
  const activeDbLottery = useMemo(() => {
    return lotteryList.find(
      l => l.id === selectedTab || l.name === selectedTab || resolveLotteryStandardName(l.id) === selectedTab
    );
  }, [lotteryList, selectedTab]);

  const preset = LOTTERY_RULES_PRESETS[selectedTab] || LOTTERY_RULES_PRESETS['หวยรัฐบาลไทย'];
  const displayRates = activeDbLottery?.rates || preset?.defaultRates || {};
  const flagKey = activeDbLottery?.category || preset?.flagKey || 'th';

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans pb-24">
      {/* Header Bar */}
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
                <span>{isDirectLotteryView ? `กติกาและวิธีเล่น ${selectedTab}` : 'กติกาและวิธีการเล่นทั้งหมด'}</span>
              </h1>
              <p className="text-[11px] text-slate-400">
                {isDirectLotteryView ? `คู่มือและข้อกำหนดของ ${selectedTab} อย่างละเอียด` : 'ระบบกติกาและข้อกำหนดมาตรฐาน AK88'}
              </p>
            </div>
          </div>

          {/* Quick link to bet */}
          <Link
            to={isDirectLotteryView ? `/lottery/${encodeURIComponent(selectedTab)}` : '/lottery'}
            className="text-xs bg-gradient-to-r from-amber-400 via-[#f5c518] to-amber-500 text-[#0a192f] font-black px-4 py-2 rounded-xl shadow hover:brightness-105 transition flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm">casino</span>
            <span>{isDirectLotteryView ? 'แทงหวยนี้ทันที' : 'ไปแทงหวย'}</span>
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4 space-y-5">
        {/* Navigation Selector Bar (แสดงเฉพาะเมื่อไม่ได้เจาะจงหวยผ่าน URL เพื่อไม่ให้รกสายตา) */}
        {!isDirectLotteryView && (
          <div className="bg-[#0a192f] border border-[#f5c518]/30 rounded-2xl p-2 shadow-sm">
            <div className="text-[11px] font-bold text-slate-400 px-2 py-1 mb-1">
              เลือกดูตามประเภทหวย:
            </div>
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedTab('general')}
                className={`px-4 py-2 rounded-xl text-xs font-black shrink-0 transition flex items-center gap-1.5 ${
                  selectedTab === 'general'
                    ? 'bg-gradient-to-r from-amber-400 via-[#f5c518] to-amber-500 text-[#0a192f] shadow'
                    : 'bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                <span className="material-symbols-outlined text-sm">verified_user</span>
                <span>กติกาการเล่นทั่วไป</span>
              </button>

              {Object.keys(LOTTERY_RULES_PRESETS).map((key) => {
                const isActive = selectedTab === key;
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedTab(key)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 transition flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-gradient-to-r from-amber-400 via-[#f5c518] to-amber-500 text-[#0a192f] font-black shadow'
                        : 'bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">confirmation_number</span>
                    <span>{key}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= Specific Lottery View ================= */}
        {selectedTab !== 'general' ? (
          <div className="space-y-4">
            {/* 1. Hero Card: ข้อมูลหวยและเวลา */}
            <div className="bg-gradient-to-br from-[#0a192f] to-[#172a45] rounded-3xl p-6 border border-[#f5c518]/30 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#f5c518]/5 rounded-full blur-3xl pointer-events-none"></div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center shrink-0 shadow-inner">
                    <NationalFlag name={preset.name} category={flagKey} size="lg" className="w-12 h-8 rounded shadow" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400/20 text-[#f5c518] px-2.5 py-0.5 rounded-full border border-amber-400/30">
                        {preset.category}
                      </span>
                    </div>
                    <h2 className="text-xl md:text-2xl font-black text-white mt-1">
                      {preset.name}
                    </h2>
                    <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
                      {preset.overview}
                    </p>
                  </div>
                </div>

                <Link
                  to={`/lottery/${encodeURIComponent(selectedTab)}`}
                  className="bg-gradient-to-r from-amber-400 via-[#f5c518] to-amber-500 hover:brightness-110 text-[#0a192f] font-black px-5 py-3 rounded-2xl shadow-lg transition flex items-center justify-center gap-2 text-sm self-start sm:self-auto shrink-0"
                >
                  <span className="material-symbols-outlined text-base">sports_esports</span>
                  <span>เข้าห้องแทงหวยนี้</span>
                </Link>
              </div>

              {/* เวลาปิดรับและเวลาออกผล */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6 pt-5 border-t border-white/10 text-xs">
                <div className="bg-white/5 rounded-2xl p-3.5 border border-white/5 flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-400 text-xl shrink-0 mt-0.5">timer</span>
                  <div>
                    <div className="font-bold text-amber-400">เวลาปิดรับแทง:</div>
                    <div className="text-slate-200 mt-0.5">{preset.closeTimeDesc}</div>
                  </div>
                </div>

                <div className="bg-white/5 rounded-2xl p-3.5 border border-white/5 flex items-start gap-3">
                  <span className="material-symbols-outlined text-emerald-400 text-xl shrink-0 mt-0.5">campaign</span>
                  <div>
                    <div className="font-bold text-emerald-400">เวลาประกาศผลรางวัล:</div>
                    <div className="text-slate-200 mt-0.5">{preset.resultTimeDesc}</div>
                  </div>
                </div>
              </div>

              <div className="mt-3 text-[11px] text-slate-400 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-xs text-slate-500">public</span>
                <span>แหล่งอ้างอิง: {preset.sourceDesc}</span>
              </div>
            </div>

            {/* 2. ตารางอัตราจ่ายรางวัล (Payout Rates) */}
            <div className="bg-[#0f172a] rounded-3xl p-6 border border-slate-800 shadow-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <span className="material-symbols-outlined text-emerald-400">payments</span>
                  <span>ตารางอัตราจ่ายรางวัล ({preset.name})</span>
                </h3>
                <span className="text-[11px] text-slate-400 font-bold">อัตราจ่ายมาตรฐาน</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {Object.entries(displayRates).map(([type, rate]) => (
                  <div 
                    key={type}
                    className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-2xl p-3.5 flex flex-col justify-between transition group shadow-sm"
                  >
                    <span className="text-xs text-slate-300 font-bold">{type}</span>
                    <div className="mt-2">
                      <div className="text-[10px] text-slate-400">จ่ายสูงสุด</div>
                      <div className="text-base sm:text-lg font-black text-emerald-400 group-hover:scale-105 transition-transform origin-left">
                        ฿{Number(rate).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. วิธีการเล่นและดูผลแต่ละรางวัล (How to Play & Prize Guide) */}
            <div className="bg-[#0f172a] rounded-3xl p-6 border border-slate-800 shadow-md space-y-4">
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-[#f5c518]">menu_book</span>
                <span>วิธีการดูผลรางวัลและการตัดสิน</span>
              </h3>

              <div className="space-y-3">
                {preset.prizes.map((pz, idx) => (
                  <div 
                    key={idx}
                    className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 space-y-2 hover:border-slate-600 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-sm text-white flex items-center gap-2">
                        <span className="w-6 h-6 rounded-full bg-slate-700 text-slate-300 text-xs flex items-center justify-center font-bold">
                          {idx + 1}
                        </span>
                        <span>{pz.title}</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${pz.badgeColor}`}>
                        {pz.badge}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 pl-8 leading-relaxed">
                      {pz.desc}
                    </p>

                    <div className="ml-8 bg-slate-900/90 rounded-xl px-3 py-2 border border-slate-700/40 text-xs text-amber-300 flex items-center gap-2 font-mono">
                      <span className="material-symbols-outlined text-xs text-amber-400">lightbulb</span>
                      <span>ตัวอย่าง: {pz.example}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 4. กติกาและข้อกำหนด (Terms & Conditions) */}
            <div className="bg-[#0f172a] rounded-3xl p-6 border border-slate-800 shadow-md space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400 text-base">rule</span>
                <span>ข้อกำหนดและเงื่อนไขการรับแทง</span>
              </h3>
              <ul className="space-y-2 text-xs text-slate-300 list-disc list-inside leading-relaxed">
                {preset.terms.map((term, i) => (
                  <li key={i}>{term}</li>
                ))}
              </ul>
            </div>

            {/* ปุ่มนำทางท้ายหน้า */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                onClick={() => navigate('/lottery')}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-xs font-bold transition flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                <span>ดูหวยประเภทอื่น</span>
              </button>

              <Link
                to={`/lottery/${encodeURIComponent(selectedTab)}`}
                className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-amber-400 via-[#f5c518] to-amber-500 text-[#0a192f] text-xs font-black shadow-lg hover:brightness-105 transition flex items-center justify-center gap-2"
              >
                <span>ไปยังห้องแทง {preset.name}</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </Link>
            </div>
          </div>
        ) : (
          /* ================= 2. General Rules View ================= */
          <div className="bg-[#0f172a] rounded-3xl shadow-sm border border-slate-800 overflow-hidden">
            <div className="bg-gradient-to-r from-[#0a192f] to-[#172a45] p-6 text-white border-b border-[#f5c518]/30">
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
                <div className="prose prose-invert prose-sm max-w-none text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {generalRules}
                </div>
              ) : (
                <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
                  <div className="bg-amber-950/30 border border-amber-800/40 rounded-2xl p-4">
                    <h3 className="font-bold text-amber-300 flex items-center gap-2 mb-2 text-base">
                      <span className="material-symbols-outlined text-amber-400">info</span>
                      1. ข้อกำหนดการเดิมพันและการตัดยอด
                    </h3>
                    <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-300">
                      <li>ระบบจะเปิดรับแทงและปิดรับแทงตามเวลาที่กำหนดในแต่ละรอบอย่างเคร่งครัด</li>
                      <li>หากมีการส่งโพยหลังจากเวลาปิดรับแทง ระบบจะถือว่าการแทงในรอบนั้นเป็นโมฆะและคืนเครดิตทันที</li>
                      <li>สมาชิกมีหน้าที่ตรวจสอบความถูกต้องของตัวเลขและยอดเงินก่อนกดยืนยันการแทงเสมอ</li>
                    </ul>
                  </div>

                  <div className="bg-blue-950/30 border border-blue-800/40 rounded-2xl p-4">
                    <h3 className="font-bold text-blue-300 flex items-center gap-2 mb-2 text-base">
                      <span className="material-symbols-outlined text-blue-400">account_balance_wallet</span>
                      2. การฝาก-ถอนเงิน และอัตราจ่าย
                    </h3>
                    <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-300">
                      <li>ระบบฝากเงินผ่าน QR Code อัตโนมัติ ปรับยอดเครดิตภายใน 30 วินาที</li>
                      <li>การถอนเงินจะโอนเข้าเฉพาะบัญชีธนาคารที่มีชื่อ-นามสกุลตรงกับที่ลงทะเบียนไว้เท่านั้น</li>
                      <li>อัตราจ่ายสูงสุด 3 ตัวตรง บาทละ 900 และ 2 ตัวตรง บาทละ 90 - 92 ตามประเภทหวย</li>
                    </ul>
                  </div>

                  <div className="bg-rose-950/30 border border-rose-800/40 rounded-2xl p-4">
                    <h3 className="font-bold text-rose-300 flex items-center gap-2 mb-2 text-base">
                      <span className="material-symbols-outlined text-rose-400">security</span>
                      3. ข้อห้ามและการรักษาความปลอดภัย
                    </h3>
                    <ul className="list-disc list-inside space-y-1.5 text-xs text-slate-300">
                      <li>ห้ามใช้โปรแกรมบอท ดัดแปลง หรือทุจริตระบบโดยเด็ดขาด หากตรวจพบจะระงับการใช้งานทันที</li>
                      <li>การตัดสินของคณะทำงาน AK88 ถือเป็นที่สิ้นสุดในกรณีเกิดเหตุขัดข้องทางเทคนิคที่ไม่คาดคิด</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
