import { create } from 'zustand';

const useWorkspaceStore = create((set, get) => ({
  workspace: null,
  files: [],
  activeFile: null,
  openTabs: [],
  isLoading: false,
  error: null,
  proposedEdit: null,
  lastAppliedEdit: null,
  editToApply: null,
  diagnostics: [],
  editorModel: null,
  editorContext: { selectedCode: '', cursorPosition: null, executionOutput: '' },

  setWorkspace: (workspace, files) => {
    const defaultFile = files?.[0] || null;
    set({
      workspace,
      files: files || [],
      activeFile: defaultFile,
      openTabs: defaultFile ? [defaultFile] : [],
    });
  },

  setActiveFile: (file) => {
    set((state) => {
      const alreadyOpen = state.openTabs.find((t) => t._id === file._id);
      return {
        activeFile: file,
        openTabs: alreadyOpen ? state.openTabs : [...state.openTabs, file],
      };
    });
  },

  closeTab: (fileId) => {
    set((state) => {
      const newTabs = state.openTabs.filter((t) => t._id !== fileId);
      const newActive =
        state.activeFile?._id === fileId
          ? newTabs[newTabs.length - 1] || null
          : state.activeFile;
      return { openTabs: newTabs, activeFile: newActive };
    });
  },

  updateFileContent: (fileId, content) => {
    set((state) => ({
      files: state.files.map((f) => (f._id === fileId ? { ...f, content } : f)),
      activeFile:
        state.activeFile?._id === fileId
          ? { ...state.activeFile, content }
          : state.activeFile,
      openTabs: state.openTabs.map((t) => (t._id === fileId ? { ...t, content } : t)),
    }));
  },

  setActiveFileLanguage: (language) => {
    set((state) => ({
      files: state.files.map((file) => file._id === state.activeFile?._id ? { ...file, language } : file),
      activeFile: state.activeFile ? { ...state.activeFile, language } : null,
      openTabs: state.openTabs.map((tab) => tab._id === state.activeFile?._id ? { ...tab, language } : tab),
    }));
  },

  addFile: (file) => {
    set((state) => ({ files: [...state.files, file] }));
  },

  setFiles: (files) => set({ files: files || [] }),

  removeFile: (fileId) => {
    set((state) => ({
      files: state.files.filter((f) => f._id !== fileId),
      openTabs: state.openTabs.filter((t) => t._id !== fileId),
      activeFile: state.activeFile?._id === fileId ? null : state.activeFile,
    }));
  },

  updateFileMetadata: (fileId, changes) => {
    set((state) => ({
      files: state.files.map((file) => file._id === fileId ? { ...file, ...changes } : file),
      activeFile: state.activeFile?._id === fileId ? { ...state.activeFile, ...changes } : state.activeFile,
      openTabs: state.openTabs.map((tab) => tab._id === fileId ? { ...tab, ...changes } : tab),
    }));
  },

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  // Apply content straight into a file (synced + persisted via the editor's
  // Yjs binding) while remembering the previous content so it can be undone.
  applyEdit: (fileId, content) => set((state) => {
    const current = state.files.find((file) => file._id === fileId);
    return {
      lastAppliedEdit: { fileId, previous: current ? current.content : '' },
      editToApply: { fileId, content },
    };
  }),
  undoLastEdit: () => set((state) => (state.lastAppliedEdit
    ? {
      editToApply: { fileId: state.lastAppliedEdit.fileId, content: state.lastAppliedEdit.previous },
      lastAppliedEdit: null,
    }
    : {})),
  clearLastAppliedEdit: () => set({ lastAppliedEdit: null }),

  proposeEdit: (fileId, content) => set({ proposedEdit: { fileId, content } }),
  acceptProposedEdit: () => set((state) => ({ editToApply: state.proposedEdit, proposedEdit: null })),
  rejectProposedEdit: () => set({ proposedEdit: null }),
  clearEditToApply: () => set({ editToApply: null }),
  setDiagnostics: (diagnostics) => set({ diagnostics: Array.isArray(diagnostics) ? diagnostics : [] }),
  setEditorContext: (context) => set((state) => ({ editorContext: { ...state.editorContext, ...context } })),
  setEditorModel: (editorModel) => set({ editorModel }),
}));

export default useWorkspaceStore;
