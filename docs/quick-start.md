# MLX Forge — Quick Start Guide

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Windows | 10 64-bit or later |
| RAM | 4 GB minimum, 8 GB recommended |
| Disk | 500 MB for app, 2 GB+ for node_modules during build |

## Option 1: Download Portable Executable (Recommended)

1. Go to the [Releases page](https://github.com/mlxforge/MLX-Forge/releases)
2. Download `mlxforge-1.0.0-portable.exe`
3. Double-click to run — no installation required

## Option 2: Build from Source

### Step 1: Install Node.js

Download and install Node.js 20+ from [nodejs.org](https://nodejs.org/).

### Step 2: Clone and Install

```bash
git clone https://github.com/mlxforge/MLX-Forge.git
cd MLX-Forge
npm install
```

### Step 3: Run in Development Mode

```bash
npm run dev
```

This starts the Vite dev server with hot reload for both the main process and renderer.

### Step 4: Build for Production

```bash
npm run build              # Compile TypeScript + Vite build
npx electron-builder --win # Package as portable exe
```

Output: `release\mlxforge-1.0.0-portable.exe`

## First Launch

1. Launch MLX Forge
2. Select a project folder (this is where your code lives)
3. The terminal will automatically start `opencode` and `claude`
4. Press `Ctrl+Shift+/` to view all keyboard shortcuts

## Troubleshooting

| Problem | Solution |
|---------|----------|
| App won't start | Ensure you have Visual C++ Redistributable installed |
| Terminal shows blank | Wait 3 seconds for Claude terminal to initialize |
| File indexer not ready | Indexer starts 10 seconds after launch; first scan takes 30-60s |
| Electron version mismatch | Run `npx electron-rebuild` to rebuild native modules |
