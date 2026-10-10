import React, { useState } from 'react';
import { Cpu, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';
import useAuthStore from '../stores/useAuthStore.js';
import { useNavigate } from 'react-router-dom';

export default function AuthPage() {
  const [mode, setMode] = useState('login'); // login | register
  const [form, setForm] = useState({ username: '', email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const { login, register, isLoading, error, setError } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const result = mode === 'login'
      ? await login(form.email, form.password)
      : await register(form.username, form.email, form.password);
    if (result.success) navigate('/dashboard');
  };

  const change = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden p-6 rangoli-grid">
      <div className="w-full max-w-sm relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-surface rounded-2xl flex items-center justify-center mb-4 border border-border rotate-45">
            <Cpu size={38} className="text-primary -rotate-45" />
          </div>
          <h1 className="text-5xl font-black tracking-widest neon-text">NEXUS</h1>
          <p className="text-text-muted mt-2 font-mono text-[10px] tracking-[0.28em]">AI COLLABORATIVE CODE EDITOR · निर्मितम्</p>
        </div>

        {/* Card */}
        <div className="glass-panel p-8 rounded-2xl">
          {/* Tab */}
          <div className="flex bg-black/30 rounded-xl p-1 mb-6 border border-border/30">
            <button onClick={() => setMode('login')}
              className={`flex-1 py-2 text-xs font-mono font-bold tracking-widest rounded-lg transition-all ${mode === 'login' ? 'bg-primary/20 text-primary shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'text-text-muted hover:text-text'}`}>
              <LogIn size={12} className="inline mr-2" />LOGIN
            </button>
            <button onClick={() => setMode('register')}
              className={`flex-1 py-2 text-xs font-mono font-bold tracking-widest rounded-lg transition-all ${mode === 'register' ? 'bg-accent/20 text-accent shadow-[0_0_10px_rgba(217,70,239,0.2)]' : 'text-text-muted hover:text-text'}`}>
              <UserPlus size={12} className="inline mr-2" />REGISTER
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest font-mono block mb-1.5">Username</label>
                <input
                  type="text" required value={form.username} onChange={change('username')}
                  className="w-full rounded-lg px-4 py-3 text-sm font-mono focus:outline-none focus:border-primary transition-colors"
                  placeholder="your_handle"
                />
              </div>
            )}
            <div>
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest font-mono block mb-1.5">Email</label>
              <input
                type="email" required value={form.email} onChange={change('email')}
                className="w-full rounded-lg px-4 py-3 text-sm font-mono focus:outline-none focus:border-primary transition-colors"
                placeholder="you@nexus.dev"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-text-muted uppercase tracking-widest font-mono block mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'} required value={form.password} onChange={change('password')}
                  className="w-full rounded-lg px-4 py-3 pr-12 text-sm font-mono focus:outline-none focus:border-primary transition-colors"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text transition-colors">
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-500/40 rounded-xl p-3 text-red-400 text-xs font-mono">{error}</div>
            )}

            <button
              type="submit" disabled={isLoading}
              className={`w-full py-3.5 rounded-lg font-semibold tracking-wide text-sm transition-colors disabled:opacity-50
                ${mode === 'login'
                  ? 'bg-primary text-slate-950 hover:bg-primary-hover'
                  : 'bg-accent text-slate-950 hover:bg-teal-300'}`}
            >
              {isLoading ? 'PROCESSING...' : mode === 'login' ? 'AUTHENTICATE' : 'INITIALIZE ACCOUNT'}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
