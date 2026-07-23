import { useEffect } from 'react';
import { VscExtensions, VscClose, VscAdd, VscTrash, VscRefresh } from 'react-icons/vsc';
import { DraggablePanelHeader } from '../layout/DraggablePanelHeader';
import { useLayoutStore } from '../../stores/useLayoutStore';
import { useTerminalStore } from '../../stores/useTerminalStore';
import { useSkillStore } from '../../stores/useSkillStore';

export function SkillManager() {
  const { skills, loading, loadSkills } = useSkillStore();

  useEffect(() => { loadSkills(); }, []);

  const handleInstall = async () => {
    try {
      const result = await window.electronAPI.claudeTools.installSkill();
      if (result.success) {
        loadSkills();
        if (result.command) {
          const activeId = useTerminalStore.getState().activeId;
          if (activeId) window.electronAPI.terminal.write(activeId, result.command + '\n');
        }
      }
    } catch { /* ignore */ }
  };

  const handleDelete = async (skill: { path: string }) => {
    try {
      await window.electronAPI.claudeTools.deleteSkill(skill.path);
      loadSkills();
    } catch { /* ignore */ }
  };

  return (
    <div className="h-full flex flex-col glass-panel overflow-hidden">
      <DraggablePanelHeader panelId="skills" className="flex items-center justify-between px-3 py-2 border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center gap-2">
          <VscExtensions size={15} className="text-accent" />
          <span className="text-xs font-medium text-text-secondary">Skill 管理</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={loadSkills} className="w-6 h-6 flex items-center justify-center rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors" title="刷新">
            <VscRefresh size={14} />
          </button>
          <button onClick={handleInstall} className="w-6 h-6 flex items-center justify-center rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors" title="导入 Skill">
            <VscAdd size={16} />
          </button>
          <button onClick={() => useLayoutStore.getState().setShowSkills(false)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20 text-text-secondary hover:text-red-400 transition-colors" title="关闭">
            <VscClose size={16} />
          </button>
        </div>
      </DraggablePanelHeader>
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center h-full text-xs text-text-tertiary">加载中...</div>
        ) : skills.length === 0 ? (
          <div className="flex items-center justify-center h-full text-xs text-text-tertiary">暂无已安装 Skill</div>
        ) : (
          skills.map((skill, idx) => (
            <div key={idx} className="group flex items-start justify-between px-2 py-2 rounded hover:bg-bg-hover file-row">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-primary truncate">{skill.name}</span>
                  <span className={`text-[9px] px-1 rounded flex-shrink-0 ${skill.source === '内置' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>{skill.source}</span>
                </div>
                {skill.description && <div className="text-[10px] text-text-tertiary mt-0.5 truncate">{skill.description}</div>}
              </div>
              {skill.source !== '内置' && (
                <button onClick={() => handleDelete(skill)} className="w-5 h-5 hidden group-hover:flex items-center justify-center rounded hover:bg-red-500/20 text-text-tertiary hover:text-red-400 transition-colors ml-1 flex-shrink-0" title="删除">
                  <VscTrash size={12} />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
