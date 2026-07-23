/** 插件清单 */
export interface PluginManifest {
  name: string;
  version: string;
  displayName: string;
  description: string;
  author: string;
  /** 激活事件: onLanguage:markdown | onCommand:xxx | startup */
  activationEvents: string[];
  /** 注册的视图类型 */
  views?: {
    preview?: string;   // 预览视图 ID
  };
  /** 快捷键绑定 */
  keybindings?: Array<{
    key: string;
    command: string;
    when?: string;
  }>;
  /** 关联的语言 */
  languages?: string[];
}

/** 插件实例（激活后的运行时） */
export interface PluginInstance {
  manifest: PluginManifest;
  /** 停用函数 */
  deactivate?: () => void;
  /** 快捷键回调映射 */
  keybindings?: Map<string, () => void>;
}

/** 插件状态 */
export interface PluginState {
  installed: PluginManifest[];
  active: Record<string, boolean>;
  loading: boolean;
  error: string | null;
}

/** 预览渲染函数 */
export type PreviewRenderer = (content: string) => string | Promise<string>;
