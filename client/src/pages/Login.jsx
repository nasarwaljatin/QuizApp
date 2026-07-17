import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { Eye, EyeOff, Mail, Phone, Lock, ArrowRight } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('password'); // 'password' | 'otp'
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const handlePasswordLogin = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await api.post('/auth/login', { identifier, password });
      login(res.data.token, res.data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError(''); setInfo(''); setLoading(true);
    try {
      await api.post('/auth/otp/request', { identifier });
      setOtpSent(true);
      setInfo('OTP sent! Check your email (or check server console in dev mode).');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await api.post('/auth/otp/verify', { identifier, otp });
      login(res.data.token, res.data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'OTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-4 py-12">
      {/* Background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-accent-600/10 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl shadow-nm-inset-sm bg-slate-900 mb-4">
            <span className="text-3xl">🧠</span>
          </div>
          <h1 className="text-3xl font-extrabold font-display text-slate-100">Welcome back</h1>
          <p className="text-slate-400 mt-1">Sign in to your QuizApp account</p>
        </div>

        <div className="card">
          {/* Mode tabs */}
          <div className="flex bg-slate-800 shadow-nm-inset-sm rounded-2xl p-1 mb-6">
            <button
              type="button"
              onClick={() => { setMode('password'); setError(''); setInfo(''); setOtpSent(false); }}
              className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${mode === 'password' ? 'bg-slate-900 shadow-nm-extruded-sm text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Password
            </button>
            <button
              type="button"
              onClick={() => { setMode('otp'); setError(''); setInfo(''); }}
              className={`flex-1 py-2 text-sm font-bold rounded-xl transition-all ${mode === 'otp' ? 'bg-slate-900 shadow-nm-extruded-sm text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}
            >
              Login with OTP
            </button>
          </div>

          {error && (
            <div className="bg-slate-900 shadow-nm-inset text-red-400 rounded-2xl px-4 py-3 text-sm mb-4">
              {error}
            </div>
          )}
          {info && (
            <div className="bg-slate-900 shadow-nm-inset text-accent-secondary rounded-2xl px-4 py-3 text-sm mb-4">
              {info}
            </div>
          )}

          {/* Password login */}
          {mode === 'password' && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div>
                <label className="label">Email or Phone Number</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    className="input pl-10"
                    type="text"
                    placeholder="email@example.com or 9876543210"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    className="input pl-10 pr-10"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <div className="flex justify-end mt-2">
                  <Link to="/forgot-password" className="text-xs text-primary-400 hover:text-primary-300 font-medium">
                    Forgot Password?
                  </Link>
                </div>
              </div>
              <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2" disabled={loading}>
                {loading ? 'Signing in...' : <><span>Sign In</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          )}

          {/* OTP login */}
          {mode === 'otp' && (
            <div className="space-y-4">
              <div>
                <label className="label">Email or Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    className="input pl-10"
                    type="text"
                    placeholder="email@example.com or 9876543210"
                    value={identifier}
                    onChange={e => setIdentifier(e.target.value)}
                    disabled={otpSent}
                  />
                </div>
              </div>

              {!otpSent ? (
                <button onClick={handleRequestOtp} className="btn-primary w-full" disabled={loading || !identifier}>
                  {loading ? 'Sending OTP...' : 'Send OTP'}
                </button>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div>
                    <label className="label">Enter OTP</label>
                    <input
                      className="input text-center text-2xl tracking-widest font-mono"
                      type="text"
                      maxLength={6}
                      placeholder="123456"
                      value={otp}
                      onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                      required
                    />
                  </div>
                  <button type="submit" className="btn-primary w-full" disabled={loading || otp.length !== 6}>
                    {loading ? 'Verifying...' : 'Verify OTP'}
                  </button>
                  <button type="button" className="text-sm text-slate-400 hover:text-slate-200 w-full text-center" onClick={() => { setOtpSent(false); setOtp(''); setInfo(''); }}>
                    ← Resend OTP
                  </button>
                </form>
              )}
            </div>
          )}

          <p className="text-center text-sm text-slate-500 mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="text-primary-400 hover:text-primary-300 font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
