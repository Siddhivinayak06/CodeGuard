"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

export default function PracticalsSkeleton() {
    return (
        <div className="space-y-8">
            {/* Header Skeleton */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-xl" />
                    <div className="space-y-2">
                        <Skeleton className="h-8 w-48 rounded-lg" />
                        <Skeleton className="h-4 w-64 rounded-lg" />
                    </div>
                </div>
                <Skeleton className="h-11 w-44 rounded-xl shadow-sm" />
            </div>

            {/* Filter & Search Skeleton */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <Skeleton className="h-10 w-40 rounded-lg" />
                    <Skeleton className="h-10 w-32 rounded-lg" />
                </div>
                <Skeleton className="h-12 w-full rounded-xl" />
            </div>

            {/* Practicals List Skeleton */}
            <div className="space-y-5">
                {[1, 2, 3].map((i) => (
                    <div
                        key={i}
                        className="relative flex flex-col p-6 rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden"
                    >
                        {/* Status stripe skeleton */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-200 dark:bg-gray-800" />

                        <div className="flex items-start justify-between gap-6">
                            <div className="flex-1 space-y-4">
                                {/* Title */}
                                <Skeleton className="h-7 w-3/4 rounded-lg" />

                                {/* Badges */}
                                <div className="flex gap-2">
                                    <Skeleton className="h-7 w-24 rounded-full" />
                                    <Skeleton className="h-7 w-20 rounded-full" />
                                    <Skeleton className="h-7 w-16 rounded-full" />
                                </div>

                                {/* Description */}
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-full rounded-md" />
                                    <Skeleton className="h-4 w-[90%] rounded-md" />
                                </div>

                                {/* Footer info */}
                                <div className="flex gap-4">
                                    <Skeleton className="h-4 w-32 rounded-md" />
                                    <Skeleton className="h-4 w-24 rounded-md" />
                                </div>
                            </div>

                            {/* Action Menu & Points */}
                            <div className="flex flex-col items-end gap-4">
                                <Skeleton className="h-9 w-9 rounded-lg" />
                                <Skeleton className="h-10 w-16 rounded-lg" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
