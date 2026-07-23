import { useEffect, useState } from 'react';
import { VscServerProcess, VscClose, VscAdd, VscRefresh, VscSave, VscEdit, VscJson } from 'react-icons/vsc';
import { DraggablePanelHeader } from '../layout/DraggablePanelHeader';
import { useLayoutStore } from '../../stores/useLayoutStore';
import { useMcpStore } from '../../stores/useMcpStore';

export function McpConfigTool() {
  const { configPath, servers, loading, loadConfig } = useMcpStore();
  const [editing, setEditing] = useState(false);
  const [jsonMode, setJsonMode] = useState(false); // true=JSON编辑器, false=表单模式
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  // 表单模式状态
  const [formServers, setFormServers] = useState<Record<string, any>>({});
  const [newName, setNewName] = useState('');
  const [newCommand, setNewCommand] = useState('');
  const [newArgs, setNewArgs] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  useEffect(() => { loadConfig(); }, []);

  // 进入编辑模式
  const startEdit = (mode: 'json' | 'form') => {
    if (mode === 'json') {
      setJsonMode(true);
      setJsonText(JSON.stringify(servers, null, 2));
      setJsonError(null);
    } else {
      setJsonMode(false);
      setFormServers(JSON.parse(JSON.stringify(servers)));
      setNewName('');
      setNewCommand('');
      setNewArgs('');
    }
    setEditing(true);
    setSaveMsg('');
  };

  const cancelEdit = () => {
    setEditing(false);
    setJsonMode(false);
    setJsonText('');
    setJsonError(null);
    setFormServers({});
  };

  // JSON模式保存
  const handleJsonSave = async () => {
    let parsed: Record<string, any>;
    try {
      parsed = JSON.parse(jsonText);
      if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
        setJsonError('配置必须是 JSON 对象 (如 {"serverName": {...}})');
        return;
      }
    } catch (err: any) {
      setJsonError('JSON 格式错误: ' + err.message);
      return;
    }
    setJsonError(null);
    setSaving(true);
    setSaveMsg('');
    try {
      const result = await window.electronAPI.claudeTools.saveMcpConfig(parsed);
      if (result.success) {
        setSaveMsg('保存成功: ' + result.path);
        setEditing(false);
        loadConfig();
      } else {
        setSaveMsg('保存失败: ' + (result.error || '未知错误'));
      }
    } catch (err: any) {
      setSaveMsg('保存失败: ' + err.message);
    }
    setSaving(false);
  };

  // 表单模式添加
  const handleFormAdd = () => {
    if (!newName.trim() || !newCommand.trim()) return;
    const updated = { ...formServers, [newName.trim()]: { command: newCommand.trim() } };
    if (newArgs.trim()) {
      updated[newName.trim()].args = newArgs.trim().split(/\s+/);
    }
    setFormServers(updated);
    setNewName('');
    setNewCommand('');
    setNewArgs('');
  };

  // 表单模式删除
  const handleFormDelete = (name: string) => {
    const updated = { ...formServers };
    delete updated[name];
    setFormServers(updated);
  };

  // 表单模式保存
  const handleFormSave = async () => {
    setSaving(true);
    setSaveMsg('');
    try {
      const result = await window.electronAPI.claudeTools.saveMcpConfig(formServers);
      if (result.success) {
        setSaveMsg('保存成功: ' + result.path);
        setEditing(false);
        loadConfig();
      } else {
        setSaveMsg('保存失败: ' + (result.error || '未知错误'));
      }
    } catch (err: any) {
      setSaveMsg('保存失败: ' + err.message);
    }
    setSaving(false);
  };

  const displayServers = editing && !jsonMode ? formServers : servers;
  const serverList = Object.entries(displayServers);

  return (
    <div className="h-full flex flex-col glass-panel overflow-hidden">
      <DraggablePanelHeader panelId="mcpConfig" className="flex items-center justify-between px-3 py-2 border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center gap-2">
          <VscServerProcess size={15} className="text-accent" />
          <span className="text-xs font-medium text-text-secondary">MCP 配置</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={loadConfig} className="w-6 h-6 flex items-center justify-center rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors" title="刷新">
            <VscRefresh size={14} />
          </button>
          {!editing ? (
            <>
              <button onClick={() => startEdit('form')} className="w-6 h-6 flex items-center justify-center rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors" title="表单编辑">
                <VscEdit size={14} />
              </button>
              <button onClick={() => startEdit('json')} className="w-6 h-6 flex items-center justify-center rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors" title="JSON 编辑">
                <VscJson size={14} />
              </button>
            </>
          ) : (
            <button onClick={jsonMode ? handleJsonSave : handleFormSave} disabled={saving} className="w-6 h-6 flex items-center justify-center rounded hover:bg-green-500/20 text-text-secondary hover:text-green-400 transition-colors" title="保存">
              <VscSave size={14} />
            </button>
          )}
          <button onClick={() => useLayoutStore.getState().setShowMcpConfig(false)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20 text-text-secondary hover:text-red-400 transition-colors" title="关闭">
            <VscClose size={16} />
          </button>
        </div>
      </DraggablePanelHeader>
      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center h-full text-xs text-text-tertiary">加载中...</div>
        ) : (
          <>
            {saveMsg && (
              <div className={`text-[10px] px-2 py-1 mb-2 rounded ${saveMsg.includes('失败') ? 'text-red-400 bg-red-500/10' : 'text-green-400 bg-green-500/10'}`}>{saveMsg}</div>
            )}
            {configPath && !editing && (
              <div className="text-[10px] text-text-tertiary mb-2 px-1">配置文件: {configPath}</div>
            )}

            {/* ── JSON 编辑模式 ── */}
            {editing && jsonMode && (
              <div className="flex flex-col gap-2 h-full">
                <div className="text-[10px] font-medium text-text-secondary">编辑 JSON 配置</div>
                <textarea
                  value={jsonText}
                  onChange={(e) => { setJsonText(e.target.value); setJsonError(null); }}
                  className="flex-1 w-full bg-bg-deepest border border-border-subtle rounded px-3 py-2 text-xs text-text-primary font-mono outline-none focus:border-accent resize-none"
                  style={{ minHeight: '250px', fontFamily: '"JetBrains Mono", "Cascadia Code", "Consolas", monospace', lineHeight: '1.6' }}
                  spellCheck={false}
                  placeholder='{"server-name": {"command": "npx", "args": ["-y", "@modelcontextprotocol/server-example"]}}'
                />
                {jsonError && (
                  <div className="text-[10px] text-red-400 px-2 py-1 bg-red-500/10 rounded">{jsonError}</div>
                )}
                <div className="flex gap-1">
                  <button onClick={handleJsonSave} disabled={saving} className="px-2 py-0.5 text-[10px] bg-accent/10 text-accent rounded hover:bg-accent/20 transition-colors">
                    {saving ? '保存中...' : '保存'}
                  </button>
                  <button onClick={cancelEdit} className="px-2 py-0.5 text-[10px] text-text-secondary hover:text-text-primary rounded hover:bg-bg-hover transition-colors">取消</button>
                </div>
              </div>
            )}

            {/* ── 表单编辑模式 ── */}
            {editing && !jsonMode && (
              <div className="mb-3 p-2 border border-border-subtle rounded bg-bg-base">
                <div className="text-[10px] font-medium text-text-secondary mb-2">添加服务器</div>
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="服务名称" className="w-full bg-bg-deep border border-border-subtle rounded px-2 py-1 text-[10px] text-text-primary outline-none focus:border-accent mb-1" />
                <input value={newCommand} onChange={(e) => setNewCommand(e.target.value)} placeholder="命令 (如 npx, node)" className="w-full bg-bg-deep border border-border-subtle rounded px-2 py-1 text-[10px] text-text-primary outline-none focus:border-accent mb-1" />
                <input value={newArgs} onChange={(e) => setNewArgs(e.target.value)} placeholder="参数 (空格分隔)" className="w-full bg-bg-deep border border-border-subtle rounded px-2 py-1 text-[10px] text-text-primary outline-none focus:border-accent mb-2" />
                <div className="flex gap-1">
                  <button onClick={handleFormAdd} className="px-2 py-0.5 text-[10px] bg-accent/10 text-accent rounded hover:bg-accent/20 transition-colors">添加</button>
                  <button onClick={cancelEdit} className="px-2 py-0.5 text-[10px] text-text-secondary hover:text-text-primary rounded hover:bg-bg-hover transition-colors">取消</button>
                </div>
              </div>
            )}

            {/* ── 服务器列表（非JSON编辑模式时显示）── */}
            {!(editing && jsonMode) && (
              serverList.length === 0 ? (
                <div className="flex items-center justify-center h-32 text-xs text-text-tertiary">
                  {editing ? '点击上方"添加"新增服务器' : '暂无 MCP 服务配置 — 点击 ✎ 编辑'}
                </div>
              ) : (
                serverList.map(([name, server]: [string, any]) => (
                  <div key={name} className="group px-2 py-2 rounded hover:bg-bg-hover file-row mb-1">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-text-primary font-medium">{name}</div>
                      {editing && (
                        <button onClick={() => handleFormDelete(name)} className="w-5 h-5 hidden group-hover:flex items-center justify-center rounded hover:bg-red-500/20 text-text-tertiary hover:text-red-400 transition-colors flex-shrink-0" title="删除">
                          <VscClose size={12} />
                        </button>
                      )}
                    </div>
                    <div className="text-[10px] text-text-tertiary mt-1">命令: {server.command || '-'}</div>
                    {server.args && <div className="text-[10px] text-text-tertiary">参数: {Array.isArray(server.args) ? server.args.join(' ') : String(server.args)}</div>}
                    {server.env && <div className="text-[10px] text-text-tertiary">环境变量: {Object.keys(server.env).length} 个</div>}
                  </div>
                ))
              )
            )}
          </>
        )}
      </div>
    </div>
  );
}
