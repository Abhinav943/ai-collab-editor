import React, { useState } from 'react';
import { Folder, Search, GitBranch, Settings, Plus, Trash2, PanelLeftClose, RefreshCw, Pencil } from 'lucide-react';
import useWorkspaceStore from '../../stores/useWorkspaceStore.js';
import { workspaceService } from '../../services/workspaceService.js';
import { languageFromFilename, labelForLanguage, resolveFileLanguage, starterCode } from '../../config/languages.js';

function FileIcon({ name, language }) {
  const { label, color } = labelForLanguage(language || languageFromFilename(name));
  return <span className={`text-[9px] font-bold ${color} w-5 text-center flex-shrink-0`}>{label}</span>;
}

function FileItem({ file, roomId, socket }) {
  const { activeFile, setActiveFile, removeFile } = useWorkspaceStore();
  const isActive = activeFile?._id === file._id;
  const deleteFile = async (e) => {
    e.stopPropagation();
    try {
      await workspaceService.deleteFile(roomId, file._id);
      removeFile(file._id);
      socket?.emit('file:delete', { roomId, fileId: file._id });
    } catch {}
  };
  const renameFile = async (e) => {
    e.stopPropagation();
    const name = window.prompt('Rename file', file.name)?.trim();
    if (!name || name === file.name) return;
    try {
      const path = `/${name}`;
      const response = await workspaceService.renameFile(roomId, file._id, { name, path });
      const renamed = response.data.data.file;
      useWorkspaceStore.getState().updateFileMetadata(file._id, renamed);
      socket?.emit('file:rename', { roomId, fileId: file._id, newName: renamed.name, path: renamed.path });
    } catch {}
  };

  return (
    <div
      onClick={() => setActiveFile(file)}
      className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all select-none
        ${isActive ? 'bg-primary/10 border border-primary/20 text-white shadow-[0_0_8px_rgba(6,182,212,0.1)]' : 'hover:bg-white/5 text-text-muted hover:text-text'}`}
    >
      <FileIcon name={file.name} language={resolveFileLanguage(file)} />
      <span className="text-xs font-mono flex-1 truncate">{file.name}</span>
      <button type="button" onClick={renameFile} aria-label={`Rename ${file.name}`} className="opacity-0 group-hover:opacity-100 hover:text-primary transition-all">
        <Pencil size={11} />
      </button>
      <button onClick={deleteFile} className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-all">
        <Trash2 size={11} />
      </button>
    </div>
  );
}

export default function Sidebar({ roomId, socket, onCollapse }) {
  const { files, addFile, setFiles } = useWorkspaceStore();
  const [tab, setTab] = useState('files');
  const [newFileName, setNewFileName] = useState('');
  const [showNewFile, setShowNewFile] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refreshFiles = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      const res = await workspaceService.get(roomId);
      setFiles(res.data.data.files || []);
    } catch { /* keep the existing list if the refresh fails */ }
    finally { setRefreshing(false); }
  };

  const createFile = async (e) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    const language = languageFromFilename(newFileName, 'plaintext');
    try {
      const res = await workspaceService.createFile(roomId, {
        name: newFileName, path: `/${newFileName}`,
        content: starterCode(language), language,
      });
      const file = res.data.data.file;
      addFile(file);
      socket?.emit('file:create', { roomId, file });
      setNewFileName(''); setShowNewFile(false);
    } catch {}
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#17243b] overflow-hidden">
      {/* Tab icons */}
      <div className="flex border-b border-border/40 bg-[#101a2d]">
        {[{ id: 'files', Icon: Folder }, { id: 'search', Icon: Search }, { id: 'git', Icon: GitBranch }].map(({ id, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex-1 py-3 flex justify-center transition-all ${tab === id ? 'text-primary border-b border-primary shadow-[0_2px_10px_rgba(6,182,212,0.2)]' : 'text-text-muted hover:text-primary'}`}>
            <Icon size={16} />
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-2 min-h-0">
        {tab === 'files' && (
          <>
            <div className="flex items-center justify-between px-2 mb-2">
              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Project files</span>
              <div className="flex items-center gap-1">
                <button type="button" onClick={refreshFiles} aria-label="Refresh files" title="Refresh files" className={`text-text-muted hover:text-primary transition-colors ${refreshing ? 'animate-spin' : ''}`}><RefreshCw size={13} /></button>
                <button aria-label="Create file" title="New file" onClick={() => setShowNewFile(true)} className="text-text-muted hover:text-primary transition-colors">
                  <Plus size={14} />
                </button>
                <button aria-label="Collapse file explorer" title="Collapse file explorer" onClick={onCollapse} className="text-text-muted hover:text-primary transition-colors">
                  <PanelLeftClose size={14} />
                </button>
              </div>
            </div>

            {showNewFile && (
              <form onSubmit={createFile} className="px-2 mb-2">
                <input
                  autoFocus
                  value={newFileName}
                  onChange={e => setNewFileName(e.target.value)}
                  onBlur={() => { if (!newFileName) setShowNewFile(false); }}
                  placeholder="filename.js"
                  className="w-full bg-black/40 border border-primary/40 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:border-primary"
                />
              </form>
            )}

            <div className="space-y-0.5">
              {files.length === 0 ? (
                <p className="text-text-muted text-xs text-center py-4 font-mono opacity-50">No files yet</p>
              ) : (
                files.map(file => <FileItem key={file._id} file={file} roomId={roomId} socket={socket} />)
              )}
            </div>
          </>
        )}

        {tab === 'search' && (
          <div className="px-2">
            <input className="w-full bg-black/40 border border-border/50 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:border-primary/60 transition-all" placeholder="Search files..." />
          </div>
        )}

        {tab === 'git' && (
          <div className="px-2 text-xs text-text-muted font-mono space-y-2 py-2">
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]"></span>No uncommitted changes</div>
          </div>
        )}
      </div>

      <div className="border-t border-border/40 p-3 bg-black/20">
        <Settings size={16} className="text-text-muted cursor-pointer hover:text-primary transition-colors hover:drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]" />
      </div>
    </div>
  );
}
