"use client";

import { useState, useRef, useEffect } from "react";
import { useTheme } from "next-themes";
import { useRouter, usePathname } from "next/navigation";
import Editor, { OnMount } from "@monaco-editor/react";
import { EditorToolbar } from "./EditorToolbar";
import { InteractiveTerminalHandle } from "./InteractiveTerminal";
import { AssistantPanel } from "./AssistantPanel";
import { FileExplorer, FileData } from "./FileExplorer";
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
}

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
    // terminalRef,
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
    useEffect(() => { langRef.current = lang; }, [lang]);
    useEffect(() => { lockedRef.current = locked; }, [locked]);

    // set initial mode from pathname
    useEffect(() => {
        if (pathname?.includes("/Interactive")) setCurrentMode("Interactive");
        else setCurrentMode("Static");
    }, [pathname]);

    const showModeSection = pathname === "/compiler" || pathname === "/interactive";

    const showToast = (message: string) => {
        setShowWarning(message);
        setTimeout(() => setShowWarning(false), 2000);
    };

    const handleModeChange = (mode: string) => {
        setCurrentMode(mode);
        const path = mode === "Interactive" ? "/Interactive" : "/compiler";
        router.push(path);
    };

    const [cursorPosition, setCursorPosition] = useState({ lineNumber: 1, column: 1 });



    const handleEditorMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;

        // Register static auto-completion
        registerCompletionProviders(monaco);

        editor.updateOptions({ contextmenu: false });

        // Define Glassmorphism Themes
        monaco.editor.defineTheme('glass-light', {
            base: 'vs',
            inherit: true,
            rules: [
                { token: '', background: '00000000' } // Transparent
            ],
            colors: {
                'editor.background': '#00000000', // Transparent
            }
        });

        monaco.editor.defineTheme('glass-dark', {
            base: 'vs-dark',
            inherit: true,
            rules: [
                { token: '', background: '00000000' } // Transparent
            ],
            colors: {
                'editor.background': '#00000000', // Transparent
            }
        });

        monaco.editor.setTheme(theme === 'dark' ? 'glass-dark' : 'glass-light');

        // Track cursor position
        editor.onDidChangeCursorPosition((e) => {
            setCursorPosition({ lineNumber: e.position.lineNumber, column: e.position.column });
        });

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
            if (isAiFeatureUnlockedRef.current) return;
            showToast("Pasting is disabled!");
            try { editor.trigger("keyboard", "undo", null); } catch (error) {
                console.error("Failed to format code:", error);
            }
        });

        editor.onKeyDown?.((e) => {
            if (isAiFeatureUnlockedRef.current) return;
            if ((e.ctrlKey || e.metaKey) && ["KeyV", "KeyC", "KeyX"].includes(e.code)) {
                e.preventDefault();
                showToast("Clipboard actions are disabled!");
            }
        });
    };

    const [internalShowAssistant, setInternalShowAssistant] = useState(false);
    const showAssistant = externalShowAssistant !== undefined ? externalShowAssistant : internalShowAssistant;
    const setShowAssistant = externalSetShowAssistant || setInternalShowAssistant;

    const [isAiFeatureUnlocked, setIsAiFeatureUnlocked] = useState(false); // Hidden by default

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Secret command: Ctrl + Alt + Shift + A (or Cmd + Alt + Shift + A)
            // Note: We use e.code === "KeyA" because on Mac, holding Option (Alt) changes e.key (e.g. to 'å')
            if ((e.ctrlKey || e.metaKey) && e.altKey && e.shiftKey && e.code === "KeyA") {
                e.preventDefault();
                setIsAiFeatureUnlocked((prev) => {
                    const newState = !prev;
                    isAiFeatureUnlockedRef.current = newState;
                    showToast(newState ? "AI Assistant Unlocked 🔓" : "AI Assistant Locked 🔒");
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
            className="h-full flex flex-col bg-transparent overflow-hidden"
            onClick={() => setShowContextMenu(false)}
        >
            <EditorToolbar
                lang={lang}
                onLangChange={onLangChange}
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
                    console.log('Toggling AI Assistant:', show);
                    setShowAssistant(show);
                }}
                isAiFeatureUnlocked={isAiFeatureUnlocked}
                onReset={onReset}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex relative overflow-hidden">
                {files && activeFileName && onFileSelect && onFileCreate && onFileDelete && (
                    <FileExplorer
                        files={files}
                        activeFile={activeFileName}
                        onFileSelect={onFileSelect}
                        onFileCreate={onFileCreate}
                        onFileDelete={onFileDelete}
                        onFileRename={onFileRename}
                        onFileUpload={onFileUpload}
                    />
                )}

                <div className="flex-1 relative flex flex-col min-w-0">

                    {/* Tab Bar */}
                    {files && files.length > 0 && onFileSelect && (
                        <div className="flex items-center bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 overflow-x-auto scrollbar-hide">
                            {files.map(file => (
                                <div
                                    key={file.name}
                                    className={`
                                        group flex items-center gap-2 px-3 py-2 text-sm border-r border-gray-200 dark:border-gray-800 cursor-pointer min-w-[120px] max-w-[200px] select-none transition-colors
                                        ${activeFileName === file.name
                                            ? "bg-white dark:bg-gray-900 text-blue-600 dark:text-blue-400 border-t-2 border-t-blue-500 font-medium"
                                            : "bg-gray-100 dark:bg-gray-950 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                                        }
                                    `}
                                    onClick={() => onFileSelect(file.name)}
                                >
                                    <FileCode2 size={14} className={activeFileName === file.name ? "text-blue-500" : "text-gray-400"} />
                                    <span className="truncate flex-1">{file.name}</span>
                                    {onFileDelete && files.length > 1 && (
                                        <button
                                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 transition-all"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onFileDelete(file.name);
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
                        <Editor
                            height="100%"
                            language={files ? files.find(f => f.name === activeFileName)?.language || lang : lang}
                            value={files ? files.find(f => f.name === activeFileName)?.content || "" : code}
                            theme={theme === "dark" ? "glass-dark" : "glass-light"}
                            onChange={(value) => {
                                if (files && activeFileName && onFileChange) {
                                    onFileChange(activeFileName, value || "");
                                } else {
                                    setCode(value || "");
                                }
                            }}
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
                                scrollBeyondLastLine: false,
                                padding: { top: 16, bottom: 16 },
                            }}
                        />

                        {showContextMenu && (
                            <div
                                className="absolute bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-md shadow-lg z-50 w-56"
                                style={{ top: contextMenuPos.y, left: contextMenuPos.x }}
                            >
                                <button
                                    className="block px-4 py-2 w-full text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
                                    onClick={() => editorRef.current?.trigger("keyboard", "editor.action.selectHighlights", null)}
                                >
                                    Change All Occurrences
                                </button>
                                <button
                                    className="block px-4 py-2 w-full text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
                                    onClick={() => editorRef.current?.trigger("keyboard", "editor.action.quickCommand", null)}
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
                                code: files ? files.find(f => f.name === activeFileName)?.content || "" : code,
                                activeFile: activeFileName,
                                files: files?.map(f => ({ name: f.name, language: f.language })),
                                cursorPosition: cursorPosition
                            }}
                            onClose={() => setShowAssistant(false)}
                        />
                    </div>
                )}
            </div>

            {/* Status Bar */}
            <StatusBar
                lang={files ? files.find(f => f.name === activeFileName)?.language || lang : lang}
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
