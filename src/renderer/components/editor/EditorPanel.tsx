import { useCallback, useEffect, useRef, useState } from 'react';
import { VscCode, VscSave, VscClose, VscFileBinary, VscExtensions } from 'react-icons/vsc';
import { EditorView } from '@codemirror/view';
import { undo, redo } from '@codemirror/commands';
import { setSearchQuery, findNext, findPrevious, SearchQuery } from '@codemirror/search';
import { NddEditor } from './NddEditor';
import { NddFindPanel } from './NddFindPanel';
import { NddStatusBar } from './NddStatusBar';
import { NddHexViewer } from './NddHexViewer';
import { NddLineOps, applyLineOp, type LineOp } from './NddLineOps';
import { DraggablePanelHeader } from '../layout/DraggablePanelHeader';
import { EditorTabs } from './EditorTabs';
import { EditorToolbar } from './EditorToolbar';
import { PluginPanel } from '../plugins/PluginPanel';
import { PluginPreview } from '../plugins/PluginPreview';
import { useEditorStore } from '../../stores/useEditorStore';
import { useLayoutStore } from '../../stores/useLayoutStore';
import { useFileStore } from '../../stores/useFileStore';
import { collectSessionData, persistSession } from '../../services/sessionManager';
import { hasPreviewRenderer } from '../../plugin-system/plugin-api';
import type { FindOptions } from './NddFindPanel';

export function EditorPanel() {
  const {
    openFiles, activeFileId, setActiveFile, closeFile, setContent, markClean,
    showFindPanel, showReplacePanel, toggleFindPanel, toggleReplacePanel,
    showHexView, toggleHexView,
    readOnly, zoomLevel, setZoom,
    cursorPosition, setCursorPosition,
    encoding, setEncoding, lineEnding, setLineEnding,
    wordWrap, showWhitespace, columnMode,
    createNewFile,
  } = useEditorStore();

  const activeFile = openFiles.find((f) => f.id === activeFileId);
  const editorViewRef = useRef<EditorView | null>(null);
  const [matchCount, setMatchCount] = useState<number | undefined>(undefined);

  // ── 插件面板状态 ──
  const [showPluginPanel, setShowPluginPanel] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const canPreview = activeFile ? hasPreviewRenderer(activeFile.language) : false;

  // ── Ctrl+S 保存 ──
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey;

      // Ctrl+S / Cmd+S 保存
      if (isCtrl && e.key === 's' && !e.shiftKey) {
        e.preventDefault();
        if (activeFile && activeFile.isDirty) {
          if (!activeFile.path) {
            // 未命名文件 → 另存为
            try {
              const newPath = await window.electronAPI.dialog.saveFile();
              if (newPath) {
                await window.electronAPI.fs.write(newPath, activeFile.content);
                useEditorStore.getState().saveAsFile(activeFile.id, newPath, activeFile.content);
              }
            } catch { /* ignore */ }
          } else {
            try {
              await window.electronAPI.fs.write(activeFile.path, activeFile.content);
              markClean(activeFile.id);
            } catch { /* ignore */ }
          }
        }
        return;
      }

      // Ctrl+Shift+S / Cmd+Shift+S 另存为
      if (isCtrl && e.shiftKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        if (!activeFile) return;
        try {
          const newPath = await window.electronAPI.dialog.saveFile();
          if (newPath) {
            await window.electronAPI.fs.write(newPath, activeFile.content);
            useEditorStore.getState().saveAsFile(activeFile.id, newPath, activeFile.content);
          }
        } catch { /* ignore */ }
        return;
      }

      // Ctrl+N / Cmd+N 新建文件
      if (isCtrl && !e.shiftKey && e.key === 'n') {
        e.preventDefault();
        createNewFile();
        return;
      }

      // Ctrl+W / Cmd+W 关闭标签
      if (isCtrl && e.key === 'w') {
        e.preventDefault();
        if (activeFileId) handleCloseFile(activeFileId);
        return;
      }

      // Ctrl+F / Cmd+F 查找 — 由 CM6 内部 keymap 处理（优先级更高）
      // 我们仅在 CM6 keymap 中处理 Ctrl+F, 全局不再拦截
      // 避免与 CM6 search() 扩展的 openSearchPanel 冲突

      // Ctrl+H / Cmd+H 查找替换
      if (isCtrl && e.key === 'h') {
        e.preventDefault();
        toggleReplacePanel();
        return;
      }

      // Ctrl+G / Cmd+G 查找下一个 — CM6 searchKeymap 中已处理（编辑器聚焦时）
      // 此处不再拦截，避免与 CM6 的 findNext 冲突导致跳两次
      if (isCtrl && (e.key === '=' || e.key === '+' || e.key === '-')) {
        if (e.key === '-') {
          e.preventDefault();
          setZoom(zoomLevel - 10);
        } else {
          e.preventDefault();
          setZoom(zoomLevel + 10);
        }
        return;
      }

      // Ctrl+0 重置缩放
      if (isCtrl && e.key === '0') {
        e.preventDefault();
        setZoom(100);
        return;
      }

      // Alt+M — Markdown 预览切换
      if (e.altKey && e.key === 'm') {
        e.preventDefault();
        if (activeFile && hasPreviewRenderer(activeFile.language)) {
          setShowPreview((v) => !v);
        }
        return;
      }

      // Alt+U — PlantUML 预览切换
      if (e.altKey && e.key === 'u') {
        e.preventDefault();
        if (activeFile && hasPreviewRenderer(activeFile.language)) {
          setShowPreview((v) => !v);
        }
        return;
      }

      // Ctrl+D 查找下一个选中（CM6 默认支持）
      if (isCtrl && e.key === 'd') {
        // 让 CM6 原生处理
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeFile, activeFileId, showFindPanel, showReplacePanel, zoomLevel]);

  // ── 内容变更后防抖保存会话 ──
  const saveTimerRef = useRef<number | null>(null);
  useEffect(() => {
    if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current);
    if (!activeFile) return;
    saveTimerRef.current = window.setTimeout(() => {
      const editor = useEditorStore.getState();
      const file = useFileStore.getState();
      const layout = useLayoutStore.getState();
      const session = collectSessionData({
        openFiles: editor.openFiles,
        activeFileId: editor.activeFileId,
        fileBrowserPath: file.currentPath,
        cursorPosition: editor.cursorPosition,
        zoomLevel: editor.zoomLevel,
        layoutWidths: { left: layout.leftWidth, center: layout.centerWidth, right: layout.rightWidth },
        wordWrap: editor.wordWrap,
      });
      persistSession(session);
    }, 3000);
    return () => {
      if (saveTimerRef.current !== null) clearTimeout(saveTimerRef.current);
    };
  }, [activeFile?.content, activeFile?.isDirty]);

  // ── 保存按钮 ──
  const handleSave = useCallback(async () => {
    if (activeFile && activeFile.isDirty) {
      try {
        await window.electronAPI.fs.write(activeFile.path, activeFile.content);
        markClean(activeFile.id);
      } catch { /* handle */ }
    }
  }, [activeFile]);

  // ── 撤销/重做 ──
  const handleUndo = useCallback(() => {
    const view = editorViewRef.current;
    if (view) undo(view);
  }, []);

  const handleRedo = useCallback(() => {
    const view = editorViewRef.current;
    if (view) redo(view);
  }, []);

  // ── 关闭文件前检查未保存 ──
  const handleCloseFile = useCallback((fileId: string) => {
    const file = useEditorStore.getState().openFiles.find(f => f.id === fileId);
    if (file?.isDirty) {
      const fileName = file.name || 'untitled';
      const confirmed = window.confirm(
        `"${fileName}" 有未保存的更改，确定要关闭吗？\n\n未保存的内容将丢失。`
      );
      if (!confirmed) return;
    }
    closeFile(fileId);
  }, [closeFile]);

  // ── 编辑器视图就绪 ──
  const handleEditorViewReady = useCallback((view: EditorView) => {
    editorViewRef.current = view;
    useEditorStore.getState().setEditorView(view);
  }, []);

  // ── 查找替换 ──
  const handleFind = useCallback((query: string, options: FindOptions) => {
    const view = editorViewRef.current;
    if (!view) return;

    if (!query) {
      setMatchCount(undefined);
      return;
    }

    const searchQuery = new SearchQuery({
      search: query,
      caseSensitive: options.caseSensitive,
      regexp: options.useRegex,
      wholeWord: options.wholeWord,
    });

    // 将查询设置到 CM6 的搜索状态中（让 findNext/findPrevious 能使用）
    view.dispatch({
      effects: setSearchQuery.of(searchQuery),
    });

    // 计算匹配数
    let count = 0;
    const doc = view.state.doc.toString();
    const flags = options.caseSensitive ? 'g' : 'gi';
    try {
      const pattern = options.useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(pattern, flags);
      const matches = doc.match(regex);
      count = matches ? matches.length : 0;
    } catch {
      count = 0;
    }
    setMatchCount(count);

    // 光标跳转到第一个匹配
    findNext(view);
  }, []);

  const handleFindNext = useCallback(() => {
    const view = editorViewRef.current;
    if (!view) return;
    findNext(view);
  }, []);

  const handleFindPrev = useCallback(() => {
    const view = editorViewRef.current;
    if (!view) return;
    findPrevious(view);
  }, []);

  const handleReplace = useCallback((replaceText: string) => {
    const view = editorViewRef.current;
    if (!view) return;
    const sel = view.state.selection.main;
    if (sel.empty) return;
    view.dispatch({
      changes: { from: sel.from, to: sel.to, insert: replaceText },
      selection: { anchor: sel.from + replaceText.length },
    });
  }, []);

  const handleReplaceAll = useCallback((replaceText: string) => {
    const view = editorViewRef.current;
    if (!view) return;
    const doc = view.state.doc.toString();
    const sel = view.state.selection.main;
    const query = view.state.sliceDoc(sel.from, sel.to - sel.from);
    if (!query) return;
    const flags = 'gi';
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, flags);
    const newDoc = doc.replace(regex, replaceText);
    view.dispatch({
      changes: { from: 0, to: doc.length, insert: newDoc },
    });
  }, []);

  // ── 行操作 ──
  const [selectedText, setSelectedText] = useState('');
  const handleLineOp = useCallback(
    (op: LineOp, text: string) => {
      const view = editorViewRef.current;
      if (!view) return;
      const sel = view.state.selection.main;
      const targetText = text || (sel.empty
        ? view.state.doc.toString()
        : view.state.sliceDoc(sel.from, sel.to - sel.from));
      const result = applyLineOp(op, targetText);
      if (sel.empty) {
        // 全文操作
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: result },
        });
      } else {
        // 选中区域操作
        view.dispatch({
          changes: { from: sel.from, to: sel.to, insert: result },
        });
      }
    },
    []
  );

  const handleGetSelectedText = useCallback(() => {
    const view = editorViewRef.current;
    if (!view) return '';
    const sel = view.state.selection.main;
    return sel.empty ? '' : view.state.sliceDoc(sel.from, sel.to - sel.from);
  }, []);

  // ── 文件大小格式化 ──
  const fileSize =
    activeFile?.content
      ? activeFile.content.length < 1024
        ? `${activeFile.content.length}B`
        : activeFile.content.length < 1024 * 1024
          ? `${(activeFile.content.length / 1024).toFixed(1)}KB`
          : `${(activeFile.content.length / (1024 * 1024)).toFixed(1)}MB`
      : undefined;

  // ── 无打开文件时显示欢迎页 ──
  if (!activeFile) {
    return (
      <div className="h-full flex flex-col glass-panel overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle">
          <VscCode size={15} className="text-accent" />
          <span className="text-xs font-medium text-text-secondary">编辑器</span>
          <span className="text-[10px] text-text-tertiary">
            已打开: {openFiles.length} 个文件
          </span>
          {/* 关闭编辑器面板 */}
          <button
            onClick={() => useLayoutStore.getState().setShowEditor(false)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20 text-text-secondary hover:text-red-400 transition-colors ml-auto"
            title="关闭编辑器"
          >
            <VscClose size={16} />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center text-text-tertiary text-sm select-none">
          <div className="text-center">
            <VscCode size={48} className="mx-auto mb-3 opacity-30" />
            <p>双击文件开始编辑</p>
            <p className="text-xs mt-1">
              支持 JS/TS/Python/Java/C#/HTML/CSS 等 40+ 语言
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col glass-panel overflow-hidden">
      {/* ── 标题栏 ── */}
      <DraggablePanelHeader panelId="editor" className="flex items-center justify-between px-3 py-2 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <VscCode size={15} className="text-accent shrink-0" />
          <span className="text-xs font-medium text-text-secondary truncate">
            {activeFile.name}
          </span>
          {activeFile.isDirty && (
            <span className="text-[10px] text-yellow-400 shrink-0">● 未保存</span>
          )}
          {readOnly && (
            <span className="text-[10px] text-yellow-400 shrink-0">只读</span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* HEX 切换 */}
          <button
            onClick={toggleHexView}
            className={`p-1 rounded transition-colors ${
              showHexView
                ? 'bg-accent text-white'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
            }`}
            title={showHexView ? '切换到文本模式' : '十六进制查看'}
          >
            <VscFileBinary size={14} />
          </button>

          {/* 预览切换 */}
          {canPreview && (
            <button
              onClick={() => setShowPreview((v) => !v)}
              className={`p-1 rounded transition-colors ${
                showPreview
                  ? 'bg-accent/20 text-accent'
                  : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
              }`}
              title={`预览 (Alt+${activeFile.language === 'markdown' ? 'M' : 'U'})`}
            >
              <VscCode size={14} />
            </button>
          )}

          {/* 行操作 */}
          <NddLineOps
            onExecute={handleLineOp}
            getSelectedText={handleGetSelectedText}
          />

          <div className="w-px h-4 bg-border-subtle mx-1" />

          {/* 插件管理 */}
          <button
            onClick={() => setShowPluginPanel((v) => !v)}
            className={`p-1 rounded transition-colors ${
              showPluginPanel
                ? 'bg-accent/20 text-accent'
                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
            }`}
            title="插件管理"
          >
            <VscExtensions size={14} />
          </button>

          {/* 保存 */}
          <button
            onClick={handleSave}
            disabled={!activeFile.isDirty}
            className="p-1 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary
                       transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="保存 (Ctrl+S)"
          >
            <VscSave size={14} />
          </button>
          {/* 关闭文件 */}
          <button
            onClick={() => handleCloseFile(activeFile.id)}
            className="p-1 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
            title="关闭文件 (Ctrl+W)"
          >
            <VscClose size={14} />
          </button>
          {/* 关闭编辑器面板 */}
          <button
            onClick={() => {
              // 关闭所有打开的文件（脏文件提示确认）
              const store = useEditorStore.getState();
              const dirtyFiles = store.openFiles.filter(f => f.isDirty);
              if (dirtyFiles.length > 0) {
                const confirmed = window.confirm(
                  `有 ${dirtyFiles.length} 个文件未保存，确定关闭编辑器吗？\n\n未保存的内容将丢失。`
                );
                if (!confirmed) return;
              }
              // 先关所有文件，再隐藏面板
              store.openFiles.forEach(f => store.closeFile(f.id));
              useLayoutStore.getState().setShowEditor(false);
            }}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20 text-text-secondary hover:text-red-400 transition-colors ml-1"
            title="关闭编辑器"
          >
            <VscClose size={16} />
          </button>
        </div>
      </DraggablePanelHeader>

      {/* ── 工具栏 ── */}
      <EditorToolbar
        onUndo={handleUndo}
        onRedo={handleRedo}
      />

      {/* ── 标签栏 ── */}
      <EditorTabs
        tabs={openFiles}
        activeId={activeFileId}
        onSelect={setActiveFile}
        onClose={handleCloseFile}
      />

      {/* ── 查找替换面板 ── */}
      {showFindPanel && (
        <NddFindPanel
          onClose={toggleFindPanel}
          onFind={handleFind}
          onFindNext={handleFindNext}
          onFindPrev={handleFindPrev}
          onReplace={handleReplace}
          onReplaceAll={handleReplaceAll}
          matchCount={matchCount}
          initialShowReplace={showReplacePanel}
        />
      )}

      {/* ── 编辑器 / HEX 查看器 / 插件预览 ── */}
      <div className="flex-1 flex overflow-hidden">
        {/* 主编辑器面板 */}
        <div className="flex-1 overflow-hidden">
          {showHexView ? (
            <NddHexViewer
              content={activeFile.content}
              onClose={toggleHexView}
            />
          ) : (
            <NddEditor
              fileId={activeFile.id}
              language={activeFile.language}
              content={activeFile.content}
              readOnly={readOnly}
              wordWrap={wordWrap}
              showWhitespace={showWhitespace}
              columnMode={columnMode}
              zoomLevel={zoomLevel}
              onChange={(content) => setContent(activeFile.id, content)}
              onCursorChange={(line, col) =>
                setCursorPosition({ line, col })
              }
              onFindToggle={toggleFindPanel}
              onEditorViewReady={handleEditorViewReady}
            />
          )}
        </div>

        {/* 插件预览面板（右侧） */}
        {showPreview && canPreview && (
          <div className="w-[45%] min-w-[300px] max-w-[600px] flex-shrink-0">
            <PluginPreview
              language={activeFile.language}
              content={activeFile.content}
              title={`${activeFile.language === 'markdown' ? 'Markdown' : 'PlantUML'} 预览`}
              onClose={() => setShowPreview(false)}
            />
          </div>
        )}

        {/* 插件管理面板（右侧） */}
        {showPluginPanel && (
          <div className="w-[320px] flex-shrink-0">
            <PluginPanel onClose={() => setShowPluginPanel(false)} />
          </div>
        )}
      </div>

      {/* ── 状态栏 ── */}
      <NddStatusBar
        language={activeFile.language}
        encoding={encoding}
        lineEnding={lineEnding}
        cursorLine={cursorPosition?.line ?? 1}
        cursorCol={cursorPosition?.col ?? 0}
        zoomLevel={zoomLevel}
        isReadOnly={readOnly}
        columnMode={columnMode}
        fileSize={fileSize}
        onEncodingChange={setEncoding}
        onLineEndingChange={setLineEnding}
      />
    </div>
  );
}
