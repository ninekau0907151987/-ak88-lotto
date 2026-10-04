import React from 'react';

const FLAG_MAP: Record<string, { code: string; label: string }> = {
  // ไทย
  'thai': { code: 'th', label: 'ไทย' },
  'th': { code: 'th', label: 'ไทย' },
  'รัฐบาล': { code: 'th', label: 'ไทย' },
  'ธกส': { code: 'th', label: 'ไทย' },
  'ออมสิน': { code: 'th', label: 'ไทย' },
  'หุ้นไทย': { code: 'th', label: 'ไทย' },

  // เวียดนาม / ฮานอย
  'hanoi': { code: 'vn', label: 'เวียดนาม' },
  'vietnam': { code: 'vn', label: 'เวียดนาม' },
  'ฮานอย': { code: 'vn', label: 'เวียดนาม' },
  'เวียดนาม': { code: 'vn', label: 'เวียดนาม' },

  // ลาว
  'lao': { code: 'la', label: 'ลาว' },
  'ลาว': { code: 'la', label: 'ลาว' },

  // ญี่ปุ่น
  'nikkei': { code: 'jp', label: 'ญี่ปุ่น' },
  'นิเคอิ': { code: 'jp', label: 'ญี่ปุ่น' },
  'japan': { code: 'jp', label: 'ญี่ปุ่น' },

  // จีน
  'china': { code: 'cn', label: 'จีน' },
  'จีน': { code: 'cn', label: 'จีน' },

  // ฮ่องกง
  'hangseng': { code: 'hk', label: 'ฮ่องกง' },
  'ฮั่งเส็ง': { code: 'hk', label: 'ฮ่องกง' },
  'hsi': { code: 'hk', label: 'ฮ่องกง' },

  // ไต้หวัน
  'taiwan': { code: 'tw', label: 'ไต้หวัน' },
  'ไต้หวัน': { code: 'tw', label: 'ไต้หวัน' },

  // เกาหลี
  'korea': { code: 'kr', label: 'เกาหลี' },
  'เกาหลี': { code: 'kr', label: 'เกาหลี' },

  // สิงคโปร์
  'singapore': { code: 'sg', label: 'สิงคโปร์' },
  'สิงคโปร์': { code: 'sg', label: 'สิงคโปร์' },


  // สหรัฐอเมริกา
  'dowjones': { code: 'us', label: 'สหรัฐอเมริกา' },
  'ดาวน์โจนส์': { code: 'us', label: 'สหรัฐอเมริกา' },
  'usa': { code: 'us', label: 'สหรัฐอเมริกา' },

  // สหราชอาณาจักร / อังกฤษ
  'uk': { code: 'gb', label: 'อังกฤษ' },
  'อังกฤษ': { code: 'gb', label: 'อังกฤษ' },
  'england': { code: 'gb', label: 'อังกฤษ' },

  // เยอรมนี
  'germany': { code: 'de', label: 'เยอรมนี' },
  'เยอรมัน': { code: 'de', label: 'เยอรมนี' },

  // รัสเซีย
  'russia': { code: 'ru', label: 'รัสเซีย' },
  'รัสเซีย': { code: 'ru', label: 'รัสเซีย' },

  // อินเดีย
  'india': { code: 'in', label: 'อินเดีย' },
  'อินเดีย': { code: 'in', label: 'อินเดีย' },

  // อียิปต์
  'egypt': { code: 'eg', label: 'อียิปต์' },
  'อียิปต์': { code: 'eg', label: 'อียิปต์' },
};

export function getFlagInfo(nameOrId: string, category?: string): { code: string; label: string; url: string } | null {
  if (!nameOrId) return null;
  const lower = nameOrId.toLowerCase();

  for (const [key, val] of Object.entries(FLAG_MAP)) {
    if (lower.includes(key)) {
      return {
        ...val,
        url: `https://flagcdn.com/w80/${val.code}.png`,
      };
    }
  }

  if (category === 'thai') {
    return { code: 'th', label: 'ไทย', url: 'https://flagcdn.com/w80/th.png' };
  }

  return null;
}

interface NationalFlagProps {
  name: string;
  category?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function NationalFlag({ name, category, size = 'md', className = '' }: NationalFlagProps) {
  const flag = getFlagInfo(name, category);

  // ถ้าเป็นยี่กี
  if (name.includes('ยี่กี') || category === 'yeekee') {
    return (
      <span className={`material-symbols-outlined text-yellow-400 inline-flex items-center ${size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-base' : 'text-xl'} ${className}`}>
        timer
      </span>
    );
  }

  // ถ้าเป็นหวยชุด
  if (name.includes('ชุด') || category === 'set') {
    return (
      <span className={`material-symbols-outlined text-cyan-300 inline-flex items-center ${size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-base' : 'text-xl'} ${className}`}>
        inventory_2
      </span>
    );
  }

  if (!flag) {
    return (
      <span className={`material-symbols-outlined text-amber-300 inline-flex items-center ${size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-base' : 'text-xl'} ${className}`}>
        stars
      </span>
    );
  }

  const sizeClasses = {
    sm: 'w-5 h-3.5',
    md: 'w-6 h-4 sm:w-7 sm:h-4.5',
    lg: 'w-12 h-8 sm:w-14 sm:h-9',
  }[size];

  return (
    <div className={`inline-flex items-center justify-center shrink-0 rounded overflow-hidden shadow-sm border border-white/20 bg-black/30 ${sizeClasses} ${className}`}>
      <img
        src={flag.url}
        alt={flag.label}
        className="w-full h-full object-cover"
        loading="lazy"
        onError={(e) => {
          (e.currentTarget as HTMLElement).style.display = 'none';
        }}
      />
    </div>
  );
}
