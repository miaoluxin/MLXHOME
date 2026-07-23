import { VscClose, VscCircleFilled } from 'react-icons/vsc';
import type { EditorTab } from '../../../shared/types';

interface Props {
  tabs: EditorTab[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

export function EditorTabs({ tabs, activeId, onSelect, onClose }: Props) {
  return (
    <div className="flex items-center bg-bg-deep border-b border-border-subtle overflow-x-auto">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs cursor-pointer border-r border-border-subtle
            transition-colors select-none group max-w-[180px]
            ${tab.id === activeId
              ? 'bg-bg-base text-text-primary border-t-2 border-t-accent -mt-[1px]'
              : 'text-text-secondary hover:text-text-primary hover:bg-bg-raised'
            }`}
        >
          <span className="truncate flex-1">{tab.name}</span>
          {tab.isDirty && (
            <VscCircleFilled size={8} className="text-text-secondary flex-shrink-0" />
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onClose(tab.id); }}
            className="p-0.5 rounded hover:bg-bg-hover opacity-0 group-hover:opacity-100
                       text-text-tertiary hover:text-text-primary transition-all flex-shrink-0"
          >
            <VscClose size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
