"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

interface SubmissionsSkeletonProps {
    type?: "faculty" | "student";
}

export default function SubmissionsSkeleton({ type = "faculty" }: SubmissionsSkeletonProps) {
    return (
        <div className="space-y-8 animate-pulse">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Skeleton className="w-12 h-12 rounded-xl" />
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-48 rounded-lg" />
                        <Skeleton className="h-4 w-64 rounded-md" />
                    </div>
                </div>
                <Skeleton className="h-11 w-64 rounded-xl" />
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="glass-card rounded-2xl p-5 flex items-center gap-4">
                        <Skeleton className="w-12 h-12 rounded-xl" />
                        <div className="space-y-2">
                            <Skeleton className="h-8 w-12 rounded" />
                            <Skeleton className="h-3 w-16 rounded" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Content Area */}
            <div className="glass-card-premium rounded-3xl overflow-hidden flex flex-col min-h-[600px]">
                {/* Toolbar */}
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/40 dark:bg-gray-800/40">
                    <div className="flex items-center gap-2 overflow-x-auto w-full sm:w-auto">
                        <Skeleton className="h-10 w-24 rounded-xl" />
                        <Skeleton className="h-10 w-24 rounded-xl" />
                        <Skeleton className="h-10 w-24 rounded-xl" />
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <Skeleton className="h-10 w-32 rounded-lg hidden sm:block" />
                        <Skeleton className="h-10 w-48 rounded-lg" />
                    </div>
                </div>

                <div className="p-4 space-y-4 flex-1">
                    {type === "faculty" ? (
                        /* Table Layout for Faculty */
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[1000px]">
                                <thead className="bg-gray-50/50 dark:bg-gray-800/50">
                                    <tr>
                                        {[1, 2, 3, 4, 5, 6].map((i) => (
                                            <th key={i} className="px-6 py-4">
                                                <Skeleton className="h-4 w-20 rounded" />
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                                    {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                                        <tr key={i}>
                                            <td className="px-6 py-4 flex items-center gap-3">
                                                <Skeleton className="w-10 h-10 rounded-xl" />
                                                <div className="space-y-1">
                                                    <Skeleton className="h-4 w-24 rounded" />
                                                    <Skeleton className="h-3 w-32 rounded" />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <Skeleton className="h-4 w-32 rounded" />
                                                <Skeleton className="h-3 w-12 rounded mt-1" />
                                            </td>
                                            <td className="px-6 py-4">
                                                <Skeleton className="h-7 w-24 rounded-lg" />
                                            </td>
                                            <td className="px-6 py-4">
                                                <Skeleton className="h-6 w-8 rounded mx-auto" />
                                            </td>
                                            <td className="px-6 py-4">
                                                <Skeleton className="h-4 w-16 rounded" />
                                            </td>
                                            <td className="px-6 py-4 flex justify-end gap-2">
                                                <Skeleton className="h-8 w-8 rounded-lg" />
                                                <Skeleton className="h-8 w-8 rounded-lg" />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        /* Card Layout for Student */
                        <div className="space-y-4">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="p-4 rounded-xl glass-card border-l-4 border-gray-200 dark:border-gray-700 flex flex-col md:flex-row items-start md:items-center gap-4">
                                    <Skeleton className="w-12 h-12 rounded-xl" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-5 w-48 rounded" />
                                        <div className="flex gap-2">
                                            <Skeleton className="h-6 w-20 rounded-lg" />
                                            <Skeleton className="h-4 w-24 rounded" />
                                            <Skeleton className="h-4 w-16 rounded" />
                                        </div>
                                    </div>
                                    <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
                                        <Skeleton className="h-9 w-24 rounded-lg" />
                                        <Skeleton className="h-9 w-12 rounded-lg" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
