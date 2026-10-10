import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import { getJwtSecret } from '../middleware/auth.middleware.js';
import File from '../models/File.js';
import * as Y from 'yjs';
import ChatMessage from '../models/ChatMessage.js';

const presence = new Map();
export const documents = new Map();
const persistTimers = new Map();
const persistAcks = new Map();
const documentMeta = new Map();
const evictionTimers = new Map();
const chatRate = new Map();
const DOCUMENT_IDLE_MS = 30_000;

export const loadWorkspaceForChat = async (roomId, ack, WorkspaceModel = Workspace) => {
  const workspace = await WorkspaceModel.findOne({ roomId });
  if (!workspace) {
    ack?.({ success: false, error: 'Workspace not found' });
    return null;
  }
  return workspace;
};

export const persistDocument = async (fileId, doc, FileModel = File) => {
  const content = doc.getText(`file:${fileId}`).toString();
  const saved = await FileModel.findByIdAndUpdate(fileId, { content });
  if (!saved) throw new Error(`File not found while persisting ${fileId}`);
  return saved;
};

const touchDocument = (fileId, roomId) => {
  if (roomId) documentMeta.set(fileId, { roomId });
  clearTimeout(evictionTimers.get(fileId));
  evictionTimers.delete(fileId);
};

export const evictDocument = async (fileId, FileModel = File) => {
  clearTimeout(evictionTimers.get(fileId));
  evictionTimers.delete(fileId);
  clearTimeout(persistTimers.get(fileId));
  persistTimers.delete(fileId);
  const callbacks = persistAcks.get(fileId) || [];
  persistAcks.delete(fileId);
  const doc = documents.get(fileId);
  if (doc) {
    try {
      await persistDocument(fileId, doc, FileModel);
      callbacks.forEach((callback) => callback({ success: true }));
    } catch {
      callbacks.forEach((callback) => callback({ success: false, error: 'File not found' }));
    }
    doc.destroy();
    documents.delete(fileId);
  }
  documentMeta.delete(fileId);
};

const scheduleIdleEvict = (fileId) => {
  clearTimeout(evictionTimers.get(fileId));
  evictionTimers.set(fileId, setTimeout(() => {
    evictionTimers.delete(fileId);
    if (persistTimers.has(fileId)) {
      scheduleIdleEvict(fileId);
      return;
    }
    void evictDocument(fileId);
  }, DOCUMENT_IDLE_MS));
};

export const evictRoomDocuments = async (roomId, FileModel = File) => {
  const ids = [...documentMeta.entries()]
    .filter(([, meta]) => meta.roomId === roomId)
    .map(([fileId]) => fileId);
  for (const fileId of ids) await evictDocument(fileId, FileModel);
};

const isMember = (workspace, userId) =>
  workspace.owner.equals(userId) || workspace.members.some((member) => member.equals(userId));

export default function initializeSockets(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const { id } = jwt.verify(token, getJwtSecret());
      const user = await User.findById(id).select('-password');
      if (!user) return next(new Error('User not found'));
      socket.data.user = user;
      next();
    } catch {
      next(new Error('Invalid socket authentication'));
    }
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;

    socket.on('workspace:join', async ({ roomId } = {}, ack) => {
      if (typeof roomId !== 'string' || roomId.length > 100) return ack?.({ success: false, error: 'Invalid workspace' });
      const workspace = await Workspace.findOne({ roomId });
      if (!workspace) return ack?.({ success: false, error: 'Workspace not found' });
      if (!isMember(workspace, user._id)) {
        // Public workspaces are joinable by link: add the user as a member so
        // realtime collaboration, presence and chat all work for them.
        if (!workspace.isPublic) return ack?.({ success: false, error: 'Workspace access denied' });
        workspace.members.push(user._id);
        await workspace.save();
      }

      socket.join(roomId);
      socket.data.roomId = roomId;
      if (!presence.has(roomId)) presence.set(roomId, new Map());
      presence.get(roomId).set(socket.id, {
        userId: user._id.toString(),
        username: user.username,
        color: user.color,
        socketId: socket.id,
        joinedAt: Date.now(),
      });
      io.to(roomId).emit('presence:update', { users: [...presence.get(roomId).values()] });
      if (workspace.aiMessages?.length) socket.emit('ai:history', {
        messages: workspace.aiMessages.map(({ role, content, userId }) => ({ role, content, userId })),
      });
      ack?.({ success: true });
    });

    socket.on('workspace:leave', () => leave(socket, io));

    const inWorkspace = (roomId) => socket.data.roomId === roomId;
    const getDocument = async (fileId, roomId) => {
      let doc = documents.get(fileId);
      if (doc) {
        touchDocument(fileId, roomId);
        return doc;
      }
      const workspace = await Workspace.findOne({ roomId });
      const file = workspace && await File.findOne({ _id: fileId, workspace: workspace._id });
      if (!file || file.isDirectory) return null;
      doc = new Y.Doc();
      doc.getText(`file:${fileId}`).insert(0, file.content || '');
      documents.set(fileId, doc);
      touchDocument(fileId, roomId);
      return doc;
    };

    socket.on('file:yjsSync', async ({ roomId, fileId, stateVector } = {}, ack) => {
      if (!inWorkspace(roomId) || typeof fileId !== 'string') return ack?.({ success: false, error: 'Invalid file' });
      try {
        const doc = await getDocument(fileId, roomId);
        if (!doc) return ack?.({ success: false, error: 'File not found' });
        const vector = Array.isArray(stateVector) && stateVector.length ? new Uint8Array(stateVector) : undefined;
        const update = Y.encodeStateAsUpdate(doc, vector);
        ack?.({ success: true, update: Array.from(update) });
      } catch (error) {
        ack?.({ success: false, error: error.message });
      }
    });

    socket.on('file:yjsUpdate', async ({ roomId, fileId, update } = {}, ack) => {
      if (!inWorkspace(roomId) || typeof fileId !== 'string' || !update) return ack?.({ success: false, error: 'Invalid update' });
      const doc = await getDocument(fileId, roomId);
      if (!doc) return ack?.({ success: false, error: 'File not found' });
      touchDocument(fileId, roomId);
      Y.applyUpdate(doc, new Uint8Array(update));
      clearTimeout(persistTimers.get(fileId));
      if (ack) persistAcks.set(fileId, [...(persistAcks.get(fileId) || []), ack]);
      persistTimers.set(fileId, setTimeout(async () => {
        const current = documents.get(fileId);
        const callbacks = persistAcks.get(fileId) || [];
        try {
          if (current) await persistDocument(fileId, current);
          callbacks.forEach((callback) => callback({ success: true }));
        } catch (error) {
          console.error(`[Socket] failed to persist file ${fileId}:`, error.message);
          callbacks.forEach((callback) => callback({ success: false, error: error.message }));
        } finally {
          persistTimers.delete(fileId);
          persistAcks.delete(fileId);
        }
      }, 750));
      socket.to(roomId).emit('file:yjsUpdate', { fileId, update, socketId: socket.id });
    });
    socket.on('file:yjsFlush', async ({ roomId, fileId } = {}, ack) => {
      if (!inWorkspace(roomId) || typeof fileId !== 'string') return ack?.({ success: false, error: 'Invalid file' });
      const timer = persistTimers.get(fileId);
      clearTimeout(timer);
      persistTimers.delete(fileId);
      const callbacks = persistAcks.get(fileId) || [];
      persistAcks.delete(fileId);
      try {
        const doc = documents.get(fileId);
        if (!doc) {
          const error = { success: false, error: 'File not found' };
          callbacks.forEach((callback) => callback(error));
          return ack?.(error);
        }
        await persistDocument(fileId, doc);
        callbacks.forEach((callback) => callback({ success: true }));
        ack?.({ success: true });
        scheduleIdleEvict(fileId);
      } catch (error) {
        console.error(`[Socket] failed to flush file ${fileId}:`, error.message);
        callbacks.forEach((callback) => callback({ success: false, error: error.message }));
        ack?.({ success: false, error: error.message });
      }
    });
    socket.on('file:create', ({ roomId, file } = {}) => {
      if (inWorkspace(roomId) && file?._id) socket.to(roomId).emit('file:create', { file });
    });
    socket.on('file:delete', ({ roomId, fileId } = {}) => {
      if (inWorkspace(roomId) && typeof fileId === 'string') socket.to(roomId).emit('file:delete', { fileId });
    });
    socket.on('file:rename', ({ roomId, fileId, newName, path } = {}) => {
      if (inWorkspace(roomId) && typeof fileId === 'string' && typeof newName === 'string') socket.to(roomId).emit('file:rename', { fileId, newName, path });
    });
    socket.on('file:language', ({ roomId, fileId, language } = {}) => {
      if (inWorkspace(roomId) && typeof fileId === 'string' && typeof language === 'string') socket.to(roomId).emit('file:language', { fileId, language });
    });

    socket.on('cursor:update', ({ roomId, fileId, position } = {}) => {
      if (inWorkspace(roomId) && fileId && position?.lineNumber && position?.column) socket.to(roomId).emit('cursor:update', {
        fileId, position, user: { username: user.username, color: user.color }, socketId: socket.id,
      });
    });
    socket.on('selection:update', ({ roomId, fileId, selection } = {}) => {
      if (inWorkspace(roomId) && fileId && selection) socket.to(roomId).emit('selection:update', {
        fileId, selection, user: { username: user.username, color: user.color }, socketId: socket.id,
      });
    });

    socket.on('ai:message', async ({ roomId, role, content } = {}) => {
      if (!inWorkspace(roomId) || !['user', 'assistant'].includes(role) || typeof content !== 'string' || !content.trim() || content.length > 12000) return;
      const workspace = await Workspace.findOne({ roomId });
      if (!workspace) return;
      await Workspace.updateOne({ _id: workspace._id }, {
        $push: { aiMessages: { $each: [{ role, content: content.trim(), userId: user._id }], $slice: -100 } },
      });
      socket.to(roomId).emit('ai:message', { role, content: content.trim(), userId: user._id.toString() });
    });
    socket.on('chat:typing:start', ({ roomId } = {}) => {
      if (inWorkspace(roomId)) socket.to(roomId).emit('chat:typing:start', { userId: user._id.toString(), username: user.username });
    });
    socket.on('chat:typing:stop', ({ roomId } = {}) => {
      if (inWorkspace(roomId)) socket.to(roomId).emit('chat:typing:stop', { userId: user._id.toString() });
    });
    socket.on('chat:send', async ({ roomId, content, clientMessageId, replyTo, type = 'text' } = {}, ack) => {
      if (!inWorkspace(roomId)) return ack?.({ success: false, error: 'Workspace access denied' });
      const now = Date.now();
      const recent = chatRate.get(user._id.toString()) || [];
      const allowed = recent.filter((time) => now - time < 60000);
      if (allowed.length >= 60) return ack?.({ success: false, error: 'You are sending messages too quickly' });
      const cleanContent = typeof content === 'string' ? content.trim() : '';
      if (!cleanContent || cleanContent.length > 4000) return ack?.({ success: false, error: 'Message must be between 1 and 4000 characters' });
      chatRate.set(user._id.toString(), [...allowed, now]);
      const workspace = await loadWorkspaceForChat(roomId, ack);
      if (!workspace) return;
      const message = await ChatMessage.create({
        workspace: workspace._id,
        sender: user._id,
        content: cleanContent,
        type: ['text', 'code'].includes(type) ? type : 'text',
        clientMessageId: typeof clientMessageId === 'string' ? clientMessageId.slice(0, 100) : undefined,
        replyTo: replyTo || undefined,
      });
      await message.populate('sender', 'username avatar color');
      const payload = { ...message.toObject(), socketId: socket.id };
      io.to(roomId).emit('chat:message', payload);
      ack?.({ success: true, message: payload });
    });
    socket.on('chat:edit', async ({ roomId, messageId, content } = {}, ack) => {
      if (!inWorkspace(roomId) || typeof content !== 'string' || !content.trim() || content.length > 4000) return ack?.({ success: false, error: 'Invalid message' });
      const workspace = await loadWorkspaceForChat(roomId, ack);
      if (!workspace) return;
      const message = await ChatMessage.findOneAndUpdate({ _id: messageId, workspace: workspace._id, sender: user._id, deletedAt: null }, { content: content.trim(), editedAt: new Date() }, { new: true }).populate('sender', 'username avatar color');
      if (!message) return ack?.({ success: false, error: 'Message not found' });
      io.to(roomId).emit('chat:message:update', message);
      ack?.({ success: true, message });
    });
    socket.on('chat:delete', async ({ roomId, messageId } = {}, ack) => {
      if (!inWorkspace(roomId)) return ack?.({ success: false, error: 'Workspace access denied' });
      const workspace = await loadWorkspaceForChat(roomId, ack);
      if (!workspace) return;
      const message = await ChatMessage.findOneAndUpdate({ _id: messageId, workspace: workspace._id, sender: user._id, deletedAt: null }, { deletedAt: new Date(), deletedBy: user._id }, { new: true }).populate('sender', 'username avatar color');
      if (!message) return ack?.({ success: false, error: 'Message not found' });
      io.to(roomId).emit('chat:message:update', { ...message.toObject(), content: 'This message was deleted.' });
      ack?.({ success: true });
    });
    socket.on('chat:reaction', async ({ roomId, messageId, emoji } = {}, ack) => {
      if (!inWorkspace(roomId) || !['👍', '❤️', '😂', '🚀', '✅'].includes(emoji)) return ack?.({ success: false, error: 'Invalid reaction' });
      const workspace = await loadWorkspaceForChat(roomId, ack);
      if (!workspace) return;
      const message = await ChatMessage.findOne({ _id: messageId, workspace: workspace._id });
      if (!message) return ack?.({ success: false, error: 'Message not found' });
      let reaction = message.reactions.find((item) => item.emoji === emoji);
      if (!reaction) { message.reactions.push({ emoji, users: [user._id] }); }
      else if (reaction.users.some((id) => id.equals(user._id))) reaction.users = reaction.users.filter((id) => !id.equals(user._id));
      else reaction.users.push(user._id);
      message.reactions = message.reactions.filter((item) => item.users.length > 0);
      await message.save();
      io.to(roomId).emit('chat:reaction', { messageId, reactions: message.reactions });
      ack?.({ success: true });
    });
    socket.on('chat:read', ({ roomId, messageId } = {}) => {
      if (inWorkspace(roomId)) socket.to(roomId).emit('chat:read', { userId: user._id.toString(), messageId });
    });
    socket.on('execution:start', ({ roomId } = {}) => {
      if (inWorkspace(roomId)) io.to(roomId).emit('execution:start', { socketId: socket.id });
    });
    socket.on('execution:result', ({ roomId, result } = {}) => {
      if (inWorkspace(roomId) && result) socket.to(roomId).emit('execution:result', { result, socketId: socket.id });
    });
    socket.on('disconnect', () => leave(socket, io));
  });
}

function leave(socket, io) {
  const roomId = socket.data.roomId;
  if (!roomId) return;
  socket.leave(roomId);
  io.to(roomId).emit('cursor:remove', { socketId: socket.id });
  const room = presence.get(roomId);
  if (!room) return;
  room.delete(socket.id);
  if (room.size === 0) presence.delete(roomId);
  else io.to(roomId).emit('presence:update', { users: [...room.values()] });
  delete socket.data.roomId;
}
