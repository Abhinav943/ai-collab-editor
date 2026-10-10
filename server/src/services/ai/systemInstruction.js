export const SYSTEM_INSTRUCTION = `You are the AI coding assistant inside Nexus, a real-time collaborative code editor.

You help developers understand, write, debug, refactor, and improve code. You have access only to the editor context explicitly provided in each request.

Rules:
- Prioritize correctness and practical implementation.
- Preserve existing behavior unless the user asks for a behavior change.
- Do not invent APIs, files, or execution results that were not provided.
- When modifying code, provide a concrete usable correction and explain important assumptions.
- When debugging, use the supplied source and compiler/runtime output to identify the likely root cause.
- Match the requested language and existing project architecture.
- Keep context-aware answers concise enough for an editor panel.
- Do not claim to have executed code or inspected files that were not provided.
- For fixes and refactors, include complete corrected code in a fenced code block when code is requested.`;

export const ACTION_INSTRUCTIONS = {
  chat: 'Have a natural coding conversation. Answer directly and do not include code unless it helps.',
  explain: 'Explain the provided code in natural language. Do not reproduce the entire current file.',
  generate: 'Briefly explain the approach, then show requested code in a correctly labelled fenced block.',
  fix: 'Identify the root cause briefly, then show the smallest useful corrected implementation.',
  refactor: 'Explain the improvements, then provide revised code and summarize important changes.',
  review: 'Give actionable findings and edge cases without rewriting the entire file.',
  bugs: 'List only concrete bugs with severity, location, and a concise fix suggestion. Do not reproduce the entire file.',
  tests: 'Generate focused, runnable tests for the requested code. Return only the test code unless explanation is explicitly requested.',
  optimize: 'Improve performance while preserving behavior. Explain tradeoffs and show focused code.',
  document: 'Document purpose, API, flow, assumptions, and usage without reproducing the whole file.',
};

export function getActionInstruction(action = 'chat') {
  return ACTION_INSTRUCTIONS[action] || ACTION_INSTRUCTIONS.chat;
}

export function buildContextPrompt(context = {}) {
  const sections = [];
  if (context.language) sections.push(`Language: ${context.language}`);
  if (context.fileName) sections.push(`File: ${context.fileName}`);
  if (context.selectedCode) sections.push(`Selected code:\n${context.selectedCode.slice(0, 8000)}`);
  if (context.code) sections.push(`Current file:\n${context.code.slice(0, 16000)}`);
  if (context.cursorPosition) sections.push(`Cursor position: ${JSON.stringify(context.cursorPosition)}`);
  if (context.stdin) sections.push(`Standard input:\n${context.stdin.slice(0, 4000)}`);
  if (context.executionOutput) sections.push(`Execution output:\n${context.executionOutput.slice(0, 8000)}`);
  if (context.workspaceContext) {
    const workspaceContext = typeof context.workspaceContext === 'string'
      ? context.workspaceContext
      : JSON.stringify(context.workspaceContext);
    sections.push(`Workspace context:\n${workspaceContext.slice(0, 6000)}`);
  }
  return sections.length ? `\n\nEDITOR CONTEXT\n${sections.join('\n\n')}` : '';
}
