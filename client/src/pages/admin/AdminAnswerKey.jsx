import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, Check, Edit3, Save, X, ChevronDown, ChevronUp, Globe, AlertTriangle, Sparkles } from 'lucide-react';
import api from '../../api/axios';
import ThemeToggle from '../../components/ThemeToggle';

const QuestionBadges = ({ q }) => {
  const badges = [];
  if (q.isBonusQuestion) badges.push({ text: 'Bonus', bg: 'bg-purple-500/20 text-purple-400 border-purple-500/30' });
  if (q.isOptional) badges.push({ text: 'Optional', bg: 'bg-blue-500/20 text-blue-400 border-blue-500/30' });
  if (q.allowMultipleCorrect) badges.push({ text: 'Multi-Correct', bg: 'bg-teal-500/20 text-teal-400 border-teal-500/30' });
  if (q.marksWeight !== undefined && q.marksWeight !== 1) badges.push({ text: `${q.marksWeight} Mark${q.marksWeight > 1 ? 's' : ''}`, bg: 'bg-amber-500/20 text-amber-400 border-amber-500/30' });
  
  if (badges.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {badges.map((b, i) => (
        <span key={i} className={`text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded-full border ${b.bg}`}>
          {b.text}
        </span>
      ))}
    </div>
  );
};

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

  // Parse newOnly query parameter
  const queryParams = new URLSearchParams(window.location.search);
  const newOnly = queryParams.get('newOnly') === 'true';

  const [totalQuestionsCount, setTotalQuestionsCount] = useState(0);
  const [answeredQuestionsCount, setAnsweredQuestionsCount] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const url = newOnly
          ? `/quizzes/admin/${id}/for-answer-key?newOnly=true`
          : `/quizzes/admin/${id}/for-answer-key`;
        const res = await api.get(url);
        setQuiz(res.data);
        setQuestions(res.data.questions);
        setTotalQuestionsCount(res.data.totalQuestionsCount || res.data.questions.length);
        setAnsweredQuestionsCount(res.data.answeredQuestionsCount || 0);
        setExpandedIndex(0);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load quiz.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, newOnly]);

  // Derive unique languages
  const languages = ['all', ...Array.from(new Set(questions.map(q => q.language || 'English')))];
  const visibleQuestions = activeLanguage === 'all'
    ? questions.map((q, i) => ({ ...q, originalIndex: i }))
    : questions.map((q, i) => ({ ...q, originalIndex: i })).filter(q => (q.language || 'English') === activeLanguage);

  const answeredCount = questions.filter((q, i) => {
    const ans = answers[i];
    if (q.isBonusQuestion) return true;
    if (q.allowMultipleCorrect) {
      return Array.isArray(ans) && ans.length > 0;
    }
    return ans !== undefined && ans !== null && ans !== '';
  }).length;
  const unansweredCount = questions.length - answeredCount;

  const startEdit = useCallback((origIdx) => {
    setEditBuffer({
      questionText: questions[origIdx].questionText,
      options: [...questions[origIdx].options],
      questionType: questions[origIdx].questionType || 'mcq'
    });
    setEditingIndex(origIdx);
  }, [questions]);

  const saveEdit = useCallback((origIdx) => {
    setQuestions(prev => prev.map((q, i) => i === origIdx ? {
      ...q,
      questionText: editBuffer.questionText,
      options: editBuffer.options,
      questionType: editBuffer.questionType || 'mcq'
    } : q));
    // If MCQ and the current answer doesn't exist in the new options, clear it
    const currentAnswer = answers[origIdx];
    const isMCQ = (editBuffer.questionType || 'mcq') === 'mcq';
    if (isMCQ && currentAnswer) {
      if (Array.isArray(currentAnswer)) {
        const remaining = currentAnswer.filter(ans => editBuffer.options.includes(ans));
        if (remaining.length === 0) {
          setAnswers(prev => { const n = { ...prev }; delete n[origIdx]; return n; });
        } else {
          setAnswers(prev => ({ ...prev, [origIdx]: remaining }));
        }
      } else if (!editBuffer.options.includes(currentAnswer)) {
        setAnswers(prev => { const n = { ...prev }; delete n[origIdx]; return n; });
      }
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
      const answersPayload = questions.map((q, i) => {
        const currentAns = answers[i];
        if (q.allowMultipleCorrect) {
          const arr = Array.isArray(currentAns) ? currentAns : (currentAns ? [currentAns] : []);
          return {
            questionId: q._id,
            correctAnswers: arr,
            correctAnswer: arr.length > 0 ? arr[0] : ''
          };
        } else {
          const val = Array.isArray(currentAns) ? (currentAns[0] || '') : (currentAns || '');
          return {
            questionId: q._id,
            correctAnswer: val,
            correctAnswers: val ? [val] : []
          };
        }
      });

      // Include edited questions
      const updatedQuestions = questions.map((q, i) => ({
        _id: q._id,
        questionText: q.questionText,
        options: q.options,
        questionType: q.questionType || 'mcq'
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
      <div className="max-w-3xl mx-auto px-4 pt-5 mb-4 space-y-3">
        {newOnly && (
          <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl px-4 py-3 text-sm text-violet-300 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0 text-violet-400 animate-pulse" />
            <div>
              <p className="font-semibold text-slate-100">Setting answer key for new questions only</p>
              <p className="text-violet-300/90 text-xs mt-0.5">
                Showing <strong>{questions.length}</strong> newly added questions. 
                There are <strong>{answeredQuestionsCount}</strong> existing questions that already have answers set.
              </p>
            </div>
          </div>
        )}
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
          const isMulti = q.allowMultipleCorrect === true;
          const hasAnswer = isMulti
            ? (Array.isArray(selectedAnswer) && selectedAnswer.length > 0)
            : (selectedAnswer !== undefined && selectedAnswer !== null && selectedAnswer !== '');
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
                  <QuestionBadges q={currentQ} />
                  {hasAnswer && !isExpanded && (
                    <p className="text-emerald-400 text-xs mt-1">✓ {isMulti ? selectedAnswer.join(', ') : selectedAnswer}</p>
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
                      <div>
                        <label className="label text-xs">Question Type</label>
                        <select
                          className="input text-sm py-1.5"
                          value={editBuffer.questionType || 'mcq'}
                          onChange={e => {
                            const newType = e.target.value;
                            setEditBuffer(prev => ({
                              ...prev,
                              questionType: newType,
                              options: newType === 'mcq' ? (prev.options.length >= 2 ? prev.options : ['Option A', 'Option B']) : []
                            }));
                          }}
                        >
                          <option value="mcq">Multiple Choice (MCQ)</option>
                          <option value="integer">Integer Type (Numeric)</option>
                          <option value="text">Short Answer (Text)</option>
                        </select>
                      </div>
                      
                      {(editBuffer.questionType === 'mcq' || !editBuffer.questionType) && (
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
                      )}
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
                    <div className="space-y-3" onClick={e => e.stopPropagation()}>
                      {currentQ.imageUrl && (
                        <div className="mb-4 max-w-xs rounded-xl overflow-hidden border border-slate-700 bg-slate-800/40 p-2">
                          <img src={currentQ.imageUrl} alt="Question diagram" className="max-h-48 object-contain rounded-lg" />
                        </div>
                      )}
                      
                      {(currentQ.questionType === 'integer' || currentQ.questionType === 'text') ? (
                        /* Direct Input Answer (integer or text) */
                        <div className="space-y-3">
                          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                            Enter the correct {currentQ.questionType === 'integer' ? 'number' : 'text'}:
                          </p>
                          <div className="flex gap-2">
                            <input
                              type={currentQ.questionType === 'integer' ? 'number' : 'text'}
                              className="input text-sm flex-1"
                              value={selectedAnswer || ''}
                              placeholder={currentQ.questionType === 'integer' ? 'e.g. 42' : 'e.g. photosynthesis'}
                              onChange={e => setAnswers(prev => ({ ...prev, [origIdx]: e.target.value }))}
                            />
                            {currentQ.suggestedAnswer && (
                              <button
                                type="button"
                                onClick={() => setAnswers(prev => ({ ...prev, [origIdx]: currentQ.suggestedAnswer }))}
                                className="btn-secondary text-xs px-3 py-2 flex items-center gap-1.5 transition-all"
                                title="Pre-fill with AI suggestion"
                              >
                                Use Suggestion ({currentQ.suggestedAnswer})
                              </button>
                            )}
                          </div>
                          {currentQ.suggestedAnswer && (
                            <p className="text-[11px] text-slate-500">
                              <span className="font-semibold text-primary-400">AI suggestion:</span> {currentQ.suggestedAnswer} — verify before confirming
                            </p>
                          )}
                        </div>
                      ) : (
                        /* MCQ options */
                        <div className="space-y-2">
                          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
                            {currentQ.allowMultipleCorrect ? 'Select all correct answers (checkboxes):' : 'Select the correct answer:'}
                          </p>
                          {currentQ.options.map((option, oi) => {
                            const isSelected = currentQ.allowMultipleCorrect
                              ? (Array.isArray(selectedAnswer) && selectedAnswer.includes(option))
                              : (selectedAnswer === option);
                            
                            const handleOptionClick = () => {
                              if (currentQ.allowMultipleCorrect) {
                                const currentSelected = Array.isArray(selectedAnswer) ? selectedAnswer : (selectedAnswer ? [selectedAnswer] : []);
                                const newSelected = currentSelected.includes(option)
                                  ? currentSelected.filter(o => o !== option)
                                  : [...currentSelected, option];
                                setAnswers(prev => ({ ...prev, [origIdx]: newSelected }));
                              } else {
                                setAnswers(prev => ({ ...prev, [origIdx]: option }));
                              }
                            };

                            return (
                              <button
                                key={oi}
                                type="button"
                                onClick={handleOptionClick}
                                className={`w-full text-left px-4 py-3 rounded-2xl text-sm transition-all duration-300 flex items-center gap-3 ${
                                  isSelected
                                    ? 'bg-slate-900 text-accent-secondary shadow-nm-inset'
                                    : 'bg-slate-800 text-slate-300 shadow-nm-extruded-sm hover:-translate-y-[0.5px] hover:shadow-nm-extruded'
                                }`}
                              >
                                <span className={`w-5 h-5 flex-shrink-0 flex items-center justify-center transition-all duration-300 ${currentQ.allowMultipleCorrect ? 'rounded' : 'rounded-full'} ${
                                  isSelected ? 'bg-accent-secondary shadow-nm-inset-sm text-white' : 'bg-slate-900 shadow-nm-inset-sm'
                                }`}>
                                  {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
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
