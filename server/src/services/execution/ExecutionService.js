import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { isJudge0Configured, judge0Execute, judge0Status } from './Judge0Service.js';

// Judge0 takes priority when configured; otherwise fall back to running code
// with the toolchains on this machine.
export const getExecutionProvider = () => {
  if (isJudge0Configured()) return 'judge0';
  if (process.env.EXECUTION_MODE === 'disabled') return 'disabled';
  return 'local';
};

export const EXECUTION_TIMEOUT_MS = 5000;
export const MAX_OUTPUT_BYTES = 1024 * 1024;

export const LANGUAGE_CONFIG = {
  c: {
    label: 'C',
    extensions: ['.c'],
    sourceFile: 'main.c',
    compiler: { candidates: ['gcc'], args: ['main.c', '-o', 'main'] },
    runtime: { candidates: process.platform === 'win32' ? ['main.exe'] : ['./main'], toolCandidates: [], commandFrom: 'artifact', args: [] },
  },
  cpp: {
    label: 'C++',
    extensions: ['.cpp', '.cc', '.cxx'],
    sourceFile: 'main.cpp',
    compiler: { candidates: ['g++'], args: ['main.cpp', '-o', 'main'] },
    runtime: { candidates: process.platform === 'win32' ? ['main.exe'] : ['./main'], toolCandidates: [], commandFrom: 'artifact', args: [] },
  },
  python: {
    label: 'Python',
    extensions: ['.py'],
    sourceFile: 'main.py',
    runtime: { candidates: process.platform === 'win32' ? ['python', 'python3'] : ['python3', 'python'], toolCandidates: process.platform === 'win32' ? ['python', 'python3'] : ['python3', 'python'], args: ['main.py'] },
  },
  java: {
    label: 'Java',
    extensions: ['.java'],
    sourceFile: 'Main.java',
    compiler: { candidates: ['javac'], args: ['Main.java'] },
    runtime: { candidates: ['java'], toolCandidates: ['java'], args: ['Main'] },
  },
  go: {
    label: 'Go',
    extensions: ['.go'],
    sourceFile: 'main.go',
    runtime: { candidates: ['go'], toolCandidates: ['go'], args: ['run', 'main.go'] },
  },
  javascript: {
    label: 'JavaScript',
    extensions: ['.js'],
    sourceFile: 'main.js',
    runtime: { candidates: ['node'], toolCandidates: ['node'], args: ['main.js'] },
  },
};

export const buildExecutionEnv = (source = process.env, platform = process.platform) => {
  const keys = platform === 'win32'
    ? ['PATH', 'PATHEXT', 'SystemRoot', 'SystemDrive', 'windir', 'ComSpec', 'TEMP', 'TMP', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'APPDATA', 'LOCALAPPDATA', 'ProgramData', 'ProgramFiles', 'ProgramFiles(x86)', 'NUMBER_OF_PROCESSORS', 'OS']
    : ['PATH', 'HOME', 'LANG', 'TMPDIR', 'SHELL'];
  return Object.fromEntries(keys.filter((key) => source[key] !== undefined).map((key) => [key, source[key]]));
};

let toolchainStatusCache = null;
let toolchainStatusCacheExpiresAt = 0;

const runProcess = (command, args, options = {}) => new Promise((resolve) => {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: buildExecutionEnv(),
    shell: false,
    windowsHide: true,
    detached: process.platform !== 'win32',
  });
  let stdout = '';
  let stderr = '';
  let outputBytes = 0;
  let timedOut = false;
  let outputLimit = false;
  let settled = false;
  const startedAt = Date.now();

  const finish = (result) => {
    if (settled) return;
    settled = true;
    clearTimeout(timeout);
    resolve({ ...result, stdout, stderr, executionTimeMs: Date.now() - startedAt });
  };

  const stop = () => {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true });
    } else {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
    }
  };

  const append = (target, chunk) => {
    const text = chunk.toString();
    outputBytes += Buffer.byteLength(text);
    if (outputBytes > MAX_OUTPUT_BYTES) {
      outputLimit = true;
      stop();
      finish({ status: 'output_limit', exitCode: null });
      return;
    }
    if (target === 'stdout') stdout += text;
    else stderr += text;
  };

  child.stdout.on('data', chunk => append('stdout', chunk));
  child.stderr.on('data', chunk => append('stderr', chunk));
  child.on('error', error => finish({ status: 'spawn_error', exitCode: null, error }));
  child.on('close', (exitCode, signal) => {
    if (timedOut) return finish({ status: 'timeout', exitCode: null });
    if (outputLimit) return finish({ status: 'output_limit', exitCode: null });
    finish({ status: exitCode === 0 ? 'completed' : 'runtime_error', exitCode, signal });
  });

  if (options.stdin) child.stdin.write(options.stdin);
  child.stdin.end();

  const timeout = setTimeout(() => {
    timedOut = true;
    stop();
    finish({ status: 'timeout', exitCode: null });
  }, options.timeoutMs || EXECUTION_TIMEOUT_MS);
});

const resolveExecutable = async (candidates) => {
  for (const candidate of candidates) {
    const result = await runProcess(candidate, ['--version'], { timeoutMs: 1500 });
    if (result.status !== 'spawn_error') {
      return { command: candidate, version: `${result.stdout}${result.stderr}`.trim().split(/\r?\n/)[0] };
    }
  }
  return null;
};

const removeWorkspace = async (workspace) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      await rm(workspace, { recursive: true, force: true });
      return;
    } catch (error) {
      if (!['EBUSY', 'EPERM'].includes(error.code) || attempt === 19) throw error;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
};

export const getToolchainStatus = async () => {
  if (getExecutionProvider() === 'judge0') {
    const languages = {};
    let reachable = true;
    try {
      const status = await judge0Status();
      reachable = status.available !== false;
      for (const id of Object.keys(LANGUAGE_CONFIG)) {
        languages[id] = { available: status.languages?.[id]?.available !== false, runtime: 'judge0' };
      }
    } catch {
      // Judge0 unreachable — assume the languages exist but flag the provider.
      reachable = false;
      for (const id of Object.keys(LANGUAGE_CONFIG)) languages[id] = { available: true, runtime: 'judge0' };
    }
    return { provider: 'judge0', remote: true, reachable, localExecution: false, languages };
  }
  if (toolchainStatusCache && Date.now() < toolchainStatusCacheExpiresAt) return toolchainStatusCache;
  const languages = {};
  for (const [id, config] of Object.entries(LANGUAGE_CONFIG)) {
    const candidates = [...(config.compiler?.candidates || []), ...(config.runtime?.toolCandidates || [])];
    const resolved = [];
    for (const candidate of candidates) {
      if (!resolved.some(item => item.command === candidate)) {
        const tool = await resolveExecutable([candidate]);
        if (tool) resolved.push(tool);
      }
    }
    const compiler = config.compiler ? resolved.find(item => config.compiler.candidates.includes(item.command)) : null;
    const runtime = resolved.find(item => (config.runtime.toolCandidates || []).includes(item.command));
    languages[id] = {
      available: Boolean((config.compiler ? compiler : true) && (config.runtime.toolCandidates?.length ? runtime : true)),
      ...(config.compiler && { compiler: compiler?.command || config.compiler.candidates[0] }),
      ...(config.runtime && { runtime: runtime?.command || config.runtime.toolCandidates?.[0] || config.runtime.candidates[0] }),
      version: (compiler || runtime)?.version || null,
    };
  }
  toolchainStatusCache = { provider: getExecutionProvider(), localExecution: process.env.EXECUTION_MODE !== 'disabled', languages };
  toolchainStatusCacheExpiresAt = Date.now() + 30_000;
  return toolchainStatusCache;
};

const localExecute = async (code, language, stdin = '') => {
  const executionId = randomUUID();
  if (process.env.EXECUTION_MODE === 'disabled') {
    return { success: false, executionId, status: 'disabled', language, stdout: '', stderr: 'Local execution is disabled by configuration.', exitCode: null, executionTimeMs: 0 };
  }
  const config = LANGUAGE_CONFIG[language];
  if (!config) {
    return { success: false, executionId, status: 'invalid_language', language, stdout: '', stderr: 'Unsupported language.', exitCode: null, executionTimeMs: 0 };
  }
  if (typeof code !== 'string' || !code.trim()) {
    return { success: false, executionId, status: 'invalid_request', language, stdout: '', stderr: 'Code is required.', exitCode: null, executionTimeMs: 0 };
  }

  const workspace = await mkdtemp(path.join(os.tmpdir(), 'ai-collab-run-'));
  const sourcePath = path.join(workspace, config.sourceFile);
  const startedAt = Date.now();
  try {
    await writeFile(sourcePath, code, 'utf8');
    const status = await getToolchainStatus();
    const tools = status.languages[language];
    if (!tools.available) {
      return {
        success: false, executionId, status: 'toolchain_unavailable', language, stdout: '', stderr: `${config.label} toolchain is unavailable. Install the required tools and make sure they are available in PATH.`, exitCode: null, executionTimeMs: Date.now() - startedAt,
      };
    }

    if (config.compiler) {
      const compile = await runProcess(tools.compiler, config.compiler.args, { cwd: workspace });
      if (compile.status !== 'completed') {
        const status = compile.status === 'timeout' ? 'timeout' : compile.status === 'output_limit' ? 'output_limit' : 'compile_error';
        return {
          success: false,
          executionId,
          status,
          language,
          stdout: compile.stdout,
          stderr: compile.stderr,
          exitCode: compile.exitCode,
          executionTimeMs: compile.executionTimeMs,
          ...(status === 'timeout' && { message: 'Compilation timed out after 5 seconds.' }),
          ...(status === 'output_limit' && { message: 'Compiler output exceeded the 1 MB limit.' }),
        };
      }
    }

    const runtimeCommand = config.runtime.commandFrom === 'artifact'
      ? path.join(workspace, config.runtime.candidates[0])
      : tools.runtime;
    const runtime = await runProcess(runtimeCommand, config.runtime.args, { cwd: workspace, stdin });
    const success = runtime.status === 'completed';
    return {
      success,
      executionId,
      status: runtime.status,
      language,
      stdout: runtime.stdout,
      stderr: runtime.stderr,
      exitCode: runtime.exitCode,
      executionTimeMs: runtime.executionTimeMs,
      ...(runtime.status === 'timeout' && { message: 'Execution timed out after 5 seconds.' }),
      ...(runtime.status === 'output_limit' && { message: 'Program output exceeded the 1 MB limit.' }),
    };
  } finally {
    await removeWorkspace(workspace);
  }
};

export const execute = async (code, language, stdin = '') => {
  if (getExecutionProvider() === 'judge0') {
    try {
      const result = await judge0Execute(code, language, stdin);
      console.log(`[execution ${result.executionId || 'none'}] Judge0 status=${result.status}`);
      return result;
    } catch (error) {
      return {
        success: false,
        executionId: null,
        status: 'provider_error',
        language,
        stdout: '',
        stderr: error?.message || 'Judge0 request failed.',
        exitCode: null,
        executionTimeMs: 0,
      };
    }
  }
  return localExecute(code, language, stdin);
};
