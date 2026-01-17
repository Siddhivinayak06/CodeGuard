"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

export default function AdminUsersSkeleton() {
    return (
        <div className="space-y-8 animate-pulse">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="w-14 h-14 rounded-2xl" />
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-48 rounded-lg" />
                        <Skeleton className="h-4 w-32 rounded-md" />
                    </div>
                </div>
                <Skeleton className="h-11 w-40 rounded-xl shadow-lg" />
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="glass-card rounded-2xl p-5 flex items-center gap-4">
                        <Skeleton className="w-12 h-12 rounded-xl" />
                        <div className="space-y-2">
                            <Skeleton className="h-7 w-12 rounded" />
                            <Skeleton className="h-3 w-16 rounded" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Filter Tabs & Search */}
            <div className="glass-card rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                    {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-9 w-24 rounded-lg" />
                    ))}
                </div>
                <Skeleton className="h-11 w-full sm:w-64 rounded-xl" />
            </div>

            {/* Users Table */}
            <div className="glass-card-premium rounded-3xl overflow-hidden">
                <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-gray-800/50">
                    <Skeleton className="h-4 w-16 rounded" />
                    <Skeleton className="h-4 w-16 rounded" />
                    <Skeleton className="h-4 w-24 rounded" />
                    <Skeleton className="h-4 w-12 rounded" />
                </div>
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="flex items-center justify-between p-5">
                            <div className="flex items-center gap-3">
                                <Skeleton className="w-10 h-10 rounded-xl" />
                                <Skeleton className="h-4 w-32 rounded" />
                            </div>
                            <Skeleton className="h-4 w-40 rounded hidden md:block" />
                            <Skeleton className="h-6 w-20 rounded-lg hidden sm:block" />
                            <div className="flex gap-2">
                                <Skeleton className="h-9 w-9 rounded-lg" />
                                <Skeleton className="h-9 w-9 rounded-lg" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
