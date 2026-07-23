import { useState } from 'react';
import { VscClose, VscExtensions, VscCheck, VscTrash } from 'react-icons/vsc';
import { usePluginStore } from '../../plugin-system/plugin-store';
import { deactivatePlugin, activatePlugin } from '../../plugin-system/plugin-manager';
import type { PluginManifest } from '../../plugin-system/plugin-types';

interface PluginPanelProps {
  onClose: () => void;
}

function PluginCard({ manifest, isActive, onToggle, onUninstall }: {
  manifest: PluginManifest;
  isActive: boolean;
  onToggle: () => void;
  onUninstall: () => void;
}) {
  return (
    <div className="flex items-start gap-3 px-3 py-3 border-b border-border-subtle hover:bg-bg-hover transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary truncate">{manifest.displayName}</span>
          <span className="text-[10px] text-text-tertiary bg-bg-raised px-1.5 py-0.5 rounded">{manifest.version}</span>
        </div>
        <p className="text-xs text-text-tertiary mt-0.5 line-clamp-2">{manifest.description}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] text-text-tertiary">作者: {manifest.author}</span>
          {manifest.keybindings && manifest.keybindings.length > 0 && (
            <span className="text-[10px] text-text-tertiary">
              快捷键: {manifest.keybindings.map((k) => k.key).join(', ')}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onToggle}
          className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
            isActive
              ? 'bg-accent/20 text-accent hover:bg-accent/30'
              : 'bg-bg-raised text-text-secondary hover:bg-bg-hover hover:text-text-primary'
          }`}
        >
          {isActive ? '已启用' : '已禁用'}
        </button>
        <button
          onClick={onUninstall}
          className="p-1.5 rounded text-text-tertiary hover:text-red-400 hover:bg-bg-hover transition-colors"
          title="卸载"
        >
          <VscTrash size={13} />
        </button>
      </div>
    </div>
  );
}

export function PluginPanel({ onClose }: PluginPanelProps) {
  const { installed, active, toggleActive, uninstallPlugin } = usePluginStore();

  const handleToggle = (manifest: PluginManifest) => {
    toggleActive(manifest.name);
    if (active[manifest.name]) {
      deactivatePlugin(manifest.name);
    } else {
      activatePlugin(manifest);
    }
  };

  const handleUninstall = (manifest: PluginManifest) => {
    deactivatePlugin(manifest.name);
    uninstallPlugin(manifest.name);
  };

  return (
    <div className="h-full flex flex-col bg-bg-deep border-l border-border-subtle">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <VscExtensions size={15} className="text-accent" />
          <span className="font-medium">插件管理</span>
          <span className="text-text-tertiary">({installed.length})</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
          title="关闭"
        >
          <VscClose size={14} />
        </button>
      </div>

      {/* 插件列表 */}
      <div className="flex-1 overflow-y-auto">
        {installed.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-text-tertiary text-sm gap-2 p-4">
            <VscExtensions size={32} className="opacity-30" />
            <p>暂无已安装的插件</p>
          </div>
        ) : (
          installed.map((manifest) => (
            <PluginCard
              key={manifest.name}
              manifest={manifest}
              isActive={active[manifest.name] ?? false}
              onToggle={() => handleToggle(manifest)}
              onUninstall={() => handleUninstall(manifest)}
            />
          ))
        )}
      </div>
    </div>
  );
}
