"use client";

import Link from "next/link";
import { motion, Variants } from "framer-motion";
import { FileText, ChevronRight, Code } from "lucide-react";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { DashboardSubmission } from "@/types/dashboard";

interface RecentSubmissionsListProps {
    submissions: DashboardSubmission[];
    loading: boolean;
    itemVariants: Variants;
}

export default function RecentSubmissionsList({
    submissions,
    loading,
    itemVariants,
}: RecentSubmissionsListProps) {
    return (
        <motion.div
            variants={itemVariants}
            className="md:col-span-2 lg:col-span-4 glass-card rounded-3xl p-6"
        >
            <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-500" />
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                        Recent Submissions
                    </h2>
                </div>
                <Link
                    href="/student/submissions"
                    className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1"
                >
                    View All <ChevronRight className="w-4 h-4" />
                </Link>
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div
                            key={i}
                            className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 animate-pulse"
                        >
                            <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700" />
                            <div className="flex-1">
                                <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                                <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                            </div>
                            <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                        </div>
                    ))}
                </div>
            ) : submissions.length === 0 ? (
                <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">
                        No submissions yet
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {submissions.map((s) => (
                        <div
                            key={s.id}
                            className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                                <Code className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-medium text-gray-900 dark:text-white truncate">
                                    {s.practical_title}
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {s.language} • {new Date(s.created_at).toLocaleDateString()}
                                </p>
                            </div>
                            <StatusBadge status={s.status} />
                        </div>
                    ))}
                </div>
            )}
        </motion.div>
    );
}
