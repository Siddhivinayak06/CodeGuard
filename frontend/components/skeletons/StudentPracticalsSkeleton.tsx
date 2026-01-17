"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

export default function StudentPracticalsSkeleton() {
    return (
        <div className="space-y-8 animate-pulse">
            {/* Header section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="w-14 h-14 rounded-2xl" />
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-64 rounded-lg" />
                        <Skeleton className="h-4 w-48 rounded-md" />
                    </div>
                </div>
                <Skeleton className="h-11 w-48 rounded-xl" />
            </div>

            {/* Stats Dashboard */}
            <div className="glass-card-premium rounded-3xl p-8 overflow-hidden relative">
                <div className="flex flex-col lg:flex-row items-center gap-8 lg:gap-12">
                    {/* Progress Ring Skeleton */}
                    <div className="relative w-24 h-24 flex items-center justify-center">
                        <Skeleton className="w-24 h-24 rounded-full border-8 border-gray-100 dark:border-gray-800" />
                        <Skeleton className="absolute w-12 h-6 rounded" />
                    </div>

                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-6 w-full">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="text-center space-y-2">
                                <Skeleton className="h-8 w-12 mx-auto rounded" />
                                <Skeleton className="h-3 w-16 mx-auto rounded-full" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex p-1 space-x-1 bg-white/50 dark:bg-gray-800/50 rounded-xl overflow-x-auto w-full sm:w-auto">
                    {[1, 2, 3, 4].map((i) => (
                        <Skeleton key={i} className="h-9 w-24 rounded-lg" />
                    ))}
                </div>
                <Skeleton className="h-11 w-full sm:w-72 rounded-xl" />
            </div>

            {/* Practicals List */}
            <div className="grid grid-cols-1 gap-4">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="glass-card-premium rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-5">
                        <Skeleton className="w-14 h-14 rounded-xl shrink-0" />
                        <div className="flex-1 space-y-3 min-w-0 w-full">
                            <div className="flex items-center justify-between gap-2">
                                <Skeleton className="h-6 w-48 rounded" />
                                <Skeleton className="h-6 w-24 rounded-lg" />
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <Skeleton className="h-4 w-32 rounded" />
                                <Skeleton className="h-4 w-4 rounded-full" />
                                <Skeleton className="h-4 w-24 rounded" />
                                <Skeleton className="h-4 w-20 rounded" />
                            </div>
                        </div>
                        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
                            <Skeleton className="h-10 w-full sm:w-28 rounded-xl" />
                            <Skeleton className="h-10 w-10 rounded-lg" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
