// Mock AI provider for local development without API keys
const MOCK_DELAY = 800;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const codeSnippets = {
  javascript: `function debounce(fn, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}`,
  python: `def fibonacci(n):
    if n <= 1:
        return n
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b`,
  default: `// AI-generated code
const result = data.map(item => ({
  ...item,
  processed: true,
  timestamp: Date.now()
}));`,
};

export default class MockProvider {
  async *streamChat(messages, context, action) {
    const result = await this.chat(messages, context, action);
    for (let index = 0; index < result.content.length; index += 24) {
      await sleep(35);
      yield result.content.slice(index, index + 24);
    }
  }

  async chat(messages, context) {
    await sleep(MOCK_DELAY);
    const last = messages[messages.length - 1]?.content?.toLowerCase() || '';
    if (last.includes('explain')) return { content: `**Code Explanation (Mock)**\n\nThis code ${context?.language || 'JavaScript'} snippet performs the following operations:\n\n1. **Initialization** - Sets up the core data structures\n2. **Processing** - Iterates through input and applies transformations\n3. **Output** - Returns the processed result\n\n> 💡 This is a mock response. Connect a real AI provider via \`AI_PROVIDER\` env variable.` };
    if (last.includes('bug') || last.includes('error')) return { content: `**Bug Analysis (Mock)**\n\nI found **2 potential issues**:\n\n- ⚠️ **Line 12**: Possible null reference — add optional chaining \`obj?.property\`\n- 🔴 **Line 27**: Async function missing \`await\` — could cause race condition\n\n**Fix Preview:**\n\`\`\`js\nconst value = obj?.property ?? defaultValue;\n\`\`\`` };
    if (last.includes('test')) return { content: `**Generated Tests (Mock)**\n\n\`\`\`javascript\nimport { describe, it, expect } from 'vitest';\nimport { myFunction } from './module';\n\ndescribe('myFunction', () => {\n  it('should return correct result for valid input', () => {\n    expect(myFunction(42)).toBe(42);\n  });\n\n  it('should handle edge case: null input', () => {\n    expect(() => myFunction(null)).not.toThrow();\n  });\n});\n\`\`\`` };
    if (last.includes('optimize') || last.includes('performance')) return { content: `**Optimization Suggestions (Mock)**\n\n1. **Memoize expensive computations** using \`useMemo\` or a cache map\n2. **Batch state updates** to avoid unnecessary re-renders\n3. **Use lazy loading** for heavy dependencies\n4. **Replace \`forEach\`** with \`reduce\` where you need accumulation\n\nEstimated performance gain: **~40%** reduction in runtime.` };
    return { content: `**AI Assistant (Mock Mode)**\n\nI received your message: *"${messages[messages.length - 1]?.content}"*\n\nI'm running in mock mode — connect a real AI provider by setting \`AI_PROVIDER=openai\` (or \`gemini\`) and the corresponding API key in your \`.env\` file.\n\nI can help with: code explanation, bug fixing, test generation, code review, and optimization.` };
  }

  async generateCode(prompt, context) {
    await sleep(MOCK_DELAY * 1.5);
    const lang = context?.language || 'javascript';
    const code = codeSnippets[lang] || codeSnippets.default;
    return { code, explanation: `Generated ${lang} code for: "${prompt}"\n\n> Mock mode — connect a real provider for AI-generated code.` };
  }

  async explainCode(code, language) {
    await sleep(MOCK_DELAY);
    return { explanation: `**Code Explanation (${language || 'Code'}) — Mock**\n\nThis snippet:\n- **Input**: Accepts parameters and processes data\n- **Logic**: Applies transformations using built-in methods\n- **Output**: Returns the processed result\n\n*Lines: ${code.split('\n').length} | Language: ${language || 'unknown'}*` };
  }

  async reviewCode(code, language) {
    await sleep(MOCK_DELAY);
    return {
      issues: [
        { severity: 'warning', line: 3, message: 'Missing error handling', category: 'reliability' },
        { severity: 'suggestion', line: 7, message: 'Consider extracting this into a separate function', category: 'readability' },
        { severity: 'info', line: 1, message: 'Good use of const for immutable binding', category: 'best-practices' },
      ],
      summary: 'Code quality is good. 1 warning and 1 suggestion found.',
    };
  }

  async fixError(code, error, language) {
    await sleep(MOCK_DELAY);
    return {
      explanation: `**Error Analysis (Mock)**\n\nThe error \`${error}\` typically occurs when accessing a property on \`undefined\` or \`null\`.\n\n**Root Cause**: The variable may not be initialized before use.\n\n**Fix**: Add a null check or use optional chaining.`,
      fixedCode: code.replace(/(\w+)\.(\w+)/g, '$1?.$2'),
      diff: `- obj.property\n+ obj?.property`,
    };
  }

  async generateTests(code, language, framework) {
    await sleep(MOCK_DELAY * 1.5);
    return {
      tests: `import { describe, it, expect } from '${framework || 'vitest'}';\n\ndescribe('Generated Tests', () => {\n  it('should work correctly', () => {\n    // TODO: Add specific assertions\n    expect(true).toBe(true);\n  });\n\n  it('should handle edge cases', () => {\n    expect(() => { /* edge case */ }).not.toThrow();\n  });\n});\n`,
      framework: framework || 'vitest',
    };
  }

  async detectBugs(code, language) {
    await sleep(MOCK_DELAY);
    const lines = code.split('\n');
    const bugs = [];
    lines.forEach((line, i) => {
      if (line.includes('==') && !line.includes('===')) bugs.push({ line: i + 1, severity: 'warning', message: 'Use === instead of ==' });
      if (line.includes('.length') && !line.includes('?.')) bugs.push({ line: i + 1, severity: 'warning', message: 'Possible null reference before .length' });
      if (line.includes('console.log')) bugs.push({ line: i + 1, severity: 'info', message: 'Remove console.log before production' });
    });
    return { bugs: bugs.length > 0 ? bugs : [{ line: 1, severity: 'info', message: 'No obvious bugs detected (mock scan)' }] };
  }

  async complete(prefix, suffix, language) {
    await sleep(300);
    const completions = {
      'function ': 'myFunction(params) {\n  // TODO: implement\n}',
      'const ': 'result = data.map(item => item);',
      'return ': 'items.reduce((acc, item) => acc + item.value, 0);',
      'if (': 'condition) {\n  // handle case\n}',
      'async ': 'function fetchData() {\n  const response = await fetch(url);\n  return response.json();\n}',
    };
    for (const [trigger, completion] of Object.entries(completions)) {
      if (prefix.trimEnd().endsWith(trigger.trim())) return { completion };
    }
    return { completion: '' };
  }

  async probe() {
    return {
      ok: true,
      provider: 'mock',
      mock: true,
      message: 'Mock provider is active — replies are canned. Set GEMINI_API_KEY in .env and restart the server for real answers.',
    };
  }
}
