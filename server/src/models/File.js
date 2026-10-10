import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
  name:        { type: String, required: true },
  path:        { type: String, required: true },
  content:     { type: String, default: '' },
  language:    { type: String, default: 'javascript' },
  isDirectory: { type: Boolean, default: false },
  workspace:   { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
}, { timestamps: true });

export default mongoose.model('File', fileSchema);
