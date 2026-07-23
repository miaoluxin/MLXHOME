import { ipcMain, shell, dialog } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execFile } from 'child_process';

export function registerClaudeToolsIpc() {
const homeDir = os.homedir();
const claudeDir = path.join(homeDir, '.claude');

// ── 对话列表（主数据源：history.jsonl，按 sessionId 分组）──
ipcMain.handle(IPC.CLAUDE_CONVERSATIONS_LIST, async () => {
  try {
    const historyPath = path.join(claudeDir, 'history.jsonl');
    if (!fs.existsSync(historyPath)) return [];

    const content = fs.readFileSync(historyPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    // 按 sessionId 分组
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

    // 辅助：project 路径 → projects 子目录名
    // D:\MLXObsidianDOC\MLX_AI → D--MLXObsidianDOC-MLX_AI
    const projectToDir = (p: string) => p.replace(/:/g, '-').replace(/[\\/]/g, '-');

    const results: Array<{ id: string; title: string; date: string; messageCount: number; projectPath: string }> = [];
    for (const [sid, g] of groups) {
      const timestamps = g.timestamps.sort((a, b) => a - b);
      const entryCount = timestamps.length;

      // 尝试从 projects 目录读取消息文件获取真实消息数
      // 没有实际消息内容的对话直接跳过，不展示在列表中
      let messageCount = 0;
      let hasMessageFile = false;
      if (g.project && sid) {
        const dirName = projectToDir(g.project);
        const msgPath = path.join(claudeDir, 'projects', dirName, sid + '.jsonl');
        if (fs.existsSync(msgPath)) {
          try {
            const fc = fs.readFileSync(msgPath, 'utf-8').trim();
            if (fc) {
              messageCount = fc.split('\n').filter(Boolean).length;
              hasMessageFile = true;
            }
          } catch { /* skip */ }
        }
      }

      // 跳过来自 history.jsonl 但没有实际消息内容的对话
      if (!hasMessageFile) continue;

      results.push({
        id: sid,
        title: g.display.substring(0, 80),
        date: new Date(timestamps[timestamps.length - 1]).toISOString(),
        messageCount,
        projectPath: g.project,
      });
    }

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
    for (const cp of candidatePaths) { if (fs.existsSync(cp)) { msgPath = cp; break; } }
    if (!msgPath) return { messages, totalInputTokens: 0, totalOutputTokens: 0, model: undefined };

    const content = fs.readFileSync(msgPath, 'utf-8');
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
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
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

function runOpencode(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(getOpencodePath(), args, { timeout: 10000 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });
}

ipcMain.handle(IPC.OPENCODE_CONVERSATIONS_LIST, async () => {
  try {
    const stdout = await runOpencode(['session', 'list', '--format', 'json', '--max-count', '200']);
    const sessions = JSON.parse(stdout);
    if (!Array.isArray(sessions)) return [];

    // 批量查询所有 session 的消息数（替代 N+1）
    const countMap = new Map<string, number>();
    try {
      const cntStdout = await runOpencode(['db', 'SELECT session_id, COUNT(*) as c FROM message GROUP BY session_id']);
      const rows = JSON.parse(cntStdout);
      if (Array.isArray(rows)) {
        for (const row of rows) {
          if (row.session_id && typeof row.c === 'number') countMap.set(row.session_id, row.c);
        }
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
        messageCount: countMap.get(s.id) || 1,
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
    const stdout = await runOpencode(['db', `SELECT m.id, m.time_created, m.data FROM message m WHERE m.session_id='${conversationId.replace(/'/g, "''")}' ORDER BY m.time_created`]);
    const lines = stdout.trim().split('\n').filter(Boolean);
    const messages: Array<{ role: string; content: string; timestamp: string }> = [];

    for (const line of lines) {
      try {
        const row = JSON.parse(line);
        if (!row || !row.data) continue;
        const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
        const role = data.role === 'user' ? 'user' : 'assistant';
        const text = (typeof data.content === 'string' ? data.content : data.content?.text || data.text || '').trim();
        if (text) {
          messages.push({
            role,
            content: text,
            timestamp: row.time_created ? new Date(row.time_created).toISOString() : '',
          });
        }
      } catch { /* skip */ }
    }
    return { messages, totalInputTokens: 0, totalOutputTokens: 0, model: undefined };
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
    await runOpencode(['session', 'delete', conversationId]);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});
}
