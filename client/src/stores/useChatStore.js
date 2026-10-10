import { create } from 'zustand';
import { workspaceService } from '../services/workspaceService.js';

const useChatStore = create((set, get) => ({
  messages: [],
  typingUsers: [],
  unreadCount: 0,
  hasMore: false,
  loading: false,
  error: null,
  active: false,
  fetchMessages: async (roomId, before) => {
    set({ loading: true, error: null });
    try {
      const res = await workspaceService.chat(roomId, { limit: 50, ...(before ? { before } : {}) });
      const { messages, hasMore } = res.data.data;
      set((state) => ({ messages: before ? [...messages, ...state.messages] : messages, hasMore, loading: false }));
    } catch (error) {
      set({ error: error.response?.data?.error?.message || 'Unable to load messages', loading: false });
    }
  },
  addMessage: (message, currentUserId) => set((state) => {
    const existing = state.messages.find((item) => (message._id && item._id === message._id) || (message.clientMessageId && item.clientMessageId === message.clientMessageId));
    if (existing) return { messages: state.messages.map((item) => item.clientMessageId === message.clientMessageId ? { ...message, status: 'sent' } : item) };
    return { messages: [...state.messages, message], unreadCount: state.active || message.sender?._id === currentUserId ? state.unreadCount : state.unreadCount + 1 };
  }),
  updateMessage: (message) => set((state) => ({ messages: state.messages.map((item) => item._id === message._id ? { ...item, ...message } : item) })),
  updateReactions: ({ messageId, reactions }) => set((state) => ({ messages: state.messages.map((item) => item._id === messageId ? { ...item, reactions } : item) })),
  setTyping: (user, typing) => set((state) => ({ typingUsers: typing ? [...state.typingUsers.filter((item) => item.userId !== user.userId), user] : state.typingUsers.filter((item) => item.userId !== user.userId) })),
  markRead: () => set({ active: true, unreadCount: 0 }),
  setActive: (active) => set({ active, unreadCount: active ? 0 : get().unreadCount }),
  clear: () => set({ messages: [], typingUsers: [], unreadCount: 0, hasMore: false, error: null }),
}));

export default useChatStore;
