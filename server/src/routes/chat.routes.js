import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { listMessages, searchMessages, editMessage, deleteMessage } from '../controllers/chat.controller.js';

const router = express.Router({ mergeParams: true });
router.use(protect);
router.get('/', listMessages);
router.get('/search', searchMessages);
router.patch('/:messageId', editMessage);
router.delete('/:messageId', deleteMessage);
export default router;
