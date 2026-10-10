import { GoogleGenAI } from '@google/genai';
import { SYSTEM_INSTRUCTION, buildContextPrompt, getActionInstruction } from '../systemInstruction.js';

const stripJsonFence = (value) => value.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
const extractText = (response) => response?.text || '';

export default class GeminiProvider {
  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');
    this.client = new GoogleGenAI({ apiKey });
    this.model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  }

  // temperature/top_p/top_k are deprecated on Gemini 3.x and later, so only
  // send them for older models.
  _config(action, extra = {}) {
    const config = {
      systemInstruction: `${SYSTEM_INSTRUCTION}\n\nCURRENT ACTION\n${getActionInstruction(action)}`,
      maxOutputTokens: 4000,
      ...extra,
    };
    if (!/^gemini-3/i.test(this.model)) config.temperature = 0.2;
    return config;
  }

  // One tiny request to confirm the configured key actually works.
  async probe() {
    try {
      const response = await this.client.models.generateContent({
        model: this.model,
        contents: 'Reply with the single word: pong',
        config: this._config('chat', { maxOutputTokens: 16 }),
      });
      const sample = extractText(response).trim().slice(0, 80);
      return { ok: true, provider: 'gemini', model: this.model, message: `Connected to ${this.model}.`, sample };
    } catch (error) {
      return { ok: false, provider: 'gemini', model: this.model, message: error?.message || 'Gemini request failed.' };
    }
  }

  async _generate(prompt, context = {}, action = 'chat') {
    const response = await this.client.models.generateContent({
      model: this.model,
      contents: `${prompt}${buildContextPrompt(context)}`,
      config: this._config(action),
    });
    return extractText(response);
  }

  async chat(messages, context, action = 'chat') {
    const safeMessages = (messages || [])
      .filter(message => ['user', 'assistant', 'model'].includes(message.role) && typeof message.content === 'string' && message.content.trim())
      .map(message => `${message.role === 'assistant' || message.role === 'model' ? 'Assistant' : 'User'}: ${message.content.slice(0, 12000)}`);
    return { content: await this._generate(`Continue this coding conversation. Respond to the latest user message.\n\n${safeMessages.join('\n\n')}`, context, action) };
  }

  async *streamChat(messages, context, action = 'chat') {
    const safeMessages = (messages || [])
      .filter(message => ['user', 'assistant', 'model'].includes(message.role) && typeof message.content === 'string' && message.content.trim())
      .map(message => `${message.role === 'assistant' || message.role === 'model' ? 'Assistant' : 'User'}: ${message.content.slice(0, 12000)}`);
    const stream = await this.client.models.generateContentStream({
      model: this.model,
      contents: `Continue this coding conversation. Respond to the latest user message.\n\n${safeMessages.join('\n\n')}${buildContextPrompt(context)}`,
      config: this._config(action),
    });
    for await (const chunk of stream) {
      const text = extractText(chunk);
      if (text) yield text;
    }
  }

  async generateCode(prompt, context) {
    const text = await this._generate(`Generate ${context?.language || 'source'} code for this request: ${prompt}`, context, 'generate');
    return { code: text, explanation: `Generated for: "${prompt}"` };
  }

  async explainCode(code, language, context = {}) {
    return { explanation: await this._generate(`Explain this ${language || context.language || 'source'} code. Cover purpose, control flow, complexity, and potential issues.`, { ...context, code, language }, 'explain') };
  }

  async reviewCode(code, language, context = {}) {
    const content = await this._generate(`Review this ${language} code for correctness, bugs, security, performance, maintainability, and edge cases. Return ONLY JSON with this shape: {"issues":[{"severity":"critical|warning|suggestion|info","line":1,"message":"...","category":"..."}],"summary":"..."}.`, { ...context, code, language }, 'review');
    try { return JSON.parse(stripJsonFence(content)); }
    catch { return { issues: [], summary: content }; }
  }

  async fixError(code, error, language, context = {}) {
    const content = await this._generate(`Fix this ${language} code using the supplied error output: ${error}. Return a concise explanation followed by corrected code in a fenced block.`, { ...context, code, language, executionOutput: error }, 'fix');
    try { return JSON.parse(stripJsonFence(content)); }
    catch { return { explanation: content, fixedCode: code, diff: '' }; }
  }

  async generateTests(code, language, framework, context = {}) {
    const tests = await this._generate(`Generate focused ${framework || 'standard'} tests for this ${language} code. Return only test code without markdown fences.`, { ...context, code, language }, 'tests');
    return { tests: tests.replace(/```[\w-]*\n?|```/g, '').trim(), framework: framework || 'standard' };
  }

  async detectBugs(code, language, context = {}) {
    const content = await this._generate(`Find concrete bugs in this ${language} code. Return ONLY JSON array with objects containing line, severity, and message. Return an empty array when no issue is found.`, { ...context, code, language }, 'bugs');
    try { return { bugs: JSON.parse(stripJsonFence(content)) }; }
    catch { return { bugs: [{ line: 1, severity: 'info', message: content }] }; }
  }

  async complete(prefix, suffix, language, context = {}) {
    return { completion: (await this._generate(`Complete the ${language} code at the cursor. Return ONLY the code to insert, with no markdown fences.\nPrefix:\n${prefix.slice(-4000)}\nSuffix:\n${suffix.slice(0, 2000)}`, context)).trim() };
  }
}
