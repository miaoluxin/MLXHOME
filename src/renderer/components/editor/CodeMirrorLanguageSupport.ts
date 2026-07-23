import type { Extension } from '@codemirror/state';

const LANG_MODULES: Record<string, () => Promise<any>> = {
  javascript: () => import('@codemirror/lang-javascript'),
  json: () => import('@codemirror/lang-json'),
  html: () => import('@codemirror/lang-html'),
  css: () => import('@codemirror/lang-css'),
  markdown: () => import('@codemirror/lang-markdown'),
  python: () => import('@codemirror/lang-python'),
  java: () => import('@codemirror/lang-java'),
  cpp: () => import('@codemirror/lang-cpp'),
  xml: () => import('@codemirror/lang-xml'),
  sql: () => import('@codemirror/lang-sql'),
  rust: () => import('@codemirror/lang-rust'),
  go: () => import('@codemirror/lang-go'),
  php: () => import('@codemirror/lang-php'),
  yaml: () => import('@codemirror/lang-yaml'),
};

const extCache = new Map<string, Extension>();

const LANG_ALIAS: Record<string, string> = {
  typescript: 'javascript', tsx: 'javascript', jsx: 'javascript',
  scss: 'css', less: 'css',
  yml: 'yaml', properties: 'yaml', md: 'markdown',
  c: 'cpp', csharp: 'cpp',
  ruby: 'python',
  shell: 'javascript', powershell: 'javascript', sh: 'javascript', bash: 'javascript', zsh: 'javascript',
};

async function getLang(lang: string): Promise<Extension> {
  const cached = extCache.get(lang);
  if (cached) return cached;
  const loader = LANG_MODULES[lang];
  if (!loader) return [];
  try {
    const mod = await loader();
    const ext = typeof mod === 'function' ? mod() : (typeof mod.default === 'function' ? mod.default() : mod);
    extCache.set(lang, ext);
    return ext;
  } catch { return []; }
}

export async function getLanguageExtension(language: string): Promise<Extension> {
  if (language === 'plaintext') return [];
  const base = LANG_ALIAS[language] || language;
  if (LANG_MODULES[base]) return getLang(base);
  return [];
}

export function preloadLanguage(language: string): void {
  const base = LANG_ALIAS[language] || language;
  if (LANG_MODULES[base]) LANG_MODULES[base]().catch(() => {});
}
