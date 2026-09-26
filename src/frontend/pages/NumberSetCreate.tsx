import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface NumberItem {
  id: string;
  type: string;
  number: string;
}

interface NumberSet {
  id: string;
  name: string;
  createdAt: string;
  items: NumberItem[];
}

export default function NumberSetCreate() {
  const navigate = useNavigate();
  const [view, setView] = useState<'list' | 'create'>('list');
  const [sets, setSets] = useState<NumberSet[]>(() => {
    const saved = localStorage.getItem('numberSets');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return [
      { id: '1', name: 'เลขเด็ดอาจารย์อู๋', createdAt: '15-Apr-2026 04:00', items: [{id:'i1', type: '2 ตัวบน', number: '25'}, {id:'i2', type: '2 ตัวล่าง', number: '25'}] }
    ];
  });

  const updateSets = (newSets: NumberSet[]) => {
    setSets(newSets);
    localStorage.setItem('numberSets', JSON.stringify(newSets));
  };

  const [setName, setSetName] = useState('');
  const [currentType, setCurrentType] = useState('2 ตัวบน');
  const [currentNumbers, setCurrentNumbers] = useState('');
  const [items, setItems] = useState<NumberItem[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleAddNumbers = () => {
    if (!currentNumbers.trim()) return;
    
    const newNumbers = currentNumbers.split(',').map(n => n.trim()).filter(n => n);
    const newItems = newNumbers.map(n => ({
      id: Math.random().toString(36).substring(7),
      type: currentType,
      number: n
    }));

    setItems([...items, ...newItems]);
    setCurrentNumbers('');
    
    // Show success notification
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleDeleteItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const handleSaveSet = () => {
    if (!setName.trim() || items.length === 0) {
      alert('กรุณากรอกชื่อเลขชุดและเพิ่มตัวเลข');
      return;
    }
    
    const newSet: NumberSet = {
      id: Math.random().toString(36).substring(7),
      name: setName,
      createdAt: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ''),
      items: items
    };
    
    updateSets([newSet, ...sets]);
    setView('list');
    setSetName('');
    setItems([]);
  };

  const handleClearAll = () => {
    setItems([]);
  };

  return (
    <div className="min-h-screen bg-[#b90000] font-sans pb-20">
      {/* Top Banner */}
      <div className="bg-[#333] p-2 sticky top-0 z-50">
        <div className="bg-white border-2 border-[#ff4757] rounded p-1 flex items-center">
          <div className="bg-[#1e3799] text-white px-2 py-1 text-xs font-bold mr-2">ฝาก-ถอน ตลอด 24 ชั่วโมง!!!</div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto mt-4 px-2">
        <div className="bg-white rounded shadow-lg overflow-hidden">
          {/* Header */}
          <div className="flex justify-between items-center p-3 border-b">
            <div className="flex items-center gap-2">
              <div className="bg-[#1e3799] text-white text-[10px] font-mono p-1 leading-none rounded-sm text-center">
                <div>01</div>
                <div>00</div>
              </div>
              <h1 className="text-[#1e3799] font-bold text-xl">จัดการเลขชุด</h1>
            </div>
            <button onClick={() => view === 'create' ? setView('list') : navigate(-1)} className="border border-gray-300 rounded px-3 py-1 flex items-center gap-1 text-sm hover:bg-gray-50">
              <span className="material-symbols-outlined text-[14px]">chevron_left</span>
              กลับ
            </button>
          </div>

          {view === 'list' ? (
            <div className="p-4">
              <button 
                onClick={() => setView('create')}
                className="bg-[#009432] text-white px-4 py-2 rounded font-bold flex items-center gap-1 mb-4 hover:bg-[#007a29]"
              >
                <span className="material-symbols-outlined text-sm">add</span>
                สร้างเลขชุด
              </button>

              <div className="space-y-2">
                {sets.map(set => (
                  <div key={set.id} className="bg-[#4b4b4b] text-white p-3 rounded flex justify-between items-center group">
                    <div>
                      <div className="font-bold">{set.name}</div>
                      <div className="text-xs text-gray-400">{set.createdAt}</div>
                    </div>
                    <button 
                      onClick={() => {
                        if (confirm('คุณต้องการลบเลขชุดนี้ใช่หรือไม่?')) {
                          updateSets(sets.filter(s => s.id !== set.id));
                        }
                      }}
                      className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <span className="material-symbols-outlined max-sm:opacity-100">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4">
              {/* Success Notification */}
              {showSuccess && (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined">check_circle</span>
                  <span className="font-bold">เพิ่มชุดตัวเลขสำเร็จ</span>
                </div>
              )}

              {/* Set Name */}
              <div className="mb-6">
                <div className="flex items-center gap-2 font-bold mb-2">
                  <span className="material-symbols-outlined text-sm">contact_page</span>
                  ชื่อเลขชุด
                </div>
                <input 
                  type="text" 
                  value={setName}
                  onChange={(e) => setSetName(e.target.value)}
                  placeholder="ชื่อเลขชุด"
                  className="w-full bg-[#e0e0e0] border border-gray-300 rounded p-2 focus:outline-none focus:border-blue-500"
                />
              </div>

              {/* Add Numbers */}
              <div>
                <div className="flex items-center gap-2 font-bold mb-2">
                  <span className="material-symbols-outlined text-sm">edit_square</span>
                  สร้างชุดตัวเลข
                </div>
                
                {/* Items List */}
                {items.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {items.map((item, index) => (
                      <div key={item.id} className="flex items-center gap-2">
                        <div className="w-8 text-center font-bold text-sm">{index + 1}.</div>
                        <div className="w-48 bg-[#6c757d] text-white p-2 rounded text-sm">{item.type}</div>
                        <div className="flex-1 bg-[#e0e0e0] p-2 rounded text-sm">{item.number}</div>
                        <button 
                          onClick={() => handleDeleteItem(item.id)}
                          className="bg-[#c0392b] text-white p-2 rounded hover:bg-[#a93226] w-12 flex justify-center"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Input Row */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 text-center font-bold text-sm">{items.length > 0 ? 'เลขชุด' : ''}</div>
                  <select 
                    value={currentType}
                    onChange={(e) => setCurrentType(e.target.value)}
                    className="w-48 bg-[#e0e0e0] border border-gray-300 rounded p-2 text-sm focus:outline-none"
                  >
                    <option value="2 ตัวบน">2 ตัวบน</option>
                    <option value="2 ตัวล่าง">2 ตัวล่าง</option>
                    <option value="3 ตัวบน">3 ตัวบน</option>
                    <option value="3 ตัวโต๊ด">3 ตัวโต๊ด</option>
                    <option value="วิ่งบน">วิ่งบน</option>
                    <option value="วิ่งล่าง">วิ่งล่าง</option>
                  </select>
                  <input 
                    type="text" 
                    value={currentNumbers}
                    onChange={(e) => setCurrentNumbers(e.target.value)}
                    placeholder="เลข เช่น 11,22,33,44,55"
                    className="flex-1 bg-[#e0e0e0] border border-gray-300 rounded p-2 text-sm focus:outline-none"
                  />
                </div>

                {/* Action Buttons */}
                <div className="space-y-2">
                  <button 
                    onClick={handleAddNumbers}
                    className="w-full bg-[#007bff] text-white font-bold py-2 rounded flex items-center justify-center gap-1 hover:bg-[#0069d9]"
                  >
                    <span className="material-symbols-outlined text-sm">add</span>
                    เพิ่มชุดตัวเลข
                  </button>
                  
                  <div className="flex gap-2">
                    <button 
                      onClick={handleClearAll}
                      className="w-1/2 bg-[#4b4b4b] text-white font-bold py-2 rounded flex items-center justify-center gap-1 hover:bg-[#3d3d3d]"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                      ลบเลขชุดทิ้ง
                    </button>
                    <button 
                      onClick={handleSaveSet}
                      className="w-1/2 bg-[#009432] text-white font-bold py-2 rounded flex items-center justify-center gap-1 hover:bg-[#007a29]"
                    >
                      <span className="material-symbols-outlined text-sm">save</span>
                      บันทึกข้อมูล
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Footer */}
      <div className="text-center text-white text-[10px] mt-8 pb-4 opacity-80">
        <div className="flex items-center justify-center gap-1 mb-1 font-bold">
          SECURE WEBSITE <span className="material-symbols-outlined text-xs">workspace_premium</span> GUARANTEE 100%
        </div>
        <div className="font-medium">Copyright © 2021-2022 All Rights Reserved. www.h-sod.com</div>
      </div>
    </div>
  );
}
