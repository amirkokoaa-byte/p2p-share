import React, { useEffect, useState } from 'react';
import { Calendar, Clock } from 'lucide-react';
import { FluentCard } from './FluentCard';

/**
 * مكون الساعة الحية المستقل (LiveClock)
 * يعرض اليوم، التاريخ، والوقت الفعلي بنظام 12 ساعة (AM/PM) مع التحديث كل ثانية
 * معزول في مكون خاص لمنع إعادة تصيير (Re-render) محرك WebRTC أثناء تحديث الثواني
 */
export const LiveClock: React.FC = () => {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const dayName = now.toLocaleDateString('ar-SA', { weekday: 'long' });
  const formattedDate = now.toLocaleDateString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const formattedTime12h = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return (
    <FluentCard className="px-3.5 py-2 bg-slate-950/85 border border-slate-700/80">
      <div className="flex items-center gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-sky-300 font-semibold">
          <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span>{dayName}</span>
          <span aria-hidden="true">·</span>
          <span dir="ltr" className="font-mono tabular-nums text-slate-200">
            {formattedDate}
          </span>
        </div>
        <span className="text-slate-600" aria-hidden="true">
          |
        </span>
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span
            dir="ltr"
            className="font-mono font-bold text-xs sm:text-sm text-white tabular-nums tracking-wider"
          >
            {formattedTime12h}
          </span>
        </div>
      </div>
    </FluentCard>
  );
};
