import MarkdownIt from 'markdown-it';
import type { PluginAPI } from '../plugin-api';
import type { PluginManifest, PluginInstance } from '../plugin-types';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  breaks: true,
});

const DARK_THEME_CSS = `
<style>
  body {
    background: #1a1a1e;
    color: #e4e4e7;
    font-family: -apple-system, 'Segoe UI', system-ui, sans-serif;
    padding: 16px 24px;
    line-height: 1.7;
    font-size: 14px;
  }
  h1 { border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; color: #f5f5f7; }
  h2, h3 { color: #f5f5f7; }
  code {
    background: rgba(255,255,255,0.08);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 13px;
    font-family: 'JetBrains Mono', 'Cascadia Code', monospace;
  }
  pre {
    background: rgba(0,0,0,0.3);
    padding: 12px 16px;
    border-radius: 8px;
    overflow-x: auto;
    border: 1px solid rgba(255,255,255,0.06);
  }
  pre code { background: none; padding: 0; }
  blockquote {
    border-left: 3px solid #0a84ff;
    margin-left: 0;
    padding-left: 16px;
    color: #98989e;
  }
  table {
    border-collapse: collapse;
    width: 100%;
  }
  th, td {
    border: 1px solid rgba(255,255,255,0.1);
    padding: 6px 12px;
    text-align: left;
  }
  th { background: rgba(255,255,255,0.05); }
  img { max-width: 100%; border-radius: 6px; }
  a { color: #0a84ff; }
  hr { border: none; border-top: 1px solid rgba(255,255,255,0.1); }
</style>
`;

export const mdPreviewPlugin = {
  manifest: {
    name: 'md-preview',
    version: '1.0.0',
    displayName: 'Markdown 预览',
    description: 'Markdown 文件实时预览，支持 GFM 语法渲染',
    author: 'MLX',
    activationEvents: ['onLanguage:markdown'],
    views: { preview: 'md-preview' },
    keybindings: [
      { key: 'Alt+M', command: 'md-preview.toggle', when: 'editorLang == markdown' },
    ],
    languages: ['markdown', 'md'],
  } as PluginManifest,

  activate(api: PluginAPI): PluginInstance {
    // 注册预览渲染器
    api.views.registerPreview('markdown', (content: string) => {
      const html = md.render(content);
      return `<!DOCTYPE html><html><head><meta charset="utf-8">${DARK_THEME_CSS}</head><body>${html}</body></html>`;
    });

    // 注册快捷键
    api.shortcuts.register('Alt+M', 'md-preview.toggle', () => {
      // 快捷键在 EditorPanel 中处理，这里通过 dispatch 触发
      document.dispatchEvent(new CustomEvent('plugin:togglePreview', {
        detail: { plugin: 'md-preview' },
      }));
    });

    return {
      manifest: mdPreviewPlugin.manifest,
      deactivate: () => {
        api.views.unregisterPreview('markdown');
        api.shortcuts.unregister('Alt+M');
      },
    };
  },
};
