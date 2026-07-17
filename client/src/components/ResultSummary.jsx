import { Trophy, CheckCircle, XCircle, Clock, Zap, MinusCircle } from 'lucide-react';

export default function ResultSummary({ attempt, quizTitle }) {
  const correctCount = attempt.answers?.filter(a => a.isCorrect).length ?? attempt.score;
  const wrongCount = attempt.answers?.filter(a => !a.isCorrect && a.selectedAnswer !== '').length ?? 0;
  const negDeducted = attempt.negativeMarksDeducted ?? 0;
  const hasNegativeMarking = negDeducted > 0;

  // percentage based on displayed score vs total questions
  const percentage = attempt.totalQuestions > 0
    ? Math.round((attempt.score / attempt.totalQuestions) * 100)
    : 0;

  const minutes = Math.floor(attempt.timeTakenSeconds / 60);
  const seconds = attempt.timeTakenSeconds % 60;
  const timeStr = `${minutes}m ${seconds}s`;

  let grade = { label: 'Excellent!', color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30' };
  if (percentage < 40) grade = { label: 'Needs Work', color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' };
  else if (percentage < 70) grade = { label: 'Good Effort', color: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30' };
  else if (percentage < 90) grade = { label: 'Great Job!', color: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30' };

  return (
    <div className="card text-center">
      {/* Trophy */}
      <div className="flex justify-center mb-4">
        <div className={`w-20 h-20 rounded-full ${grade.bg} border ${grade.border} flex items-center justify-center`}>
          <Trophy className={`w-10 h-10 ${grade.color}`} />
        </div>
      </div>

      {/* Grade label */}
      <p className={`text-sm font-semibold uppercase tracking-widest ${grade.color} mb-1`}>{grade.label}</p>

      {/* Quiz title */}
      <h2 className="text-2xl font-bold text-slate-100 mb-2">{quizTitle}</h2>

      {/* Headline score */}
      <p className="text-lg text-slate-300 mb-6">
        You scored <span className="font-bold text-primary-400">{attempt.score}</span> / <span className="font-bold text-slate-100">{attempt.totalQuestions}</span> marks <span className="text-sm text-slate-500 font-medium">({percentage}%)</span>
      </p>

      {/* Score circle */}
      <div className="flex justify-center mb-6">
        <div className="relative w-36 h-36">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" fill="none" stroke="#1e293b" strokeWidth="10" />
            <circle
              cx="60" cy="60" r="52" fill="none"
              stroke={percentage >= 70 ? '#10b981' : percentage >= 40 ? '#f59e0b' : '#ef4444'}
              strokeWidth="10"
              strokeDasharray={`${2 * Math.PI * 52}`}
              strokeDashoffset={`${2 * Math.PI * 52 * (1 - percentage / 100)}`}
              strokeLinecap="round"
              className="transition-all duration-1000"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-bold text-slate-100">{attempt.score} / {attempt.totalQuestions}</span>
            <span className="text-[11px] text-slate-400 font-medium mt-0.5">({percentage}%)</span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className={`grid gap-4 mb-4 ${hasNegativeMarking ? 'grid-cols-4' : 'grid-cols-3'}`}>
        <div className="bg-slate-800 rounded-xl p-3">
          <CheckCircle className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
          <p className="text-2xl font-bold text-emerald-400">{correctCount}</p>
          <p className="text-xs text-slate-500">Correct</p>
        </div>
        <div className="bg-slate-800 rounded-xl p-3">
          <XCircle className="w-5 h-5 text-red-400 mx-auto mb-1" />
          <p className="text-2xl font-bold text-red-400">{wrongCount}</p>
          <p className="text-xs text-slate-500">Wrong</p>
        </div>
        {hasNegativeMarking && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            <MinusCircle className="w-5 h-5 text-red-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-red-400">−{negDeducted}</p>
            <p className="text-xs text-slate-500">Penalty</p>
          </div>
        )}
        <div className="bg-slate-800 rounded-xl p-3">
          <Clock className="w-5 h-5 text-primary-400 mx-auto mb-1" />
          <p className="text-lg font-bold text-primary-400">{timeStr}</p>
          <p className="text-xs text-slate-500">Time Taken</p>
        </div>
      </div>

      {hasNegativeMarking && (
        <div className="flex items-center gap-2 justify-center bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2 text-red-300 text-sm mb-3">
          <MinusCircle className="w-4 h-4" />
          Negative marking applied: −{negDeducted} pts ({wrongCount} wrong × penalty)
        </div>
      )}

      {attempt.autoSubmitted && (
        <div className="flex items-center gap-2 justify-center bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2 text-amber-400 text-sm">
          <Zap className="w-4 h-4" />
          Auto-submitted when time ran out
        </div>
      )}
    </div>
  );
}
