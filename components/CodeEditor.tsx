"use client";

import { useEffect, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";

type MonacoEditor = Parameters<OnMount>[0];
type Monaco = Parameters<OnMount>[1];

interface Props {
  value: string;
  onChange: (value: string) => void;
  errorLine?: number;
  errorMessage?: string;
}

// Loaded with next/dynamic and ssr:false from ProblemRoom.
export default function CodeEditor({ value, onChange, errorLine, errorMessage }: Props) {
  const editorRef = useRef<MonacoEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    syncMarkers();
  };

  function syncMarkers() {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    const model = editor?.getModel();
    if (!editor || !monaco || !model) return;
    const markers =
      errorLine && errorLine <= model.getLineCount()
        ? [
            {
              severity: monaco.MarkerSeverity.Error,
              message: errorMessage ?? "Error",
              startLineNumber: errorLine,
              endLineNumber: errorLine,
              startColumn: 1,
              endColumn: model.getLineMaxColumn(errorLine),
            },
          ]
        : [];
    monaco.editor.setModelMarkers(model, "run", markers);
  }

  useEffect(syncMarkers, [errorLine, errorMessage]);

  return (
    <Editor
      height="100%"
      language="python"
      theme="vs"
      value={value}
      onChange={(v) => onChange(v ?? "")}
      onMount={handleMount}
      options={{
        ariaLabel: "Python editor. To leave, press Control+M (Mac: Control+Shift+M), then Shift+Tab.",
        fontSize: 14,
        lineHeight: 22,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        tabSize: 4,
        automaticLayout: true,
        padding: { top: 12 },
      }}
    />
  );
}
