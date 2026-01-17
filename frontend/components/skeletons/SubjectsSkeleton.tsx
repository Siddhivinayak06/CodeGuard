"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

export default function SubjectsSkeleton() {
    return (
        <div className="space-y-8 animate-pulse">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <Skeleton className="w-14 h-14 rounded-2xl" />
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-48 rounded-lg" />
                        <Skeleton className="h-4 w-64 rounded-md" />
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-10 w-56 rounded-xl hidden md:block" />
                    <Skeleton className="h-11 w-40 rounded-xl shadow-lg" />
                    <Skeleton className="h-9 w-24 rounded-lg" />
                </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="glass-card-premium rounded-3xl p-6 flex justify-between">
                        <div className="space-y-3">
                            <Skeleton className="h-3 w-24 rounded-full" />
                            <Skeleton className="h-8 w-20 rounded-lg" />
                        </div>
                        <Skeleton className="w-12 h-12 rounded-2xl" />
                    </div>
                ))}
            </div>

            {/* Main Unified Container */}
            <div className="glass-card-premium rounded-3xl overflow-hidden min-h-[500px]">
                <div className="grid grid-cols-1 lg:grid-cols-12">
                    {/* Sidebar */}
                    <aside className="lg:col-span-4 lg:border-r border-gray-100 dark:border-gray-800 p-4 space-y-4">
                        <div className="flex justify-between items-center mb-2">
                            <Skeleton className="h-5 w-32 rounded" />
                            <Skeleton className="h-6 w-8 rounded-lg" />
                        </div>
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-transparent">
                                <Skeleton className="w-10 h-10 rounded-lg" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-full rounded" />
                                    <Skeleton className="h-3 w-2/3 rounded" />
                                </div>
                                <Skeleton className="h-4 w-4 rounded" />
                            </div>
                        ))}
                    </aside>

                    {/* Main Content Area */}
                    <section className="lg:col-span-8 flex flex-col">
                        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-white/30 dark:bg-gray-800/20">
                            <div className="space-y-2">
                                <Skeleton className="h-6 w-48 rounded" />
                                <Skeleton className="h-4 w-32 rounded" />
                            </div>
                            <Skeleton className="h-9 w-32 rounded-lg" />
                        </div>
                        <div className="p-4 space-y-3">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 dark:border-gray-800">
                                    <div className="space-y-2 flex-1">
                                        <Skeleton className="h-5 w-1/3 rounded" />
                                        <Skeleton className="h-3 w-1/4 rounded" />
                                    </div>
                                    <div className="px-4">
                                        <Skeleton className="h-8 w-32 rounded-lg" />
                                    </div>
                                    <div className="flex gap-1">
                                        <Skeleton className="h-8 w-8 rounded-lg" />
                                        <Skeleton className="h-8 w-8 rounded-lg" />
                                    </div>
                                </div>
                            ))}
                            <Skeleton className="h-16 w-full rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700" />
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
