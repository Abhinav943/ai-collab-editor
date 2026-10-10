import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Cpu, Plus, LogOut, Clock, Users, Globe, Lock, Terminal, Loader2, ArrowRight } from 'lucide-react';
import useAuthStore from '../stores/useAuthStore.js';
import { workspaceService } from '../services/workspaceService.js';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const [workspaces, setWorkspaces] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [joinRoom, setJoinRoom] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await workspaceService.getAll();
        setWorkspaces(res.data.data.workspaces || []);
      } catch { setWorkspaces([]); }
      finally { setIsLoading(false); }
    };
    load();
  }, []);

  const createWorkspace = async (e) => {
    e?.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setCreateError(null);
    try {
      const res = await workspaceService.create({ name: newName });
      const ws = res.data.data.workspace;
      navigate(`/workspace/${ws.roomId}`);
    } catch (err) {
      setCreateError(err.response?.data?.error?.message || 'Could not create the workspace. Is the server running?');
    } finally { setCreating(false); }
  };

  const handleJoin = (e) => {
    e.preventDefault();
    const value = joinRoom.trim();
    if (!value) return;
    const match = value.match(/workspace\/([^/?#\s]+)/);
    navigate(`/workspace/${match ? match[1] : value}`);
  };

  const handleLogout = () => { logout(); navigate('/'); };

  const COLORS = ['from-cyan-500/20 to-primary/10', 'from-purple-500/20 to-accent/10', 'from-green-500/20 to-emerald-500/10', 'from-orange-500/20 to-yellow-500/10'];

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 relative overflow-hidden rangoli-grid">
      {/* Header */}
      <header className="max-w-6xl mx-auto flex items-center justify-between mb-12 glass rounded-2xl px-5 sm:px-6 py-4">
        <div className="flex items-center gap-3">
          <Cpu size={28} className="text-primary drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
          <div>
            <h1 className="text-xl font-black tracking-[0.2em] neon-text">NEXUS</h1>
            <p className="text-[10px] text-text-muted font-mono">नमस्ते, <span className="text-primary">{user?.username}</span></p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 px-5 py-2 rounded-xl text-sm font-bold font-mono transition-all hover:shadow-[0_0_15px_rgba(6,182,212,0.25)]"
          >
            <Plus size={16} /> NEW WORKSPACE
          </button>
          <button onClick={handleLogout} className="p-2 text-text-muted hover:text-red-400 transition-colors">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto space-y-8">
        <section className="max-w-3xl">
          <p className="text-xs font-mono font-semibold uppercase tracking-[0.2em] text-primary mb-3">Collaborative development, focused</p>
          <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-text mb-3">Build together, in real time.</h2>
          <p className="text-base text-text-muted leading-relaxed">Create a shared coding workspace or join your team with a room ID. Your projects, context, and conversations stay in one focused place.</p>
        </section>

        {/* Create / Join */}
        {showCreate && (
          <div className="grid md:grid-cols-2 gap-4">
            <form onSubmit={createWorkspace} className="glass-panel p-6 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-text mb-1">Create a workspace</h3>
                <p className="text-xs text-text-muted">Start a fresh project and invite your collaborators.</p>
              </div>
              <input
                autoFocus value={newName} onChange={e => setNewName(e.target.value)}
                placeholder="my-awesome-project"
                className="w-full rounded-lg px-4 py-3 text-sm font-mono focus:outline-none focus:border-primary transition-colors"
              />
              {createError && (
                <p className="text-xs font-mono text-red-400">{createError}</p>
              )}
              <button type="submit" disabled={creating}
                className="w-full py-3 bg-primary text-slate-950 rounded-lg text-sm font-semibold hover:bg-primary-hover transition-colors disabled:opacity-50">
                {creating ? 'CREATING...' : '⚡ INITIALIZE'}
              </button>
            </form>
            <form onSubmit={handleJoin} className="glass-panel p-6 space-y-4">
              <div>
                <h3 className="text-base font-semibold text-text mb-1">Join a workspace</h3>
                <p className="text-xs text-text-muted">Enter a room ID shared by a teammate.</p>
              </div>
              <input
                value={joinRoom} onChange={e => setJoinRoom(e.target.value)}
                placeholder="room-id or full URL"
                className="w-full rounded-lg px-4 py-3 text-sm font-mono focus:outline-none focus:border-accent transition-colors"
              />
              <button type="submit"
                className="w-full py-3 bg-accent text-slate-950 rounded-lg text-sm font-semibold hover:bg-teal-300 transition-colors">
                JOIN <ArrowRight size={15} className="inline ml-1" />
              </button>
            </form>
          </div>
        )}

        {/* Workspace Grid */}
        <div>
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest font-mono mb-4">Your Workspaces</h2>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={32} className="text-primary animate-spin" />
            </div>
          ) : workspaces.length === 0 ? (
            <div className="glass-panel p-10 sm:p-12 text-center rounded-2xl">
              <div className="w-11 h-11 mx-auto mb-4 rounded-xl border border-border bg-surface flex items-center justify-center">
                <Terminal size={20} className="text-primary" />
              </div>
              <h3 className="text-base font-semibold text-text mb-2">No workspaces yet</h3>
              <p className="text-sm text-text-muted mb-5">Create a workspace to start collaborating with your team.</p>
              <button onClick={() => setShowCreate(true)} className="text-sm font-semibold text-primary hover:text-primary-hover transition-colors">
                Create your first workspace <ArrowRight size={14} className="inline ml-1" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {workspaces.map((ws, i) => (
                <div
                  key={ws._id}
                  onClick={() => navigate(`/workspace/${ws.roomId}`)}
                  className={`glass-panel p-5 rounded-2xl cursor-pointer hover:scale-[1.02] transition-all bg-gradient-to-br ${COLORS[i % COLORS.length]} group`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-8 h-8 bg-black/40 rounded-lg flex items-center justify-center border border-border/40">
                      <Terminal size={16} className="text-primary" />
                    </div>
                    <span className="text-[10px] font-mono text-text-muted">
                      {ws.isPublic ? <Globe size={12} className="inline" /> : <Lock size={12} className="inline" />}
                    </span>
                  </div>
                  <h3 className="font-bold text-base group-hover:text-primary transition-colors mb-2 truncate">{ws.name}</h3>
                  <div className="flex items-center justify-between text-[10px] text-text-muted font-mono">
                    <div className="flex items-center gap-1">
                      <Users size={10} /> {ws.members?.length || 1}
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock size={10} /> {new Date(ws.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="mt-3 text-[10px] font-mono text-text-muted/60 truncate">{ws.roomId}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
