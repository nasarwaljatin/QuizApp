import { Clock, AlertTriangle } from 'lucide-react';

export default function Timer({ formattedTime, percentLeft }) {
  const isLow = percentLeft < 25;
  const isCritical = percentLeft < 10;

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-lg font-bold transition-all duration-500 ${
      isCritical
        ? 'bg-red-500/20 text-red-400 border border-red-500/50 animate-pulse'
        : isLow
        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
        : 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
    }`}>
      {isCritical
        ? <AlertTriangle className="w-5 h-5" />
        : <Clock className="w-5 h-5" />
      }
      <span>{formattedTime}</span>
    </div>
  );
}
