import React, { useState, useRef, useEffect } from 'react';
import { AlertTriangle, Bot, Bug, Check, CheckCheck, Code, FileText, Loader2, RefreshCw, Send, Sparkles, TestTube2, WandSparkles, X } from 'lucide-react';
import { aiService } from '../../services/aiService.js';
import useWorkspaceStore from '../../stores/useWorkspaceStore.js';
import MarkdownMessage from './MarkdownMessage.jsx';

const ACTIONS = [
  { id: 'generate', icon: Sparkles, label: 'Generate', color: 'text-accent', ring: 'hover:border-accent/50', glow: 'rgba(217,70,239,0.15)' },
  { id: 'explain',  icon: Code,     label: 'Explain',  color: 'text-primary', ring: 'hover:border-primary/50', glow: 'rgba(6,182,212,0.15)' },
  { id: 'bugs',     icon: Bug,       label: 'Detect Bugs', color: 'text-red-400', ring: 'hover:border-red-400/50', glow: 'rgba(248,113,113,0.15)' },
  { id: 'review',   icon: CheckCheck,label: 'Review',  color: 'text-green-400', ring: 'hover:border-green-400/50', glow: 'rgba(74,222,128,0.15)' },
  { id: 'tests',    icon: TestTube2, label: 'Gen Tests',color: 'text-yellow-400', ring: 'hover:border-yellow-400/50', glow: 'rgba(250,204,21,0.15)' },
  { id: 'fix',      icon: RefreshCw, label: 'Fix Error',color: 'text-orange-400', ring: 'hover:border-orange-400/50', glow: 'rgba(251,146,60,0.15)' },
  { id: 'refactor', icon: WandSparkles, label: 'Refactor', color: 'text-sky-300', ring: 'hover:border-sky-400/50' },
  { id: 'optimize', icon: WandSparkles, label: 'Optimize', color: 'text-amber-300', ring: 'hover:border-amber-400/50' },
  { id: 'document', icon: FileText, label: 'Document', color: 'text-violet-300', ring: 'hover:border-violet-400/50' },
];

function getRequestError(error, fallback) {
  return error.response?.data?.error?.message || error.response?.data?.message || fallback;
}

function ProviderBadge({ status, testing, onTest }) {
  if (!status) return null;
  const live = status.live;
  const text = live ? `${status.provider}${status.model ? ` \u00b7 ${status.model}` : ''}` : status.provider;
  const cls = status.warning
    ? 'text-red-300 border-red-400/40 bg-red-500/10'
    : live
      ? 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10'
      : 'text-amber-300 border-amber-400/40 bg-amber-500/10';
  const title = status.warning
    || (live
      ? `Live AI via ${status.provider}${status.model ? ` (${status.model})` : ''}`
      : 'Mock mode: replies are canned. Set GEMINI_API_KEY in .env and restart the server for real answers.');
  return (
    <button
      type="button"
      onClick={onTest}
      disabled={testing}
      title={title}
      className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border transition-all hover:brightness-125 disabled:opacity-60 ${cls} truncate max-w-[140px] flex items-center gap-1`}
    >
      {testing && <Loader2 size={9} className="animate-spin" />}
      {text}
    </button>
  );
}

function MessageBlock({ msg, activeFile, onApply }) {
  return (
    <div className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold
        ${msg.role === 'user' ? 'bg-primary/20 border border-primary/30 text-primary shadow-[0_0_8px_rgba(6,182,212,0.2)]' : 'bg-accent/20 border border-accent/30 text-accent shadow-[0_0_8px_rgba(217,70,239,0.2)]'}`}>
        {msg.role === 'user' ? 'U' : <Bot size={12} />}
      </div>
      <div className={`flex-1 max-w-[88%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        <div className={`relative group p-3 rounded-xl text-sm leading-relaxed
          ${msg.role === 'user'
            ? 'bg-primary/10 border border-primary/20 rounded-tr-sm'
            : 'bg-black/40 border border-border/40 rounded-tl-sm'}`}>
          {msg.isLoading ? (
            <div className="flex gap-1 items-center h-4">
              {[0,1,2].map(i => (
                <div key={i} className="w-1.5 h-1.5 rounded-full bg-accent/60 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </div>
          ) : (
            <MarkdownMessage
              content={msg.content}
              fallbackLanguage={activeFile?.language}
              onApply={msg.role === 'assistant' ? onApply : undefined}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function AIPanel({ roomId, socket }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'NEXUS AI online. I have access to your workspace context. Ask me anything — explain code, fix bugs, generate tests, or just chat.' }
  ]);
  const [mode, setMode] = useState('chat'); // chat | generate
  const [generatePrompt, setGeneratePrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [reviewResult, setReviewResult] = useState(null);
  const [bugsResult, setBugsResult] = useState(null);
  const [aiStatus, setAiStatus] = useState(null);
  const [testing, setTesting] = useState(false);
  const messagesEndRef = useRef(null);
  const requestIdRef = useRef(0);
  const {
    activeFile,
    files,
    applyEdit,
    proposeEdit,
    acceptProposedEdit,
    rejectProposedEdit,
    proposedEdit,
    undoLastEdit,
    lastAppliedEdit,
    clearLastAppliedEdit,
    setDiagnostics,
    editorContext,
  } = useWorkspaceStore();

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    let cancelled = false;
    aiService.status()
      .then((res) => { if (!cancelled) setAiStatus(res.data.data); })
      .catch(() => { if (!cancelled) setAiStatus(null); });
    return () => { cancelled = true; };
  }, []);


  useEffect(() => {
    if (!socket) return undefined;
    const onHistory = ({ messages: history }) => {
      if (Array.isArray(history) && history.length) setMessages(history);
    };
    const onMessage = (message) => setMessages((current) => [...current, message]);
    socket.on('ai:history', onHistory);
    socket.on('ai:message', onMessage);
    return () => {
      socket.off('ai:history', onHistory);
      socket.off('ai:message', onMessage);
    };
  }, [socket]);

  const getContext = () => ({
    language: activeFile?.language || 'javascript',
    fileName: activeFile?.name,
    code: activeFile?.content || '',
    selectedCode: editorContext.selectedCode,
    cursorPosition: editorContext.cursorPosition,
    executionOutput: editorContext.executionOutput,
    workspaceContext: files.filter((file) => file._id !== activeFile?._id && (
      !input.match(/@([^\s]+)/g) || input.match(/@([^\s]+)/g).some((mention) => mention.slice(1) === file.name)
    )).slice(0, 8).map((file) => ({
      fileName: file.name,
      code: file.content?.slice(0, 4000) || '',
    })),
  });

  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    const userMsg = { role: 'user', content: input };
    socket?.emit('ai:message', { roomId, ...userMsg });
    setMessages(prev => [...prev, userMsg, { role: 'assistant', isLoading: true, content: '' }]);
    setInput('');
    setIsLoading(true);
    const requestId = ++requestIdRef.current;
    let assistantContent = '';
    let receivedToken = false;
    try {
      if (requestId !== requestIdRef.current) return;
      await aiService.streamChat([...messages, userMsg], getContext(), 'chat', (token) => {
        if (requestId !== requestIdRef.current) return;
        assistantContent += token;
        receivedToken = true;
        setMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, isLoading: false, content: `${receivedToken && last.content === 'Thinking…' ? '' : last.content || ''}${token}` };
          return next;
        });
      }, (status) => {
        setMessages(prev => {
          const next = [...prev];
          const last = next[next.length - 1];
          next[next.length - 1] = { ...last, content: status === 'thinking' ? 'Thinking…' : last.content };
          return next;
        });
      });
      socket?.emit('ai:message', { roomId, role: 'assistant', content: assistantContent });
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: `⚠️ ${getRequestError(error, 'AI request failed. Check server connection.')}` }]);
    } finally { setIsLoading(false); }
  };

  const stopGeneration = () => {
    requestIdRef.current += 1;
    setIsLoading(false);
    setMessages(prev => prev[prev.length - 1]?.isLoading ? prev.slice(0, -1) : prev);
  };

  const notice = (content) => setMessages(prev => [...prev, { role: 'assistant', content }]);

  const extractCodeBlock = (markdown) => {
    const match = String(markdown || '').match(/```[^\n]*\n([\s\S]*?)```/);
    return match ? match[1].replace(/\n$/, '') : null;
  };
  const stripCodeBlocks = (markdown) => String(markdown || '').replace(/```[^\n]*\n[\s\S]*?```/g, '').trim();

  // Write generated code straight into the open file instead of only chatting it.
  const applyToFile = (code, label) => {
    if (!activeFile?._id || typeof code !== 'string' || !code.trim()) return false;
    applyEdit(activeFile._id, code);
    notice(`Applied to **${activeFile.name}**${label ? ` (${label})` : ''}. Use **Undo** below if that wasn't what you wanted.`);
    return true;
  };

  const runConnectionTest = async () => {
    if (testing) return;
    setTesting(true);
    try {
      const res = await aiService.test();
      const result = res.data.data || {};
      notice(result.ok
        ? `**Connection OK.** ${result.message}${result.sample ? `\n\n> ${result.sample}` : ''}`
        : `**Connection failed.** ${result.message}`);
      const refreshed = await aiService.status();
      setAiStatus(refreshed.data.data);
    } catch (error) {
      notice(`\u26a0\ufe0f ${getRequestError(error, 'Connection test failed.')}`);
    } finally { setTesting(false); }
  };

  const runAction = async (actionId) => {
    if (isLoading) return;
    if (actionId === 'generate') { setMode('generate'); return; }
    if (!activeFile) { notice('Open a file first — these actions run against the file in the editor.'); return; }
    const code = activeFile.content || '';
    if (!code.trim()) { notice(`**${activeFile.name}** is empty. Add some code, then run this action.`); return; }
    const lang = activeFile.language || 'javascript';
    setIsLoading(true);
    setReviewResult(null); setBugsResult(null);

    try {
      if (actionId === 'explain') {
        const res = await aiService.explain(code, lang, getContext());
        notice(res.data.data.explanation);
      } else if (actionId === 'review') {
        const res = await aiService.review(code, lang, getContext());
        const data = res.data.data || {};
        const issues = Array.isArray(data.issues) ? data.issues : [];
        setReviewResult({ ...data, issues });
        setDiagnostics(issues);
        setMode('review');
      } else if (actionId === 'bugs') {
        const res = await aiService.bugs(code, lang, getContext());
        const bugs = Array.isArray(res.data.data?.bugs) ? res.data.data.bugs : [];
        setBugsResult(bugs);
        setDiagnostics(bugs);
        setMode('bugs');
      } else if (actionId === 'tests') {
        const res = await aiService.tests(code, lang, undefined, getContext());
        notice(`**Generated tests:**\n\`\`\`${lang}\n${res.data.data.tests}\n\`\`\``);
      } else if (actionId === 'fix') {
        const errorText = (editorContext.executionOutput || '').trim()
          || 'No runtime output captured yet. Review the current file and fix the most likely errors.';
        setMessages(prev => [...prev, { role: 'user', content: 'Fix the errors in my current file.' }]);
        const res = await aiService.fix(code, errorText, lang, getContext());
        const fix = res.data.data || {};
        if (fix.explanation) notice(fix.explanation);
        if (typeof fix.fixedCode === 'string' && fix.fixedCode.trim() && fix.fixedCode !== code) {
          applyToFile(fix.fixedCode, 'fix applied');
        } else if (!fix.explanation) {
          notice(fix.fixedCode || 'No fix produced.');
        }
      } else if (['refactor', 'optimize', 'document'].includes(actionId)) {
        const prompt = actionId === 'refactor'
          ? 'Refactor this code while preserving behavior. Improve readability, maintainability, duplication, naming, and error handling. Include the complete revised code.'
          : actionId === 'optimize'
            ? 'Improve this code for performance while preserving behavior. Identify bottlenecks, explain tradeoffs, and include the complete revised code.'
            : 'Document this code for another developer. Explain its purpose, public API, control flow, assumptions, and usage. Include useful comments only where they clarify non-obvious behavior.';
        setMessages(prev => [...prev, { role: 'user', content: prompt }]);
        const res = await aiService.chat([...messages, { role: 'user', content: prompt }], getContext(), actionId);
        const reply = res.data.data.content || '';
        const extracted = extractCodeBlock(reply);
        const prose = stripCodeBlocks(reply);
        if (extracted && ['refactor', 'optimize'].includes(actionId)) {
          if (prose) notice(prose);
          applyToFile(extracted, actionId);
        } else {
          notice(reply);
        }
      }
      if (actionId !== 'review' && actionId !== 'bugs') setMode('chat');
    } catch (error) {
      notice(`⚠️ ${getRequestError(error, 'AI action failed.')}`);
    } finally { setIsLoading(false); }
  };

  const runGenerate = async (e) => {
    e?.preventDefault();
    if (!generatePrompt.trim() || isLoading) return;
    setIsLoading(true);
    try {
      setMessages(prev => [...prev, { role: 'user', content: generatePrompt }]);
      const res = await aiService.generate(generatePrompt, getContext());
      const { code } = res.data.data;
      setMode('chat'); setGeneratePrompt('');
      if (typeof code === 'string' && code.trim() && activeFile?._id) {
        proposeEdit(activeFile._id, code);
        notice(`Generated code for **${activeFile.name}**. Review the proposed change below, then accept or reject it.`);
      } else {
        notice('The model returned no code to review.');
      }
    } catch (error) { setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${getRequestError(error, 'Generation failed.')}` }]); }
    finally { setIsLoading(false); }
  };

  const acceptGeneratedEdit = () => {
    if (!proposedEdit || proposedEdit.fileId !== activeFile?._id) {
      rejectProposedEdit();
      notice('The generated change belongs to another file and was discarded.');
      return;
    }
    acceptProposedEdit();
    notice(`Accepted generated changes for **${activeFile.name}**.`);
  };

  const rejectGeneratedEdit = () => {
    if (!proposedEdit) return;
    rejectProposedEdit();
    notice(`Rejected generated changes for **${activeFile?.name || 'the file'}**.`);
  };

  const SEVERITY_COLORS = { critical: 'text-red-400 border-red-500/30 bg-red-900/20', warning: 'text-yellow-400 border-yellow-500/30 bg-yellow-900/20', suggestion: 'text-blue-400 border-blue-500/30 bg-blue-900/20', info: 'text-green-400 border-green-500/30 bg-green-900/20' };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-transparent overflow-hidden">
      {/* Header */}
      <div className="h-10 border-b border-border/40 flex items-center px-3 gap-2 bg-black/20 flex-shrink-0">
        <Bot size={15} className="text-accent" />
        <span className="font-bold tracking-widest text-accent text-xs">AI NEXUS</span>
        <ProviderBadge status={aiStatus} testing={testing} onTest={runConnectionTest} />
        {activeFile && <span className="text-[10px] text-text-muted font-mono ml-auto truncate max-w-[40%] bg-black/30 px-2 py-0.5 rounded border border-border/40">{activeFile.name}</span>}
      </div>

      {/* Quick Actions — compact icon row (hover for the label) */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/40 bg-black/10 flex-shrink-0 overflow-x-auto">
        {ACTIONS.map(({ id, icon: Icon, label, color }) => (
          <button
            key={id}
            type="button"
            onClick={() => runAction(id)}
            disabled={isLoading && id !== 'generate'}
            aria-label={label}
            title={label}
            className={`flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-black/30 border border-border/30 transition-all ${color} hover:border-current hover:bg-black/50 disabled:opacity-40`}
          >
            <Icon size={15} />
          </button>
        ))}
      </div>

      {/* Mode toggle */}
      <div className="flex border-b border-border/40 bg-black/10 flex-shrink-0">
        {['chat', 'review', 'bugs'].map(m => (
          <button key={m} onClick={() => setMode(m)}
            className={`flex-1 py-1.5 text-[10px] font-mono tracking-widest uppercase transition-all ${mode === m ? 'text-primary border-b border-primary' : 'text-text-muted hover:text-text'}`}>
            {m}
          </button>
        ))}
      </div>

      {aiStatus && !aiStatus.live && (
        <div className="mx-2 mt-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-1.5 text-[10px] font-mono text-amber-200 flex items-start gap-1.5 flex-shrink-0">
          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />
          <span>{aiStatus.warning || 'Mock mode — replies are canned. Add GEMINI_API_KEY to .env and restart the server for real answers.'}</span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 min-h-0">
        {mode === 'chat' && (
          <>
            {proposedEdit && (
              <div className="rounded-xl border border-accent/50 bg-accent/5 p-3 shadow-[0_0_16px_rgba(217,70,239,0.12)]">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-accent">Generated change</p>
                    <p className="text-[10px] text-text-muted font-mono">
                      {files.find((file) => file._id === proposedEdit.fileId)?.name || 'Another file'}
                    </p>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider text-amber-300">Review required</span>
                </div>
                <pre className="max-h-56 overflow-auto rounded-lg border border-border/40 bg-black/40 p-3 text-[11px] leading-relaxed text-text whitespace-pre-wrap">
                  {proposedEdit.content}
                </pre>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={acceptGeneratedEdit}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-300 border border-emerald-400/40 hover:bg-emerald-500/25"
                  >
                    <Check size={13} /> Accept and apply
                  </button>
                  <button
                    type="button"
                    onClick={rejectGeneratedEdit}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300 border border-red-400/30 hover:bg-red-500/20"
                  >
                    <X size={13} /> Reject
                  </button>
                </div>
              </div>
            )}
            {messages.map((msg, i) => (
              <MessageBlock
                key={i}
                msg={msg}
                activeFile={activeFile}
                onApply={(code) => applyToFile(code, 'from chat')}
              />
            ))}
            <div ref={messagesEndRef} />
            {activeFile && lastAppliedEdit && lastAppliedEdit.fileId === activeFile._id && (
              <div className="sticky bottom-0 rounded-lg border border-emerald-400/40 bg-[#111e32] p-3 text-xs font-mono">
                <p className="mb-2 text-emerald-300">Changes written to {activeFile.name}.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={undoLastEdit} className="rounded bg-white/5 px-3 py-1.5 text-text-muted hover:text-text">Undo</button>
                  <button type="button" onClick={clearLastAppliedEdit} className="rounded bg-emerald-500/15 px-3 py-1.5 text-emerald-300">Keep</button>
                </div>
              </div>
            )}
          </>
        )}

        {mode === 'generate' && (
          <div className="space-y-3">
            <p className="text-xs text-text-muted font-mono">Describe what code to generate:</p>
            <form onSubmit={runGenerate} className="space-y-3">
              <textarea
                rows={4}
                className="w-full bg-black/40 border border-border/50 rounded-lg p-3 text-sm font-mono focus:outline-none focus:border-accent/60 transition-all resize-none"
                placeholder="Create a REST API endpoint for user authentication..."
                value={generatePrompt}
                onChange={e => setGeneratePrompt(e.target.value)}
              />
              <div className="flex gap-2">
                <button type="submit" disabled={isLoading}
                  className="flex-1 bg-accent/20 text-accent border border-accent/40 py-2 rounded-lg text-sm font-bold hover:bg-accent/30 transition-all disabled:opacity-50">
                  {isLoading ? 'Generating...' : '⚡ Generate'}
                </button>
                <button type="button" onClick={() => { setMode('chat'); setMessages(prev => prev); }}
                  className="px-3 bg-black/30 border border-border/40 rounded-lg text-text-muted hover:text-text">
                  <X size={16} />
                </button>
              </div>
            </form>
          </div>
        )}

        {mode === 'review' && reviewResult && (
          <div className="space-y-2">
            <p className="text-xs text-text-muted font-mono mb-3">{reviewResult.summary}</p>
            {reviewResult.issues?.map((issue, i) => (
              <div key={i} className={`p-3 rounded-lg border text-xs font-mono ${SEVERITY_COLORS[issue.severity] || SEVERITY_COLORS.info}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold uppercase tracking-wider">{issue.severity}</span>
                  <span className="opacity-60">line {issue.line}</span>
                </div>
                <p>{issue.message}</p>
              </div>
            ))}
          </div>
        )}

        {mode === 'bugs' && bugsResult && (
          <div className="space-y-2">
            {bugsResult.map((bug, i) => (
              <div key={i} className={`p-3 rounded-lg border text-xs font-mono ${SEVERITY_COLORS[bug.severity] || SEVERITY_COLORS.info}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold uppercase">{bug.severity}</span>
                  <span className="opacity-60">line {bug.line}</span>
                </div>
                <p>{bug.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chat Input */}
      {mode === 'chat' && (
        <div className="p-3 border-t border-border/40 bg-black/20 flex-shrink-0">
          <form onSubmit={sendMessage} className="composer relative">
            <textarea
              rows={2}
              placeholder="Ask NEXUS anything..."
              aria-label="Ask NEXUS anything"
              className="w-full bg-black/40 border border-border/50 rounded-xl pl-3 pr-12 py-2.5 text-sm font-mono focus:outline-none focus:border-primary/60 focus:shadow-[0_0_10px_rgba(6,182,212,0.15)] transition-all resize-none"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage(event);
                }
              }}
              disabled={isLoading}
            />
            <button type={isLoading ? 'button' : 'submit'} onClick={isLoading ? stopGeneration : undefined} disabled={!isLoading && !input.trim()}
              aria-label={isLoading ? 'Stop generation' : 'Send message'} title={isLoading ? 'Stop generation' : 'Send message'}
              className="absolute right-2 p-1.5 text-primary hover:bg-primary/20 rounded-lg transition-colors disabled:opacity-40">
              {isLoading ? <X size={16} /> : <Send size={16} />}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
