import { Link, useNavigate } from 'react-router-dom';

export default function YeekeeList() {
  const navigate = useNavigate();
  // สร้างข้อมูลจำลอง 88 รอบ
  const rounds = Array.from({ length: 88 }, (_, i) => {
    const round = i + 1;
    // สมมติให้รอบ 1-14 ปิดแล้ว, รอบ 15 กำลังเปิด, รอบ 16-88 รอเปิด
    let status = 'waiting';
    if (round < 15) status = 'closed';
    else if (round === 15) status = 'open';

    // คำนวณเวลาแบบจำลอง (เริ่ม 06:00 รอบละ 15 นาที)
    const totalMinutes = 6 * 60 + round * 15;
    const hour = Math.floor(totalMinutes / 60) % 24;
    const minute = totalMinutes % 60;
    const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} น.`;

    return { round, timeStr, status };
  });

  return (
    <div className="min-h-screen bg-[var(--bg-grey-light)] pb-20">
      {/* Header */}
      <div className="bg-[var(--navy-deep)] p-3 flex items-center gap-3 sticky top-[57px] z-40 shadow-md">
        <button onClick={() => navigate(-1)} className="text-white flex items-center">
          <span className="material-symbols-outlined">arrow_back_ios</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[var(--gold-vibrant)]">timer</span>
          <h1 className="text-white font-bold text-lg">หวยยี่กี (88 รอบ)</h1>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        <div className="mb-3 bg-white p-2 rounded border border-[var(--grey-border)] flex items-center gap-2 text-sm text-[var(--navy-deep)]">
          <span className="material-symbols-outlined text-[var(--gold-vibrant)]">info</span>
          <span>เลือกรอบหวยยี่กีที่ต้องการเดิมพัน ออกผลทุก 15 นาที</span>
        </div>

        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
          {rounds.map((r) => {
            if (r.status === 'open') {
              return (
                <Link 
                  key={r.round} 
                  to={`/lottery/yeekee-${r.round}`}
                  className="border-2 border-[var(--gold-vibrant)] bg-white rounded-lg p-2 flex flex-col items-center justify-center text-center shadow-md relative overflow-hidden transform transition active:scale-95"
                >
                  <div className="bg-[var(--gold-vibrant)] text-[var(--navy-deep)] text-[10px] w-full py-0.5 font-bold mb-1 rounded-sm">
                    กำลังเปิดรับ
                  </div>
                  <div className="font-black text-[var(--navy-deep)] text-lg">รอบ {r.round}</div>
                  <div className="text-[10px] text-gray-600">{r.timeStr}</div>
                </Link>
              );
            } else if (r.status === 'closed') {
              return (
                <div 
                  key={r.round} 
                  className="border border-gray-300 bg-gray-200 rounded-lg p-2 flex flex-col items-center justify-center text-center opacity-70"
                >
                  <div className="bg-gray-400 text-white text-[10px] w-full py-0.5 font-bold mb-1 rounded-sm">
                    ปิดรับแทง
                  </div>
                  <div className="font-bold text-gray-500 text-lg">รอบ {r.round}</div>
                  <div className="text-[10px] text-gray-500">{r.timeStr}</div>
                </div>
              );
            } else {
              return (
                <div 
                  key={r.round} 
                  className="border border-[var(--grey-border)] bg-white rounded-lg p-2 flex flex-col items-center justify-center text-center"
                >
                  <div className="bg-[var(--navy-deep)] text-white text-[10px] w-full py-0.5 font-bold mb-1 rounded-sm">
                    รอเปิดรับ
                  </div>
                  <div className="font-bold text-[var(--navy-deep)] text-lg">รอบ {r.round}</div>
                  <div className="text-[10px] text-gray-500">{r.timeStr}</div>
                </div>
              );
            }
          })}
        </div>
      </div>
    </div>
  );
}
