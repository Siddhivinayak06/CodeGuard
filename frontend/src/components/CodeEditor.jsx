import { useState } from "react";
import { useTheme } from "next-themes";
import Editor from "@monaco-editor/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-react";

export default function CodeEditor({
  code,
  setCode,
  disabled,
  onRun,
  onDownload,
  loading,
  locked,
  lang,
  setLang,
  isFullscreen = true,
}) {
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

  // ✅ Starter templates
  const templates = {
    python: "# Python Hello World\nprint('Hello, World!')\n",
    c: "/* C Hello World */\n#include <stdio.h>\n\nint main() {\n    printf(\"Hello, World!\\n\");\n    return 0;\n}\n",
  };

  const switchLanguage = (newLang) => {
    setLang(newLang);
    // ✅ Insert starter template only if editor is empty
    if (!code.trim()) {
      setCode(templates[newLang]);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
        <div className="flex items-center gap-3">
          {/* ✅ Language Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2 text-sm"
              >
                {lang === "python" ? "Python" : "C"}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Select Language</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => switchLanguage("python")}>
                Python
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => switchLanguage("c")}>
                C
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="text-gray-700 dark:text-gray-300 text-sm font-medium">
            {lang === "python" ? "Python Editor" : "C Editor"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {loading && (
            <div className="flex items-center gap-2 px-3 py-1 text-xs text-blue-600 dark:text-blue-400">
              <div className="w-3 h-3 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              <span>Running...</span>
            </div>
          )}

          {/* Run Button */}
          <button
            onClick={onRun}
            disabled={locked || loading || !isFullscreen}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              locked || loading || !isFullscreen
                ? "text-gray-400 dark:text-gray-500 cursor-not-allowed"
                : "text-white bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
            }`}
          >
            Run Code
          </button>

          {/* Export PDF Button */}
          <button
            onClick={onDownload}
            disabled={locked || loading || !isFullscreen}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              locked || loading || !isFullscreen
                ? "text-gray-400 dark:text-gray-500 cursor-not-allowed"
                : "text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
            }`}
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1">
        <Editor
          height="100%"
          language={lang}
          theme={theme === "dark" ? "vs-dark" : "light"}
          value={code}
          onChange={(value) => setCode(value)}
          options={{
            readOnly: disabled || locked || !isFullscreen,
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily:
              "'Cascadia Code', 'Fira Code', 'Courier New', monospace",
            lineHeight: 1.5,
            padding: { top: 20, bottom: 20 },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            cursorSmoothCaretAnimation: "on",
            renderLineHighlight: "gutter",
            bracketPairColorization: { enabled: true },
            guides: { indentation: true, bracketPairs: true },
            renderWhitespace: "selection",
            wordWrap: "on",
            lineNumbers: "on",
            folding: true,
            foldingStrategy: "indentation",
            showFoldingControls: "always",
          }}
          onMount={handleEditorMount}
        />
      </div>

      {/* Warning Toast */}
      {showWarning && (
        <div className="absolute top-16 right-4 bg-orange-500 text-white px-4 py-2 rounded shadow-lg text-sm font-medium z-50">
          ⚠ {showWarning}
        </div>
      )}
    </div>
  );
}
