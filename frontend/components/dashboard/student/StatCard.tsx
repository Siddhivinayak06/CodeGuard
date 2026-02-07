"use client";

import { motion, Variants } from "framer-motion";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
    label: string;
    value: string | number;
    icon: LucideIcon;
    colorClass: string;
    itemVariants: Variants;
    loading?: boolean;
}

export default function StatCard({
    label,
    value,
    icon: Icon,
    colorClass,
    itemVariants,
    loading = false,
}: StatCardProps) {
    // Map color classes to background classes for the icon container
    const getBgClass = (color: string) => {
        if (color.includes("emerald")) return "bg-emerald-100 dark:bg-emerald-900/30";
        if (color.includes("red")) return "bg-red-100 dark:bg-red-900/30";
        if (color.includes("blue")) return "bg-blue-100 dark:bg-blue-900/30";
        if (color.includes("pink")) return "bg-pink-100 dark:bg-pink-900/30";
        return "bg-gray-100 dark:bg-gray-800";
    };

    return (
        <motion.div
            variants={itemVariants}
            className="glass-card rounded-2xl p-5 flex items-center gap-4"
        >
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${getBgClass(colorClass)}`}>
                <Icon className={`w-6 h-6 ${colorClass}`} />
            </div>
            <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {loading ? "--" : value}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                    {label}
                </p>
            </div>
        </motion.div>
    );
}
