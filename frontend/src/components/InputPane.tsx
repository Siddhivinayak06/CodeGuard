"use client";
import { useState } from "react";

export default function InputPane({ onChange }: { onChange: (val: string) => void }) {
  const [input, setInput] = useState("");

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    onChange(e.target.value);
  };

  return (
    <div className="h-full bg-white dark:bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-gray-600 dark:text-gray-400"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 
                 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 
                 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 
                 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 
                 011-1h12a1 1 0 110 2H4a1 1 0 
                 01-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-gray-700 dark:text-gray-300 text-sm font-medium">
            INPUT
          </span>
        </div>
      </div>

      {/* Textarea */}
      <div className="flex-1 p-4">
        <textarea
          value={input}
          onChange={handleChange}
          placeholder="Enter custom input here..."
          className="w-full h-full resize-none bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-200 font-mono text-sm p-3 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
    </div>
  );
}
