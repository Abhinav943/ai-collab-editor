import test from 'node:test';
import assert from 'node:assert/strict';
import { buildExecutionEnv, execute, LANGUAGE_CONFIG } from '../src/services/execution/ExecutionService.js';
import { mapJudge0Response, pickLanguageIds, judge0Execute } from '../src/services/execution/Judge0Service.js';

// These cases cover the local runner; make sure Judge0 is not configured.
delete process.env.JUDGE0_URL;

test('exposes the six supported execution languages', () => {
  assert.deepEqual(Object.keys(LANGUAGE_CONFIG), ['c', 'cpp', 'python', 'java', 'go', 'javascript']);
});

test('executes JavaScript with stdin locally', async () => {
  const result = await execute(
    "const fs = require('node:fs'); console.log(fs.readFileSync(0, 'utf8').trim());",
    'javascript',
    '42\n'
  );
  assert.equal(result.success, true);
  assert.equal(result.status, 'completed');
  assert.equal(result.stdout.trim(), '42');
});

test('rejects an empty program without spawning a process', async () => {
  const result = await execute('   ', 'javascript');
  assert.equal(result.success, false);
  assert.equal(result.status, 'invalid_request');
});

test('rejects an unknown language', async () => {
  const result = await execute('console.log("nope")', 'ruby');
  assert.equal(result.success, false);
  assert.equal(result.status, 'invalid_language');
});

test('builds a safe local execution environment with required runtime variables', () => {
  const env = buildExecutionEnv({
    PATH: 'tool-path',
    HOME: 'home',
    LANG: 'C.UTF-8',
    TMPDIR: 'tmp',
    GEMINI_API_KEY: 'secret',
    MONGODB_URI: 'mongodb://secret',
  }, 'linux');
  assert.equal(env.PATH, 'tool-path');
  assert.equal(env.HOME, 'home');
  assert.equal(env.TMPDIR, 'tmp');
  assert.equal(env.GEMINI_API_KEY, undefined);
  assert.equal(env.MONGODB_URI, undefined);
});

test('terminates an infinite JavaScript program', async () => {
  const result = await execute('while (true) {}', 'javascript');
  assert.equal(result.success, false);
  assert.equal(result.status, 'timeout');
});

// --- Judge0 response mapping (pure, no network) ---

const b64 = (value) => Buffer.from(value, 'utf8').toString('base64');

test('maps an accepted Judge0 submission', () => {
  const result = mapJudge0Response(
    { token: 'abc', status: { id: 3 }, stdout: b64('42\n'), stderr: '', time: '0.021', exit_code: 0, memory: 1024 },
    'javascript'
  );
  assert.equal(result.success, true);
  assert.equal(result.status, 'completed');
  assert.equal(result.stdout, '42\n');
  assert.equal(result.executionTimeMs, 21);
  assert.equal(result.executionId, 'abc');
});

test('maps a Judge0 compilation error', () => {
  const result = mapJudge0Response({ status: { id: 6 }, compile_output: b64('main.cpp:1: error'), time: null }, 'cpp');
  assert.equal(result.success, false);
  assert.equal(result.status, 'compile_error');
  assert.equal(result.stderr, 'main.cpp:1: error');
});

test('maps a Judge0 timeout and runtime error', () => {
  assert.equal(mapJudge0Response({ status: { id: 5 }, time: '5.001' }, 'go').status, 'timeout');
  assert.equal(mapJudge0Response({ status: { id: 11 }, stderr: b64('boom') }, 'java').status, 'runtime_error');
});

test('decodes base64 stdout and stderr safely', () => {
  const result = mapJudge0Response({ status: { id: 3 }, stdout: b64('héllo\n'), stderr: null, time: '0.1' }, 'python');
  assert.equal(result.stdout, 'héllo\n');
  assert.equal(result.stderr, '');
});

test('maps our six languages to the newest Judge0 builds (never Python 2)', () => {
  const list = [
    { id: 48, name: 'C (GCC 7.4.0)' }, { id: 49, name: 'C (GCC 8.3.0)' }, { id: 50, name: 'C (GCC 9.2.0)' },
    { id: 52, name: 'C++ (GCC 7.4.0)' }, { id: 53, name: 'C++ (GCC 8.3.0)' }, { id: 54, name: 'C++ (GCC 9.2.0)' },
    { id: 60, name: 'Go (1.13.5)' }, { id: 62, name: 'Java (OpenJDK 13.0.1)' },
    { id: 63, name: 'JavaScript (Node.js 12.14.0)' },
    { id: 70, name: 'Python (2.7.17)' }, { id: 71, name: 'Python (3.8.1)' },
  ];
  assert.deepEqual(pickLanguageIds(list), { c: 50, cpp: 54, python: 71, java: 62, go: 60, javascript: 63 });
});

test('falls back to the standard ids when the list is empty', () => {
  assert.deepEqual(pickLanguageIds([]), { c: 50, cpp: 54, python: 71, java: 62, go: 60, javascript: 63 });
});

// --- Judge0 request flow, with a fake fetch (no network) ---

const b64enc = (value) => Buffer.from(value, 'utf8').toString('base64');

test('falls back to polling when the instance disables wait=true (public ce.judge0.com)', async () => {
  process.env.JUDGE0_URL = 'https://ce.judge0.com';
  const calls = [];
  const fakeFetch = async (url, options = {}) => {
    calls.push(url);
    if (url.includes('/languages')) return { ok: true, status: 200, json: async () => [] };
    if (url.includes('/submissions?') && options.method === 'POST' && url.includes('wait=true')) {
      return { ok: false, status: 400, json: async () => ({ error: 'wait not allowed' }), text: async () => '{"error":"wait not allowed"}' };
    }
    if (url.includes('/submissions?') && options.method === 'POST') {
      return { ok: true, status: 201, json: async () => ({ token: 'tok1' }) };
    }
    if (url.includes('/submissions/tok1')) {
      return { ok: true, status: 200, json: async () => ({ token: 'tok1', status: { id: 3, description: 'Accepted' }, stdout: b64enc('42\n'), time: '0.01' }) };
    }
    return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
  };

  const result = await judge0Execute('print(42)', 'python', '', fakeFetch);
  assert.equal(result.success, true);
  assert.equal(result.status, 'completed');
  assert.equal(result.stdout, '42\n');
  assert.ok(calls.some((u) => u.includes('wait=true')), 'tried wait=true first');
  assert.ok(calls.some((u) => u.includes('wait=false')), 'fell back to wait=false');
  assert.ok(calls.some((u) => u.includes('/submissions/tok1')), 'polled for the result');
  delete process.env.JUDGE0_URL;
});

test('uses the inline result when the instance supports wait=true', async () => {
  process.env.JUDGE0_URL = 'http://localhost:2358';
  const calls = [];
  const fakeFetch = async (url) => {
    calls.push(url);
    if (url.includes('/languages')) return { ok: true, status: 200, json: async () => [] };
    return {
      ok: true, status: 201,
      json: async () => ({ token: 'tok2', status: { id: 3, description: 'Accepted' }, stdout: b64enc('hi'), time: '0.02' }),
    };
  };
  const result = await judge0Execute('print(1)', 'python', '', fakeFetch);
  assert.equal(result.success, true);
  assert.equal(result.stdout, 'hi');
  assert.ok(!calls.some((u) => u.includes('wait=false')), 'no fallback needed');
  delete process.env.JUDGE0_URL;
});

test('surfaces a rate limit with an actionable message', async () => {
  process.env.JUDGE0_URL = 'https://ce.judge0.com';
  const fakeFetch = async (url) => (url.includes('/languages')
    ? { ok: true, status: 200, json: async () => [] }
    : { ok: false, status: 429, json: async () => ({ error: 'too many requests' }), text: async () => 'too many' });
  const result = await judge0Execute('print(1)', 'python', '', fakeFetch);
  assert.equal(result.status, 'provider_error');
  assert.match(result.stderr, /rate limit/i);
  delete process.env.JUDGE0_URL;
});

test('reports a compile error from Judge0', async () => {
  process.env.JUDGE0_URL = 'http://localhost:2358';
  const fakeFetch = async (url) => (url.includes('/languages')
    ? { ok: true, status: 200, json: async () => [] }
    : { ok: true, status: 201, json: async () => ({ status: { id: 6 }, compile_output: b64enc('error: expected ;'), time: null }) });
  const result = await judge0Execute('int main(){', 'cpp', '', fakeFetch);
  assert.equal(result.success, false);
  assert.equal(result.status, 'compile_error');
  assert.match(result.stderr, /expected ;/);
  delete process.env.JUDGE0_URL;
});
