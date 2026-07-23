# MLX Forge — 快速开始

## 前置条件

| 要求 | 版本 |
|-------------|---------|
| 操作系统 | Windows 10 64-bit 或更高 |
| 内存 | 最低 4 GB，建议 8 GB |
| 磁盘 | 运行需 500 MB，构建需 2 GB+（node_modules） |

## 方案一：下载便携版（推荐）

1. 前往 [Releases 页面](https://github.com/mlxforge/MLX-Forge/releases)
2. 下载 `mlxforge-1.0.0-portable.exe`
3. 双击运行 — 无需安装

## 方案二：从源码构建

### 第 1 步：安装 Node.js

从 [nodejs.org](https://nodejs.org/) 下载并安装 Node.js 20+。

### 第 2 步：克隆并安装

```bash
git clone https://github.com/mlxforge/MLX-Forge.git
cd MLX-Forge
npm install
```

### 第 3 步：开发模式运行

```bash
npm run dev
```

启动 Vite 开发服务器，主进程和渲染进程都支持热重载。

### 第 4 步：生产构建

```bash
npm run build              # 编译 TypeScript + Vite 构建
npx electron-builder --win # 打包为便携版 exe
```

输出：`release\mlxforge-1.0.0-portable.exe`

## 首次启动

1. 启动 MLX Forge
2. 选择项目文件夹（你的代码所在目录）
3. 终端将自动启动 `opencode` 和 `claude`
4. 按 `Ctrl+Shift+/` 查看所有快捷键

## 常见问题

| 问题 | 解决方案 |
|---------|----------|
| 应用无法启动 | 确保已安装 Visual C++ Redistributable |
| 终端显示空白 | 等待 3 秒让 Claude 终端初始化 |
| 文件索引未就绪 | 索引器在启动后 10 秒开始，首次扫描 30-60 秒 |
| Electron 版本不匹配 | 运行 `npx electron-rebuild` 重新编译原生模块 |
