// CodeEditor.js
import { useState } from "react";
import { useTheme } from "next-themes";
import Editor from "@monaco-editor/react";

export default function CodeEditor({ code, setCode, disabled, onRun, onDownload, loading, locked }) {
  const [showWarning, setShowWarning] = useState(false);
  const { theme } = useTheme();

  const showToast = (message) => {
    setShowWarning(message);
    setTimeout(() => setShowWarning(false), 2000);
  }; 

  const handleEditorMount = (editor) => {
    editor.onKeyDown((e) => {
      const key = e.code || e.keyCode;
      if (e.ctrlKey || e.metaKey) {
        if (["KeyV", "KeyC", "KeyX"].includes(key)) {
          e.preventDefault();
          showToast("Clipboard actions are disabled!");
        }
      }
    });

    editor.onContextMenu((e) => {
      e.preventDefault();
      showToast("Right-click is disabled!");
    });
  };

  return (
    <div className="relative rounded-xl overflow-hidden backdrop-blur-sm bg-white/40 dark:bg-white/10 border border-gray-200/40 dark:border-white/20 shadow-xl">
      {/* Header with integrated toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-gray-100/40 to-gray-50/40 dark:from-gray-900/20 dark:to-gray-800/20 backdrop-blur-md border-b border-gray-200/20 dark:border-white/10">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 ml-2">Python Editor</span>
        </div>
        
        {/* Integrated Toolbar */}
        <div className="flex items-center gap-2">
          {loading && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/20 backdrop-blur-sm border border-blue-300/30">
              <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
              <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">Running...</span>
            </div>
          )}
          
          <button
            onClick={onRun}
            disabled={locked || loading}
            className={`group relative px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              locked || loading
                ? "bg-gray-500/20 text-gray-500 cursor-not-allowed"
                : "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-700 dark:text-emerald-300 hover:text-emerald-800 dark:hover:text-emerald-200 backdrop-blur-sm border border-emerald-300/30 hover:border-emerald-400/50 hover:shadow-lg hover:shadow-emerald-500/20"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
              </svg>
              Run
            </div>
          </button>
          
          <button
            onClick={onDownload}
            disabled={locked || loading}
            className={`group relative px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              locked || loading
                ? "bg-gray-500/20 text-gray-500 cursor-not-allowed"
                : "bg-blue-500/20 hover:bg-blue-500/30 text-blue-700 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-200 backdrop-blur-sm border border-blue-300/30 hover:border-blue-400/50 hover:shadow-lg hover:shadow-blue-500/20"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              PDF
            </div>
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="relative">
        <Editor
          height="400px"
          language="python"
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          value={code}
          onChange={(value) => setCode(value)}
          options={{
            readOnly: disabled,
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
            lineHeight: 1.6,
            padding: { top: 16, bottom: 16 },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorSmoothCaretAnimation: true,
            renderLineHighlight: "gutter",
            bracketPairColorization: { enabled: true },
          }}
          onMount={handleEditorMount}
        />
      </div>

      {/* Warning Toast */}
      {showWarning && (
        <div className="absolute top-20 right-4 bg-amber-500/90 backdrop-blur-md text-amber-100 px-4 py-2 rounded-lg shadow-xl border border-amber-400/30 text-sm font-medium animate-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {showWarning}
          </div>
        </div>
      )}
    </div>
  );
}