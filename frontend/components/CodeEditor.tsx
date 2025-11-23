"use client";

import { useState, useRef, useEffect } from "react";
import { useTheme } from "next-themes";
import { useRouter, usePathname } from "next/navigation";
import Editor, { OnMount } from "@monaco-editor/react";
import { EditorToolbar } from "./EditorToolbar";
import { AssistantPanel } from "./AssistantPanel";
import { FileExplorer, FileData } from "./FileExplorer";
import { StatusBar } from "./StatusBar";

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
    showInputToggle?: boolean;
    showInput: boolean;
    setShowInput: (show: boolean) => void;
    isFullscreen?: boolean;
    terminalRef?: any;
    violations?: number;
    // Multi-file props
    files?: FileData[];
    activeFileName?: string;
    onFileSelect?: (fileName: string) => void;
    onFileCreate?: (fileName: string) => void;
    onFileDelete?: (fileName: string) => void;
    onFileChange?: (fileName: string, newContent: string) => void;
    // External control props
    externalShowAssistant?: boolean;
    externalSetShowAssistant?: (show: boolean) => void;
    renderAssistantExternally?: boolean;
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
    showInputToggle = false,
    showInput,
    setShowInput,
    isFullscreen = true,
    terminalRef,
    violations = 0,
    files,
    activeFileName,
    onFileSelect,
    onFileCreate,
    onFileDelete,
    onFileChange,
    externalShowAssistant,
    externalSetShowAssistant,
    renderAssistantExternally = false,
}: CodeEditorProps) {
    const { theme } = useTheme();
    const router = useRouter();
    const pathname = usePathname();

    const [showWarning, setShowWarning] = useState<string | false>(false);
    const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });
    const [showContextMenu, setShowContextMenu] = useState(false);

    const [currentMode, setCurrentMode] = useState("Static");
    const showSubmitButton = pathname === "/editor";
    const editorRef = useRef<any>(null);
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

    const handleEditorMount: OnMount = (editor) => {
        editorRef.current = editor;
        editor.updateOptions({ contextmenu: false });

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
            showToast("Pasting is disabled!");
            try { editor.trigger("keyboard", "undo", null); } catch (e) { }
        });

        editor.onKeyDown?.((e) => {
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
            className="h-full flex flex-col bg-white dark:bg-gray-900 overflow-hidden"
            onClick={() => setShowContextMenu(false)}
        >
            <EditorToolbar
                lang={lang}
                onLangChange={onLangChange}
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
                    />
                )}

                <div className="flex-1 relative flex flex-col min-w-0">
                    <div className="flex-1 relative">
                        <Editor
                            height="100%"
                            language={files ? files.find(f => f.name === activeFileName)?.language || lang : lang}
                            value={files ? files.find(f => f.name === activeFileName)?.content || "" : code}
                            theme={theme === "dark" ? "vs-dark" : "light"}
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
                    <div className="absolute top-0 right-0 bottom-0 z-40 flex h-full shadow-2xl border-l border-gray-200 dark:border-gray-700">
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
