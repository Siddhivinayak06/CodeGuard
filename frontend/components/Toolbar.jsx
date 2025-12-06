"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ChevronDown, Play, FileDown, Send, Terminal } from "lucide-react";

export default function Toolbar({
  lang,
  setLang,
  showInput,
  setShowInput,
  showInputToggle = true,
  onRun,
  onDownload,
  onSubmit,
  locked,
  loading,
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2">
      {/* Language Selector */}
      <div className="flex items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2 text-sm"
              disabled={locked}
            >
              {lang === "python" ? "Python" : lang === "java" ? "Java" : "C"}
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>Select Language</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setLang("python")}>
              Python
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLang("c")}>C</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLang("java")}>
              Java
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="text-gray-700 dark:text-gray-300 text-sm font-medium">
          {lang === "python"
            ? "Python Editor"
            : lang === "java"
              ? "Java Editor"
              : "C Editor"}
        </span>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2">
        {loading && (
          <div className="flex items-center gap-2 px-3 py-1 text-xs text-blue-600 dark:text-blue-400">
            <div className="w-3 h-3 border-2 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            <span>Running...</span>
          </div>
        )}

        {/* Toggle Input */}
        {showInputToggle && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowInput(!showInput)}
            className="text-sm"
            disabled={locked}
          >
            <Terminal className="w-4 h-4 mr-1" />
            {showInput ? "Hide Input" : "Show Input"}
          </Button>
        )}

        {/* Run */}
        <Button
          size="sm"
          onClick={onRun}
          disabled={locked || loading}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <Play className="w-4 h-4 mr-1" />
          Run
        </Button>

        {/* Export PDF */}
        <Button
          size="sm"
          onClick={onDownload}
          disabled={locked || loading}
          className="bg-purple-600 hover:bg-purple-700 text-white"
        >
          <FileDown className="w-4 h-4 mr-1" />
          Export
        </Button>

        {/* Submit */}
        {onSubmit && (
          <Button
            size="sm"
            onClick={onSubmit}
            disabled={locked || loading}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <Send className="w-4 h-4 mr-1" />
            Submit
          </Button>
        )}
      </div>
    </div>
  );
}
