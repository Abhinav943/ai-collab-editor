import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Editor from '../components/editor/Editor';
import AIPanel from '../components/ai/AIPanel';
import Sidebar from '../components/explorer/Sidebar';
import Terminal from '../components/terminal/Terminal';
import TeamChat from '../components/chat/TeamChat.jsx';
import { useSocket } from '../hooks/useSocket.js';
import { usePresence } from '../hooks/usePresence.js';
import { workspaceService } from '../services/workspaceService.js';
import useWorkspaceStore from '../stores/useWorkspaceStore.js';
import useAuthStore from '../stores/useAuthStore.js';
import { Share2, Wifi, LogOut, Loader2, Maximize2, Minimize2, PanelLeftClose, PanelLeftOpen, TerminalSquare, Bot, PanelRightClose } from 'lucide-react';
import ResizeHandle from '../components/layout/ResizeHandle.jsx';

const PANEL_DEFAULTS = { sidebar: 232, assistant: 340, terminal: 208 };
const PANEL_LIMITS = { sidebar: [176, 360], assistant: [280, 520], terminal: [120, 480] };

function readPanelState() {
  try {
    return { ...PANEL_DEFAULTS, ...JSON.parse(localStorage.getItem('nexus-panel-state') || '{}') };
  } catch {
    return PANEL_DEFAULTS;
  }
}

function readCollapsedState() {
  try {
    return { sidebar: false, assistant: false, terminal: false, ...JSON.parse(localStorage.getItem('nexus-collapsed-panels') || '{}') };
  } catch {
    return { sidebar: false, assistant: false, terminal: false };
  }
}

export default function WorkspacePage() {
  const { id: roomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { workspace, setWorkspace, setError, error } = useWorkspaceStore();
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [copied, setCopied] = useState(false);
  const [panelSizes, setPanelSizes] = useState(readPanelState);
  const [collapsed, setCollapsed] = useState(readCollapsedState);
  const [maximized, setMaximized] = useState(null);

  const { socket, joined } = useSocket(roomId, user);
  const presentUsers = usePresence(roomId, socket);
  const [assistantTab, setAssistantTab] = useState('ai');

  useEffect(() => {
    localStorage.setItem('nexus-panel-state', JSON.stringify(panelSizes));
  }, [panelSizes]);

  useEffect(() => {
    localStorage.setItem('nexus-collapsed-panels', JSON.stringify(collapsed));
  }, [collapsed]);

  useEffect(() => {
    const handleViewport = () => {
      if (window.innerWidth < 900) setCollapsed(current => ({ ...current, sidebar: true, assistant: true }));
    };
    handleViewport();
    window.addEventListener('resize', handleViewport);
    return () => window.removeEventListener('resize', handleViewport);
  }, []);

  const resizePanel = (panel, delta) => {
    setPanelSizes(current => {
      const [min, max] = PANEL_LIMITS[panel];
      return { ...current, [panel]: Math.min(max, Math.max(min, current[panel] + delta)) };
    });
  };

  const toggleMaximize = (panel) => setMaximized(current => current === panel ? null : panel);
  const panelVisible = (panel) => maximized === null || maximized === panel;
  const columns = [
    collapsed.sidebar ? '44px' : `${panelSizes.sidebar}px`,
    '8px',
    'minmax(0, 1fr)',
    '8px',
    collapsed.assistant ? '44px' : `${panelSizes.assistant}px`,
  ].join(' ');

  // Load workspace data
  const loadWorkspace = async () => {
    setLoadingWorkspace(true);
    setError(null);
    setConnectionStatus('connecting');
    try {
      const res = await workspaceService.get(roomId);
      const { workspace: ws, files } = res.data.data;
      if (!ws?.roomId) throw new Error('The server returned an invalid workspace response');
      setWorkspace(ws, files);
      setConnectionStatus('connected');
    } catch (requestError) {
      const status = requestError.response?.status;
      const apiMessage = requestError.response?.data?.error?.message;
      const message = status === 401
        ? 'Your session has expired. Please sign in again.'
        : status === 403
          ? 'You do not have access to this private workspace.'
          : status === 404
            ? 'Workspace not found. Check the room ID or ask the owner for a new link.'
            : apiMessage || (requestError.request
              ? 'The server could not be reached. Make sure the backend is running on port 5000.'
              : requestError.message) || 'Failed to load workspace';
      setError(message);
      setConnectionStatus('error');
    } finally {
      setLoadingWorkspace(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, [roomId]);

  /*
   * Keep the page mounted while loading so a slow database connection does
   * not look like a missing workspace.
   */
  if (loadingWorkspace) return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="glass-panel p-8 text-center">
        <Loader2 size={24} className="mx-auto mb-3 text-primary animate-spin" />
        <p className="text-text-muted font-mono text-sm">Loading workspace...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="h-screen flex items-center justify-center bg-background">
      <div className="glass-panel p-8 text-center max-w-md">
        <p className="text-red-400 mb-2 font-semibold">Failed to load workspace</p>
        <p className="text-text-muted text-sm mb-5">{error}</p>
        <div className="flex justify-center gap-3">
          <button onClick={loadWorkspace} className="text-primary border border-primary/40 rounded-lg px-4 py-2 text-sm">Retry</button>
          <button onClick={() => navigate('/dashboard')} className="text-text-muted underline px-4 py-2 text-sm">Back to Dashboard</button>
        </div>
      </div>
    </div>
  );

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  const USER_COLORS = ['#06b6d4', '#d946ef', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];

  return (
    <div className="workspace-shell flex h-screen flex-col bg-background overflow-hidden p-3 gap-3 rangoli-grid">
      {/* Top Nav (Floating) */}
      <header className="h-16 glass rounded-2xl flex items-center px-4 sm:px-5 justify-between flex-shrink-0 z-10 border-t-2 border-t-primary/70">
        <div className="flex items-center gap-4">
          <span
            className="font-extrabold text-lg neon-text tracking-widest cursor-pointer"
            onClick={() => navigate('/dashboard')}
          ><span className="text-primary">✦</span> NEXUS</span>
          <div className="h-4 w-px bg-border/60" />
          <span className="text-text text-xs font-mono bg-black/30 px-3 py-1.5 rounded-lg border border-border/40 truncate max-w-48">
            {workspace?.name || roomId}
          </span>
          <div className="flex items-center gap-1.5 text-[10px] font-mono">
            {connectionStatus === 'connected'
              ? <><Wifi size={13} className="text-emerald-300" /><span className="text-emerald-200">ONLINE</span></>
              : <><Loader2 size={13} className="text-primary animate-spin" /><span className="text-primary">SYNCING</span></>
            }
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Presence avatars */}
          <div className="flex items-center -space-x-2">
            {(presentUsers.length > 0 ? presentUsers : [{ username: user?.username }]).slice(0, 5).map((u, i) => (
              <div
                key={i}
                title={u.username}
                className="w-7 h-7 rounded-full border-2 border-background flex items-center justify-center text-[10px] font-bold"
                style={{ background: `${u.color || USER_COLORS[i % USER_COLORS.length]}30`, borderColor: u.color || USER_COLORS[i % USER_COLORS.length], color: u.color || USER_COLORS[i % USER_COLORS.length], zIndex: 10 - i, boxShadow: `0 0 8px ${u.color || USER_COLORS[i % USER_COLORS.length]}50` }}
              >
                {u.username?.[0]?.toUpperCase()}
              </div>
            ))}
          </div>

          <button
            onClick={copyLink}
            className="bg-primary/15 hover:bg-primary/25 text-primary border border-primary/50 px-4 py-2 rounded-lg text-xs font-bold font-mono transition-all hover:shadow-[0_0_12px_rgba(246,183,60,0.25)] flex items-center gap-2"
          >
            <Share2 size={13} />
            {copied ? 'COPIED!' : 'SHARE'}
          </button>

          <button onClick={() => navigate('/dashboard')} aria-label="Leave workspace" title="Leave workspace" className="text-text-muted hover:text-red-400 transition-colors p-1.5">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Main Layout */}
      <div className={`workspace-main flex-1 min-h-0 ${maximized ? 'has-maximized-panel' : ''}`} style={{ gridTemplateColumns: columns, gridTemplateRows: collapsed.terminal ? 'minmax(0, 1fr) 32px' : `minmax(0, 1fr) ${panelSizes.terminal}px` }}>
        {panelVisible('sidebar') && (
          <div className={`workspace-sidebar glass rounded-xl overflow-hidden min-w-0 ${collapsed.sidebar ? 'is-collapsed' : ''}`}>
            {collapsed.sidebar ? (
              <button className="activity-button" onClick={() => setCollapsed(current => ({ ...current, sidebar: false }))} aria-label="Open file explorer" title="Open file explorer"><PanelLeftOpen size={17} /></button>
            ) : <Sidebar roomId={roomId} socket={socket} onCollapse={() => setCollapsed(current => ({ ...current, sidebar: true }))} />}
          </div>
        )}
        {panelVisible('sidebar') && !collapsed.sidebar && <ResizeHandle direction="horizontal" label="Resize file explorer" onResize={delta => resizePanel('sidebar', delta)} style={{ gridColumn: '2', gridRow: '1' }} />}

        {panelVisible('editor') && <div className={`workspace-editor glass rounded-xl overflow-hidden min-w-0 ${maximized === 'editor' ? 'panel-maximized' : ''}`} style={{ gridColumn: '3', gridRow: '1' }}>
          <div className="panel-toolbar">
            <span>EDITOR</span>
            <button onClick={() => toggleMaximize('editor')} aria-label={maximized === 'editor' ? 'Restore editor' : 'Maximize editor'} title={maximized === 'editor' ? 'Restore editor' : 'Maximize editor'}>
              {maximized === 'editor' ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>
          <div className="panel-content">          <Editor roomId={roomId} socket={socket} joined={joined} /></div>
        </div>}

        {panelVisible('assistant') && !collapsed.assistant && <ResizeHandle direction="horizontal" label="Resize AI assistant" onResize={delta => resizePanel('assistant', -delta)} style={{ gridColumn: '4', gridRow: '1' }} />}
        {panelVisible('assistant') && (
          <div className={`workspace-assistant glass rounded-xl overflow-hidden min-w-0 flex flex-col ${collapsed.assistant ? 'is-collapsed' : ''}`} style={{ gridColumn: '5', gridRow: '1' }}>
            {collapsed.assistant ? (
              <button className="activity-button" onClick={() => setCollapsed(current => ({ ...current, assistant: false }))} aria-label="Open AI assistant" title="Open AI assistant"><Bot size={17} /></button>
            ) : (
              <>
          <div className="floating-panel-actions">
            <button onClick={() => setCollapsed(current => ({ ...current, assistant: true }))} aria-label="Collapse AI assistant" title="Collapse AI assistant"><PanelRightClose size={14} /></button>
            <button onClick={() => toggleMaximize('assistant')} aria-label={maximized === 'assistant' ? 'Restore AI assistant' : 'Maximize AI assistant'} title={maximized === 'assistant' ? 'Restore AI assistant' : 'Maximize AI assistant'}>{maximized === 'assistant' ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>
          </div>
          <div className="flex border-b border-border/40 bg-black/20">
            <button onClick={() => setAssistantTab('ai')} aria-selected={assistantTab === 'ai'} className={`flex-1 py-2 text-[10px] font-mono tracking-widest ${assistantTab === 'ai' ? 'text-primary border-b border-primary' : 'text-text-muted'}`}>AI ASSISTANT</button>
            <button onClick={() => setAssistantTab('team')} aria-selected={assistantTab === 'team'} className={`flex-1 py-2 text-[10px] font-mono tracking-widest relative ${assistantTab === 'team' ? 'text-accent border-b border-accent' : 'text-text-muted'}`}>TEAM CHAT</button>
          </div>
          <div className="flex-1 min-h-0 flex flex-col">{assistantTab === 'ai' ? <AIPanel roomId={roomId} socket={socket} /> : <TeamChat roomId={roomId} socket={socket} users={presentUsers} />}</div>
              </>
            )}
          </div>
        )}

        {panelVisible('terminal') && <div className={`workspace-terminal glass rounded-xl overflow-hidden min-h-0 ${maximized === 'terminal' ? 'panel-maximized' : ''}`} style={{ gridColumn: '1 / -1', gridRow: '2' }}>
          <div className="terminal-resize-row">
            {!collapsed.terminal && <ResizeHandle direction="vertical" label="Resize terminal" onResize={delta => resizePanel('terminal', -delta)} />}
            <div className="terminal-title"><TerminalSquare size={14} /> TERMINAL</div>
            <div className="terminal-actions">
              <button onClick={() => setCollapsed(current => ({ ...current, terminal: !current.terminal }))} aria-label={collapsed.terminal ? 'Expand terminal' : 'Collapse terminal'} title={collapsed.terminal ? 'Expand terminal' : 'Collapse terminal'}>{collapsed.terminal ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}</button>
              <button onClick={() => toggleMaximize('terminal')} aria-label={maximized === 'terminal' ? 'Restore terminal' : 'Maximize terminal'} title={maximized === 'terminal' ? 'Restore terminal' : 'Maximize terminal'}>{maximized === 'terminal' ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>
            </div>
          </div>
          {!collapsed.terminal && <div className="h-[calc(100%-2rem)]"><Terminal roomId={roomId} socket={socket} /></div>}
        </div>}
      </div>
    </div>
  );
}
