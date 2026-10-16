/**
 * Wi-Fi join QR code, generated locally in the browser (never sent anywhere).
 * Only shown for network types with a widely supported QR format (open / WPA / WEP personal).
 */
import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import qrcode from 'qrcode-generator';
import { X, ShieldAlert } from 'lucide-react';

// Encode as UTF-8 so non-Latin network names (e.g. Persian SSIDs) work.
qrcode.stringToBytes = (s: string) => Array.from(new TextEncoder().encode(s));

export const WifiQrDialog: React.FC<{ title: string; payload: string; onClose: () => void }> = ({ title, payload, onClose }) => {
  const src = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(payload, 'Byte');
    qr.make();
    const svg = qr.createSvgTag({ cellSize: 6, margin: 4, scalable: true });
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }, [payload]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" onClick={onClose} dir="rtl">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`QR اتصال به ${title}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xs p-5 rounded-2xl bg-[#121A2C] border border-[#1F2B47] shadow-2xl space-y-3 text-center"
        style={{ backgroundColor: 'var(--ui-surface)', borderColor: 'var(--ui-border)' }}
      >
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-white">اتصال به «{title}»</h4>
          <button type="button" autoFocus onClick={onClose} className="p-1.5 rounded-lg text-[#94A2C2] hover:text-white cursor-pointer" aria-label="بستن">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="bg-white rounded-xl p-2">
          <img src={src} alt="کد QR اتصال به شبکه وای‌فای" className="w-full h-auto" />
        </div>
        <p className="text-[11px] text-amber-300 flex items-start gap-1.5 text-right">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          این کد شامل رمز شبکه است؛ فقط به افراد مورد اعتماد نشان دهید.
        </p>
      </div>
    </div>,
    document.body
  );
};
