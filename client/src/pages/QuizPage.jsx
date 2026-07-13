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

  // One-by-one Navigation States
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visited, setVisited] = useState({ 0: true });
  const [paletteOpen, setPaletteOpen] = useState(false);

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

  const handleNavigate = (index) => {
    if (index < 0 || index >= shuffledQuestions.length) return;
    setCurrentIndex(index);
    setVisited(prev => ({ ...prev, [index]: true }));
  };

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

  const isQuestionAttempted = (idx) => {
    const q = shuffledQuestions[idx];
    if (!q) return false;
    const ans = answers[q.questionText];
    return ans !== undefined && ans !== null && ans !== '';
  };

  const getQuestionStatus = (idx) => {
    if (isQuestionAttempted(idx)) return 'attempted'; // Green
    if (visited[idx]) return 'visited'; // Red
    return 'unvisited'; // Gray
  };

  const answeredCount = Object.keys(answers).filter(key => answers[key] !== null && answers[key] !== '').length;
  const unansweredCount = shuffledQuestions.length - answeredCount;
  const currentQuestion = shuffledQuestions[currentIndex];

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
    <div className="min-h-screen bg-slate-950 pb-20">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate('/')} className="text-slate-400 hover:text-slate-200 flex-shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <h1 className="font-semibold text-slate-100 truncate">{quiz?.title}</h1>
              <p className="text-xs text-slate-500">
                Question {currentIndex + 1} of {shuffledQuestions.length} · {answeredCount} answered
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button 
              onClick={() => setPaletteOpen(!paletteOpen)}
              className="md:hidden btn-secondary py-1.5 px-3 text-xs"
            >
              {paletteOpen ? 'Hide Grid' : 'Show Grid'}
            </button>
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

      <div className="max-w-5xl mx-auto px-4 pt-8 grid grid-cols-1 md:grid-cols-4 gap-6">
        
        {/* Left Side: Question Display */}
        <div className="md:col-span-3 space-y-6">
          {currentQuestion && (
            <QuestionItem
              question={currentQuestion}
              index={currentIndex}
              selected={answers[currentQuestion.questionText] || null}
              onSelect={(option) => setAnswers(prev => ({ ...prev, [currentQuestion.questionText]: option }))}
            />
          )}

          {/* Navigation Controls */}
          <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl p-4">
            <button
              onClick={() => handleNavigate(currentIndex - 1)}
              disabled={currentIndex === 0}
              className="btn-secondary py-2 px-5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            {currentIndex < shuffledQuestions.length - 1 ? (
              <button
                onClick={() => handleNavigate(currentIndex + 1)}
                className="btn-primary py-2 px-6 text-sm"
              >
                Next
              </button>
            ) : (
              <button
                onClick={() => setConfirmSubmit(true)}
                className="btn-primary py-2 px-6 text-sm bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              >
                Submit Quiz
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Status Palette */}
        <div className={`md:col-span-1 ${paletteOpen ? 'block' : 'hidden md:block'}`}>
          <div className="card space-y-5 sticky top-24">
            <div>
              <h3 className="font-semibold text-slate-100 text-sm">Question Palette</h3>
              <p className="text-xs text-slate-500 mt-1">Click a box to jump to question</p>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-5 gap-2">
              {shuffledQuestions.map((_, idx) => {
                const status = getQuestionStatus(idx);
                const isActive = idx === currentIndex;
                
                let bgClass = 'bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600';
                if (status === 'attempted') {
                  bgClass = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30';
                } else if (status === 'visited') {
                  bgClass = 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30';
                }

                return (
                  <button
                    key={idx}
                    onClick={() => {
                      handleNavigate(idx);
                      setPaletteOpen(false); // Auto close mobile dropdown on jump
                    }}
                    className={`h-9 w-9 rounded-lg font-bold text-sm flex items-center justify-center transition-all border ${bgClass} ${
                      isActive ? 'ring-2 ring-primary-500 ring-offset-2 ring-offset-slate-900 scale-105' : ''
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="border-t border-slate-800 pt-4 space-y-2.5">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Legend</h4>
              <div className="grid grid-cols-1 gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-emerald-500/20 border border-emerald-500/40 flex-shrink-0" />
                  <span className="text-slate-300">Answered ({answeredCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-500/20 border border-red-500/40 flex-shrink-0" />
                  <span className="text-slate-300">Not Answered ({Object.keys(visited).length - answeredCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-slate-800 border border-slate-700 flex-shrink-0" />
                  <span className="text-slate-300">Not Visited ({shuffledQuestions.length - Object.keys(visited).length})</span>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => setConfirmSubmit(true)}
              className="w-full btn-secondary text-xs py-2 hover:bg-emerald-600/10 hover:text-emerald-400 hover:border-emerald-500/30 transition-all font-semibold"
            >
              Submit Quiz
            </button>
          </div>
        </div>
      </div>

      {/* Confirm submit modal */}
      {confirmSubmit && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="card max-w-sm w-full animate-slide-up">
            <h3 className="text-lg font-bold text-slate-100 mb-2">Submit Quiz?</h3>
            
            <div className="space-y-2 mb-6">
              <div className="flex justify-between text-sm text-slate-400">
                <span>Total Questions:</span>
                <span className="font-semibold text-slate-200">{shuffledQuestions.length}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-400">
                <span>Answered:</span>
                <span className="font-semibold text-emerald-400">{answeredCount}</span>
              </div>
              <div className="flex justify-between text-sm text-slate-400">
                <span>Unanswered:</span>
                <span className={`font-semibold ${unansweredCount > 0 ? 'text-amber-400' : 'text-slate-400'}`}>
                  {unansweredCount}
                </span>
              </div>
            </div>

            {unansweredCount > 0 && (
              <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-2.5 text-amber-400 text-sm mb-4">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>You still have unanswered questions!</span>
              </div>
            )}
            
            <p className="text-slate-400 text-xs mb-6">Once submitted, you cannot change your answers. Do you wish to proceed?</p>
            
            <div className="flex gap-3">
              <button onClick={() => setConfirmSubmit(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => handleSubmit(false)} className="btn-primary flex-1 bg-emerald-600 hover:bg-emerald-500" disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
