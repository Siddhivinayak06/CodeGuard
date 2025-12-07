import React, { useState, useEffect, useRef } from 'react';
import { File, FilePlus, Trash2, FolderOpen, ChevronDown, FileCode2, Edit2, Upload } from 'lucide-react';
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
    onFileRename?: (oldName: string, newName: string) => void;
    onFileUpload?: (fileName: string, content: string) => void;
    className?: string;
}

const getFileIconColor = (fileName: string) => {
    if (fileName.endsWith('.py')) return 'text-yellow-500';
    if (fileName.endsWith('.js') || fileName.endsWith('.jsx') || fileName.endsWith('.ts') || fileName.endsWith('.tsx')) return 'text-blue-400';
    if (fileName.endsWith('.java')) return 'text-orange-500';
    if (fileName.endsWith('.c') || fileName.endsWith('.cpp')) return 'text-blue-600';
    if (fileName.endsWith('.html')) return 'text-orange-600';
    if (fileName.endsWith('.css')) return 'text-blue-500';
    return 'text-gray-400';
};

export function FileExplorer({
    files,
    activeFile,
    onFileSelect,
    onFileCreate,
    onFileDelete,
    onFileRename,
    onFileUpload,
    className,
}: FileExplorerProps) {
    const [isCreating, setIsCreating] = useState(false);
    const [newFileName, setNewFileName] = useState('');
    const [mobileOpen, setMobileOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileRead = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !onFileUpload) return;

        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            try {
                const XLSX = await import("xlsx");
                const reader = new FileReader();
                reader.onload = (e) => {
                    const data = new Uint8Array(e.target?.result as ArrayBuffer);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const csv = XLSX.utils.sheet_to_csv(worksheet);

                    const newName = file.name.replace(/\.[^/.]+$/, "") + ".csv";
                    onFileUpload(newName, csv);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                };
                reader.readAsArrayBuffer(file);
            } catch (err) {
                console.error("Error parsing Excel file:", err);
                alert("Failed to parse Excel file.");
            }
        } else {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target?.result as string;
                onFileUpload(file.name, content);
                if (fileInputRef.current) fileInputRef.current.value = '';
            };
            reader.readAsText(file);
        }
    };

    // Rename states
    const [editingFile, setEditingFile] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const renameInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editingFile && renameInputRef.current) {
            renameInputRef.current.focus();
        }
    }, [editingFile]);

    const handleCreateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newFileName.trim()) {
            onFileCreate(newFileName.trim());
            setNewFileName('');
            setIsCreating(false);
        }
    };

    const startRenaming = (e: React.MouseEvent, fileName: string) => {
        e.stopPropagation();
        if (onFileRename) {
            setEditingFile(fileName);
            setEditName(fileName);
        }
    };

    const handleRenameSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (editingFile && editName.trim() && editName !== editingFile) {
            onFileRename?.(editingFile, editName.trim());
        }
        setEditingFile(null);
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
                        <div className="px-2 py-2 flex gap-1">
                            <Button
                                variant="outline"
                                size="sm"
                                className="flex-1 justify-start h-8 text-xs bg-white dark:bg-gray-800"
                                onClick={() => setIsCreating(true)}
                            >
                                <FilePlus size={14} className="mr-2" />
                                New File
                            </Button>
                            {onFileUpload && (
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 bg-white dark:bg-gray-800"
                                    onClick={() => fileInputRef.current?.click()}
                                    title="Upload File"
                                >
                                    <Upload size={14} />
                                </Button>
                            )}
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileRead}
                            />
                        </div>

                        <ScrollArea className="flex-1">
                            <div className="p-2 space-y-1">
                                {files.map((file) => (
                                    <div
                                        key={file.name}
                                        className={`group flex items-center justify-between px-3 py-2 rounded-md text-sm cursor-pointer transition-colors ${activeFile === file.name
                                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                            : 'hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'
                                            }`}
                                        onClick={() => onFileSelect(file.name)}
                                        onDoubleClick={(e) => startRenaming(e, file.name)}
                                    >
                                        {editingFile === file.name ? (
                                            <form onSubmit={handleRenameSubmit} className="flex-1 flex items-center gap-1" onClick={e => e.stopPropagation()}>
                                                <FileCode2 size={14} className={getFileIconColor(file.name)} />
                                                <Input
                                                    ref={renameInputRef}
                                                    value={editName}
                                                    onChange={(e) => setEditName(e.target.value)}
                                                    onBlur={handleRenameSubmit}
                                                    className="h-6 text-xs px-1 py-0"
                                                />
                                            </form>
                                        ) : (
                                            <>
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <FileCode2 size={14} className={`shrink-0 ${getFileIconColor(file.name)}`} />
                                                    <span className="truncate">{file.name}</span>
                                                </div>

                                                <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-1">
                                                    {onFileRename && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-gray-500 hover:text-blue-600"
                                                            onClick={(e) => startRenaming(e, file.name)}
                                                        >
                                                            <Edit2 size={12} />
                                                        </Button>
                                                    )}
                                                    {files.length > 1 && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onFileDelete(file.name);
                                                            }}
                                                        >
                                                            <Trash2 size={12} />
                                                        </Button>
                                                    )}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ))}

                                {isCreating && (
                                    <form onSubmit={handleCreateSubmit} className="px-2 py-1">
                                        <div className="flex items-center gap-2">
                                            <FileCode2 size={14} className="text-gray-400" />
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
                    {/* ... Mobile content similar update ... */}

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
