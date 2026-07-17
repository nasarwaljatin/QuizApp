import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell
} from 'recharts';
import {
  Trophy, Clock, BookOpen, TrendingUp, ArrowLeft, ChevronRight, Zap, Medal,
  BarChart3, Target, AlertTriangle, Timer
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';

export default function StudentDashboard() {
  const { user } = useAuth();
  const { isDark } = useTheme();

  const chartStroke = isDark ? '#475569' : '#cbd5e1';
  const chartTick = isDark ? '#94a3b8' : '#475569';
  const tooltipBg = isDark ? '#1e293b' : '#ffffff';
  const tooltipBorder = isDark ? '#334155' : '#cbd5e1';
  const tooltipColor = isDark ? '#f1f5f9' : '#0f172a';

  const navigate = useNavigate();
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Tab state
  const [activeTab, setActiveTab] = useState('overview');

  // Leaderboard tab state
  const [selectedQuizId, setSelectedQuizId] = useState('');
  const [leaderboard, setLeaderboard] = useState(null);
  const [lbLoading, setLbLoading] = useState(false);

  // Analytics tab state
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    api.get('/attempts/my')
      .then(res => setAttempts(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Fetch leaderboard when a quiz is selected
  useEffect(() => {
    if (!selectedQuizId) return;
    setLbLoading(true);
    api.get(`/quizzes/${selectedQuizId}/leaderboard?limit=100`)
      .then(res => setLeaderboard(res.data))
      .catch(console.error)
      .finally(() => setLbLoading(false));
  }, [selectedQuizId]);

  // Fetch analytics when tab is switched
  useEffect(() => {
    if (activeTab === 'analytics' && !analytics) {
      setAnalyticsLoading(true);
      api.get('/attempts/my/analytics')
        .then(res => setAnalytics(res.data))
        .catch(console.error)
        .finally(() => setAnalyticsLoading(false));
    }
  }, [activeTab]);

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

  // Unique quizzes for leaderboard dropdown
  const attemptedQuizzes = [];
  const seenQuizIds = new Set();
  attempts.forEach(a => {
    const qid = a.quizId?._id;
    if (qid && !seenQuizIds.has(qid)) {
      seenQuizIds.add(qid);
      attemptedQuizzes.push({ _id: qid, title: a.quizId?.title || 'Quiz' });
    }
  });

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = Math.round(seconds % 60);
    return `${m}m ${s}s`;
  };

  const TABS = [
    { key: 'overview', label: 'Overview', icon: TrendingUp },
    { key: 'leaderboards', label: 'Leaderboards', icon: Medal },
    { key: 'analytics', label: 'Analytics', icon: BarChart3 },
  ];

  const BAR_COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#f97316'];

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
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button onClick={() => navigate('/')} className="btn-secondary py-2 px-4 text-sm flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              Browse Quizzes
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-8 space-y-8">
        {/* Welcome */}
        <div>
          <h1 className="text-3xl font-extrabold font-display text-slate-100">Welcome back, {user?.name?.split(' ')[0]}!</h1>
          <p className="text-slate-400 mt-1">Here's an overview of your quiz performance.</p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-slate-800 shadow-nm-inset-sm rounded-2xl p-1">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab.key
                  ? 'bg-slate-900 shadow-nm-extruded-sm text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ═══════════ OVERVIEW TAB ═══════════ */}
        {activeTab === 'overview' && (
          <>
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
                    <XAxis dataKey="name" stroke={chartStroke} tick={{ fontSize: 12, fill: chartTick }} />
                    <YAxis domain={[0, 100]} stroke={chartStroke} tick={{ fontSize: 12, fill: chartTick }} unit="%" />
                    <Tooltip
                      contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '12px', color: tooltipColor }}
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

                    return (
                      <div
                        key={attempt._id}
                        onClick={() => navigate(`/result/${attempt._id}`)}
                        className="card flex items-center gap-4 cursor-pointer hover:border-primary-500/40 transition-all duration-200 hover:-translate-y-0.5"
                      >
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
          </>
        )}

        {/* ═══════════ LEADERBOARDS TAB ═══════════ */}
        {activeTab === 'leaderboards' && (
          <>
            {attemptedQuizzes.length === 0 ? (
              <div className="card text-center py-12">
                <Medal className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">No quizzes attempted yet. Take a quiz to see your ranking!</p>
                <button onClick={() => navigate('/')} className="btn-primary mt-4">Browse Quizzes</button>
              </div>
            ) : (
              <>
                {/* Quiz Selector */}
                <div className="card">
                  <label className="block text-sm font-medium text-slate-300 mb-2">Select a Quiz</label>
                  <select
                    value={selectedQuizId}
                    onChange={e => setSelectedQuizId(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/50"
                  >
                    <option value="">Choose a quiz...</option>
                    {attemptedQuizzes.map(q => (
                      <option key={q._id} value={q._id}>{q.title}</option>
                    ))}
                  </select>
                </div>

                {/* My Standing */}
                {leaderboard && leaderboard.myRank && (
                  <div className="card bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-orange-500/10 border-amber-500/20">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                        <Trophy className="w-7 h-7 text-amber-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-lg font-bold text-slate-100">
                          Rank <span className="text-amber-400">#{leaderboard.myRank}</span> out of {leaderboard.totalStudents}
                        </p>
                        <p className="text-sm text-slate-400 mt-0.5">
                          Top <span className="font-semibold text-amber-400">{Math.max(1, Math.ceil((leaderboard.myRank / leaderboard.totalStudents) * 100))}%</span>
                          {' '}· Score: {leaderboard.myScore}/{leaderboard.leaderboard?.[0]?.totalQuestions}
                          {' '}· Time: {formatTime(leaderboard.myTimeTaken)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Leaderboard Table */}
                {lbLoading ? (
                  <div className="card text-center py-12">
                    <div className="w-8 h-8 border-3 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto" />
                    <p className="text-slate-400 text-sm mt-3">Loading leaderboard...</p>
                  </div>
                ) : leaderboard && leaderboard.leaderboard?.length > 0 ? (
                  <div className="card">
                    <div className="flex items-center gap-3 mb-4">
                      <Medal className="w-5 h-5 text-amber-400" />
                      <h2 className="text-lg font-semibold text-slate-100">{leaderboard.quizTitle}</h2>
                      <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{leaderboard.totalStudents} students</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-slate-500 border-b border-slate-700/50">
                            <th className="text-left py-2 px-2 font-medium">#</th>
                            <th className="text-left py-2 px-2 font-medium">Name</th>
                            <th className="text-center py-2 px-2 font-medium">Score</th>
                            <th className="text-center py-2 px-2 font-medium">%</th>
                            <th className="text-center py-2 px-2 font-medium">Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {leaderboard.leaderboard.map(entry => {
                            const isMe = entry.studentId?.toString() === user?._id || entry.studentName === user?.name;
                            return (
                              <tr
                                key={entry.studentId}
                                className={`border-b border-slate-800/50 transition-colors ${isMe ? 'bg-primary-500/10 border-primary-500/20' : 'hover:bg-slate-800/30'}`}
                              >
                                <td className="py-2.5 px-2">
                                  <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                                    entry.rank === 1 ? 'bg-amber-500/20 text-amber-400' :
                                    entry.rank === 2 ? 'bg-slate-400/20 text-slate-300' :
                                    entry.rank === 3 ? 'bg-orange-500/20 text-orange-400' :
                                    'bg-slate-800 text-slate-400'
                                  }`}>
                                    {entry.rank}
                                  </span>
                                </td>
                                <td className={`py-2.5 px-2 font-medium ${isMe ? 'text-primary-400' : 'text-slate-200'}`}>
                                  {entry.studentName} {isMe && <span className="text-xs text-primary-500 ml-1">(You)</span>}
                                </td>
                                <td className="py-2.5 px-2 text-center text-slate-300">{entry.score}/{entry.totalQuestions}</td>
                                <td className={`py-2.5 px-2 text-center font-semibold ${
                                  entry.percentage >= 70 ? 'text-emerald-400' : entry.percentage >= 40 ? 'text-amber-400' : 'text-red-400'
                                }`}>{entry.percentage}%</td>
                                <td className="py-2.5 px-2 text-center text-slate-400">
                                  <span className="flex items-center justify-center gap-1"><Clock className="w-3 h-3" />{formatTime(entry.timeTakenSeconds)}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : selectedQuizId && !lbLoading ? (
                  <div className="card text-center py-8">
                    <p className="text-slate-400">No leaderboard data available for this quiz.</p>
                  </div>
                ) : null}
              </>
            )}
          </>
        )}

        {/* ═══════════ ANALYTICS TAB ═══════════ */}
        {activeTab === 'analytics' && (
          <>
            {analyticsLoading ? (
              <div className="card text-center py-16">
                <div className="w-10 h-10 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto" />
                <p className="text-slate-400 text-sm mt-4">Computing your analytics...</p>
              </div>
            ) : analytics && analytics.totalAttempts > 0 ? (
              <>
                {/* Accuracy Trend */}
                <div className="card">
                  <h2 className="text-lg font-semibold text-slate-100 mb-2">Accuracy Trend Over Time</h2>
                  <p className="text-xs text-slate-500 mb-6">Your score percentage across all {analytics.totalAttempts} attempts</p>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={analytics.accuracyTrend.map((d, i) => ({
                      name: `#${i + 1}`,
                      percentage: d.percentage,
                      quiz: d.quizTitle
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#e2e8f0'} />
                      <XAxis dataKey="name" stroke={chartStroke} tick={{ fontSize: 11, fill: chartTick }} />
                      <YAxis domain={[0, 100]} stroke={chartStroke} tick={{ fontSize: 11, fill: chartTick }} unit="%" />
                      <Tooltip
                        contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '12px', color: tooltipColor }}
                        formatter={(val, _, props) => [`${val}%`, props.payload.quiz]}
                      />
                      <Line type="monotone" dataKey="percentage" stroke="#8b5cf6" strokeWidth={2.5} dot={{ fill: '#8b5cf6', r: 3 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* Folder-wise Performance */}
                {analytics.folderPerformance?.length > 0 && (
                  <div className="card">
                    <h2 className="text-lg font-semibold text-slate-100 mb-2">Category-wise Performance</h2>
                    <p className="text-xs text-slate-500 mb-6">Average accuracy grouped by quiz folder/category</p>
                    <ResponsiveContainer width="100%" height={Math.max(200, analytics.folderPerformance.length * 50)}>
                      <BarChart
                        data={analytics.folderPerformance}
                        layout="vertical"
                        margin={{ top: 0, right: 20, left: 10, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#1e293b' : '#e2e8f0'} horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} stroke={chartStroke} tick={{ fontSize: 11, fill: chartTick }} unit="%" />
                        <YAxis type="category" dataKey="folderName" stroke={chartStroke} tick={{ fontSize: 12, fill: chartTick }} width={120} />
                        <Tooltip
                          contentStyle={{ background: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: '12px', color: tooltipColor }}
                          formatter={(val) => [`${val}%`, 'Avg Score']}
                        />
                        <Bar dataKey="avgPercentage" radius={[0, 8, 8, 0]} barSize={28}>
                          {analytics.folderPerformance.map((entry, index) => (
                            <Cell key={entry.folderId} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Weakest Area + Timing Metrics row */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Weakest Area */}
                  {analytics.weakestFolder && (
                    <div className="card bg-red-500/5 border-red-500/20">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-100">Weakest Area</p>
                          <p className="text-red-400 font-bold text-lg mt-1">{analytics.weakestFolder.folderName}</p>
                          <p className="text-slate-400 text-sm mt-0.5">
                            Average accuracy: <span className="text-red-400 font-semibold">{analytics.weakestFolder.avgPercentage}%</span>
                            {' '}across {analytics.weakestFolder.attemptCount} attempt{analytics.weakestFolder.attemptCount !== 1 ? 's' : ''}
                          </p>
                          <p className="text-xs text-slate-500 mt-2">Consider practicing more questions in this category to improve.</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Timing Metrics */}
                  {analytics.timingMetrics && (
                    <div className="card">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-500/20 flex items-center justify-center flex-shrink-0">
                          <Timer className="w-5 h-5 text-primary-400" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-100">Time Allocation</p>
                          <div className="mt-2 space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-400">Avg time per question:</span>
                              <span className="font-semibold text-slate-200">{analytics.timingMetrics.avgSecondsPerQuestion}s</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-slate-400">Allotted per question:</span>
                              <span className="font-semibold text-slate-200">{analytics.timingMetrics.avgAllottedSecondsPerQuestion}s</span>
                            </div>
                            <div className="pt-1">
                              {analytics.timingMetrics.rushingIndicator === 'rushing' && (
                                <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-1 rounded-lg">⚡ You tend to rush — try slowing down</span>
                              )}
                              {analytics.timingMetrics.rushingIndicator === 'close_to_limit' && (
                                <span className="text-xs bg-red-500/10 text-red-400 px-2 py-1 rounded-lg">⏰ Frequently close to the time limit</span>
                              )}
                              {analytics.timingMetrics.rushingIndicator === 'normal' && (
                                <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-lg">✓ Good time management</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="card text-center py-12">
                <Target className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400">No analytics data yet. Take some quizzes to see detailed performance insights!</p>
                <button onClick={() => navigate('/')} className="btn-primary mt-4">Take a Quiz</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
