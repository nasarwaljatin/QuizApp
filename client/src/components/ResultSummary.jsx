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
        <div className="w-20 h-20 rounded-full shadow-nm-inset-sm bg-slate-900 flex items-center justify-center">
          <Trophy className="w-9 h-9 text-amber-500" />
        </div>
      </div>

      {/* Grade label */}
      <p className={`text-sm font-semibold uppercase tracking-widest ${grade.color} mb-1`}>{grade.label}</p>

      {/* Quiz title */}
      <h2 className="text-2xl font-bold font-display text-slate-100 mb-2">{quizTitle}</h2>

      {/* Headline score */}
      <p className="text-sm text-slate-400 mb-6 font-medium">
        You scored <span className="font-bold text-accent-500">{attempt.score}</span> / <span className="font-bold text-slate-100">{attempt.totalQuestions}</span> marks <span className="text-xs text-slate-500 font-medium">({percentage}%)</span>
      </p>

      {/* Score circle inset well */}
      <div className="flex justify-center mb-6">
        <div className="w-36 h-36 rounded-full bg-slate-900 shadow-nm-inset-deep flex flex-col items-center justify-center select-none">
          <span className="text-2xl font-extrabold font-display text-slate-100">{attempt.score} / {attempt.totalQuestions}</span>
          <span className="text-xs text-slate-400 font-medium mt-1">({percentage}%)</span>
        </div>
      </div>

      {/* Stats row */}
      <div className={`grid gap-4 mb-4 ${hasNegativeMarking ? 'grid-cols-4' : 'grid-cols-3'}`}>
        <div className="bg-slate-900 rounded-2xl p-4 shadow-nm-inset flex flex-col items-center justify-center">
          <CheckCircle className="w-5 h-5 text-accent-secondary mb-1" />
          <p className="text-2xl font-extrabold text-accent-secondary leading-none mt-1">{correctCount}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-1.5">Correct</p>
        </div>
        <div className="bg-slate-900 rounded-2xl p-4 shadow-nm-inset flex flex-col items-center justify-center">
          <XCircle className="w-5 h-5 text-red-400 mb-1" />
          <p className="text-2xl font-extrabold text-red-400 leading-none mt-1">{wrongCount}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-1.5">Wrong</p>
        </div>
        {hasNegativeMarking && (
          <div className="bg-slate-900 rounded-2xl p-4 shadow-nm-inset flex flex-col items-center justify-center">
            <MinusCircle className="w-5 h-5 text-red-400 mb-1" />
            <p className="text-2xl font-extrabold text-red-400 leading-none mt-1">−{negDeducted}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-1.5">Penalty</p>
          </div>
        )}
        <div className="bg-slate-900 rounded-2xl p-4 shadow-nm-inset flex flex-col items-center justify-center">
          <Clock className="w-5 h-5 text-accent-500 mb-1" />
          <p className="text-base font-extrabold text-accent-500 leading-none mt-2">{timeStr}</p>
          <p className="text-[10px] text-slate-500 uppercase tracking-wider font-bold mt-1.5">Time Taken</p>
        </div>
      </div>

      {hasNegativeMarking && (
        <div className="flex items-center gap-2 justify-center bg-slate-900 shadow-nm-inset rounded-2xl px-4 py-3 text-red-400 text-sm mb-3">
          <MinusCircle className="w-4 h-4 flex-shrink-0" />
          <span>Negative marking applied: −{negDeducted} pts ({wrongCount} wrong × penalty)</span>
        </div>
      )}

      {attempt.autoSubmitted && (
        <div className="flex items-center gap-2 justify-center bg-slate-900 shadow-nm-inset rounded-2xl px-4 py-3 text-amber-400 text-sm">
          <Zap className="w-4 h-4 flex-shrink-0" />
          <span>Auto-submitted when time ran out</span>
        </div>
      )}
    </div>
  );
}
