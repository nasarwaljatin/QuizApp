import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { Lock, Mail, ArrowRight, ShieldCheck } from 'lucide-react';

export default function AdminLogin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await api.post('/admin/login', { email, password });
      login(res.data.token, res.data.user);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid admin credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 bg-accent-600/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl shadow-nm-inset-sm bg-slate-900 mb-4">
            <ShieldCheck className="w-8 h-8 text-accent-500" />
          </div>
          <h1 className="text-2xl font-extrabold font-display text-slate-100">Admin Portal</h1>
          <p className="text-slate-400 text-sm mt-1">Restricted access — authorized personnel only</p>
        </div>

        <div className="card">
          {error && (
            <div className="bg-slate-900 shadow-nm-inset text-red-400 rounded-2xl px-4 py-3 text-sm mb-4">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">Admin Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input className="input pl-10" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@quizzapp.com" required />
              </div>
            </div>
            <div>
              <label className="label">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input className="input pl-10" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
              </div>
            </div>
            <button type="submit" className="w-full py-3 px-6 bg-accent-600 hover:bg-accent-500 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-accent-500/25 disabled:opacity-50" disabled={loading}>
              {loading ? 'Signing in...' : <><span>Sign In as Admin</span><ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
