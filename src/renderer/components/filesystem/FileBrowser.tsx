import { VscFiles, VscClose, VscRefresh } from 'react-icons/vsc';
import { AddressBar } from './AddressBar';
import { FavoritesButton } from './FavoritesButton';
import { FavoritesBar } from './FavoritesBar';
import { FileTree } from './FileTree';
import { DraggablePanelHeader } from '../layout/DraggablePanelHeader';
import { useFileStore } from '../../stores/useFileStore';
import { useLayoutStore } from '../../stores/useLayoutStore';

export function FileBrowser() {
  const { currentPath, setCurrentPath } = useFileStore();
  const toggleFileBrowser = useLayoutStore((s) => s.toggleFileBrowser);

  return (
    <div className="h-full flex flex-col glass-panel overflow-hidden">
      {/* 标题栏 */}
      <DraggablePanelHeader panelId="fileBrowser" className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <VscFiles size={15} className="text-accent" />
          <span className="text-xs font-medium text-text-secondary">文件浏览器</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => useFileStore.getState().triggerRefresh()}
            className="p-1 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
            title="刷新文件列表"
          >
            <VscRefresh size={14} />
          </button>
          <FavoritesButton currentPath={currentPath} />
          <button
            onClick={toggleFileBrowser}
            className="p-1 rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
            title="关闭文件浏览器 (Ctrl+B)"
          >
            <VscClose size={14} />
          </button>
        </div>
      </DraggablePanelHeader>

      {/* 地址栏 */}
      <div className="border-b border-border-subtle">
        <AddressBar
          currentPath={currentPath}
          onNavigate={(path) => setCurrentPath(path)}
        />
      </div>

      {/* 收藏夹快捷栏 */}
      <FavoritesBar />

      {/* 表头 */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-border-subtle text-[10px] text-text-tertiary select-none">
        <span className="w-[18px] flex-shrink-0" />
        <span className="flex-1">名称</span>
        <span className="w-16 text-right">大小</span>
        <span className="w-20 text-right">类型</span>
        <span className="w-36 text-right">修改日期</span>
      </div>

      {/* 文件列表 */}
      <FileTree rootPath={currentPath} />
    </div>
  );
}
