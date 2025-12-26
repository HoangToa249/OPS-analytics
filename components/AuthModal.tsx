import React, { useState } from 'react';
import { X, LogIn, Loader2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

interface AuthModalProps {
  show: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ show, onClose, onSuccess }) => {
  const [email, setEmail] = useState('hoang.toan2409@gmail.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  if (!show) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('[Auth] Attempting login with:', email);
      
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.error('[Auth] Login error:', signInError.message);
        setError(signInError.message);
        return;
      }

      console.log('[Auth] ✅ Login successful!');
      console.log('[Auth] User ID:', data.user?.id);
      
      setEmail('hoang.toan2409@gmail.com');
      setPassword('');
      
      // Wait a bit for session to settle
      await new Promise(r => setTimeout(r, 500));
      
      onClose();
      onSuccess?.();
    } catch (err) {
      console.error('[Auth] Exception:', err);
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('[Auth] Attempting signup with:', email);
      
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (signUpError) {
        console.error('[Auth] Signup error:', signUpError.message);
        setError(signUpError.message);
        return;
      }

      console.log('[Auth] ✅ Signup successful!');
      setError('');
      setEmail('');
      setPassword('');
      
      // Switch to login
      setMode('login');
      setError('Account created! Please login with your credentials.');
    } catch (err) {
      console.error('[Auth] Exception:', err);
      setError(err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    console.log('[Auth] Logging out...');
    await supabase.auth.signOut();
    console.log('[Auth] ✅ Logged out');
    onClose();
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-8 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">
            {mode === 'login' ? '🔐 Login' : '📝 Sign Up'}
          </h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className={`mb-4 p-4 rounded-lg text-sm ${
            error.includes('created') 
              ? 'bg-green-900/30 text-green-300 border border-green-600/30'
              : 'bg-red-900/30 text-red-300 border border-red-600/30'
          }`}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="hoang.toan2409@gmail.com"
              className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
              required
              disabled={loading}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'login' ? 'Toan@1992' : 'Enter password'}
              className="w-full px-4 py-2 bg-slate-700/50 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 transition-all"
              required
              disabled={loading}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 disabled:from-slate-600 disabled:to-slate-700 text-white font-bold py-2 px-4 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {mode === 'login' ? 'Logging in...' : 'Signing up...'}
              </>
            ) : (
              <>
                <LogIn size={18} />
                {mode === 'login' ? 'Login' : 'Sign Up'}
              </>
            )}
          </button>
        </form>

        {/* Toggle Mode */}
        <div className="mt-4 text-center text-slate-400 text-sm">
          {mode === 'login' ? (
            <>
              No account?{' '}
              <button 
                onClick={() => { setMode('signup'); setError(''); }}
                className="text-sky-400 hover:text-sky-300 font-medium transition-colors"
              >
                Sign up here
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button 
                onClick={() => { setMode('login'); setError(''); }}
                className="text-sky-400 hover:text-sky-300 font-medium transition-colors"
              >
                Login here
              </button>
            </>
          )}
        </div>

        {/* Logout Button (if user exists) */}
        <button
          onClick={handleLogout}
          className="w-full mt-4 bg-slate-700 hover:bg-slate-600 text-slate-300 font-medium py-2 px-4 rounded-lg transition-all"
        >
          Or Logout
        </button>
      </div>
    </div>
  );
};
