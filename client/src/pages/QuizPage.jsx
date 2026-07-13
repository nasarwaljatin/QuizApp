import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { useTimer } from '../hooks/useTimer';
import Timer from '../components/Timer';
import QuestionItem from '../components/QuestionItem';
import { ArrowLeft, Send, AlertTriangle } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

// Fisher-Yates shuffle
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function QuizPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState(null);
  const [shuffledQuestions, setShuffledQuestions] = useState([]);
  const [answers, setAnswers] = useState({}); // { questionText: selectedOption }
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [startTime, setStartTime] = useState(null);
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  const { formattedTime, isTimeUp, percentLeft } = useTimer(
    quiz ? quiz.durationMinutes * 60 : 0,
    !!quiz && !submitting
  );

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const res = await api.get(`/quizzes/${id}`);
        const q = res.data;
        setQuiz(q);
        setShuffledQuestions(q.questions);
        setStartTime(Date.now());
      } catch (err) {
        if (err.response?.status === 403 && err.response?.data?.alreadyAttempted) {
          setError({
            message: "You've already attempted this quiz.",
            attemptId: err.response.data.attemptId
          });
        } else {
          setError(err.response?.data?.message || 'Failed to load quiz.');
        }
      } finally {
        setLoading(false);
      }
    };
    fetchQuiz();
  }, [id]);

  const handleSubmit = useCallback(async (auto = false) => {
    if (submitting) return;
    setSubmitting(true);
    const timeTakenSeconds = startTime ? Math.round((Date.now() - startTime) / 1000) : 0;

    const answersPayload = shuffledQuestions.map(q => ({
      questionText: q.questionText,
      selectedAnswer: answers[q.questionText] || ''
    }));

    try {
      const res = await api.post('/attempts', {
        quizId: id,
        answers: answersPayload,
        timeTakenSeconds,
        autoSubmitted: auto
      });
      navigate(`/result/${res.data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to submit quiz.');
      setSubmitting(false);
    }
  }, [submitting, startTime, shuffledQuestions, answers, id, navigate]);

  // Auto-submit when time is up
  useEffect(() => {
    if (isTimeUp && quiz && !submitting) {
      handleSubmit(true);
    }
  }, [isTimeUp, quiz, submitting, handleSubmit]);

  const answeredCount = Object.keys(answers).length;
  const unansweredCount = shuffledQuestions.length - answeredCount;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (error) {
    const isAlreadyAttempted = typeof error === 'object' && error.attemptId;
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="card text-center max-w-sm w-full">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-100 mb-2">
            {isAlreadyAttempted ? 'Already Attempted' : 'Error'}
          </h2>
          <p className="text-slate-400 mb-6">
            {isAlreadyAttempted ? error.message : error}
          </p>
          {isAlreadyAttempted ? (
            <div className="flex flex-col gap-3">
              <button onClick={() => navigate(`/result/${error.attemptId}`)} className="btn-primary w-full">
                View My Result
              </button>
              <button onClick={() => navigate('/')} className="btn-secondary w-full">
                Back to Home
              </button>
            </div>
          ) : (
            <button onClick={() => navigate('/')} className="btn-primary w-full">
              Back to Home
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 pb-32">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate('/')} className="text-slate-400 hover:text-slate-200 flex-shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-semibold text-slate-100 truncate">{quiz?.title}</h1>
              <p className="text-xs text-slate-500">{answeredCount}/{shuffledQuestions.length} answered</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Timer formattedTime={formattedTime} percentLeft={percentLeft} />
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-slate-800">
          <div
            className="h-full bg-primary-500 transition-all duration-500"
            style={{ width: `${(answeredCount / shuffledQuestions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Questions */}
      <div className="max-w-3xl mx-auto px-4 pt-8 space-y-6">
        {shuffledQuestions.map((question, index) => (
          <QuestionItem
            key={question._id}
            question={question}
            index={index}
            selected={answers[question.questionText] || null}
            onSelect={(option) => setAnswers(prev => ({ ...prev, [question.questionText]: option }))}
          />
        ))}
      </div>

      {/* Confirm submit modal */}
      {confirmSubmit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="card max-w-sm w-full animate-slide-up">
            <h3 className="text-lg font-bold text-slate-100 mb-2">Submit Quiz?</h3>
            {unansweredCount > 0 && (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2 text-amber-400 text-sm mb-4">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>You have {unansweredCount} unanswered question{unansweredCount > 1 ? 's' : ''}.</span>
              </div>
            )}
            <p className="text-slate-400 text-sm mb-6">Once submitted, you cannot change your answers.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmSubmit(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => handleSubmit(false)} className="btn-primary flex-1" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating submit button */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-sm border-t border-slate-800 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => setConfirmSubmit(true)}
            className="btn-primary w-full flex items-center justify-center gap-2"
            disabled={submitting}
          >
            <Send className="w-4 h-4" />
            {submitting ? 'Submitting...' : 'Submit Quiz'}
          </button>
        </div>
      </div>
    </div>
  );
}
