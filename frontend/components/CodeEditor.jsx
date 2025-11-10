"use client";

import { useState, useRef, useEffect } from "react";
import { useTheme } from "next-themes";
import { useRouter, usePathname } from "next/navigation";
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
import { ModeToggle } from "@/components/ModeToggle";

export default function CodeEditor({
  code,
  setCode,
  disabled,
  onRun,
  onDownload,
  onSubmit,
  loading,
  locked,
  lang,
  onLangChange,
  showInputToggle,
  showInput,
  setShowInput,
  isFullscreen = true,
  terminalRef,
  violations = 0,
}) {
  const { theme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const [showWarning, setShowWarning] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [showContextMenu, setShowContextMenu] = useState(false);


  const [currentMode, setCurrentMode] = useState("Static");
  const showSubmitButton = pathname === "/editor";
  const editorRef = useRef(null);
  const langRef = useRef(lang);
  const lockedRef = useRef(locked);

  // sync refs
  useEffect(() => { langRef.current = lang; }, [lang]);
  useEffect(() => { lockedRef.current = locked; }, [locked]);

  // set initial mode from pathname
  useEffect(() => {
    if (pathname?.includes("/Interactive")) setCurrentMode("Interactive");
    else setCurrentMode("Static");
  }, [pathname]);
  const showModeSection =
    pathname === "/compiler" || pathname === "/Interactive";

  const showToast = (message) => {
    setShowWarning(message);
    setTimeout(() => setShowWarning(false), 2000);
  };

  const handleModeChange = (mode) => {
    setCurrentMode(mode);
    const path = mode === "Interactive" ? "/Interactive" : "/compiler";
    router.push(path);
  };
 useEffect(() => {
    if (!window.monacoProvidersRegistered) {
      window.monacoProvidersRegistered = true;

      loader.init().then((monaco) => {
        // Python completions
        monaco.languages.registerCompletionItemProvider("python", {
          triggerCharacters: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
          provideCompletionItems: (model, position) => {
            return {
              suggestions: [
                { label: "def", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "def", documentation: "Define a function" },
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
                { label: "print", kind: monaco.languages.CompletionItemKind.Function, insertText: "print()", documentation: "Print output" },
                { label: "len", kind: monaco.languages.CompletionItemKind.Function, insertText: "len()", documentation: "Length of iterable" },
                { label: "range", kind: monaco.languages.CompletionItemKind.Function, insertText: "range()", documentation: "Generate range" },
                { label: "input", kind: monaco.languages.CompletionItemKind.Function, insertText: "input()", documentation: "Get user input" },
                { label: "import math", kind: monaco.languages.CompletionItemKind.Module, insertText: "import math", documentation: "Math module" },
                { label: "import os", kind: monaco.languages.CompletionItemKind.Module, insertText: "import os", documentation: "OS module" }
              ]
            };
          }
        });

        // C completions
        monaco.languages.registerCompletionItemProvider("c", {
          triggerCharacters: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ#".split(""),
          provideCompletionItems: (model, position) => {
            return {
              suggestions: [
                { label: "#include <stdio.h>", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "#include <stdio.h>", documentation: "Standard I/O library", filterText: "#" },
                { label: "#include <stdlib.h>", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "#include <stdlib.h>", documentation: "Standard library", filterText: "#" },
                { label: "#include <string.h>", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "#include <string.h>", documentation: "String manipulation library", filterText: "#" },
                { label: "#include <math.h>", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "#include <math.h>", documentation: "Math library", filterText: "#" },
                { label: "int", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "int", documentation: "Integer data type" },
                { label: "char", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "char", documentation: "Character data type" },
                { label: "float", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "float", documentation: "Floating-point data type" },
                { label: "main", kind: monaco.languages.CompletionItemKind.Function, insertText: "int main() {\\n\\t\\n}", documentation: "Main function" },
                { label: "for", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "for", documentation: "For loop" },
                { label: "while", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "while", documentation: "While loop" },
                { label: "if", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "if", documentation: "If statement" },
                { label: "else", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "else", documentation: "Else statement" },
                { label: "printf", kind: monaco.languages.CompletionItemKind.Function, insertText: "printf()", documentation: "Print output" },
                { label: "scanf", kind: monaco.languages.CompletionItemKind.Function, insertText: "scanf()", documentation: "Read input" },
                { label: "malloc", kind: monaco.languages.CompletionItemKind.Function, insertText: "malloc()", documentation: "Allocate memory" },
                { label: "free", kind: monaco.languages.CompletionItemKind.Function, insertText: "free()", documentation: "Free memory" }
              ]
            };
          }
        });

        // Java completions (lightweight)
        monaco.languages.registerCompletionItemProvider("java", {
          triggerCharacters: "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
          provideCompletionItems: (model, position) => {
            return {
              suggestions: [
                { label: "public class", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "public class ", documentation: "Define a public class" },
                { label: "class", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "class ", documentation: "Define a class" },
                { label: "public static void main", kind: monaco.languages.CompletionItemKind.Snippet, insertText: "public static void main(String[] args) {\\n\\t\\n}", documentation: "Main method" },
                { label: "System.out.println", kind: monaco.languages.CompletionItemKind.Function, insertText: "System.out.println()", documentation: "Print line" },
                { label: "import java.util.*;", kind: monaco.languages.CompletionItemKind.Module, insertText: "import java.util.*;", documentation: "Import utilities" },
                { label: "String", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "String", documentation: "String type" },
                { label: "int", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "int", documentation: "Integer type" },
                { label: "for", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "for (int i = 0; i < ; i++) {\\n\\t\\n}", documentation: "For loop" },
                { label: "if", kind: monaco.languages.CompletionItemKind.Keyword, insertText: "if () {\\n\\t\\n}", documentation: "If statement" }
              ]
            };
          }
        });
      });
    }
  }, []);
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

    // disable paste via events
    editor.onDidPaste?.(() => {
      showToast("Pasting is disabled!");
      try { editor.trigger("keyboard", "undo"); } catch (e) { }
    });

    editor.onKeyDown?.((e) => {
      if ((e.ctrlKey || e.metaKey) && ["KeyV", "KeyC", "KeyX"].includes(e.code)) {
        e.preventDefault();
        showToast("Clipboard actions are disabled!");
      }
    });
    // Disable some actions
    editor.addAction({
      id: "editor.action.clipboardCopyWithSyntaxHighlightingAction",
      label: "Copy with Syntax Highlighting",
      keybindings: [], // remove any keyboard triggers
      precondition: null,
      run: function (ed) {
        showToast("This command is disabled!");
        return null;
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
  const languageLabel = lang === "python" ? "Python" : lang === "java" ? "Java" : "C";

  return (
    <div
      className="h-full flex flex-col bg-white dark:bg-gray-900"
      onClick={() => setShowContextMenu(false)}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
        {/* Left: Language */}
        <div className="flex items-center gap-3">
          {/* Language Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="flex items-center gap-2 text-sm">
                {languageLabel}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Select Language</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onLangChange("python")}>Python</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onLangChange("c")}>C</DropdownMenuItem>
              <DropdownMenuItem onClick={() => onLangChange("java")}>Java</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="text-gray-700 dark:text-gray-300 text-sm font-medium">{languageLabel} Editor</span>
        </div>

        {/* Middle / Right: Mode dropdown, locked badge, violations, controls */}
        <div className="flex items-center gap-4">
          {/* Mode Dropdown + Session Locked + Violations (Only for /compiler or /interactive) */}
          {showModeSection && (
            <div className="flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="flex items-center gap-2 text-sm">
                    {currentMode}
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent>
                  <DropdownMenuLabel>Select Mode</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleModeChange("Static")}>
                    Static
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleModeChange("Interactive")}>
                    Interactive
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {locked && (
                <div className="px-3 py-1 text-sm bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded">
                  Session Locked
                </div>
              )}

              <div className="text-sm text-gray-600 dark:text-gray-400">
                Violations:{" "}
                <span className="text-red-600 dark:text-red-400 font-semibold">
                  {violations}
                </span>
                /3
              </div>
            </div>
          )}
        
          {/* Controls: input toggle, run, pdf, submit */}
          <div className="flex items-center gap-2">
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

            <Button size="sm" onClick={onRun} disabled={locked || loading} className="bg-blue-600 hover:bg-blue-700 text-white">
              Run
            </Button>
            <Button size="sm" onClick={onDownload} disabled={locked || loading} className="bg-purple-600 hover:bg-purple-700 text-white">
              Export PDF
            </Button>
            {showSubmitButton && onSubmit && (
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
      </div>

      {/* Editor */}
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

      {showWarning && (
        <div className="absolute top-16 right-4 bg-orange-500 text-white px-4 py-2 rounded shadow-lg text-sm font-medium z-50">
          ⚠ {showWarning}
        </div>
      )}
    </div>
  );
}
