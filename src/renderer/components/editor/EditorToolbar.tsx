import { useCallback } from 'react';
import {
  VscNewFile,
  VscSave,
  VscSaveAs,
  VscDiscard,
  VscRedo,
  VscSearch,
  VscReplace,
  VscWordWrap,
  VscWhitespace,
  VscTable,
} from 'react-icons/vsc';
import { useEditorStore } from '../../stores/useEditorStore';

interface EditorToolbarProps {
  onUndo?: () => void;
  onRedo?: () => void;
}

export function EditorToolbar({ onUndo, onRedo }: EditorToolbarProps) {
  const {
    openFiles, activeFileId,
    wordWrap, showWhitespace, columnMode,
    showFindPanel, showReplacePanel,
    toggleFindPanel, toggleReplacePanel,
    toggleWordWrap, toggleWhitespace, toggleColumnMode,
    createNewFile, markClean, saveAsFile,
  } = useEditorStore();

  const activeFile = openFiles.find((f) => f.id === activeFileId);
  const hasActiveFile = !!activeFile;

  // ── 另存为逻辑（提取为单独函数，供保存和另存为按钮共用） ──
  const doSaveAs = useCallback(async (file: typeof activeFile) => {
    if (!file) return;
    try {
      const newPath = await window.electronAPI.dialog.saveFile();
      if (!newPath) return;
      await window.electronAPI.fs.write(newPath, file.content);
      saveAsFile(file.id, newPath, file.content);
    } catch { /* ignore */ }
  }, [saveAsFile]);

  // ── 保存 ──
  const handleSave = useCallback(async () => {
    if (!activeFile || !activeFile.isDirty) return;
    if (!activeFile.path) {
      // 未命名文件 → 弹出另存为
      await doSaveAs(activeFile);
      return;
    }
    try {
      await window.electronAPI.fs.write(activeFile.path, activeFile.content);
      markClean(activeFile.id);
    } catch { /* ignore */ }
  }, [activeFile, markClean, doSaveAs]);

  // ── 另存为 ──
  const handleSaveAs = useCallback(async () => {
    await doSaveAs(activeFile);
  }, [activeFile, doSaveAs]);

  // ── 撤销/重做 ──
  const handleUndo = useCallback(() => {
    onUndo?.();
  }, [onUndo]);

  const handleRedo = useCallback(() => {
    onRedo?.();
  }, [onRedo]);

  // ── 新建 ──
  const handleNew = useCallback(() => {
    createNewFile();
  }, [createNewFile]);

  // ── Tooltip 统一样式 ──
  const btnBase =
    'p-1.5 rounded transition-colors duration-150 text-text-secondary hover:text-text-primary hover:bg-bg-hover';
  const btnDisabled = 'opacity-30 cursor-not-allowed';
  const toggleBase = (on: boolean) =>
    `p-1.5 rounded transition-colors duration-150 ${
      on
        ? 'bg-accent/20 text-accent hover:bg-accent/30'
        : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
    }`;

  return (
    <div className="flex items-center gap-0.5 px-3 py-1 border-b border-border-subtle h-9 shrink-0 select-none">
      {/* ── 文件组 ── */}
      <button
        onClick={handleNew}
        className={btnBase}
        title="新建文件 (Ctrl+N)"
      >
        <VscNewFile size={15} />
      </button>
      <button
        onClick={handleSave}
        disabled={!hasActiveFile || (!activeFile?.isDirty && !!activeFile?.path)}
        className={`${btnBase} ${!hasActiveFile || (!activeFile?.isDirty && !!activeFile?.path) ? btnDisabled : ''}`}
        title="保存 (Ctrl+S)"
      >
        <VscSave size={15} />
      </button>
      <button
        onClick={handleSaveAs}
        disabled={!hasActiveFile}
        className={`${btnBase} ${!hasActiveFile ? btnDisabled : ''}`}
        title="另存为... (Ctrl+Shift+S)"
      >
        <VscSaveAs size={15} />
      </button>

      <div className="w-px h-4 bg-border-subtle mx-1" />

      {/* ── 编辑组 ── */}
      <button
        onClick={handleUndo}
        disabled={!hasActiveFile}
        className={`${btnBase} ${!hasActiveFile ? btnDisabled : ''}`}
        title="撤销 (Ctrl+Z)"
      >
        <VscDiscard size={15} />
      </button>
      <button
        onClick={handleRedo}
        disabled={!hasActiveFile}
        className={`${btnBase} ${!hasActiveFile ? btnDisabled : ''}`}
        title="重做 (Ctrl+Y)"
      >
        <VscRedo size={15} />
      </button>

      <div className="w-px h-4 bg-border-subtle mx-1" />

      {/* ── 查找组 ── */}
      <button
        onClick={toggleFindPanel}
        disabled={!hasActiveFile}
        className={`${btnBase} ${showFindPanel ? 'bg-accent/20 text-accent' : ''} ${!hasActiveFile ? btnDisabled : ''}`}
        title="查找 (Ctrl+F)"
      >
        <VscSearch size={15} />
      </button>
      <button
        onClick={toggleReplacePanel}
        disabled={!hasActiveFile}
        className={`${btnBase} ${showReplacePanel ? 'bg-accent/20 text-accent' : ''} ${!hasActiveFile ? btnDisabled : ''}`}
        title="查找替换 (Ctrl+H)"
      >
        <VscReplace size={15} />
      </button>

      <div className="w-px h-4 bg-border-subtle mx-1" />

      {/* ── 视图组 ── */}
      <button
        onClick={toggleWordWrap}
        disabled={!hasActiveFile}
        className={`${toggleBase(wordWrap)} ${!hasActiveFile ? btnDisabled : ''}`}
        title={wordWrap ? '取消自动换行' : '自动换行'}
      >
        <VscWordWrap size={15} />
      </button>
      <button
        onClick={toggleWhitespace}
        disabled={!hasActiveFile}
        className={`${toggleBase(showWhitespace)} ${!hasActiveFile ? btnDisabled : ''}`}
        title={showWhitespace ? '隐藏空白符' : '显示空白符 (空格·制表符)'}
      >
        <VscWhitespace size={15} />
      </button>
      <button
        onClick={toggleColumnMode}
        disabled={!hasActiveFile}
        className={`${toggleBase(columnMode)} ${!hasActiveFile ? btnDisabled : ''}`}
        title={columnMode ? '退出列编辑模式' : '列编辑模式 (Alt+拖拽矩形选择)'}
      >
        <VscTable size={15} />
      </button>
    </div>
  );
}
