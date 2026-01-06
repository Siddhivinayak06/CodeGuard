"use client";

import React from "react";
import { Info as InfoIcon, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { Practical, Subject, Level } from "../types";

interface BasicDetailsFormProps {
    form: Practical;
    subjects: Subject[];
    handleInput: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    defaultSubjectId?: number | string | null;
    enableLevels: boolean;
    setEnableLevels: (enable: boolean) => void;
    levels: Level[];
}

function cx(...parts: Array<string | false | null | undefined>) {
    return parts.filter(Boolean).join(" ");
}

export default function BasicDetailsForm({
    form,
    subjects,
    handleInput,
    defaultSubjectId,
    enableLevels,
    setEnableLevels,
    levels
}: BasicDetailsFormProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-card-premium rounded-2xl p-5 shadow-sm"
        >
            <div className="flex items-center gap-3 pb-3 border-b border-gray-200 dark:border-gray-700 mb-5">
                <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-lg shadow-indigo-500/25">
                    <InfoIcon size={18} />
                </div>
                <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">Basic Information</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Essential details for the practical</p>
                </div>
            </div>

            {/* Row 1: Title (full width) */}
            <div className="mb-4">
                <label className="block text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-1.5">
                    Practical Title <span className="text-red-500">*</span>
                </label>
                <input
                    type="text"
                    name="title"
                    value={form.title}
                    onChange={handleInput}
                    placeholder="e.g., Binary Search Implementation"
                    className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900 dark:text-white text-sm"
                />
            </div>

            {/* Row 2: Subject, Language, Deadline */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-1.5">
                        Subject <span className="text-red-500">*</span>
                    </label>
                    <select
                        name="subject_id"
                        value={(form.subject_id as string) || ""}
                        onChange={handleInput}
                        disabled={Boolean(defaultSubjectId)}
                        className={cx(
                            "w-full px-4 py-2.5 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm",
                            defaultSubjectId
                                ? "bg-gray-100 dark:bg-gray-900/50 text-gray-500 cursor-not-allowed"
                                : "bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        )}
                    >
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-1.5">
                        Language
                    </label>
                    <select
                        name="language"
                        value={form.language || ''}
                        onChange={handleInput}
                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900 dark:text-white text-sm"
                    >
                        <option value="">Any Language</option>
                        <option value="java">Java</option>
                        <option value="python">Python</option>
                        <option value="c">C</option>
                    </select>
                </div>

                <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-1.5">
                        Deadline <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="datetime-local"
                        name="deadline"
                        value={form.deadline || ""}
                        onChange={handleInput}
                        className="w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900 dark:text-white text-sm"
                    />
                </div>
            </div>

            {/* Row 3: Max Marks + Multi-Level Toggle */}
            <div className="flex items-end justify-between gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <div className="w-32">
                    <label className="block text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-1.5">
                        Max Marks
                    </label>
                    <input
                        type="number"
                        name="max_marks"
                        value={enableLevels ? levels.reduce((sum, l) => sum + l.max_marks, 0) : form.max_marks}
                        onChange={handleInput}
                        disabled={enableLevels}
                        className={cx(
                            "w-full px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-gray-900 dark:text-white text-sm text-center font-bold",
                            enableLevels && "opacity-50 cursor-not-allowed"
                        )}
                    />
                </div>

                {/* Multi-Level Toggle */}
                <div className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 rounded-xl border border-amber-200 dark:border-amber-800/50">
                    <div className="flex items-center gap-2">
                        <Sparkles size={16} className="text-amber-600" />
                        <span className="text-sm font-semibold text-amber-800 dark:text-amber-200">Multi-Level</span>
                    </div>
                    <motion.button
                        type="button"
                        onClick={() => setEnableLevels(!enableLevels)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={cx(
                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                            enableLevels ? "bg-gradient-to-r from-amber-500 to-orange-600" : "bg-gray-300 dark:bg-gray-600"
                        )}
                    >
                        <span
                            className={cx(
                                "inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform",
                                enableLevels ? "translate-x-6" : "translate-x-1"
                            )}
                        />
                    </motion.button>
                </div>
            </div>
        </motion.div>
    );
}
