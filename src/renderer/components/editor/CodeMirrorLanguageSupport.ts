import type { Extension } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { html } from '@codemirror/lang-html';
import { css } from '@codemirror/lang-css';
import { markdown } from '@codemirror/lang-markdown';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { xml } from '@codemirror/lang-xml';
import { sql } from '@codemirror/lang-sql';
import { rust } from '@codemirror/lang-rust';
import { go } from '@codemirror/lang-go';
import { php } from '@codemirror/lang-php';
import { yaml } from '@codemirror/lang-yaml';

/**
 * MLX 语言标识 → CodeMirror 6 语言扩展映射表
 * 对应 useEditorStore.ts 中的 LANG_MAP
 */
const LANGUAGE_EXTENSIONS: Record<string, Extension> = {
  // ── JavaScript 系列 ──
  javascript: javascript(),
  typescript: javascript({ typescript: true }),
  jsx: javascript({ jsx: true }),
  tsx: javascript({ jsx: true, typescript: true }),

  // ── Web ──
  html: html(),
  css: css(),
  scss: css(),
  less: css(),
  xml: xml(),

  // ── 数据格式 ──
  json: json(),
  yaml: yaml(),
  yml: yaml(),
  markdown: markdown(),
  md: markdown(),
  sql: sql(),
  properties: yaml(),

  // ── 编程语言 ──
  python: python(),
  java: java(),
  c: cpp(),
  cpp: cpp(),
  csharp: cpp(),
  go: go(),
  rust: rust(),
  php: php(),
  ruby: python(),

  // ── Shell ──
  shell: javascript(),
  powershell: javascript(),
  sh: javascript(),
  bash: javascript(),
  zsh: javascript(),

  // ── 其他使用纯文本 ──
  plaintext: [],
};

/**
 * 根据 MLX 语言标识获取 CM6 扩展
 * fallback 到空扩展（纯文本模式）
 */
export function getLanguageExtension(language: string): Extension {
  return LANGUAGE_EXTENSIONS[language] ?? [];
}
