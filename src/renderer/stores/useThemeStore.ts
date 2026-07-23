import { create } from 'zustand';

// ── 内置主题ID ──
export type BuiltInThemeId = 'dark' | 'light' | 'high-contrast';
export type ThemeId = BuiltInThemeId | string;

const STORAGE_KEY = 'mlx-theme';
const CUSTOM_STORAGE_KEY = 'mlx-custom-themes';

// ── 主题颜色定义 ──
export interface ThemeColors {
  bgDeepest: string;
  bgDeep: string;
  bgBase: string;
  bgRaised: string;
  bgHover: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentHover: string;
  borderSubtle: string;
  borderHover: string;
  glassBg: string;
  glassBlur: string;
  scrollbarThumb: string;
  scrollbarThumbHover: string;
  windowBg: string;
  globalOpacity: string;
  terminalBg: string;
  terminalFg: string;
  terminalCursor: string;
}

export interface CustomTheme {
  id: string;
  name: string;
  colors: ThemeColors;
  fontSize: { ui: number; editor: number; terminal: number };
}

// ── 内置主题配色 ──
const BUILT_IN_THEMES: Record<BuiltInThemeId, ThemeColors> = {
  dark: {
    bgDeepest: '#1a1b26', bgDeep: '#1f2335', bgBase: '#24283b',
    bgRaised: '#292e42', bgHover: '#343a52',
    textPrimary: '#c0caf5', textSecondary: '#787c99', textTertiary: '#565f89',
    accent: '#7aa2f7', accentHover: '#89b4fa',
    borderSubtle: 'rgba(192,202,245,0.08)', borderHover: 'rgba(192,202,245,0.14)',
    glassBg: 'rgba(26,27,38,0.85)', glassBlur: '20px',
    scrollbarThumb: 'rgba(192,202,245,0.12)', scrollbarThumbHover: 'rgba(192,202,245,0.22)',
    windowBg: '#1a1b26', globalOpacity: '1',
    terminalBg: '#15161e', terminalFg: '#c0caf5', terminalCursor: '#7aa2f7',
  },
  light: {
    bgDeepest: '#ffffff', bgDeep: '#f6f8fa', bgBase: '#eaeef2',
    bgRaised: '#ffffff', bgHover: '#d0d7de',
    textPrimary: '#0d0d0d', textSecondary: '#333333', textTertiary: '#555555',
    accent: '#0550ae', accentHover: '#0969da',
    borderSubtle: 'rgba(0,0,0,0.08)', borderHover: 'rgba(0,0,0,0.16)',
    glassBg: 'rgba(255,255,255,0.92)', glassBlur: '20px',
    scrollbarThumb: 'rgba(0,0,0,0.15)', scrollbarThumbHover: 'rgba(0,0,0,0.25)',
    windowBg: '#ffffff', globalOpacity: '1',
    terminalBg: '#f6f8fa', terminalFg: '#0d0d0d', terminalCursor: '#0550ae',
  },
  'high-contrast': {
    bgDeepest: '#0a1628', bgDeep: '#0f1d35', bgBase: '#152340',
    bgRaised: '#1a2d4a', bgHover: '#253d5f',
    textPrimary: '#ffffff', textSecondary: '#b8cce0', textTertiary: '#6a85a8',
    accent: '#00e5ff', accentHover: '#40ffff',
    borderSubtle: 'rgba(0,229,255,0.15)', borderHover: 'rgba(0,229,255,0.30)',
    glassBg: 'rgba(10,22,40,0.92)', glassBlur: '20px',
    scrollbarThumb: 'rgba(0,229,255,0.15)', scrollbarThumbHover: 'rgba(0,229,255,0.28)',
    windowBg: '#0a1628', globalOpacity: '1',
    terminalBg: '#060f1c', terminalFg: '#00ffcc', terminalCursor: '#00e5ff',
  },
};

// ── 加载自定义主题 ──
function loadCustomThemes(): CustomTheme[] {
  try {
    const raw = localStorage.getItem(CUSTOM_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveCustomThemes(themes: CustomTheme[]) {
  try {
    localStorage.setItem(CUSTOM_STORAGE_KEY, JSON.stringify(themes));
  } catch { /* ignore */ }
}

function loadThemeId(): string {
  try {
    const id = localStorage.getItem(STORAGE_KEY) || 'dark';
    // 迁移：已删除 frosted-glass 主题，回退到 dark
    if (id === 'frosted-glass') return 'dark';
    return id;
  } catch { return 'dark'; }
}

function getColorsForTheme(themeId: string, customThemes: CustomTheme[]): ThemeColors | null {
  if (themeId in BUILT_IN_THEMES) return BUILT_IN_THEMES[themeId as BuiltInThemeId];
  return customThemes.find(t => t.id === themeId)?.colors ?? null;
}

// ── 清除内联主题样式（让CSS data-theme选择器接管）──
function clearInlineColors() {
  const root = document.documentElement;
  const vars = [
    '--bg-deepest', '--bg-deep', '--bg-base', '--bg-raised', '--bg-hover',
    '--text-primary', '--text-secondary', '--text-tertiary',
    '--accent', '--accent-hover',
    '--border-subtle', '--border-hover',
    '--glass-bg', '--glass-blur',
    '--scrollbar-thumb', '--scrollbar-thumb-hover',
    '--window-bg', '--global-opacity',
  ];
  vars.forEach(v => root.style.removeProperty(v));
}

// ── 应用主题到DOM ──
function applyColors(colors: ThemeColors) {
  const root = document.documentElement;
  // 清除 data-theme（自定义主题不使用CSS选择器）
  root.dataset.theme = '';
  root.style.setProperty('--bg-deepest', colors.bgDeepest);
  root.style.setProperty('--bg-deep', colors.bgDeep);
  root.style.setProperty('--bg-base', colors.bgBase);
  root.style.setProperty('--bg-raised', colors.bgRaised);
  root.style.setProperty('--bg-hover', colors.bgHover);
  root.style.setProperty('--text-primary', colors.textPrimary);
  root.style.setProperty('--text-secondary', colors.textSecondary);
  root.style.setProperty('--text-tertiary', colors.textTertiary);
  root.style.setProperty('--accent', colors.accent);
  root.style.setProperty('--accent-hover', colors.accentHover);
  root.style.setProperty('--border-subtle', colors.borderSubtle);
  root.style.setProperty('--border-hover', colors.borderHover);
  root.style.setProperty('--glass-bg', colors.glassBg);
  root.style.setProperty('--glass-blur', colors.glassBlur);
  root.style.setProperty('--scrollbar-thumb', colors.scrollbarThumb);
  root.style.setProperty('--scrollbar-thumb-hover', colors.scrollbarThumbHover);
  root.style.setProperty('--window-bg', colors.windowBg);
  root.style.setProperty('--global-opacity', colors.globalOpacity || '1');
}

function applyTheme(themeId: string, customThemes: CustomTheme[]) {
  // 保存选择
  try { localStorage.setItem(STORAGE_KEY, themeId); } catch { /* ignore */ }

  if (themeId in BUILT_IN_THEMES) {
    // 内置主题：清除残留内联样式后使用CSS data-theme选择器
    clearInlineColors();
    document.documentElement.dataset.theme = themeId;
    const colors = BUILT_IN_THEMES[themeId as BuiltInThemeId];
    try { window.electronAPI?.window?.setBackgroundColor(colors.windowBg); } catch { /* ignore */ }
  } else {
    // 自定义主题：逐个注入CSS变量
    const ct = customThemes.find(t => t.id === themeId);
    if (ct) {
      applyColors(ct.colors);
      try { window.electronAPI?.window?.setBackgroundColor(ct.colors.windowBg); } catch { /* ignore */ }
    }
  }
}

// ── Store ──
interface ThemeState {
  current: string;
  customThemes: CustomTheme[];
  setTheme: (themeId: string) => void;
  addCustomTheme: (theme: CustomTheme) => void;
  updateCustomTheme: (theme: CustomTheme) => void;
  deleteCustomTheme: (id: string) => void;
  previewColors: (colors: ThemeColors) => void;
  getCurrentColors: () => ThemeColors;
  getBuiltInThemes: () => BuiltInThemeId[];
  getBuiltInColors: (id: BuiltInThemeId) => ThemeColors;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const customThemes = loadCustomThemes();
  const currentId = loadThemeId();
  applyTheme(currentId, customThemes);

  return {
    current: currentId,
    customThemes,

    setTheme: (themeId) => {
      applyTheme(themeId, get().customThemes);
      set({ current: themeId });
    },

    addCustomTheme: (theme) => {
      const next = [...get().customThemes, theme];
      saveCustomThemes(next);
      set({ customThemes: next });
    },

    updateCustomTheme: (theme) => {
      const next = get().customThemes.map(t => t.id === theme.id ? theme : t);
      saveCustomThemes(next);
      set({ customThemes: next });
      // 如果正在使用该主题，重新应用
      if (get().current === theme.id) {
        applyColors(theme.colors);
      }
    },

    deleteCustomTheme: (id) => {
      const next = get().customThemes.filter(t => t.id !== id);
      saveCustomThemes(next);
      // 如果当前用的是被删除的主题，切回暗黑
      if (get().current === id) {
        applyTheme('dark', next);
        set({ current: 'dark', customThemes: next });
      } else {
        set({ customThemes: next });
      }
    },

    previewColors: (colors) => {
      applyColors(colors);
    },

    getCurrentColors: () => {
      return getColorsForTheme(get().current, get().customThemes) ?? BUILT_IN_THEMES.dark;
    },

    getBuiltInThemes: () => ['dark', 'light', 'high-contrast'] as BuiltInThemeId[],

    getBuiltInColors: (id) => BUILT_IN_THEMES[id],
  };
});

// 导出供外部使用（ThemeManager等）
export { BUILT_IN_THEMES, getColorsForTheme, clearInlineColors };
