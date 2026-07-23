import { useRef, useEffect } from 'react';
import { EditorView, keymap, rectangularSelection, drawSelection, highlightSpecialChars } from '@codemirror/view';
import { EditorState, Compartment } from '@codemirror/state';
import { showWhitespaceDisplay } from './NddWhitespaceDisplay';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { bracketMatching } from '@codemirror/language';
import { closeBrackets } from '@codemirror/autocomplete';
import { foldGutter, indentOnInput } from '@codemirror/language';
import { search, highlightSelectionMatches } from '@codemirror/search';
import { createEditorTheme } from './CodeMirrorTheme';
import { getLanguageExtension } from './CodeMirrorLanguageSupport';
import { useThemeStore } from '../../stores/useThemeStore';

interface NddEditorProps {
  fileId: string;
  language: string;
  content: string;
  readOnly?: boolean;
  wordWrap?: boolean;
  showWhitespace?: boolean;
  columnMode?: boolean;
  zoomLevel?: number; // 缩放百分比 100 = 默认
  onChange?: (content: string) => void;
  onCursorChange?: (line: number, col: number) => void;
  onFindToggle?: () => void;
  /** 暴露 EditorView 引用给父组件，用于查找替换操作 */
  onEditorViewReady?: (view: EditorView) => void;
}

export function NddEditor({
  fileId,
  language,
  content,
  readOnly = false,
  wordWrap = false,
  showWhitespace = false,
  columnMode = false,
  zoomLevel = 100,
  onChange,
  onCursorChange,
  onFindToggle,
  onEditorViewReady,
}: NddEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onCursorChangeRef = useRef(onCursorChange);
  const onFindToggleRef = useRef(onFindToggle);
  const onEditorViewReadyRef = useRef(onEditorViewReady);

  // CodeMirror Compartments — 用于动态切换扩展而不重建 view
  const wordWrapComp = useRef(new Compartment());
  const whitespaceComp = useRef(new Compartment());
  const columnModeComp = useRef(new Compartment());
  const readOnlyComp = useRef(new Compartment());
  const zoomComp = useRef(new Compartment());
  const langComp = useRef(new Compartment());
  const themeComp = useRef(new Compartment());

  // 保持回调引用最新，不触发 view 重建
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onCursorChangeRef.current = onCursorChange; }, [onCursorChange]);
  useEffect(() => { onFindToggleRef.current = onFindToggle; }, [onFindToggle]);
  useEffect(() => { onEditorViewReadyRef.current = onEditorViewReady; }, [onEditorViewReady]);

  // ── 初始化 CodeMirror ──
  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;

    getLanguageExtension(language).then((langExt) => {
      if (disposed || !containerRef.current) return;

    const extensions: any[] = [
      // 核心
      keymap.of([...defaultKeymap, ...historyKeymap]),
      history(),
      bracketMatching(),
      closeBrackets(),
      indentOnInput(),
      foldGutter(),

      // 主题（动态，根据应用主题配色）
      themeComp.current.of(createEditorTheme(useThemeStore.getState().getCurrentColors())),

      // 搜索状态（为 findNext/findPrevious 提供状态支持）
      search(),

      // 搜索高亮
      highlightSelectionMatches(),

      // 允许多重选择（Alt+拖拽矩形选择需要此配置，始终开启，类似 VS Code）
      EditorState.allowMultipleSelections.of(true),
      drawSelection(),

      // 可动态切换的扩展（用 Compartment 包裹）
      wordWrapComp.current.of(wordWrap ? EditorView.lineWrapping : []),
      whitespaceComp.current.of(showWhitespace
        ? [highlightSpecialChars(), ...showWhitespaceDisplay()]
        : []),
      columnModeComp.current.of(columnMode
        ? [
            EditorView.contentAttributes.of({ class: 'cm-column-mode' }),
            rectangularSelection(),
          ]
        : []),
      readOnlyComp.current.of(EditorView.editable.of(!readOnly)),
      zoomComp.current.of(EditorView.theme({
        '&': { fontSize: `${Math.round(13 * (zoomLevel / 100))}px` },
      })),
      langComp.current.of(langExt),

      // 快捷键 Ctrl+F / Cmd+F
      keymap.of([
        {
          key: 'Ctrl-f',
          run: () => {
            onFindToggleRef.current?.();
            return true;
          },
        },
        {
          key: 'Ctrl-F',
          run: () => {
            onFindToggleRef.current?.();
            return true;
          },
        },
      ]),

      // 内容变更监听
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          onChangeRef.current?.(update.state.doc.toString());
        }
        if (update.selectionSet || update.docChanged) {
          const pos = update.state.selection.main.head;
          const line = update.state.doc.lineAt(pos);
          onCursorChangeRef.current?.(line.number, pos - line.from);
        }
      }),
    ];

    const state = EditorState.create({
      doc: content,
      extensions,
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;
    onEditorViewReadyRef.current?.(view);

    // 自动聚焦编辑器，确保打开文件后立即可编辑
    view.focus();
    }).catch(() => {});

    return () => {
      disposed = true;
      if (viewRef.current) viewRef.current.destroy();
      viewRef.current = null;
    };
    // fileId 变化时重建（文件切换）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);

  // ── 主题变化时动态更新编辑器配色 ──
  useEffect(() => {
    const view = viewRef.current;
    if (!view || !themeComp.current) return;
    const unsub = useThemeStore.subscribe((state) => {
      if (viewRef.current && themeComp.current) {
        viewRef.current.dispatch({
          effects: themeComp.current.reconfigure(createEditorTheme(state.getCurrentColors())),
        });
      }
    });
    return unsub;
  }, [fileId]);

  // ── 外部 content 变化时同步（如撤销/重做后保存） ──
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== content) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentDoc.length,
          insert: content,
        },
      });
    }
  }, [content]);

  // ── 只读状态变化 ──
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: readOnlyComp.current.reconfigure(EditorView.editable.of(!readOnly)),
    });
    view.dom.contentEditable = readOnly ? 'false' : 'true';
  }, [readOnly]);

  // ── 缩放变化 ──
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const fontSize = Math.round(13 * (zoomLevel / 100));
    view.dispatch({
      effects: zoomComp.current.reconfigure(EditorView.theme({
        '&': { fontSize: `${fontSize}px` },
      })),
    });
    const editorEl = view.dom;
    editorEl.style.fontSize = `${fontSize}px`;
  }, [zoomLevel]);

  // ── 自动换行动态切换 ──
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: wordWrapComp.current.reconfigure(wordWrap ? EditorView.lineWrapping : []),
    });
  }, [wordWrap]);

  // ── 空白符/特殊字符动态切换 ──
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: whitespaceComp.current.reconfigure(showWhitespace
        ? [highlightSpecialChars(), ...showWhitespaceDisplay()]
        : []),
    });
  }, [showWhitespace]);

  // ── 列编辑模式动态切换（包含矩形选择功能 + 视觉反馈） ──
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: columnModeComp.current.reconfigure(columnMode
        ? [
            EditorView.contentAttributes.of({ class: 'cm-column-mode' }),
            rectangularSelection(),
          ]
        : []),
    });
  }, [columnMode]);

  // ── 语言变化 ──
  useEffect(() => {
    let disposed = false;
    getLanguageExtension(language).then((newLang) => {
      if (disposed) return;
      const view = viewRef.current;
      if (!view) return;
      view.dispatch({
        effects: langComp.current.reconfigure(newLang),
      });
    });
    return () => { disposed = true; };
  }, [language]);

  return (
    <div
      ref={containerRef}
      className="cm-editor-wrapper"
      style={{
        height: '100%',
        overflow: 'hidden',
      }}
    />
  );
}
