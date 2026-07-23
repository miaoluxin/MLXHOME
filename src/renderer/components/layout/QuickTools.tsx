import { VscFiles, VscSearch, VscTerminal, VscCode, VscCommentDiscussion, VscExtensions, VscServerProcess, VscGlobe, VscSymbolRuler } from 'react-icons/vsc';
import { useLayoutStore } from '../../stores/useLayoutStore';
import { useEditorStore } from '../../stores/useEditorStore';

export function QuickTools() {
  const {
    showFileBrowser, setShowFileBrowser,
    showEverythingSearch, setShowEverythingSearch,
    showTerminal, setShowTerminal,
    showEditor, setShowEditor,
    showConversations, setShowConversations,
    showSkills, setShowSkills,
    showMcpConfig, setShowMcpConfig,
    showBrowser, setShowBrowser,
    showContentSearch, setShowContentSearch,
    showPrompts, setShowPrompts,
    layoutMode, setLayoutMode,
  } = useLayoutStore();
  const hasOpenFiles = useEditorStore((s) => s.openFiles.length > 0);

  const hiddenTools: { id: string; label: string; icon: React.ReactNode; onClick: () => void }[] = [];

  if (!showTerminal) {
    hiddenTools.push({
      id: 'terminal',
      label: '终端',
      icon: <VscTerminal size={16} />,
      onClick: () => setShowTerminal(true),
    });
  }

  if (!showEditor && !hasOpenFiles) {
    hiddenTools.push({
      id: 'editor',
      label: '编辑器',
      icon: <VscCode size={16} />,
      onClick: () => setShowEditor(true),
    });
  }

  if (!showFileBrowser) {
    hiddenTools.push({
      id: 'files',
      label: '文件系统',
      icon: <VscFiles size={16} />,
      onClick: () => setShowFileBrowser(true),
    });
  }

  if (!showEverythingSearch) {
    hiddenTools.push({
      id: 'search',
      label: '文件搜索',
      icon: <VscSearch size={16} />,
      onClick: () => setShowEverythingSearch(true),
    });
  }

  if (!showConversations) {
    hiddenTools.push({
      id: 'conversations',
      label: '对话管理',
      icon: <VscCommentDiscussion size={16} />,
      onClick: () => setShowConversations(true),
    });
  }

  if (!showSkills) {
    hiddenTools.push({
      id: 'skills',
      label: 'Skill 管理',
      icon: <VscExtensions size={16} />,
      onClick: () => setShowSkills(true),
    });
  }

  if (!showMcpConfig) {
    hiddenTools.push({
      id: 'mcpConfig',
      label: 'MCP 配置',
      icon: <VscServerProcess size={16} />,
      onClick: () => setShowMcpConfig(true),
    });
  }

  if (!showBrowser) {
    hiddenTools.push({
      id: 'browser',
      label: '浏览器',
      icon: <VscGlobe size={16} />,
      onClick: () => setShowBrowser(true),
    });
  }

  // 全部工具打开时隐藏
  if (hiddenTools.length === 0) return null;

  // 非自由排版下，点击按钮自动切换到自由模式以确保面板能渲染
  const handleToolClick = (onClick: () => void) => {
    return () => {
      if (layoutMode !== 'free') {
        setLayoutMode('free');
      }
      onClick();
    };
  };

  return (
    <div className="absolute right-1 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-1.5 py-1.5 px-0.5 bg-bg-deep border border-border-subtle rounded-lg shadow-lg">
      {hiddenTools.map((tool) => (
        <button
          key={tool.id}
          onClick={handleToolClick(tool.onClick)}
          title={tool.label}
          className="w-7 h-7 flex items-center justify-center rounded-md
            text-text-tertiary hover:text-accent hover:bg-bg-hover
            transition-colors duration-150"
        >
          {tool.icon}
        </button>
      ))}
    </div>
  );
}
