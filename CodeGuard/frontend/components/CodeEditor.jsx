"use client";

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
  onSubmit, // ✅ Added submit prop
  loading,
  locked,
  lang,
  onLangChange,
  showInputToggle,
  showInput,
  setShowInput,
  isFullscreen = true,
  terminalRef,
}) {
  const { theme } = useTheme();
  const [showWarning, setShowWarning] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [showContextMenu, setShowContextMenu] = useState(false);
  const editorRef = useRef(null);
  const langRef = useRef(lang);
  const lockedRef = useRef(locked);

  // Keep latest lang in ref
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  // ⚙️ Toast for warnings
  const showToast = (message) => {
    setShowWarning(message);
    setTimeout(() => setShowWarning(false), 2000);
  };

  // ⚙️ Setup language completion (Python + C)
  useEffect(() => {
    if (window.monacoProvidersRegistered) return;
    window.monacoProvidersRegistered = true;

    loader.init().then((monaco) => {
  // 🐍 Python Snippets / IntelliSense
  monaco.languages.registerCompletionItemProvider("python", {
    triggerCharacters: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
    provideCompletionItems: () => ({
      suggestions: [
        {
          label: "def",
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: "def ${1:func_name}(${2:args}):\n    ${3:pass}",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Define a function",
        },
        {
          label: "class",
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: "class ${1:ClassName}(${2:object}):\n    ${3:pass}",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Define a class",
        },
        {
          label: "if",
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: "if ${1:condition}:\n    ${2:pass}",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "If statement",
        },
        {
          label: "elif",
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: "elif ${1:condition}:\n    ${2:pass}",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Else if statement",
        },
        {
          label: "else",
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: "else:\n    ${1:pass}",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Else statement",
        },
        {
          label: "for",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "for ${1:item} in ${2:iterable}:\n    ${3:pass}",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "For loop",
        },
        {
          label: "while",
          kind: monaco.languages.CompletionItemKind.Snippet,
          insertText: "while ${1:condition}:\n    ${2:pass}",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "While loop",
        },
        {
          label: "print",
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: "print(${1:msg})",
          insertTextRules:
            monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          documentation: "Print output",
        },
        {
          label: "len",
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: "len(${1:iterable})",
          documentation: "Length of iterable",
        },
        {
          label: "range",
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: "range(${1:stop})",
          documentation: "Generate range",
        },
        {
          label: "input",
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: "input(${1:prompt})",
          documentation: "Get user input",
        },
        {
          label: "import math",
          kind: monaco.languages.CompletionItemKind.Module,
          insertText: "import math",
          documentation: "Math module",
        },
        {
          label: "import os",
          kind: monaco.languages.CompletionItemKind.Module,
          insertText: "import os",
          documentation: "OS module",
        },
      ],
    }),
  });



      monaco.languages.registerCompletionItemProvider("c", {
  triggerCharacters: [
    "#",
    "a","b","c","d","e","f","g","h","i","j","k","l","m",
    "n","o","p","q","r","s","t","u","v","w","x","y","z",
    "A","B","C","D","E","F","G","H","I","J","K","L","M",
    "N","O","P","Q","R","S","T","U","V","W","X","Y","Z"
  ],
  provideCompletionItems: () => ({
    suggestions: [
      {
        label: "#include <stdio.h>",
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: "#include <stdio.h>\n",
        documentation: "Standard I/O library"
      },
      {
        label: "#include <stdlib.h>",
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: "#include <stdlib.h>\n",
        documentation: "Standard library"
      },
      {
        label: "#include <string.h>",
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: "#include <string.h>\n",
        documentation: "String manipulation library"
      },
      {
        label: "#include <math.h>",
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText: "#include <math.h>\n",
        documentation: "Math library"
      },
      {
        label: "main",
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText:
          "int main() {\n    ${1:/* code */}\n    return 0;\n}",
        insertTextRules:
          monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: "Main function"
      },
      {
        label: "for loop",
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText:
          "for(int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n    ${3:/* code */}\n}",
        insertTextRules:
          monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: "For loop"
      },
      {
        label: "while loop",
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText:
          "while(${1:condition}) {\n    ${2:/* code */}\n}",
        insertTextRules:
          monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: "While loop"
      },
      {
        label: "do-while loop",
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText:
          "do {\n    ${1:/* code */}\n} while(${2:condition});",
        insertTextRules:
          monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: "Do-while loop"
      },
      {
        label: "if statement",
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText:
          "if(${1:condition}) {\n    ${2:/* code */}\n}",
        insertTextRules:
          monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: "If statement"
      },
      {
        label: "else",
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText:
          "else {\n    ${1:/* code */}\n}",
        insertTextRules:
          monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: "Else statement"
      },
      {
        label: "switch",
        kind: monaco.languages.CompletionItemKind.Snippet,
        insertText:
          "switch(${1:variable}) {\n    case ${2:value}:\n        ${3:/* code */}\n        break;\n    default:\n        ${4:/* code */}\n}",
        insertTextRules:
          monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: "Switch statement"
      },
      {
        label: "printf",
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: "printf(\"${1:text}\\n\");",
        documentation: "Print output"
      },
      {
        label: "scanf",
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: "scanf(\"${1:format}\", &${2:var});",
        documentation: "Read input"
      },
      {
        label: "malloc",
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: "malloc(sizeof(${1:type}) * ${2:size})",
        documentation: "Allocate memory"
      },
      {
        label: "free",
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: "free(${1:pointer});",
        documentation: "Free allocated memory"
      },
      {
        label: "strlen",
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: "strlen(${1:str})",
        documentation: "Get string length"
      },
      {
        label: "strcpy",
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: "strcpy(${1:dest}, ${2:src});",
        documentation: "Copy string"
      },
      {
        label: "strcat",
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: "strcat(${1:dest}, ${2:src});",
        documentation: "Concatenate strings"
      },
      {
        label: "pow",
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: "pow(${1:base}, ${2:exp})",
        documentation: "Raise base to exponent"
      },
      {
        label: "sqrt",
        kind: monaco.languages.CompletionItemKind.Function,
        insertText: "sqrt(${1:number})",
        documentation: "Square root"
      }
    ]
  })
});

    });
  }, []);

  // ⚙️ Handle Editor Mount
  const handleEditorMount = (editor) => {
    editorRef.current = editor;
    editor.updateOptions({ contextmenu: false });

    const domNode = editor.getDomNode();
    if (!domNode) return;

    domNode.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (!lockedRef.current) {
        const rect = domNode.getBoundingClientRect();
        setContextMenuPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        setShowContextMenu(true);
      } else {
        showToast("Right-click disabled!");
      }
    });

    // Prevent paste
    editor.onDidPaste(() => {
      showToast("Pasting is disabled!");
      editor.trigger("keyboard", "undo");
    });
  };

  // 🧠 Starter templates
  const templates = {
    python: "# Python Code\nprint('Hello, World!')\n",
    c: "/* C Code */\n#include <stdio.h>\nint main() {\n  printf(\"Hello, World!\\n\");\n  return 0;\n}\n",
  };

  const switchLanguage = (newLang) => {
    onLangChange(newLang);
    if (!code.trim()) setCode(templates[newLang]);
    if (terminalRef?.current?.socket?.readyState === WebSocket.OPEN) {
      terminalRef.current.socket.send(JSON.stringify({ type: "lang", lang: newLang }));
    }
  };

  const handleMenuClick = (action) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    if (action === "commandPalette") {
      editorRef.current.trigger("keyboard", "editor.action.quickCommand");
    }
    if (action === "changeAll") {
      editorRef.current.trigger("keyboard", "editor.action.selectHighlights");
    }
    setShowContextMenu(false);
  };

  return (
    <div
      className="h-full flex flex-col bg-white dark:bg-gray-900"
      onClick={() => setShowContextMenu(false)}
    >
      {/* 🔹 Toolbar */}
      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
        {/* Left: Language Dropdown */}
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

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {loading && (
            <div className="flex items-center gap-2 px-3 py-1 text-xs text-blue-600 dark:text-blue-400">
              <div className="w-3 h-3 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin"></div>
              <span>Running...</span>
            </div>
          )}

          {/* Toggle Input Button */}
          {showInputToggle && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowInput(!showInput)}
              className="text-sm"
            >
              {showInput ? "Hide Input" : "Show Input"}
            </Button>
          )}

          {/* Run */}
          <Button
            size="sm"
            onClick={onRun}
            disabled={locked || loading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Run
          </Button>

          {/* PDF */}
          <Button
            size="sm"
            onClick={onDownload}
            disabled={locked || loading}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            Export PDF
          </Button>

          {/* ✅ Submit */}
          {onSubmit && (
            <Button
              size="sm"
              onClick={onSubmit}
              disabled={locked || loading}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Submit
            </Button>
          )}
        </div>
      </div>

      {/* 🧠 Code Editor */}
      <div className="flex-1 relative">
        <Editor
          height="100%"
          language={lang}
          theme={theme === "dark" ? "vs-dark" : "light"}
          value={code}
          onChange={(value) => setCode(value || "")}
          onMount={handleEditorMount}
          options={{
            readOnly: disabled || locked || !isFullscreen,
            minimap: { enabled: false },
            fontSize: 16,
            fontFamily: "'Fira Code', monospace",
            wordWrap: "on",
            lineNumbers: "on",
            quickSuggestions: { other: true, comments: false, strings: false },
            suggestOnTriggerCharacters: true,
            tabSize: 4,
            folding: true,
          }}
        />

        {/* Context Menu */}
        {showContextMenu && (
          <div
            className="absolute bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg z-50 w-56"
            style={{ top: contextMenuPos.y, left: contextMenuPos.x }}
          >
            <button
              className="block px-4 py-2 w-full text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
              onClick={() => handleMenuClick("changeAll")}
            >
              Change All Occurrences
            </button>
            <button
              className="block px-4 py-2 w-full text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
              onClick={() => handleMenuClick("commandPalette")}
            >
              Command Palette
            </button>
          </div>
        )}
      </div>

      {/* ⚠️ Warning Toast */}
      {showWarning && (
        <div className="absolute top-16 right-4 bg-orange-500 text-white px-4 py-2 rounded shadow-lg text-sm font-medium z-50">
          ⚠ {showWarning}
        </div>
      )}
    </div>
  );
}
