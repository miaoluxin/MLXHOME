import { ipcMain, app } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import * as fs from 'fs';
import * as path from 'path';

const SAMPLE_PROMPTS: Array<{ dir: string; file: string; content: string }> = [
  {
    dir: 'coding',
    file: 'Code Review.md',
    content: `# Code Review

请审查以下代码，关注：
1. 潜在的性能瓶颈
2. 安全隐患（SQL注入、XSS等）
3. 代码风格和可维护性
4. 错误处理是否完善

请逐行分析，给出具体的改进建议。`,
  },
  {
    dir: 'coding',
    file: '重构建议.md',
    content: `# 重构建议

分析以下代码的重构方向：
1. 是否有重复逻辑可以提取
2. 是否有过长函数需要拆分
3. 命名是否清晰
4. 是否遵循单一职责原则

请给出具体的重构方案和代码示例。`,
  },
  {
    dir: 'writing',
    file: '文章润色.md',
    content: `# 文章润色

请润色以下文本，要求：
1. 保持原意不变
2. 改善语句流畅度
3. 优化用词精准度
4. 调整段落结构

请同时说明你的修改理由。`,
  },
];

export function getPromptsDir(): string {
  // 打包后 exe 同级，开发时项目根目录
  const base = app.isPackaged
    ? path.dirname(process.execPath)
    : app.getAppPath();
  return path.join(base, 'prompts');
}

function ensurePromptsDir(dir: string) {
  if (fs.existsSync(dir)) return;
  fs.mkdirSync(dir, { recursive: true });
  for (const p of SAMPLE_PROMPTS) {
    const subDir = path.join(dir, p.dir);
    if (!fs.existsSync(subDir)) fs.mkdirSync(subDir, { recursive: true });
    const filePath = path.join(subDir, p.file);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, p.content, 'utf-8');
    }
  }
}

export function registerPromptsIpc() {
  const promptsDir = getPromptsDir();
  ensurePromptsDir(promptsDir);

  ipcMain.handle(IPC.PROMPTS_DIR, () => {
    return promptsDir;
  });
}
