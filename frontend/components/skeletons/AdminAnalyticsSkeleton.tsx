"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

export default function AdminAnalyticsSkeleton() {
    return (
        <div className="space-y-8 animate-pulse">
            {/* Header Loading */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <Skeleton className="w-14 h-14 rounded-2xl" />
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-64 rounded-lg" />
                        <Skeleton className="h-4 w-48 rounded-md" />
                    </div>
                </div>
                <Skeleton className="h-11 w-32 rounded-xl" />
            </div>

            {/* Overview Stats Loading */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="glass-card-premium rounded-3xl p-6 flex justify-between">
                        <div className="space-y-3">
                            <Skeleton className="h-3 w-20 rounded-full" />
                            <Skeleton className="h-8 w-16 rounded-lg" />
                            <Skeleton className="h-3 w-32 rounded-full" />
                        </div>
                        <Skeleton className="w-12 h-12 rounded-2xl" />
                    </div>
                ))}
            </div>

            {/* Submission Status Row Loading */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="glass-card-premium rounded-3xl p-6 flex justify-between items-center">
                        <div className="space-y-2">
                            <Skeleton className="h-3 w-16 rounded-full" />
                            <Skeleton className="h-8 w-12 rounded-lg" />
                        </div>
                        <Skeleton className="w-10 h-10 rounded-xl" />
                    </div>
                ))}
            </div>

            {/* Charts Loading */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {[1, 2].map((i) => (
                    <div key={i} className="glass-card-premium rounded-3xl p-6">
                        <Skeleton className="h-6 w-48 rounded-lg mb-6" />
                        <Skeleton className="h-64 w-full rounded-2xl" />
                    </div>
                ))}
            </div>

            {/* Bottom Row Loading */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="glass-card-premium rounded-3xl p-6">
                        <Skeleton className="h-5 w-40 rounded-lg mb-6" />
                        <div className="space-y-4">
                            {[1, 2, 3, 4].map((j) => (
                                <div key={j} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-gray-800/30">
                                    <Skeleton className="h-10 w-10 rounded-lg" />
                                    <div className="flex-1 space-y-2">
                                        <Skeleton className="h-4 w-full rounded" />
                                        <Skeleton className="h-3 w-2/3 rounded" />
                                    </div>
                                    <Skeleton className="h-6 w-8 rounded" />
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
