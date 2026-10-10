import React, { useState, useRef, useEffect } from 'react';
import { Play, AlertCircle, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { executionService, aiService } from '../../services/aiService.js';
import { workspaceService } from '../../services/workspaceService.js';
import useWorkspaceStore from '../../stores/useWorkspaceStore.js';
import { EXECUTION_LANGUAGES, resolveExecutionLanguage } from '../../config/languages.js';

export default function Terminal({ roomId, socket }) {
  const [activeTab, setActiveTab] = useState('terminal');
  const [output, setOutput] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [stdin, setStdin] = useState('');
  const [toolchains, setToolchains] = useState(null);
  const [checkingTools, setCheckingTools] = useState(false);
  const { activeFile, setActiveFileLanguage, setEditorContext } = useWorkspaceStore();

  const language = resolveExecutionLanguage(activeFile);
  const toolStatus = toolchains?.languages?.[language];
  const unavailable = toolStatus?.available === false;
  const isRemote = toolchains?.provider === 'judge0';

  const loadToolchains = async () => {
    setCheckingTools(true);
    try {
      const res = await executionService.status();
      setToolchains(res.data.data);
    } catch {
      setToolchains(null);
    } finally {
      setCheckingTools(false);
    }
  };

  useEffect(() => { loadToolchains(); }, []);

  // Listen for execution results from other users
  useEffect(() => {
    if (!socket) return undefined;
    const handleExecutionResult = ({ result, socketId }) => {
      if (socketId === socket.id) return;
      appendOutput(result);
    };
    socket.on('execution:result', handleExecutionResult);
    return () => socket.off('execution:result', handleExecutionResult);
  }, [socket]);

  const appendOutput = (result) => {
    const lines = [];
    if (result.stdout) lines.push({ type: 'stdout', text: result.stdout });
    if (result.stderr) lines.push({ type: 'stderr', text: result.stderr });
    if (result.message) lines.push({ type: 'stderr', text: result.message });
    lines.push({ type: result.success ? 'success' : 'error', text: `${result.status} • ${result.executionTimeMs ?? 0}ms` });
    setOutput(prev => [...prev, ...lines]);
    setEditorContext({ executionOutput: [result.stdout, result.stderr, result.message].filter(Boolean).join('\n').slice(-8000) });
  };

  const changeLanguage = async (next) => {
    if (!activeFile?._id || next === language) return;
    setActiveFileLanguage(next);
    socket?.emit('file:language', { roomId, fileId: activeFile._id, language: next });
    try {
      await workspaceService.updateFile(roomId, activeFile._id, { language: next });
    } catch { /* keep the local change even if the server is unreachable */ }
  };

  const runCode = async () => {
    const currentState = useWorkspaceStore.getState();
    const currentFile = currentState.activeFile;
    const currentModel = currentState.editorModel;
    const code = currentModel?.getValue() ?? currentFile?.content;
    if (!code || isRunning) return;
    if (unavailable) {
      setActiveTab('terminal');
      setOutput(prev => [...prev, {
        type: 'stderr',
        text: isRemote
          ? 'Could not reach the code runner (Judge0). Check JUDGE0_URL / JUDGE0_API_KEY in .env and that the service is running, then press the refresh icon.'
          : `${language} is not runnable on this server — its toolchain was not found on PATH. Install it (e.g. g++ for C++) and restart the backend, then press the refresh icon to re-check.`,
      }]);
      return;
    }
    setIsRunning(true);
    setActiveTab('terminal');
    setOutput(prev => [...prev, { type: 'cmd', text: `▶ Running ${activeFile.name} (${language})...` }]);
    socket?.emit('execution:start', { roomId });
    try {
      const res = await executionService.run(code, language, stdin);
      const result = res.data.data;
      appendOutput(result);
      socket?.emit('execution:result', { roomId, result });
    } catch (err) {
      const result = err.response?.data?.data;
      if (result) {
        appendOutput(result);
        return;
      }
      const errMsg = err.response?.data?.error?.message || err.message;
      setOutput(prev => [...prev, { type: 'stderr', text: errMsg }]);
      // Offer an AI fix for the captured error.
      try {
        const fixRes = await aiService.fix(code, errMsg, language);
        setOutput(prev => [...prev, { type: 'ai-fix', text: `AI FIX: ${fixRes.data.data.explanation}` }]);
      } catch { /* AI unavailable — ignore */ }
    } finally { setIsRunning(false); }
  };

  const TABS = ['terminal', 'problems'];

  return (
    <div className="h-full flex flex-col bg-transparent">
      {/* Tab bar */}
      <div className="flex border-b border-border/40 px-2 bg-[#101a2d] flex-shrink-0 items-center">
        <select
          aria-label="Execution language"
          value={language}
          onChange={event => changeLanguage(event.target.value)}
          className="my-1.5 mr-2 rounded border border-border bg-[#0d192c] px-2 py-0.5 text-[11px] font-mono text-text focus:outline-none focus:border-primary"
          disabled={!activeFile}
        >
          {EXECUTION_LANGUAGES.map(item => (
            <option key={item.id} value={item.id}>
              {item.label}{toolchains?.languages?.[item.id]?.available === false ? ' (not installed)' : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={loadToolchains}
          aria-label="Re-check available toolchains"
          title="Re-check available toolchains"
          className="mr-2 text-text-muted hover:text-primary transition-colors"
        >
          <RefreshCw size={12} className={checkingTools ? 'animate-spin' : ''} />
        </button>
        {TABS.map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            aria-selected={activeTab === t}
            className={`px-4 py-2.5 text-[10px] font-mono tracking-widest uppercase transition-all border-b-2 ${activeTab === t ? 'border-primary text-primary' : 'border-transparent text-text-muted hover:text-text'}`}>
            {t}
          </button>
        ))}
        {toolchains?.provider && (
          <span
            className="mr-2 text-[9px] font-mono uppercase tracking-wider text-text-muted border border-border/40 rounded px-1.5 py-0.5"
            title={isRemote ? 'Code runs remotely via Judge0' : 'Code runs locally with this machine\u2019s toolchains'}
          >
            {isRemote ? 'Judge0' : 'Local'}
          </span>
        )}
        {isRemote && toolchains?.reachable === false && (
          <span
            className="ml-1 flex items-center gap-1 text-[10px] font-mono text-amber-300"
            title="Judge0 is configured but did not answer. Check JUDGE0_URL / JUDGE0_API_KEY in .env, then press the refresh icon."
          >
            <AlertCircle size={11} /> Judge0 unreachable
          </span>
        )}
        {unavailable && toolchains?.reachable !== false && (
          <span className="ml-1 flex items-center gap-1 text-[10px] font-mono text-amber-300" title="This language is not available from the code runner">
            <AlertCircle size={11} /> {isRemote ? 'runner unavailable' : `${language} not installed`}
          </span>
        )}
        <div className="flex-1 flex justify-end items-center px-2 gap-2">
          <button onClick={() => setOutput([])} aria-label="Clear terminal output" className="text-[10px] text-text-muted hover:text-text font-mono transition-colors">CLEAR</button>
          <button
            onClick={runCode}
            disabled={isRunning || !activeFile}
            className="flex items-center gap-1.5 text-[11px] font-bold font-mono bg-emerald-500/15 text-emerald-200 border border-emerald-400/40 px-4 py-1.5 rounded-lg hover:bg-emerald-500/25 transition-all disabled:opacity-40"
          >
            {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
            {isRunning ? 'RUNNING' : 'EXECUTE'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-[#0d1526] min-h-0">
        {activeTab === 'terminal' && (
          <div className="p-4 font-mono text-xs space-y-1">
            {output.length === 0 && (
              <div className="text-text-muted opacity-40 text-center py-4">No output yet — execute your code above</div>
            )}
            {output.map((line, i) => (
              <div key={i} className={
                line.type === 'stdout' ? 'text-white' :
                line.type === 'stderr' ? 'text-red-400' :
                line.type === 'cmd' ? 'text-primary' :
                line.type === 'success' ? 'text-emerald-300' :
                line.type === 'error' ? 'text-red-300' :
                line.type === 'ai-fix' ? 'text-yellow-400 bg-yellow-900/20 border border-yellow-500/20 p-2 rounded' :
                'text-text-muted'
              }>{line.text}</div>
            ))}
          </div>
        )}

        {activeTab === 'problems' && (
          <div className="p-4 space-y-2">
            {output.filter(l => l.type === 'stderr').length === 0 ? (
              <div className="flex items-center gap-2 text-green-400 text-xs font-mono">
                <CheckCircle2 size={16} /> No problems detected
              </div>
            ) : (
              output.filter(l => l.type === 'stderr').map((line, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-lg border border-red-500/30 bg-red-900/20">
                  <AlertCircle size={14} className="text-red-400 mt-0.5 flex-shrink-0" />
                  <span className="text-red-400 text-xs font-mono whitespace-pre-wrap">{line.text}</span>
                </div>
              ))
            )}
          </div>
        )}

      </div>

      {/* Stdin */}
      <div className="border-t border-border/40 px-4 py-1.5 bg-black/20 flex-shrink-0">
        <input
          value={stdin}
          onChange={e => setStdin(e.target.value)}
          placeholder="stdin (optional)..."
          className="w-full bg-transparent text-[11px] font-mono text-text-muted focus:outline-none placeholder:opacity-40"
        />
      </div>
    </div>
  );
}
