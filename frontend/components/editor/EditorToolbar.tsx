"use client";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Sparkles, Play, Download, Send, Eye, EyeOff, MoreVertical, Loader2, RotateCcw } from "lucide-react";

interface EditorToolbarProps {
    lang: string;
    onLangChange: (lang: string) => void;
    showLangSelector?: boolean;
    currentMode: string;
    handleModeChange: (mode: string) => void;
    showModeSection: boolean;
    locked: boolean;
    violations: number;
    showInput: boolean;
    setShowInput: (show: boolean) => void;
    showInputToggle: boolean;
    onRun: () => void;
    onDownload: () => void;
    onSubmit?: () => void;
    loading: boolean;
    showSubmitButton: boolean;
    showAssistant: boolean;
    setShowAssistant: (show: boolean) => void;
    isAiFeatureUnlocked: boolean;
    onReset?: () => void;
}

export function EditorToolbar({
    lang,
    onLangChange,
    showLangSelector = false,
    currentMode,
    handleModeChange,
    showModeSection,
    locked,
    violations,
    showInput,
    setShowInput,
    showInputToggle,
    onRun,
    onDownload,
    onSubmit,
    loading,
    showSubmitButton,
    showAssistant,
    setShowAssistant,
    isAiFeatureUnlocked,
    onReset,
}: EditorToolbarProps) {
    return (
        <div className="flex items-center justify-between bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-800/50 px-4 h-14 shrink-0 gap-4">
            {/* Left: Language & Mode */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                    {showLangSelector ? (
                        <>
                            <span className="text-sm font-medium text-gray-500 dark:text-gray-400 hidden sm:inline">Language:</span>
                            <Select value={lang} onValueChange={onLangChange} disabled={locked || loading}>
                                <SelectTrigger className="w-[110px] sm:w-[130px] h-8">
                                    <SelectValue placeholder="Language" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="python">Python</SelectItem>
                                    <SelectItem value="java">Java</SelectItem>
                                    <SelectItem value="c">C</SelectItem>
                                    <SelectItem value="cpp">C++</SelectItem>
                                </SelectContent>
                            </Select>
                        </>
                    ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-md bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-400 border border-indigo-200/50 dark:border-indigo-700/30">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                            {lang?.toUpperCase() || 'JAVA'}
                        </span>
                    )}
                </div>

                {/* Mode Selection */}
                {showModeSection && (
                    <div className="flex items-center gap-2">
                        <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-2 hidden sm:block" />
                        <span className="text-sm font-medium text-gray-500 dark:text-gray-400 hidden md:inline">Mode:</span>
                        <Select value={currentMode} onValueChange={handleModeChange} disabled={locked || loading}>
                            <SelectTrigger className="w-[110px] sm:w-[140px] h-8">
                                <SelectValue placeholder="Mode" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Static">Static Compiler</SelectItem>
                                <SelectItem value="Interactive">Interactive</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
                {/* Mobile Actions (< md) */}
                <div className="md:hidden flex items-center gap-2">
                    <Button
                        size="sm"
                        onClick={onRun}
                        disabled={locked || loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white h-8 w-8 p-0"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="w-4 h-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            {showInputToggle && (
                                <DropdownMenuItem onClick={() => setShowInput(!showInput)}>
                                    {showInput ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                                    {showInput ? "Hide Input" : "Show Input"}
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={onDownload} disabled={locked || loading}>
                                <Download className="w-4 h-4 mr-2" />
                                Export PDF
                            </DropdownMenuItem>
                            {showSubmitButton && onSubmit && (
                                <DropdownMenuItem onClick={onSubmit} disabled={locked || loading}>
                                    <Send className="w-4 h-4 mr-2" />
                                    Submit
                                </DropdownMenuItem>
                            )}
                            {onReset && (
                                <DropdownMenuItem onClick={onReset} disabled={locked || loading} className="text-red-600 focus:text-red-600">
                                    <RotateCcw className="w-4 h-4 mr-2" />
                                    Reset Code
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {isAiFeatureUnlocked && (
                        <Button
                            variant={showAssistant ? "secondary" : "ghost"}
                            size="sm"
                            onClick={() => setShowAssistant(!showAssistant)}
                            className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 h-8 w-8 p-0"
                        >
                            <Sparkles className="w-4 h-4" />
                        </Button>
                    )}
                </div>

                {/* Desktop Actions (>= md) */}
                <div className="hidden md:flex items-center gap-2">
                    {showInputToggle && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowInput(!showInput)}
                            className="text-sm h-8"
                        >
                            {showInput ? "Hide Input" : "Show Input"}
                        </Button>
                    )}

                    <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-1" />

                    <Button
                        size="sm"
                        onClick={onRun}
                        disabled={locked || loading}
                        className="bg-blue-600 hover:bg-blue-700 text-white h-8 px-4"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                        Run
                    </Button>

                    <Button
                        size="sm"
                        variant="outline"
                        onClick={onDownload}
                        disabled={locked || loading}
                        className="h-8"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        Export
                    </Button>

                    {onReset && (
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={onReset}
                            disabled={locked || loading}
                            className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/10 border-red-200 dark:border-red-900/30"
                        >
                            <RotateCcw className="w-4 h-4 mr-2" />
                            Reset
                        </Button>
                    )}

                    {showSubmitButton && onSubmit && (
                        <Button
                            size="sm"
                            onClick={onSubmit}
                            disabled={locked || loading}
                            className="bg-green-600 hover:bg-green-700 text-white h-8"
                        >
                            Submit
                        </Button>
                    )}

                    {isAiFeatureUnlocked && (
                        <>
                            <div className="h-4 w-px bg-gray-200 dark:bg-gray-700 mx-1" />
                            <Button
                                variant={showAssistant ? "secondary" : "ghost"}
                                size="sm"
                                onClick={() => setShowAssistant(!showAssistant)}
                                className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-900/20 h-8 px-3"
                            >
                                <Sparkles className="w-4 h-4 mr-2" />
                                AI Assistant
                            </Button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
