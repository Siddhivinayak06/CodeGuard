"use client";

import { motion, Variants } from "framer-motion";
import { BookOpen, TrendingUp } from "lucide-react";
import { ProgressData } from "@/types/dashboard";

interface SubjectProgressListProps {
    progress: ProgressData[];
    loading: boolean;
    itemVariants: Variants;
}

export default function SubjectProgressList({
    progress,
    loading,
    itemVariants,
}: SubjectProgressListProps) {
    return (
        <motion.div
            variants={itemVariants}
            className="md:col-span-2 glass-card rounded-3xl p-6"
        >
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-indigo-500" />
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                        Subject Progress
                    </h2>
                </div>
            </div>

            {loading ? (
                <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-4 animate-pulse">
                            <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700" />
                            <div className="flex-1">
                                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                                <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : progress.length === 0 ? (
                <div className="text-center py-8">
                    <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">
                        No subjects found
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {progress.map((p) => {
                        const percentage = Math.round(
                            (p.passed_count / (p.total_count || 1)) * 100
                        );
                        return (
                            <div key={p.subject_id} className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                                    <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-medium text-gray-900 dark:text-white truncate">
                                            {p.subject_name}
                                        </span>
                                        <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                                            {percentage}%
                                        </span>
                                    </div>
                                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {p.passed_count}/{p.total_count} passed
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </motion.div>
    );
}
