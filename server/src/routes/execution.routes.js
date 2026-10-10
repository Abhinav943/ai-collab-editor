import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { userRateLimit } from '../middleware/rateLimit.middleware.js';
import { runCode, executionStatus } from '../controllers/execution.controller.js';

const router = express.Router();
router.use(protect);
router.use(userRateLimit);
router.get('/status', executionStatus);
router.post('/', runCode);

export default router;
