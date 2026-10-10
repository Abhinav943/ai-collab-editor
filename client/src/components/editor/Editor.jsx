import React, { useRef, useEffect, useCallback, useState } from 'react';
import MonacoEditor from '@monaco-editor/react';
import useWorkspaceStore from '../../stores/useWorkspaceStore.js';
import { aiService } from '../../services/aiService.js';
import { resolveFileLanguage } from '../../config/languages.js';
import * as Y from 'yjs';
import { MonacoBinding } from 'y-monaco';
import { X, Loader2, Check, AlertCircle } from 'lucide-react';

export default function Editor({ roomId, socket, joined }) {
  const editorRef = useRef(null);
  const monacoRef = useRef(null);
  const decorationsRef = useRef(new Map());
  const providerRef = useRef(null);
  const collaborationRef = useRef(null);
  const completionDebounce = useRef(null);
  const { activeFile, updateFileContent, editToApply, clearEditToApply, diagnostics, setEditorContext, setEditorModel } = useWorkspaceStore();
  const [inlineSuggestion, setInlineSuggestion] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved | error
  const [editor, setEditor] = useState(null);

  const language = resolveFileLanguage(activeFile);

  // Mount editor
  const handleMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    setEditor(editor);
    monacoRef.current = monaco;

    // Custom theme
    monaco.editor.defineTheme('nexus-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '8291a8', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'f6b73c' },
        { token: 'string', foreground: '8ee7d2' },
        { token: 'number', foreground: 'f0a6ca' },
        { token: 'function', foreground: 'b8d8ff' },
      ],
      colors: {
        'editor.background': '#111a2d',
        'editor.foreground': '#f7f1e3',
        'editorLineNumber.foreground': '#71809a',
        'editorLineNumber.activeForeground': '#f6b73c',
        'editor.selectionBackground': '#2dd4bf35',
        'editor.lineHighlightBackground': '#22314b80',
        'editorCursor.foreground': '#ffd166',
        'editorGutter.background': '#10192b',
      },
    });
    monaco.editor.setTheme('nexus-dark');

    providerRef.current?.dispose();
    providerRef.current = monaco.languages.registerInlineCompletionsProvider({ pattern: '**' }, {
      provideInlineCompletions: async (model, position) => {
        clearTimeout(completionDebounce.current);
        return new Promise((resolve) => {
          completionDebounce.current = setTimeout(async () => {
            try {
              const prefix = model.getValueInRange({ startLineNumber: 1, startColumn: 1, endLineNumber: position.lineNumber, endColumn: position.column }).slice(-4000);
              const suffix = model.getValueInRange({ startLineNumber: position.lineNumber, startColumn: position.column, endLineNumber: model.getLineCount(), endColumn: model.getLineMaxColumn(model.getLineCount()) }).slice(0, 2000);
              if (prefix.trim().length < 3) return resolve({ items: [] });

              const res = await aiService.complete(prefix, suffix, language, {
                language,
                fileName: activeFile?.name,
                code: model.getValue(),
              });
              const completion = res.data?.data?.completion;
              if (!completion) return resolve({ items: [] });

              resolve({
                items: [{ insertText: completion, range: { startLineNumber: position.lineNumber, startColumn: position.column, endLineNumber: position.lineNumber, endColumn: position.column } }],
              });
            } catch { resolve({ items: [] }); }
          }, 600);
        });
      },
      freeInlineCompletions: () => {},
    });

  }, [language]);

  useEffect(() => () => {
    clearTimeout(completionDebounce.current);
    providerRef.current?.dispose();
    providerRef.current = null;
  }, []);

  useEffect(() => {
    const model = editor?.getModel();
    if (!editor || !model || !socket || !joined || !activeFile?._id) return undefined;

    const doc = new Y.Doc();
    const text = doc.getText(`file:${activeFile._id}`);
    let binding;
    let modelContentDisposable;
    let cancelled = false;

    const sendUpdate = (update, origin) => {
      if (origin === 'remote' || cancelled) return;
      setSaveStatus('saving');
      socket.emit('file:yjsUpdate', { roomId, fileId: activeFile._id, update }, (response) => {
        if (!cancelled) setSaveStatus(response?.success ? 'saved' : 'error');
      });
    };
    const receiveUpdate = ({ fileId, update, socketId }) => {
      if (!cancelled && fileId === activeFile._id && socketId !== socket.id) {
        Y.applyUpdate(doc, new Uint8Array(update), 'remote');
      }
    };
    const observeText = () => updateFileContent(activeFile._id, text.toString());

    // Load the persisted document before creating MonacoBinding. Binding first
    // would publish the editor's starter content and overwrite saved changes.
    socket.emit('file:yjsSync', {
      roomId,
      fileId: activeFile._id,
      stateVector: Array.from(Y.encodeStateVector(doc)),
    }, (response) => {
      if (cancelled) return;
      if (!response?.success) {
        console.error('[Editor] document sync failed:', response?.error);
        setSaveStatus('error');
        return;
      }

      if (response.update?.length) Y.applyUpdate(doc, new Uint8Array(response.update), 'remote');
      binding = new MonacoBinding(text, model, new Set([editor]));
      doc.on('update', sendUpdate);
      text.observe(observeText);
      modelContentDisposable = editor.onDidChangeModelContent(() => {
        updateFileContent(activeFile._id, model.getValue());
      });
      setEditorModel(model);
      collaborationRef.current = { doc, binding, text };
      updateFileContent(activeFile._id, text.toString());
      setSaveStatus('saved');
    });
    socket.on('file:yjsUpdate', receiveUpdate);

    return () => {
      cancelled = true;
      socket.off('file:yjsUpdate', receiveUpdate);
      doc.off('update', sendUpdate);
      text.unobserve(observeText);
      modelContentDisposable?.dispose();
      if (collaborationRef.current?.doc === doc) {
        socket.emit('file:yjsFlush', { roomId, fileId: activeFile._id });
      }
      setEditorModel(null);
      binding?.destroy();
      doc.destroy();
      collaborationRef.current = null;
    };
  }, [activeFile?._id, roomId, socket, joined, editor, updateFileContent]);

  useEffect(() => {
    const collaboration = collaborationRef.current;
    if (!collaboration || !socket || !activeFile?._id) return undefined;
    const flush = (ack) => socket.emit('file:yjsFlush', {
      roomId, fileId: activeFile._id,
    }, ack);
    const onBlur = () => flush((response) => {
      if (response?.success) setSaveStatus('saved');
    });
    window.addEventListener('beforeunload', onBlur);
    editor?.onDidBlurEditorWidget(onBlur);
    return () => window.removeEventListener('beforeunload', onBlur);
  }, [activeFile?._id, roomId, socket, editor]);

  useEffect(() => {
    const collaboration = collaborationRef.current;
    if (!collaboration || !activeFile?._id || editToApply?.fileId !== activeFile._id) return;
    const text = collaboration.doc.getText(`file:${activeFile._id}`);
    collaboration.doc.transact(() => {
      text.delete(0, text.length);
      text.insert(0, editToApply.content);
    }, 'ai');
    clearEditToApply();
  }, [activeFile?._id, editToApply, clearEditToApply]);

  useEffect(() => {
    const model = editorRef.current?.getModel();
    if (!model || !monacoRef.current) return;
    monacoRef.current.editor.setModelMarkers(model, 'nexus-ai', diagnostics
      .filter((item) => Number.isInteger(item.line) && item.line > 0)
      .map((item) => ({
        startLineNumber: item.line,
        startColumn: 1,
        endLineNumber: item.line,
        endColumn: model.getLineMaxColumn(item.line),
        message: item.message,
        severity: item.severity === 'critical' ? monacoRef.current.MarkerSeverity.Error
          : item.severity === 'warning' ? monacoRef.current.MarkerSeverity.Warning
            : monacoRef.current.MarkerSeverity.Info,
      })));
  }, [diagnostics, activeFile?._id]);

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return undefined;
    const domNode = editor.getDomNode();
    if (!domNode) return undefined;
    const observer = new ResizeObserver(() => editor.layout());
    observer.observe(domNode);
    return () => observer.disconnect();
  }, []);

  // Remote cursor decorations
  useEffect(() => {
    if (!socket || !monacoRef.current || !editorRef.current) return;
    const handler = ({ fileId, position, user, socketId }) => {
      if (fileId !== activeFile?._id) return;
      const monaco = monacoRef.current;
      const editor = editorRef.current;
      const className = `remote-cursor-${socket.id.replace(/[^a-zA-Z0-9_-]/g, '')}`;
      let style = document.getElementById(className);
      if (!style) {
        style = document.createElement('style');
        style.id = className;
        style.textContent = `.monaco-editor .${className} { border-left: 2px solid ${user?.color || '#06b6d4'}; }`;
        document.head.appendChild(style);
      }
      const previous = decorationsRef.current.get(socketId) || [];
      const newDecorations = editor.deltaDecorations(previous, [{
        range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column + 1),
        options: {
          className,
          hoverMessage: { value: user?.username || 'User' },
        },
      }]);
      decorationsRef.current.set(socketId, newDecorations);
    };
    const remove = ({ socketId }) => {
      [socketId, `${socketId}:selection`].forEach((key) => {
        const decorations = decorationsRef.current.get(key);
        if (decorations) editorRef.current.deltaDecorations(decorations, []);
        decorationsRef.current.delete(key);
      });
    };
    const selectionHandler = ({ fileId, selection, user, socketId }) => {
      if (fileId !== activeFile?._id || !selection) return;
      const key = `${socketId}:selection`;
      const previous = decorationsRef.current.get(key) || [];
      const next = editorRef.current.deltaDecorations(previous, [{
        range: new monacoRef.current.Range(
          selection.selectionStartLineNumber,
          selection.selectionStartColumn,
          selection.positionLineNumber,
          selection.positionColumn,
        ),
        options: {
          className: 'remote-selection',
          hoverMessage: { value: `${user?.username || 'User'} selection` },
        },
      }]);
      decorationsRef.current.set(key, next);
    };

    socket.on('cursor:update', handler);
    socket.on('selection:update', selectionHandler);
    socket.on('cursor:remove', remove);
    return () => {
      socket.off('cursor:update', handler);
      socket.off('selection:update', selectionHandler);
      socket.off('cursor:remove', remove);
      decorationsRef.current.forEach((decorations) => editorRef.current?.deltaDecorations(decorations, []));
      decorationsRef.current.clear();
    };
  }, [activeFile?._id, socket]);

  // Emit cursor + selection position
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return undefined;
    const emitCursor = (e) => {
      socket?.emit('cursor:update', { roomId, fileId: activeFile?._id, position: e.position });
      const selection = editor.getSelection();
      if (selection) socket?.emit('selection:update', { roomId, fileId: activeFile?._id, selection });
      setEditorContext({
        cursorPosition: e.position,
        selectedCode: selection ? editor.getModel()?.getValueInRange(selection) || '' : '',
      });
    };
    const emitSelection = () => {
      const selection = editor.getSelection();
      if (selection) socket?.emit('selection:update', { roomId, fileId: activeFile?._id, selection });
      setEditorContext({ selectedCode: selection ? editor.getModel()?.getValueInRange(selection) || '' : '' });
    };
    const cursorDisposable = editor.onDidChangeCursorPosition(emitCursor);
    const selectionDisposable = editor.onDidChangeCursorSelection(emitSelection);
    return () => { cursorDisposable?.dispose(); selectionDisposable?.dispose(); };
  }, [activeFile?._id, roomId, socket, setEditorContext]);

  if (!activeFile) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-transparent text-text-muted">
        <div className="text-6xl mb-4 opacity-20">⚡</div>
        <p className="text-lg font-mono">Select a file to begin editing</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-transparent">
      {/* Tab bar */}
      <div className="flex items-center h-9 border-b border-border/40 bg-black/30 px-2 overflow-x-auto">
        <TabBar />
        <div className="ml-auto flex items-center gap-1.5 pl-3 text-[10px] font-mono flex-shrink-0">
          {saveStatus === 'saving' && <><Loader2 size={11} className="animate-spin text-primary" /><span className="text-primary">SAVING</span></>}
          {saveStatus === 'saved' && <><Check size={11} className="text-emerald-300" /><span className="text-emerald-300">SAVED</span></>}
          {saveStatus === 'error' && <><AlertCircle size={11} className="text-red-400" /><span className="text-red-400">NOT SAVED</span></>}
        </div>
      </div>

      <div className="flex-1">
        <MonacoEditor
          key={activeFile._id}
          height="100%"
          language={language}
          defaultValue=""
          theme="nexus-dark"
          onMount={handleMount}
          options={{
            minimap: { enabled: true, scale: 0.7 },
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
            fontLigatures: true,
            wordWrap: 'on',
            padding: { top: 16 },
            lineNumbers: 'on',
            renderLineHighlight: 'line',
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorBlinking: 'smooth',
            cursorSmoothCaretAnimation: 'on',
            bracketPairColorization: { enabled: true },
            inlineSuggest: { enabled: true },
            suggest: { preview: true },
            formatOnPaste: true,
            automaticLayout: true,
          }}
        />
      </div>
    </div>
  );
}

function TabBar() {
  const { openTabs, activeFile, setActiveFile, closeTab } = useWorkspaceStore();

  return (
    <div className="flex items-center gap-0.5">
      {openTabs.map((tab) => (
        <div
          key={tab._id}
          onClick={() => setActiveFile(tab)}
          className={`group flex items-center gap-2 px-3 py-1.5 rounded-t text-xs font-mono cursor-pointer transition-all select-none
            ${activeFile?._id === tab._id
              ? 'bg-[#09090b] text-primary border-t border-x border-primary/40'
              : 'text-text-muted hover:text-text hover:bg-white/5'
            }`}
        >
          <span>{tab.name}</span>
          <button
            onClick={(e) => { e.stopPropagation(); closeTab(tab._id); }}
            className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity text-text-muted ml-1"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
