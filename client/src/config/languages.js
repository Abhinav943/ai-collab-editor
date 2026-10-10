// Single source of truth for file-language detection across the client.

export const EXECUTION_LANGUAGES = [
  { id: 'c', label: 'C', extension: '.c', monaco: 'c' },
  { id: 'cpp', label: 'C++', extension: '.cpp', monaco: 'cpp' },
  { id: 'python', label: 'Python', extension: '.py', monaco: 'python' },
  { id: 'java', label: 'Java', extension: '.java', monaco: 'java' },
  { id: 'go', label: 'Go', extension: '.go', monaco: 'go' },
  { id: 'javascript', label: 'JavaScript', extension: '.js', monaco: 'javascript' },
];

export const EXECUTION_LANGUAGE_IDS = new Set(EXECUTION_LANGUAGES.map((item) => item.id));

// extension (lowercase, with the dot) -> Monaco language id
export const EXTENSION_TO_LANGUAGE = {
  '.c': 'c', '.h': 'c',
  '.cpp': 'cpp', '.cc': 'cpp', '.cxx': 'cpp', '.c++': 'cpp',
  '.hpp': 'cpp', '.hh': 'cpp', '.hxx': 'cpp',
  '.py': 'python', '.pyw': 'python',
  '.java': 'java',
  '.go': 'go',
  '.js': 'javascript', '.mjs': 'javascript', '.cjs': 'javascript', '.jsx': 'javascript',
  '.ts': 'typescript', '.tsx': 'typescript',
  '.rs': 'rust',
  '.cs': 'csharp',
  '.php': 'php',
  '.rb': 'ruby',
  '.html': 'html', '.htm': 'html',
  '.css': 'css', '.scss': 'scss', '.less': 'less',
  '.json': 'json',
  '.md': 'markdown', '.markdown': 'markdown',
  '.sql': 'sql',
  '.sh': 'shell', '.bash': 'shell', '.zsh': 'shell',
  '.yml': 'yaml', '.yaml': 'yaml',
  '.xml': 'xml', '.svg': 'xml',
  '.txt': 'plaintext',
};

// Short badge shown in the file explorer for each language.
export const LANGUAGE_LABELS = {
  c: { label: 'C', color: 'text-sky-300' },
  cpp: { label: 'C++', color: 'text-blue-400' },
  python: { label: 'PY', color: 'text-green-400' },
  java: { label: 'JAVA', color: 'text-red-400' },
  go: { label: 'GO', color: 'text-cyan-300' },
  javascript: { label: 'JS', color: 'text-yellow-400' },
  typescript: { label: 'TS', color: 'text-blue-500' },
  rust: { label: 'RS', color: 'text-orange-500' },
  csharp: { label: 'C#', color: 'text-violet-400' },
  php: { label: 'PHP', color: 'text-indigo-300' },
  ruby: { label: 'RB', color: 'text-red-300' },
  html: { label: 'HTML', color: 'text-orange-400' },
  css: { label: 'CSS', color: 'text-blue-300' },
  scss: { label: 'SCSS', color: 'text-pink-400' },
  less: { label: 'LESS', color: 'text-blue-400' },
  json: { label: '{}', color: 'text-yellow-300' },
  markdown: { label: 'MD', color: 'text-white' },
  sql: { label: 'SQL', color: 'text-teal-300' },
  shell: { label: 'SH', color: 'text-emerald-300' },
  yaml: { label: 'YML', color: 'text-purple-300' },
  xml: { label: 'XML', color: 'text-amber-300' },
  plaintext: { label: 'TXT', color: 'text-text-muted' },
};

// Stored languages that carry no real information — fall back to the filename.
const UNINFORMATIVE = new Set(['', 'plaintext', 'text', 'txt', 'unknown', 'none']);

export function languageFromFilename(filename, fallback = 'plaintext') {
  const name = String(filename || '');
  const dot = name.lastIndexOf('.');
  if (dot === -1) return fallback;
  return EXTENSION_TO_LANGUAGE[name.slice(dot).toLowerCase()] || fallback;
}

/**
 * The language to hand to Monaco for a file. A stored language is honoured only
 * when it is meaningful; otherwise it is inferred from the file name. This is
 * what makes a `main.cpp` file highlight and autocomplete correctly even when it
 * was created with the generic "plaintext" default.
 */
export function resolveFileLanguage(file) {
  const stored = typeof file?.language === 'string' ? file.language.trim().toLowerCase() : '';
  if (stored && !UNINFORMATIVE.has(stored)) return stored;
  return languageFromFilename(file?.name, 'plaintext');
}

/** The language to run a file with — always one of EXECUTION_LANGUAGES. */
export function resolveExecutionLanguage(file, fallback = 'javascript') {
  const stored = typeof file?.language === 'string' ? file.language.trim().toLowerCase() : '';
  if (EXECUTION_LANGUAGE_IDS.has(stored)) return stored;
  const derived = languageFromFilename(file?.name, '');
  return EXECUTION_LANGUAGE_IDS.has(derived) ? derived : fallback;
}

export function labelForLanguage(language) {
  return LANGUAGE_LABELS[language] || {
    label: (language || '?').slice(0, 4).toUpperCase(),
    color: 'text-text-muted',
  };
}

// Starter code inserted when a file is created, so each language runs as-is.
const STARTERS = {
  c: '#include <stdio.h>\n\nint main(void) {\n  printf("Hello, World!\\n");\n  return 0;\n}\n',
  cpp: '#include <iostream>\n\nint main() {\n  std::cout << "Hello, World!" << std::endl;\n  return 0;\n}\n',
  // Judge0 compiles Java as Main.java and runs the Main class.
  java: 'public class Main {\n  public static void main(String[] args) {\n    System.out.println("Hello, World!");\n  }\n}\n',
  go: 'package main\n\nimport "fmt"\n\nfunc main() {\n  fmt.Println("Hello, World!")\n}\n',
  python: 'def main():\n    print("Hello, World!")\n\n\nif __name__ == "__main__":\n    main()\n',
  javascript: 'function main() {\n  console.log("Hello, World!");\n}\n\nmain();\n',
};

export function starterCode(language) {
  return STARTERS[language] || '';
}
