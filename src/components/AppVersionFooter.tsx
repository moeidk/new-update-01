/**
 * Small footer showing which build of the app is running (version · commit · release date).
 */
import React from 'react';
import { UpdateDetectorService } from '../services/updateDetector';
import { gregorianToJalali } from '../utils/jalali';

export const AppVersionFooter: React.FC<{ className?: string }> = ({ className = '' }) => {
  const v = UpdateDetectorService.current;
  const d = new Date(v.buildTime);
  const j = isNaN(d.getTime()) ? null : gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  const date = j ? `${j.jy}/${String(j.jm).padStart(2, '0')}/${String(j.jd).padStart(2, '0')}` : '';
  const isStaging = v.environment === 'staging';

  return (
    <footer
      className={`flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] text-[#5D6B8F] select-text ${className}`}
      dir="rtl"
    >
      <span className="font-bold">KeepPass</span>
      <span className="font-mono tabular-nums" dir="ltr">v{v.version}</span>
      <span aria-hidden>·</span>
      <span className="font-mono tabular-nums" dir="ltr" title="شناسه نسخه (کامیت)">{v.gitCommit}</span>
      {date && (
        <>
          <span aria-hidden>·</span>
          <span className="tabular-nums">انتشار {date}</span>
        </>
      )}
      {isStaging && (
        <span className="px-1.5 py-px rounded-full bg-amber-500/15 text-amber-300 font-bold">نسخه آزمایشی</span>
      )}
    </footer>
  );
};
