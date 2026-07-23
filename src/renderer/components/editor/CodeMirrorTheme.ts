import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import type { ThemeColors } from '../../stores/useThemeStore';

/**
 * MLX 动态编辑器主题 — 根据应用主题配色生成 CodeMirror 6 主题
 */
export function createEditorTheme(c: ThemeColors) {
  const isDark = !c.bgDeepest.startsWith('#f') && !c.bgDeepest.startsWith('#e') && !c.bgDeepest.startsWith('#d');

  return [
    EditorView.theme(
      {
        '&': {
          backgroundColor: c.bgDeepest,
          color: c.textPrimary,
          fontSize: '13px',
          fontFamily: '"JetBrains Mono", "Cascadia Code", "Fira Code", "Consolas", monospace',
          height: '100%',
        },
        '.cm-content': {
          caretColor: c.accent,
          padding: '4px 0',
        },
        '.cm-scroller': {
          fontFamily: '"JetBrains Mono", "Cascadia Code", "Fira Code", "Consolas", monospace',
          overflow: 'auto',
        },
        '.cm-gutters': {
          backgroundColor: c.bgDeep,
          color: c.textTertiary,
          borderRight: `1px solid ${c.borderSubtle}`,
        },
        '.cm-activeLineGutter': {
          backgroundColor: c.bgHover,
          color: c.textSecondary,
        },
        '.cm-activeLine': {
          backgroundColor: c.bgHover,
        },
        '.cm-cursor': {
          borderLeftColor: c.accent,
          borderLeftWidth: '2px',
        },
        '.cm-selectionBackground': {
          backgroundColor: c.accent + '40 !important',
        },
        '&.cm-focused .cm-selectionBackground': {
          backgroundColor: c.accent + '40 !important',
        },
        '.cm-selectionMatch': {
          backgroundColor: c.accent + '1a !important',
        },
        '.cm-matchingBracket': {
          backgroundColor: c.accent + '26',
          outline: `1px solid ${c.accent}4d`,
        },
        '.cm-searchMatch': {
          backgroundColor: c.accent + '40',
          outline: `1px solid ${c.accent}66`,
        },
        '.cm-searchMatch.selected': {
          backgroundColor: c.accent + '59',
        },
        '.cm-tooltip': {
          backgroundColor: c.bgRaised + ' !important',
          border: `1px solid ${c.borderSubtle} !important`,
          color: c.textPrimary + ' !important',
        },
        '.cm-tooltip-autocomplete': {
          '& > ul > li[aria-selected]': {
            backgroundColor: c.accent + '33 !important',
            color: c.textPrimary + ' !important',
          },
        },
        '.cm-foldGutter .cm-gutterElement': {
          color: c.textTertiary,
        },
        '.cm-panel': {
          backgroundColor: c.bgBase,
          border: `1px solid ${c.borderSubtle}`,
        },
        '.cm-panel input': {
          backgroundColor: c.bgRaised,
          color: c.textPrimary,
          border: `1px solid ${c.borderSubtle}`,
        },
        '.cm-panel input:focus': {
          borderColor: c.accent,
        },
        '.cm-panel label': {
          color: c.textSecondary,
        },
        '.cm-panel button': {
          backgroundColor: c.bgHover,
          color: c.textPrimary,
          border: `1px solid ${c.borderSubtle}`,
        },
        '.cm-separator': {
          color: c.borderSubtle,
        },
        '& ::-webkit-scrollbar': { width: '6px', height: '6px' },
        '& ::-webkit-scrollbar-track': { background: 'transparent' },
        '& ::-webkit-scrollbar-thumb': {
          background: c.scrollbarThumb,
          borderRadius: '3px',
        },
        '& ::-webkit-scrollbar-thumb:hover': {
          background: c.scrollbarThumbHover,
        },
      },
      { dark: isDark }
    ),
    syntaxHighlighting(
      HighlightStyle.define([
        { tag: tags.keyword, color: '#bb9af7' },
        { tag: tags.operator, color: c.textSecondary },
        { tag: tags.punctuation, color: c.textSecondary },
        { tag: tags.brace, color: c.textSecondary },
        { tag: tags.separator, color: c.textSecondary },
        { tag: tags.comment, color: c.textTertiary, fontStyle: 'italic' },
        { tag: tags.string, color: isDark ? '#9ece6a' : '#1a7f37' },
        { tag: tags.regexp, color: isDark ? '#9ece6a' : '#1a7f37' },
        { tag: tags.literal, color: isDark ? '#e0af68' : '#9a6700' },
        { tag: tags.number, color: isDark ? '#e0af68' : '#9a6700' },
        { tag: tags.bool, color: isDark ? '#e0af68' : '#9a6700' },
        { tag: tags.typeName, color: isDark ? '#7dcfff' : '#1b7c83' },
        { tag: tags.className, color: isDark ? '#7dcfff' : '#1b7c83' },
        { tag: tags.function(tags.variableName), color: c.accent },
        { tag: tags.tagName, color: '#bb9af7' },
        { tag: tags.attributeName, color: c.textPrimary },
        { tag: tags.attributeValue, color: isDark ? '#9ece6a' : '#1a7f37' },
        { tag: tags.variableName, color: c.textPrimary },
        { tag: tags.propertyName, color: c.textPrimary },
        { tag: tags.labelName, color: c.accent },
        { tag: tags.inserted, color: isDark ? '#9ece6a' : '#1a7f37' },
        { tag: tags.deleted, color: '#f7768e' },
        { tag: tags.changed, color: isDark ? '#e0af68' : '#9a6700' },
        { tag: tags.link, color: c.accent, textDecoration: 'underline' },
        { tag: tags.heading, color: '#bb9af7', fontWeight: 'bold' },
        { tag: tags.emphasis, fontStyle: 'italic' },
        { tag: tags.strong, fontWeight: 'bold' },
      ])
    ),
  ];
}
