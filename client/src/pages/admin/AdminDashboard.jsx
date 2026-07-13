import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, BookOpen, TrendingUp, Zap, ShieldCheck, LogOut, PlusCircle, ChevronRight, AlertTriangle, Folder } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import ThemeToggle from '../../components/ThemeToggle';

export default function AdminDashboard() {
  const { logout } = useAuth();
  const { isDark } = useTheme();

  const chartStroke = isDark ? '#475569' : '#cbd5e1';
  const chartTick = isDark ? '#94a3b8' : '#475569';
  const tooltipBg = isDark ? '#1e293b' : '#ffffff';
  const tooltipBorder = isDark ? '#334155' : '#cbd5e1';
  const tooltipColor = isDark ? '#f1f5f9' : '#0f172a';
  const navigate = useNavigate();
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/attempts/admin/overview')
      .then(res => setOverview(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = () => { logout(); navigate('/admin/login'); };

  const chartData = overview?.perQuizStats?.slice(0, 8).map(q => ({
    name: q.title.length > 16 ? q.title.slice(0, 16) + '…' : q.title,
    attempts: q.attempts,
    avgScore: parseFloat(q.avgScore)
  })) || [];

  return (
    <div className="min-h-screen bg-slate-950 pb-12">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-accent-400" />
            <span className="text-xl font-bold text-slate-100">Admin Dashboard</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/admin/folders" className="btn-secondary py-2 px-4 text-sm flex items-center gap-2">
              <Folder className="w-4 h-4" />
              Manage Folders
            </Link>
            <Link to="/admin/quizzes" className="btn-secondary py-2 px-4 text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Manage Quizzes
            </Link>
            <ThemeToggle />
            <button onClick={handleLogout} className="text-slate-400 hover:text-red-400 p-2 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 pt-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-100">Analytics Overview</h1>
          <p className="text-slate-400 mt-1">Platform-wide quiz performance metrics.</p>
        </div>

        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="card h-24 animate-pulse" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Attempts', value: overview?.totalAttempts || 0, icon: TrendingUp, color: 'text-primary-400', bg: 'bg-primary-500/10' },
              { label: 'Unique Students', value: overview?.uniqueStudents || 0, icon: Users, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
              { label: 'Platform Avg Score', value: `${overview?.avgScore || 0}%`, icon: BookOpen, color: 'text-amber-400', bg: 'bg-amber-500/10' },
              { label: 'Quizzes Active', value: overview?.perQuizStats?.length || 0, icon: Zap, color: 'text-accent-400', bg: 'bg-accent-500/10' },
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
        )}

        {/* Bar chart */}
        {chartData.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-slate-100 mb-6">Attempts per Quiz</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barGap={4}>
                <XAxis dataKey="name" stroke={chartStroke} tick={{ fontSize: 11, fill: chartTick }} />
                <YAxis stroke={chartStroke} tick={{ fontSize: 11, fill: chartTick }} />
                <Tooltip
                  contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '12px', color: tooltipColor }}
                />
                <Bar dataKey="attempts" fill="#0ea5e9" radius={[6, 6, 0, 0]} name="Attempts" />
                <Bar dataKey="avgScore" fill="#8b5cf6" radius={[6, 6, 0, 0]} name="Avg Score %" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Per-quiz table */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-100">Quiz Performance</h2>
            <Link to="/admin/quizzes" className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-1">
              <PlusCircle className="w-4 h-4" />
              Create Quiz
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="card h-14 animate-pulse" />)}</div>
          ) : overview?.perQuizStats?.length === 0 ? (
            <div className="card text-center py-12">
              <AlertTriangle className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No quiz attempts yet. Create and publish a quiz first.</p>
            </div>
          ) : (
            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/50">
                      <th className="text-left px-6 py-4 text-slate-400 font-medium">Quiz</th>
                      <th className="text-center px-4 py-4 text-slate-400 font-medium">Attempts</th>
                      <th className="text-center px-4 py-4 text-slate-400 font-medium">Avg Score</th>
                      <th className="px-4 py-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {overview?.perQuizStats?.map((quiz, i) => (
                      <tr key={quiz.quizId} className={`border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-900/20'}`}>
                        <td className="px-6 py-4 text-slate-200 font-medium">{quiz.title}</td>
                        <td className="px-4 py-4 text-center text-primary-400 font-bold">{quiz.attempts}</td>
                        <td className="px-4 py-4 text-center">
                          <span className={`font-bold ${parseFloat(quiz.avgScore) >= 70 ? 'text-emerald-400' : parseFloat(quiz.avgScore) >= 40 ? 'text-amber-400' : 'text-red-400'}`}>
                            {quiz.avgScore}%
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <button
                            onClick={() => navigate(`/admin/quizzes?quiz=${quiz.quizId}`)}
                            className="text-slate-500 hover:text-primary-400 transition-colors"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
