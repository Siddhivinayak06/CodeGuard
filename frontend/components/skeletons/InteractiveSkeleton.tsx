"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function InteractiveSkeleton() {
    return (
        <div className="flex flex-col h-screen overflow-hidden bg-gradient-to-br from-slate-50 via-indigo-50/40 to-purple-50/40 dark:from-gray-950 dark:via-indigo-950/20 dark:to-purple-950/20 relative">
            {/* Ambient Mesh Background */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-400/20 dark:bg-purple-600/10 rounded-full blur-3xl" />
                <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-indigo-400/20 dark:bg-indigo-600/10 rounded-full blur-3xl" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-r from-cyan-400/10 via-purple-400/10 to-pink-400/10 dark:from-cyan-600/5 dark:via-purple-600/5 dark:to-pink-600/5 rounded-full blur-3xl" />
            </div>

            {/* Main Container (below navbar) */}
            <div className="flex-1 mt-16 p-5 h-[calc(100vh-4rem)] w-full relative z-10 animate-pulse">
                <div className="h-full w-full glass-card-premium rounded-3xl overflow-hidden shadow-2xl flex flex-col">

                    {/* Editor Panel (60%) */}
                    <div className="flex-[0.6] bg-white/40 dark:bg-gray-900/40 relative">
                        {/* Editor Header/Toolbar */}
                        <div className="px-4 py-3 border-b border-gray-200/30 dark:border-gray-700/30 flex items-center justify-between bg-white/60 dark:bg-gray-900/60">
                            <div className="flex items-center gap-3">
                                {/* File tabs */}
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-8 w-24 rounded-lg" />
                                    <Skeleton className="h-8 w-20 rounded-lg" />
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {/* Language selector */}
                                <Skeleton className="h-8 w-28 rounded-lg" />
                                {/* Run button */}
                                <Skeleton className="h-9 w-20 rounded-xl" />
                                {/* More actions */}
                                <Skeleton className="h-9 w-9 rounded-lg" />
                            </div>
                        </div>

                        {/* Code Area */}
                        <div className="p-4 space-y-3">
                            {/* Line numbers + code lines */}
                            <div className="flex gap-4">
                                <div className="space-y-2 text-right opacity-40">
                                    {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                                        <Skeleton key={i} className="h-4 w-4 rounded" />
                                    ))}
                                </div>
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-[85%] rounded" />
                                    <Skeleton className="h-4 w-[60%] rounded" />
                                    <Skeleton className="h-4 w-[75%] rounded" />
                                    <Skeleton className="h-4 w-[90%] rounded" />
                                    <Skeleton className="h-4 w-[50%] rounded" />
                                    <Skeleton className="h-4 w-[70%] rounded" />
                                    <Skeleton className="h-4 w-[40%] rounded" />
                                    <Skeleton className="h-4 w-[65%] rounded" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Resizable Handle */}
                    <div className="h-3 bg-gradient-to-r from-transparent via-gray-200/60 to-transparent dark:via-gray-700/40 flex items-center justify-center">
                        <div className="w-12 h-1 rounded-full bg-gray-300/80 dark:bg-gray-600/80" />
                    </div>

                    {/* Terminal Panel (40%) */}
                    <div className="flex-[0.4] bg-gradient-to-b from-gray-50/60 to-gray-100/40 dark:from-gray-900/60 dark:to-gray-950/80 flex flex-col">
                        {/* Terminal Header */}
                        <div className="px-4 py-2.5 bg-gradient-to-r from-gray-100/80 via-gray-50/60 to-gray-100/80 dark:from-gray-800/80 dark:via-gray-900/60 dark:to-gray-800/80 border-b border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                {/* Traffic light buttons */}
                                <div className="flex items-center gap-1.5">
                                    <div className="w-3 h-3 rounded-full bg-red-400/60" />
                                    <div className="w-3 h-3 rounded-full bg-amber-400/60" />
                                    <div className="w-3 h-3 rounded-full bg-emerald-400/60" />
                                </div>
                                <Skeleton className="h-4 w-16 rounded" />
                            </div>
                            <Skeleton className="h-6 w-16 rounded-full" />
                        </div>

                        {/* Terminal Content */}
                        <div className="flex-1 p-4 font-mono space-y-2">
                            <div className="flex items-center gap-2">
                                <span className="text-emerald-500/50 text-sm">$</span>
                                <Skeleton className="h-4 w-[30%] rounded bg-gray-200/30 dark:bg-gray-800/50" />
                            </div>
                            <Skeleton className="h-4 w-[60%] rounded bg-gray-200/30 dark:bg-gray-800/50" />
                            <Skeleton className="h-4 w-[45%] rounded bg-gray-200/30 dark:bg-gray-800/50" />
                            <Skeleton className="h-4 w-[55%] rounded bg-gray-200/30 dark:bg-gray-800/50" />
                            <div className="flex items-center gap-2 mt-4">
                                <span className="text-emerald-500/50 text-sm">$</span>
                                <Skeleton className="h-4 w-2 rounded animate-pulse bg-emerald-400/40" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
