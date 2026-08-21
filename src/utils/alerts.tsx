import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

let addToast: (msg: string, type: 'success' | 'error') => void = () => {};

export const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
  addToast(msg, type);
};

export const showConfirm = (msg: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);

    const cleanup = () => {
      setTimeout(() => {
        root.unmount();
        if (div.parentNode) div.parentNode.removeChild(div);
      }, 200);
    };

    const handleConfirm = (res: boolean) => {
      resolve(res);
      cleanup();
    };

    root.render(
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[9999] animate-fade-in p-4">
        <div className="bg-white rounded-xl shadow-xl border border-[#EDEDEB] p-6 max-w-sm w-full animate-fade-in">
          <h3 className="text-[#37352F] font-bold text-lg mb-2">Confirmación</h3>
          <p className="text-[#5A5A57] text-sm mb-6">{msg}</p>
          <div className="flex justify-end gap-3">
            <button onClick={() => handleConfirm(false)} className="px-4 py-2 text-sm text-[#5A5A57] hover:bg-[#F7F7F5] rounded-lg transition-colors border border-[#EDEDEB] font-medium cursor-pointer">Cancelar</button>
            <button onClick={() => handleConfirm(true)} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium cursor-pointer">Confirmar</button>
          </div>
        </div>
      </div>
    );
  });
};

export function ToastContainer() {
  const [toasts, setToasts] = useState<{id: number, msg: string, type: string}[]>([]);

  useEffect(() => {
    addToast = (msg, type) => {
      const id = Date.now();
      setToasts(prev => [...prev, { id, msg, type }]);
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 3500);
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium animate-fade-in pointer-events-auto transform transition-all duration-300 ${t.type === 'error' ? 'bg-red-500 text-white' : 'bg-[#37352F] text-white'}`}>
          {t.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4 text-[#2383E2]" />}
          {t.msg}
        </div>
      ))}
    </div>
  );
}
