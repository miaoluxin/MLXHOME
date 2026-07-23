import { useState, useRef, useEffect, type ReactNode, useCallback } from 'react';
import { VscChromeMinimize, VscChromeMaximize, VscChromeClose } from 'react-icons/vsc';
import { undo, redo } from '@codemirror/commands';
import { useProjectStore } from '../../stores/useProjectStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { useLayoutStore } from '../../stores/useLayoutStore';
import { useThemeStore } from '../../stores/useThemeStore';
import { ThemeManager } from '../theme/ThemeManager';
import { ShortcutHelp } from './ShortcutHelp';

interface Props {
  children: ReactNode;
  onSwitchProject?: () => void;
}

interface MenuItem {
  label: string;
  shortcut?: string;
  disabled?: boolean;
  divider?: boolean;
  action?: () => void;
  checked?: boolean;
  submenu?: MenuItem[];
}

interface MenuGroup {
  label: string;
  items: MenuItem[];
}

export function AppShell({ children, onSwitchProject }: Props) {
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const projectPath = useProjectStore((s) => s.projectPath);
  const projectName = projectPath?.split(/[/\\]/).pop() || '';
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [submenuOpen, setSubmenuOpen] = useState<string | null>(null);
  const [themeManagerOpen, setThemeManagerOpen] = useState(false);
  const [gitBranch, setGitBranch] = useState('');
  const menuBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!projectPath) return;
    window.electronAPI.fs.read(projectPath.replace(/\\/g, '/') + '/.git/HEAD').then((content) => {
      const m = content.match(/ref:\s*refs\/heads\/(.+)/);
      if (m) setGitBranch(m[1].trim());
    }).catch(() => setGitBranch(''));
  }, [projectPath]);

  // 点击菜单外部时关闭
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    if (openMenu) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [openMenu]);

  // Ctrl+Shift+/ 快捷键帮助
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '/' || e.key === '?')) {
        e.preventDefault();
        setShowShortcutHelp(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleMinimize = () => window.electronAPI.window.minimize();
  const handleMaximize = () => window.electronAPI.window.maximize();
  const handleClose = () => window.electronAPI.window.close();

  // ── 动态主题菜单 ──
  const currentThemeId = useThemeStore((s) => s.current);
  const customThemes = useThemeStore((s) => s.customThemes);
  const themeItems: MenuItem[] = [
    { label: '暗黑', checked: currentThemeId === 'dark', action: () => useThemeStore.getState().setTheme('dark') },
    { label: '白黑', checked: currentThemeId === 'light', action: () => useThemeStore.getState().setTheme('light') },
    { label: '高对比度科技感', checked: currentThemeId === 'high-contrast', action: () => useThemeStore.getState().setTheme('high-contrast') },
    ...(customThemes.length > 0 ? [{ label: '', divider: true, action: () => {} }] : []),
    ...customThemes.map((ct): MenuItem => ({
      label: ct.name,
      checked: currentThemeId === ct.id,
      action: () => useThemeStore.getState().setTheme(ct.id),
    })),
    { label: '', divider: true, action: () => {} },
    { label: '管理主题...', action: () => { setOpenMenu(null); setThemeManagerOpen(true); } },
  ];

  const menus: MenuGroup[] = [
    {
      label: '文件',
      items: [
        { label: '新建', shortcut: 'Ctrl+N', action: () => useEditorStore.getState().createNewFile() },
        { label: '打开', shortcut: 'Ctrl+O', action: async () => {
          const filePath = await window.electronAPI.dialog.openFile();
          if (filePath) {
            try {
              const content = await window.electronAPI.fs.read(filePath);
              if (content && !content.includes('\x00')) {
                useEditorStore.getState().openFile(filePath, content);
              }
            } catch { /* ignore */ }
          }
        }},
        { label: '保存', shortcut: 'Ctrl+S', action: async () => {
          const editor = useEditorStore.getState();
          const file = editor.openFiles.find(f => f.id === editor.activeFileId);
          if (!file || !file.isDirty) return;
          if (!file.path) {
            const newPath = await window.electronAPI.dialog.saveFile();
            if (newPath) {
              await window.electronAPI.fs.write(newPath, file.content);
              editor.saveAsFile(file.id, newPath, file.content);
            }
          } else {
            await window.electronAPI.fs.write(file.path, file.content);
            editor.markClean(file.id);
          }
        }},
        { label: '另存为', shortcut: 'Ctrl+Shift+S', action: async () => {
          const editor = useEditorStore.getState();
          const file = editor.openFiles.find(f => f.id === editor.activeFileId);
          if (!file) return;
          const newPath = await window.electronAPI.dialog.saveFile();
          if (newPath) {
            await window.electronAPI.fs.write(newPath, file.content);
            editor.saveAsFile(file.id, newPath, file.content);
          }
        }},
        { label: '', divider: true, action: () => {} },
        { label: '关闭', shortcut: 'Ctrl+W', action: () => {
          const editor = useEditorStore.getState();
          if (editor.activeFileId) {
            const file = editor.openFiles.find(f => f.id === editor.activeFileId);
            if (file?.isDirty) {
              const confirmed = window.confirm(`"${file.name}" 有未保存的更改，确定要关闭吗？`);
              if (!confirmed) return;
            }
            editor.closeFile(editor.activeFileId);
          }
        }},
        { label: '关闭所有', action: () => {
          const editor = useEditorStore.getState();
          const dirtyFiles = editor.openFiles.filter(f => f.isDirty);
          if (dirtyFiles.length > 0) {
            const confirmed = window.confirm(`有 ${dirtyFiles.length} 个文件未保存，确定要关闭所有吗？`);
            if (!confirmed) return;
          }
          editor.openFiles.forEach(f => editor.closeFile(f.id));
        }},
        { label: '', divider: true, action: () => {} },
        { label: '关闭窗口', shortcut: 'Alt+F4', action: () => window.electronAPI.window.close() },
      ],
    },
    {
      label: '编辑',
      items: [
        { label: '撤销', shortcut: 'Ctrl+Z', action: () => {
          const view = useEditorStore.getState().editorView;
          if (view) undo(view);
        }},
        { label: '重做', shortcut: 'Ctrl+Y', action: () => {
          const view = useEditorStore.getState().editorView;
          if (view) redo(view);
        }},
        { label: '', divider: true, action: () => {} },
        { label: '查找', shortcut: 'Ctrl+F', action: () => useEditorStore.getState().toggleFindPanel() },
        { label: '替换', shortcut: 'Ctrl+H', action: () => useEditorStore.getState().toggleReplacePanel() },
        { label: '', divider: true, action: () => {} },
        { label: '切换列模式', action: () => useEditorStore.getState().toggleColumnMode() },
        { label: '切换自动换行', action: () => useEditorStore.getState().toggleWordWrap() },
      ],
    },
    {
      label: '视图',
      items: [
        { label: '三列排版 (5:3:2)', action: () => useLayoutStore.getState().applyThreeColumnVertical(window.innerWidth) },
        { label: '三列一横 (搜索在底部)', action: () => useLayoutStore.getState().applyThreeColumnHorizontal(window.innerWidth) },
        { label: '自由排版', action: () => useLayoutStore.getState().initWidths(window.innerWidth) },
        { label: '', divider: true, action: () => {} },
        { label: '工具显示 ▶', submenu: [
          { label: '终端', checked: useLayoutStore.getState().showTerminal, action: () => {
            const s = useLayoutStore.getState();
            s.setShowTerminal(!s.showTerminal);
          }},
          { label: '编辑器', checked: useLayoutStore.getState().showEditor, action: () => {
            const s = useLayoutStore.getState();
            s.setShowEditor(!s.showEditor);
          }},
          { label: '文件浏览器', checked: useLayoutStore.getState().showFileBrowser, action: () => {
            const s = useLayoutStore.getState();
            s.setShowFileBrowser(!s.showFileBrowser);
          }},
          { label: '文件搜索', checked: useLayoutStore.getState().showEverythingSearch, action: () => {
            const s = useLayoutStore.getState();
            s.setShowEverythingSearch(!s.showEverythingSearch);
          }},
          { label: '对话管理', checked: useLayoutStore.getState().showConversations, action: () => {
            const s = useLayoutStore.getState();
            s.setShowConversations(!s.showConversations);
          }},
          { label: 'Skill 管理', checked: useLayoutStore.getState().showSkills, action: () => {
            const s = useLayoutStore.getState();
            s.setShowSkills(!s.showSkills);
          }},
          { label: 'MCP 配置', checked: useLayoutStore.getState().showMcpConfig, action: () => {
            const s = useLayoutStore.getState();
            s.setShowMcpConfig(!s.showMcpConfig);
          }},
          { label: '浏览器', checked: useLayoutStore.getState().showBrowser, action: () => {
            const s = useLayoutStore.getState();
            s.setShowBrowser(!s.showBrowser);
          }},
          { label: '提示词管理', checked: useLayoutStore.getState().showPrompts, action: () => {
            const s = useLayoutStore.getState();
            s.setShowPrompts(!s.showPrompts);
          }},
        ]},
      ],
    },
    {
      label: '主题',
      items: themeItems,
    },
    {
      label: '帮助',
      items: [
        { label: '快捷键', action: () => setShowShortcutHelp(true), shortcut: 'Ctrl+Shift+/' },
        { divider: true, label: '', action: () => {} },
        { label: '关于 MLX', action: () => alert('MLX v1.0 — Make! Learn! Extraordinary!') },
      ],
    },
  ];

  const renderMenu = (group: MenuGroup) => {
    const isOpen = openMenu === group.label;
    return (
      <div key={group.label} className="relative">
        <button
          onClick={(e) => { e.stopPropagation(); setOpenMenu(isOpen ? null : group.label); setSubmenuOpen(null); }}
          onMouseEnter={() => {
            if (openMenu && openMenu !== group.label) {
              setOpenMenu(group.label);
              setSubmenuOpen(null);
            }
          }}
          className={`px-3 py-0.5 text-xs rounded transition-colors
            ${isOpen
              ? 'bg-bg-hover text-text-primary'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
            }`}
        >
          {group.label}
        </button>

        {isOpen && (
          <div
            className="absolute top-full left-0 mt-0.5 min-w-[200px] bg-bg-raised border border-border-subtle rounded-lg shadow-xl py-1 z-50"
            onClick={(e) => e.stopPropagation()}
          >
            {group.items.map((item, idx) => {
              if (item.divider) {
                return <div key={idx} className="h-px bg-border-subtle my-1 mx-2" />;
              }
              // ── 子菜单项 ──
              if (item.submenu) {
                const subIsOpen = submenuOpen === `${group.label}-${idx}`;
                return (
                  <div key={idx} className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSubmenuOpen(subIsOpen ? null : `${group.label}-${idx}`);
                      }}
                      onMouseEnter={() => setSubmenuOpen(`${group.label}-${idx}`)}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-xs
                        text-text-primary hover:bg-bg-hover cursor-pointer"
                    >
                      <span>{item.label}</span>
                    </button>
                    {subIsOpen && (
                      <div
                        className="absolute left-full top-0 ml-0.5 min-w-[160px] bg-bg-raised border border-border-subtle rounded-lg shadow-xl py-1 z-50"
                        onMouseEnter={() => setSubmenuOpen(`${group.label}-${idx}`)}
                      >
                        {item.submenu.map((subItem, sIdx) => {
                          // 动态读取工具状态
                          let isChecked = false;
                          if (subItem.label === '终端') isChecked = useLayoutStore.getState().showTerminal;
                          else if (subItem.label === '编辑器') isChecked = useLayoutStore.getState().showEditor;
                          else if (subItem.label === '文件浏览器') isChecked = useLayoutStore.getState().showFileBrowser;
                          else if (subItem.label === '文件搜索') isChecked = useLayoutStore.getState().showEverythingSearch;
                          else if (subItem.label === '对话管理') isChecked = useLayoutStore.getState().showConversations;
                          else if (subItem.label === 'Skill 管理') isChecked = useLayoutStore.getState().showSkills;
                          else if (subItem.label === 'MCP 配置') isChecked = useLayoutStore.getState().showMcpConfig;
                          else if (subItem.label === '浏览器') isChecked = useLayoutStore.getState().showBrowser;
                          else if (subItem.label === '提示词管理') isChecked = useLayoutStore.getState().showPrompts;
                          return (
                            <button
                              key={sIdx}
                              onClick={(e) => {
                                e.stopPropagation();
                                subItem.action?.();
                                // 不关闭菜单，实时联动
                              }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs
                                text-text-primary hover:bg-bg-hover cursor-pointer"
                            >
                              <span className="w-3 text-center text-accent text-[10px]">
                                {isChecked ? '✓' : ''}
                              </span>
                              <span>{subItem.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              }
              // ── 普通菜单项 ──
              return (
                <button
                  key={idx}
                  disabled={item.disabled}
                  onClick={() => {
                    item.action?.();
                    setOpenMenu(null);
                    setSubmenuOpen(null);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs
                    ${item.disabled
                      ? 'text-text-tertiary cursor-not-allowed'
                      : 'text-text-primary hover:bg-bg-hover cursor-pointer'
                    }`}
                >
                  <span className="flex items-center gap-2">
                    {item.checked !== undefined && (
                      <span className="w-3 text-center text-accent text-[10px]">
                        {item.checked ? '✓' : ''}
                      </span>
                    )}
                    {item.checked === undefined && item.label}
                    {item.checked !== undefined && item.label}
                  </span>
                  {item.shortcut && (
                    <span className="text-text-tertiary ml-8">{item.shortcut}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full w-full flex flex-col bg-bg-deepest">
      {/* ── 第1行：软件名 + Slogan + 窗口控制按钮 ── (Feature #6) */}
      <div
        className="titlebar-drag flex items-center justify-between h-8 px-3 bg-bg-deep border-b border-border-subtle select-none"
      >
        <div
          className="titlebar-no-drag flex items-center gap-3"
          onDoubleClick={() => window.electronAPI.window.maximize()}
        >
          <span className="text-sm font-bold text-accent tracking-wide">MLX</span>
          <span className="text-[10px] text-accent/70 tracking-wide">Make! Learn! Extraordinary!</span>
          {projectName && (
            <>
              <span className="text-border-hover text-xs">—</span>
              <span className="text-xs text-text-secondary">{projectName}</span>
            </>
          )}
        </div>
        <div className="titlebar-no-drag flex items-center gap-1">
          <button
            onClick={handleMinimize}
            className="w-8 h-6 flex items-center justify-center rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
          >
            <VscChromeMinimize size={13} />
          </button>
          <button
            onClick={handleMaximize}
            className="w-8 h-6 flex items-center justify-center rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
          >
            <VscChromeMaximize size={13} />
          </button>
          <button
            onClick={handleClose}
            className="w-8 h-6 flex items-center justify-center rounded hover:bg-red-600 hover:text-white text-text-secondary transition-colors"
          >
            <VscChromeClose size={13} />
          </button>
        </div>
      </div>

      {/* ── 第2行：菜单栏 ── (Feature #6, #7) */}
      <div
        ref={menuBarRef}
        className="flex items-center h-7 px-2 bg-bg-deep border-b border-border-subtle select-none gap-1"
      >
        {menus.map(renderMenu)}
      </div>

      {/* ── 第3行+：主内容区 ── */}
      <div className="flex-1 overflow-hidden flex">
        {children}
      </div>

      {/* ── 状态栏 ── */}
      <div className="flex items-center justify-between h-7 px-3 bg-bg-deep border-t border-border-subtle text-xs text-text-tertiary select-none">
        <div className="flex items-center gap-3">
          <span>MLX v1.0</span>
          {gitBranch && (
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-accent/60" />
              {gitBranch}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span
            className="cursor-pointer hover:text-text-primary transition-colors"
            onClick={() => onSwitchProject?.()}
            title="点击切换项目"
          >
            {projectName || 'Ctrl+Shift+P 切换项目'}
          </span>
        </div>
      </div>

      {/* 主题管理器弹窗 */}
      {themeManagerOpen && (
        <ThemeManager onClose={() => setThemeManagerOpen(false)} />
      )}

      {/* 快捷键帮助弹窗 */}
      {showShortcutHelp && (
        <ShortcutHelp onClose={() => setShowShortcutHelp(false)} />
      )}
    </div>
  );
}
