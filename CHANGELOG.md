# Changelog

## [1.0.0] - 2026-07-23

### Added
- File index settings panel with directory tree selection (gear button in EverythingSearch)
- Error Boundary for each panel — crash isolation
- Built-in theme color overrides (localStorage persistence)
- Mermaid architecture diagrams in feature documentation

### Changed
- Dark theme deepened to Material Dark level (`#0a0a0a`)
- Index default paths: home directory + project directory (configurable)
- Build environment unified to `MLX_Tool_Git/`
- ClearInlineColors now covers terminal color variables

### Fixed
- Theme colors not saving when applying on built-in themes
- Theme colors lost after switching away and back
- EverythingSearch settings button missing from packaged build
- Process hang on app close (killAll + active process tracking)
- Claude conversation scanning blocking main process (sync→async)
- Terminal IPC overhead (invoke→send)
- Opencode conversation N+1 query performance

### Added
- Dual terminal system: Opencode + Claude parallel PTY sessions
- Conversation manager with Claude/Opencode tab switching
- Content search (`Ctrl+Shift+F`) with ripgrep + Node.js fallback
- Prompt manager (`Ctrl+Shift+M`) with hierarchical .md file library
- Keyboard shortcuts help panel (`Ctrl+Shift+/`)
- Recent projects list on startup
- Git branch display in status bar
- Conversation export to Markdown
- Right-click rename in EverythingSearch
- Slow double-click rename (Windows style) in file browser

### Changed
- Startup optimization: only opencode starts immediately, claude delayed 3s
- File indexer delay: 2s → 10s
- Non-essential panels now lazy-loaded (React.lazy) for faster first paint
- Opencode conversation queries: N+1 pattern replaced with single batch query

### Fixed
- Terminal Ctrl+V double paste: added `event.preventDefault()` for xterm 5.3
- Terminal resize on maximize: ResizeObserver wrapped in `requestAnimationFrame`
- FileTree empty space right-click: Framer Motion `height:auto` removed
- FileTree path normalization for Windows drives
- Opencode conversation data: wrong table name, field mapping, and data parsing
- EverythingSearch right-click missing rename option

## [0.9.0] - 2026-07-14

### Added
- Terminal Ctrl+C/V copy/paste + right-click context menu
- File browser auto-refresh (chokidar file watching)
- New terminal dialog with command selection

### Fixed
- QuickTools button loss after layout switch
- Panel drag resize improvements

## [0.8.0] - 2026-07-13

### Added
- Dual terminal auto-start (Opencode + Claude)
- New terminal dialog with Claude/Opencode/custom command choice
- Project switch via Ctrl+Shift+P with terminal session rebuild

## [0.7.0] - 2026-07-07

### Added
- Layout state persistence across sessions
- MCP config JSON editor (form + raw JSON modes)
- Browser bookmarks, homepage, and navigation history

### Fixed
- DeepSeek v4 Pro token stats (1M context window)
- Theme switch CSS inline style cleanup
- Bootstrap: non-critical IPC modules dynamically imported

## [0.6.0] - 2026-07-06

### Added
- Conversation manager (Claude session browsing/resume)
- Skill manager (install/delete Claude skills)
- MCP config viewer
- Web browser tool (webview-based)
- Token usage statistics with context window progress bar

## [0.5.0] - 2026-07-05

### Added
- Panel drag-to-reorder with spring animations
- Frosted glass theme (later removed)
- Terminal focus guarantee (multi-layer fallback)

## [0.4.0] - 2026-07-03

### Added
- Menu bar with File/Edit/View/Theme/Help
- Custom theme system with 19 color variables
- QuickTools floating toolbar
- File search engine (Everything-style)
- Ctrl+Shift+P project switching
- File browser context menu (copy/cut/paste/rename/delete)

## [0.3.0] - 2026-07-02

### Added
- CodeMirror 6 editor replacing Monaco Editor
- Notepad-- style features (find/replace, hex viewer, line ops, status bar)
- 40+ language syntax highlighting

## [0.2.0] - 2026-07-01

### Added
- File browser with favorites
- File preview with 40+ extension whitelist
- Terminal tab rename

### Fixed
- Preload script path
- Terminal session reset on layout switch

## [0.1.0] - 2026-07-01

### Added
- Initial Electron + React + TypeScript scaffold
- PTY terminal with PowerShell + Claude integration
- Basic file system operations
