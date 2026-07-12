import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Upload, FileText, ShieldCheck, Folder, X, Plus, AlertTriangle, Loader2, Sparkles } from 'lucide-react';
import api from '../../api/axios';

export default function GenerateFromPdf() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [title, setTitle] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [allFolders, setAllFolders] = useState([]);
  const [selectedFolderIds, setSelectedFolderIds] = useState([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');

  useEffect(() => {
    api.get('/folders').then(res => setAllFolders(res.data)).catch(() => {});
  }, []);

  const handleFileDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === 'application/pdf') {
      setFile(dropped);
      setError('');
    } else {
      setError('Only PDF files are supported.');
    }
  };

  const handleFileSelect = (e) => {
    const selected = e.target.files[0];
    if (selected?.type === 'application/pdf') {
      setFile(selected);
      setError('');
    } else {
      setError('Only PDF files are supported.');
    }
  };

  const toggleFolder = (id) => {
    setSelectedFolderIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return setError('Please select a PDF file.');
    if (!title.trim()) return setError('Please enter a quiz title.');

    setError(''); setWarning(''); setLoading(true);
    try {
      const formData = new FormData();
      formData.append('pdf', file);
      formData.append('title', title);
      formData.append('durationMinutes', durationMinutes);
      formData.append('folderIds', JSON.stringify(selectedFolderIds));

      const res = await api.post('/generate/from-pdf', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 180000 // 3 min timeout — allows server-side retry on rate limit
      });

      if (res.data.warning) {
        setWarning(res.data.warning);
        // Brief pause so admin sees the warning before proceeding
        setTimeout(() => navigate(`/admin/quiz/${res.data.quiz._id}/answer-key`), 3000);
      } else {
        navigate(`/admin/quiz/${res.data.quiz._id}/answer-key`);
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Failed to generate quiz. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-12">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/admin/quizzes" className="text-slate-400 hover:text-slate-200">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <ShieldCheck className="w-5 h-5 text-accent-400" />
          <span className="text-xl font-bold text-slate-100">Generate Quiz from PDF</span>
          <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-full px-3 py-1">
            <Sparkles className="w-3 h-3" />
            Powered by Gemini AI
          </span>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-8">
        {/* Info banner */}
        <div className="bg-primary-500/10 border border-primary-500/20 rounded-xl px-4 py-3 text-sm text-primary-300 mb-6 flex items-start gap-3">
          <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium mb-0.5">How this works</p>
            <p className="text-primary-400 text-xs">Gemini AI will extract all questions and options from your PDF. You'll then take a self-attempt to set the correct answers — the AI never guesses answers on your behalf.</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm mb-6 flex items-center justify-between">
            <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}</span>
            <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
          </div>
        )}

        {warning && (
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-xl px-4 py-3 text-sm mb-6 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{warning} Redirecting you to set answers in a moment...</span>
          </div>
        )}

        {loading ? (
          /* Loading state */
          <div className="card text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
            </div>
            <h2 className="text-xl font-bold text-slate-100 mb-2">Processing your PDF</h2>
            <p className="text-slate-400 text-sm max-w-xs mx-auto">Gemini AI is reading and extracting all questions from your document. This may take up to a minute...</p>
            <div className="mt-6 flex justify-center gap-1">
              {[0,1,2].map(i => (
                <div key={i} className="w-2 h-2 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* PDF Upload */}
            <div className="card">
              <h2 className="text-base font-semibold text-slate-100 mb-4 flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary-400" />
                Upload PDF
              </h2>

              {!file ? (
                <div
                  className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${dragging ? 'border-primary-500 bg-primary-500/5' : 'border-slate-700 hover:border-slate-600'}`}
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleFileDrop}
                  onClick={() => document.getElementById('pdf-input').click()}
                >
                  <Upload className="w-10 h-10 text-slate-500 mx-auto mb-3" />
                  <p className="text-slate-300 font-medium mb-1">Drag & drop your PDF here</p>
                  <p className="text-slate-500 text-sm">or click to browse · Max 10MB</p>
                  <input id="pdf-input" type="file" accept="application/pdf" className="hidden" onChange={handleFileSelect} />
                </div>
              ) : (
                <div className="flex items-center gap-4 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-4">
                  <div className="w-10 h-10 rounded-lg bg-red-500/20 border border-red-500/30 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 font-medium truncate">{file.name}</p>
                    <p className="text-slate-500 text-xs">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                  <button type="button" onClick={() => setFile(null)} className="text-slate-400 hover:text-slate-200">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Quiz Details */}
            <div className="card space-y-4">
              <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-accent-400" />
                Quiz Details
              </h2>
              <div>
                <label className="label">Quiz Title *</label>
                <input
                  className="input"
                  type="text"
                  placeholder="e.g. JEE Mains 2024 Paper 1"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label">Duration (minutes) *</label>
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={300}
                  value={durationMinutes}
                  onChange={e => setDurationMinutes(Number(e.target.value))}
                  required
                />
              </div>
            </div>

            {/* Folder Assignment */}
            <div className="card">
              <h2 className="text-base font-semibold text-slate-100 mb-4 flex items-center gap-2">
                <Folder className="w-4 h-4 text-slate-400" />
                Assign to Folders <span className="text-slate-500 font-normal text-sm">(Optional)</span>
              </h2>
              {allFolders.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-4">
                  {allFolders.map(f => (
                    <button
                      key={f._id}
                      type="button"
                      onClick={() => toggleFolder(f._id)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${selectedFolderIds.includes(f._id) ? 'bg-primary-500/20 border-primary-500/50 text-primary-300' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                    >
                      {f.name}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm mb-4">No folders exist yet.</p>
              )}
              <form onSubmit={handleCreateFolder} className="flex gap-2">
                <input
                  className="input flex-1 text-sm"
                  type="text"
                  placeholder="New folder name..."
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                />
                <button type="submit" className="btn-secondary text-sm px-4 flex items-center gap-1.5" disabled={creatingFolder || !newFolderName.trim()}>
                  <Plus className="w-3.5 h-3.5" />
                  {creatingFolder ? 'Adding...' : 'Add'}
                </button>
              </form>
            </div>

            <button
              type="submit"
              className="btn-primary w-full flex items-center justify-center gap-2 py-3 text-base"
              disabled={!file || !title.trim() || loading}
            >
              <Sparkles className="w-5 h-5" />
              Generate Quiz with AI
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
