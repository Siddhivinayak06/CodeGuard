import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  File,
  FilePlus,
  FolderPlus,
  Trash2,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  FileCode2,
  Edit2,
  Upload,
  Search,
  Download,
  RefreshCw,
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

const ALLOWED_EXTENSIONS = [".py", ".java", ".c", ".cpp", ".csv", ".xlsx", ".xls"];
const ALLOWED_ACCEPT = ALLOWED_EXTENSIONS.join(",");

const isAllowedFile = (fileName: string) =>
  ALLOWED_EXTENSIONS.some((ext) => fileName.toLowerCase().endsWith(ext));

const getFileIconColor = (fileName: string) => {
  if (fileName.endsWith(".py")) return "text-muted-foreground";
  if (fileName.endsWith(".java")) return "text-muted-foreground";
  if (fileName.endsWith(".c") || fileName.endsWith(".cpp"))
    return "text-muted-foreground";
  if (fileName.endsWith(".csv")) return "text-muted-foreground";
  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls"))
    return "text-muted-foreground";
  return "text-muted-foreground";
};

const normalizePath = (value: string) =>
  String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "")
    .replace(/\/+/g, "/");

const getParentFolders = (fileName: string) => {
  const normalized = normalizePath(fileName);
  const parts = normalized.split("/");
  const folders: string[] = [];

  if (parts.length <= 1) {
    return folders;
  }

  for (let i = 1; i < parts.length; i++) {
    folders.push(parts.slice(0, i).join("/"));
  }

  return folders;
};

type ExplorerTreeNode = {
  type: "folder" | "file";
  name: string;
  path: string;
  children: ExplorerTreeNode[];
  file?: FileData;
};

type ContextMenuTargetType = "workspace" | "folder" | "file";

type ContextMenuState = {
  x: number;
  y: number;
  targetType: ContextMenuTargetType;
  path: string;
};

const createFolderNode = (name: string, path: string): ExplorerTreeNode => ({
  type: "folder",
  name,
  path,
  children: [],
});

const createFileNode = (file: FileData): ExplorerTreeNode => {
  const normalized = normalizePath(file.name);
  const parts = normalized.split("/");
  return {
    type: "file",
    name: parts[parts.length - 1] || normalized,
    path: normalized,
    children: [],
    file,
  };
};

const findOrCreateFolder = (
  roots: ExplorerTreeNode[],
  folderPath: string,
): ExplorerTreeNode => {
  const normalized = normalizePath(folderPath);
  if (!normalized) {
    return createFolderNode("", "");
  }

  const segments = normalized.split("/");
  let currentChildren = roots;
  let currentPath = "";
  let currentNode: ExplorerTreeNode | null = null;

  for (const segment of segments) {
    currentPath = currentPath ? `${currentPath}/${segment}` : segment;
    let found = currentChildren.find(
      (node) => node.type === "folder" && node.path === currentPath,
    );

    if (!found) {
      found = createFolderNode(segment, currentPath);
      currentChildren.push(found);
    }

    currentNode = found;
    currentChildren = found.children;
  }

  return currentNode || createFolderNode("", "");
};

const sortTreeNodes = (nodes: ExplorerTreeNode[]): ExplorerTreeNode[] => {
  const sorted = [...nodes].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "folder" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return sorted.map((node) =>
    node.type === "folder"
      ? { ...node, children: sortTreeNodes(node.children) }
      : node,
  );
};

const buildExplorerTree = (
  files: FileData[],
  folders: string[],
): ExplorerTreeNode[] => {
  const roots: ExplorerTreeNode[] = [];

  folders
    .map(normalizePath)
    .filter(Boolean)
    .forEach((folderPath) => {
      findOrCreateFolder(roots, folderPath);
    });

  files.forEach((file) => {
    const normalized = normalizePath(file.name);
    const parts = normalized.split("/");
    const fileName = parts.pop();
    const folderPath = parts.join("/");

    if (!fileName) {
      return;
    }

    if (folderPath) {
      const folderNode = findOrCreateFolder(roots, folderPath);
      const hasFileAlready = folderNode.children.some(
        (child) => child.type === "file" && child.path === normalized,
      );
      if (!hasFileAlready) {
        folderNode.children.push(createFileNode(file));
      }
      return;
    }

    if (!roots.some((node) => node.type === "file" && node.path === normalized)) {
      roots.push(createFileNode(file));
    }
  });

  return sortTreeNodes(roots);
};

const filterTreeByQuery = (
  nodes: ExplorerTreeNode[],
  query: string,
): ExplorerTreeNode[] => {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return nodes;
  }

  const filterNode = (node: ExplorerTreeNode): ExplorerTreeNode | null => {
    const selfMatches = node.name.toLowerCase().includes(normalizedQuery);

    if (node.type === "file") {
      return selfMatches ? node : null;
    }

    const filteredChildren = node.children
      .map(filterNode)
      .filter(Boolean) as ExplorerTreeNode[];

    if (selfMatches) {
      return { ...node, children: node.children };
    }

    if (filteredChildren.length > 0) {
      return { ...node, children: filteredChildren };
    }

    return null;
  };

  return nodes.map(filterNode).filter(Boolean) as ExplorerTreeNode[];
};

const collectFolderPaths = (nodes: ExplorerTreeNode[]): string[] => {
  const paths: string[] = [];

  const walk = (list: ExplorerTreeNode[]) => {
    list.forEach((node) => {
      if (node.type === "folder") {
        paths.push(node.path);
        walk(node.children);
      }
    });
  };

  walk(nodes);
  return paths;
};

const getParentPath = (value: string) => {
  const normalized = normalizePath(value);
  if (!normalized.includes("/")) {
    return "";
  }
  return normalized.split("/").slice(0, -1).join("/");
};

const getFolderHierarchy = (folderPath: string) => {
  const normalized = normalizePath(folderPath);
  if (!normalized) {
    return [] as string[];
  }

  const parts = normalized.split("/");
  return parts.map((_, idx) => parts.slice(0, idx + 1).join("/"));
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
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [customFolders, setCustomFolders] = useState<string[]>([]);
  const [selectedFolder, setSelectedFolder] = useState("");
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    () => new Set([""]),
  );
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  const allFolders = useMemo(() => {
    const derived = files.flatMap((file) => getParentFolders(file.name));
    const merged = [...derived, ...customFolders].map(normalizePath).filter(Boolean);
    return Array.from(new Set(merged)).sort((a, b) => a.localeCompare(b));
  }, [files, customFolders]);

  const ensureFolderHierarchy = (folderPath: string) => {
    const hierarchy = getFolderHierarchy(folderPath);
    if (hierarchy.length === 0) {
      return;
    }

    setCustomFolders((prev) => {
      const merged = [...prev, ...hierarchy].map(normalizePath).filter(Boolean);
      return Array.from(new Set(merged)).sort((a, b) => a.localeCompare(b));
    });
  };

  const expandFolderHierarchy = (folderPath: string) => {
    const hierarchy = getFolderHierarchy(folderPath);
    if (hierarchy.length === 0) {
      return;
    }

    setExpandedFolders((prev) => {
      const next = new Set(prev);
      hierarchy.forEach((folder) => next.add(folder));
      return next;
    });
  };

  const resolveContextFolderPath = (menu: ContextMenuState | null) => {
    if (!menu) {
      return "";
    }

    if (menu.targetType === "folder") {
      return normalizePath(menu.path);
    }

    if (menu.targetType === "file") {
      return getParentPath(menu.path);
    }

    return "";
  };

  const openCreateFileAt = (folderPath = "") => {
    const normalizedFolder = normalizePath(folderPath);
    if (normalizedFolder) {
      ensureFolderHierarchy(normalizedFolder);
      expandFolderHierarchy(normalizedFolder);
    }

    setSelectedFolder(normalizedFolder);
    setIsCreating(true);
    setIsCreatingFolder(false);
    setNewFileName("");
    setError(null);
  };

  const openCreateFolderAt = (folderPath = "") => {
    const normalizedFolder = normalizePath(folderPath);
    if (normalizedFolder) {
      ensureFolderHierarchy(normalizedFolder);
      expandFolderHierarchy(normalizedFolder);
    }

    setSelectedFolder(normalizedFolder);
    setIsCreatingFolder(true);
    setIsCreating(false);
    setNewFolderName("");
    setError(null);
  };

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const handleFileRead = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onFileUpload) return;

    if (!isAllowedFile(file.name)) {
      setError("Only .py, .java, .c, .cpp, .csv, .xlsx, .xls files are allowed!");
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => setError(null), 3000);
      return;
    }

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
        setError("Failed to parse Excel file.");
        setTimeout(() => setError(null), 3000);
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
  const [editingParentFolder, setEditingParentFolder] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  const fileTree = useMemo(
    () => buildExplorerTree(files, allFolders),
    [files, allFolders],
  );

  const visibleTree = useMemo(
    () => filterTreeByQuery(fileTree, searchQuery),
    [fileTree, searchQuery],
  );

  useEffect(() => {
    const parents = getParentFolders(activeFile);
    if (parents.length === 0) {
      return;
    }

    setExpandedFolders((prev) => {
      const next = new Set(prev);
      parents.forEach((folder) => next.add(folder));
      return next;
    });
  }, [activeFile]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      return;
    }

    const foldersInResults = collectFolderPaths(visibleTree);
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      foldersInResults.forEach((folder) => next.add(folder));
      return next;
    });
  }, [searchQuery, visibleTree]);

  useEffect(() => {
    if (editingFile && renameInputRef.current) {
      renameInputRef.current.focus();
    }
  }, [editingFile]);

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawName = newFileName.trim();
    if (rawName) {
      let name = normalizePath(rawName);
      if (selectedFolder && !name.includes("/")) {
        name = `${selectedFolder}/${name}`;
      }

      if (!isAllowedFile(name)) {
        setError("Only .py, .java, .c, .cpp, .csv, .xlsx, .xls files are allowed!");
        return;
      }
      if (files.some((f) => f.name === name)) {
        setError("File with this name already exists!");
        return;
      }

      const parentPath = getParentPath(name);
      if (parentPath) {
        ensureFolderHierarchy(parentPath);
        expandFolderHierarchy(parentPath);
      }

      onFileCreate(name);
      setExpandedFolders((prev) => {
        const next = new Set(prev);
        getParentFolders(name).forEach((parent) => next.add(parent));
        if (selectedFolder) {
          next.add(selectedFolder);
        }
        return next;
      });
      setNewFileName("");
      setError(null);
      setIsCreating(false);
    }
  };

  const handleCreateFolderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const rawFolder = normalizePath(newFolderName);
    const folder =
      selectedFolder && rawFolder && !rawFolder.includes("/")
        ? `${selectedFolder}/${rawFolder}`
        : rawFolder;

    if (!folder) {
      return;
    }

    if (allFolders.includes(folder)) {
      setError("Folder with this name already exists!");
      return;
    }

    ensureFolderHierarchy(folder);
    setSelectedFolder(folder);
    expandFolderHierarchy(folder);
    setNewFolderName("");
    setError(null);
    setIsCreatingFolder(false);
  };

  const openRenameForPath = (filePath: string) => {
    if (!onFileRename) {
      return;
    }

    const normalized = normalizePath(filePath);
    const parts = normalized.split("/");
    const baseName = parts.pop() || normalized;
    setEditingFile(normalized);
    setEditingParentFolder(parts.join("/"));
    setEditName(baseName);
  };

  const startRenaming = (e: React.MouseEvent, fileName: string) => {
    e.stopPropagation();
    openRenameForPath(fileName);
  };

  const handleRenameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const typedName = normalizePath(editName.trim());
    if (editingFile && typedName) {
      const nextPath =
        typedName.includes("/") || !editingParentFolder
          ? typedName
          : `${editingParentFolder}/${typedName}`;

      if (nextPath === editingFile) {
        setEditingFile(null);
        setEditingParentFolder("");
        setError(null);
        return;
      }

      if (files.some((f) => normalizePath(f.name) === nextPath)) {
        setError("File with this name already exists!");
        return;
      }

      const nextParentPath = getParentPath(nextPath);
      if (nextParentPath) {
        ensureFolderHierarchy(nextParentPath);
        expandFolderHierarchy(nextParentPath);
      }

      onFileRename?.(editingFile, nextPath);
    }
    setEditingFile(null);
    setEditingParentFolder("");
    setError(null);
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

  const handleContextMenu = (
    e: React.MouseEvent,
    targetType: ContextMenuTargetType,
    path = "",
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      targetType,
      path: normalizePath(path),
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent, fileName: string) => {
    if (e.key === "F2") {
      // We can't easily Trigger startRenaming from here without the mouse event,
      // but we can set state directly
      openRenameForPath(fileName);
    } else if (e.key === "Delete") {
      if (files.length > 1) {
        onFileDelete(fileName);
      }
    }
  };

  const mobileVisibleFiles = files
    .filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    .filter((f) => {
      if (!selectedFolder) {
        return true;
      }
      const normalized = normalizePath(f.name);
      return normalized.startsWith(`${selectedFolder}/`);
    });

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isWorkspaceExpanded, setIsWorkspaceExpanded] = useState(true);
  const workspaceName = "CODEGUARD";
  const normalizedActiveFile = normalizePath(activeFile);

  const explorerActionButtonClass =
    "h-7 w-7 text-muted-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent";

  const handleRefreshExplorer = () => {
    setSearchQuery("");
    setError(null);
  };

  const handleCollapseAll = () => {
    setExpandedFolders(new Set());
    setSelectedFolder("");
  };

  const toggleFolderExpansion = (folderPath: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(folderPath)) {
        next.delete(folderPath);
      } else {
        next.add(folderPath);
      }
      return next;
    });
  };

  const contextFolderPath = resolveContextFolderPath(contextMenu);
  const contextFilePath =
    contextMenu?.targetType === "file" ? normalizePath(contextMenu.path) : "";
  const canRenameContextFile = Boolean(onFileRename && contextFilePath);

  const renderTreeNodes = (nodes: ExplorerTreeNode[], depth = 0): React.ReactNode => {
    return nodes.map((node) => {
      if (node.type === "folder") {
        const isExpanded = expandedFolders.has(node.path);
        const isSelected = selectedFolder === node.path;
        const leftPad = 8 + depth * 14;

        return (
          <div key={`folder-${node.path}`}>
            <button
              className={`w-full flex items-center gap-1 rounded-md py-1.5 pr-2 text-xs transition-colors ${
                isSelected
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
              style={{ paddingLeft: `${leftPad}px` }}
              onClick={() => {
                setSelectedFolder(node.path);
                toggleFolderExpansion(node.path);
              }}
              onContextMenu={(e) => handleContextMenu(e, "folder", node.path)}
              title={node.path}
            >
              <ChevronRight
                size={12}
                className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : ""}`}
              />
              {isExpanded ? (
                <FolderOpen size={14} className="text-muted-foreground" />
              ) : (
                <Folder size={14} className="text-muted-foreground" />
              )}
              <span className="truncate text-left flex-1">{node.name}</span>
              <span className="text-[10px] text-muted-foreground">
                {node.children.length}
              </span>
            </button>

            {isExpanded && node.children.length > 0 && (
              <div>{renderTreeNodes(node.children, depth + 1)}</div>
            )}
          </div>
        );
      }

      const isActive = normalizedActiveFile === node.path;
      const leftPad = 24 + depth * 14;
      const fileName = node.name;

      if (editingFile === node.path) {
        return (
          <form
            key={`file-edit-${node.path}`}
            onSubmit={handleRenameSubmit}
            className="relative py-1"
            style={{ paddingLeft: `${leftPad}px`, paddingRight: "8px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <FileCode2
                size={14}
                className={`shrink-0 ${getFileIconColor(fileName)}`}
              />
              <Input
                ref={renameInputRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleRenameSubmit}
                className="h-7 text-xs px-2 py-0 bg-background border-border text-foreground"
              />
            </div>
            {error && (
              <div className="absolute left-0 -bottom-7 w-full px-2 py-1 bg-red-500 text-white text-[10px] rounded shadow-lg z-50">
                {error}
              </div>
            )}
          </form>
        );
      }

      return (
        <div
          key={`file-${node.path}`}
          className={`group flex items-center justify-between rounded-sm py-1.5 pr-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring ${
            isActive
              ? "bg-sidebar-accent text-sidebar-accent-foreground border-y border-r border-l-2 border-border/70 border-l-sidebar-primary"
              : "text-foreground/85 hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground border border-transparent"
          }`}
          style={{ paddingLeft: `${leftPad}px` }}
          onClick={() => onFileSelect(node.path)}
          onDoubleClick={(e) => startRenaming(e, node.path)}
          onContextMenu={(e) => handleContextMenu(e, "file", node.path)}
          onKeyDown={(e) => handleKeyDown(e, node.path)}
          tabIndex={0}
          title={node.path}
        >
          <div className="flex items-center gap-2 overflow-hidden flex-1">
            <FileCode2
              size={14}
              className={`shrink-0 ${getFileIconColor(fileName)}`}
            />
            <span className="truncate">{fileName}</span>
          </div>

          <div className="flex items-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity gap-0.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload(node.path);
              }}
              title="Download"
            >
              <Download size={12} />
            </Button>
            {onFileRename && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
                onClick={(e) => startRenaming(e, node.path)}
                title="Rename"
              >
                <Edit2 size={12} />
              </Button>
            )}
            {files.length > 1 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={(e) => {
                  e.stopPropagation();
                  onFileDelete(node.path);
                }}
                title="Delete"
              >
                <Trash2 size={12} />
              </Button>
            )}
          </div>
        </div>
      );
    });
  };

  return (
    <>
      {/* Desktop: Sidebar */}
      <div
        className={`hidden md:flex flex-col h-full bg-background text-foreground border-r border-border transition-all duration-200 ${isCollapsed ? "w-12" : "w-64"} ${className}`}
      >
        <div className="px-3 py-2 border-b border-border flex items-center justify-between">
          {!isCollapsed && (
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Explorer
            </span>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 ml-auto text-muted-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? "Expand" : "Collapse"}
          >
            {isCollapsed ? (
              <ChevronRight size={14} />
            ) : (
              <ChevronDown size={14} className="rotate-90" />
            )}
          </Button>
        </div>

        {!isCollapsed && (
          <>
            <div className="px-2 py-2 space-y-2 border-b border-border">
              <div className="flex items-center justify-between gap-1">
                <button
                  className={`flex items-center gap-1.5 px-1 py-1 rounded text-[11px] font-semibold tracking-wide transition-colors ${
                    selectedFolder === ""
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  }`}
                  onClick={() => {
                    setSelectedFolder("");
                    setIsWorkspaceExpanded((prev) => !prev);
                  }}
                  onContextMenu={(e) => handleContextMenu(e, "workspace", "")}
                >
                  <ChevronRight
                    size={12}
                    className={`transition-transform ${isWorkspaceExpanded ? "rotate-90" : ""}`}
                  />
                  <span>{workspaceName}</span>
                </button>

                <div className="flex items-center gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={explorerActionButtonClass}
                    onClick={() => openCreateFileAt(selectedFolder)}
                    title="New File"
                  >
                    <FilePlus size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={explorerActionButtonClass}
                    onClick={() => openCreateFolderAt(selectedFolder)}
                    title="New Folder"
                  >
                    <FolderPlus size={14} />
                  </Button>
                  {onFileUpload && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className={explorerActionButtonClass}
                      onClick={() => fileInputRef.current?.click()}
                      title="Upload File"
                    >
                      <Upload size={14} />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className={explorerActionButtonClass}
                    onClick={handleRefreshExplorer}
                    title="Refresh"
                  >
                    <RefreshCw size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={explorerActionButtonClass}
                    onClick={handleCollapseAll}
                    title="Collapse All"
                  >
                    <ChevronDown size={14} />
                  </Button>
                </div>
              </div>

              <div className="relative">
                <Search
                  size={12}
                  className="absolute left-2 top-2 text-muted-foreground"
                />
                <Input
                  placeholder="Search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 pl-7 text-xs bg-background border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept={ALLOWED_ACCEPT}
                onChange={handleFileRead}
              />
            </div>

            <ScrollArea className="flex-1">
              <div
                className="p-1.5 space-y-1"
                onContextMenu={(e) => handleContextMenu(e, "workspace", "")}
              >

                {isCreatingFolder && (
                  <form onSubmit={handleCreateFolderSubmit} className="px-2 py-1">
                    <div className="flex items-center gap-2">
                      <FolderOpen size={14} className="text-muted-foreground" />
                      <Input
                        autoFocus
                        value={newFolderName}
                        onChange={(e) => {
                          setNewFolderName(e.target.value);
                          setError(null);
                        }}
                        onBlur={() => {
                          if (!error) setIsCreatingFolder(false);
                        }}
                        placeholder={
                          selectedFolder
                            ? `${selectedFolder}/new-folder`
                            : "folder/subfolder"
                        }
                        className={`h-7 text-xs bg-background border-border text-foreground placeholder:text-muted-foreground ${error ? "border-destructive focus-visible:ring-destructive" : "focus-visible:ring-ring"}`}
                      />
                    </div>
                    {error && (
                      <p className="mt-1 text-[10px] text-red-500 font-medium px-2 animate-in fade-in slide-in-from-top-1">
                        {error}
                      </p>
                    )}
                  </form>
                )}

                {isCreating && (
                  <form onSubmit={handleCreateSubmit} className="px-2 py-1">
                    <div className="flex items-center gap-2">
                      <FileCode2 size={14} className="text-muted-foreground" />
                      <Input
                        autoFocus
                        value={newFileName}
                        onChange={(e) => {
                          setNewFileName(e.target.value);
                          setError(null);
                        }}
                        onBlur={() => {
                          if (!error) setIsCreating(false);
                        }}
                        placeholder={
                          selectedFolder
                            ? `${selectedFolder}/Main.java`
                            : "filename.py"
                        }
                        className={`h-7 text-xs bg-background border-border text-foreground placeholder:text-muted-foreground ${error ? "border-destructive focus-visible:ring-destructive" : "focus-visible:ring-ring"}`}
                      />
                    </div>
                    {error && (
                      <p className="mt-1 text-[10px] text-red-500 font-medium px-2 animate-in fade-in slide-in-from-top-1">
                        {error}
                      </p>
                    )}
                  </form>
                )}

                <div className="space-y-0.5">
                  {isWorkspaceExpanded &&
                    (visibleTree.length > 0 ? (
                      <div>{renderTreeNodes(visibleTree)}</div>
                    ) : (
                      <div className="px-3 py-6 text-xs text-center text-muted-foreground">
                        No files match your search.
                      </div>
                    ))}
                </div>
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
              className="flex items-center gap-2 bg-background border-border text-foreground"
            >
              <FolderOpen size={16} />
              <span className="text-xs">{activeFile}</span>
              <ChevronDown size={14} />
            </Button>
          </SheetTrigger>
          {/* ... Mobile content similar update ... */}

          <SheetContent side="bottom" className="h-[50vh] bg-background border-border">
            <SheetHeader>
              <SheetTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-foreground">
                  <FolderOpen size={16} />
                  <span>Files</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openCreateFileAt(selectedFolder)}
                    className="h-8 text-foreground hover:bg-muted"
                  >
                    <FilePlus size={16} className="mr-2" />
                    New File
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openCreateFolderAt(selectedFolder)}
                    className="h-8 text-foreground hover:bg-muted"
                  >
                    <FolderPlus size={16} className="mr-2" />
                    Folder
                  </Button>
                </div>
              </SheetTitle>
            </SheetHeader>

            <ScrollArea className="h-full mt-4">
              <div className="space-y-2">
                {(allFolders.length > 0 || selectedFolder) && (
                  <div className="px-2 pb-2 border-b border-border space-y-1">
                    <button
                      className={`w-full text-left px-3 py-2 rounded-md text-xs ${
                        !selectedFolder
                          ? "bg-muted text-foreground"
                          : "text-foreground/85 hover:bg-muted hover:text-foreground"
                      }`}
                      onClick={() => setSelectedFolder("")}
                    >
                      All Files
                    </button>
                    {allFolders.map((folder) => (
                      <button
                        key={folder}
                        className={`w-full text-left px-3 py-2 rounded-md text-xs ${
                          selectedFolder === folder
                            ? "bg-muted text-foreground"
                            : "text-foreground/85 hover:bg-muted hover:text-foreground"
                        }`}
                        onClick={() => setSelectedFolder(folder)}
                      >
                        {folder}
                      </button>
                    ))}
                  </div>
                )}

                {mobileVisibleFiles.map((file) => (
                  <div
                    key={file.name}
                    className={`flex items-center justify-between px-4 py-3 rounded-lg cursor-pointer transition-colors ${activeFile === file.name
                      ? "bg-muted text-foreground border-l-2 border-l-primary"
                      : "hover:bg-muted hover:text-foreground text-foreground/85"
                      }`}
                    onClick={() => {
                      onFileSelect(file.name);
                      setMobileOpen(false);
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <File size={18} className="text-muted-foreground" />
                      <span className="font-medium">{normalizePath(file.name)}</span>
                    </div>

                    {files.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
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

                {isCreatingFolder && (
                  <form
                    onSubmit={handleCreateFolderSubmit}
                    className="px-2"
                  >
                    <div className="flex items-center gap-2">
                      <FolderOpen size={18} className="text-muted-foreground" />
                      <Input
                        autoFocus
                        value={newFolderName}
                        onChange={(e) => {
                          setNewFolderName(e.target.value);
                          setError(null);
                        }}
                        onBlur={() => {
                          if (!error) setIsCreatingFolder(false);
                        }}
                        placeholder={
                          selectedFolder
                            ? `${selectedFolder}/new-folder`
                            : "folder/subfolder"
                        }
                        className="h-10 bg-background border-border text-foreground"
                      />
                    </div>
                    {error && (
                      <p className="mt-1 text-[10px] text-red-500 font-medium px-2">
                        {error}
                      </p>
                    )}
                  </form>
                )}

                {isCreating && (
                  <form
                    onSubmit={(e) => {
                      handleCreateSubmit(e);
                      setMobileOpen(false);
                    }}
                    className="px-2"
                  >
                    <div className="flex items-center gap-2">
                      <File size={18} className="text-muted-foreground" />
                      <Input
                        autoFocus
                        value={newFileName}
                        onChange={(e) => {
                          setNewFileName(e.target.value);
                          setError(null);
                        }}
                        onBlur={() => setIsCreating(false)}
                        placeholder={
                          selectedFolder
                            ? `${selectedFolder}/Main.java`
                            : "filename.py"
                        }
                        className="h-10 bg-background border-border text-foreground"
                      />
                    </div>
                    {error && (
                      <p className="mt-1 text-[10px] text-red-500 font-medium px-2">
                        {error}
                      </p>
                    )}
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
          className="fixed z-50 bg-popover text-popover-foreground border border-border rounded-md shadow-md py-1 w-52"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-4 py-2 text-sm hover:bg-muted hover:text-foreground flex items-center gap-2"
            onClick={() => {
              openCreateFileAt(contextFolderPath);
              setContextMenu(null);
            }}
          >
            <FilePlus size={14} /> New File...
          </button>

          <button
            className="w-full text-left px-4 py-2 text-sm hover:bg-muted hover:text-foreground flex items-center gap-2"
            onClick={() => {
              openCreateFolderAt(contextFolderPath);
              setContextMenu(null);
            }}
          >
            <FolderPlus size={14} /> New Folder...
          </button>

          <div className="my-1 border-t border-border" />

          <button
            className="w-full text-left px-4 py-2 text-sm hover:bg-muted hover:text-foreground flex items-center gap-2"
            onClick={() => {
              handleRefreshExplorer();
              setContextMenu(null);
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>

          <button
            className="w-full text-left px-4 py-2 text-sm hover:bg-muted hover:text-foreground flex items-center gap-2"
            onClick={() => {
              handleCollapseAll();
              setContextMenu(null);
            }}
          >
            <ChevronDown size={14} /> Collapse All
          </button>

          {contextMenu.targetType === "file" && (
            <div className="my-1 border-t border-border" />
          )}

          {contextMenu.targetType === "file" && (
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-muted hover:text-foreground flex items-center gap-2"
              onClick={() => {
                if (!contextFilePath) return;
                handleDownload(contextFilePath);
                setContextMenu(null);
              }}
            >
              <Download size={14} /> Download
            </button>
          )}

          {contextMenu.targetType === "file" && canRenameContextFile && (
            <button
              className="w-full text-left px-4 py-2 text-sm hover:bg-muted hover:text-foreground flex items-center gap-2"
              onClick={() => {
                if (!contextFilePath) return;
                openRenameForPath(contextFilePath);
                setContextMenu(null);
              }}
            >
              <Edit2 size={14} /> Rename
            </button>
          )}

          {contextMenu.targetType === "file" && files.length > 1 && (
            <button
              className="w-full text-left px-4 py-2 text-sm text-destructive hover:bg-destructive/10 flex items-center gap-2"
              onClick={() => {
                if (!contextFilePath) return;
                onFileDelete(contextFilePath);
                setContextMenu(null);
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
