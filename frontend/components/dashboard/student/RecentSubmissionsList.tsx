"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { motion, Variants } from "framer-motion";
import { FileText, ChevronRight, ChevronDown } from "lucide-react";
import StatusBadge from "@/components/dashboard/StatusBadge";
import { DashboardSubmission } from "@/types/dashboard";

interface GroupedSub {
    practical_id: number;
    practical_title: string;
    subject_code?: string;
    language: string;
    created_at: string;
    overallStatus: string;
    submissions: DashboardSubmission[];
}

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
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    const toggleGroup = (key: string) => {
        setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const getLanguageColor = (lang: string) => {
        switch (lang?.toLowerCase()) {
            case "python": return "from-yellow-400 to-blue-500";
            case "java": return "from-red-500 to-orange-500";
            case "c": return "from-blue-500 to-cyan-500";
            case "cpp": return "from-blue-600 to-blue-400";
            case "javascript": return "from-yellow-300 to-yellow-500";
            default: return "from-cyan-400 to-sky-600";
        }
    };

    const grouped = useMemo(() => {
        const map = new Map<number, GroupedSub>();

        submissions.forEach(sub => {
            const pid = sub.practical_id;
            if (!map.has(pid)) {
                map.set(pid, {
                    practical_id: pid,
                    practical_title: sub.practical_title,
                    subject_code: sub.subject_code,
                    language: sub.language,
                    created_at: sub.created_at,
                    overallStatus: "pending",
                    submissions: [],
                });
            }
            const group = map.get(pid)!;
            group.submissions.push(sub);
            if (new Date(sub.created_at) > new Date(group.created_at)) {
                group.created_at = sub.created_at;
            }
        });

        map.forEach(group => {
            const hasFailed = group.submissions.some(s => s.status === "failed");
            const hasPending = group.submissions.some(s => !["passed", "completed", "failed"].includes(s.status));
            const allPassed = group.submissions.every(s => s.status === "passed" || s.status === "completed");

            if (allPassed) group.overallStatus = "passed";
            else if (hasFailed) group.overallStatus = "failed";
            else if (hasPending) group.overallStatus = "pending";
        });

        return Array.from(map.values());
    }, [submissions]);

    const getStatusAccent = (status: string) => {
        if (status === "passed") return "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]";
        if (status === "failed") return "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]";
        if (status === "pending" || status === "submitted") return "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]";
        return "bg-gray-300 dark:bg-gray-600";
    };

    return (
        <motion.div
            variants={itemVariants}
            className="md:col-span-2 lg:col-span-4 glass-card-premium rounded-3xl overflow-hidden"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-500" />
                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                        Recent Submissions
                    </h2>
                </div>
                <Link
                    href="/student/submissions"
                    className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors"
                >
                    View All <ChevronRight className="w-4 h-4" />
                </Link>
            </div>

            {loading ? (
                <div className="p-6 space-y-3">
                    {[1, 2, 3, 4, 5].map((i) => (
                        <div
                            key={i}
                            className="flex items-center gap-4 p-3 rounded-xl animate-pulse"
                        >
                            <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                        </div>
                    ))}
                </div>
            ) : submissions.length === 0 ? (
                <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400">
                        No submissions yet
                    </p>
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800">
                            <tr>
                                <th className="px-6 py-3 font-semibold tracking-wider">Date</th>
                                <th className="px-6 py-3 font-semibold tracking-wider">Time</th>
                                <th className="px-6 py-3 font-semibold tracking-wider">Subject</th>
                                <th className="px-6 py-3 font-semibold tracking-wider">Practical</th>
                                <th className="px-6 py-3 font-semibold tracking-wider">Language</th>
                                <th className="px-6 py-3 font-semibold tracking-wider text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100/50 dark:divide-gray-800/50">
                            {grouped.map((group) => {
                                const isMulti = group.submissions.length > 1;
                                const isExpanded = expandedGroups[group.practical_id.toString()];
                                const date = new Date(group.created_at);

                                return (
                                    <Fragment key={`group-${group.practical_id}`}>
                                        {/* Group header row */}
                                        <tr
                                            className={`group transition-all duration-200 relative ${isMulti ? "cursor-pointer hover:bg-gray-50/50 dark:hover:bg-gray-800/20" : "hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 cursor-pointer"}`}
                                            onClick={() => isMulti ? toggleGroup(group.practical_id.toString()) : window.location.href = "/student/submissions"}
                                        >
                                            <td className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full transition-all ${getStatusAccent(group.overallStatus)}`} />

                                            <td className="px-6 py-3.5 font-mono text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                                                {isMulti && (
                                                    <span className={`text-gray-400 transition-transform duration-200 ${isExpanded ? "rotate-180" : "rotate-0"}`}>
                                                        <ChevronDown className="w-4 h-4" />
                                                    </span>
                                                )}
                                                {date.toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-3.5 font-mono text-xs text-gray-500 dark:text-gray-400">
                                                {date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                            </td>
                                            <td className="px-6 py-3.5 font-medium text-gray-900 dark:text-gray-200">
                                                {group.subject_code || "—"}
                                            </td>
                                            <td className="px-6 py-3.5 max-w-[200px]" title={group.practical_title}>
                                                <div className="font-medium text-gray-800 dark:text-gray-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                    {group.practical_title}
                                                    {isMulti && (
                                                        <span className="ml-2 text-[10px] font-bold uppercase tracking-wider text-purple-600 bg-purple-100 dark:bg-purple-900/30 px-1.5 py-0.5 rounded">
                                                            {group.submissions.length} tasks
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-3.5">
                                                <div className="flex items-center gap-1.5">
                                                    <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${getLanguageColor(group.language)}`} />
                                                    <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                                                        {group.language}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-3.5 text-center">
                                                <StatusBadge status={group.overallStatus} />
                                            </td>
                                        </tr>

                                        {/* Expanded sub-rows */}
                                        {isMulti && isExpanded && group.submissions.map((sub, idx) => (
                                            <tr
                                                key={sub.id}
                                                className="bg-gray-50/30 dark:bg-gray-800/10 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors cursor-pointer"
                                                onClick={() => window.location.href = "/student/submissions"}
                                            >
                                                <td colSpan={1} className="pl-12 py-2.5 border-l-2 border-indigo-200 dark:border-indigo-800 leading-none">
                                                    <div className="w-4 h-4 rounded-bl-xl border-b-2 border-l-2 border-gray-200 dark:border-gray-700 -mt-4" />
                                                </td>
                                                <td className="py-2.5 px-6" />
                                                <td colSpan={2} className="py-2.5 px-6">
                                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                                        {sub.level_title || `Task ${idx + 1}`}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-6 text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-semibold">
                                                    {sub.language}
                                                </td>
                                                <td className="py-2.5 px-6 text-center">
                                                    <StatusBadge status={sub.status} />
                                                </td>
                                            </tr>
                                        ))}
                                    </Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </motion.div>
    );
}
