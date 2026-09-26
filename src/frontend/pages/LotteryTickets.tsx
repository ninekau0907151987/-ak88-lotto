import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { db } from '@/shared/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, getDoc, getDocs, addDoc } from 'firebase/firestore';
import html2canvas from 'html2canvas';

export default function LotteryTickets() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('all');
  const [tickets, setTickets] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const ticketRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});

  const currentUserId = localStorage.getItem('userId');
  const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';

  useEffect(() => {
    if (!isLoggedIn || !currentUserId) {
      setTickets([]);
      return;
    }

    const q = query(
      collection(db, 'tickets'),
      where('userId', '==', currentUserId),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTickets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.warn('Tickets subscription warning:', err);
    });

    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [currentUserId, isLoggedIn]);

  const getStatusDisplay = (ticket: any) => {
    if (ticket.status === 'cancelled') return { label: 'ยกเลิกแล้ว', color: 'bg-gray-100 text-gray-500' };
    if (ticket.status === 'win') return { label: `ชนะ ฿${ticket.winAmount?.toLocaleString()}`, color: 'bg-green-100 text-green-700' };
    if (ticket.status === 'lose') return { label: 'ไม่ถูกรางวัล', color: 'bg-red-100 text-red-700' };
    
    const expiresAt = new Date(ticket.expiresAt).getTime();
    if (ticket.status === 'pending_cancellation' && currentTime < expiresAt) {
      const remaining = Math.max(0, Math.floor((expiresAt - currentTime) / 1000));
      return { label: `กำลังเดิมพัน (${remaining}ว.)`, color: 'bg-blue-100 text-blue-700', canCancel: true };
    }
    
    return { label: 'รอผลรางวัล', color: 'bg-yellow-100 text-yellow-700' };
  };

  const copyTicketAsBillText = (ticket: any) => {
    const groups: { [key: string]: { number: string; amount: number }[] } = {};
    const bets = ticket.bets || [];
    bets.forEach((bet: any) => {
      if (!groups[bet.type]) groups[bet.type] = [];
      groups[bet.type].push({ number: bet.number, amount: bet.amount });
    });

    let billText = `=============================\n`;
    billText += `   ใบเสร็จรับเงิน / โพยแทงหวย\n`;
    billText += `   ประเภท: ${ticket.lotteryType}\n`;
    billText += `=============================\n`;
    billText += `เลขบิล: ${ticket.ticketId}\n`;
    billText += `วันที่: ${new Date(ticket.createdAt).toLocaleString('th-TH')}\n`;
    billText += `ลูกค้า: ${ticket.customerName || 'ลูกค้าทั่วไป'}\n`;
    billText += `-----------------------------\n`;

    Object.entries(groups).forEach(([type, typeBets]) => {
      billText += `▶ [${type}]\n`;
      const lines: string[] = [];
      typeBets.forEach(b => {
        lines.push(`${b.number}=${b.amount}฿`);
      });
      for (let i = 0; i < lines.length; i += 3) {
        billText += `   ` + lines.slice(i, i + 3).join(', ') + `\n`;
      }
      const typeTotal = typeBets.reduce((sum, b) => sum + b.amount, 0);
      billText += `   รวมยอด: ${typeTotal} ฿\n`;
      billText += `-----------------------------\n`;
    });

    billText += `ยอดรวมทั้งหมด: ${ticket.totalAmount.toLocaleString()} ฿\n`;
    billText += `=============================\n`;
    billText += `* ขอบคุณที่ใช้บริการครับ *\n`;

    navigator.clipboard.writeText(billText).then(() => {
      alert('คัดลอกข้อความบิลสำเร็จแล้ว! สามารถกดส่งต่อทาง LINE หรือ Facebook ได้ทันที');
    }).catch(err => {
      console.error('Failed to copy text: ', err);
      alert('ไม่สามารถคัดลอกได้อัตโนมัติ กรุณาลองอีกครั้ง');
    });
  };

  const filteredTickets = tickets.filter(t => {
    const statusInfo = getStatusDisplay(t);
    if (activeTab === 'pending' && !statusInfo.label.includes('รอผล') && !statusInfo.label.includes('กำลังเดิมพัน')) return false;
    if (activeTab === 'resulted' && !['win', 'lose'].includes(t.status)) return false;
    if (activeTab === 'cancelled' && t.status !== 'cancelled') return false;
    return true;
  });

  const cancelTicket = async (ticket: any) => {
    if (window.confirm('คุณต้องการยกเลิกโพยนี้ใช่หรือไม่? ยอดเงินจะถูกคืนเข้าบัญชี')) {
      try {
        // Refund Balance
        const userRef = doc(db, 'users', ticket.userId);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
           const currentBalance = userSnap.data().balance || 0;
           await updateDoc(userRef, { balance: currentBalance + ticket.totalAmount });
           
           await addDoc(collection(db, 'transactions'), {
              userId: ticket.userId,
              type: 'refund',
              amount: ticket.totalAmount,
              description: `คืนเงินยกเลิกโพย ${ticket.ticketId}`,
              createdAt: new Date().toISOString()
           });
        }
        
        // Update ticket status
        await updateDoc(doc(db, 'tickets', ticket.id), { status: 'cancelled' });
        
        alert('ยกเลิกโพยสำเร็จ คืนเงินเข้ากระเป๋าเรียบร้อย');
      } catch (e) {
        console.error(e);
        alert('เกิดข้อผิดพลาดในการยกเลิกโพย');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#b90000] pb-20">
      <div className="max-w-4xl mx-auto pt-4 px-4">
        {/* Marquee Banner */}
        <div className="bg-white border-2 border-red-600 rounded p-2 mb-4 flex items-center gap-2">
          <span className="material-symbols-outlined text-black">campaign</span>
          <marquee className="text-black text-sm">รอกด เข้าแทงหวย ได้เลย ฝาก-ถอน ตลอด 24 ชั่วโมง!!!</marquee>
        </div>

        {/* Main Content Container */}
        <div className="bg-white rounded p-4 shadow-lg">
          {/* Header */}
          <div className="flex justify-between items-center border-b border-gray-200 pb-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-2xl font-black">receipt_long</span>
              <h1 className="text-xl font-black">โพยหวย</h1>
            </div>
            <button onClick={() => navigate('/')} className="border border-gray-300 px-3 py-1.5 rounded text-sm flex items-center gap-1 hover:bg-gray-50">
              <span className="material-symbols-outlined text-sm">chevron_left</span> กลับหน้าหลัก
            </button>
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            <button 
              onClick={() => setActiveTab('all')} 
              className={`py-3 rounded flex flex-col items-center justify-center border transition-colors ${activeTab === 'all' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-black border-red-600 hover:bg-red-50'}`}
            >
              <span className="material-symbols-outlined mb-1">wb_sunny</span>
              <span className="text-sm font-bold">โพยทั้งหมด</span>
            </button>
            <button 
              onClick={() => setActiveTab('pending')} 
              className={`py-3 rounded flex flex-col items-center justify-center border transition-colors ${activeTab === 'pending' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-black border-red-600 hover:bg-red-50'}`}
            >
              <span className="material-symbols-outlined mb-1">history</span>
              <span className="text-sm font-bold">โพยที่รอผล</span>
            </button>
            <button 
              onClick={() => setActiveTab('resulted')} 
              className={`py-3 rounded flex flex-col items-center justify-center border transition-colors ${activeTab === 'resulted' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-black border-red-600 hover:bg-red-50'}`}
            >
              <span className="material-symbols-outlined mb-1">check_box</span>
              <span className="text-sm font-bold">ผลออกแล้ว</span>
            </button>
            <button 
              onClick={() => setActiveTab('cancelled')} 
              className={`py-3 rounded flex border-2 border-dashed flex-col items-center justify-center transition-colors ${activeTab === 'cancelled' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-black border-red-600 hover:bg-red-50'}`}
            >
              <span className="material-symbols-outlined mb-1">cancel</span>
              <span className="text-sm font-bold">บิลยกเลิก/คืน</span>
            </button>
          </div>

          {/* Ticket List */}
          <div className="space-y-4">
            {filteredTickets.length > 0 ? (
              filteredTickets.map((ticket, index) => {
                const statusInfo = getStatusDisplay(ticket);
                return (
                  <div key={ticket.id} className={`border border-gray-200 rounded p-4 relative overflow-hidden ${ticket.status === 'cancelled' ? 'bg-gray-50' : 'bg-white'}`}>
                    {/* Cancellation Watermark */}
                    {ticket.status === 'cancelled' && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 select-none">
                        <div className="border-[6px] border-red-600/30 text-red-600/30 font-black text-5xl md:text-6xl px-12 py-4 transform -rotate-12 uppercase tracking-widest rounded-xl">
                          ✘ ยกเลิก
                        </div>
                      </div>
                    )}
                    
                    <div className="flex justify-between items-center mb-2 relative z-20">
                      <div className="font-bold text-lg">{ticket.lotteryType}</div>
                      <div className={`px-2 py-1 rounded text-xs font-bold ${statusInfo.color}`}>
                        {statusInfo.label}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 mb-2 relative z-20">บิล: {ticket.ticketId}</div>
                    <div className="font-bold relative z-20">
                      ยอดแทง: {ticket.status === 'cancelled' ? <span className="line-through text-gray-400 font-normal">฿{ticket.totalAmount?.toLocaleString()}</span> : <span>฿{ticket.totalAmount?.toLocaleString()}</span>}
                    </div>
                    
                    {/* Detail numbers and bill actions */}
                    <div className="mt-3 bg-gray-50 p-2.5 rounded border border-gray-200 relative z-20">
                      <div className="flex justify-between items-center pb-1.5 mb-2 border-b border-gray-200">
                        <span className="text-xs font-bold text-gray-500">ตัวเลขที่แทง ({ticket.bets?.length || 0} รายการ)</span>
                        <button 
                          onClick={() => copyTicketAsBillText(ticket)}
                          className="text-xs font-black text-[#107c10] hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">content_copy</span>
                          คัดลอกส่ง LINE
                        </button>
                      </div>

                      <div className="space-y-1.5 max-h-48 overflow-y-auto">
                        {Object.entries(
                          ((ticket.bets as any[]) || []).reduce((acc: any, bet: any) => {
                            if (!acc[bet.type]) acc[bet.type] = [];
                            acc[bet.type].push(bet);
                            return acc;
                          }, {} as Record<string, any[]>)
                        ).map(([type, typeBets]) => {
                          const typeTotal = (typeBets as any[]).reduce((sum, b) => sum + b.amount, 0);
                          return (
                            <div key={type} className="text-xs p-1.5 rounded bg-white border border-gray-200 text-gray-800">
                              <div className="flex justify-between items-center mb-1 font-bold border-b border-dashed border-gray-100 pb-0.5">
                                <span className="text-[10px] px-1.5 py-0.5 bg-[#0f172a] text-[#f5c518] rounded font-black">{type}</span>
                                <span className="text-[10px] text-gray-500 font-bold">รวม ฿{typeTotal}</span>
                              </div>
                              <div className="flex flex-wrap gap-x-2 gap-y-0.5 font-mono">
                                {(typeBets as any[]).map((b, bIdx) => (
                                  <span key={bIdx} className="font-bold text-gray-800">
                                    {b.number}<span className="text-red-500 font-black">={b.amount}</span>
                                    {bIdx < (typeBets as any[]).length - 1 && <span className="text-gray-300 ml-1.5">|</span>}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    
                    {/* Action Buttons */}
                    <div className="mt-3 flex gap-2 relative z-20">
                       <button 
                         onClick={() => {
                            if (ticket.ticketType === 'set') {
                               const type = ticket.lotteryType.includes('ฮานอย') ? 'hanoi' : (ticket.lotteryType.includes('ลาว') ? 'lao' : 'thai');
                               navigate(`/lottery/set/${type}`);
                            } else {
                               const type = ticket.lotteryType === 'หวยรัฐบาล' ? 'thai' : (ticket.lotteryType === 'หวยลาวพัฒนา' ? 'lao' : 'hanoi');
                               navigate(`/lottery/${type}`);
                            }
                         }}
                         className="flex-1 bg-gradient-to-r from-red-600 to-red-700 text-white font-bold py-2 rounded text-sm flex items-center justify-center gap-2 shadow-sm active:scale-95"
                       >
                         <span className="material-symbols-outlined text-sm">history</span>
                         แทงอีกรอบ
                       </button>
                       {statusInfo.canCancel && (
                         <button 
                           onClick={() => cancelTicket(ticket)}
                           className="flex-1 bg-gray-600 text-white font-bold py-2 rounded text-sm flex items-center justify-center gap-2 shadow-sm active:scale-95"
                         >
                           <span className="material-symbols-outlined text-sm">cancel</span>
                           ยกเลิกโพย
                         </button>
                       )}
                       {!statusInfo.canCancel && (
                         <button className="flex-1 border border-gray-200 text-gray-600 font-bold py-2 rounded text-sm flex items-center justify-center gap-2 hover:bg-gray-50 active:scale-95">
                           <span className="material-symbols-outlined text-sm">share</span>
                           แชร์โพย
                         </button>
                       )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="bg-red-400/80 border border-red-500 rounded p-3 text-center text-red-900 font-bold">
                ไม่มีข้อมูล
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-white mt-8 text-xs">
          <div className="flex items-center justify-center gap-1 mb-1">
            SECURE WEBSITE <span className="material-symbols-outlined text-sm">verified_user</span> GUARANTEE 100%
          </div>
          <div>Copyright © 2021-2022 All Rights Reserved. www.h-sod.com</div>
        </div>
      </div>
    </div>
  );
}
