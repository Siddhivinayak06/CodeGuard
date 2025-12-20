"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

export default function FacultyDashboardSkeleton() {
    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1,
            },
        },
    };

    const itemVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1 },
    };

    return (
        <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6"
        >
            {/* 1. Quick Stats (Row 1) - 4 cards */}
            {[...Array(4)].map((_, i) => (
                <motion.div key={i} variants={itemVariants} className="glass-card-premium rounded-3xl p-6 flex items-center justify-between">
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-8 w-16" />
                    </div>
                    <Skeleton className="w-12 h-12 rounded-2xl" />
                </motion.div>
            ))}

            {/* 2. Charts Row (Row 2, split 3:1) */}
            {/* Activity Chart skeleton */}
            <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-3 glass-card rounded-3xl p-6 min-h-[350px]">
                <Skeleton className="h-6 w-48 mb-6" />
                <Skeleton className="h-[250px] w-full rounded-2xl" />
            </motion.div>

            {/* Status Donut skeleton */}
            <motion.div variants={itemVariants} className="md:col-span-1 glass-card rounded-3xl p-6 flex flex-col">
                <Skeleton className="h-6 w-40 mb-4" />
                <div className="flex-1 flex items-center justify-center">
                    <Skeleton className="h-40 w-40 rounded-full" />
                </div>
            </motion.div>

            {/* 3. Main Content: List & Calendar */}
            {/* Practicals List skeleton */}
            <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-3 glass-card rounded-3xl p-6 min-h-[400px]">
                <Skeleton className="h-6 w-32 mb-6" />
                <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-24 w-full rounded-2xl" />
                    ))}
                </div>
            </motion.div>

            {/* Calendar skeleton */}
            <motion.div variants={itemVariants} className="md:col-span-1 glass-card rounded-3xl p-6">
                <Skeleton className="h-6 w-24 mb-4" />
                <Skeleton className="h-[300px] w-full rounded-xl" />
                <div className="mt-6 space-y-3">
                    <Skeleton className="h-3 w-32 mb-2" />
                    {[...Array(2)].map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full rounded-xl" />
                    ))}
                </div>
            </motion.div>
        </motion.div>
    );
}
