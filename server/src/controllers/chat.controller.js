import mongoose from 'mongoose';
import Workspace from '../models/Workspace.js';
import ChatMessage from '../models/ChatMessage.js';

const getWorkspace = async (roomId, userId) => {
  if (!mongoose.isValidObjectId(userId)) return null;
  const workspace = await Workspace.findOne({ roomId });
  if (!workspace) return null;
  const member = workspace.owner.equals(userId) || workspace.members.some((id) => id.equals(userId));
  return member ? workspace : false;
};

const serialize = (message) => ({
  ...message.toObject(),
  sender: message.sender && {
    _id: message.sender._id,
    username: message.sender.username,
    avatar: message.sender.avatar,
    color: message.sender.color,
  },
  content: message.deletedAt ? 'This message was deleted.' : message.content,
});

export const listMessages = async (req, res, next) => {
  try {
    const workspace = await getWorkspace(req.params.roomId, req.user._id);
    if (workspace === false) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Workspace access denied' } });
    if (!workspace) return res.status(404).json({ success: false, error: { code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found' } });
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const query = { workspace: workspace._id };
    if (req.query.before && mongoose.isValidObjectId(req.query.before)) query._id = { $lt: req.query.before };
    const messages = await ChatMessage.find(query)
      .sort({ createdAt: -1 }).limit(limit).populate('sender', 'username avatar color').populate('replyTo', 'content sender createdAt');
    res.json({ success: true, data: { messages: messages.reverse().map(serialize), hasMore: messages.length === limit } });
  } catch (err) { next(err); }
};

export const searchMessages = async (req, res, next) => {
  try {
    const workspace = await getWorkspace(req.params.roomId, req.user._id);
    if (workspace === false) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Workspace access denied' } });
    if (!workspace) return res.status(404).json({ success: false, error: { code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found' } });
    const q = String(req.query.q || '').trim();
    if (!q) return res.json({ success: true, data: { messages: [] } });
    const messages = await ChatMessage.find({ workspace: workspace._id, $text: { $search: q } })
      .sort({ createdAt: -1 }).limit(50).populate('sender', 'username avatar color');
    res.json({ success: true, data: { messages: messages.map(serialize) } });
  } catch (err) { next(err); }
};

export const editMessage = async (req, res, next) => {
  try {
    const workspace = await getWorkspace(req.params.roomId, req.user._id);
    if (workspace === false) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Workspace access denied' } });
    if (!workspace) return res.status(404).json({ success: false, error: { code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found' } });
    const content = String(req.body.content || '').trim();
    if (!content || content.length > 4000) return res.status(400).json({ success: false, error: { code: 'INVALID_MESSAGE', message: 'Message must be between 1 and 4000 characters' } });
    const message = await ChatMessage.findOneAndUpdate({ _id: req.params.messageId, workspace: workspace._id, sender: req.user._id, deletedAt: null }, { content, editedAt: new Date() }, { new: true }).populate('sender', 'username avatar color');
    if (!message) return res.status(404).json({ success: false, error: { code: 'MESSAGE_NOT_FOUND', message: 'Message not found' } });
    res.json({ success: true, data: { message: serialize(message) } });
  } catch (err) { next(err); }
};

export const deleteMessage = async (req, res, next) => {
  try {
    const workspace = await getWorkspace(req.params.roomId, req.user._id);
    if (workspace === false) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Workspace access denied' } });
    if (!workspace) return res.status(404).json({ success: false, error: { code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found' } });
    const message = await ChatMessage.findOneAndUpdate({ _id: req.params.messageId, workspace: workspace._id, sender: req.user._id, deletedAt: null }, { deletedAt: new Date(), deletedBy: req.user._id }, { new: true }).populate('sender', 'username avatar color');
    if (!message) return res.status(404).json({ success: false, error: { code: 'MESSAGE_NOT_FOUND', message: 'Message not found' } });
    res.json({ success: true, data: { message: serialize(message) } });
  } catch (err) { next(err); }
};
