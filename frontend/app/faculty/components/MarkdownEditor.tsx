"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import { 
  Bold, 
  Italic, 
  List, 
  Code, 
  Wand2, 
  Eye, 
  PenLine,
  Loader2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  onMagicFormat?: () => Promise<void>;
  isFormatting?: boolean;
}

export default function MarkdownEditor({
  value,
  onChange,
  placeholder = "Write something...",
  label,
  onMagicFormat,
  isFormatting = false,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<"write" | "preview">("write");

  const insertText = (before: string, after: string = "") => {
    const textarea = document.querySelector(`textarea[name="markdown-editor"]`) as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selected = text.substring(start, end);
    const replacement = before + selected + after;
    
    onChange(text.substring(0, start) + replacement + text.substring(end));
    
    // Reset focus and selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, end + before.length);
    }, 0);
  };

  const toolbarButtons = [
    { icon: Bold, action: () => insertText("**", "**"), label: "Bold" },
    { icon: Italic, action: () => insertText("_", "_"), label: "Italic" },
    { icon: List, action: () => insertText("- "), label: "List" },
    { icon: Code, action: () => insertText("```\n", "\n```"), label: "Code" },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        {label && (
          <label className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">
            {label}
          </label>
        )}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg border border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setMode("write")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              mode === "write"
                ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <PenLine size={14} />
            Write
          </button>
          <button
            type="button"
            onClick={() => setMode("preview")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all ${
              mode === "preview"
                ? "bg-white dark:bg-gray-700 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <Eye size={14} />
            Preview
          </button>
        </div>
      </div>

      <div className="relative group min-h-[200px] bg-white dark:bg-gray-900/50 border-2 border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden focus-within:border-indigo-500 dark:focus-within:border-indigo-400 transition-all">
        {mode === "write" && (
          <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50">
              <div className="flex items-center gap-1">
                {toolbarButtons.map((btn, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={btn.action}
                    className="p-1.5 text-gray-500 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-gray-700 rounded-md transition-all"
                    title={btn.label}
                  >
                    <btn.icon size={16} />
                  </button>
                ))}
              </div>

              {onMagicFormat && (
                <button
                  type="button"
                  onClick={onMagicFormat}
                  disabled={isFormatting || !value.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed group/btn"
                >
                  {isFormatting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Wand2 size={14} className="group-hover/btn:rotate-12 transition-transform" />
                  )}
                  Magic Format
                </button>
              )}
            </div>
            
            <textarea
              name="markdown-editor"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className="w-full h-full min-h-[160px] p-4 bg-transparent outline-none resize-y text-sm text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500"
            />
          </div>
        )}

        {mode === "preview" && (
          <div className="p-4 h-full min-h-[200px] overflow-auto prose prose-sm dark:prose-invert max-w-none prose-headings:font-bold prose-headings:text-gray-900 dark:prose-headings:text-white prose-p:text-gray-700 dark:prose-p:text-gray-300">
            {value.trim() ? (
              <ReactMarkdown>{value}</ReactMarkdown>
            ) : (
              <p className="text-gray-400 italic">Nothing to preview</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
