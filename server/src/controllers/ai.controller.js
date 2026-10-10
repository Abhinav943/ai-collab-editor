import * as ai from '../services/ai/AIService.js';

export const chat = async (req, res, next) => {
  try {
    const { message, history = [], messages, context = {}, action = 'chat' } = req.body;
    const normalizedMessages = messages?.length ? messages : [...history, { role: 'user', content: message }];
    if (!message && !messages?.length) return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Message required' } });
    if (!Array.isArray(normalizedMessages) || normalizedMessages.length > 30) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_HISTORY', message: 'Chat history must contain at most 30 messages' } });
    }
    const result = await ai.chat(normalizedMessages, context, action);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const streamChat = async (req, res, next) => {
  try {
    const { message, history = [], messages, context = {}, action = 'chat' } = req.body;
    const normalizedMessages = messages?.length ? messages : [...history, { role: 'user', content: message }];
    if (!message && !messages?.length) return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Message required' } });
    if (!Array.isArray(normalizedMessages) || normalizedMessages.length > 30) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_HISTORY', message: 'Chat history must contain at most 30 messages' } });
    }

    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.flushHeaders?.();
    res.write(`event: status\ndata: ${JSON.stringify({ status: 'thinking' })}\n\n`);
    try {
      for await (const token of ai.streamChat(normalizedMessages, context, action)) {
        res.write(`event: token\ndata: ${JSON.stringify({ token })}\n\n`);
      }
      res.write(`event: done\ndata: ${JSON.stringify({ success: true })}\n\n`);
    } catch (streamError) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: streamError.message || 'AI stream failed' })}\n\n`);
    }
    res.end();
  } catch (err) {
    if (res.headersSent) res.end();
    else next(err);
  }
};

export const generateCode = async (req, res, next) => {
  try {
    const { prompt, context } = req.body;
    if (!prompt) return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Prompt required' } });
    const result = await ai.generateCode(prompt, context);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const explainCode = async (req, res, next) => {
  try {
    const { code, language, context } = req.body;
    if (!code) return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Code required' } });
    const result = await ai.explainCode(code, language, context);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const reviewCode = async (req, res, next) => {
  try {
    const { code, language, context } = req.body;
    if (!code) return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Code required' } });
    const result = await ai.reviewCode(code, language, context);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const fixError = async (req, res, next) => {
  try {
    const { code, error, language, context } = req.body;
    if (!code || !error) return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Code and error required' } });
    const result = await ai.fixError(code, error, language, context);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const generateTests = async (req, res, next) => {
  try {
    const { code, language, framework, context } = req.body;
    if (!code) return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Code required' } });
    const result = await ai.generateTests(code, language, framework, context);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const detectBugs = async (req, res, next) => {
  try {
    const { code, language, context } = req.body;
    if (!code) return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'Code required' } });
    const result = await ai.detectBugs(code, language, context);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const complete = async (req, res, next) => {
  try {
    const { prefix, suffix, language, context } = req.body;
    const result = await ai.complete(prefix || '', suffix || '', language || 'javascript', context);
    res.json({ success: true, data: result });
  } catch (err) { next(err); }
};

export const status = (req, res) => {
  res.json({ success: true, data: ai.getStatus() });
};

export const testConnection = async (req, res, next) => {
  try {
    res.json({ success: true, data: await ai.probe() });
  } catch (err) { next(err); }
};

