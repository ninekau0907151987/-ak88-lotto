import React from 'react';
import { motion } from 'motion/react';

interface ActionConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: React.ReactNode;
  icon?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmTone?: 'red' | 'green' | 'blue' | 'gold';
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ActionConfirmModal({
  isOpen,
  title,
  description,
  icon = 'help',
  confirmLabel = 'ยืนยัน',
  cancelLabel = 'ยกเลิก',
  confirmTone = 'red',
  onConfirm,
  onCancel,
}: ActionConfirmModalProps) {
  if (!isOpen) return null;

  const toneMap = {
    red: {
      bg: 'bg-red-50',
      border: 'border-red-100',
      text: 'text-red-600',
      btn: 'bg-[#cc0000] hover:bg-red-700 text-white',
      topBorder: 'border-[#cc0000]',
    },
    green: {
      bg: 'bg-green-50',
      border: 'border-green-100',
      text: 'text-green-600',
      btn: 'bg-[#107c10] hover:bg-green-700 text-white',
      topBorder: 'border-[#107c10]',
    },
    blue: {
      bg: 'bg-blue-50',
      border: 'border-blue-100',
      text: 'text-blue-600',
      btn: 'bg-blue-600 hover:bg-blue-700 text-white',
      topBorder: 'border-blue-600',
    },
    gold: {
      bg: 'bg-amber-50',
      border: 'border-amber-100',
      text: 'text-amber-600',
      btn: 'bg-amber-500 hover:bg-amber-600 text-black',
      topBorder: 'border-amber-500',
    },
  }[confirmTone];

  return (
    <div className="fixed inset-0 bg-black/70 z-[260] flex items-center justify-center p-4 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 15 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 15 }}
        className={`bg-white rounded-2xl shadow-2xl w-full max-w-[340px] overflow-hidden border-t-8 ${toneMap.topBorder}`}
      >
        <div className="p-6 text-center">
          <div className={`w-16 h-16 ${toneMap.bg} rounded-full flex items-center justify-center mx-auto mb-4 border-2 ${toneMap.border}`}>
            <span className={`material-symbols-outlined text-4xl ${toneMap.text} animate-pulse`}>
              {icon}
            </span>
          </div>
          <h3 className="text-xl font-black text-gray-800 mb-2">{title}</h3>
          <div className="text-sm text-gray-500 font-bold leading-relaxed">{description}</div>
        </div>

        <div className="flex border-t border-gray-100">
          <button
            onClick={onCancel}
            className="flex-1 py-3.5 text-gray-500 font-bold text-sm bg-gray-50 hover:bg-gray-100 transition-colors border-r border-gray-100 outline-none"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-[1.5] py-3.5 ${toneMap.btn} font-black text-sm transition-all active:scale-[0.98] outline-none shadow-inner`}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
