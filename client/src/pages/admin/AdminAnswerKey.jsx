import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Check, Edit3, Save, X, ChevronDown, ChevronUp, Globe, AlertTriangle } from 'lucide-react';
import api from '../../api/axios';
import ThemeToggle from '../../components/ThemeToggle';

export default function AdminAnswerKey() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]); // local copy, editable
  const [answers, setAnswers] = useState({}); // { questionIndex: selectedOption }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activeLanguage, setActiveLanguage] = useState('all');
  const [editingIndex, setEditingIndex] = useState(null);
  const [editBuffer, setEditBuffer] = useState({}); // { questionText, options: [...] }
  const [expandedIndex, setExpandedIndex] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/quizzes/admin/${id}/for-answer-key`);
        setQuiz(res.data);
        setQuestions(res.data.questions);
        setExpandedIndex(0);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load quiz.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  // Derive unique languages
  const languages = ['all', ...Array.from(new Set(questions.map(q => q.language || 'English')))];
  const visibleQuestions = activeLanguage === 'all'
    ? questions.map((q, i) => ({ ...q, originalIndex: i }))
    : questions.map((q, i) => ({ ...q, originalIndex: i })).filter(q => (q.language || 'English') === activeLanguage);

  const answeredCount = Object.keys(answers).length;
  const unansweredCount = questions.length - answeredCount;

  const startEdit = useCallback((origIdx) => {
    setEditBuffer({
      questionText: questions[origIdx].questionText,
      options: [...questions[origIdx].options]
    });
    setEditingIndex(origIdx);
  }, [questions]);

  const saveEdit = useCallback((origIdx) => {
    setQuestions(prev => prev.map((q, i) => i === origIdx ? {
      ...q,
      questionText: editBuffer.questionText,
      options: editBuffer.options
    } : q));
    // If the current answer for this question doesn't exist in the new options, clear it
    const currentAnswer = answers[origIdx];
    if (currentAnswer && !editBuffer.options.includes(currentAnswer)) {
      setAnswers(prev => { const n = { ...prev }; delete n[origIdx]; return n; });
    }
    setEditingIndex(null);
  }, [editBuffer, answers]);

  const handleSaveAnswerKey = async () => {
    if (unansweredCount > 0) {
      const confirmProceed = window.confirm(
        `${unansweredCount} question(s) are unanswered. You can still save and finish answering later, or click Cancel to go back and answer them now.`
      );
      if (!confirmProceed) return;
    }

    setSaving(true); setError('');
    try {
      const answersPayload = questions.map((q, i) => ({
        questionId: q._id,
        correctAnswer: answers[i] || ''
      }));

      // Include edited questions
      const updatedQuestions = questions.map((q, i) => ({
        _id: q._id,
        questionText: q.questionText,
        options: q.options
      }));

      await api.post(`/quizzes/${id}/set-answer-key`, {
        answers: answersPayload,
        updatedQuestions
      });

      navigate(`/admin/quiz/${id}/review`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save answer key.');
    } finally {
      setSaving(false);
    }
  };

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

  if (error && !quiz) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
        <div className="card text-center max-w-sm">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-slate-400 mb-6">{error}</p>
          <button onClick={() => navigate('/admin/quizzes')} className="btn-primary">Back to Quizzes</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 pb-36">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-slate-900/90 backdrop-blur-sm border-b border-slate-800">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => navigate('/admin/quizzes')} className="text-slate-400 hover:text-slate-200 flex-shrink-0">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <ShieldCheck className="w-4 h-4 text-accent-400 flex-shrink-0" />
            <div className="min-w-0">
              <h1 className="font-semibold text-slate-100 truncate">{quiz?.title}</h1>
              <p className="text-xs text-slate-500">Admin Answer-Key Mode · {answeredCount}/{questions.length} answered</p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-slate-800">
          <div
            className="h-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${questions.length > 0 ? (answeredCount / questions.length) * 100 : 0}%` }}
          />
        </div>

        {/* Language filter tabs */}
        {languages.length > 2 && (
          <div className="max-w-3xl mx-auto px-4 pb-3 pt-2 flex gap-2 overflow-x-auto no-scrollbar">
            {languages.map(lang => (
              <button
                key={lang}
                onClick={() => setActiveLanguage(lang)}
                className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${activeLanguage === lang ? 'bg-primary-500/20 text-primary-300 border border-primary-500/40' : 'text-slate-400 border border-slate-700 hover:border-slate-600'}`}
              >
                {lang !== 'all' && <Globe className="w-3 h-3" />}
                {lang === 'all' ? 'All Languages' : lang}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Info banner */}
      <div className="max-w-3xl mx-auto px-4 pt-5 mb-4">
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-sm text-amber-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <span>
            Select the <strong>correct answer</strong> for each question. The option you choose will become the stored answer for students. Use the edit icon to fix any OCR errors in question text or options.
          </span>
        </div>
      </div>

      {error && (
        <div className="max-w-3xl mx-auto px-4 mb-4">
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm flex items-center justify-between">
            {error}
            <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Questions */}
      <div className="max-w-3xl mx-auto px-4 space-y-4">
        {visibleQuestions.map(({ originalIndex: origIdx, ...q }) => {
          const isExpanded = expandedIndex === origIdx;
          const isEditing = editingIndex === origIdx;
          const selectedAnswer = answers[origIdx];
          const hasAnswer = !!selectedAnswer;
          const currentQ = questions[origIdx];
          const qLanguage = currentQ.language || 'English';

          return (
            <div
              key={origIdx}
              className={`card transition-all duration-200 ${hasAnswer ? 'border-emerald-500/30' : 'border-slate-700'}`}
            >
              {/* Question header */}
              <div
                className="flex items-start gap-3 cursor-pointer"
                onClick={() => setExpandedIndex(isExpanded ? null : origIdx)}
              >
                {/* Number badge */}
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${hasAnswer ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                  {hasAnswer ? <Check className="w-3.5 h-3.5" /> : origIdx + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 text-sm leading-relaxed">{currentQ.questionText}</p>
                  {hasAnswer && !isExpanded && (
                    <p className="text-emerald-400 text-xs mt-1">✓ {selectedAnswer}</p>
                  )}
                  {qLanguage !== 'English' && languages.length > 2 && (
                    <span className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                      <Globe className="w-3 h-3" /> {qLanguage}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); startEdit(origIdx); if (!isExpanded) setExpandedIndex(origIdx); }}
                      className="p-1.5 text-slate-500 hover:text-primary-400 transition-colors"
                      title="Edit question"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
                </div>
              </div>

              {/* Expanded: Edit mode or Option selection */}
              {isExpanded && (
                <div className="mt-4 space-y-3">
                  {isEditing ? (
                    /* ── Edit Mode ── */
                    <div className="space-y-3" onClick={e => e.stopPropagation()}>
                      <div>
                        <label className="label text-xs">Question Text</label>
                        <textarea
                          className="input text-sm"
                          rows={3}
                          value={editBuffer.questionText}
                          onChange={e => setEditBuffer(prev => ({ ...prev, questionText: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="label text-xs">Options</label>
                        {editBuffer.options.map((opt, oi) => (
                          <div key={oi} className="flex gap-2">
                            <input
                              className="input flex-1 text-sm"
                              value={opt}
                              onChange={e => setEditBuffer(prev => ({
                                ...prev,
                                options: prev.options.map((o, j) => j === oi ? e.target.value : o)
                              }))}
                            />
                            {editBuffer.options.length > 2 && (
                              <button
                                type="button"
                                onClick={() => setEditBuffer(prev => ({ ...prev, options: prev.options.filter((_, j) => j !== oi) }))}
                                className="text-red-400 hover:text-red-300 p-2"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                        {editBuffer.options.length < 6 && (
                          <button
                            type="button"
                            onClick={() => setEditBuffer(prev => ({ ...prev, options: [...prev.options, ''] }))}
                            className="text-xs text-primary-400 hover:text-primary-300"
                          >+ Add option</button>
                        )}
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => saveEdit(origIdx)}
                          className="btn-primary text-sm px-4 flex items-center gap-1.5"
                        >
                          <Save className="w-3.5 h-3.5" /> Save edits
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingIndex(null)}
                          className="btn-secondary text-sm px-4"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── Answer Selection Mode ── */
                    <div className="space-y-2" onClick={e => e.stopPropagation()}>
                      <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Select the correct answer:</p>
                      {currentQ.options.map((option, oi) => {
                        const isSelected = selectedAnswer === option;
                        return (
                          <button
                            key={oi}
                            type="button"
                            onClick={() => setAnswers(prev => ({ ...prev, [origIdx]: option }))}
                            className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-all duration-200 flex items-center gap-3 ${
                              isSelected
                                ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300'
                                : 'border-slate-700 bg-slate-800/40 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
                            }`}
                          >
                            <span className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center ${isSelected ? 'border-emerald-500 bg-emerald-500' : 'border-slate-600'}`}>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </span>
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Floating footer */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur-sm border-t border-slate-800 px-4 py-4">
        <div className="max-w-3xl mx-auto">
          {unansweredCount > 0 && (
            <p className="text-amber-400 text-xs text-center mb-2 flex items-center justify-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              {unansweredCount} question{unansweredCount > 1 ? 's' : ''} not yet answered
            </p>
          )}
          <button
            onClick={handleSaveAnswerKey}
            disabled={saving || answeredCount === 0}
            className="btn-primary w-full flex items-center justify-center gap-2 py-3"
          >
            <Check className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Answer Key & Review'}
          </button>
        </div>
      </div>
    </div>
  );
}
