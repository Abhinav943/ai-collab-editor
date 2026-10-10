// Judge0 execution provider.
//
// Works with a self-hosted Judge0 (no auth), the Judge0 cloud (X-Auth-Token),
// and RapidAPI-hosted Judge0 (X-RapidAPI-Key). Configure with:
//   JUDGE0_URL=https://judge0-ce.p.rapidapi.com   (or http://localhost:2358)
//   JUDGE0_API_KEY=<your key>                     (optional for self-hosted)

// Fallback language ids used by Judge0 CE. Overridden by a live /languages
// lookup when the instance answers.
const FALLBACK_LANGUAGE_IDS = {
  c: 50,
  cpp: 54,
  python: 71,
  java: 62,
  go: 60,
  javascript: 63,
};

// Judge0 status ids -> our status vocabulary.
const STATUS_MAP = {
  3: { status: 'completed', success: true },
  4: { status: 'wrong_answer', success: false },
  5: { status: 'timeout', success: false },
  6: { status: 'compile_error', success: false },
  7: { status: 'runtime_error', success: false },
  8: { status: 'runtime_error', success: false },
  9: { status: 'runtime_error', success: false },
  10: { status: 'runtime_error', success: false },
  11: { status: 'runtime_error', success: false },
  12: { status: 'runtime_error', success: false },
  13: { status: 'error', success: false },
  14: { status: 'error', success: false },
};

const timeoutSeconds = () => Number(process.env.JUDGE0_TIMEOUT_S) || 5;
const memoryKb = () => Number(process.env.JUDGE0_MEMORY_KB) || 256000;

const decode = (value) => {
  if (typeof value !== 'string' || value.length === 0) return '';
  try { return Buffer.from(value, 'base64').toString('utf8'); } catch { return ''; }
};
const encode = (value) => Buffer.from(String(value ?? ''), 'utf8').toString('base64');

export const judge0Url = () => (process.env.JUDGE0_URL || '').trim().replace(/\/+$/, '');

export const isJudge0Configured = () => {
  const url = judge0Url();
  return Boolean(url) && !/^replace(-me)?$/i.test(url) && /^https?:\/\//i.test(url);
};

export const buildHeaders = (extra = {}) => {
  const key = (process.env.JUDGE0_API_KEY || '').trim();
  const usable = key && !/^replace(-me)?$/i.test(key);
  const headers = { 'Content-Type': 'application/json', ...extra };
  const host = (() => { try { return new URL(judge0Url()).host; } catch { return ''; } })();
  if (usable && /rapidapi\.com$/i.test(host)) {
    headers['X-RapidAPI-Key'] = key;
    headers['X-RapidAPI-Host'] = host;
  } else if (usable) {
    headers['X-Auth-Token'] = key;
  }
  return headers;
};

// Cached per instance URL, so pointing JUDGE0_URL at a different host re-reads it.
const languageCaches = new Map();

/**
 * Map our language ids onto a Judge0 `/languages` list. Judge0 lists several
 * builds per language (and, for Python, 2.x before 3.x), so take the highest id
 * among the matches — that is the newest build — and never pick Python 2.
 * Pure, so it can be tested without the network.
 */
export const pickLanguageIds = (list = []) => {
  const ids = { ...FALLBACK_LANGUAGE_IDS };
  const pick = (language, pattern) => {
    const matches = list.filter((item) => pattern.test(item.name) && !/python\s*2/i.test(item.name));
    if (matches.length) ids[language] = matches.reduce((best, item) => (item.id > best.id ? item : best)).id;
  };
  pick('c', /^C \(/i);
  pick('cpp', /^C\+\+ \(/i);
  pick('python', /^Python \(/i);
  pick('java', /^Java \(/i);
  pick('go', /^Go \(/i);
  pick('javascript', /^JavaScript \(/i);
  return ids;
};

/** name -> id map, from the instance when possible, else the static fallback. */
export const getLanguageIds = async (fetchImpl = fetch) => {
  const url = judge0Url();
  const cached = languageCaches.get(url);
  if (cached && Date.now() < cached.expiresAt) return cached.ids;
  try {
    const response = await fetchImpl(`${url}/languages`, { headers: buildHeaders() });
    if (response.ok) {
      const ids = pickLanguageIds(await response.json());
      languageCaches.set(url, { ids, expiresAt: Date.now() + 10 * 60 * 1000 });
      return ids;
    }
  } catch { /* fall through to the static map */ }
  return FALLBACK_LANGUAGE_IDS;
};

/** Pure transform so it can be unit-tested without hitting the network. */
export const mapJudge0Response = (payload = {}, language = 'javascript', startedAt = Date.now()) => {
  const statusId = payload.status?.id;
  const mapped = STATUS_MAP[statusId] || { status: 'error', success: false };
  const stdout = decode(payload.stdout);
  const stderr = decode(payload.stderr);
  const compileOutput = decode(payload.compile_output);
  const message = decode(payload.message) || payload.status?.description || '';
  const timeSeconds = Number(payload.time);
  return {
    success: mapped.success,
    executionId: payload.token || null,
    status: mapped.status,
    language,
    stdout,
    stderr: stderr || compileOutput,
    exitCode: typeof payload.exit_code === 'number' ? payload.exit_code : null,
    executionTimeMs: Number.isFinite(timeSeconds) && timeSeconds > 0
      ? Math.round(timeSeconds * 1000)
      : Date.now() - startedAt,
    memoryKb: payload.memory ?? null,
    ...(message && !mapped.success ? { message } : {}),
  };
};

const pollSubmission = async (token, startedAt, fetchImpl = fetch) => {
  const deadline = Date.now() + (timeoutSeconds() + 15) * 1000;
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 700));
    const response = await fetchImpl(`${judge0Url()}/submissions/${token}?base64_encoded=true`, { headers: buildHeaders() });
    if (!response.ok) throw new Error(`Judge0 polling failed (HTTP ${response.status})`);
    const payload = await response.json();
    if (payload.status?.id > 2) return payload;
  }
  throw new Error('Judge0 did not finish in time.');
};

export const judge0Execute = async (code, language, stdin = '', fetchImpl = fetch) => {
  const startedAt = Date.now();
  const base = { executionId: null, language, stdout: '', stderr: '', exitCode: null, executionTimeMs: 0 };

  if (typeof code !== 'string' || !code.trim()) {
    return { ...base, success: false, status: 'invalid_request', stderr: 'Code is required.' };
  }
  if (!isJudge0Configured()) {
    return { ...base, success: false, status: 'misconfigured', stderr: 'JUDGE0_URL is not configured.' };
  }

  const ids = await getLanguageIds(fetchImpl);
  const languageId = ids[language];
  if (!languageId) {
    return { ...base, success: false, status: 'invalid_language', stderr: `Judge0 has no mapping for ${language}.` };
  }

  const body = { source_code: encode(code), language_id: languageId, stdin: encode(stdin) };
  // Only send limits when explicitly configured — the public instance rejects
  // values above its own ceilings.
  if (process.env.JUDGE0_TIMEOUT_S) {
    body.cpu_time_limit = timeoutSeconds();
    body.wall_time_limit = timeoutSeconds() + 5;
  }
  if (process.env.JUDGE0_MEMORY_KB) body.memory_limit = memoryKb();

  const submit = (useWait) => fetchImpl(`${judge0Url()}/submissions?base64_encoded=true&wait=${useWait}`, {
    method: 'POST',
    headers: buildHeaders(),
    body: JSON.stringify(body),
  });

  // Ask for the result inline where the instance supports it...
  let response = await submit(true);
  let payload = await response.json().catch(() => null);

  // ...but the public ce.judge0.com instance disables `wait`, so fall back to
  // submitting without it and polling for the result.
  if (!response.ok && /wait not allowed/i.test(String(payload?.error || ''))) {
    response = await submit(false);
    payload = await response.json().catch(() => null);
  }

  if (!response.ok) {
    const detail = payload ? JSON.stringify(payload).slice(0, 300) : await response.text().catch(() => '');
    const hint = response.status === 429
      ? 'Judge0 rate limit reached — wait a moment, or point JUDGE0_URL at your own instance.'
      : `Judge0 rejected the request (HTTP ${response.status}). ${detail}`.trim();
    return { ...base, success: false, status: 'provider_error', stderr: hint, executionTimeMs: Date.now() - startedAt };
  }

  // Some deployments return just a token; poll until the submission finishes.
  if (payload?.token && !payload.status) payload = await pollSubmission(payload.token, startedAt, fetchImpl);
  return mapJudge0Response(payload, language, startedAt);
};

export const judge0Status = async () => {
  const configured = isJudge0Configured();
  if (!configured) return { provider: 'judge0', available: false, languages: {} };
  try {
    const ids = await getLanguageIds();
    return {
      provider: 'judge0',
      available: true,
      languages: Object.fromEntries(Object.keys(ids).map((id) => [id, { available: true }])),
    };
  } catch {
    return { provider: 'judge0', available: false, languages: {} };
  }
};
