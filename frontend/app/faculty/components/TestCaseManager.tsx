"use client";

import React, { useState } from "react";
import {
  FlaskConical as TestIcon,
  Plus as PlusIcon,
  Trash2 as TrashIcon,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Clock,
  HardDrive,
  Copy,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { TestCase } from "../types";

interface TestCaseManagerProps {
  testCases: TestCase[];
  handleTestCaseChange: (
    index: number,
    field: keyof TestCase,
    value: string | number | boolean,
  ) => void;
  addTestCase: () => void;
  removeTestCase: (index: number) => void;
  generateTestCases: () => void;
  generatingTests: boolean;
  description: string;
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function TestCaseManager({
  testCases,
  handleTestCaseChange,
  addTestCase,
  removeTestCase,
  generateTestCases,
  generatingTests,
  description,
}: TestCaseManagerProps) {
  const [expandedCases, setExpandedCases] = useState<Set<number>>(new Set([0]));
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const toggleExpanded = (idx: number) => {
    setExpandedCases((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const duplicateTestCase = (idx: number) => {
    addTestCase();
    const tc = testCases[idx];
    const newIdx = testCases.length;
    setTimeout(() => {
      handleTestCaseChange(newIdx, "input", tc.input);
      handleTestCaseChange(newIdx, "expected_output", tc.expected_output);
      handleTestCaseChange(newIdx, "time_limit_ms", tc.time_limit_ms || 2000);
      handleTestCaseChange(newIdx, "memory_limit_kb", tc.memory_limit_kb || 65536);
      handleTestCaseChange(newIdx, "is_hidden", tc.is_hidden || false);
      setExpandedCases((prev) => new Set([...prev, newIdx]));
    }, 0);
  };

  const inputClass = (field: string) =>
    cx(
      "w-full text-xs font-mono p-3 bg-white dark:bg-gray-900 border-2 rounded-xl transition-all duration-200",
      focusedField === field
        ? "border-teal-500 dark:border-teal-400 ring-4 ring-teal-500/10 dark:ring-teal-400/10 shadow-md"
        : "border-gray-200 dark:border-gray-700 hover:border-teal-300 dark:hover:border-teal-700",
    );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 30 }}
      className="relative overflow-hidden bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-800"
    >
      {/* Decorative gradient blob */}
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-gradient-to-br from-teal-500/20 to-emerald-500/20 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="relative flex items-center justify-between pb-4 border-b border-gray-200/80 dark:border-gray-700/80 mb-5">
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.05, rotate: 5 }}
            className="p-2.5 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl text-white shadow-lg shadow-teal-500/30"
          >
            <TestIcon size={20} />
          </motion.div>
          <div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">
              Test Cases
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {testCases.length} case{testCases.length !== 1 ? "s" : ""} defined
            </p>
          </div>
        </div>

        {/* AI Generate Button */}
        <motion.button
          type="button"
          onClick={generateTestCases}
          disabled={generatingTests || !description}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={cx(
            "flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-md",
            generatingTests || !description
              ? "bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed"
              : "bg-gradient-to-r from-violet-500 to-purple-500 text-white hover:shadow-lg hover:shadow-violet-500/25",
          )}
        >
          <motion.div
            animate={generatingTests ? { rotate: 360 } : {}}
            transition={{ duration: 1, repeat: generatingTests ? Infinity : 0, ease: "linear" }}
          >
            <Sparkles size={14} />
          </motion.div>
          {generatingTests ? "Generating..." : "AI Generate"}
        </motion.button>
      </div>

      {/* Test Cases List */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {testCases.map((tc, idx) => {
            const isExpanded = expandedCases.has(idx);
            const hasInput = tc.input.trim() !== "";
            const hasOutput = tc.expected_output.trim() !== "";

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                layout
                className={cx(
                  "group relative overflow-hidden rounded-xl border-2 transition-all duration-200",
                  isExpanded
                    ? "border-teal-200 dark:border-teal-800 bg-gradient-to-br from-teal-50/50 to-emerald-50/50 dark:from-teal-900/10 dark:to-emerald-900/10"
                    : "border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 hover:border-teal-200 dark:hover:border-teal-800",
                )}
              >
                {/* Collapsed Header */}
                <div
                  onClick={() => toggleExpanded(idx)}
                  className="flex items-center justify-between p-4 cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className={cx(
                      "w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm transition-all",
                      isExpanded
                        ? "bg-teal-500 text-white shadow-md shadow-teal-500/30"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400",
                    )}>
                      {idx + 1}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900 dark:text-white">
                        Test Case {idx + 1}
                      </span>
                      {tc.is_hidden && (
                        <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-full">
                          <EyeOff size={10} />
                          Hidden
                        </span>
                      )}
                      {!isExpanded && hasInput && hasOutput && (
                        <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded-full">
                          ✓ Complete
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!isExpanded && (
                      <div className="hidden md:flex items-center gap-3 text-[10px] text-gray-400 mr-2">
                        <span className="flex items-center gap-1">
                          <Clock size={10} /> {tc.time_limit_ms || 2000}ms
                        </span>
                        <span className="flex items-center gap-1">
                          <HardDrive size={10} /> {Math.round((tc.memory_limit_kb || 65536) / 1024)}MB
                        </span>
                      </div>
                    )}
                    <motion.div
                      animate={{ rotate: isExpanded ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="p-1.5 rounded-lg hover:bg-white/50 dark:hover:bg-gray-800/50"
                    >
                      <ChevronDown size={16} className="text-gray-400" />
                    </motion.div>
                  </div>
                </div>

                {/* Expanded Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-0 space-y-4">
                        {/* Input/Output Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Input */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                                Input
                              </label>
                              <span className="text-[10px] text-gray-400 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">stdin</span>
                            </div>
                            <textarea
                              value={tc.input}
                              onChange={(e) => handleTestCaseChange(idx, "input", e.target.value)}
                              onFocus={() => setFocusedField(`input-${idx}`)}
                              onBlur={() => setFocusedField(null)}
                              className={cx(inputClass(`input-${idx}`), "min-h-[100px] resize-y")}
                              placeholder="Enter test input..."
                            />
                          </div>

                          {/* Output */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                                Expected Output
                              </label>
                              <span className="text-[10px] text-gray-400 px-2 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">stdout</span>
                            </div>
                            <textarea
                              value={tc.expected_output}
                              onChange={(e) => handleTestCaseChange(idx, "expected_output", e.target.value)}
                              onFocus={() => setFocusedField(`output-${idx}`)}
                              onBlur={() => setFocusedField(null)}
                              className={cx(inputClass(`output-${idx}`), "min-h-[100px] resize-y")}
                              placeholder="Expected output..."
                            />
                          </div>
                        </div>

                        {/* Settings Row */}
                        <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-gray-200/50 dark:border-gray-700/50">
                          <div className="flex items-center gap-4">
                            {/* Time Limit */}
                            <div className="flex items-center gap-2">
                              <Clock size={12} className="text-gray-400" />
                              <input
                                type="number"
                                value={tc.time_limit_ms || 2000}
                                onChange={(e) => handleTestCaseChange(idx, "time_limit_ms", parseInt(e.target.value))}
                                className="w-20 h-8 text-xs px-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-center focus:ring-2 focus:ring-teal-500"
                              />
                              <span className="text-[10px] text-gray-400">ms</span>
                            </div>

                            {/* Memory Limit */}
                            <div className="flex items-center gap-2">
                              <HardDrive size={12} className="text-gray-400" />
                              <input
                                type="number"
                                value={tc.memory_limit_kb || 65536}
                                onChange={(e) => handleTestCaseChange(idx, "memory_limit_kb", parseInt(e.target.value))}
                                className="w-20 h-8 text-xs px-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg text-center focus:ring-2 focus:ring-teal-500"
                              />
                              <span className="text-[10px] text-gray-400">KB</span>
                            </div>

                            {/* Hidden Toggle */}
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={tc.is_hidden || false}
                                onChange={(e) => handleTestCaseChange(idx, "is_hidden", e.target.checked)}
                                className="w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                              />
                              <span className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1">
                                {tc.is_hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                                Hidden
                              </span>
                            </label>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => duplicateTestCase(idx)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-teal-600 dark:hover:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-lg transition-colors"
                            >
                              <Copy size={12} />
                              Duplicate
                            </button>
                            <button
                              type="button"
                              onClick={() => removeTestCase(idx)}
                              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                              <TrashIcon size={12} />
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Add Test Case Button */}
        <motion.button
          type="button"
          onClick={() => {
            addTestCase();
            setExpandedCases((prev) => new Set([...prev, testCases.length]));
          }}
          whileHover={{ scale: 1.01, y: -2 }}
          whileTap={{ scale: 0.99 }}
          className="w-full py-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-sm font-bold text-gray-400 hover:text-teal-600 hover:border-teal-300 dark:hover:border-teal-700 dark:hover:text-teal-400 transition-all flex items-center justify-center gap-2 bg-gradient-to-br from-transparent to-gray-50/50 dark:to-gray-800/20 hover:from-teal-50/30 hover:to-emerald-50/30 dark:hover:from-teal-900/10 dark:hover:to-emerald-900/10"
        >
          <PlusIcon size={18} />
          Add Test Case
        </motion.button>
      </div>
    </motion.div>
  );
}
