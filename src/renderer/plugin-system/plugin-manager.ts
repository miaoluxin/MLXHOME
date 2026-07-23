import { useEditorStore } from '../stores/useEditorStore';
import { usePluginStore } from './plugin-store';
import { createPluginAPI, type PluginApiDeps } from './plugin-api';
import type { PluginManifest, PluginInstance } from './plugin-types';
import { mdPreviewPlugin } from './built-in/md-preview';
import { plantumlPreviewPlugin } from './built-in/plantuml-preview';

/** 已激活的插件实例 */
const activeInstances = new Map<string, PluginInstance>();

/** 获取 Node.js 的 node 路径 */
function getNodePath(): string {
  return process.execPath.replace('electron.exe', 'node.exe');
}

/** 构造依赖注入对象 */
function createDeps(): PluginApiDeps {
  return {
    getEditorContent: () => {
      const state = useEditorStore.getState();
      const active = state.openFiles.find((f) => f.id === state.activeFileId);
      return active?.content ?? '';
    },
    getEditorLanguage: () => {
      const state = useEditorStore.getState();
      const active = state.openFiles.find((f) => f.id === state.activeFileId);
      return active?.language ?? 'plaintext';
    },
    onEditorChange: (cb: (text: string) => void) => {
      return useEditorStore.subscribe((state: any, prevState: any) => {
        const active = state.openFiles?.find((f: any) => f.id === state.activeFileId);
        const prevActive = prevState.openFiles?.find((f: any) => f.id === prevState.activeFileId);
        if (active && active.content !== prevActive?.content) {
          cb(active.content);
        }
      });
    },
    notify: (message, type) => {
      // 简单的控制台通知，后续可扩展为 Toast
      console.log(`[插件:${type}] ${message}`);
    },
    getNodePath,
  };
}

/** 初始化插件系统 */
export function initPluginSystem(): void {
  const store = usePluginStore.getState();

  // 1. 注册内置插件
  const builtinManifests: PluginManifest[] = [
    mdPreviewPlugin.manifest,
    plantumlPreviewPlugin.manifest,
  ];
  store.setBuiltin(builtinManifests);

  // 2. 激活所有已启用的插件
  const activePlugins = usePluginStore.getState().getActivePlugins();
  for (const manifest of activePlugins) {
    activatePlugin(manifest);
  }
}

/** 激活单个插件 */
export function activatePlugin(manifest: PluginManifest): void {
  if (activeInstances.has(manifest.name)) return;

  try {
    const deps = createDeps();
    const api = createPluginAPI(deps);

    let instance: PluginInstance;

    switch (manifest.name) {
      case 'md-preview':
        instance = mdPreviewPlugin.activate(api);
        break;
      case 'plantuml-preview':
        instance = plantumlPreviewPlugin.activate(api);
        break;
      default:
        console.warn(`[插件] 未知插件: ${manifest.name}`);
        return;
    }

    activeInstances.set(manifest.name, instance);
    console.log(`[插件] 已激活: ${manifest.displayName}`);
  } catch (err) {
    console.error(`[插件] 激活失败: ${manifest.name}`, err);
  }
}

/** 停用插件 */
export function deactivatePlugin(name: string): void {
  const instance = activeInstances.get(name);
  if (!instance) return;
  instance.deactivate?.();
  activeInstances.delete(name);
  console.log(`[插件] 已停用: ${name}`);
}

/** 获取插件实例 */
export function getPluginInstance(name: string): PluginInstance | undefined {
  return activeInstances.get(name);
}

/** 停用所有插件 */
export function deactivateAllPlugins(): void {
  for (const [name] of activeInstances) {
    deactivatePlugin(name);
  }
}
