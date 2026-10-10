import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const workspaceSchema = new mongoose.Schema({
  name:     { type: String, required: true, trim: true },
  roomId:   { type: String, default: () => uuidv4(), unique: true },
  owner:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  members:  [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  language: { type: String, default: 'javascript' },
  isPublic: { type: Boolean, default: true },
  aiMessages: [{
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true, maxlength: 12000 },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: Date.now },
  }],
}, { timestamps: true });

export default mongoose.model('Workspace', workspaceSchema);
