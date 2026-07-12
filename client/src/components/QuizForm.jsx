import { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, GripVertical, Check, Folder } from 'lucide-react';
import api from '../api/axios';

const emptyQuestion = () => ({
  questionText: '',
  options: ['', '', '', ''],
  correctAnswer: ''
});

export default function QuizForm({ initialData, onSubmit, loading }) {
  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [durationMinutes, setDurationMinutes] = useState(initialData?.durationMinutes || 10);
  const [isPublished, setIsPublished] = useState(initialData?.isPublished || false);
  const [negativeMarkingPoints, setNegativeMarkingPoints] = useState(initialData?.negativeMarkingPoints ?? 0);
  const [questions, setQuestions] = useState(
    initialData?.questions?.length > 0
      ? initialData.questions
      : [emptyQuestion()]
  );
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
      if (!q.correctAnswer) {
        alert(`Question ${i + 1} has no correct answer selected.`); return;
      }
    }
    onSubmit({ title, description, durationMinutes: Number(durationMinutes), isPublished, negativeMarkingPoints: Number(negativeMarkingPoints), folderIds: selectedFolderIds, questions });
  };

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
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Duration (minutes) *</label>
            <input className="input" type="number" min={1} max={180} value={durationMinutes} onChange={e => setDurationMinutes(e.target.value)} required />
          </div>
          <div>
            <label className="label">Negative Marking (points per wrong answer)</label>
            <div className="relative">
              <input
                className="input pr-16"
                type="number"
                min={0}
                max={10}
                step={0.25}
                value={negativeMarkingPoints}
                onChange={e => setNegativeMarkingPoints(e.target.value)}
                placeholder="0 = disabled"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 pointer-events-none">
                {Number(negativeMarkingPoints) > 0 ? `−${negativeMarkingPoints} pts` : 'OFF'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">e.g. 0.25 → deduct ¼ pt per wrong answer. 0 = no penalty.</p>
          </div>
        </div>
        <div className="flex items-center">
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

                <div>
                  <label className="label">Options (select the correct answer) *</label>
                  <div className="space-y-2">
                    {q.options.map((opt, optIndex) => (
                      <div key={optIndex} className="flex items-center gap-3">
                        <input
                          type="radio"
                          name={`correct-${qIndex}`}
                          checked={q.correctAnswer === opt && opt !== ''}
                          onChange={() => updateQuestion(qIndex, 'correctAnswer', opt)}
                          className="w-4 h-4 text-primary-500 accent-primary-500 flex-shrink-0"
                          title="Mark as correct answer"
                        />
                        <input
                          className={`input flex-1 ${q.correctAnswer === opt && opt !== '' ? 'border-primary-500/50 bg-primary-500/10' : ''}`}
                          value={opt}
                          onChange={e => updateOption(qIndex, optIndex, e.target.value)}
                          placeholder={`Option ${optIndex + 1}`}
                          required
                        />
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Click the radio button on the left to mark correct answer.</p>
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
