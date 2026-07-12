import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../../api/axios';
import { Folder, ArrowLeft, Trash2, ShieldCheck, Plus } from 'lucide-react';

export default function ManageFolders() {
  const navigate = useNavigate();
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const fetchFolders = async () => {
    try {
      const res = await api.get('/folders');
      setFolders(res.data);
    } catch (err) {
      setError('Failed to load folders.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFolders(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    
    setCreating(true);
    setError('');
    try {
      await api.post('/folders', { name: newFolderName });
      setNewFolderName('');
      await fetchFolders();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create folder.');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.delete(`/folders/${id}`);
      setFolders(prev => prev.filter(f => f._id !== id));
      setDeleteConfirm(null);
    } catch (err) {
      setError('Failed to delete folder.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-12">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin/dashboard" className="text-slate-400 hover:text-slate-200">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <ShieldCheck className="w-5 h-5 text-accent-400" />
            <span className="text-xl font-bold text-slate-100">Manage Folders</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pt-8">
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl mb-6">
            {error}
          </div>
        )}

        {/* Create Folder Form */}
        <div className="card mb-8">
          <h2 className="text-lg font-semibold text-slate-100 mb-4">Create New Folder</h2>
          <form onSubmit={handleCreate} className="flex gap-3">
            <input
              type="text"
              className="input flex-1"
              placeholder="e.g. JEE Mains, Physics, Chapter 1..."
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              disabled={creating}
            />
            <button type="submit" disabled={creating || !newFolderName.trim()} className="btn-primary flex items-center gap-2 whitespace-nowrap">
              <Plus className="w-4 h-4" />
              {creating ? 'Creating...' : 'Create Folder'}
            </button>
          </form>
        </div>

        {/* Folder List */}
        <h2 className="text-lg font-semibold text-slate-100 mb-4">Existing Folders</h2>
        {loading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="card h-20 animate-pulse" />)}
          </div>
        ) : folders.length === 0 ? (
          <div className="card text-center py-12">
            <Folder className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400">No folders created yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {folders.map(folder => (
              <div key={folder._id} className="card py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center">
                    <Folder className="w-5 h-5 text-primary-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-200">{folder.name}</h3>
                    <p className="text-xs text-slate-500">{folder.quizCount} {folder.quizCount === 1 ? 'quiz' : 'quizzes'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {deleteConfirm === folder._id ? (
                    <div className="flex items-center gap-2 bg-red-500/10 p-1.5 rounded-lg border border-red-500/20">
                      <span className="text-xs text-red-400 px-2">Quizzes will not be deleted.</span>
                      <button onClick={() => handleDelete(folder._id)} className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-md transition-colors">Confirm</button>
                      <button onClick={() => setDeleteConfirm(null)} className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-md transition-colors">Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteConfirm(folder._id)} className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors" title="Delete folder">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
