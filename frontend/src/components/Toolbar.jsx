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
import { ChevronDown } from "lucide-react";

export default function Toolbar({ onRun, onDownload, locked, lang, setLang }) {
  return (
    <div className="flex gap-4 items-center mt-4">
      {/* ✅ Language Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2 text-sm"
          >
            {lang === "python" ? "🐍 Python" : "💻 C"}
            <ChevronDown className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Select Language</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setLang("python")}>
            🐍 Python
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setLang("c")}>
            💻 C
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
          {/* ✅ Toggle Input Button */}
          <button
            onClick={() => setShowInput(!showInput)}
            className="px-3 py-1 text-sm rounded bg-gray-200 dark:bg-gray-700 
                       text-gray-700 dark:text-gray-300 hover:bg-gray-300 
                       dark:hover:bg-gray-600 transition"
          >
            {showInput ? "Hide Input" : "Show Input"}
          </button>
          
      {/* Run Button */}
      <Button
        onClick={onRun}
        disabled={locked}
        className={`px-4 py-2 rounded text-white ${
          locked ? "bg-gray-500" : "bg-blue-500 hover:bg-blue-600"
        }`}
      >
        Run
      </Button>

      {/* Download PDF */}
      <Button
        onClick={onDownload}
        disabled={locked}
        className={`px-4 py-2 rounded text-white ${
          locked ? "bg-gray-500" : "bg-green-500 hover:bg-green-600"
        }`}
      >
        Download PDF
      </Button>
    </div>
  );
}
