import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { createWorkspace, getWorkspaces, getWorkspace, joinWorkspace, createFile, updateFile, deleteFile, renameFile } from '../controllers/workspace.controller.js';
import chatRoutes from './chat.routes.js';

const router = express.Router();

router.use(protect);

router.get('/', getWorkspaces);
router.post('/', createWorkspace);
router.get('/:roomId', getWorkspace);
router.post('/:roomId/join', joinWorkspace);
router.post('/:roomId/files', createFile);
router.put('/:roomId/files/:fileId', updateFile);
router.patch('/:roomId/files/:fileId/rename', renameFile);
router.delete('/:roomId/files/:fileId', deleteFile);
router.use('/:roomId/chat', chatRoutes);

export default router;
