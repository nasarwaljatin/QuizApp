import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import QuizForm from '../../components/QuizForm';
import { Plus, Edit, Trash2, Eye, EyeOff, ShieldCheck, ArrowLeft, BookOpen, X, ChevronRight } from 'lucide-react';

export default function ManageQuizzes() {
  const navigate = useNavigate();
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' | 'create' | 'edit'
  const [editingQuiz, setEditingQuiz] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchQuizzes = async () => {
    try {
      const res = await api.get('/quizzes/admin/all');
      setQuizzes(res.data);
    } catch (err) {
      setError('Failed to load quizzes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQuizzes(); }, []);

  const handleCreate = async (data) => {
    setFormLoading(true); setError('');
    try {
      await api.post('/quizzes', data);
      await fetchQuizzes();
      setView('list');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create quiz.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = async (data) => {
    setFormLoading(true); setError('');
    try {
      await api.put(`/quizzes/${editingQuiz._id}`, data);
      await fetchQuizzes();
      setView('list'); setEditingQuiz(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update quiz.');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/quizzes/${id}`);
      setQuizzes(prev => prev.filter(q => q._id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      setError('Failed to delete quiz.');
    }
  };

  const togglePublish = async (quiz) => {
    try {
      await api.put(`/quizzes/${quiz._id}`, { isPublished: !quiz.isPublished });
      setQuizzes(prev => prev.map(q => q._id === quiz._id ? { ...q, isPublished: !q.isPublished } : q));
    } catch {
      setError('Failed to update quiz.');
    }
  };

  const openEdit = async (quiz) => {
    try {
      const res = await api.get(`/quizzes/admin/${quiz._id}`);
      setEditingQuiz(res.data);
      setView('edit');
    } catch { setError('Failed to load quiz.'); }
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-12">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {view !== 'list' ? (
              <button onClick={() => { setView('list'); setEditingQuiz(null); setError(''); }} className="text-slate-400 hover:text-slate-200">
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <Link to="/admin/dashboard" className="text-slate-400 hover:text-slate-200">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            )}
            <ShieldCheck className="w-5 h-5 text-accent-400" />
            <span className="text-xl font-bold text-slate-100">
              {view === 'list' ? 'Manage Quizzes' : view === 'create' ? 'Create Quiz' : 'Edit Quiz'}
            </span>
          </div>
          {view === 'list' && (
            <button onClick={() => { setView('create'); setError(''); }} className="btn-primary py-2 px-4 text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Quiz
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 pt-8">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm mb-6 flex items-center justify-between">
            {error}
            <button onClick={() => setError('')}><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* List view */}
        {view === 'list' && (
          <div className="space-y-4">
            {loading ? (
              [...Array(3)].map((_, i) => <div key={i} className="card h-20 animate-pulse" />)
            ) : quizzes.length === 0 ? (
              <div className="card text-center py-16">
                <BookOpen className="w-12 h-12 text-slate-600 mx-auto mb-4" />
                <p className="text-slate-400 mb-4">No quizzes yet. Create your first one!</p>
                <button onClick={() => setView('create')} className="btn-primary inline-flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  Create Quiz
                </button>
              </div>
            ) : (
              quizzes.map(quiz => (
                <div key={quiz._id} className="card flex items-center gap-4 hover:border-slate-700 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-100 truncate">{quiz.title}</h3>
                      <span className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${quiz.isPublished ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-700 text-slate-400'}`}>
                        {quiz.isPublished ? 'Published' : 'Draft'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {quiz.questionCount} questions · {quiz.durationMinutes} min
                      {quiz.description && ` · ${quiz.description.slice(0, 60)}${quiz.description.length > 60 ? '…' : ''}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => togglePublish(quiz)}
                      title={quiz.isPublished ? 'Unpublish' : 'Publish'}
                      className="p-2 text-slate-400 hover:text-emerald-400 transition-colors"
                    >
                      {quiz.isPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button onClick={() => openEdit(quiz)} className="p-2 text-slate-400 hover:text-primary-400 transition-colors">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => setDeleteConfirm(quiz._id)} className="p-2 text-slate-400 hover:text-red-400 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Create view */}
        {view === 'create' && (
          <QuizForm onSubmit={handleCreate} loading={formLoading} />
        )}

        {/* Edit view */}
        {view === 'edit' && editingQuiz && (
          <QuizForm initialData={editingQuiz} onSubmit={handleEdit} loading={formLoading} />
        )}
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center px-4">
          <div className="card max-w-sm w-full animate-slide-up">
            <h3 className="text-lg font-bold text-slate-100 mb-2">Delete Quiz?</h3>
            <p className="text-slate-400 text-sm mb-6">This action cannot be undone. All attempts for this quiz will remain in the database.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="btn-danger flex-1">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
