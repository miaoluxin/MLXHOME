import { useState, useEffect } from 'react';
import { VscClose, VscAdd, VscTrash } from 'react-icons/vsc';
import { useThemeStore, BUILT_IN_THEMES, clearInlineColors, type CustomTheme, type ThemeColors, type BuiltInThemeId } from '../../stores/useThemeStore';

interface Props {
  onClose: () => void;
}

const BUILT_IN_NAMES: Record<BuiltInThemeId, string> = {
  dark: '暗黑',
  light: '白黑',
  'high-contrast': '高对比度科技感',
};

const BUILT_IN_IDS: BuiltInThemeId[] = ['dark', 'light', 'high-contrast'];

const COLOR_FIELDS: { key: keyof ThemeColors; label: string; group: string }[] = [
  { key: 'bgDeepest', label: '主背景', group: '背景' },
  { key: 'bgDeep', label: '面板背景', group: '背景' },
  { key: 'bgBase', label: '输入框背景', group: '背景' },
  { key: 'bgRaised', label: '菜单/弹窗背景', group: '背景' },
  { key: 'bgHover', label: '悬停态背景', group: '背景' },
  { key: 'textPrimary', label: '主文字色', group: '文字' },
  { key: 'textSecondary', label: '次要文字色', group: '文字' },
  { key: 'textTertiary', label: '辅助文字色', group: '文字' },
  { key: 'accent', label: '强调色', group: '强调' },
  { key: 'accentHover', label: '强调色(悬停)', group: '强调' },
  { key: 'borderSubtle', label: '边框(细)', group: '边框' },
  { key: 'borderHover', label: '边框(悬停)', group: '边框' },
  { key: 'glassBg', label: '毛玻璃背景', group: '面板' },
  { key: 'scrollbarThumb', label: '滚动条', group: '面板' },
  { key: 'scrollbarThumbHover', label: '滚动条(悬停)', group: '面板' },
  { key: 'windowBg', label: '窗口背景', group: '面板' },
  { key: 'terminalBg', label: '终端背景', group: '终端' },
  { key: 'terminalFg', label: '终端文字', group: '终端' },
  { key: 'terminalCursor', label: '终端光标', group: '终端' },
];

const GROUPS = ['背景', '文字', '强调', '边框', '面板', '终端', '透明度'];

/** Extract alpha from rgba color string */
function extractAlpha(color: string): number {
  if (!color.startsWith('rgba(')) return 1.0;
  const parts = color.replace('rgba(', '').replace(')', '').split(',').map(s => parseFloat(s.trim()));
  if (parts.length >= 4) return parts[3];
  return 1.0;
}

/** Set alpha on a color string (handles both hex and rgba) */
function setAlpha(color: string, alpha: number): string {
  if (color.startsWith('#')) {
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
  }
  if (color.startsWith('rgba(')) {
    return color.replace(/[\d.]+\)$/, `${alpha.toFixed(2)})`);
  }
  return color;
}

function makeDefaultColors(): ThemeColors {
  return {
    bgDeepest: '#1a1b26', bgDeep: '#1f2335', bgBase: '#24283b',
    bgRaised: '#292e42', bgHover: '#343a52',
    textPrimary: '#c0caf5', textSecondary: '#787c99', textTertiary: '#565f89',
    accent: '#7aa2f7', accentHover: '#89b4fa',
    borderSubtle: 'rgba(192,202,245,0.08)', borderHover: 'rgba(192,202,245,0.14)',
    glassBg: 'rgba(26,27,38,0.85)', glassBlur: '20px',
    scrollbarThumb: 'rgba(192,202,245,0.12)', scrollbarThumbHover: 'rgba(192,202,245,0.22)',
    windowBg: '#1a1b26', globalOpacity: '1',
    terminalBg: '#15161e', terminalFg: '#c0caf5', terminalCursor: '#7aa2f7',
  };
}

export function ThemeManager({ onClose }: Props) {
  const { current, customThemes, setTheme, addCustomTheme, updateCustomTheme, deleteCustomTheme, previewColors, getCurrentColors } = useThemeStore();

  const [selectedId, setSelectedId] = useState<string>(current);
  const [editingName, setEditingName] = useState('');
  const [editingColors, setEditingColors] = useState<ThemeColors>(getCurrentColors());
  const [editingFontSize, setEditingFontSize] = useState({ ui: 13, editor: 13, terminal: 13 });
  const [isNew, setIsNew] = useState(false);

  // 选中主题时加载其配色
  const selectTheme = (id: string) => {
    setSelectedId(id);
    setIsNew(false);
    if (id in BUILT_IN_NAMES) {
      // 内置主题：清除残留内联样式后用CSS data-theme预览
      clearInlineColors();
      document.documentElement.dataset.theme = id;
      // 直接从内置主题常量加载正确颜色（而非依赖store.current）
      setEditingColors({ ...BUILT_IN_THEMES[id as BuiltInThemeId] });
      setEditingName('');
    } else {
      const ct = customThemes.find(t => t.id === id);
      if (ct) {
        setEditingColors({ ...ct.colors });
        setEditingFontSize({ ...ct.fontSize });
        setEditingName(ct.name);
        previewColors(ct.colors);
      }
    }
  };

  // 新建自定义主题
  const handleNew = () => {
    const id = 'custom-' + Date.now();
    const colors = getCurrentColors();
    setSelectedId(id);
    setIsNew(true);
    setEditingName('我的主题');
    setEditingColors({ ...colors });
    setEditingFontSize({ ui: 13, editor: 13, terminal: 13 });
    previewColors(colors);
  };

  // 保存
  const handleSave = () => {
    const newTheme: CustomTheme = {
      id: selectedId,
      name: editingName || '未命名',
      colors: { ...editingColors },
      fontSize: { ...editingFontSize },
    };
    if (isNew) {
      addCustomTheme(newTheme);
      setIsNew(false);
    } else {
      updateCustomTheme(newTheme);
    }
  };

  // 删除
  const handleDelete = () => {
    if (selectedId in BUILT_IN_NAMES) return;
    deleteCustomTheme(selectedId);
    setSelectedId('dark');
    setTheme('dark');
    selectTheme('dark');
  };

  // 颜色变化 → 实时预览
  const handleColorChange = (key: keyof ThemeColors, value: string) => {
    const next = { ...editingColors, [key]: value };
    setEditingColors(next);
    previewColors(next);
  };

  // 恢复内置主题默认配色
  const handleRestoreDefaults = () => {
    if (!isBuiltIn) return;
    const builtInId = selectedId as BuiltInThemeId;
    const defaults = BUILT_IN_THEMES[builtInId];
    // 恢复CSS变量为默认值
    clearInlineColors();
    document.documentElement.dataset.theme = builtInId;
    // 更新编辑器显示默认颜色
    setEditingColors({ ...defaults });
    // 应用并关闭
    setTheme(builtInId);
    onClose();
  };

  // 应用选中的主题
  const handleApply = () => {
    setTheme(selectedId);
    onClose();
  };

  const isBuiltIn = selectedId in BUILT_IN_NAMES;
  const canDelete = !isBuiltIn && !isNew;

  // 转义特殊字符用于CSS变量
  const formatForInput = (val: string) => {
    // rgba值直接返回，hex值直接返回
    return val;
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="flex w-[800px] h-[560px] bg-bg-deep border border-border-subtle rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── 左侧：主题列表 ── */}
        <div className="w-48 border-r border-border-subtle flex flex-col">
          <div className="px-3 py-2 text-xs font-medium text-text-secondary border-b border-border-subtle">
            主题列表
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {/* 内置主题 */}
            {BUILT_IN_IDS.map((id) => (
              <button
                key={id}
                onClick={() => selectTheme(id)}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors
                  ${selectedId === id ? 'bg-accent/20 text-accent' : 'text-text-primary hover:bg-bg-hover'}`}
              >
                {BUILT_IN_NAMES[id]}
                {current === id && <span className="text-text-tertiary ml-1">●</span>}
              </button>
            ))}
            {/* 分隔线 */}
            <div className="h-px bg-border-subtle my-1 mx-2" />
            {/* 自定义主题 */}
            {customThemes.map((ct) => (
              <button
                key={ct.id}
                onClick={() => selectTheme(ct.id)}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors flex items-center justify-between
                  ${selectedId === ct.id ? 'bg-accent/20 text-accent' : 'text-text-primary hover:bg-bg-hover'}`}
              >
                <span className="truncate flex-1">{ct.name}</span>
                {current === ct.id && <span className="text-text-tertiary ml-1">●</span>}
              </button>
            ))}
          </div>
          <div className="border-t border-border-subtle p-2 flex gap-1">
            <button onClick={handleNew} className="flex-1 flex items-center justify-center gap-1 px-2 py-1 text-xs bg-accent/10 text-accent rounded hover:bg-accent/20 transition-colors">
              <VscAdd size={12} /> 新建
            </button>
            <button onClick={onClose} className="px-2 py-1 text-xs text-text-secondary hover:text-text-primary rounded hover:bg-bg-hover transition-colors">
              <VscClose size={12} />
            </button>
          </div>
        </div>

        {/* ── 右侧：颜色编辑器 ── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border-subtle">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-text-primary">
                {isBuiltIn ? BUILT_IN_NAMES[selectedId as BuiltInThemeId] + ' (内置)' : (isNew ? '新建主题' : editingName)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {isBuiltIn && (
                <button onClick={handleRestoreDefaults} className="px-2 py-1 text-xs border border-border-subtle text-text-secondary rounded hover:bg-bg-hover hover:text-text-primary transition-colors" title="恢复为出厂配色">
                  恢复默认
                </button>
              )}
              {canDelete && (
                <button onClick={handleDelete} className="px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded transition-colors">
                  <VscTrash size={14} />
                </button>
              )}
              <button onClick={handleApply} className="px-3 py-1 text-xs bg-accent text-white rounded hover:bg-accent-hover transition-colors">应用</button>
            </div>
          </div>

          {/* 名称输入（自定义主题） */}
          {!isBuiltIn && (
            <div className="px-4 py-2 border-b border-border-subtle flex items-center gap-2">
              <span className="text-xs text-text-secondary">名称:</span>
              <input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                className="flex-1 bg-bg-base border border-border-subtle rounded px-2 py-1 text-xs text-text-primary outline-none focus:border-accent"
              />
            </div>
          )}

          {/* 颜色选择器 */}
          <div className="flex-1 overflow-y-auto p-4">
            {GROUPS.map((group) => (
              <div key={group} className="mb-4">
                <div className="text-[10px] font-medium text-text-tertiary mb-2 uppercase tracking-wider">{group}</div>
                <div className="grid grid-cols-3 gap-2">
                  {COLOR_FIELDS.filter(f => f.group === group).map((field) => (
                    <div key={field.key} className="flex items-center gap-2">
                      <input
                        type="color"
                        value={editingColors[field.key].startsWith('rgba') || editingColors[field.key].startsWith('#')
                          ? (editingColors[field.key].startsWith('#') && editingColors[field.key].length === 7 ? editingColors[field.key] : '#000000')
                          : '#000000'}
                        onChange={(e) => handleColorChange(field.key, e.target.value)}
                        className="w-6 h-6 rounded cursor-pointer border border-border-subtle flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-text-secondary truncate">{field.label}</div>
                        <input
                          value={editingColors[field.key]}
                          onChange={(e) => handleColorChange(field.key, e.target.value)}
                          className="w-full bg-bg-base border border-border-subtle rounded px-1 py-0 text-[10px] text-text-primary outline-none focus:border-accent"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* 字体大小 */}
            <div className="mb-4">
              <div className="text-[10px] font-medium text-text-tertiary mb-2 uppercase tracking-wider">字体大小</div>
              <div className="space-y-2">
                {[
                  { key: 'ui' as const, label: '界面字体' },
                  { key: 'editor' as const, label: '编辑器字体' },
                  { key: 'terminal' as const, label: '终端字体' },
                ].map((fs) => (
                  <div key={fs.key} className="flex items-center gap-2">
                    <span className="text-[10px] text-text-secondary w-16">{fs.label}</span>
                    <input
                      type="range"
                      min={fs.key === 'ui' ? 11 : 10}
                      max={fs.key === 'editor' ? 24 : 20}
                      value={editingFontSize[fs.key]}
                      onChange={(e) => setEditingFontSize({ ...editingFontSize, [fs.key]: parseInt(e.target.value) })}
                      className="flex-1"
                    />
                    <span className="text-[10px] text-text-tertiary w-8 text-right">{editingFontSize[fs.key]}px</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── 透明度 ── */}
            <div className="mb-4">
              <div className="text-[10px] font-medium text-text-tertiary mb-2 uppercase tracking-wider">透明度</div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-text-secondary w-16">全局透明度</span>
                  <input
                    type="range"
                    min="50"
                    max="100"
                    value={Math.round(parseFloat(editingColors.globalOpacity || '1') * 100)}
                    onChange={(e) => {
                      const val = (parseInt(e.target.value) / 100).toFixed(2);
                      const next = { ...editingColors, globalOpacity: val };
                      setEditingColors(next);
                      previewColors(next);
                    }}
                    className="flex-1"
                  />
                  <span className="text-[10px] text-text-tertiary w-10 text-right">{Math.round(parseFloat(editingColors.globalOpacity || '1') * 100)}%</span>
                </div>
                {[
                  { key: 'bgDeepest' as keyof ThemeColors, label: '主背景' },
                  { key: 'bgDeep' as keyof ThemeColors, label: '面板背景' },
                  { key: 'bgBase' as keyof ThemeColors, label: '输入框背景' },
                  { key: 'glassBg' as keyof ThemeColors, label: '毛玻璃' },
                  { key: 'borderSubtle' as keyof ThemeColors, label: '边框' },
                  { key: 'scrollbarThumb' as keyof ThemeColors, label: '滚动条' },
                ].map((item) => {
                  const color = editingColors[item.key];
                  const isRgba = typeof color === 'string' && color.startsWith('rgba(');
                  const currentAlpha = isRgba ? extractAlpha(color) : 1.0;
                  return (
                    <div key={item.key} className="flex items-center gap-2">
                      <span className="text-[10px] text-text-secondary w-16 truncate">{item.label}</span>
                      <input
                        type="range"
                        min="10"
                        max="100"
                        value={Math.round(currentAlpha * 100)}
                        onChange={(e) => {
                          const newAlpha = parseInt(e.target.value) / 100;
                          const newColor = setAlpha(color, newAlpha);
                          handleColorChange(item.key, newColor);
                        }}
                        className="flex-1"
                      />
                      <span className="text-[10px] text-text-tertiary w-10 text-right">{Math.round(currentAlpha * 100)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 底部按钮 */}
          {!isBuiltIn && (
            <div className="px-4 py-3 border-t border-border-subtle flex justify-end gap-2">
              <button onClick={handleSave} className="px-4 py-1.5 text-xs bg-accent text-white rounded-md hover:bg-accent-hover transition-colors">
                保存主题
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
