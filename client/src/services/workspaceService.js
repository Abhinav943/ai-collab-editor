import api from './api.js';

export const workspaceService = {
  getAll: () => api.get('/workspaces'),
  create: (data) => api.post('/workspaces', data),
  get: (roomId) => api.get(`/workspaces/${roomId}`),
  join: (roomId) => api.post(`/workspaces/${roomId}/join`),
  createFile: (roomId, data) => api.post(`/workspaces/${roomId}/files`, data),
  updateFile: (roomId, fileId, data) => api.put(`/workspaces/${roomId}/files/${fileId}`, data),
  renameFile: (roomId, fileId, data) => api.patch(`/workspaces/${roomId}/files/${fileId}/rename`, data),
  deleteFile: (roomId, fileId) => api.delete(`/workspaces/${roomId}/files/${fileId}`),
  chat: (roomId, params) => api.get(`/workspaces/${roomId}/chat`, { params }),
  searchChat: (roomId, params) => api.get(`/workspaces/${roomId}/chat/search`, { params }),
  editChat: (roomId, messageId, content) => api.patch(`/workspaces/${roomId}/chat/${messageId}`, { content }),
  deleteChat: (roomId, messageId) => api.delete(`/workspaces/${roomId}/chat/${messageId}`),
};
