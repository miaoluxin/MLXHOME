# Contributing to MLX

Thank you for considering contributing to MLX! Here's how you can help.

## Code of Conduct

Be respectful, constructive, and collaborative. Harassment or offensive behavior will not be tolerated.

## How to Contribute

### Reporting Bugs

1. Check existing issues to avoid duplicates
2. Use the bug report template (`.github/ISSUE_TEMPLATE/bug_report.md`)
3. Include: OS version, MLX version, steps to reproduce, expected vs actual behavior, screenshots if applicable

### Suggesting Features

1. Use the feature request template (`.github/ISSUE_TEMPLATE/feature_request.md`)
2. Explain the problem your feature solves
3. Describe the proposed solution with examples

### Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Make your changes
4. Run `npm run build` to ensure TypeScript compilation passes
5. Commit with clear messages (use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`)
6. Push to your fork and open a PR

## Development Setup

```bash
git clone https://github.com/miaoluxin/MLXHOME.git
cd MLX_Tool_Git
npm install
npm run dev   # development mode with hot reload
```

## Code Style

- TypeScript strict mode is enabled — avoid `any` types when possible
- Components use named exports (not default exports) — e.g., `export function XTerm()`
- Zustand stores use `create()` with explicit interfaces
- Use Tailwind CSS utility classes; avoid inline styles for layout
- All panels should follow the existing pattern: `DraggablePanelHeader` + `glass-panel` + `flex-col`
- When adding new panels, update `PanelId` in `DraggablePanelHeader.tsx`, `useLayoutStore`, `AppMain.tsx`, and `AppShell.tsx`

## Project Structure

```
src/
├── main/           # Electron main process (IPC handlers, services)
├── preload/        # contextBridge API
├── renderer/       # React UI
│   ├── components/ # Components by domain
│   ├── stores/     # Zustand state stores
│   ├── styles/     # CSS
│   └── types/      # TypeScript declarations
└── shared/         # IPC channels, shared types
```

## Questions?

Open a discussion on GitHub or check existing documentation in the `docs/` folder.
