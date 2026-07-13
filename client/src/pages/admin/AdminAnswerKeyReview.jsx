import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Check, Globe, AlertTriangle, BookOpen, X, Rocket } from 'lucide-react';
import api from '../../api/axios';
import ThemeToggle from '../../components/ThemeToggle';

export default function AdminAnswerKeyReview() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        // Load the full quiz with correct answers to render review
        const res = await api.get(`/quizzes/admin/${id}`);
        setQuiz(res.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load quiz.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handlePublish = async () => {
    setPublishing(true); setError('');
    try {
      await api.post(`/quizzes/${id}/publish`);
      navigate('/admin/quizzes', { state: { published: quiz?.title } });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to publish quiz.');
      setPublishing(false);
    }
  };

  const handleSaveDraft = async () => {
    setSaving(true); setError('');
    try {
      await api.put(`/quizzes/${id}`, { isDraft: true, isPublished: false });
      navigate('/admin/quizzes');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save draft.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="card text-center max-w-sm">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-slate-400 mb-6">{error || 'Quiz not found.'}</p>
          <button onClick={() => navigate('/admin/quizzes')} className="btn-primary">Back to Quizzes</button>
        </div>
      </div>
    );
  }

  const languages = Array.from(new Set(quiz.questions.map(q => q.language || 'English')));
  const answeredQuestions = quiz.questions.filter(q => q.correctAnswer && q.correctAnswer.trim());
  const unansweredCount = quiz.questions.length - answeredQuestions.length;

  return (
    <div className="min-h-screen bg-slate-950 pb-36">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => navigate(`/admin/quiz/${id}/answer-key`)} className="text-slate-400 hover:text-slate-200">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <ShieldCheck className="w-5 h-5 text-accent-400" />
          <div>
            <p className="text-xl font-bold text-slate-100">Review & Publish</p>
            <p className="text-xs text-slate-500">{quiz.title}</p>
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-8 space-y-4">
        {/* Stats card */}
        <div className="card flex flex-wrap gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-100">{quiz.questions.length}</p>
            <p className="text-slate-500 text-xs">Total Questions</p>
          </div>
          <div className="text-center">
            <p className={`text-2xl font-bold ${answeredQuestions.length === quiz.questions.length ? 'text-emerald-400' : 'text-amber-400'}`}>
              {answeredQuestions.length}
            </p>
            <p className="text-slate-500 text-xs">Answers Set</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-100">{quiz.durationMinutes}</p>
            <p className="text-slate-500 text-xs">Minutes</p>
          </div>
          {languages.length > 1 && (
            <div className="text-center">
              <p className="text-2xl font-bold text-primary-400">{languages.length}</p>
              <p className="text-slate-500 text-xs">Languages</p>
            </div>
          )}
        </div>

        {/* Incomplete warning */}
        {unansweredCount > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 text-sm text-amber-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              <strong>{unansweredCount} question{unansweredCount > 1 ? 's have' : ' has'} no answer set.</strong> You can save as draft and come back to finish, or go back to set the remaining answers before publishing.
            </span>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm flex items-center justify-between">
            {error}
            <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Questions review list */}
        <h2 className="text-base font-semibold text-slate-300 flex items-center gap-2 pt-2">
          <BookOpen className="w-4 h-4" />
          Questions & Answers
        </h2>

        {quiz.questions.map((q, i) => {
          const hasAnswer = q.correctAnswer && q.correctAnswer.trim();
          return (
            <div key={q._id || i} className={`card ${hasAnswer ? '' : 'border-amber-500/20'}`}>
              <div className="flex items-start gap-3 mb-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${hasAnswer ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
                  {hasAnswer ? <Check className="w-3.5 h-3.5" /> : '!'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 text-sm leading-relaxed">{q.questionText}</p>
                  {q.language && q.language !== 'English' && (
                    <span className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                      <Globe className="w-3 h-3" /> {q.language}
                    </span>
                  )}
                </div>
              </div>

              {/* Options */}
              <div className="space-y-1.5 ml-10">
                {q.options.map((opt, oi) => {
                  const isCorrect = opt === q.correctAnswer;
                  return (
                    <div
                      key={oi}
                      className={`px-3 py-2 rounded-lg text-sm flex items-center gap-2.5 ${
                        isCorrect
                          ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-300'
                          : 'bg-slate-800/40 border border-slate-700/50 text-slate-400'
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full border flex-shrink-0 flex items-center justify-center ${isCorrect ? 'border-emerald-500 bg-emerald-500' : 'border-slate-600'}`}>
                        {isCorrect && <Check className="w-2.5 h-2.5 text-white" />}
                      </span>
                      {opt}
                      {isCorrect && <span className="ml-auto text-xs font-medium text-emerald-400">Correct</span>}
                    </div>
                  );
                })}

                {!hasAnswer && (
                  <p className="text-amber-400 text-xs flex items-center gap-1 pt-1">
                    <AlertTriangle className="w-3 h-3" /> No answer set for this question
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating action footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-sm border-t border-slate-800 px-4 py-4">
        <div className="max-w-3xl mx-auto flex gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={saving || publishing}
            className="btn-secondary flex-1 flex items-center justify-center gap-2"
          >
            {saving ? 'Saving...' : 'Save as Draft'}
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing || saving || unansweredCount > 0}
            className="btn-primary flex-1 flex items-center justify-center gap-2 py-3"
            title={unansweredCount > 0 ? 'Set all answers before publishing' : ''}
          >
            <Rocket className="w-4 h-4" />
            {publishing ? 'Publishing...' : 'Publish Quiz'}
          </button>
        </div>
        {unansweredCount > 0 && (
          <p className="text-slate-500 text-xs text-center mt-2">Set all {unansweredCount} remaining answer{unansweredCount > 1 ? 's' : ''} to enable publishing</p>
        )}
      </div>
    </div>
  );
}
