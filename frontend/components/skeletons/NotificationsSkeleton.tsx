"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

export default function NotificationsSkeleton() {
    return (
        <div className="space-y-8">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                    <Skeleton className="h-10 w-48 rounded-xl" />
                    <Skeleton className="h-5 w-72 rounded-lg" />
                </div>
                <div className="flex gap-3">
                    <Skeleton className="h-10 w-32 rounded-lg" />
                    <Skeleton className="h-10 w-40 rounded-lg" />
                </div>
            </div>

            {/* Tabs / Filters */}
            <div className="flex gap-4 border-b border-gray-200 dark:border-gray-800 pb-1">
                <Skeleton className="h-8 w-20 rounded-t-lg" />
                <Skeleton className="h-8 w-24 rounded-t-lg" />
            </div>

            {/* Notifications List */}
            <div className="space-y-4">
                {[1, 2, 3, 4, 5].map((i) => (
                    <div
                        key={i}
                        className="glass-card rounded-2xl p-5 flex items-start gap-4 border border-gray-100 dark:border-gray-800"
                    >
                        <Skeleton className="w-12 h-12 rounded-xl flex-shrink-0" />
                        <div className="flex-1 space-y-3">
                            <div className="flex justify-between items-start">
                                <Skeleton className="h-5 w-1/3 rounded-md" />
                                <Skeleton className="h-4 w-20 rounded-md" />
                            </div>
                            <Skeleton className="h-4 w-full rounded-md" />
                            <div className="flex gap-4">
                                <Skeleton className="h-4 w-24 rounded-md" />
                                <Skeleton className="h-4 w-32 rounded-md" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
