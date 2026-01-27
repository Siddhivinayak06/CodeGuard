"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

export default function StudentPracticalsSkeleton() {
    return (
        <div className="space-y-8 animate-pulse">
            {/* Header section - Matches page.tsx */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
                <div>
                    <Skeleton className="h-9 w-64 rounded-lg mb-2" />
                    <Skeleton className="h-5 w-48 rounded-md" />
                </div>
                <Skeleton className="h-10 w-full md:w-80 rounded-xl" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
                {/* Sidebar Skeleton (Desktop) / Mobile Nav (Mobile) */}
                <div className="md:col-span-3 lg:col-span-3 space-y-4">
                    {/* Mobile Nav Placeholder */}
                    <div className="md:hidden flex gap-2 overflow-hidden pb-2">
                        {[1, 2, 3].map(i => (
                            <Skeleton key={i} className="h-9 w-28 rounded-full shrink-0" />
                        ))}
                    </div>

                    {/* Desktop Sidebar Placeholder */}
                    <div className="hidden md:block bg-white/60 dark:bg-gray-900/40 rounded-2xl border border-white/20 dark:border-gray-800 p-4 space-y-3">
                        <div className="flex items-center gap-2 mb-4">
                            <Skeleton className="w-4 h-4 rounded" />
                            <Skeleton className="w-20 h-4 rounded" />
                        </div>
                        {[1, 2, 3, 4, 5].map(i => (
                            <Skeleton key={i} className="h-12 w-full rounded-xl" />
                        ))}
                    </div>
                </div>

                {/* Main Content Skeleton */}
                <div className="md:col-span-9 lg:col-span-9 space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {[1, 2, 3, 4].map(i => (
                            <Skeleton key={i} className="h-24 w-full rounded-2xl" />
                        ))}
                    </div>

                    {/* Filters */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <Skeleton className="h-7 w-40 rounded-lg" />
                        <Skeleton className="h-10 w-full sm:w-96 rounded-xl" />
                    </div>

                    {/* List */}
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map(i => (
                            <Skeleton key={i} className="h-40 w-full rounded-2xl" />
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
