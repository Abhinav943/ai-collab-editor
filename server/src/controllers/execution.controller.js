import { execute, getToolchainStatus, LANGUAGE_CONFIG } from '../services/execution/ExecutionService.js';

export const runCode = async (req, res, next) => {
  try {
    const { code, language, stdin } = req.body;
    if (typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Code required' } });
    }
    if (!Object.hasOwn(LANGUAGE_CONFIG, language)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_LANGUAGE', message: 'Unsupported execution language' } });
    }
    if (stdin !== undefined && typeof stdin !== 'string') {
      return res.status(400).json({ success: false, error: { code: 'INVALID_STDIN', message: 'stdin must be a string' } });
    }

    const result = await execute(code, language, stdin || '');
    console.log(`[execution ${result.executionId}] ${language} ${result.status} in ${result.executionTimeMs}ms`);
    res.status(result.success ? 200 : 422).json({ success: result.success, data: result });
  } catch (err) {
    next(err);
  }
};

export const executionStatus = async (req, res, next) => {
  try {
    res.json({ success: true, data: await getToolchainStatus() });
  } catch (err) { next(err); }
};
