import { useEffect, useMemo } from 'react';
import { VscCommentDiscussion, VscClose, VscRefresh, VscReply, VscArrowLeft, VscArrowDown } from 'react-icons/vsc';
import { DraggablePanelHeader } from '../layout/DraggablePanelHeader';
import { useLayoutStore } from '../../stores/useLayoutStore';
import { useTerminalStore } from '../../stores/useTerminalStore';
import { useConversationStore } from '../../stores/useConversationStore';

const MODEL_CONTEXT: Record<string, number> = {
  'deepseek-v4-pro': 1000000,
  'deepseek-v4': 128000,
  'claude-fable-5': 200000,
  'claude-opus-4-8': 200000,
  'claude-sonnet-5': 200000,
  'claude-haiku-4-5': 200000,
  'claude-opus-4': 200000,
  'claude-sonnet-4': 200000,
  'gpt-4-turbo': 128000,
  'gpt-4o': 128000,
  'gpt-4': 128000,
};

function getContextWindow(model?: string): number {
  if (!model) return 200000;
  const sorted = Object.entries(MODEL_CONTEXT).sort(([a], [b]) => b.length - a.length);
  for (const [key, size] of sorted) {
    if (model.toLowerCase().includes(key.toLowerCase())) return size;
  }
  return 200000;
}

function fmtK(n: number): string {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
}

export function ConversationManager() {
  const tool = useConversationStore((s) => s.tool);
  const {
    conversations, loading, error,
    selectedId, messages, messagesLoading,
    totalInputTokens, totalOutputTokens, tokenModel,
    setTool, loadConversations, selectConversation, resumeConversation, deleteConversation, clearSelection,
  } = useConversationStore();

  useEffect(() => { loadConversations(); }, []);

  const handleResume = async (conv: { id: string }) => {
    try {
      const command = await resumeConversation(conv.id);
      const activeId = useTerminalStore.getState().activeId;
      if (activeId && command) {
        window.electronAPI.terminal.write(activeId, command + '\n');
      }
    } catch { /* ignore */ }
  };

  const handleExport = async (conv: { id: string; title: string }) => {
    const md = messages.map(m =>
      `## ${m.role === 'user' ? '用户' : 'AI'}\n\n${m.content}\n`
    ).join('\n---\n\n');
    const blob = new Blob([`# ${conv.title}\n\n${md}`], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${conv.title || '对话'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatDate = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const formatMsgTime = (iso: string) => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const tokenStats = useMemo(() => {
    const totalInput = totalInputTokens;
    const totalOutput = totalOutputTokens;
    const total = totalInput + totalOutput;
    const model = tokenModel;
    const context = getContextWindow(model);
    const pct = context > 0 ? Math.round((total / context) * 100) : 0;
    const remaining = Math.max(0, context - total);
    return { totalInput, totalOutput, total, context, pct, remaining, model };
  }, [totalInputTokens, totalOutputTokens, tokenModel]);

  const selectedConv = conversations.find(c => c.id === selectedId);

  return (
    <div className="h-full flex flex-col glass-panel overflow-hidden">
      <DraggablePanelHeader panelId="conversations" className="flex items-center justify-between px-3 py-2 border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <VscCommentDiscussion size={15} className="text-accent flex-shrink-0" />
          <span className="text-xs font-medium text-text-secondary truncate">
            {selectedId ? (selectedConv?.title || '对话详情') : '对话管理'}
          </span>
          {!selectedId && conversations.length > 0 && <span className="text-[10px] text-text-tertiary flex-shrink-0">({conversations.length})</span>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {selectedId ? (
            <button onClick={() => handleExport(selectedConv!)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors" title="导出为 Markdown">
              <VscArrowDown size={14} />
            </button>
          ) : (
            <button onClick={loadConversations} className="w-6 h-6 flex items-center justify-center rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors" title="刷新">
              <VscRefresh size={14} />
            </button>
          )}
          <button onClick={() => useLayoutStore.getState().setShowConversations(false)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20 text-text-secondary hover:text-red-400 transition-colors" title="关闭">
            <VscClose size={16} />
          </button>
        </div>
      </DraggablePanelHeader>

      {/* 工具 Tab 切换 */}
      <div className="flex border-b border-border-subtle flex-shrink-0">
        <button
          onClick={() => setTool('claude')}
          className={`flex-1 text-xs py-1.5 text-center transition-colors ${tool === 'claude' ? 'text-accent border-b-2 border-accent font-medium' : 'text-text-tertiary hover:text-text-secondary'}`}
        >
          Claude
        </button>
        <button
          onClick={() => setTool('opencode')}
          className={`flex-1 text-xs py-1.5 text-center transition-colors ${tool === 'opencode' ? 'text-accent border-b-2 border-accent font-medium' : 'text-text-tertiary hover:text-text-secondary'}`}
        >
          Opencode
        </button>
      </div>

      {/* ── 详情模式 ── */}
      {selectedId ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle flex-shrink-0 bg-bg-deep sticky top-0 z-10">
            <button onClick={clearSelection} className="flex items-center gap-1 px-2 py-1 text-[10px] text-text-secondary hover:text-text-primary rounded hover:bg-bg-hover transition-colors" title="返回列表">
              <VscArrowLeft size={12} /> 返回
            </button>
            <div className="flex-1" />
            <button onClick={() => { if (selectedConv) handleResume(selectedConv); }}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] bg-accent/10 text-accent rounded hover:bg-accent/20 transition-colors" title="恢复对话到终端">
              <VscReply size={12} /> 恢复到终端
            </button>
            <span className="text-[10px] text-text-tertiary">{messages.length} 条消息</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {messagesLoading ? (
              <div className="flex items-center justify-center h-full text-xs text-text-tertiary">加载中...</div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-2">
                <span className="text-xs text-text-tertiary">暂无消息内容</span>
                <button onClick={clearSelection} className="text-xs text-accent hover:underline">← 返回列表</button>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isUser = msg.role === 'user';
                return (
                  <div key={idx}>
                    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[88%] rounded-lg px-3 py-2 ${isUser ? 'bg-accent/15 text-text-primary' : 'bg-bg-base text-text-primary'}`}>
                        <div className="text-[10px] text-text-tertiary mb-0.5 flex items-center gap-2">
                          <span>{isUser ? 'You' : tool === 'claude' ? 'Claude' : 'Opencode'}</span>
                          {msg.timestamp && <span>{formatMsgTime(msg.timestamp)}</span>}
                          {msg.tokens && (
                            <span className="opacity-60">
                              ↑{fmtK(msg.tokens.input)} ↓{fmtK(msg.tokens.output)}
                            </span>
                          )}
                        </div>
                        <div className="text-xs whitespace-pre-wrap break-words leading-relaxed">{msg.content}</div>
                      </div>
                    </div>
                    {idx === messages.length - 1 && tokenStats.total > 0 && (
                      <div className="mt-3 p-3 rounded-lg bg-bg-base border border-border-subtle">
                        <div className="text-[10px] font-medium text-text-secondary mb-2">Token 用量统计</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                          <span className="text-text-tertiary">模型</span>
                          <span className="text-text-primary text-right">{tokenStats.model || '-'}</span>
                          <span className="text-text-tertiary">输入 tokens</span>
                          <span className="text-text-primary text-right">{fmtK(tokenStats.totalInput)}</span>
                          <span className="text-text-tertiary">输出 tokens</span>
                          <span className="text-text-primary text-right">{fmtK(tokenStats.totalOutput)}</span>
                          <span className="text-text-tertiary">总计使用</span>
                          <span className="text-text-primary text-right">{fmtK(tokenStats.total)}</span>
                          <span className="text-text-tertiary">上下文窗口</span>
                          <span className="text-text-primary text-right">{fmtK(tokenStats.context)}</span>
                          <span className="text-text-tertiary">使用比例</span>
                          <span className={`text-right ${tokenStats.pct > 80 ? 'text-red-400' : tokenStats.pct > 50 ? 'text-yellow-400' : 'text-green-400'}`}>{tokenStats.pct}%</span>
                          <span className="text-text-tertiary">剩余可用</span>
                          <span className="text-right text-green-400">{fmtK(tokenStats.remaining)}</span>
                        </div>
                        <div className="mt-2 h-1.5 bg-bg-deep rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${tokenStats.pct > 80 ? 'bg-red-500' : tokenStats.pct > 50 ? 'bg-yellow-500' : 'bg-green-500'}`}
                            style={{ width: `${Math.min(100, tokenStats.pct)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-2">
          {error && (
            <div className="text-[10px] text-red-400 px-2 py-1 mb-1 bg-red-500/10 rounded">{error}</div>
          )}
          {loading ? (
            <div className="flex items-center justify-center h-full text-xs text-text-tertiary">加载中...</div>
          ) : conversations.length === 0 ? (
            <div className="flex items-center justify-center h-full text-xs text-text-tertiary">暂无对话记录</div>
          ) : (
            conversations.filter(c => c.messageCount > 0).map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center justify-between px-2 py-2 rounded cursor-pointer file-row ${selectedId === conv.id ? 'bg-accent/10' : 'hover:bg-bg-hover'}`}
                onClick={() => selectConversation(conv.id, conv.projectPath)}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-text-primary truncate">{conv.title}</div>
                  <div className="text-[10px] text-text-tertiary mt-0.5">
                    {formatDate(conv.date)}
                    {conv.messageCount > 0 && ` · ${conv.messageCount} 条消息`}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id, conv.projectPath); }}
                  className="w-5 h-5 hidden group-hover:flex items-center justify-center rounded hover:bg-red-500/20 text-text-tertiary hover:text-red-400 transition-colors ml-1 flex-shrink-0"
                  title="删除"
                >
                  <VscClose size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
