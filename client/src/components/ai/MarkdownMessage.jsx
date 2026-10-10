import React, { useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Check, Copy, ClipboardPaste } from 'lucide-react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

const LANGUAGE_ALIASES = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  rb: 'ruby',
  sh: 'bash',
  shell: 'bash',
  yml: 'yaml',
  md: 'markdown',
  text: 'text',
  txt: 'text',
};
const SUPPORTED_LANGUAGES = new Set([
  'bash', 'c', 'cpp', 'css', 'go', 'html', 'java', 'javascript',
  'json', 'markdown', 'python', 'ruby', 'rust', 'sql', 'text',
  'typescript', 'yaml',
]);

function normalizeLanguage(language, fallbackLanguage) {
  const normalized = (language || fallbackLanguage || 'text').toLowerCase().trim();
  const resolved = LANGUAGE_ALIASES[normalized] || normalized || 'text';
  return SUPPORTED_LANGUAGES.has(resolved) ? resolved : 'text';
}

function closeIncompleteFence(markdown) {
  const fences = markdown.match(/^```/gm) || [];
  return fences.length % 2 === 1 ? `${markdown}\n\`\`\`` : markdown;
}

function CodeBlock({ node, className, children, fallbackLanguage, onApply }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const code = String(children).replace(/\n$/, '');
  const language = normalizeLanguage(className?.replace('language-', ''), fallbackLanguage);
  const inline = node?.parent?.tagName !== 'pre';

  if (inline) {
    return <code className="rounded bg-[#1a2940] px-1.5 py-0.5 font-mono text-[0.9em] text-teal-200">{children}</code>;
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setCopyFailed(false);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
      setCopyFailed(true);
      window.setTimeout(() => setCopyFailed(false), 2000);
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-xl border border-border bg-[#0b1423]">
      <div className="flex min-h-9 items-center justify-between border-b border-border bg-[#111e32] px-3">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-text-muted">{language}</span>
        <div className="flex items-center gap-1">
          <button type="button" onClick={copyCode} className="flex min-h-7 items-center gap-1 rounded px-2 text-[10px] font-semibold text-text-muted transition-colors hover:bg-white/5 hover:text-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary" aria-label={copied ? 'Code copied' : 'Copy code'}>
            {copied ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} />}
            {copied ? 'Copied' : copyFailed ? 'Copy failed' : 'Copy'}
          </button>
          {onApply && (
            <button type="button" onClick={() => onApply(code, language)} className="flex min-h-7 items-center gap-1 rounded px-2 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/10 hover:text-primary-hover focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary" aria-label="Apply code to editor">
              <ClipboardPaste size={13} /> Apply
            </button>
          )}
        </div>
      </div>
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        PreTag="div"
        customStyle={{ margin: 0, padding: '0.9rem 1rem', background: 'transparent', fontSize: '0.75rem', lineHeight: 1.65, overflowX: 'auto', maxHeight: '28rem' }}
        codeTagProps={{ style: { fontFamily: "'JetBrains Mono', 'Fira Code', monospace" } }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

export default function MarkdownMessage({ content = '', fallbackLanguage, onApply }) {
  const markdown = useMemo(() => closeIncompleteFence(String(content)), [content]);

  if (!String(content).trim()) return null;

  return (
    <div className="markdown-message text-sm leading-7 text-text-secondary [&>p]:mb-3 [&>p:last-child]:mb-0 [&_a]:text-primary [&_a]:underline [&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-primary [&_blockquote]:pl-3 [&_blockquote]:text-text-muted [&_h1]:mb-3 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_ol>li]:list-decimal [&_ul]:mb-3 [&_ol]:mb-3">
      <ReactMarkdown
        skipHtml
        components={{
          code: ({ node, className, children }) => (
            <CodeBlock node={node} className={className} fallbackLanguage={fallbackLanguage} onApply={onApply}>{children}</CodeBlock>
          ),
          a: ({ node, ...props }) => <a {...props} target="_blank" rel="noreferrer" />,
          hr: () => <hr className="my-4 border-border" />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
