import React, { useState, useEffect, useRef } from "react";
import {
  File,
  FilePlus,
  Trash2,
  FolderOpen,
  ChevronDown,
  FileCode2,
  Edit2,
  Upload,
  Search,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

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
  if (fileName.endsWith(".py")) return "text-yellow-500";
  if (
    fileName.endsWith(".js") ||
    fileName.endsWith(".jsx") ||
    fileName.endsWith(".ts") ||
    fileName.endsWith(".tsx")
  )
    return "text-blue-400";
  if (fileName.endsWith(".java")) return "text-orange-500";
  if (fileName.endsWith(".c") || fileName.endsWith(".cpp"))
    return "text-blue-600";
  if (fileName.endsWith(".html")) return "text-orange-600";
  if (fileName.endsWith(".css")) return "text-blue-500";
  return "text-gray-400";
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
  const [newFileName, setNewFileName] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    fileName: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const handleFileRead = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onFileUpload) return;

    if (file.name.endsWith(".xlsx") || file.name.endsWith(".xls")) {
      try {
        const XLSX = await import("xlsx");
        const reader = new FileReader();
        reader.onload = (e) => {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const csv = XLSX.utils.sheet_to_csv(worksheet);

          const newName = file.name.replace(/\.[^/.]+$/, "") + ".csv";
          onFileUpload(newName, csv);
          if (fileInputRef.current) fileInputRef.current.value = "";
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
        if (fileInputRef.current) fileInputRef.current.value = "";
      };
      reader.readAsText(file);
    }
  };

  // Rename states
  const [editingFile, setEditingFile] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
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
      setNewFileName("");
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

  const handleDownload = (fileName: string) => {
    const file = files.find((f) => f.name === fileName);
    if (!file) return;
    const blob = new Blob([file.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleContextMenu = (e: React.MouseEvent, fileName: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, fileName });
  };

  const handleKeyDown = (e: React.KeyboardEvent, fileName: string) => {
    if (e.key === "F2") {
      // We can't easily Trigger startRenaming from here without the mouse event,
      // but we can set state directly
      if (onFileRename) {
        setEditingFile(fileName);
        setEditName(fileName);
      }
    } else if (e.key === "Delete") {
      if (files.length > 1) {
        onFileDelete(fileName);
      }
    }
  };

  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <>
      {/* Desktop: Sidebar */}
      <div
        className={`hidden md:flex flex-col h-full backdrop-blur-md bg-white/40 dark:bg-gray-900/40 border-r border-white/20 dark:border-gray-800/50 transition-all duration-300 ease-in-out ${isCollapsed ? "w-12" : "w-56"} ${className}`}
      >
        <div className="p-2 border-b border-white/20 dark:border-gray-800/50 flex items-center justify-between h-12">
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
            {isCollapsed ? (
              <FolderOpen size={16} />
            ) : (
              <ChevronDown size={16} className="rotate-90" />
            )}
          </Button>
        </div>

        {!isCollapsed && (
          <>
            <div className="px-2 py-2 flex flex-col gap-2">
              <div className="flex gap-1">
                <div className="relative flex-1">
                  <Search
                    size={12}
                    className="absolute left-2 top-2 text-gray-500"
                  />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-7 text-xs bg-white/50 dark:bg-gray-800/50 border-white/20 dark:border-gray-700 focus-visible:ring-1 focus-visible:ring-blue-500"
                  />
                </div>
                {onFileUpload && (
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 bg-white/50 dark:bg-gray-800/50 border-white/20 dark:border-gray-700"
                    onClick={() => fileInputRef.current?.click()}
                    title="Upload File"
                  >
                    <Upload size={14} />
                  </Button>
                )}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start h-8 text-xs bg-white/50 dark:bg-gray-800/50 border-white/20 dark:border-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                onClick={() => setIsCreating(true)}
              >
                <FilePlus size={14} className="mr-2" />
                New File
              </Button>

              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileRead}
              />
            </div>

            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {filteredFiles.map((file) => (
                  <div
                    key={file.name}
                    className={`group flex items-center justify-between px-3 py-2 rounded-md text-sm cursor-pointer transition-all duration-200 border border-transparent ${
                      activeFile === file.name
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-200/50 dark:border-blue-800/50 font-medium"
                        : "hover:bg-white/40 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300"
                    }`}
                    onClick={() => onFileSelect(file.name)}
                    onDoubleClick={(e) => startRenaming(e, file.name)}
                    onContextMenu={(e) => handleContextMenu(e, file.name)}
                    onKeyDown={(e) => handleKeyDown(e, file.name)}
                    tabIndex={0}
                  >
                    {editingFile === file.name ? (
                      <form
                        onSubmit={handleRenameSubmit}
                        className="flex-1 flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <FileCode2
                          size={14}
                          className={getFileIconColor(file.name)}
                        />
                        <Input
                          ref={renameInputRef}
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onBlur={handleRenameSubmit}
                          className="h-6 text-xs px-1 py-0 bg-white dark:bg-gray-800"
                        />
                      </form>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 overflow-hidden flex-1">
                          <FileCode2
                            size={14}
                            className={`shrink-0 ${getFileIconColor(file.name)}`}
                          />
                          <span className="truncate">{file.name}</span>
                        </div>

                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-gray-400 hover:text-blue-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(file.name);
                            }}
                            title="Download"
                          >
                            <Download size={12} />
                          </Button>
                          {onFileRename && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-gray-400 hover:text-blue-600"
                              onClick={(e) => startRenaming(e, file.name)}
                              title="Rename"
                            >
                              <Edit2 size={12} />
                            </Button>
                          )}
                          {files.length > 1 && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-gray-400 hover:text-red-500 hover:bg-red-100/50 dark:hover:bg-red-900/20"
                              onClick={(e) => {
                                e.stopPropagation();
                                onFileDelete(file.name);
                              }}
                              title="Delete"
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
                    className={`flex items-center justify-between px-4 py-3 rounded-lg cursor-pointer transition-colors ${
                      activeFile === file.name
                        ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                        : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
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
                  <form
                    onSubmit={(e) => {
                      handleCreateSubmit(e);
                      setMobileOpen(false);
                    }}
                    className="px-2"
                  >
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

      {/* Context Menu Portal */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 w-40 animate-in fade-in zoom-in-95 duration-100"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            onClick={() => {
              if (contextMenu) {
                handleDownload(contextMenu.fileName);
                setContextMenu(null);
              }
            }}
          >
            <Download size={14} /> Download
          </button>
          {onFileRename && (
            <button
              className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
              onClick={() => {
                if (contextMenu) {
                  setEditingFile(contextMenu.fileName);
                  setEditName(contextMenu.fileName);
                  setContextMenu(null);
                }
              }}
            >
              <Edit2 size={14} /> Rename
            </button>
          )}
          {files.length > 1 && (
            <button
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
              onClick={() => {
                if (contextMenu) {
                  onFileDelete(contextMenu.fileName);
                  setContextMenu(null);
                }
              }}
            >
              <Trash2 size={14} /> Delete
            </button>
          )}
        </div>
      )}
    </>
  );
}
