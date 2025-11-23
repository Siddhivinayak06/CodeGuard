import React from 'react';
import { FileCode, Lock, Unlock } from 'lucide-react';

interface StatusBarProps {
    lang: string;
    cursorPosition?: { lineNumber: number; column: number };
    readOnly?: boolean;
    violations?: number;
}

export function StatusBar({ lang, cursorPosition, readOnly, violations }: StatusBarProps) {
    return (
        <div className="h-6 bg-blue-600 text-white flex items-center justify-between px-3 text-xs select-none">
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                    <FileCode size={12} />
                    <span className="font-medium capitalize">{lang}</span>
                </div>
                {violations !== undefined && violations > 0 && (
                    <div className="flex items-center gap-1.5 text-orange-200">
                        <span>{violations} Problems</span>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-4">
                {cursorPosition && (
                    <div className="flex items-center gap-1">
                        <span>Ln {cursorPosition.lineNumber}, Col {cursorPosition.column}</span>
                    </div>
                )}
                <div className="flex items-center gap-1.5 opacity-80">
                    <span>UTF-8</span>
                </div>
                <div className="flex items-center gap-1.5">
                    {readOnly ? (
                        <>
                            <Lock size={10} />
                            <span>Read-only</span>
                        </>
                    ) : (
                        <>
                            <Unlock size={10} />
                            <span>Ready</span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
