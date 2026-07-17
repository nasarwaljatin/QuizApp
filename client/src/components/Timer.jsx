import { Clock, AlertTriangle } from 'lucide-react';

export default function Timer({ formattedTime, percentLeft }) {
  const isLow = percentLeft < 25;
  const isCritical = percentLeft < 10;

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-lg font-bold shadow-nm-inset-sm bg-slate-900 transition-all duration-500 ${
      isCritical
        ? 'text-red-400 animate-pulse'
        : isLow
        ? 'text-amber-400'
        : 'text-accent-500'
    }`}>
      {isCritical
        ? <AlertTriangle className="w-5 h-5" />
        : <Clock className="w-5 h-5" />
      }
      <span>{formattedTime}</span>
    </div>
  );
}
