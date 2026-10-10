import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { buildProvider } from '../src/services/ai/AIService.js';
import UnavailableProvider from '../src/services/ai/providers/UnavailableProvider.js';
import MockProvider from '../src/services/ai/providers/MockProvider.js';

test('buildProvider maps unavailable to UnavailableProvider, not mock', () => {
  assert.equal(buildProvider('unavailable') instanceof UnavailableProvider, true);
  assert.equal(buildProvider('unavailable') instanceof MockProvider, false);
  assert.equal(buildProvider('disabled') instanceof UnavailableProvider, true);
  assert.equal(buildProvider('mock') instanceof MockProvider, true);
});

test('status and chat agree when AI_PROVIDER=gemini has no key', () => {
  const moduleUrl = new URL('../src/services/ai/AIService.js', import.meta.url).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    const ai = await import(${JSON.stringify(moduleUrl)});
    const status = ai.getStatus();
    if (status.provider !== 'unavailable') {
      console.error('STATUS', JSON.stringify(status));
      process.exit(2);
    }
    try {
      await ai.chat([{ role: 'user', content: 'hello' }], {});
      console.error('CHAT_DID_NOT_THROW');
      process.exit(3);
    } catch (error) {
      if (!/AI features are unavailable/i.test(error.message)) {
        console.error('CHAT_MSG', error.message);
        process.exit(4);
      }
    }
  `], {
    encoding: 'utf8',
    env: {
      ...process.env,
      AI_PROVIDER: 'gemini',
      GEMINI_API_KEY: '',
      GOOGLE_API_KEY: '',
    },
  });

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stderr + result.stdout, /Provider: unavailable/);
});
