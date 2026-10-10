import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { userRateLimit } from '../middleware/rateLimit.middleware.js';
import { chat, streamChat, status, testConnection, generateCode, explainCode, reviewCode, fixError, generateTests, detectBugs, complete } from '../controllers/ai.controller.js';

const router = express.Router();

// Cheap, public: reports which AI provider is active so the UI can show it.
router.get('/status', status);

router.use(protect);
router.use(userRateLimit);

router.post('/test', testConnection);
router.post('/chat', chat);
router.post('/chat/stream', streamChat);
router.post('/generate', generateCode);
router.post('/explain', explainCode);
router.post('/review', reviewCode);
router.post('/fix', fixError);
router.post('/tests', generateTests);
router.post('/bugs', detectBugs);
router.post('/complete', complete);

export default router;
