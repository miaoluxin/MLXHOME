/**
 * NddWhitespaceDisplay.ts
 *
 * 自定义 CodeMirror 6 扩展，显示所有空白字符和换行符：
 * - 空格 → · (middle dot)
 * - 制表符 → → (arrow)
 * - 换行符 (LF/CRLF) → ¶ (pilcrow)
 *
 * 与 highlightSpecialChars() 互补使用（后者处理非标准 Unicode 特殊字符）。
 */

import { StateField, Range, Text } from '@codemirror/state';
import { Decoration, DecorationSet, WidgetType, EditorView } from '@codemirror/view';

// ── Widget class ──

class SpaceWidget extends WidgetType {
  override toDOM() {
    const span = document.createElement('span');
    span.className = 'cm-ws-space';
    span.textContent = '·'; // middle dot ·
    return span;
  }
  override eq(other: SpaceWidget) { return other instanceof SpaceWidget; }
  override ignoreEvent() { return true; }
}

class TabWidget extends WidgetType {
  override toDOM() {
    const span = document.createElement('span');
    span.className = 'cm-ws-tab';
    span.textContent = '→'; // rightwards arrow →
    return span;
  }
  override eq(other: TabWidget) { return other instanceof TabWidget; }
  override ignoreEvent() { return true; }
}

class NewlineWidget extends WidgetType {
  override toDOM() {
    const span = document.createElement('span');
    span.className = 'cm-ws-newline';
    span.textContent = '¶'; // pilcrow ¶
    return span;
  }
  override eq(other: NewlineWidget) { return other instanceof NewlineWidget; }
  override ignoreEvent() { return true; }
}

// ── 构造 decoration set ──

function buildWhitespaceDecorations(doc: Text): DecorationSet {
  const decorations: Range<Decoration>[] = [];
  const text = doc.toString();
  const len = text.length;

  // 1. 空格 · — 使用 Decoration.replace 替换为 widget（不影响光标）
  // 2. 制表符 → — 同样使用 Decoration.replace
  for (let i = 0; i < len; i++) {
    const code = text.charCodeAt(i);
    if (code === 0x20) {
      // 普通空格
      decorations.push(
        Decoration.replace({ widget: new SpaceWidget(), inclusive: false }).range(i, i + 1),
      );
    } else if (code === 0x09) {
      // 制表符
      decorations.push(
        Decoration.replace({ widget: new TabWidget(), inclusive: false }).range(i, i + 1),
      );
    }
  }

  // 3. 换行符 ¶
  //    CRLF 时替换 \r 字符（\n 仍负责换行）
  //    LF 时在 \n 位置插入 widget（side: -1 使其显示在换行前）
  for (let i = 0; i < len; i++) {
    if (text[i] === '\n') {
      const isCRLF = i > 0 && text[i - 1] === '\r';
      if (isCRLF) {
        // 替换 \r (i-1 → i)，\n 仍负责产生换行
        decorations.push(
          Decoration.replace({ widget: new NewlineWidget(), inclusive: false })
            .range(i - 1, i),
        );
      } else {
        // 在 \n 位置插入 pilcrow，side: -1 使其显示在换行之前
        decorations.push(
          Decoration.widget({ widget: new NewlineWidget(), side: -1 }).range(i),
        );
      }
    }
  }

  return Decoration.set(decorations, true);
}

// ── StateField：只在文档变化时重建 decorations ──

const whitespaceDecoField = StateField.define<DecorationSet>({
  create(state) {
    return buildWhitespaceDecorations(state.doc);
  },
  update(decoSet, tr) {
    if (!tr.docChanged) return decoSet.map(tr.changes);
    // 文档变化时完全重建
    return buildWhitespaceDecorations(tr.state.doc);
  },
  provide: (f) => EditorView.decorations.from(f),
});

/**
 * 创建显示空白字符的 CM6 扩展套餐：
 * - 空格 ·  制表符 →  换行符 ¶
 *
 * 使用示例：
 * ```ts
 * import { showWhitespaceDisplay } from './NddWhitespaceDisplay';
 * // 在扩展列表中按需使用：
 * showWhitespace ? [showWhitespaceDisplay()] : []
 * ```
 */
export function showWhitespaceDisplay() {
  return [whitespaceDecoField];
}
