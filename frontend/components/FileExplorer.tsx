import React, { useState } from 'react';
import { File, FilePlus, Trash2, FolderOpen, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

export interface FileData {
    name: string;
    content: string;
    language: string;
}

interface FileExplorerProps {
    files: FileData[];
    activeFile: string;
    onFileSelect: (fileName: string) => void;
    onFileCreate: (fileName: string) => void;
    onFileDelete: (fileName: string) => void;
    className?: string;
}

export function FileExplorer({
    files,
    activeFile,
    onFileSelect,
    onFileCreate,
    onFileDelete,
    className,
}: FileExplorerProps) {
    const [isCreating, setIsCreating] = useState(false);
    const [newFileName, setNewFileName] = useState('');
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newFileName.trim()) {
            onFileCreate(newFileName.trim());
            setNewFileName('');
            setIsCreating(false);
        }
    };

    const [isCollapsed, setIsCollapsed] = useState(false);

    return (
        <>
            {/* Desktop: Sidebar */}
            <div className={`hidden md:flex flex-col h-full bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 ease-in-out ${isCollapsed ? 'w-12' : 'w-48'} ${className}`}>
                <div className="p-2 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between h-12">
                    {!isCollapsed && (
                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-200 px-2">
                            <FolderOpen size={16} />
                            <span>Files</span>
                        </div>
                    )}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 ml-auto"
                        onClick={() => setIsCollapsed(!isCollapsed)}
                        title={isCollapsed ? "Expand" : "Collapse"}
                    >
                        {isCollapsed ? <FolderOpen size={16} /> : <ChevronDown size={16} className="rotate-90" />}
                    </Button>
                </div>

                {!isCollapsed && (
                    <>
                        <div className="px-2 py-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full justify-start h-8 text-xs"
                                onClick={() => setIsCreating(true)}
                            >
                                <FilePlus size={14} className="mr-2" />
                                New File
                            </Button>
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="p-2 space-y-1">
                                {files.map((file) => (
                                    <div
                                        key={file.name}
                                        className={`group flex items-center justify-between px-3 py-2 rounded-md text-sm cursor-pointer transition-colors ${activeFile === file.name
                                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                            : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                                            }`}
                                        onClick={() => onFileSelect(file.name)}
                                    >
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <File size={14} className="shrink-0" />
                                            <span className="truncate">{file.name}</span>
                                        </div>

                                        {files.length > 1 && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onFileDelete(file.name);
                                                }}
                                            >
                                                <Trash2 size={14} />
                                            </Button>
                                        )}
                                    </div>
                                ))}

                                {isCreating && (
                                    <form onSubmit={handleCreateSubmit} className="px-2 py-1">
                                        <div className="flex items-center gap-2">
                                            <File size={14} className="text-gray-400" />
                                            <Input
                                                autoFocus
                                                value={newFileName}
                                                onChange={(e) => setNewFileName(e.target.value)}
                                                onBlur={() => setIsCreating(false)}
                                                placeholder="filename.py"
                                                className="h-7 text-xs"
                                            />
                                        </div>
                                    </form>
                                )}
                            </div>
                        </ScrollArea>
                    </>
                )}
            </div>

            {/* Mobile: Bottom Sheet */}
            <div className="md:hidden">
                <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                    <SheetTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="flex items-center gap-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800"
                        >
                            <FolderOpen size={16} />
                            <span className="text-xs">{activeFile}</span>
                            <ChevronDown size={14} />
                        </Button>
                    </SheetTrigger>
                    <SheetContent side="bottom" className="h-[50vh]">
                        <SheetHeader>
                            <SheetTitle className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <FolderOpen size={16} />
                                    <span>Files</span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsCreating(true)}
                                    className="h-8"
                                >
                                    <FilePlus size={16} className="mr-2" />
                                    New File
                                </Button>
                            </SheetTitle>
                        </SheetHeader>

                        <ScrollArea className="h-full mt-4">
                            <div className="space-y-2">
                                {files.map((file) => (
                                    <div
                                        key={file.name}
                                        className={`flex items-center justify-between px-4 py-3 rounded-lg cursor-pointer transition-colors ${activeFile === file.name
                                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                            : 'hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                                            }`}
                                        onClick={() => {
                                            onFileSelect(file.name);
                                            setMobileOpen(false);
                                        }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <File size={18} />
                                            <span className="font-medium">{file.name}</span>
                                        </div>

                                        {files.length > 1 && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onFileDelete(file.name);
                                                }}
                                            >
                                                <Trash2 size={16} />
                                            </Button>
                                        )}
                                    </div>
                                ))}

                                {isCreating && (
                                    <form onSubmit={(e) => { handleCreateSubmit(e); setMobileOpen(false); }} className="px-2">
                                        <div className="flex items-center gap-2">
                                            <File size={18} className="text-gray-400" />
                                            <Input
                                                autoFocus
                                                value={newFileName}
                                                onChange={(e) => setNewFileName(e.target.value)}
                                                onBlur={() => setIsCreating(false)}
                                                placeholder="filename.py"
                                                className="h-10"
                                            />
                                        </div>
                                    </form>
                                )}
                            </div>
                        </ScrollArea>
                    </SheetContent>
                </Sheet>
            </div>
        </>
    );
}
