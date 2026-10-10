import Workspace from '../models/Workspace.js';
import File from '../models/File.js';

const isMember = (workspace, userId) =>
  workspace.owner.equals(userId) || workspace.members.some((member) => member.equals(userId));

const findWorkspaceForUser = (roomId, userId) =>
  Workspace.findOne({ roomId }).then(async (workspace) => {
    if (!workspace) return null;
    if (isMember(workspace, userId)) return workspace;
    if (!workspace.isPublic) return false;
    workspace.members.push(userId);
    await workspace.save();
    return workspace;
  });

export const createWorkspace = async (req, res, next) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const language = typeof req.body.language === 'string' ? req.body.language.trim() : '';
    if (!name) return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Workspace name required' } });

    const workspace = await Workspace.create({
      name, language: language || 'javascript', owner: req.user._id, members: [req.user._id],
    });

    // Create a default file
    await File.create({
      name: 'main.js', path: '/main.js', language: 'javascript',
      content: '// Welcome to NEXUS - AI Collab Editor\n// Start coding here...\n\nconsole.log("Hello, World!");\n',
      workspace: workspace._id,
    });

    res.status(201).json({ success: true, data: { workspace } });
  } catch (err) { next(err); }
};

export const getWorkspaces = async (req, res, next) => {
  try {
    const workspaces = await Workspace.find({ members: req.user._id })
      .populate('owner', 'username email color')
      .sort({ updatedAt: -1 });
    res.json({ success: true, data: { workspaces } });
  } catch (err) { next(err); }
};

export const getWorkspace = async (req, res, next) => {
  try {
    const workspace = await findWorkspaceForUser(req.params.roomId, req.user._id);
    if (workspace === false) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'You do not have access to this workspace' } });
    if (!workspace) return res.status(404).json({ success: false, error: { code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found' } });

    await workspace.populate('owner', 'username email color');
    await workspace.populate('members', 'username email color');

    const files = await File.find({ workspace: workspace._id });
    res.json({ success: true, data: { workspace, files } });
  } catch (err) { next(err); }
};

export const joinWorkspace = async (req, res, next) => {
  try {
    const workspace = await Workspace.findOne({ roomId: req.params.roomId });
    if (!workspace) return res.status(404).json({ success: false, error: { code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found' } });
    if (!workspace.isPublic) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Workspace is private' } });

    if (!workspace.members.some((id) => id.equals(req.user._id))) {
      workspace.members.push(req.user._id);
      await workspace.save();
    }
    res.json({ success: true, data: { workspace } });
  } catch (err) { next(err); }
};

export const createFile = async (req, res, next) => {
  try {
    const workspace = await Workspace.findOne({ roomId: req.params.roomId });
    if (!workspace) return res.status(404).json({ success: false, error: { code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found' } });
    if (!isMember(workspace, req.user._id)) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Workspace membership required' } });

    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const path = typeof req.body.path === 'string' ? req.body.path.trim() : '';
    if (!name || !path) return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'File name and path are required' } });
    const file = await File.create({
      name,
      path,
      content: typeof req.body.content === 'string' ? req.body.content : '',
      language: typeof req.body.language === 'string' && req.body.language.trim() ? req.body.language.trim() : 'javascript',
      isDirectory: req.body.isDirectory === true,
      workspace: workspace._id,
    });
    res.status(201).json({ success: true, data: { file } });
  } catch (err) { next(err); }
};

export const updateFile = async (req, res, next) => {
  try {
    const workspace = await Workspace.findOne({ roomId: req.params.roomId });
    if (!workspace) return res.status(404).json({ success: false, error: { code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found' } });
    if (!isMember(workspace, req.user._id)) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Workspace membership required' } });
    const changes = {};
    for (const field of ['name', 'path', 'content', 'language']) {
      if (req.body[field] !== undefined) changes[field] = req.body[field];
    }
    if (changes.name !== undefined && typeof changes.name === 'string') changes.name = changes.name.trim();
    if (changes.path !== undefined && typeof changes.path === 'string') changes.path = changes.path.trim();
    if (changes.name === '' || changes.path === '') {
      return res.status(400).json({ success: false, error: { code: 'INVALID_FILE', message: 'File name and path cannot be empty' } });
    }
    if (changes.content !== undefined && typeof changes.content !== 'string') {
      return res.status(400).json({ success: false, error: { code: 'INVALID_FILE', message: 'File content must be a string' } });
    }
    const file = await File.findOneAndUpdate(
      { _id: req.params.fileId, workspace: workspace._id },
      { $set: changes },
      { new: true, runValidators: true }
    );
    if (!file) return res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } });
    res.json({ success: true, data: { file } });
  } catch (err) { next(err); }
};

export const deleteFile = async (req, res, next) => {
  try {
    const workspace = await Workspace.findOne({ roomId: req.params.roomId });
    if (!workspace) return res.status(404).json({ success: false, error: { code: 'WORKSPACE_NOT_FOUND', message: 'Workspace not found' } });
    if (!isMember(workspace, req.user._id)) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Workspace membership required' } });
    const file = await File.findOneAndDelete({ _id: req.params.fileId, workspace: workspace._id });
    if (!file) return res.status(404).json({ success: false, error: { code: 'FILE_NOT_FOUND', message: 'File not found' } });
    res.json({ success: true, data: {} });
  } catch (err) { next(err); }
};

export const renameFile = async (req, res, next) => {
  req.body = { name: req.body.name, path: req.body.path };
  return updateFile(req, res, next);
};
