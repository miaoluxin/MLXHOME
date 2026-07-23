import React, { Suspense, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useProjectStore } from './stores/useProjectStore';
import { useEditorStore } from './stores/useEditorStore';
import { useFileStore } from './stores/useFileStore';
import { useLayoutStore } from './stores/useLayoutStore';
import { useTerminalStore } from './stores/useTerminalStore';
import { AppShell } from './components/layout/AppShell';
import { TerminalPanel } from './components/terminal/TerminalPanel';
import { PanelResizer } from './components/layout/PanelResizer';
import { FileBrowser } from './components/filesystem/FileBrowser';
import { EditorPanel } from './components/editor/EditorPanel';
import { QuickTools } from './components/layout/QuickTools';
import { getDragSource, getDragOverTarget } from './components/layout/DraggablePanelHeader';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { useIndexSettingsStore } from './stores/useIndexSettingsStore';
import { loadSession, collectSessionData, persistSession, clearSession } from './services/sessionManager';
import { initPluginSystem } from './plugin-system/plugin-manager';

const EverythingSearch = React.lazy(() => import('./components/filesystem/EverythingSearch').then(m => ({ default: m.EverythingSearch })));
const ConversationManager = React.lazy(() => import('./components/tools/ConversationManager').then(m => ({ default: m.ConversationManager })));
const SkillManager = React.lazy(() => import('./components/tools/SkillManager').then(m => ({ default: m.SkillManager })));
const McpConfigTool = React.lazy(() => import('./components/tools/McpConfigTool').then(m => ({ default: m.McpConfigTool })));
const BrowserTool = React.lazy(() => import('./components/tools/BrowserTool').then(m => ({ default: m.BrowserTool })));
const ContentSearch = React.lazy(() => import('./components/search/ContentSearch').then(m => ({ default: m.ContentSearch })));
const PromptManager = React.lazy(() => import('./components/tools/PromptManager').then(m => ({ default: m.PromptManager })));

export default function AppMain() {
  const { setProjectPath } = useProjectStore();
  const openFiles = useEditorStore((s) => s.openFiles);
  const {
    leftWidth, centerWidth, browserWidth, bottomHeight,
    showFileBrowser, showEverythingSearch, showContentSearch,
    showTerminal, showEditor,
    showConversations, showSkills, showMcpConfig, showBrowser, showPrompts,
    layoutMode, panelOrder, panelWidths,
    setLeftWidth, setCenterWidth, setBrowserWidth, setBottomHeight,
    setPanelWidth,
    initWidths,
  } = useLayoutStore();
  const saveTimerRef = useRef<number | null>(null);

  const handleSwitchProject = useCallback(async () => {
    const folder = await window.electronAPI.dialog.openFolder();
    if (folder) {
      setProjectPath(folder);
      useFileStore.getState().setCurrentPath(folder);
      const editorStore = useEditorStore.getState();
      editorStore.openFiles.forEach((f) => editorStore.closeFile(f.id));
      // 触发终端重建（杀掉旧会话，创建 Opencode + Claude 双终端）
      useProjectStore.getState().triggerSwitch();
    }
  }, [setProjectPath]);

  useEffect(() => {
    initWidths(window.innerWidth);
    const handleResize = () => initWidths(window.innerWidth);
    window.addEventListener('resize', handleResize);

    // 延迟初始化插件系统，不阻塞首屏渲染
    const pluginTimer = setTimeout(() => initPluginSystem(), 500);

    const data = loadSession();
    if (data && data.openFiles.length > 0) {
      // 验证：至少有一个文件路径在磁盘上仍然存在，否则清除过期 session
      const validFiles = data.openFiles.filter((f) => {
        if (!f.path) return !f.isDirty; // 未保存的新文件保留，脏文件保留
        try {
          // 同步检查文件是否存在（启动时可用）
          return f.isDirty; // 脏文件保留以防数据丢失
        } catch { return false; }
      });
      // 如果所有文件都是 clean 且无路径，清除 session
      const hasRealFiles = data.openFiles.some((f) => f.path && !f.isDirty);
      const hasDirtyFiles = data.openFiles.some((f) => f.isDirty);
      if (!hasRealFiles && !hasDirtyFiles) {
        clearSession();
      } else {
        const editorStore = useEditorStore.getState();
        editorStore.batchRestore(
          data.openFiles,
          data.activeFileId,
          data.cursorPosition,
          data.zoomLevel,
          data.wordWrap,
        );
      if (data.fileBrowserPath) {
        useFileStore.getState().setCurrentPath(data.fileBrowserPath);
      }
      useLayoutStore.getState().setLeftWidth(data.layoutWidths.left);
      useLayoutStore.getState().setCenterWidth(data.layoutWidths.center);
      useLayoutStore.getState().setRightWidth(data.layoutWidths.right);

      // 恢复完整布局状态（v2 session）
      if (data.layoutState) {
        const ls = data.layoutState;
        const layoutStore = useLayoutStore.getState();
        // 面板可见性
        if (ls.showTerminal !== undefined) layoutStore.setShowTerminal(ls.showTerminal);
        if (ls.showEditor !== undefined) layoutStore.setShowEditor(ls.showEditor);
        if (ls.showFileBrowser !== undefined) layoutStore.setShowFileBrowser(ls.showFileBrowser);
        if (ls.showEverythingSearch !== undefined) layoutStore.setShowEverythingSearch(ls.showEverythingSearch);
        if (ls.showConversations !== undefined) layoutStore.setShowConversations(ls.showConversations);
        if (ls.showSkills !== undefined) layoutStore.setShowSkills(ls.showSkills);
        if (ls.showMcpConfig !== undefined) layoutStore.setShowMcpConfig(ls.showMcpConfig);
        if (ls.showBrowser !== undefined) layoutStore.setShowBrowser(ls.showBrowser);
        // 布局模式与尺寸
        if (ls.layoutMode) layoutStore.setLayoutMode(ls.layoutMode as 'free' | 'three-column-vertical' | 'three-column-horizontal');
        if (ls.panelOrder) layoutStore.setPanelOrder(ls.panelOrder);
        if (ls.panelWidths) {
          Object.entries(ls.panelWidths).forEach(([id, w]) => layoutStore.setPanelWidth(id, w));
        }
        if (ls.bottomHeight !== undefined) layoutStore.setBottomHeight(ls.bottomHeight);
        if (ls.browserWidth !== undefined) layoutStore.setBrowserWidth(ls.browserWidth);
      }

      const restoredTabs = useEditorStore.getState().openFiles;
      const readPromises = restoredTabs.map(async (tab) => {
        if (!tab.isDirty && tab.path && !tab.content) {
          try {
            const content = await window.electronAPI.fs.read(tab.path);
            if (content && !content.includes('\x00')) {
              return { ...tab, content, isDirty: false };
            }
          } catch { /* ignore */ }
        }
        return tab;
      });

      Promise.all(readPromises).then((updatedTabs) => {
        const current = useEditorStore.getState();
        const hasChanges = updatedTabs.some(
          (t, i) => t.content !== current.openFiles[i]?.content
        );
        if (hasChanges) {
          useEditorStore.getState().batchRestore(
            updatedTabs,
            current.activeFileId,
            current.cursorPosition,
            current.zoomLevel,
            current.wordWrap,
          );
        }
      });
      }
    }

    const handleBeforeUnload = () => {
      const editor = useEditorStore.getState();
      const file = useFileStore.getState();
      const layout = useLayoutStore.getState();
      if (editor.openFiles.length === 0) {
        clearSession();
        return;
      }
      const session = collectSessionData({
        openFiles: editor.openFiles,
        activeFileId: editor.activeFileId,
        fileBrowserPath: file.currentPath,
        cursorPosition: editor.cursorPosition,
        zoomLevel: editor.zoomLevel,
        layoutWidths: { left: layout.leftWidth, center: layout.centerWidth, right: layout.rightWidth },
        wordWrap: editor.wordWrap,
        layoutState: {
          showTerminal: layout.showTerminal,
          showEditor: layout.showEditor,
          showFileBrowser: layout.showFileBrowser,
          showEverythingSearch: layout.showEverythingSearch,
          showConversations: layout.showConversations,
          showSkills: layout.showSkills,
          showMcpConfig: layout.showMcpConfig,
          showBrowser: layout.showBrowser,
          layoutMode: layout.layoutMode,
          panelOrder: layout.panelOrder,
          panelWidths: layout.panelWidths,
          bottomHeight: layout.bottomHeight,
          browserWidth: layout.browserWidth,
        },
      });
      persistSession(session);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    const handleToggleBrowser = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        useLayoutStore.getState().toggleFileBrowser();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'f' || e.key === 'F')) {
        e.preventDefault();
        useLayoutStore.getState().toggleContentSearch();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        useLayoutStore.getState().togglePrompts();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        handleSwitchProject();
      }
    };
    window.addEventListener('keydown', handleToggleBrowser);

    // 延迟10秒启动文件索引（不阻塞UI首屏渲染）
    useIndexSettingsStore.getState().load(useProjectStore.getState().projectPath || undefined);
    const indexRoots = useIndexSettingsStore.getState().roots;
    setTimeout(() => {
      window.electronAPI.fileIndexer.start(indexRoots.length > 0 ? indexRoots : undefined).catch((err) => {
        console.warn('[AppMain] 文件索引启动失败（非关键）:', err);
      });
    }, 10000);

    return () => {
      clearTimeout(pluginTimer);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('keydown', handleToggleBrowser);
      if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current);
    };
  }, []);

  const hasOpenFiles = openFiles.length > 0;
  const showEditorPanel = hasOpenFiles || showEditor;
  const terminalExpanded = !hasOpenFiles && !showFileBrowser && !showEverythingSearch;

  // ── 面板宽度等比分配（面板数变化 / 窗口缩放时触发）──
  const visiblePanels = [showTerminal, showEditorPanel, showConversations, showSkills, showMcpConfig, showBrowser, showPrompts, showFileBrowser, showEverythingSearch, showContentSearch].filter(Boolean).length;

  const distributeWidths = useCallback(() => {
    if (visiblePanels <= 1) return;
    const s = useLayoutStore.getState();
    if (s.layoutMode !== 'free') return;
    const total = window.innerWidth - 16;
    if (total <= 0) return;
    const equal = Math.round(total / visiblePanels);
    // 为所有可见面板等分宽度
    const allPanelIds = ['terminal', 'editor', 'conversations', 'skills', 'mcpConfig', 'browser', 'prompts', 'fileBrowser', 'everythingSearch', 'contentSearch'];
    const visible = allPanelIds.filter((id) => {
      if (id === 'editor') return showEditorPanel;
      if (id === 'terminal') return showTerminal;
      if (id === 'fileBrowser') return showFileBrowser;
      if (id === 'everythingSearch') return showEverythingSearch;
      if (id === 'contentSearch') return showContentSearch;
      if (id === 'prompts') return showPrompts;
      if (id === 'conversations') return showConversations;
      if (id === 'skills') return showSkills;
      if (id === 'mcpConfig') return showMcpConfig;
      if (id === 'browser') return showBrowser;
      return false;
    });
    visible.forEach((id) => s.setPanelWidth(id, equal));
    // 同步旧的命名槽位
    if (showTerminal) s.setLeftWidth(equal);
    if (showEditorPanel) s.setCenterWidth(equal);
    if (showFileBrowser) s.setBrowserWidth(equal);
  }, [visiblePanels, showTerminal, showEditorPanel, showFileBrowser, showEverythingSearch, showConversations, showSkills, showMcpConfig, showBrowser]);

  // 面板数量变化时重新等分
  const prevVisiblePanels = useRef(visiblePanels);
  useEffect(() => {
    if (visiblePanels === 0 || visiblePanels === prevVisiblePanels.current) return;
    prevVisiblePanels.current = visiblePanels;
    distributeWidths();
  }, [visiblePanels, distributeWidths]);

  // 窗口缩放时等比例适配，确保所有面板完整可见不溢出
  useEffect(() => {
    let resizeTimer: number;
    const handleResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(distributeWidths, 80);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(resizeTimer);
    };
  }, [distributeWidths]);

  // ── 动态可见面板计算 (hooks 必须在所有条件返回之前) ──
  const visibleSlots = useMemo(() => {
    const visibility: Record<string, boolean> = {
      terminal: showTerminal,
      editor: showEditorPanel,
      conversations: showConversations,
      skills: showSkills,
      mcpConfig: showMcpConfig,
      browser: showBrowser,
      fileBrowser: showFileBrowser,
      everythingSearch: showEverythingSearch,
      contentSearch: showContentSearch,
      prompts: showPrompts,
    };
    return panelOrder.filter((id) => visibility[id]);
  }, [panelOrder, showTerminal, showEditorPanel, showConversations, showSkills, showMcpConfig, showBrowser, showPrompts, showFileBrowser, showEverythingSearch, showContentSearch]);

  const panelComponentMap: Record<string, React.ReactNode> = {
    terminal: <ErrorBoundary name="终端"><TerminalPanel /></ErrorBoundary>,
    editor: <ErrorBoundary name="编辑器"><EditorPanel /></ErrorBoundary>,
    conversations: <ErrorBoundary name="对话管理"><Suspense fallback={<div className="h-full bg-bg-deep" />}><ConversationManager /></Suspense></ErrorBoundary>,
    skills: <ErrorBoundary name="Skill"><Suspense fallback={<div className="h-full bg-bg-deep" />}><SkillManager /></Suspense></ErrorBoundary>,
    mcpConfig: <ErrorBoundary name="MCP"><Suspense fallback={<div className="h-full bg-bg-deep" />}><McpConfigTool /></Suspense></ErrorBoundary>,
    browser: <ErrorBoundary name="浏览器"><Suspense fallback={<div className="h-full bg-bg-deep" />}><BrowserTool /></Suspense></ErrorBoundary>,
    fileBrowser: <ErrorBoundary name="文件浏览器"><FileBrowser /></ErrorBoundary>,
    everythingSearch: <ErrorBoundary name="文件搜索"><Suspense fallback={<div className="h-full bg-bg-deep" />}><EverythingSearch /></Suspense></ErrorBoundary>,
    contentSearch: <ErrorBoundary name="内容搜索"><Suspense fallback={<div className="h-full bg-bg-deep" />}><ContentSearch /></Suspense></ErrorBoundary>,
    prompts: <ErrorBoundary name="提示词"><Suspense fallback={<div className="h-full bg-bg-deep" />}><PromptManager /></Suspense></ErrorBoundary>,
  };

  // ── 三列一横 (水平) 布局 ──
  if (layoutMode === 'three-column-horizontal') {
    const hShowEditor = hasOpenFiles || showEditor;
    const topRowPanels = [showTerminal, hShowEditor, showFileBrowser].filter(Boolean).length;
    const topHeight = `calc(100% - ${bottomHeight}px - 12px)`;

    return (
      <AppShell onSwitchProject={handleSwitchProject}>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', padding: 8, gap: 0, position: 'relative' }}>
          <div style={{ display: 'flex', height: topHeight, overflow: 'hidden' }}>
            <div data-panel-id="terminal" style={{ display: showTerminal ? undefined : 'none', width: topRowPanels >= 2 ? leftWidth : undefined, flex: topRowPanels === 1 ? 1 : undefined, minWidth: 200, overflow: 'hidden' }} className="panel-slot h-full flex-shrink-0">
              <TerminalPanel />
            </div>
            {showTerminal && (hShowEditor || showFileBrowser) && (
              <PanelResizer
                onResize={(delta) => setLeftWidth(leftWidth + delta)}
                onDragEnd={() => {
                  setTimeout(() => useTerminalStore.getState().focusActiveTerminal?.(), 50);
                }}
              />
            )}
            <div data-panel-id="editor" style={{ display: hShowEditor ? undefined : 'none', width: topRowPanels >= 2 ? centerWidth : undefined, flex: topRowPanels === 1 ? 1 : undefined, minWidth: 300, overflow: 'hidden' }} className="panel-slot h-full flex-shrink-0">
              <EditorPanel />
            </div>
            {hShowEditor && showFileBrowser && (
              <PanelResizer
                onResize={(delta) => { setCenterWidth(centerWidth + delta); setBrowserWidth(browserWidth - delta); }}
                onDragEnd={() => {
                  if (showTerminal) {
                    setTimeout(() => useTerminalStore.getState().focusActiveTerminal?.(), 50);
                  }
                }}
              />
            )}
            <div data-panel-id="fileBrowser" style={{ display: showFileBrowser ? undefined : 'none', flex: 1, minWidth: 200, overflow: 'hidden' }} className="panel-slot h-full">
              <FileBrowser />
            </div>
          </div>
          {showEverythingSearch && topRowPanels > 0 && (
            <PanelResizer
              direction="vertical"
              onResize={(delta) => setBottomHeight(bottomHeight - delta)}
              onDragEnd={() => {
                if (showTerminal) {
                  setTimeout(() => useTerminalStore.getState().focusActiveTerminal?.(), 50);
                }
              }}
            />
          )}
          <div style={{ display: showEverythingSearch ? undefined : 'none', height: bottomHeight, minHeight: 150, overflow: 'hidden' }} className="w-full flex-shrink-0">
            <EverythingSearch />
          </div>
          <QuickTools />
        </div>
      </AppShell>
    );
  }

  // ── 默认 / 三列排版 (垂直) 布局 ──
  // 为每个可见面板分配宽度槽位
  // 自由布局：每个面板使用 panelWidths 中的独立宽度
  const getSlotWidth = (slotId: string, _index: number, total: number) => {
    if (total === 1) return undefined; // flex: 1，单面板占满
    return panelWidths[slotId] || 300;
  };

  const getSlotMinWidth = (id: string) => {
    if (id === 'editor') return 300;
    return 200;
  };

  // 自由布局：任意相邻面板拖拽调整，不限于前3个
  const handleSlotResize = (leftSlotIndex: number, delta: number) => {
    const leftId = visibleSlots[leftSlotIndex];
    const rightId = visibleSlots[leftSlotIndex + 1];
    if (!leftId || !rightId) return;

    const leftCur = panelWidths[leftId] || 300;
    const rightCur = panelWidths[rightId] || 300;
    const leftMin = getSlotMinWidth(leftId);
    const rightMin = getSlotMinWidth(rightId);

    const newLeft = Math.max(leftMin, leftCur + delta);
    const actualDelta = newLeft - leftCur;
    const newRight = Math.max(rightMin, rightCur - actualDelta);

    setPanelWidth(leftId, newLeft);
    setPanelWidth(rightId, newRight);
    // 同步更新旧的命名槽位（保持三列布局兼容）
    if (leftId === 'terminal') setLeftWidth(newLeft);
    if (leftId === 'editor') setCenterWidth(newLeft);
    if (rightId === 'fileBrowser') setBrowserWidth(newRight);
  };

  return (
    <AppShell onSwitchProject={handleSwitchProject}>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden', padding: 8, gap: 0, position: 'relative' }}>
        {visibleSlots.map((slotId, idx) => {
          const isLast = idx === visibleSlots.length - 1;
          const width = getSlotWidth(slotId, idx, visibleSlots.length);
          const dragSource = getDragSource();
          const dragTarget = getDragOverTarget();
          const isDragging = dragSource === slotId;
          const isTarget = dragTarget === slotId;
          const dragIdx = dragSource ? visibleSlots.indexOf(dragSource) : -1;
          const isAdjacent = dragSource && !isDragging && Math.abs(idx - dragIdx) === 1;

          const hasActiveDrag = !!getDragSource();

          return (
            <React.Fragment key={slotId}>
              <motion.div
                layout={hasActiveDrag ? true : undefined}
                data-panel-id={slotId}
                style={{
                  width: isLast && visibleSlots.length > 1 ? width : (visibleSlots.length === 1 ? undefined : width),
                  flex: (isLast || visibleSlots.length === 1) ? 1 : undefined,
                  minWidth: getSlotMinWidth(slotId),
                  overflow: 'hidden',
                  transform: isDragging ? 'scale(1.04) translateY(-6px)' : isTarget ? 'scale(1.03)' : isAdjacent ? 'scale(0.96)' : undefined,
                  boxShadow: isDragging ? '0 20px 60px rgba(0,0,0,0.35)' : isTarget ? '0 0 0 2px var(--accent)' : undefined,
                  zIndex: isDragging ? 50 : isTarget ? 40 : 1,
                  opacity: isDragging ? 0.88 : 1,
                  transition: 'transform 0.2s cubic-bezier(0.25, 0.1, 0.25, 1), opacity 0.2s cubic-bezier(0.25, 0.1, 0.25, 1), box-shadow 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)',
                }}
                className={`panel-slot h-full flex-shrink-0 ${isDragging ? 'rounded-xl' : ''}`}
                transition={hasActiveDrag ? { type: 'spring', stiffness: 400, damping: 45, mass: 0.3 } : undefined}
              >
                {panelComponentMap[slotId]}
              </motion.div>
              {!isLast && (
                <PanelResizer
                  onResize={(delta) => handleSlotResize(idx, delta)}
                  onDragEnd={() => {
                    // 任何面板拖拽结束后，只要终端可见就恢复焦点
                    if (showTerminal) {
                      setTimeout(() => useTerminalStore.getState().focusActiveTerminal?.(), 50);
                    }
                  }}
                />
              )}
            </React.Fragment>
          );
        })}
        <QuickTools />
      </div>
    </AppShell>
  );
}
