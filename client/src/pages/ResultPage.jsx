import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import ResultSummary from '../components/ResultSummary';
import { QuestionReview } from '../components/QuestionItem';
import { ArrowLeft, Home, RotateCcw, Trophy, Medal, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

export default function ResultPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState(null);
  const [lbLoading, setLbLoading] = useState(false);
  const [lbExpanded, setLbExpanded] = useState(false);

  useEffect(() => {
    const fetchAttempt = async () => {
      try {
        const res = await api.get(`/attempts/my/${attemptId}`);
        setAttempt(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load result.');
      } finally {
        setLoading(false);
      }
    };
    fetchAttempt();
  }, [attemptId]);

  // Fetch leaderboard once we have the quizId
  useEffect(() => {
    if (!attempt?.quizId?._id) return;
    setLbLoading(true);
    api.get(`/quizzes/${attempt.quizId._id}/leaderboard?limit=100`)
      .then(res => setLeaderboard(res.data))
      .catch(err => console.error('Leaderboard fetch error:', err))
      .finally(() => setLbLoading(false));
  }, [attempt?.quizId?._id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !attempt) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="card text-center max-w-sm">
          <p className="text-slate-400 mb-4">{error || 'Result not found.'}</p>
          <button onClick={() => navigate('/')} className="btn-primary">Back to Home</button>
        </div>
      </div>
    );
  }

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-12">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Quizzes</span>
          </button>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <button onClick={() => navigate('/dashboard')} className="btn-secondary py-2 px-4 text-sm">
              My Dashboard
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-8 space-y-8">
        {/* Score summary */}
        <ResultSummary attempt={attempt} quizTitle={attempt.quizId?.title || 'Quiz'} />

        {/* Leaderboard Standing Card */}
        {leaderboard && leaderboard.myRank && (
          <div className="card bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-orange-500/10 border-amber-500/20">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                <Trophy className="w-7 h-7 text-amber-400" />
              </div>
              <div className="flex-1">
                <p className="text-lg font-bold text-slate-100">
                  You ranked <span className="text-amber-400">#{leaderboard.myRank}</span> out of {leaderboard.totalStudents}
                </p>
                <p className="text-sm text-slate-400 mt-0.5">
                  Top <span className="font-semibold text-amber-400">{Math.max(1, Math.ceil((leaderboard.myRank / leaderboard.totalStudents) * 100))}%</span> of all students who attempted this quiz
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Leaderboard Table */}
        {leaderboard && leaderboard.leaderboard?.length > 0 && (
          <div className="card">
            <button
              onClick={() => setLbExpanded(!lbExpanded)}
              className="w-full flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Medal className="w-5 h-5 text-amber-400" />
                <h2 className="text-lg font-semibold text-slate-100">Leaderboard</h2>
                <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full">{leaderboard.totalStudents} students</span>
              </div>
              {lbExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </button>

            {lbExpanded && (
              <div className="mt-4 overflow-x-auto">
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
                      const isMe = entry.studentId?.toString() === attempt.studentId?.toString();
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
                          <td className="py-2.5 px-2 text-center text-slate-400 flex items-center justify-center gap-1">
                            <Clock className="w-3 h-3" />{formatTime(entry.timeTakenSeconds)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {lbLoading && (
          <div className="card text-center py-8">
            <div className="w-8 h-8 border-3 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto" />
            <p className="text-slate-400 text-sm mt-3">Loading leaderboard...</p>
          </div>
        )}

        {/* Retake / Home actions */}
        <div className="flex gap-3">
          <button onClick={() => navigate('/')} className="btn-secondary flex-1 flex items-center justify-center gap-2">
            <Home className="w-4 h-4" />
            Browse Quizzes
          </button>
          <button onClick={() => navigate(`/quiz/${attempt.quizId?._id}`)} className="btn-primary flex-1 flex items-center justify-center gap-2">
            <RotateCcw className="w-4 h-4" />
            Retake Quiz
          </button>
        </div>

        {/* Answer review */}
        {attempt.showCorrectAnswersAfterSubmit !== false ? (
          <div>
            <h2 className="text-xl font-bold text-slate-100 mb-4">Answer Review</h2>
            <div className="space-y-4">
              {attempt.answers.map((ans, i) => (
                <QuestionReview key={i} answer={ans} index={i} />
              ))}
            </div>
          </div>
        ) : (
          <div className="card border border-slate-800 bg-slate-900/30 text-center py-6">
            <p className="text-slate-400 text-sm">
              The instructor has disabled correct answer review for this quiz attempt.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
