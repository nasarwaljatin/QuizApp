import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { Mail, Phone, Lock, Eye, EyeOff, ArrowRight, ShieldCheck, Check } from 'lucide-react';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Send OTP, 2: Verify OTP, 3: Reset Password
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // Step 1: Send OTP
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setError(''); setInfo(''); setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password/request', { identifier });
      setInfo(res.data.message || 'OTP sent! Please check your email.');
      setStep(2);
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to send OTP.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (otp.length !== 6) return;
    setError(''); setInfo(''); setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password/verify', { identifier, otp });
      setInfo(res.data.message || 'OTP verified successfully!');
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'OTP verification failed.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError(''); setInfo(''); setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password/verify-and-reset', {
        identifier,
        otp,
        newPassword
      });
      setInfo(res.data.message || 'Password reset successful!');
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to reset password.');
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
          <h1 className="text-3xl font-extrabold font-display text-slate-100">Reset Password</h1>
          <p className="text-slate-400 mt-1">Recover your Student account</p>
        </div>

        <div className="card">
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

          {/* STEP 1: Enter Identifier */}
          {step === 1 && (
            <form onSubmit={handleRequestOtp} className="space-y-4">
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
              <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2" disabled={loading || !identifier}>
                {loading ? 'Sending OTP...' : <><span>Send OTP</span><ArrowRight className="w-4 h-4" /></>}
              </button>
            </form>
          )}

          {/* STEP 2: Verify OTP */}
          {step === 2 && (
            <div className="space-y-4">
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div>
                  <label className="label text-center">Enter 6-Digit OTP</label>
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
              </form>
              <div className="flex justify-between items-center text-xs mt-4">
                <button 
                  type="button" 
                  className="text-slate-400 hover:text-slate-200" 
                  onClick={() => { setStep(1); setOtp(''); setError(''); setInfo(''); }}
                >
                  ← Change Email/Phone
                </button>
                <button 
                  type="button" 
                  className="text-primary-400 hover:text-primary-300 font-medium" 
                  onClick={handleRequestOtp}
                  disabled={loading}
                >
                  Resend OTP
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Enter New Password */}
          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="label">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    className="input pl-10 pr-10"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 6 characters"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    className="input pl-10"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2" disabled={loading || !newPassword || !confirmPassword}>
                {loading ? 'Resetting Password...' : <><span>Reset Password</span><Check className="w-4 h-4" /></>}
              </button>
            </form>
          )}

          <p className="text-center text-sm text-slate-500 mt-6">
            Remembered your password?{' '}
            <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
