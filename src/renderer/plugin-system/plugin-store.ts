import { create } from 'zustand';
import type { PluginManifest, PluginState } from './plugin-types';

const STORAGE_KEY = 'mlx-plugins';

function loadInstalled(): PluginManifest[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveInstalled(plugins: PluginManifest[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plugins));
}

interface PluginStore extends PluginState {
  /** 设置内置插件列表（不可卸载） */
  setBuiltin: (plugins: PluginManifest[]) => void;
  /** 安装插件 */
  installPlugin: (manifest: PluginManifest) => void;
  /** 卸载插件 */
  uninstallPlugin: (name: string) => void;
  /** 启用/禁用 */
  toggleActive: (name: string) => void;
  /** 是否已安装 */
  isInstalled: (name: string) => boolean;
  /** 获取已启用的插件清单 */
  getActivePlugins: () => PluginManifest[];
  /** 获取所有插件（内置+用户安装） */
  getAllPlugins: () => PluginManifest[];
}

export const usePluginStore = create<PluginStore>((set, get) => ({
  installed: loadInstalled(),
  active: {},
  loading: false,
  error: null,

  setBuiltin: (plugins) => {
    const current = get().installed;
    // 只添加不在列表中的内置插件
    const existingNames = new Set(current.map((p) => p.name));
    const newBuiltin = plugins.filter((p) => !existingNames.has(p.name));
    if (newBuiltin.length === 0) return;
    const next = [...current, ...newBuiltin];
    // 自动启用内置插件
    const active = { ...get().active };
    for (const p of newBuiltin) {
      active[p.name] = true;
    }
    saveInstalled(next);
    set({ installed: next, active });
  },

  installPlugin: (manifest) => {
    const current = get().installed;
    if (current.some((p) => p.name === manifest.name)) return;
    const next = [...current, manifest];
    const active = { ...get().active, [manifest.name]: true };
    saveInstalled(next);
    set({ installed: next, active });
  },

  uninstallPlugin: (name) => {
    const next = get().installed.filter((p) => p.name !== name);
    const active = { ...get().active };
    delete active[name];
    saveInstalled(next);
    set({ installed: next, active });
  },

  toggleActive: (name) => {
    set((s) => ({
      active: { ...s.active, [name]: !s.active[name] },
    }));
  },

  isInstalled: (name) => get().installed.some((p) => p.name === name),

  getActivePlugins: () => get().installed.filter((p) => get().active[p.name]),

  getAllPlugins: () => get().installed,
}));
