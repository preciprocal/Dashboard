"use client";
// components/interview/CodeEditor.tsx
// CodeMirror 6, themed to the app. Only ever imported through next/dynamic
// (see CodePanel and CodeReviewSection), so the editor and its language
// grammars load on the interview screen and results page when code is
// actually involved, and nowhere else.

import { useMemo } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { java } from "@codemirror/lang-java";
import { cpp } from "@codemirror/lang-cpp";
import { go } from "@codemirror/lang-go";
import { sql } from "@codemirror/lang-sql";
import type { CodeLanguage } from "@/lib/interview/code-submission";

function languageExtension(lang: CodeLanguage): Extension {
  switch (lang) {
    case "javascript": return javascript();
    case "typescript": return javascript({ typescript: true });
    case "python":     return python();
    case "java":       return java();
    case "cpp":        return cpp();
    case "go":         return go();
    case "sql":        return sql();
  }
}

// Colours chosen to sit on --bg-subtle with the indigo accent, and to stay
// readable (contrast over 4.5:1) rather than to look like any particular IDE.
const editorTheme = EditorView.theme(
  {
    "&": {
      backgroundColor: "var(--bg-subtle)",
      color: "var(--text-2)",
      fontSize: "13px",
      height: "100%",
    },
    ".cm-scroller": {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace",
      lineHeight: "1.6",
    },
    ".cm-content": { caretColor: "#c3c9ff", padding: "10px 0" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "#c3c9ff" },
    "&.cm-focused": { outline: "none" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": {
      backgroundColor: "rgba(91, 108, 255, 0.28) !important",
    },
    ".cm-gutters": {
      backgroundColor: "var(--bg-subtle)",
      color: "var(--text-4)",
      border: "none",
      borderRight: "1px solid var(--border)",
    },
    ".cm-activeLine": { backgroundColor: "rgba(255, 255, 255, 0.03)" },
    ".cm-activeLineGutter": { backgroundColor: "rgba(255, 255, 255, 0.04)", color: "var(--text-3)" },
    ".cm-matchingBracket": { backgroundColor: "rgba(91, 108, 255, 0.22)", outline: "none" },
    ".cm-tooltip": { backgroundColor: "var(--bg-raised)", border: "1px solid var(--border)", color: "var(--text-2)" },
    ".cm-tooltip-autocomplete > ul > li[aria-selected]": { backgroundColor: "var(--accent-subtle)", color: "var(--text-1)" },
  },
  { dark: true },
);

const highlight = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.operatorKeyword], color: "#a5b4fc" },
  { tag: [t.string, t.special(t.string), t.regexp], color: "#86efac" },
  { tag: [t.number, t.bool, t.null, t.atom], color: "#fcd34d" },
  { tag: [t.comment, t.lineComment, t.blockComment], color: "#7c8598", fontStyle: "italic" },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: "#7dd3fc" },
  { tag: [t.typeName, t.className, t.namespace], color: "#f9a8d4" },
  { tag: [t.propertyName, t.attributeName], color: "#bfdbfe" },
  { tag: [t.definition(t.variableName)], color: "#e2e8f0" },
  { tag: [t.operator, t.punctuation], color: "#cbd5e1" },
]);

export default function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  minHeight = "240px",
  maxHeight,
  ariaLabel = "Code editor",
}: {
  value: string;
  onChange?: (value: string) => void;
  language: CodeLanguage;
  readOnly?: boolean;
  minHeight?: string;
  maxHeight?: string;
  ariaLabel?: string;
}) {
  const extensions = useMemo(
    () => [
      languageExtension(language),
      syntaxHighlighting(highlight),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ "aria-label": ariaLabel }),
    ],
    [language, ariaLabel],
  );

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={extensions}
      theme={editorTheme}
      readOnly={readOnly}
      editable={!readOnly}
      // Tab indents instead of moving focus, which is what a candidate
      // expects in an editor. Escape then Tab still leaves the editor, so
      // keyboard users are not trapped.
      indentWithTab={!readOnly}
      minHeight={minHeight}
      maxHeight={maxHeight}
      height="100%"
      basicSetup={{
        lineNumbers: true,
        foldGutter: false,
        highlightActiveLine: !readOnly,
        highlightActiveLineGutter: !readOnly,
        autocompletion: !readOnly,
        tabSize: 4,
        searchKeymap: false,
      }}
    />
  );
}
