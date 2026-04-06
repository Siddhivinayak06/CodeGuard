"use client";

import { useState, useRef, useEffect } from "react";
import { useTheme } from "next-themes";
import { useRouter, usePathname } from "next/navigation";
import Editor, { OnMount } from "@monaco-editor/react";
import { EditorToolbar } from "./EditorToolbar";
import { InteractiveTerminalHandle } from "./InteractiveTerminal";
import { AssistantPanel } from "./AssistantPanel";
import { FileExplorer, FileData } from "./FileExplorer";
import { CsvViewer } from "./CsvViewer";
import { StatusBar } from "./StatusBar";
import { X, FileCode2 } from "lucide-react";
import { registerCompletionProviders } from "@/utils/completion-provider";

interface CodeEditorProps {
  code: string;
  setCode: (code: string) => void;
  disabled?: boolean;
  onRun: () => void;
  onDownload: () => void;
  onSubmit?: () => void;
  loading: boolean;
  locked?: boolean;
  lang: string;
  onLangChange: (lang: string) => void;
  showLangSelector?: boolean;
  showInputToggle?: boolean;
  showInput: boolean;
  setShowInput: (show: boolean) => void;
  isFullscreen?: boolean;
  terminalRef?: React.MutableRefObject<InteractiveTerminalHandle | null>;
  violations?: number;
  // Multi-file props
  files?: FileData[];
  activeFileName?: string;
  onFileSelect?: (fileName: string) => void;
  onFileCreate?: (fileName: string) => void;
  onFileDelete?: (fileName: string) => void;
  onFileChange?: (fileName: string, newContent: string) => void;
  onFileRename?: (oldName: string, newName: string) => void;
  onFileUpload?: (fileName: string, content: string) => void;
  // External control props
  externalShowAssistant?: boolean;
  externalSetShowAssistant?: (show: boolean) => void;
  renderAssistantExternally?: boolean;
  onReset?: () => void;
  disableClipboardActions?: boolean;
}

const INTERNAL_FILE_TEMPLATES: Record<string, string> = {
  java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}`,
  python: `print("Hello, World!")`,
  c: `#include <stdio.h>

int main(void) {
    printf("Hello, World!\\n");
    return 0;
}`,
  cpp: `#include <iostream>

int main() {
    std::cout << "Hello, World!" << std::endl;
    return 0;
}`,
  csv: "Name,Age\nAlice,21",
};

const RUNNABLE_LANGUAGES = new Set(["java", "python", "c", "cpp"]);

const getDefaultFileNameForLanguage = (language: string) => {
  switch (String(language || "").toLowerCase()) {
    case "python":
      return "main.py";
    case "java":
      return "Main.java";
    case "cpp":
      return "main.cpp";
    case "c":
      return "main.c";
    default:
      return "main.txt";
  }
};

const getLanguageFromFileName = (fileName: string, fallback: string) => {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (ext === "py") return "python";
  if (ext === "java") return "java";
  if (ext === "cpp" || ext === "cc" || ext === "hpp") return "cpp";
  if (ext === "c" || ext === "h") return "c";
  if (ext === "csv" || ext === "xlsx" || ext === "xls") return "csv";
  return fallback;
};

export default function CodeEditor({
  code,
  setCode,
  disabled = false,
  onRun,
  onDownload,
  onSubmit,
  loading,
  locked = false,
  lang,
  onLangChange,
  showLangSelector = false,
  showInputToggle = false,
  showInput,
  setShowInput,
  isFullscreen = true,
  violations = 0,
  files,
  activeFileName,
  onFileSelect,
  onFileCreate,
  onFileDelete,
  onFileChange,
  onFileRename,
  onFileUpload,
  externalShowAssistant,
  externalSetShowAssistant,
  renderAssistantExternally = false,
  onReset,
  disableClipboardActions = false,
}: CodeEditorProps) {
  const { theme } = useTheme();
  const router = useRouter();
  const pathname = usePathname();

  const [showWarning, setShowWarning] = useState<string | false>(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
  const [showContextMenu, setShowContextMenu] = useState(false);

  // Assistant Resize State
  const [assistantWidth, setAssistantWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = (e: React.MouseEvent) => {
    setIsResizing(true);
    e.preventDefault();
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      // Min width 300px, Max width 80% of screen
      if (newWidth > 300 && newWidth < window.innerWidth * 0.8) {
        setAssistantWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  const [currentMode, setCurrentMode] = useState("Static");
  const showSubmitButton = pathname === "/editor";
  const editorRef = useRef<Parameters<OnMount>[0] | null>(null);
  const langRef = useRef(lang);
  const lockedRef = useRef(locked);
  const isAiFeatureUnlockedRef = useRef(false);

  // sync refs
  useEffect(() => {
    langRef.current = lang;
  }, [lang]);
  useEffect(() => {
    lockedRef.current = locked;
  }, [locked]);

  // set initial mode from pathname
  useEffect(() => {
    if (pathname?.includes("/Interactive")) setCurrentMode("Interactive");
    else setCurrentMode("Static");
  }, [pathname]);

  const showModeSection =
    pathname === "/compiler" || pathname === "/interactive";

  const hasExternalFileModel = Boolean(
    files &&
      activeFileName &&
      onFileSelect &&
      onFileCreate &&
      onFileDelete &&
      onFileChange,
  );

  const [internalFiles, setInternalFiles] = useState<FileData[]>(() => {
    const defaultFileName = getDefaultFileNameForLanguage(lang);
    const fileLanguage = getLanguageFromFileName(defaultFileName, lang);
    const defaultTemplate = INTERNAL_FILE_TEMPLATES[fileLanguage] || code || "";

    return [
      {
        name: defaultFileName,
        content: code || defaultTemplate,
        language: fileLanguage,
      },
    ];
  });
  const [internalActiveFileName, setInternalActiveFileName] = useState<string>(
    () => getDefaultFileNameForLanguage(lang),
  );

  const handleInternalFileSelect = (fileName: string) => {
    const selected = internalFiles.find((file) => file.name === fileName);
    if (!selected) {
      return;
    }

    setInternalActiveFileName(fileName);
    setCode(selected.content);
    if (RUNNABLE_LANGUAGES.has(selected.language)) {
      onLangChange(selected.language);
    }
  };

  const handleInternalFileCreate = (fileName: string) => {
    const normalizedName = String(fileName || "").trim();
    if (!normalizedName) {
      return;
    }

    if (internalFiles.some((file) => file.name === normalizedName)) {
      return;
    }

    const fileLanguage = getLanguageFromFileName(normalizedName, lang);
    const nextContent = INTERNAL_FILE_TEMPLATES[fileLanguage] || "";

    setInternalFiles((prev) => [
      ...prev,
      {
        name: normalizedName,
        content: nextContent,
        language: fileLanguage,
      },
    ]);
    setInternalActiveFileName(normalizedName);
    setCode(nextContent);
    if (RUNNABLE_LANGUAGES.has(fileLanguage)) {
      onLangChange(fileLanguage);
    }
  };

  const handleInternalFileDelete = (fileName: string) => {
    setInternalFiles((prev) => {
      if (prev.length <= 1) {
        return prev;
      }

      const nextFiles = prev.filter((file) => file.name !== fileName);
      if (nextFiles.length === prev.length) {
        return prev;
      }

      if (internalActiveFileName === fileName) {
        const fallbackFile = nextFiles[0];
        if (fallbackFile) {
          setInternalActiveFileName(fallbackFile.name);
          setCode(fallbackFile.content);
          if (RUNNABLE_LANGUAGES.has(fallbackFile.language)) {
            onLangChange(fallbackFile.language);
          }
        }
      }

      return nextFiles;
    });
  };

  const handleInternalFileChange = (fileName: string, newContent: string) => {
    setInternalFiles((prev) => {
      let changed = false;
      const nextFiles = prev.map((file) => {
        if (file.name !== fileName || file.content === newContent) {
          return file;
        }
        changed = true;
        return {
          ...file,
          content: newContent,
        };
      });
      return changed ? nextFiles : prev;
    });

    if (internalActiveFileName === fileName) {
      setCode(newContent);
    }
  };

  const handleInternalFileRename = (oldName: string, newName: string) => {
    const normalizedNewName = String(newName || "").trim();
    if (!normalizedNewName || normalizedNewName === oldName) {
      return;
    }

    setInternalFiles((prev) => {
      if (prev.some((file) => file.name === normalizedNewName)) {
        return prev;
      }

      const current = prev.find((file) => file.name === oldName);
      if (!current) {
        return prev;
      }

      const nextLanguage = getLanguageFromFileName(normalizedNewName, current.language || lang);
      const nextFiles = prev.map((file) =>
        file.name === oldName
          ? {
              ...file,
              name: normalizedNewName,
              language: nextLanguage,
            }
          : file,
      );

      if (internalActiveFileName === oldName) {
        setInternalActiveFileName(normalizedNewName);
        if (RUNNABLE_LANGUAGES.has(nextLanguage)) {
          onLangChange(nextLanguage);
        }
      }

      return nextFiles;
    });
  };

  const handleInternalFileUpload = (fileName: string, content: string) => {
    const normalizedName = String(fileName || "").trim();
    if (!normalizedName) {
      return;
    }

    if (internalFiles.some((file) => file.name === normalizedName)) {
      return;
    }

    const fileLanguage = getLanguageFromFileName(normalizedName, lang);
    setInternalFiles((prev) => [
      ...prev,
      {
        name: normalizedName,
        content,
        language: fileLanguage,
      },
    ]);
    setInternalActiveFileName(normalizedName);
    setCode(content);
    if (RUNNABLE_LANGUAGES.has(fileLanguage)) {
      onLangChange(fileLanguage);
    }
  };

  const handleEditorLangChange = (nextLang: string) => {
    onLangChange(nextLang);

    if (hasExternalFileModel) {
      return;
    }

    const defaultFileName = getDefaultFileNameForLanguage(nextLang);
    const existingFile = internalFiles.find((file) => file.name === defaultFileName);
    if (existingFile) {
      setInternalActiveFileName(defaultFileName);
      setCode(existingFile.content);
      return;
    }

    const template = INTERNAL_FILE_TEMPLATES[nextLang] || "";
    const fileLanguage = getLanguageFromFileName(defaultFileName, nextLang);

    setInternalFiles((prev) => [
      ...prev,
      {
        name: defaultFileName,
        content: template,
        language: fileLanguage,
      },
    ]);
    setInternalActiveFileName(defaultFileName);
    setCode(template);
  };

  const effectiveFiles = hasExternalFileModel ? files || [] : internalFiles;
  const effectiveActiveFileName = hasExternalFileModel
    ? activeFileName || ""
    : internalActiveFileName;

  const effectiveOnFileSelect = hasExternalFileModel
    ? onFileSelect
    : handleInternalFileSelect;
  const effectiveOnFileCreate = hasExternalFileModel
    ? onFileCreate
    : handleInternalFileCreate;
  const effectiveOnFileDelete = hasExternalFileModel
    ? onFileDelete
    : handleInternalFileDelete;
  const effectiveOnFileChange = hasExternalFileModel
    ? onFileChange
    : handleInternalFileChange;
  const effectiveOnFileRename = hasExternalFileModel
    ? onFileRename
    : handleInternalFileRename;
  const effectiveOnFileUpload = hasExternalFileModel
    ? onFileUpload
    : handleInternalFileUpload;

  useEffect(() => {
    if (hasExternalFileModel) {
      return;
    }

    setInternalFiles((prev) => {
      let changed = false;
      const nextFiles = prev.map((file) => {
        if (file.name !== internalActiveFileName || file.content === code) {
          return file;
        }
        changed = true;
        return {
          ...file,
          content: code,
        };
      });

      return changed ? nextFiles : prev;
    });
  }, [code, hasExternalFileModel, internalActiveFileName]);

  const showToast = (message: string) => {
    setShowWarning(message);
    setTimeout(() => setShowWarning(false), 3000);
  };

  useEffect(() => {
    if (showWarning) {
      console.log("showWarning state changed to:", showWarning);
    }
  }, [showWarning]);

  const handleModeChange = (mode: string) => {
    setCurrentMode(mode);
    const path = mode === "Interactive" ? "/Interactive" : "/compiler";
    router.push(path);
  };

  const [cursorPosition, setCursorPosition] = useState({
    lineNumber: 1,
    column: 1,
  });

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    // Register static auto-completion
    registerCompletionProviders(monaco);

    editor.updateOptions({ contextmenu: false });

    // Define Glassmorphism Themes
    monaco.editor.defineTheme("glass-light", {
      base: "vs",
      inherit: true,
      rules: [
        { token: "", background: "00000000" }, // Transparent
      ],
      colors: {
        "editor.background": "#00000000", // Transparent
      },
    });

    monaco.editor.defineTheme("glass-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "", background: "00000000" }, // Transparent
      ],
      colors: {
        "editor.background": "#00000000", // Transparent
      },
    });

    monaco.editor.setTheme(theme === "dark" ? "glass-dark" : "glass-light");

    // Track cursor position
    editor.onDidChangeCursorPosition((e) => {
      setCursorPosition({
        lineNumber: e.position.lineNumber,
        column: e.position.column,
      });
    });

    const domNode = editor.getDomNode();
    if (!domNode) return;

    const shouldBlockClipboard =
      () => disableClipboardActions && !isAiFeatureUnlockedRef.current;

    const blockClipboardEvent = (event: Event) => {
      if (!shouldBlockClipboard()) return;
      event.preventDefault();
      event.stopPropagation();
      showToast("Clipboard actions are disabled!");
    };

    domNode.addEventListener("copy", blockClipboardEvent, true);
    domNode.addEventListener("cut", blockClipboardEvent, true);
    domNode.addEventListener("paste", blockClipboardEvent, true);

    const pasteDisposable = editor.onDidPaste?.(() => {
      if (!shouldBlockClipboard()) return;
      showToast("Pasting is disabled!");
      try {
        editor.trigger("keyboard", "undo", null);
      } catch (error) {
        console.error("Failed to undo pasted content:", error);
      }
    });

    const keyDownDisposable = editor.onKeyDown?.((e) => {
      if (!shouldBlockClipboard()) return;
      if ((e.ctrlKey || e.metaKey) && ["KeyV", "KeyC", "KeyX"].includes(e.code)) {
        e.preventDefault();
        e.stopPropagation();
        showToast("Clipboard actions are disabled!");
      }
    });

    domNode.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      if (!lockedRef.current) {
        const rect = domNode.getBoundingClientRect();
        setContextMenuPos({
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
        setShowContextMenu(true);
      } else {
        showToast("Right-click disabled!");
      }
    });

    editor.onDidDispose(() => {
      domNode.removeEventListener("copy", blockClipboardEvent, true);
      domNode.removeEventListener("cut", blockClipboardEvent, true);
      domNode.removeEventListener("paste", blockClipboardEvent, true);
      pasteDisposable?.dispose?.();
      keyDownDisposable?.dispose?.();
    });

    // Disable some actions
    editor.addAction({
      id: "editor.action.clipboardCopyWithSyntaxHighlightingAction",
      label: "Copy with Syntax Highlighting",
      keybindings: [], // remove any keyboard triggers
      precondition: "false",
      run: function (ed) {
        showToast("This command is disabled!");
      },
    });
    editor.addAction({
      id: "editor.action.pasteAsText",
      label: "Paste as Text",
      keybindings: [],
      precondition: "false",
      run: function (ed) {
        showToast("This command is disabled!");
      },
    });
    editor.addAction({
      id: "editor.action.pasteAs",
      label: "Paste As…",
      keybindings: [],
      precondition: "false",
      run: function (ed) {
        console.log("Paste As action triggered");
        showToast("This command is disabled!");
      },
    });
  };

  const [internalShowAssistant, setInternalShowAssistant] = useState(false);
  const showAssistant =
    externalShowAssistant !== undefined
      ? externalShowAssistant
      : internalShowAssistant;
  const setShowAssistant = externalSetShowAssistant || setInternalShowAssistant;

  const [isAiFeatureUnlocked, setIsAiFeatureUnlocked] = useState(false); // Hidden by default

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Secret command: Ctrl + Alt + Shift + A (or Cmd + Alt + Shift + A)
      // Note: We use e.code === "KeyA" because on Mac, holding Option (Alt) changes e.key (e.g. to 'å')
      if (
        (e.ctrlKey || e.metaKey) &&
        e.altKey &&
        e.shiftKey &&
        e.code === "KeyA"
      ) {
        e.preventDefault();
        setIsAiFeatureUnlocked((prev) => {
          const newState = !prev;
          isAiFeatureUnlockedRef.current = newState;
          showToast(
            newState ? "AI Assistant Unlocked 🔓" : "AI Assistant Locked 🔒",
          );
          if (!newState) setShowAssistant(false);
          return newState;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setShowAssistant]);

  return (
    <div
      className="h-full flex flex-col bg-transparent overflow-hidden relative"
      onClick={() => setShowContextMenu(false)}
    >
      <EditorToolbar
        lang={lang}
        onLangChange={handleEditorLangChange}
        showLangSelector={showLangSelector}
        currentMode={currentMode}
        handleModeChange={handleModeChange}
        showModeSection={showModeSection}
        locked={locked}
        violations={violations}
        showInput={showInput}
        setShowInput={setShowInput}
        showInputToggle={showInputToggle}
        onRun={onRun}
        onDownload={onDownload}
        onSubmit={onSubmit}
        loading={loading}
        showSubmitButton={showSubmitButton}
        showAssistant={showAssistant}
        setShowAssistant={(show: boolean) => {
          console.log("Toggling AI Assistant:", show);
          setShowAssistant(show);
        }}
        isAiFeatureUnlocked={isAiFeatureUnlocked}
        onReset={onReset}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex relative overflow-hidden">
        {effectiveActiveFileName &&
          effectiveOnFileSelect &&
          effectiveOnFileCreate &&
          effectiveOnFileDelete && (
            <FileExplorer
              files={effectiveFiles}
              activeFile={effectiveActiveFileName}
              onFileSelect={effectiveOnFileSelect}
              onFileCreate={effectiveOnFileCreate}
              onFileDelete={effectiveOnFileDelete}
              onFileRename={effectiveOnFileRename}
              onFileUpload={effectiveOnFileUpload}
            />
          )}

        <div className="flex-1 relative flex flex-col min-w-0">
          {/* Tab Bar */}
          {effectiveFiles.length > 0 && effectiveOnFileSelect && (
            <div className="flex items-center bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 overflow-x-auto scrollbar-hide">
              {effectiveFiles.map((file) => (
                <div
                  key={file.name}
                  className={`
                                        group flex items-center gap-2 px-3 py-2 text-sm border-r border-gray-200 dark:border-gray-800 cursor-pointer min-w-[120px] max-w-[200px] select-none transition-colors
                                        ${effectiveActiveFileName === file.name
                      ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 border-t-2 border-t-blue-500 font-medium"
                      : "bg-gray-100 dark:bg-gray-950 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }
                                    `}
                  onClick={() => effectiveOnFileSelect(file.name)}
                >
                  <FileCode2
                    size={14}
                    className={
                      effectiveActiveFileName === file.name
                        ? "text-blue-500"
                        : "text-gray-400"
                    }
                  />
                  <span className="truncate flex-1">{file.name}</span>
                  {effectiveOnFileDelete && effectiveFiles.length > 1 && (
                    <button
                      className="opacity-0 group-hover:opacity-100 p-0.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 transition-all"
                      onClick={(e) => {
                        e.stopPropagation();
                        effectiveOnFileDelete(file.name);
                      }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex-1 relative">
            {(() => {
              const activeFile = effectiveFiles.find(
                (file) => file.name === effectiveActiveFileName,
              );
              const isCsv = /\.(csv|xlsx|xls)$/i.test(activeFile?.name || "");

              if (isCsv && activeFile) {
                return (
                  <CsvViewer
                    content={activeFile.content}
                    onChange={
                      effectiveOnFileChange
                        ? (newContent) =>
                            effectiveOnFileChange(activeFile.name, newContent)
                        : undefined
                    }
                    readOnly={disabled || locked || !isFullscreen}
                    fileName={activeFile.name}
                  />
                );
              }

              return (
                <Editor
                  height="100%"
                  language={
                    effectiveFiles.length > 0
                      ? activeFile?.language || lang
                      : lang
                  }
                  value={
                    effectiveFiles.length > 0
                      ? activeFile?.content || ""
                      : code
                  }
                  theme={theme === "dark" ? "glass-dark" : "glass-light"}
                  onChange={(value) => {
                    if (
                      effectiveFiles.length > 0 &&
                      effectiveActiveFileName &&
                      effectiveOnFileChange
                    ) {
                      effectiveOnFileChange(effectiveActiveFileName, value || "");
                    } else {
                      setCode(value || "");
                    }
                  }}
                  onMount={handleEditorMount}
                  options={{
                    readOnly: disabled || locked || !isFullscreen,
                    minimap: { enabled: false },
                    fontSize: 15,
                    fontFamily: "'Fira Code', monospace",
                    wordWrap: "on",
                    lineNumbers: "on",
                    quickSuggestions: {
                      other: true,
                      comments: false,
                      strings: false,
                    },
                    suggestOnTriggerCharacters: true,
                    tabSize: 4,
                    folding: true,
                    scrollBeyondLastLine: false,
                    padding: { top: 16, bottom: 16 },
                    stickyScroll: { enabled: false },
                    smoothScrolling: true,
                    scrollbar: {
                      alwaysConsumeMouseWheel: false,
                    },
                  }}
                />
              );
            })()}

            {showContextMenu && (
              <div
                className="absolute bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg z-50 w-56"
                style={{ top: contextMenuPos.y, left: contextMenuPos.x }}
              >
                <button
                  className="block px-4 py-2 w-full text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
                  onClick={() => {
                    editorRef.current?.focus();
                    editorRef.current?.trigger(
                      "keyboard",
                      "editor.action.selectHighlights",
                      null,
                    );
                  }}
                >
                  Change All Occurrences
                </button>
                <button
                  className="block px-4 py-2 w-full text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
                  onClick={() => {
                    editorRef.current?.focus();
                    editorRef.current?.trigger(
                      "keyboard",
                      "editor.action.quickCommand",
                      null,
                    );
                  }}
                >
                  Command Palette
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Assistant Panel - Absolute Positioned Overlay */}
        {!renderAssistantExternally && showAssistant && (
          <div
            className="absolute top-0 right-0 bottom-0 z-40 flex h-full shadow-2xl border-l border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
            style={{ width: assistantWidth }}
          >
            {/* Resize Handle */}
            <div
              className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 transition-colors z-50 flex flex-col justify-center items-center group"
              onMouseDown={startResizing}
            >
              <div className="h-8 w-1 bg-gray-300 dark:bg-gray-600 rounded-full group-hover:bg-blue-400" />
            </div>

            <AssistantPanel
              codeContext={{
                code: effectiveFiles.length > 0
                  ? effectiveFiles.find((file) => file.name === effectiveActiveFileName)
                      ?.content || ""
                  : code,
                activeFile: effectiveActiveFileName,
                files: effectiveFiles.map((file) => ({
                  name: file.name,
                  language: file.language,
                })),
                cursorPosition: cursorPosition,
              }}
              onClose={() => setShowAssistant(false)}
            />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <StatusBar
        lang={
          effectiveFiles.length > 0
            ? effectiveFiles.find((file) => file.name === effectiveActiveFileName)
                ?.language || lang
            : lang
        }
        cursorPosition={cursorPosition}
        readOnly={disabled || locked || !isFullscreen}
        violations={violations}
      />

      {showWarning && (
        <div className="absolute top-16 right-4 bg-orange-500 text-white px-4 py-2 rounded shadow-lg text-sm font-medium z-50 animate-in fade-in slide-in-from-top-2">
          ⚠ {showWarning}
        </div>
      )}
    </div>
  );
}
