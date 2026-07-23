import { ipcMain, shell, dialog } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFile, ChildProcess } from 'child_process';

const activeProcesses = new Set<ChildProcess>();

function getOpencodePath(): string {
  const { platform, env } = process;
  const homeDir = os.homedir();
  if (platform === 'win32') {
    const local = path.join(env.LOCALAPPDATA || path.join(homeDir, 'AppData', 'Local'), 'opencode', 'opencode-mlx.exe');
    if (fs.existsSync(local)) return local;
    const chocolatey = 'C:\\ProgramData\\chocolatey\\bin\\opencode.exe';
    if (fs.existsSync(chocolatey)) return chocolatey;
  }
  return 'opencode';
}

function runOpencodeTracked(args: string[], timeout = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(getOpencodePath(), args, { timeout }, (err, stdout) => {
      activeProcesses.delete(child);
      if (err) reject(err);
      else resolve(stdout);
    });
    activeProcesses.add(child);
  });
}

export function killActiveProcesses(): void {
  for (const child of activeProcesses) {
    try { child.kill(); } catch { /* ignore */ }
  }
  activeProcesses.clear();
}

export function registerClaudeToolsIpc() {
const homeDir = os.homedir();
const claudeDir = path.join(homeDir, '.claude');

// ── 对话列表（主数据源：history.jsonl，按 sessionId 分组）──
ipcMain.handle(IPC.CLAUDE_CONVERSATIONS_LIST, async () => {
  try {
    const historyPath = path.join(claudeDir, 'history.jsonl');
    if (!fs.existsSync(historyPath)) return [];

    const content = await fs.promises.readFile(historyPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    const groups = new Map<string, { display: string; timestamps: number[]; project: string }>();
    for (const line of lines) {
      try {
        const e = JSON.parse(line);
        const sid = e.sessionId || '';
        if (!sid) continue;
        const existing = groups.get(sid);
        if (existing) {
          existing.timestamps.push(e.timestamp || 0);
        } else {
          groups.set(sid, {
            display: e.display || '未命名对话',
            timestamps: [e.timestamp || 0],
            project: e.project || '',
          });
        }
      } catch { /* skip */ }
    }

    const projectToDir = (p: string) => p.replace(/:/g, '-').replace(/[\\/]/g, '-');

    const results: Array<{ id: string; title: string; date: string; messageCount: number; projectPath: string }> = [];
    const checkPromises: Promise<void>[] = [];
    for (const [sid, g] of groups) {
      checkPromises.push(
        (async () => {
          if (!g.project || !sid) return;
          const dirName = projectToDir(g.project);
          const msgPath = path.join(claudeDir, 'projects', dirName, sid + '.jsonl');
          try {
            const fc = await fs.promises.readFile(msgPath, 'utf-8');
            const trimmed = fc.trim();
            if (!trimmed) return;
            const timestamps = g.timestamps.sort((a, b) => a - b);
            results.push({
              id: sid,
              title: g.display.substring(0, 80),
              date: new Date(timestamps[timestamps.length - 1]).toISOString(),
              messageCount: trimmed.split('\n').filter(Boolean).length,
              projectPath: g.project,
            });
          } catch { /* skip */ }
        })()
      );
    }
    await Promise.all(checkPromises);

    results.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return results.slice(0, 200);
  } catch (err) {
    console.error('[ClaudeTools] 获取对话列表失败:', err);
    return [];
  }
});

// ── 对话消息内容（提取纯文本 + token 信息）──
ipcMain.handle(IPC.CLAUDE_CONVERSATION_MESSAGES, async (_event, conversationId: string, projectPath: string) => {
  try {
    const messages: Array<{ role: string; content: string; timestamp: string; tokens?: { input: number; output: number }; model?: string }> = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let lastModel: string | undefined;
    const projectToDir = (p: string) => p.replace(/:/g, '-').replace(/[\\/]/g, '-');
    const projectName = projectToDir(projectPath || '');
    const candidatePaths = [
      path.join(claudeDir, 'projects', projectName, conversationId + '.jsonl'),
      path.join(claudeDir, 'projects', conversationId + '.jsonl'),
    ];

    let msgPath = '';
    for (const cp of candidatePaths) { try { await fs.promises.access(cp); msgPath = cp; break; } catch { /* skip */ } }
    if (!msgPath) return { messages, totalInputTokens: 0, totalOutputTokens: 0, model: undefined };

    const content = await fs.promises.readFile(msgPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    for (const line of lines) {
      try {
        const outer = JSON.parse(line);
        const type = outer.type || '';
        if (!type) continue;

        // 只处理 user 和 assistant 消息
        if (type === 'user') {
          const msg = (typeof outer.message === 'string') ? JSON.parse(outer.message) : outer.message;
          const text = typeof msg?.content === 'string' ? msg.content : '';
          if (text.trim()) {
            messages.push({
              role: 'user',
              content: text,
              timestamp: outer.timestamp ? new Date(outer.timestamp).toISOString() : '',
            });
          }
        } else if (type === 'assistant') {
          const msg = (typeof outer.message === 'string') ? JSON.parse(outer.message) : outer.message;
          if (!msg?.content) continue;

          // 提取 token 使用信息（所有消息都统计，含 thinking/tool_use 消耗）
          const usage = msg.usage;
          if (usage) {
            totalInputTokens += usage.input_tokens || 0;
            totalOutputTokens += usage.output_tokens || 0;
          }
          if (msg.model) lastModel = msg.model;

          // 只提取 type === "text" 的 content block，跳过 thinking/tool_use
          let text = '';
          if (Array.isArray(msg.content)) {
            text = msg.content
              .filter((b: any) => b.type === 'text' && b.text)
              .map((b: any) => b.text)
              .join('\n');
          } else if (typeof msg.content === 'string') {
            text = msg.content;
          }

          // 只有包含实际文本内容的消息才展示（纯 thinking/tool_use 无文本则跳过）
          if (text.trim()) {
            const tokens = usage ? { input: usage.input_tokens || 0, output: usage.output_tokens || 0 } : undefined;
            messages.push({
              role: 'assistant',
              content: text.trim(),
              timestamp: outer.timestamp ? new Date(outer.timestamp).toISOString() : '',
              tokens,
              model: msg.model || undefined,
            });
          }
        }
      } catch { /* skip */ }
    }
    return { messages, totalInputTokens, totalOutputTokens, model: lastModel };
  } catch (err) {
    console.error('[ClaudeTools] 获取对话消息失败:', err);
    return { messages: [], totalInputTokens: 0, totalOutputTokens: 0, model: undefined };
  }
});

// ── 恢复对话 ──
ipcMain.handle(IPC.CLAUDE_CONVERSATION_RESUME, async (_event, conversationId: string) => {
  // 返回恢复命令，由终端执行
  return { command: `claude --resume ${conversationId}` };
});

// ── 删除对话 ──
ipcMain.handle(IPC.CLAUDE_CONVERSATION_DELETE, async (_event, conversationId: string, filePath: string) => {
  try {
    if (filePath) {
      try { await fs.promises.access(filePath); } catch { return { success: false, error: '文件不存在' }; }
      await fs.promises.unlink(filePath);
      return { success: true };
    }
    return { success: false, error: '文件不存在' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// ── Skill 列表 ──
ipcMain.handle(IPC.CLAUDE_SKILLS_LIST, async () => {
  try {
    const results: Array<{ name: string; description: string; source: string; path: string; enabled: boolean }> = [];

    // 扫描用户级 skills
    const userSkillsDir = path.join(claudeDir, 'skills');
    if (fs.existsSync(userSkillsDir)) {
      scanSkillsDir(userSkillsDir, '用户', results);
    }

    // 扫描内置 skills
    const builtinSkillsDir = path.join(claudeDir, 'builtin-skills');
    if (fs.existsSync(builtinSkillsDir)) {
      scanSkillsDir(builtinSkillsDir, '内置', results);
    }

    return results;
  } catch (err) {
    console.error('[ClaudeTools] 获取 Skill 列表失败:', err);
    return [];
  }
});

function scanSkillsDir(
  dir: string,
  source: string,
  results: Array<{ name: string; description: string; source: string; path: string; enabled: boolean }>
) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      // 扫描子目录中的 SKILL.md 或 .md 文件
      const subDir = path.join(dir, entry.name);
      const subFiles = fs.readdirSync(subDir);
      const skillFile = subFiles.find(f => f.endsWith('.md'));
      if (skillFile) {
        const filePath = path.join(subDir, skillFile);
        const content = fs.readFileSync(filePath, 'utf-8');
        const meta = parseSkillFrontmatter(content);
        results.push({
          name: meta.name || entry.name,
          description: meta.description || '',
          source,
          path: filePath,
          enabled: true,
        });
      }
    } else if (entry.name.endsWith('.md')) {
      // 直接的 .md skill 文件
      const filePath = path.join(dir, entry.name);
      const content = fs.readFileSync(filePath, 'utf-8');
      const meta = parseSkillFrontmatter(content);
      results.push({
        name: meta.name || entry.name.replace('.md', ''),
        description: meta.description || '',
        source,
        path: filePath,
        enabled: true,
      });
    }
  }
}

function parseSkillFrontmatter(content: string): { name?: string; description?: string } {
  const result: { name?: string; description?: string } = {};
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (match) {
    const yaml = match[1];
    const nameMatch = yaml.match(/name:\s*(.+)/);
    const descMatch = yaml.match(/description:\s*(.+)/);
    if (nameMatch) result.name = nameMatch[1].trim();
    if (descMatch) result.description = descMatch[1].trim();
  }
  return result;
}

// ── 导入 Skill ──
ipcMain.handle(IPC.CLAUDE_SKILL_INSTALL, async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Markdown 文件', extensions: ['md'] }],
    });
    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: '用户取消' };
    }

    const srcPath = result.filePaths[0];
    const fileName = path.basename(srcPath);
    const userSkillsDir = path.join(claudeDir, 'skills');

    if (!fs.existsSync(userSkillsDir)) {
      fs.mkdirSync(userSkillsDir, { recursive: true });
    }

    const destDir = path.join(userSkillsDir, path.basename(fileName, '.md'));
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const destPath = path.join(destDir, fileName);
    fs.copyFileSync(srcPath, destPath);

    return { success: true, path: destPath, command: `claude skill install "${destPath}"` };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// ── 删除 Skill ──
ipcMain.handle(IPC.CLAUDE_SKILL_DELETE, async (_event, skillPath: string) => {
  try {
    if (skillPath && fs.existsSync(skillPath)) {
      const dir = path.dirname(skillPath);
      fs.rmSync(dir, { recursive: true, force: true });
      return { success: true };
    }
    return { success: false, error: '文件不存在' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// ── MCP 配置读取 ──
ipcMain.handle(IPC.CLAUDE_MCP_CONFIG, async () => {
  try {
    const configPaths = [
      path.join(claudeDir, 'mcp.json'),
      path.join(homeDir, '.mcp.json'),
    ];

    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(content);
        return {
          path: configPath,
          servers: config.mcpServers || {},
        };
      }
    }

    return { path: null, servers: {} };
  } catch (err) {
    console.error('[ClaudeTools] 读取 MCP 配置失败:', err);
    return { path: null, servers: {}, error: String(err) };
  }
});

// ── 保存 MCP 配置 ──
ipcMain.handle(IPC.CLAUDE_MCP_SAVE, async (_event, servers: Record<string, any>) => {
  try {
    const configPath = path.join(claudeDir, 'mcp.json');
    const dir = path.dirname(configPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    let config: any = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
    config.mcpServers = servers;

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return { success: true, path: configPath };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// ── Opencode 对话子系统 ──

// TSV 解析工具（opencode db 输出为 tab 分隔，首行是表头）
function parseTSV(tsv: string): Record<string, string>[] {
  const lines = tsv.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split('\t');
  return lines.slice(1).map(line => {
    const cols = line.split('\t');
    const row: Record<string, string> = {};
    header.forEach((h, i) => { row[h] = cols[i] || ''; });
    return row;
  });
}

ipcMain.handle(IPC.OPENCODE_CONVERSATIONS_LIST, async () => {
  try {
    const stdout = await runOpencodeTracked(['session', 'list', '--format', 'json', '--max-count', '200']);
    const sessions = JSON.parse(stdout);
    if (!Array.isArray(sessions)) return [];

    // 批量查询所有 session 的消息数（opencode db 输出是 TSV 格式）
    const countMap = new Map<string, number>();
    try {
      const cntRaw = await runOpencodeTracked(['db', 'SELECT session_id, COUNT(*) as cnt FROM message GROUP BY session_id']);
      const rows = parseTSV(cntRaw);
      for (const row of rows) {
        const sid = row.session_id || row.id;
        const cnt = parseInt(row.cnt || '0', 10);
        if (sid && cnt > 0) countMap.set(sid, cnt);
      }
    } catch (e) {
      console.warn('[OpencodeTools] 批量查询消息数失败:', e);
    }

    const results = sessions
      .filter((s: any) => s.id && s.title)
      .map((s: any) => ({
        id: s.id,
        title: s.title?.substring(0, 80) || '未命名对话',
        date: s.updated ? new Date(s.updated).toISOString() : s.created ? new Date(s.created).toISOString() : new Date().toISOString(),
        messageCount: countMap.get(s.id) || 0,
        projectPath: s.directory || '',
      }))
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return results;
  } catch (err) {
    console.error('[OpencodeTools] 获取对话列表失败:', err);
    return [];
  }
});

ipcMain.handle(IPC.OPENCODE_CONVERSATION_MESSAGES, async (_event, conversationId: string, _projectPath: string) => {
  try {
    // 查询1：从 message 表获取 role 和 token 信息
    const msgStdout = await runOpencodeTracked(['db',
      `SELECT m.id, m.time_created, json_extract(m.data, '$.role') as role, json_extract(m.data, '$.tokens.input') as ti, json_extract(m.data, '$.tokens.output') as to_, json_extract(m.data, '$.modelID') as model_id FROM message m WHERE m.session_id='${conversationId.replace(/'/g, "''")}' ORDER BY m.time_created`
    ]);
    const msgRows = parseTSV(msgStdout);
    if (msgRows.length === 0) return { messages: [], totalInputTokens: 0, totalOutputTokens: 0, model: undefined };

    // 查询2：从 event 表获取实际的文本内容（按 messageID 分组聚合）
    const textStdout = await runOpencodeTracked(['db',
      `SELECT json_extract(data, '$.part.messageID') as mid, group_concat(json_extract(data, '$.part.text'), '') as text FROM (SELECT data FROM event WHERE json_extract(data, '$.sessionID') = '${conversationId.replace(/'/g, "''")}' AND json_extract(data, '$.part.type') = 'text' ORDER BY rowid) GROUP BY mid`
    ]);
    const textRows = parseTSV(textStdout);
    const textMap = new Map<string, string>();
    for (const row of textRows) {
      if (row.mid && row.text) textMap.set(row.mid, row.text);
    }

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let lastModel: string | undefined;
    const messages: Array<{ role: string; content: string; timestamp: string }> = [];

    for (const row of msgRows) {
      const role = row.role === 'user' ? 'user' : 'assistant';
      const msgId = row.id;
      const text = textMap.get(msgId) || '';
      const inputTokens = parseInt(row.ti || '0', 10);
      const outputTokens = parseInt(row.to_ || '0', 10);
      totalInputTokens += inputTokens;
      totalOutputTokens += outputTokens;
      if (row.model_id) lastModel = row.model_id;
      if (text) {
        messages.push({
          role,
          content: text,
          timestamp: row.time_created ? new Date(parseInt(row.time_created, 10)).toISOString() : '',
        });
      }
    }

    return { messages, totalInputTokens, totalOutputTokens, model: lastModel };
  } catch (err) {
    console.error('[OpencodeTools] 获取对话消息失败:', err);
    return { messages: [], totalInputTokens: 0, totalOutputTokens: 0, model: undefined };
  }
});

ipcMain.handle(IPC.OPENCODE_CONVERSATION_RESUME, async (_event, conversationId: string) => {
  return { command: `opencode run --session ${conversationId}` };
});

ipcMain.handle(IPC.OPENCODE_CONVERSATION_DELETE, async (_event, conversationId: string) => {
  try {
    await runOpencodeTracked(['session', 'delete', conversationId]);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});
}
