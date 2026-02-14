"use client";

import React, { useMemo, useState, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Plus,
    Trash2,
    Download,
    ArrowUpDown,
    Search,
    Table2,
    FileSpreadsheet,
} from "lucide-react";

interface CsvViewerProps {
    content: string;
    onChange?: (newContent: string) => void;
    readOnly?: boolean;
    fileName?: string;
}

function parseCsv(csv: string): string[][] {
    if (!csv.trim()) return [[""]];
    const rows: string[][] = [];
    let current = "";
    let inQuotes = false;
    let row: string[] = [];

    for (let i = 0; i < csv.length; i++) {
        const ch = csv[i];
        if (inQuotes) {
            if (ch === '"' && csv[i + 1] === '"') {
                current += '"';
                i++;
            } else if (ch === '"') {
                inQuotes = false;
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ",") {
                row.push(current);
                current = "";
            } else if (ch === "\n") {
                row.push(current);
                current = "";
                rows.push(row);
                row = [];
            } else if (ch === "\r") {
                // skip carriage return
            } else {
                current += ch;
            }
        }
    }
    row.push(current);
    if (row.length > 0 || current) rows.push(row);

    return rows.length > 0 ? rows : [[""]];
}

function toCsv(data: string[][]): string {
    return data
        .map((row) =>
            row
                .map((cell) => {
                    if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
                        return `"${cell.replace(/"/g, '""')}"`;
                    }
                    return cell;
                })
                .join(","),
        )
        .join("\n");
}

export function CsvViewer({
    content,
    onChange,
    readOnly = false,
    fileName,
}: CsvViewerProps) {
    const data = useMemo(() => parseCsv(content), [content]);
    const [searchQuery, setSearchQuery] = useState("");
    const [sortCol, setSortCol] = useState<number | null>(null);
    const [sortAsc, setSortAsc] = useState(true);
    const [editingCell, setEditingCell] = useState<{
        row: number;
        col: number;
    } | null>(null);
    const [editValue, setEditValue] = useState("");

    const headers = data.length > 0 ? data[0] : [];
    const bodyRows = data.length > 1 ? data.slice(1) : [];

    const maxCols = useMemo(
        () => Math.max(...data.map((r) => r.length), 1),
        [data],
    );

    const filteredRows = useMemo(() => {
        let rows = bodyRows.map((row, idx) => ({ row, originalIndex: idx + 1 }));

        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            rows = rows.filter(({ row }) =>
                row.some((cell) => cell.toLowerCase().includes(q)),
            );
        }

        if (sortCol !== null) {
            rows.sort((a, b) => {
                const aVal = a.row[sortCol] || "";
                const bVal = b.row[sortCol] || "";
                const numA = Number(aVal);
                const numB = Number(bVal);
                if (!isNaN(numA) && !isNaN(numB)) {
                    return sortAsc ? numA - numB : numB - numA;
                }
                return sortAsc
                    ? aVal.localeCompare(bVal)
                    : bVal.localeCompare(aVal);
            });
        }

        return rows;
    }, [bodyRows, searchQuery, sortCol, sortAsc]);

    const updateCell = useCallback(
        (rowIndex: number, colIndex: number, value: string) => {
            if (!onChange) return;
            const newData = data.map((r) => [...r]);
            while (newData[rowIndex].length <= colIndex)
                newData[rowIndex].push("");
            newData[rowIndex][colIndex] = value;
            onChange(toCsv(newData));
        },
        [data, onChange],
    );

    const addRow = useCallback(() => {
        if (!onChange) return;
        const newData = [...data.map((r) => [...r])];
        newData.push(new Array(maxCols).fill(""));
        onChange(toCsv(newData));
    }, [data, maxCols, onChange]);

    const addColumn = useCallback(() => {
        if (!onChange) return;
        const newData = data.map((r) => [...r, ""]);
        onChange(toCsv(newData));
    }, [data, onChange]);

    const deleteRow = useCallback(
        (rowIndex: number) => {
            if (!onChange || data.length <= 1) return;
            const newData = data.filter((_, i) => i !== rowIndex);
            onChange(toCsv(newData));
        },
        [data, onChange],
    );

    const deleteColumn = useCallback(
        (colIndex: number) => {
            if (!onChange || maxCols <= 1) return;
            const newData = data.map((r) => r.filter((_, i) => i !== colIndex));
            onChange(toCsv(newData));
        },
        [data, maxCols, onChange],
    );

    const handleSort = (colIndex: number) => {
        if (sortCol === colIndex) {
            setSortAsc(!sortAsc);
        } else {
            setSortCol(colIndex);
            setSortAsc(true);
        }
    };

    const startEditing = (row: number, col: number) => {
        if (readOnly) return;
        setEditingCell({ row, col });
        setEditValue(data[row]?.[col] || "");
    };

    const commitEdit = () => {
        if (editingCell) {
            updateCell(editingCell.row, editingCell.col, editValue);
            setEditingCell(null);
        }
    };

    const handleDownload = () => {
        const blob = new Blob([content], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName || "data.csv";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="h-full flex flex-col bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl">
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-200/60 dark:border-gray-700/60 bg-gradient-to-r from-emerald-50/50 to-green-50/50 dark:from-emerald-950/30 dark:to-green-950/30">
                <FileSpreadsheet
                    size={16}
                    className="text-emerald-600 dark:text-emerald-400"
                />
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300 mr-2">
                    {fileName || "CSV"}
                </span>

                <div className="relative flex-1 max-w-xs">
                    <Search
                        size={12}
                        className="absolute left-2.5 top-2.5 text-gray-400"
                    />
                    <Input
                        placeholder="Search cells..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="h-8 pl-7 text-xs bg-white/70 dark:bg-gray-800/70 border-gray-200/60 dark:border-gray-700"
                    />
                </div>

                <div className="flex items-center gap-1 ml-auto">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400 mr-2 tabular-nums">
                        {bodyRows.length} rows × {maxCols} cols
                    </span>
                    {!readOnly && (
                        <>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1 bg-white/70 dark:bg-gray-800/70"
                                onClick={addRow}
                            >
                                <Plus size={12} /> Row
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1 bg-white/70 dark:bg-gray-800/70"
                                onClick={addColumn}
                            >
                                <Plus size={12} /> Col
                            </Button>
                        </>
                    )}
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs gap-1 bg-white/70 dark:bg-gray-800/70"
                        onClick={handleDownload}
                    >
                        <Download size={12} /> Export
                    </Button>
                </div>
            </div>

            {/* Table */}
            <ScrollArea className="flex-1">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse min-w-max">
                        <thead className="sticky top-0 z-10">
                            <tr className="bg-gradient-to-r from-gray-100/90 to-gray-50/90 dark:from-gray-800/90 dark:to-gray-850/90 backdrop-blur-sm">
                                <th className="px-2 py-2 text-[10px] text-gray-400 font-medium border-b border-r border-gray-200/60 dark:border-gray-700/60 w-10 text-center">
                                    #
                                </th>
                                {Array.from({ length: maxCols }).map((_, colIdx) => (
                                    <th
                                        key={colIdx}
                                        className="px-3 py-2 text-left text-xs font-semibold text-gray-700 dark:text-gray-200 border-b border-r border-gray-200/60 dark:border-gray-700/60 min-w-[120px] group"
                                    >
                                        <div className="flex items-center gap-1">
                                            {editingCell?.row === 0 &&
                                                editingCell?.col === colIdx ? (
                                                <Input
                                                    autoFocus
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={commitEdit}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") commitEdit();
                                                        if (e.key === "Escape") setEditingCell(null);
                                                    }}
                                                    className="h-6 text-xs px-1 py-0 w-full"
                                                />
                                            ) : (
                                                <span
                                                    className="truncate cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                                    onDoubleClick={() => startEditing(0, colIdx)}
                                                >
                                                    {headers[colIdx] || `Col ${colIdx + 1}`}
                                                </span>
                                            )}
                                            <button
                                                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                                                onClick={() => handleSort(colIdx)}
                                                title="Sort"
                                            >
                                                <ArrowUpDown
                                                    size={10}
                                                    className={
                                                        sortCol === colIdx
                                                            ? "text-blue-500"
                                                            : "text-gray-400"
                                                    }
                                                />
                                            </button>
                                            {!readOnly && (
                                                <button
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500"
                                                    onClick={() => deleteColumn(colIdx)}
                                                    title="Delete column"
                                                >
                                                    <Trash2 size={10} />
                                                </button>
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRows.map(({ row, originalIndex }) => (
                                <tr
                                    key={originalIndex}
                                    className="group hover:bg-blue-50/40 dark:hover:bg-blue-900/10 transition-colors"
                                >
                                    <td className="px-2 py-1.5 text-[10px] text-gray-400 border-b border-r border-gray-200/40 dark:border-gray-700/40 text-center tabular-nums font-mono bg-gray-50/50 dark:bg-gray-800/30">
                                        <div className="flex items-center justify-between">
                                            <span>{originalIndex}</span>
                                            {!readOnly && (
                                                <button
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500"
                                                    onClick={() => deleteRow(originalIndex)}
                                                    title="Delete row"
                                                >
                                                    <Trash2 size={8} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                    {Array.from({ length: maxCols }).map((_, colIdx) => (
                                        <td
                                            key={colIdx}
                                            className="px-3 py-1.5 border-b border-r border-gray-200/40 dark:border-gray-700/40 text-gray-700 dark:text-gray-300 min-h-[24px] cursor-pointer"
                                            onDoubleClick={() =>
                                                startEditing(originalIndex, colIdx)
                                            }
                                        >
                                            {editingCell?.row === originalIndex &&
                                                editingCell?.col === colIdx ? (
                                                <Input
                                                    autoFocus
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={commitEdit}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") commitEdit();
                                                        if (e.key === "Escape") setEditingCell(null);
                                                        if (e.key === "Tab") {
                                                            e.preventDefault();
                                                            commitEdit();
                                                            const nextCol = e.shiftKey
                                                                ? colIdx - 1
                                                                : colIdx + 1;
                                                            if (nextCol >= 0 && nextCol < maxCols) {
                                                                startEditing(originalIndex, nextCol);
                                                            }
                                                        }
                                                    }}
                                                    className="h-6 text-xs px-1 py-0 w-full"
                                                />
                                            ) : (
                                                <span className="truncate block min-h-[20px]">
                                                    {row[colIdx] || "\u00A0"}
                                                </span>
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            ))}

                            {filteredRows.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={maxCols + 1}
                                        className="px-4 py-12 text-center text-gray-400 dark:text-gray-500"
                                    >
                                        <Table2
                                            size={32}
                                            className="mx-auto mb-2 opacity-50"
                                        />
                                        <p className="text-sm">
                                            {searchQuery
                                                ? "No matching cells found"
                                                : "Empty spreadsheet"}
                                        </p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </ScrollArea>
        </div>
    );
}
