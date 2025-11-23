"use client";

import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PlotViewerProps {
    images: string[];
    onClose: () => void;
    onClear: () => void;
}

export function PlotViewer({ images, onClose, onClear }: PlotViewerProps) {
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
        <div className="absolute top-0 right-0 bottom-0 w-80 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-xl flex flex-col z-20">
            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                <span className="font-semibold text-sm">Plots ({images.length})</span>
                <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={onClear} title="Clear All">
                        <span className="text-xs">Clear</span>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {images.map((img, idx) => (
                    <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded-lg p-2 bg-gray-50 dark:bg-gray-800 relative group">
                        <img
                            src={`data:image/png;base64,${img}`}
                            alt={`Plot ${idx + 1}`}
                            className="w-full h-auto rounded"
                        />
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                                size="icon"
                                variant="secondary"
                                className="h-6 w-6"
                                onClick={() => handleDownload(img, idx)}
                            >
                                <Download className="w-3 h-3" />
                            </Button>
                        </div>
                        <div className="mt-1 text-xs text-center text-gray-500">Plot {idx + 1}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
