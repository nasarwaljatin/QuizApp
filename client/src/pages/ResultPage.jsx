import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import ResultSummary from '../components/ResultSummary';
import { QuestionReview } from '../components/QuestionItem';
import { ArrowLeft, Home, RotateCcw } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

export default function ResultPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
        <div>
          <h2 className="text-xl font-bold text-slate-100 mb-4">Answer Review</h2>
          <div className="space-y-4">
            {attempt.answers.map((ans, i) => (
              <QuestionReview key={i} answer={ans} index={i} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
