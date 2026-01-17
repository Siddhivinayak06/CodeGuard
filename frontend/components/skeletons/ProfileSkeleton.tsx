"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

export default function ProfileSkeleton() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
            <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 xl:px-12 w-full mx-auto max-w-7xl">
                {/* Header */}
                <div className="mb-8 space-y-3">
                    <Skeleton className="h-10 w-64 rounded-xl" />
                    <Skeleton className="h-5 w-80 rounded-lg" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: User Card & Status */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* User Card */}
                        <div className="glass-card-premium rounded-3xl p-6 flex flex-col items-center text-center relative overflow-hidden">
                            <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 opacity-10" />
                            <div className="relative mt-8 mb-4">
                                <Skeleton className="w-28 h-28 rounded-full" />
                                <div className="absolute bottom-4 right-0 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800" />
                            </div>
                            <Skeleton className="h-7 w-40 mb-2 rounded-lg" />
                            <Skeleton className="h-4 w-56 mb-6 rounded-md" />
                            <div className="flex gap-2">
                                <Skeleton className="h-6 w-20 rounded-full" />
                                <Skeleton className="h-6 w-20 rounded-full" />
                            </div>
                        </div>

                        {/* Account Status */}
                        <div className="glass-card rounded-3xl p-6 space-y-6">
                            <div className="flex items-center gap-2">
                                <Skeleton className="w-5 h-5 rounded-md" />
                                <Skeleton className="h-6 w-32 rounded-md" />
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-6 w-28 rounded-full" />
                                </div>
                                <div className="border-t border-gray-100 dark:border-gray-800 pt-3 flex justify-between items-center">
                                    <Skeleton className="h-4 w-24" />
                                    <Skeleton className="h-4 w-20" />
                                </div>
                                <div className="border-t border-gray-100 dark:border-gray-800 pt-3 flex justify-between items-center">
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-4 w-24" />
                                </div>
                            </div>
                        </div>

                        {/* Preferences */}
                        <div className="glass-card rounded-3xl p-6 space-y-6">
                            <div className="flex items-center gap-2">
                                <Skeleton className="w-5 h-5 rounded-md" />
                                <Skeleton className="h-6 w-32 rounded-md" />
                            </div>
                            <div className="space-y-5">
                                {[1, 2].map((i) => (
                                    <div key={i} className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Skeleton className="w-8 h-8 rounded-lg" />
                                            <div className="space-y-1">
                                                <Skeleton className="h-4 w-32" />
                                                <Skeleton className="h-3 w-40" />
                                            </div>
                                        </div>
                                        <Skeleton className="w-11 h-6 rounded-full" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Forms */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Personal Info Form */}
                        <div className="glass-card rounded-3xl p-8 space-y-8">
                            <div className="flex items-center gap-2">
                                <Skeleton className="w-5 h-5 rounded-md" />
                                <Skeleton className="h-7 w-48 rounded-md" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="space-y-2">
                                        <Skeleton className="h-4 w-24" />
                                        <Skeleton className="h-11 w-full rounded-xl" />
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-end">
                                <Skeleton className="h-11 w-36 rounded-xl" />
                            </div>
                        </div>

                        {/* Security Form */}
                        <div className="glass-card rounded-3xl p-8 space-y-8">
                            <div className="flex items-center gap-2">
                                <Skeleton className="w-5 h-5 rounded-md" />
                                <Skeleton className="h-7 w-32 rounded-md" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-28" />
                                    <Skeleton className="h-11 w-full rounded-xl" />
                                </div>
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-11 w-full rounded-xl" />
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <Skeleton className="h-11 w-40 rounded-xl" />
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
