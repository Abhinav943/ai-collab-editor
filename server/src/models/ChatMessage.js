import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema({
  workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
  sender:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content:   { type: String, required: true, trim: true, maxlength: 4000 },
  type:      { type: String, enum: ['text', 'code', 'system'], default: 'text' },
  clientMessageId: { type: String, maxlength: 100 },
  replyTo: { type: mongoose.Schema.Types.ObjectId, ref: 'ChatMessage' },
  editedAt: Date,
  deletedAt: Date,
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reactions: [{
    emoji: { type: String, maxlength: 8 },
    users: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  }],
}, { timestamps: true });

chatMessageSchema.index({ workspace: 1, createdAt: -1 });
chatMessageSchema.index({ workspace: 1, sender: 1, createdAt: -1 });
chatMessageSchema.index({ workspace: 1, deletedAt: 1 });
chatMessageSchema.index({ content: 'text' });

export default mongoose.model('ChatMessage', chatMessageSchema);
