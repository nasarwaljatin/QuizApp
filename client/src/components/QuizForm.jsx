import { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, GripVertical, Check, Folder } from 'lucide-react';
import api from '../api/axios';

const emptyQuestion = () => ({
  questionText: '',
  options: ['', '', '', ''],
  correctAnswer: '',
  correctAnswers: [],
  allowMultipleCorrect: false,
  partialCreditForMultiCorrect: false,
  isBonusQuestion: false,
  marksWeight: 1,
  isOptional: false,
  explanationText: '',
  imageUrl: '',
  questionType: 'mcq',
  suggestedAnswer: ''
});

export default function QuizForm({ initialData, onSubmit, loading }) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [durationMinutes, setDurationMinutes] = useState(initialData?.durationMinutes || 10);
  const [isPublished, setIsPublished] = useState(initialData?.isPublished || false);
  
  // Settings states
  const [negativeMarking, setNegativeMarking] = useState(
    initialData?.negativeMarking ?? (initialData?.negativeMarkingPoints > 0 ? true : false)
  );
  const [negativeMarkingPoints, setNegativeMarkingPoints] = useState(initialData?.negativeMarkingPoints ?? 0.25);
  const [shuffleQuestions, setShuffleQuestions] = useState(initialData?.shuffleQuestions ?? true);
  const [shuffleOptions, setShuffleOptions] = useState(initialData?.shuffleOptions ?? true);
  const [allowMultipleAttempts, setAllowMultipleAttempts] = useState(initialData?.allowMultipleAttempts ?? false);
  const [showCorrectAnswersAfterSubmit, setShowCorrectAnswersAfterSubmit] = useState(initialData?.showCorrectAnswersAfterSubmit ?? true);
  const [randomizeQuestionSubset, setRandomizeQuestionSubset] = useState(initialData?.randomizeQuestionSubset ?? false);
  const [subsetSize, setSubsetSize] = useState(initialData?.subsetSize || 10);

  const [questions, setQuestions] = useState(
    initialData?.questions?.length > 0
      ? initialData.questions.map(q => ({
          ...q,
          correctAnswers: q.correctAnswers?.length > 0 ? q.correctAnswers : (q.correctAnswer ? [q.correctAnswer] : []),
          allowMultipleCorrect: q.allowMultipleCorrect || false,
          partialCreditForMultiCorrect: q.partialCreditForMultiCorrect || false,
          isBonusQuestion: q.isBonusQuestion || false,
          marksWeight: q.marksWeight !== undefined ? q.marksWeight : 1,
          isOptional: q.isOptional || false,
          explanationText: q.explanationText || '',
          imageUrl: q.imageUrl || '',
          questionType: q.questionType || 'mcq',
          suggestedAnswer: q.suggestedAnswer || ''
        }))
      : [emptyQuestion()]
  );
  const [uploadingImageIndex, setUploadingImageIndex] = useState(null);
  const [expanded, setExpanded] = useState([0]);

  // Folder states
  const [allFolders, setAllFolders] = useState([]);
  const [selectedFolderIds, setSelectedFolderIds] = useState(
    initialData?.folderIds?.map(f => typeof f === 'string' ? f : f._id) || []
  );
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  useEffect(() => {
    fetchFolders();
  }, []);

  const fetchFolders = async () => {
    try {
      const res = await api.get('/folders');
      setAllFolders(res.data);
    } catch (err) {
      console.error('Failed to load folders');
    }
  };

  const toggleFolder = (folderId) => {
    setSelectedFolderIds(prev => 
      prev.includes(folderId) ? prev.filter(id => id !== folderId) : [...prev, folderId]
    );
  };

  const handleCreateFolder = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    try {
      const res = await api.post('/folders', { name: newFolderName });
      setAllFolders(prev => [...prev, res.data]);
      setSelectedFolderIds(prev => [...prev, res.data._id]);
      setNewFolderName('');
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create folder');
    } finally {
      setCreatingFolder(false);
    }
  };

  const toggleExpanded = (i) => {
    setExpanded(prev =>
      prev.includes(i) ? prev.filter(x => x !== i) : [...prev, i]
    );
  };

  const addQuestion = () => {
    const newQ = emptyQuestion();
    setQuestions(prev => [...prev, newQ]);
    setExpanded(prev => [...prev, questions.length]);
  };

  const removeQuestion = (index) => {
    setQuestions(prev => prev.filter((_, i) => i !== index));
    setExpanded(prev => prev.filter(i => i !== index).map(i => i > index ? i - 1 : i));
  };

  const updateQuestion = (index, field, value) => {
    setQuestions(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const updateOption = (qIndex, optIndex, value) => {
    setQuestions(prev => {
      const updated = [...prev];
      const options = [...updated[qIndex].options];
      options[optIndex] = value;
      // If the correct answer was this option, update it
      const wasCorrect = updated[qIndex].correctAnswer === updated[qIndex].options[optIndex];
      updated[qIndex] = {
        ...updated[qIndex],
        options,
        correctAnswer: wasCorrect ? value : updated[qIndex].correctAnswer
      };
      return updated;
    });
  };

  const handleImageUpload = async (qIndex, file) => {
    if (!file) return;
    setUploadingImageIndex(qIndex);
    const formData = new FormData();
    formData.append('image', file);
    try {
      const res = await api.post('/quizzes/admin/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      updateQuestion(qIndex, 'imageUrl', res.data.imageUrl);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to upload image.');
    } finally {
      setUploadingImageIndex(null);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Validation
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.questionText.trim()) {
        alert(`Question ${i + 1} text is empty.`); return;
      }
      if (q.options.some(o => !o.trim())) {
        alert(`Question ${i + 1} has empty options.`); return;
      }
      if (!q.isBonusQuestion) {
        if (q.allowMultipleCorrect) {
          if (!q.correctAnswers || q.correctAnswers.length === 0) {
            alert(`Question ${i + 1} (Multiple Correct) must have at least one correct answer selected.`); return;
          }
        } else {
          if (!q.correctAnswer) {
            alert(`Question ${i + 1} has no correct answer selected.`); return;
          }
        }
      }
    }

    if (randomizeQuestionSubset && (Number(subsetSize) <= 0 || Number(subsetSize) > questions.length)) {
      alert(`Question subset size must be between 1 and the total questions count (${questions.length}).`);
      return;
    }

    onSubmit({
      title,
      description,
      durationMinutes: Number(durationMinutes),
      isPublished,
      negativeMarking,
      negativeMarkingPoints: negativeMarking ? Number(negativeMarkingPoints) : 0,
      shuffleQuestions,
      shuffleOptions,
      allowMultipleAttempts,
      showCorrectAnswersAfterSubmit,
      randomizeQuestionSubset,
      subsetSize: randomizeQuestionSubset ? Number(subsetSize) : 0,
      folderIds: selectedFolderIds,
      questions
    });
  };

  const FormToggle = ({ checked, onChange, label, description }) => (
    <div className="flex items-start justify-between py-3 border-b border-slate-800/60 last:border-0">
      <div className="flex-1 pr-4">
        <label className="text-sm font-semibold text-slate-200 block">{label}</label>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <div
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full transition-all duration-300 flex items-center px-1 cursor-pointer flex-shrink-0 ${checked ? 'bg-primary-500' : 'bg-slate-700'}`}
      >
        <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-300 ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Quiz metadata */}
      <div className="card space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">Quiz Details</h3>
        <div>
          <label className="label">Title *</label>
          <input className="input" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Python Basics Quiz" />
        </div>
        <div>
          <label className="label">Description</label>
          <textarea className="input resize-none" rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description..." />
        </div>
        <div>
          <label className="label">Duration (minutes) *</label>
          <input className="input" type="number" min={1} max={180} value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} required />
        </div>
        <div className="flex items-center pt-2">
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              onClick={() => setIsPublished(!isPublished)}
              className={`w-12 h-6 rounded-full transition-all duration-300 flex items-center px-1 ${isPublished ? 'bg-primary-500' : 'bg-slate-700'}`}
            >
              <div className={`w-4 h-4 rounded-full bg-white transition-transform duration-300 ${isPublished ? 'translate-x-6' : 'translate-x-0'}`} />
            </div>
            <span className="text-sm text-slate-400">{isPublished ? 'Published' : 'Draft'}</span>
          </label>
        </div>

        {/* Folders Multi-Select */}
        <div className="border-t border-slate-700 pt-4 mt-2">
          <label className="label flex items-center gap-2 mb-3">
            <Folder className="w-4 h-4 text-slate-400" />
            Assign to Folders (Optional)
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {allFolders.map(folder => {
              const isSelected = selectedFolderIds.includes(folder._id);
              return (
                <button
                  key={folder._id}
                  type="button"
                  onClick={() => toggleFolder(folder._id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                    isSelected 
                      ? 'bg-primary-500/20 text-primary-300 border-primary-500/30' 
                      : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700 hover:text-slate-200'
                  }`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5" />}
                  {folder.name}
                </button>
              );
            })}
            {allFolders.length === 0 && <span className="text-sm text-slate-500">No folders exist yet.</span>}
          </div>
          
          {/* Inline Create Folder */}
          <div className="flex items-center gap-2 max-w-sm">
            <input
              type="text"
              className="input py-1.5 text-sm flex-1"
              placeholder="+ New folder name..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleCreateFolder(e);
                }
              }}
              disabled={creatingFolder}
            />
            <button 
              type="button" 
              onClick={handleCreateFolder} 
              disabled={creatingFolder || !newFolderName.trim()}
              className="btn-secondary py-1.5 px-3 text-sm flex-shrink-0"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Quiz Settings Panel */}
      <div className="card space-y-4">
        <h3 className="text-lg font-semibold text-slate-100">Quiz Settings</h3>
        <div className="divide-y divide-slate-800">
          <FormToggle
            checked={shuffleQuestions}
            onChange={setShuffleQuestions}
            label="Shuffle Questions"
            description="Randomize question order for each student attempt."
          />
          <FormToggle
            checked={shuffleOptions}
            onChange={setShuffleOptions}
            label="Shuffle Options"
            description="Randomize option order within each question."
          />
          <FormToggle
            checked={allowMultipleAttempts}
            onChange={setAllowMultipleAttempts}
            label="Allow Multiple Attempts"
            description="Let students retake this quiz. If disabled, only their first attempt counts."
          />
          <FormToggle
            checked={showCorrectAnswersAfterSubmit}
            onChange={setShowCorrectAnswersAfterSubmit}
            label="Show Answers After Submission"
            description="Students will see the correct answers and explanations on their result page immediately."
          />
          
          <div className="py-3">
            <FormToggle
              checked={negativeMarking}
              onChange={setNegativeMarking}
              label="Enable Negative Marking"
              description="Deduct marks for incorrect answers."
            />
            {negativeMarking && (
              <div className="mt-3 pl-4 border-l-2 border-primary-500/50 animate-fade-in">
                <label className="label text-xs">Penalty points per wrong answer</label>
                <div className="relative max-w-[200px]">
                  <input
                    className="input pr-12 text-sm py-1.5"
                    type="number"
                    min={0.1}
                    max={10}
                    step={0.25}
                    value={negativeMarkingPoints}
                    onChange={e => setNegativeMarkingPoints(e.target.value)}
                    required={negativeMarking}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">
                    points
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="py-3 last:pb-0">
            <FormToggle
              checked={randomizeQuestionSubset}
              onChange={setRandomizeQuestionSubset}
              label="Deliver Random Question Subset"
              description="Deliver a random subset of questions from the pool to each student."
            />
            {randomizeQuestionSubset && (
              <div className="mt-3 pl-4 border-l-2 border-primary-500/50 animate-fade-in">
                <label className="label text-xs">Number of questions per student</label>
                <div className="relative max-w-[200px]">
                  <input
                    className="input text-sm py-1.5"
                    type="number"
                    min={1}
                    max={questions.length}
                    value={subsetSize}
                    onChange={e => setSubsetSize(e.target.value)}
                    required={randomizeQuestionSubset}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Pool has {questions.length} question(s) total.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((q, qIndex) => (
          <div key={qIndex} className="card border border-slate-700">
            {/* Question header */}
            <div className="flex items-center gap-3 mb-4">
              <GripVertical className="w-4 h-4 text-slate-600" />
              <span className="text-sm font-medium text-slate-400">Q{qIndex + 1}</span>
              <div className="flex-1 font-medium text-slate-200 truncate">
                {q.questionText || <span className="text-slate-500 italic">Untitled question</span>}
              </div>
              <button type="button" onClick={() => toggleExpanded(qIndex)} className="text-slate-400 hover:text-slate-200">
                {expanded.includes(qIndex) ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {questions.length > 1 && (
                <button type="button" onClick={() => removeQuestion(qIndex)} className="text-red-400 hover:text-red-300">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {expanded.includes(qIndex) && (
              <div className="space-y-4 animate-fade-in">
                <div>
                  <label className="label">Question Text *</label>
                  <textarea
                    className="input resize-none"
                    rows={2}
                    value={q.questionText}
                    onChange={e => updateQuestion(qIndex, 'questionText', e.target.value)}
                    placeholder="Enter your question..."
                    required
                  />
                </div>

                {/* Question Type and Suggestion Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label text-xs font-medium">Question Type *</label>
                    <select
                      className="input text-xs py-1.5"
                      value={q.questionType || 'mcq'}
                      onChange={e => {
                        const newType = e.target.value;
                        updateQuestion(qIndex, 'questionType', newType);
                        if (newType !== 'mcq') {
                          updateQuestion(qIndex, 'options', []);
                          updateQuestion(qIndex, 'allowMultipleCorrect', false);
                          updateQuestion(qIndex, 'partialCreditForMultiCorrect', false);
                        } else {
                          if (!q.options || q.options.length < 2) {
                            updateQuestion(qIndex, 'options', ['', '', '', '']);
                          }
                        }
                      }}
                    >
                      <option value="mcq">Multiple Choice (MCQ)</option>
                      <option value="integer">Integer Type (Numeric)</option>
                      <option value="text">Short Answer (Text)</option>
                    </select>
                  </div>
                  
                  {q.questionType !== 'mcq' && (
                    <div>
                      <label className="label text-xs font-medium">AI Suggested Answer (Optional Hint)</label>
                      <input
                        type="text"
                        className="input text-xs py-1.5"
                        placeholder="e.g. 42 or photosynthesis"
                        value={q.suggestedAnswer || ''}
                        onChange={e => updateQuestion(qIndex, 'suggestedAnswer', e.target.value)}
                      />
                    </div>
                  )}
                </div>

                {/* Image Section */}
                <div>
                  <label className="label text-xs">Question Image (diagram, figure, etc. - optional)</label>
                  {q.imageUrl && (
                    <div className="relative mt-2 max-w-xs rounded-xl overflow-hidden border border-slate-700 bg-slate-800/40 p-2 animate-fade-in">
                      <img src={q.imageUrl} alt="Question diagram" className="max-h-48 object-contain rounded-lg" />
                      <button
                        type="button"
                        onClick={() => updateQuestion(qIndex, 'imageUrl', '')}
                        className="absolute top-4 right-4 bg-red-500 hover:bg-red-600 text-white rounded-full p-1.5 shadow transition-colors"
                        title="Remove image"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  {!q.imageUrl && (
                    <div className="mt-2 flex items-center gap-3">
                      <label className="inline-flex items-center gap-2 cursor-pointer btn-secondary py-1.5 px-3 text-xs">
                        <span>Add Image</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={e => handleImageUpload(qIndex, e.target.files[0])}
                          className="sr-only"
                        />
                      </label>
                      {uploadingImageIndex === qIndex && (
                        <span className="text-xs text-slate-500 animate-pulse">Uploading image...</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Options Section (MCQ only) */}
                {(q.questionType === 'mcq' || !q.questionType) && (
                  <div>
                    <label className="label">Options (select correct answer{q.allowMultipleCorrect ? 's' : ''}) *</label>
                    <div className="space-y-2">
                      {q.options.map((opt, optIndex) => {
                        const isChecked = q.allowMultipleCorrect
                          ? (q.correctAnswers || []).includes(opt) && opt !== ''
                          : q.correctAnswer === opt && opt !== '';
                        return (
                          <div key={optIndex} className="flex items-center gap-3">
                            <input
                              type={q.allowMultipleCorrect ? 'checkbox' : 'radio'}
                              name={`correct-${qIndex}`}
                              checked={isChecked}
                              onChange={() => {
                                if (q.allowMultipleCorrect) {
                                  const currentCorrects = q.correctAnswers || [];
                                  const newCorrects = currentCorrects.includes(opt)
                                    ? currentCorrects.filter(o => o !== opt)
                                    : [...currentCorrects, opt];
                                  updateQuestion(qIndex, 'correctAnswers', newCorrects);
                                  updateQuestion(qIndex, 'correctAnswer', newCorrects[0] || '');
                                } else {
                                  updateQuestion(qIndex, 'correctAnswer', opt);
                                  updateQuestion(qIndex, 'correctAnswers', [opt]);
                                }
                              }}
                              className={`w-4 h-4 text-primary-500 accent-primary-500 flex-shrink-0 ${q.allowMultipleCorrect ? 'rounded' : 'rounded-full'}`}
                              title="Mark as correct answer"
                            />
                            <input
                              className={`input flex-1 ${isChecked ? 'border-primary-500/50 bg-primary-500/10' : ''}`}
                              value={opt}
                              onChange={e => updateOption(qIndex, optIndex, e.target.value)}
                              placeholder={`Option ${optIndex + 1}`}
                              required
                            />
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {q.allowMultipleCorrect 
                        ? 'Select all options that are correct (checkboxes).'
                        : 'Click the radio button on the left to mark the correct answer.'}
                    </p>
                  </div>
                )}

                {/* Per-Question Settings Toggle Panel */}
                <div className="border-t border-slate-800/60 pt-4 mt-4 space-y-4">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Question Settings</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Toggles */}
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={q.allowMultipleCorrect || false}
                          onChange={e => {
                            updateQuestion(qIndex, 'allowMultipleCorrect', e.target.checked);
                            updateQuestion(qIndex, 'correctAnswers', []);
                            updateQuestion(qIndex, 'correctAnswer', '');
                          }}
                          className="w-4 h-4 accent-primary-500 rounded bg-slate-800 border-slate-700"
                        />
                        <span>Multiple Correct Answers</span>
                      </label>
                      
                      {q.allowMultipleCorrect && (
                        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pl-6 animate-fade-in">
                          <input
                            type="checkbox"
                            checked={q.partialCreditForMultiCorrect || false}
                            onChange={e => updateQuestion(qIndex, 'partialCreditForMultiCorrect', e.target.checked)}
                            className="w-4 h-4 accent-primary-500 rounded bg-slate-800 border-slate-700"
                          />
                          <span>Allow Partial Credit</span>
                        </label>
                      )}

                      <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={q.isBonusQuestion || false}
                          onChange={e => updateQuestion(qIndex, 'isBonusQuestion', e.target.checked)}
                          className="w-4 h-4 accent-primary-500 rounded bg-slate-800 border-slate-700"
                        />
                        <span>Bonus Question</span>
                      </label>

                      <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={q.isOptional || false}
                          onChange={e => updateQuestion(qIndex, 'isOptional', e.target.checked)}
                          className="w-4 h-4 accent-primary-500 rounded bg-slate-800 border-slate-700"
                        />
                        <span>Optional Question</span>
                      </label>
                    </div>

                    {/* Inputs */}
                    <div className="space-y-3">
                      <div>
                        <label className="label text-xs">Question Weight (Marks)</label>
                        <input
                          type="number"
                          min={1}
                          max={10}
                          className="input text-xs py-1.5 max-w-[120px]"
                          value={q.marksWeight !== undefined ? q.marksWeight : 1}
                          onChange={e => updateQuestion(qIndex, 'marksWeight', Math.max(1, parseInt(e.target.value) || 1))}
                        />
                      </div>

                      <div>
                        <label className="label text-xs">Explanation / Solution Note (optional)</label>
                        <textarea
                          className="input text-xs py-1.5 resize-none"
                          rows={2}
                          placeholder="Explain why the correct answer is correct..."
                          value={q.explanationText || ''}
                          onChange={e => updateQuestion(qIndex, 'explanationText', e.target.value)}
                        />
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={addQuestion}
          className="w-full py-3 border-2 border-dashed border-slate-700 hover:border-primary-500/50 text-slate-500 hover:text-primary-400 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Question
        </button>
      </div>

      {/* Submit */}
      <div className="flex gap-3 justify-end">
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving...' : 'Save Quiz'}
        </button>
      </div>
    </form>
  );
}
