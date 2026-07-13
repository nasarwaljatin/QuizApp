import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Trophy, Clock, BookOpen, TrendingUp, ArrowLeft, ChevronRight, Zap } from 'lucide-react';

export default function StudentDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/attempts/my')
      .then(res => setAttempts(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalAttempts = attempts.length;
  const avgScore = totalAttempts > 0
    ? Math.round(attempts.reduce((s, a) => s + (a.score / a.totalQuestions) * 100, 0) / totalAttempts)
    : 0;
  const bestScore = totalAttempts > 0
    ? Math.max(...attempts.map(a => Math.round((a.score / a.totalQuestions) * 100)))
    : 0;

  // Chart data — last 10 attempts reversed (oldest first)
  const chartData = [...attempts].reverse().slice(-10).map((a, i) => ({
    name: `#${i + 1}`,
    score: Math.round((a.score / a.totalQuestions) * 100),
    quiz: a.quizId?.title || 'Quiz'
  }));

  return (
    <div className="min-h-screen bg-slate-950 pb-12">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="text-slate-400 hover:text-slate-200">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <span className="text-xl font-bold text-slate-100">My Dashboard</span>
          </div>
          <button onClick={() => navigate('/')} className="btn-secondary py-2 px-4 text-sm flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Browse Quizzes
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-8 space-y-8">
        {/* Welcome */}
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Welcome back, {user?.name?.split(' ')[0]}!</h1>
          <p className="text-slate-400 mt-1">Here's an overview of your quiz performance.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Attempts', value: totalAttempts, icon: BookOpen, color: 'text-primary-400', bg: 'bg-primary-500/10' },
            { label: 'Avg Score', value: `${avgScore}%`, icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
            { label: 'Best Score', value: `${bestScore}%`, icon: Trophy, color: 'text-amber-400', bg: 'bg-amber-500/10' },
            { label: 'Auto-Submitted', value: attempts.filter(a => a.autoSubmitted).length, icon: Zap, color: 'text-red-400', bg: 'bg-red-500/10' },
          ].map(stat => (
            <div key={stat.label} className="card">
              <div className={`inline-flex p-2 rounded-xl ${stat.bg} mb-3`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Score trend chart */}
        {chartData.length > 1 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-slate-100 mb-6">Score Trend (last 10 attempts)</h2>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <XAxis dataKey="name" stroke="#475569" tick={{ fontSize: 12, fill: '#94a3b8' }} />
                <YAxis domain={[0, 100]} stroke="#475569" tick={{ fontSize: 12, fill: '#94a3b8' }} unit="%" />
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: '#f1f5f9' }}
                  formatter={(val, _, props) => [`${val}%`, props.payload.quiz]}
                />
                <Line type="monotone" dataKey="score" stroke="#0ea5e9" strokeWidth={2} dot={{ fill: '#0ea5e9', r: 4 }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Attempt history */}
        <div>
          <h2 className="text-xl font-bold text-slate-100 mb-4">Attempt History</h2>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <div key={i} className="card animate-pulse h-16" />)}
            </div>
          ) : attempts.length === 0 ? (
            <div className="card text-center py-12">
              <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No quiz attempts yet.</p>
              <button onClick={() => navigate('/')} className="btn-primary mt-4">Take your first quiz</button>
            </div>
          ) : (
            <div className="space-y-3">
              {attempts.map(attempt => {
                const pct = Math.round((attempt.score / attempt.totalQuestions) * 100);
                const date = new Date(attempt.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
                const mins = Math.floor(attempt.timeTakenSeconds / 60);
                const secs = attempt.timeTakenSeconds % 60;
                const color = pct >= 70 ? 'text-emerald-400' : pct >= 40 ? 'text-amber-400' : 'text-red-400';

                return (
                  <div
                    key={attempt._id}
                    onClick={() => navigate(`/result/${attempt._id}`)}
                    className="card flex items-center gap-4 cursor-pointer hover:border-primary-500/40 transition-all duration-200 hover:-translate-y-0.5"
                  >
                    {/* Score circle */}
                    <div className={`w-14 h-14 rounded-full border-2 flex flex-col items-center justify-center flex-shrink-0 font-bold ${
                      pct >= 70 ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                      : pct >= 40 ? 'border-amber-500/50 bg-amber-500/10 text-amber-400'
                      : 'border-red-500/50 bg-red-500/10 text-red-400'
                    }`}>
                      <span className="text-[11px] leading-tight">{attempt.score}/{attempt.totalQuestions}</span>
                      <span className="text-[9px] font-normal opacity-85">({pct}%)</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-100 truncate">{attempt.quizId?.title || 'Quiz'}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                        <span>{date}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{mins}m {secs}s</span>
                        <span>{attempt.score}/{attempt.totalQuestions} correct</span>
                        {attempt.autoSubmitted && <span className="text-amber-500 flex items-center gap-1"><Zap className="w-3 h-3" />Auto</span>}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 flex-shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
