import type { PluginAPI } from '../plugin-api';
import type { PluginManifest, PluginInstance } from '../plugin-types';

function wrapSvg(svg: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { background: #1a1a1e; display: flex; justify-content: center; align-items: flex-start; padding: 20px; margin: 0; min-height: 100vh; }
    svg { max-width: 100%; height: auto; border-radius: 8px; }
    .error { color: #ef4444; font-family: system-ui; padding: 20px; text-align: center; }
    .loading { color: #98989e; font-family: system-ui; padding: 40px; text-align: center; }
  </style></head><body>${svg}</body></html>`;
}

export const plantumlPreviewPlugin = {
  manifest: {
    name: 'plantuml-preview',
    version: '1.0.0',
    displayName: 'PlantUML 预览',
    description: 'PlantUML 图表实时预览，需要本地 Java 环境',
    author: 'MLX',
    activationEvents: ['onLanguage:plantuml'],
    views: { preview: 'plantuml-preview' },
    keybindings: [
      { key: 'Alt+U', command: 'plantuml-preview.toggle', when: 'editorLang == plantuml' },
    ],
    languages: ['plantuml', 'puml'],
  } as PluginManifest,

  activate(api: PluginAPI): PluginInstance {
    // 注册预览渲染器
    api.views.registerPreview('plantuml', async (content: string) => {
      try {
        const result = await window.electronAPI.plantuml.render(content);
        if (result.success && result.svg) {
          return wrapSvg(result.svg);
        }
        return wrapSvg(`<div class="error">❌ 渲染失败: ${result.error || '未知错误'}</div>`);
      } catch (err: any) {
        return wrapSvg(`<div class="error">❌ 渲染错误: ${err.message}</div>`);
      }
    });

    // 注册快捷键
    api.shortcuts.register('Alt+U', 'plantuml-preview.toggle', () => {
      document.dispatchEvent(new CustomEvent('plugin:togglePreview', {
        detail: { plugin: 'plantuml-preview' },
      }));
    });

    // 启动时检查 Java 环境
    window.electronAPI.plantuml.check().then((result) => {
      if (!result.javaAvailable) {
        console.warn('[PlantUML] Java 不可用:', result.error);
      } else if (!result.jarDownloaded) {
        console.log('[PlantUML] 需要下载 plantuml.jar...');
        // 首次使用时自动下载
        fetch('http://localhost:plantuml-download'); // 后续通过 IPC 处理
      }
    });

    return {
      manifest: plantumlPreviewPlugin.manifest,
      deactivate: () => {
        api.views.unregisterPreview('plantuml');
        api.shortcuts.unregister('Alt+U');
      },
    };
  },
};
