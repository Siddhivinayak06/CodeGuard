import { useState, useRef, useEffect } from "react";
import { useTheme } from "next-themes";
import Editor, { loader } from "@monaco-editor/react";

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
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [showContextMenu, setShowContextMenu] = useState(false);
  const { theme } = useTheme();

  const lockedRef = useRef(locked);
  const editorRef = useRef(null);
  // ✅ Keep a ref in sync with language state
  const langRef = useRef(lang);
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);
  const showToast = (message) => {
    setShowWarning(message);
    setTimeout(() => setShowWarning(false), 2000);
  };
  useEffect(() => {
    if (!window.monacoProvidersRegistered) {
      window.monacoProvidersRegistered = true;

      // ✅ Simplified IntelliSense for Python + C
      loader.init().then((monaco) => {
        monaco.languages.registerCompletionItemProvider("python", {
          triggerCharacters: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
provideCompletionItems: (model, position) => {
  return {
    suggestions: [
      { label: "def", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "def", documentation: "Define a function" },
      { label: "int", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "int", documentation: "Integer data type" },
      { label: "class", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "class", documentation: "Define a class" },
      { label: "if", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "if", documentation: "If statement" },
      { label: "elif", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "elif", documentation: "Else if statement" },
      { label: "else", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "else", documentation: "Else statement" },
      { label: "for", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "for", documentation: "For loop" },
      { label: "while", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "while", documentation: "While loop" },
      { label: "break", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "break", documentation: "Exit the nearest loop" },
      { label: "continue", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "continue", documentation: "Skip to next loop iteration" },
      { label: "lambda", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "lambda", documentation: "Anonymous function" },
      { label: "pass", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "pass", documentation: "Do nothing (placeholder)" },
      { label: "True", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "True", documentation: "Boolean true value" },
      { label: "False", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "False", documentation: "Boolean false value" },
      { label: "None", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "None", documentation: "Null value in Python" },
      { label: "print", kind: monaco.languages.CompletionItemKind.Function, insertText: "print", documentation: "Print output" },
      { label: "len", kind: monaco.languages.CompletionItemKind.Function, insertText: "len", documentation: "Length of iterable" },
      { label: "range", kind: monaco.languages.CompletionItemKind.Function, insertText: "range", documentation: "Generate range" },
      { label: "input", kind: monaco.languages.CompletionItemKind.Function, insertText: "input", documentation: "Get user input" },
      { label: "import math", kind: monaco.languages.CompletionItemKind.Module, insertText: "import math", documentation: "Math module" },
      { label: "import os", kind: monaco.languages.CompletionItemKind.Module, insertText: "import os", documentation: "OS module" }
    ]
  };
}

        });

        monaco.languages.registerCompletionItemProvider("c", {
          triggerCharacters: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ#".split(""),
          provideCompletionItems: (model, position) => {
            return {
              suggestions: [
                { label: "#include <stdio.h>", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "#include <stdio.h>", documentation: "Standard I/O library",filterText: "#" },
                { label: "#include <stdlib.h>", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "#include <stdlib.h>", documentation: "Standard library" ,filterText: "#"},
                { label: "#include <string.h>", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "#include <string.h>", documentation: "String manipulation library" ,filterText: "#"},
                { label: "#include <math.h>", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "#include <math.h>", documentation: "Math library" ,filterText: "#"},
                { label: "int", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "int", documentation: "Integer data type" },
                { label: "char", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "char", documentation: "Character data type" },
                { label: "float", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "float", documentation: "Floating-point data type" },
                { label: "main", kind: monaco.languages.CompletionItemKind.Function, insertText: "main", documentation: "Main function" },
                { label: "for", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "for", documentation: "For loop" },
                { label: "while", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "while", documentation: "While loop" },
                { label: "do", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "do", documentation: "Do-while loop" },
                { label: "if", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "if", documentation: "If statement" },
                { label: "else", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "else", documentation: "Else statement" },
                { label: "switch", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "switch", documentation: "Switch statement" },
                { label: "printf", kind: monaco.languages.CompletionItemKind.Function, insertText: "printf", documentation: "Print output" },
                { label: "scanf", kind: monaco.languages.CompletionItemKind.Function, insertText: "scanf", documentation: "Read input" },
                { label: "malloc", kind: monaco.languages.CompletionItemKind.Function, insertText: "malloc", documentation: "Allocate memory" },
                { label: "free", kind: monaco.languages.CompletionItemKind.Function, insertText: "free", documentation: "Free memory" },
                { label: "strlen", kind: monaco.languages.CompletionItemKind.Function, insertText: "strlen", documentation: "Get string length" },
                { label: "strcpy", kind: monaco.languages.CompletionItemKind.Function, insertText: "strcpy", documentation: "Copy string" },
                { label: "strcat", kind: monaco.languages.CompletionItemKind.Function, insertText: "strcat", documentation: "Concatenate strings" },
                { label: "pow", kind: monaco.languages.CompletionItemKind.Function, insertText: "pow", documentation: "Raise base to exponent" },
                { label: "sqrt", kind: monaco.languages.CompletionItemKind.Function, insertText: "sqrt", documentation: "Square root" }
              ]
            };
          }
        });
      });
    }
  }, []);

  const handleEditorMount = (editor) => {
    editorRef.current = editor;

    // Disable default context menu
    editor.updateOptions({ contextmenu: false });

    // Right-click custom context menu
    const domNode = editor.getDomNode();
    if (domNode) {
      domNode.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!lockedRef.current) {
          const rect = domNode.getBoundingClientRect();
          setContextMenuPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
          setShowContextMenu(true);
        } else {
          showToast("Right-click is disabled!");
        }
      });
    }
    editor.onDidPaste(() => {
      showToast("Pasting is not allowed!");
       editor.trigger("keyboard", "undo");
    });
  editor.onKeyDown((e) => {
    if ((e.ctrlKey || e.metaKey) && ["KeyV", "KeyC", "KeyX"].includes(e.code)) {
        e.preventDefault();
        showToast("Clipboard actions are disabled!");
      }
});

editor.addAction({
  id: "editor.action.clipboardCopyWithSyntaxHighlightingAction",
  label: "Copy with Syntax Highlighting",
  keybindings: [], // remove any keyboard triggers
  precondition: null,
  run: function (ed) {
    showToast("This command is disabled!");
    return null; // prevents actual copy
  },
});
editor.addAction({
  id: "editor.action.pasteAsText",
  label: "Paste as Text",
  keybindings: [],
  precondition: null,
  run: function (ed) {
    showToast("This command is disabled!");
    return null;
  },
});

editor.addAction({
  id: "editor.action.pasteAs",
  label: "Paste As…",
  keybindings: [],
  precondition: null,
  run: function (ed) {
    showToast("This command is disabled!");
    return null;
  },
});



    editor.onDidType((text) => {
      // ✅ Works only if language is C
      if (langRef.current === "c" && text === "#") {
        editor.trigger("keyboard", "editor.action.triggerSuggest");
      }
    });


  }

  // Starter templates
  const templates = {
    python: "# Welcome to Python Code Editor\n# Write your Python code here\n\nprint('Hello, World!')\n",
    c: "/* C Hello World */\n#include <stdio.h>\n\nint main() {\n    printf(\"Hello, World!\\n\");\n    return 0;\n}\n",
  };

  const switchLanguage = (newLang) => {
    setLang(newLang);
    if (!code.trim()) setCode(templates[newLang]);
  };

  // Handle custom context menu option clicks
  const handleMenuClick = (action) => {
    if (!editorRef.current) return;

    editorRef.current.focus(); // make sure editor has focus

    if (action === "commandPalette") {
      editorRef.current.trigger("keyboard", "editor.action.quickCommand", null);
    }
    if (action === "changeAll") {
      editorRef.current.trigger("keyboard", "editor.action.selectHighlights", null);
    }

    setShowContextMenu(false);
  };

  return (
    <div
      className="h-full flex flex-col bg-white dark:bg-gray-900"
      onClick={() => setShowContextMenu(false)}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2 text-sm">
                {lang === "python" ? "Python" : "C"}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Select Language</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => switchLanguage("python")}>Python</DropdownMenuItem>
              <DropdownMenuItem onClick={() => switchLanguage("c")}>C</DropdownMenuItem>
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
          <button
            onClick={onRun}
            disabled={locked || loading || !isFullscreen}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${locked || loading || !isFullscreen
              ? "text-gray-400 dark:text-gray-500 cursor-not-allowed"
              : "text-white bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
              }`}
          >
            Run Code
          </button>

          <button
            onClick={onDownload}
            disabled={locked || loading || !isFullscreen}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${locked || loading || !isFullscreen
              ? "text-gray-400 dark:text-gray-500 cursor-not-allowed"
              : "text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-600"
              }`}
          >
            Export PDF
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 relative">
        <Editor
          height="100%"
          language={lang}
          theme={theme === "dark" ? "vs-dark" : "light"}
          value={code}
          onChange={(value) => setCode(value)}
          onMount={handleEditorMount}
          options={{
            readOnly: disabled || locked || !isFullscreen,
            contextmenu: false, // custom menu
            minimap: { enabled: false },
            fontSize: 14,
            fontFamily: "'Cascadia Code', 'Fira Code', 'Courier New', monospace",
            wordWrap: "on",
            lineNumbers: "on",
            autoClosingBrackets: "always",
            autoClosingQuotes: "always",
            quickSuggestions: { other: true, comments: false, strings: false },

            wordBasedSuggestions: false,
            suggestOnTriggerCharacters: true,
            parameterHints: { enabled: true },
            tabSize: 4,
            folding: true,
          }}
        />

        {/* Custom Context Menu */}
        {showContextMenu && (
          <div
            className="absolute bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg z-50 w-56"
            style={{ top: contextMenuPos.y, left: contextMenuPos.x }}
          >
            <button
              className="block px-4 py-2 w-full text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none text-sm font-sans"
              onClick={() => handleMenuClick("changeAll")}
            >
              Change All Occurrences
            </button>
            <button
              className="block px-4 py-2 w-full text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none text-sm font-sans"
              onClick={() => handleMenuClick("commandPalette")}
            >
              Command Palette
            </button>
          </div>
        )}


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
