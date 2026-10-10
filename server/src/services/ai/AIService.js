// AI provider abstraction layer.
//
// Selection rules:
//   - AI_PROVIDER=disabled            -> AI off
//   - AI_PROVIDER=gemini | openai     -> that provider (must have a key)
//   - AI_PROVIDER=mock | auto | unset -> use a real provider if a key is
//     configured, otherwise mock. This means setting GEMINI_API_KEY alone is
//     enough to get real answers; you do not also have to flip AI_PROVIDER.

import MockProvider from './providers/MockProvider.js';
import OpenAIProvider from './providers/OpenAIProvider.js';
import GeminiProvider from './providers/GeminiProvider.js';
import UnavailableProvider from './providers/UnavailableProvider.js';

const GEMINI_KEY_HINT = 'Create one at https://aistudio.google.com/apikey.';

const usableKey = (value) =>
  typeof value === 'string' && value.trim().length > 0 && !/^replace(-me)?$/i.test(value.trim());

// The Gemini SDK accepts either name; GOOGLE_API_KEY wins when both are set.
const geminiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const openaiKey = () => process.env.OPENAI_API_KEY;

const resolveProviderName = () => {
  const explicit = (process.env.AI_PROVIDER || '').trim().toLowerCase();
  if (explicit === 'disabled') return 'disabled';
  if (explicit === 'gemini' || explicit === 'openai') return explicit;
  if (usableKey(geminiKey())) return 'gemini';
  if (usableKey(openaiKey())) return 'openai';
  return 'mock';
};

export const buildProvider = (name) => {
  switch (name) {
    case 'openai': return new OpenAIProvider();
    case 'gemini': return new GeminiProvider();
    // Explicit gemini/openai with no key sets activeName to 'unavailable'.
    // Route that to UnavailableProvider so status and chat agree, instead of
    // silently answering with MockProvider via the default branch.
    case 'disabled':
    case 'unavailable': return new UnavailableProvider();
    default: return new MockProvider();
  }
};

const modelFor = (name) => (
  name === 'gemini' ? (process.env.GEMINI_MODEL || 'gemini-2.5-flash')
    : name === 'openai' ? (process.env.OPENAI_MODEL || 'gpt-4o')
      : null
);

let activeName = resolveProviderName();
let warning = null;

// An explicit gemini/openai choice without a key cannot work — say so clearly.
if (activeName === 'gemini' && !usableKey(geminiKey())) {
  warning = `AI_PROVIDER=gemini but GEMINI_API_KEY is not set. ${GEMINI_KEY_HINT}`;
  activeName = 'unavailable';
} else if (activeName === 'openai' && !usableKey(openaiKey())) {
  warning = 'AI_PROVIDER=openai but OPENAI_API_KEY is not set.';
  activeName = 'unavailable';
}

let provider;
try {
  provider = buildProvider(activeName);
} catch (error) {
  warning = error.message;
  provider = new UnavailableProvider();
  activeName = 'unavailable';
}

const model = modelFor(activeName);
console.log(`[AI] Provider: ${activeName}${model ? ` (model: ${model})` : ''}`);
if (warning) console.warn(`[AI] ${warning}`);
if (activeName === 'mock') {
  console.log('[AI] Mock mode — set GEMINI_API_KEY (or OPENAI_API_KEY) in .env and restart the server for real answers.');
}

// Makes one small request to the provider so the UI can report whether the
// configured credentials actually work — far more reliable than guessing from
// the key's shape.
export const probe = () => (
  typeof provider.probe === 'function'
    ? provider.probe()
    : Promise.resolve({ ok: false, message: 'The active provider does not support connection tests.' })
);

export const getStatus = () => ({
  provider: activeName,
  live: activeName === 'gemini' || activeName === 'openai',
  model,
  warning,
});

// Wrap provider calls so a provider failure (bad key, quota, network) surfaces
// a readable message to the client instead of a generic 500.
const withProviderErrors = (fn) => async (...args) => {
  try {
    return await fn(...args);
  } catch (error) {
    const wrapped = new Error(error?.message || 'The AI provider request failed');
    wrapped.status = 502;
    wrapped.code = 'AI_PROVIDER_ERROR';
    throw wrapped;
  }
};

export const chat = withProviderErrors((messages, context, action = 'chat') => provider.chat(messages, context, action));
export const streamChat = (messages, context, action = 'chat') => provider.streamChat
  ? provider.streamChat(messages, context, action)
  : (async function* fallback() {
    const result = await provider.chat(messages, context, action);
    for (let index = 0; index < result.content.length; index += 24) yield result.content.slice(index, index + 24);
  }());
export const generateCode = withProviderErrors((prompt, context) => provider.generateCode(prompt, context));
export const explainCode = withProviderErrors((code, language, context) => provider.explainCode(code, language, context));
export const reviewCode = withProviderErrors((code, language, context) => provider.reviewCode(code, language, context));
export const fixError = withProviderErrors((code, error, language, context) => provider.fixError(code, error, language, context));
export const generateTests = withProviderErrors((code, language, framework, context) => provider.generateTests(code, language, framework, context));
export const detectBugs = withProviderErrors((code, language, context) => provider.detectBugs(code, language, context));
export const complete = withProviderErrors((prefix, suffix, language, context) => provider.complete(prefix, suffix, language, context));
