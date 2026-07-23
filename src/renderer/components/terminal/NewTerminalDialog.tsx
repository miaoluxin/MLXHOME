import { useState, useRef, useEffect } from 'react';
import { VscClose, VscTerminal } from 'react-icons/vsc';

type PresetCommand = 'claude' | 'opencode' | 'custom';

interface Preset {
  id: PresetCommand;
  label: string;
  command: string;
}

const PRESETS: Preset[] = [
  { id: 'claude', label: 'Claude', command: 'claude' },
  { id: 'opencode', label: 'Opencode', command: 'opencode' },
];

interface Props {
  onConfirm: (command: string, label: string) => void;
  onCancel: () => void;
}

export function NewTerminalDialog({ onConfirm, onCancel }: Props) {
  const [selected, setSelected] = useState<PresetCommand>('claude');
  const [customCommand, setCustomCommand] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selected === 'custom' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [selected]);

  const handleConfirm = () => {
    if (selected === 'custom') {
      const cmd = customCommand.trim();
      if (!cmd) return;
      onConfirm(cmd, cmd);
    } else {
      const preset = PRESETS.find((p) => p.id === selected)!;
      onConfirm(preset.command, preset.label);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirm();
    if (e.key === 'Escape') onCancel();
  };

  const isConfirmDisabled = selected === 'custom' && !customCommand.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
    >
      <div
        className="glass-panel p-4 min-w-[320px] max-w-[400px] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <VscTerminal size={16} className="text-accent" />
            <span className="text-sm font-medium text-text-primary">新建终端会话</span>
          </div>
          <button
            onClick={onCancel}
            className="p-0.5 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
          >
            <VscClose size={16} />
          </button>
        </div>

        {/* 预设选项 */}
        <div className="space-y-2 mb-3">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setSelected(preset.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all
                ${
                  selected === preset.id
                    ? 'border-accent bg-accent/10 text-text-primary'
                    : 'border-border-subtle text-text-secondary hover:border-border-hover hover:bg-bg-hover'
                }`}
            >
              <div
                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0
                  ${selected === preset.id ? 'border-accent' : 'border-text-tertiary'}`}
              >
                {selected === preset.id && <div className="w-2 h-2 rounded-full bg-accent" />}
              </div>
              <div>
                <div className="text-sm font-medium">{preset.label}</div>
                <div className="text-xs text-text-tertiary font-mono">{preset.command}</div>
              </div>
            </button>
          ))}

          {/* 自定义指令 */}
          <button
            onClick={() => setSelected('custom')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all
              ${
                selected === 'custom'
                  ? 'border-accent bg-accent/10 text-text-primary'
                  : 'border-border-subtle text-text-secondary hover:border-border-hover hover:bg-bg-hover'
              }`}
          >
            <div
              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0
                ${selected === 'custom' ? 'border-accent' : 'border-text-tertiary'}`}
            >
              {selected === 'custom' && <div className="w-2 h-2 rounded-full bg-accent" />}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">自定义指令</div>
              {selected === 'custom' ? (
                <input
                  ref={inputRef}
                  value={customCommand}
                  onChange={(e) => setCustomCommand(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); handleConfirm(); }
                    if (e.key === 'Escape') { e.stopPropagation(); onCancel(); }
                  }}
                  placeholder="输入要执行的命令..."
                  className="mt-1 w-full bg-bg-deep border border-border-subtle rounded-md px-2 py-1 text-xs
                             text-text-primary outline-none focus:border-accent transition-colors
                             placeholder-text-tertiary font-mono"
                />
              ) : (
                <div className="text-xs text-text-tertiary">手动输入要执行的命令</div>
              )}
            </div>
          </button>
        </div>

        {/* 底部按钮 */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            className="px-4 py-1.5 text-xs rounded-md bg-bg-hover text-text-secondary hover:text-text-primary transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className="px-4 py-1.5 text-xs rounded-md bg-accent text-white hover:bg-accent-hover
                       transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            创建终端
          </button>
        </div>
      </div>
    </div>
  );
}
