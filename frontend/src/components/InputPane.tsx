"use client";
import { useState } from "react";

type InputPaneProps = {
  onChange: (val: string) => void;
};

export default function InputPane({ onChange }: InputPaneProps) {
  const [inputs, setInputs] = useState<string[]>([""]); // ✅ Start with 1 input

  const handleInputChange = (index: number, value: string) => {
    const updated = [...inputs];
    updated[index] = value;
    setInputs(updated);

    // Join inputs with newlines (stdin style)
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
    setInputs([""]); // ✅ Reset to a single empty input
    onChange("");
  };

  return (
    <div className="h-full bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 flex flex-col p-6 rounded-2xl shadow-lg">
      {/* Scrollable Inputs */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {inputs.map((val, idx) => (
          <div
            key={idx}
            className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-850 shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <label className="text-gray-800 dark:text-gray-200 text-sm font-semibold tracking-wide">
                Input {idx + 1}
              </label>

              {idx > 0 && (
                <button
                  onClick={() => removeInput(idx)}
                  className="px-2 py-1 text-xs bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-sm"
                >
                  ✕
                </button>
              )}
            </div>

            <input
              type="text"
              value={val}
              onChange={(e) => handleInputChange(idx, e.target.value)}
              placeholder={`Enter value ${idx + 1}`}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 
             bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm
             focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-inner"
            />

          </div>
        ))}
      </div>

      {/* Actions at bottom */}
      <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
        <button
          onClick={addInput}
          className="flex-1 px-4 py-2 rounded-xl bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 transition-colors shadow-md"
        >
          + Add Input
        </button>
        <button
          onClick={clearAll}
          className="flex-1 px-4 py-2 rounded-xl bg-gray-600 text-white font-medium text-sm hover:bg-gray-700 transition-colors shadow-md"
        >
          Clear All
        </button>
      </div>
    </div>
  );
}
