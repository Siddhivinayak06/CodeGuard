"use client";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Select, SelectContent, SelectItem,
    SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { ChevronDown, Sparkles, Play, Download, Send, Lock, AlertTriangle, Eye, EyeOff, MoreVertical, Loader2 } from "lucide-react";
import { ModeToggle } from "@/components/ModeToggle";
import { SettingsDialog } from "@/components/SettingsDialog";

interface EditorToolbarProps {
    lang: string;
    onLangChange: (lang: string) => void;
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
}

export function EditorToolbar({
    lang,
    onLangChange,
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
}: EditorToolbarProps) {
    return (
        <div className="flex items-center justify-between bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 h-14 shrink-0 gap-4">
            {/* Left: Language & Mode */}
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
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
