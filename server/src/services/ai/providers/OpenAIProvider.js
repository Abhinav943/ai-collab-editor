// OpenAI Provider
export default class OpenAIProvider {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.model = process.env.OPENAI_MODEL || 'gpt-4o';
    this.baseUrl = 'https://api.openai.com/v1';
  }

  async _request(messages, systemPrompt) {
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'system', content: systemPrompt }, ...messages],
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });
    if (!res.ok) throw new Error(`OpenAI API error: ${res.status}`);
    const data = await res.json();
    return data.choices[0].message.content;
  }

  async chat(messages, context) {
    const system = `You are NEXUS, an expert AI coding assistant embedded in a collaborative code editor.
Current context:
- Language: ${context?.language || 'unknown'}
- File: ${context?.filename || 'unknown'}
- Selected code: ${context?.selectedCode ? `\n\`\`\`\n${context.selectedCode}\n\`\`\`` : 'none'}
Be concise, technical, and helpful. Format responses in Markdown.`;
    const content = await this._request(messages, system);
    return { content };
  }

  async *streamChat(messages, context) {
    const system = `You are NEXUS, an expert AI coding assistant embedded in a collaborative code editor.
Current context:
- Language: ${context?.language || 'unknown'}
- File: ${context?.fileName || 'unknown'}
- Selected code: ${context?.selectedCode || 'none'}
- Terminal output: ${context?.executionOutput || 'none'}
Be concise, technical, and helpful. Format responses in Markdown.`;
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({ model: this.model, messages: [{ role: 'system', content: system }, ...messages], temperature: 0.3, max_tokens: 2000, stream: true }),
    });
    if (!res.ok || !res.body) throw new Error(`OpenAI API error: ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
        const delta = JSON.parse(line.slice(6)).choices?.[0]?.delta?.content;
        if (delta) yield delta;
      }
    }
  }

  async generateCode(prompt, context) {
    const system = `You are an expert ${context?.language || 'JavaScript'} developer. Generate clean, production-quality code. Return ONLY the code, no explanations.`;
    const code = await this._request([{ role: 'user', content: prompt }], system);
    return { code, explanation: `Generated for: "${prompt}"` };
  }

  async explainCode(code, language) {
    const content = await this._request(
      [{ role: 'user', content: `Explain this ${language} code:\n\`\`\`${language}\n${code}\n\`\`\`` }],
      'You are a code explainer. Explain clearly with sections for: Purpose, How it works, Key concepts.'
    );
    return { explanation: content };
  }

  async reviewCode(code, language) {
    const content = await this._request(
      [{ role: 'user', content: `Review this ${language} code and return a JSON array of issues with shape {severity, line, message, category}:\n\`\`\`${language}\n${code}\n\`\`\`` }],
      'You are a code reviewer. Return ONLY valid JSON. Severity: critical|warning|suggestion|info.'
    );
    try { return { issues: JSON.parse(content), summary: 'Review complete.' }; }
    catch { return { issues: [], summary: content }; }
  }

  async fixError(code, error, language) {
    const msgs = [{ role: 'user', content: `Fix this ${language} code that has error: "${error}"\n\`\`\`${language}\n${code}\n\`\`\`\nReturn JSON: {explanation, fixedCode}` }];
    const content = await this._request(msgs, 'You are a debugging expert. Return ONLY valid JSON.');
    try { return JSON.parse(content); }
    catch { return { explanation: content, fixedCode: code }; }
  }

  async generateTests(code, language, framework) {
    const tests = await this._request(
      [{ role: 'user', content: `Generate ${framework || 'vitest'} tests for this ${language} code:\n\`\`\`${language}\n${code}\n\`\`\`` }],
      `You are a testing expert. Generate comprehensive tests using ${framework || 'vitest'}. Return ONLY code.`
    );
    return { tests, framework: framework || 'vitest' };
  }

  async detectBugs(code, language) {
    const content = await this._request(
      [{ role: 'user', content: `Detect bugs in this ${language} code. Return JSON array [{line, severity, message}]:\n\`\`\`${language}\n${code}\n\`\`\`` }],
      'You are a static analysis expert. Return ONLY valid JSON array.'
    );
    try { return { bugs: JSON.parse(content) }; }
    catch { return { bugs: [] }; }
  }

  async complete(prefix, suffix, language) {
    const content = await this._request(
      [{ role: 'user', content: `Complete this ${language} code. Return ONLY the completion, not the prefix:\n\`\`\`${language}\n${prefix}\n\`\`\`` }],
      'You are a code completion engine. Return ONLY the completion text, no explanations, no code fences.'
    );
    return { completion: content.trim() };
  }

  async probe() {
    try {
      await this._request([{ role: 'user', content: 'Reply with the single word: pong' }], 'You are a connection test. Reply with one word.');
      return { ok: true, provider: 'openai', model: this.model, message: `Connected to ${this.model}.` };
    } catch (error) {
      return { ok: false, provider: 'openai', model: this.model, message: error?.message || 'OpenAI request failed.' };
    }
  }
}
