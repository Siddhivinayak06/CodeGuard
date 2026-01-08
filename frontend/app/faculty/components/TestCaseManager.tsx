"use client";

import React from "react";
import { FlaskConical as TestIcon, Plus as PlusIcon, Trash2 as TrashIcon, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { TestCase } from "../types";

interface TestCaseManagerProps {
    testCases: TestCase[];
    handleTestCaseChange: (index: number, field: keyof TestCase, value: string | number | boolean) => void;
    addTestCase: () => void;
    removeTestCase: (index: number) => void;
    generateTestCases: () => void;
    generatingTests: boolean;
    description: string;
}

export default function TestCaseManager({
    testCases,
    handleTestCaseChange,
    addTestCase,
    removeTestCase,
    generateTestCases,
    generatingTests,
    description
}: TestCaseManagerProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card-premium rounded-2xl p-6 shadow-sm"
        >
            <div className="flex items-center justify-between pb-4 border-b border-gray-200 dark:border-gray-700 mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-teal-500 to-emerald-600 rounded-lg text-white shadow-md">
                        <TestIcon size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-lg text-gray-900 dark:text-white">Test Cases</h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Define input/output for automated grading</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={generateTestCases}
                    disabled={generatingTests || !description}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-50"
                >
                    <Sparkles size={14} />
                    {generatingTests ? "Generating..." : "Auto-Generate with AI"}
                </button>
            </div>

            <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                    {testCases.map((tc, idx) => (
                        <motion.div
                            key={idx}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            layout
                            className="group relative p-4 bg-gray-50/50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-teal-200 dark:hover:border-teal-800 transition-colors"
                        >
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    type="button"
                                    onClick={() => removeTestCase(idx)}
                                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                                    title="Remove test case"
                                >
                                    <TrashIcon size={14} />
                                </button>
                            </div>

                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Input</label>
                                        <span className="text-[10px] text-gray-400">Stdin</span>
                                    </div>
                                    <textarea
                                        value={tc.input}
                                        onChange={(e) => handleTestCaseChange(idx, "input", e.target.value)}
                                        className="w-full text-xs font-mono p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent min-h-[80px]"
                                        placeholder="Input data..."
                                    />
                                    <div className="flex items-center justify-between gap-4 pt-1">
                                        <div className="flex items-center gap-2">
                                            <label className="text-[10px] font-medium text-gray-500">Time (ms)</label>
                                            <input
                                                type="number"
                                                value={tc.time_limit_ms || 2000}
                                                onChange={(e) => handleTestCaseChange(idx, "time_limit_ms", parseInt(e.target.value))}
                                                className="w-16 h-6 text-xs px-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded"
                                            />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="text-[10px] font-medium text-gray-500">Mem (KB)</label>
                                            <input
                                                type="number"
                                                value={tc.memory_limit_kb || 65536}
                                                onChange={(e) => handleTestCaseChange(idx, "memory_limit_kb", parseInt(e.target.value))}
                                                className="w-16 h-6 text-xs px-2 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded"
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex-1 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">Expected Output</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={tc.is_hidden || false}
                                                onChange={(e) => handleTestCaseChange(idx, "is_hidden", e.target.checked)}
                                                id={`hidden-${idx}`}
                                                className="rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                                            />
                                            <label htmlFor={`hidden-${idx}`} className="text-[10px] text-gray-500 select-none cursor-pointer">Hidden Case</label>
                                        </div>
                                    </div>
                                    <textarea
                                        value={tc.expected_output}
                                        onChange={(e) => handleTestCaseChange(idx, "expected_output", e.target.value)}
                                        className="w-full text-xs font-mono p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent min-h-[80px]"
                                        placeholder="Expected output..."
                                    />
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </AnimatePresence>

                <motion.button
                    type="button"
                    onClick={addTestCase}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-500 hover:text-teal-600 hover:border-teal-200 dark:hover:border-teal-900 dark:hover:text-teal-400 transition-all flex items-center justify-center gap-2"
                >
                    <PlusIcon size={16} />
                    Add Test Case
                </motion.button>
            </div>
        </motion.div>
    );
}
