"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function StudentDashboardSkeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-pulse">
            {/* ===== WELCOME CARD - Large (2x1) ===== */}
            <div className="md:col-span-2 glass-card-premium rounded-3xl p-8 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-indigo-500/10 via-purple-500/5 to-transparent rounded-full blur-3xl" />
                <div className="relative z-10 space-y-4">
                    <Skeleton className="h-4 w-32 rounded" />
                    <Skeleton className="h-10 w-56 rounded-xl" />
                    <Skeleton className="h-4 w-72 rounded" />
                    <Skeleton className="h-11 w-36 rounded-xl mt-4" />
                </div>
            </div>

            {/* ===== OVERALL PROGRESS - Square ===== */}
            <div className="glass-card-premium rounded-3xl p-6 flex flex-col items-center justify-center text-center">
                <Skeleton className="w-24 h-24 rounded-full" />
                <Skeleton className="h-5 w-32 rounded mt-4" />
                <Skeleton className="h-4 w-20 rounded mt-2" />
            </div>

            {/* ===== SEMESTER INFO - Square ===== */}
            <div className="glass-card rounded-3xl p-6 flex flex-col items-center justify-center text-center bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20">
                <Skeleton className="w-14 h-14 rounded-2xl" />
                <Skeleton className="h-8 w-20 rounded mt-3" />
                <Skeleton className="h-4 w-28 rounded mt-2" />
            </div>

            {/* ===== SMALL STAT CARDS (4 cards) ===== */}
            {[1, 2, 3, 4].map((i) => (
                <div key={i} className="glass-card rounded-2xl p-5 flex items-center gap-4">
                    <Skeleton className="w-12 h-12 rounded-xl" />
                    <div className="space-y-2">
                        <Skeleton className="h-7 w-10 rounded" />
                        <Skeleton className="h-3 w-16 rounded" />
                    </div>
                </div>
            ))}

            {/* ===== QUICK ACTIONS - Wide (2x1) ===== */}
            <div className="md:col-span-2 grid grid-cols-2 gap-4">
                {[1, 2].map((i) => (
                    <div key={i} className="glass-card rounded-2xl p-5 flex items-center gap-4">
                        <Skeleton className="w-12 h-12 rounded-xl" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-5 w-24 rounded" />
                            <Skeleton className="h-3 w-20 rounded" />
                        </div>
                        <Skeleton className="w-5 h-5 rounded" />
                    </div>
                ))}
            </div>

            {/* ===== SUBJECT PROGRESS - Wide (2x1) ===== */}
            <div className="md:col-span-2 glass-card rounded-3xl p-6">
                <div className="flex items-center gap-2 mb-5">
                    <Skeleton className="w-5 h-5 rounded" />
                    <Skeleton className="h-6 w-40 rounded" />
                </div>
                <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50/50 dark:bg-gray-800/30">
                            <Skeleton className="w-10 h-10 rounded-lg" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-full max-w-[200px] rounded" />
                                <Skeleton className="h-2 w-full rounded-full" />
                            </div>
                            <Skeleton className="h-6 w-12 rounded" />
                        </div>
                    ))}
                </div>
            </div>

            {/* ===== RECENT SUBMISSIONS - Wide (2x1) ===== */}
            <div className="md:col-span-2 glass-card rounded-3xl p-6">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                        <Skeleton className="w-5 h-5 rounded" />
                        <Skeleton className="h-6 w-44 rounded" />
                    </div>
                    <Skeleton className="h-4 w-16 rounded" />
                </div>
                <div className="space-y-3">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="flex items-center gap-4 p-3 rounded-xl bg-gray-50/50 dark:bg-gray-800/30">
                            <Skeleton className="w-10 h-10 rounded-xl" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-40 rounded" />
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-3 w-12 rounded" />
                                    <Skeleton className="h-3 w-3 rounded-full" />
                                    <Skeleton className="h-3 w-20 rounded" />
                                </div>
                            </div>
                            <Skeleton className="h-6 w-16 rounded-lg" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
