"use client";

import { X, Download, Terminal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PlotViewerProps {
  images: string[];
  onClose: () => void;
  onClear: () => void;
  onToggleTerminal?: () => void;
}

export function PlotViewer({
  images,
  onClose,
  onClear,
  onToggleTerminal,
}: PlotViewerProps) {
  if (images.length === 0) return null;

  const handleDownload = (src: string, index: number) => {
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${src}`;
    link.download = `plot_${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="absolute top-0 right-0 bottom-0 w-80 backdrop-blur-xl bg-white/80 dark:bg-gray-900/80 border-l border-white/20 dark:border-gray-800 shadow-2xl flex flex-col z-50 transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200/50 dark:border-gray-800/50 bg-white/50 dark:bg-gray-900/50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
          <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">
            Plots <span className="opacity-50 ml-1">({images.length})</span>
          </span>
        </div>
        <div className="flex gap-1">
          <TooltipProvider>
            {onToggleTerminal && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={onToggleTerminal}
                  >
                    <Terminal className="w-4 h-4 text-gray-500 hover:text-indigo-500 transition-colors" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Toggle Terminal</TooltipContent>
              </Tooltip>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onClear}
                >
                  <Trash2 className="w-4 h-4 text-gray-500 hover:text-red-500 transition-colors" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Clear All</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onClose}
                >
                  <X className="w-4 h-4 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4 pb-4">
          {images.map((img, idx) => (
            <div
              key={idx}
              className="group relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-black/40 shadow-sm hover:shadow-lg transition-all duration-300"
            >
              <div className="aspect-[4/3] w-full bg-white dark:bg-gray-900/50 flex items-center justify-center relative overflow-hidden">
                <img
                  src={`data:image/png;base64,${img}`}
                  alt={`Plot ${idx + 1}`}
                  className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                />
                {/* Overlay Actions */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-300 flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 backdrop-blur-[1px]">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="h-8 gap-2 bg-white/90 hover:bg-white text-black border-0 shadow-lg translate-y-2 group-hover:translate-y-0 transition-all duration-300"
                    onClick={() => handleDownload(img, idx)}
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="text-xs font-medium">Download</span>
                  </Button>
                </div>
              </div>
              <div className="px-3 py-2 bg-gray-50/80 dark:bg-gray-900/80 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center">
                <span className="text-xs font-mono text-gray-500">
                  Output #{idx + 1}
                </span>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
