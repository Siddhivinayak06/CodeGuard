"use client";
import { useState } from "react";

type InputPaneProps = {
  onChange: (val: string) => void;
};

export default function InputPane({ onChange }: InputPaneProps) {
  const [inputs, setInputs] = useState<string[]>([""]);

  const handleInputChange = (index: number, value: string) => {
    const updated = [...inputs];
    updated[index] = value;
    setInputs(updated);
    onChange(updated.join("\n"));
  };

  const addInput = () => setInputs([...inputs, ""]);

  const removeInput = (index: number) => {
    if (inputs.length > 1) {
      const updated = inputs.filter((_, i) => i !== index);
      setInputs(updated);
      onChange(updated.join("\n"));
    }
  };

  const clearAll = () => {
    setInputs([""]);
    onChange("");
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
      {/* Inputs List */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {inputs.map((val, idx) => (
          <div
            key={idx}
            className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60 transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                Input {idx + 1}
              </span>
              {idx > 0 && (
                <button
                  onClick={() => removeInput(idx)}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                >
                  Remove
                </button>
              )}
            </div>

            <input
              type="text"
              value={val}
              onChange={(e) => handleInputChange(idx, e.target.value)}
              placeholder={`Enter value ${idx + 1}`}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700
                         bg-transparent text-gray-900 dark:text-gray-100 text-sm
                         focus:outline-none focus:ring-1 focus:ring-gray-400 dark:focus:ring-gray-600"
            />
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
        <button
          onClick={addInput}
          className="flex-1 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700
                     text-gray-800 dark:text-gray-200 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        >
          + Add Input
        </button>
        <button
          onClick={clearAll}
          className="flex-1 px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700
                     text-gray-800 dark:text-gray-200 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        >
          Clear All
        </button>
      </div>
    </div>
  );
}
