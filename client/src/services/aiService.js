import api from './api.js';

export const aiService = {
  chat: (messages, context, action = 'chat') => {
    const last = messages[messages.length - 1];
    return api.post('/ai/chat', {
      message: last?.content || '',
      history: messages.slice(0, -1),
      context,
      action,
    });
  },
  generate: (prompt, context) => api.post('/ai/generate', { prompt, context }),
  explain: (code, language, context) => api.post('/ai/explain', { code, language, context }),
  review: (code, language, context) => api.post('/ai/review', { code, language, context }),
  fix: (code, error, language, context) => api.post('/ai/fix', { code, error, language, context }),
  tests: (code, language, framework, context) => api.post('/ai/tests', { code, language, framework, context }),
  bugs: (code, language, context) => api.post('/ai/bugs', { code, language, context }),
  complete: (prefix, suffix, language, context) => api.post('/ai/complete', { prefix, suffix, language, context }),
  status: () => api.get('/ai/status'),
  test: () => api.post('/ai/test'),
  streamChat: async (messages, context, action = 'chat', onToken, onStatus) => {
    const last = messages[messages.length - 1];
    const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/ai/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
      },
      body: JSON.stringify({
        message: last?.content || '',
        history: messages.slice(0, -1),
        context,
        action,
      }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error?.message || 'AI request failed');
    }
    if (!response.body) throw new Error('AI stream is unavailable');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';
      for (const event of events) {
        const data = event.split('\n').find((line) => line.startsWith('data: '))?.slice(6);
        if (!data) continue;
        let parsed;
        try { parsed = JSON.parse(data); } catch { continue; }
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.token) onToken(parsed.token);
        if (parsed.status) onStatus?.(parsed.status);
      }
    }
  },
};

export const executionService = {
  run: (code, language, stdin) => api.post('/execute', { code, language, stdin }),
  status: () => api.get('/execute/status'),
};
