import { app } from 'electron';
import { execFile, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const JAR_URL = 'https://github.com/plantuml/plantuml/releases/latest/download/plantuml.jar';
const JAR_FILENAME = 'plantuml.jar';

/** 获取 PlantUML jar 的本地路径 */
function getJarPath(): string {
  const userDataPath = app.getPath('userData');
  return path.join(userDataPath, JAR_FILENAME);
}

/** 检查 Java 是否可用 */
export async function checkJava(): Promise<{ available: boolean; version?: string; error?: string }> {
  try {
    const { stdout } = await execFileAsync('java', ['-version'], { timeout: 5000 });
    // java -version 输出到 stderr
    const version = stdout || '';
    return { available: true, version: version.split('\n')[0] };
  } catch (err: any) {
    // 尝试从 stderr 读取
    if (err.stderr) {
      const firstLine = err.stderr.split('\n')[0];
      if (firstLine && firstLine.includes('version')) {
        return { available: true, version: firstLine };
      }
    }
    return { available: false, error: 'Java 未安装，请安装 Java Runtime Environment (JRE)' };
  }
}

/** 检查 PlantUML jar 是否已下载 */
export function isJarDownloaded(): boolean {
  try {
    return fs.existsSync(getJarPath());
  } catch {
    return false;
  }
}

/** 下载 PlantUML jar（返回下载进度 0-100） */
export function downloadJar(onProgress?: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const jarPath = getJarPath();
    const file = fs.createWriteStream(jarPath);
    let receivedBytes = 0;
    let totalBytes = 0;

    https.get(JAR_URL, (response) => {
      const contentLength = response.headers['content-length'];
      totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

      response.on('data', (chunk: Buffer) => {
        receivedBytes += chunk.length;
        file.write(chunk);
        if (totalBytes > 0 && onProgress) {
          onProgress(Math.round((receivedBytes / totalBytes) * 100));
        }
      });

      response.on('end', () => {
        file.end();
        resolve();
      });

      response.on('error', (err) => {
        file.close();
        fs.unlinkSync(jarPath);
        reject(err);
      });
    }).on('error', (err) => {
      file.close();
      if (fs.existsSync(jarPath)) fs.unlinkSync(jarPath);
      reject(err);
    });
  });
}

/** 渲染 PlantUML 内容为 SVG */
export async function renderPlantUml(content: string): Promise<string> {
  const jarPath = getJarPath();
  if (!fs.existsSync(jarPath)) {
    throw new Error('PlantUML jar 未下载，请先下载');
  }

  return new Promise((resolve, reject) => {
    const child = spawn('java', ['-jar', jarPath, '-pipe', '-tsvg'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 30000,
    });

    let svg = '';
    let error = '';

    child.stdout.on('data', (data: Buffer) => {
      svg += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      error += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0 && svg) {
        resolve(svg);
      } else {
        reject(new Error(error || `退出码: ${code}`));
      }
    });

    child.on('error', (err) => {
      reject(err);
    });

    // 写入内容并关闭 stdin
    child.stdin.write(content);
    child.stdin.end();
  });
}
