import { Link, useNavigate } from 'react-router-dom';

export default function Contact() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-[var(--navy-deep)] p-3 flex items-center gap-3 sticky top-[57px] z-40 shadow-md">
        <button onClick={() => navigate(-1)} className="text-white flex items-center">
          <span className="material-symbols-outlined">arrow_back_ios</span>
        </button>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[var(--gold-vibrant)]">support_agent</span>
          <h1 className="text-white font-bold text-lg">ติดต่อสอบถาม</h1>
        </div>
      </div>

      <div className="p-4 flex flex-col items-center justify-center mt-10">
        <div className="bg-white p-8 rounded-2xl shadow-lg border border-[var(--grey-border)] text-center max-w-sm w-full">
          <div className="w-20 h-20 bg-[#00B900] rounded-full flex items-center justify-center mx-auto mb-4 shadow-md">
            {/* Line Icon Placeholder */}
            <span className="text-white font-black text-4xl">L</span>
          </div>
          
          <h2 className="text-2xl font-black text-[var(--navy-deep)] mb-2">LINE OFFICIAL</h2>
          <p className="text-gray-500 text-sm mb-6">สแกน QR Code หรือแอดไลน์ไอดีเพื่อติดต่อแอดมิน บริการตลอด 24 ชั่วโมง</p>
          
          <div className="bg-gray-100 p-4 rounded-xl inline-block mb-6 border-2 border-[#00B900]">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=https://line.me/ti/p/~@ak88support" alt="Line QR Code" className="w-48 h-48" />
          </div>
          
          <div className="bg-gray-50 border border-gray-200 rounded-lg py-3 px-4 flex justify-between items-center mb-6">
            <span className="text-gray-500 font-bold">LINE ID:</span>
            <span className="text-[var(--navy-deep)] font-black text-lg">@AK88SUPPORT</span>
          </div>

          <a href="https://line.me/ti/p/~@ak88support" target="_blank" rel="noreferrer" className="w-full bg-[#00B900] text-white font-bold py-3 rounded-lg shadow-md hover:bg-[#009900] transition flex items-center justify-center gap-2">
            <span className="material-symbols-outlined">chat</span>
            คลิกเพื่อแอดไลน์
          </a>
        </div>
      </div>
    </div>
  );
}
