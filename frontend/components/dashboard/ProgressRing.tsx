"use client";

import { motion } from "framer-motion";

interface ProgressRingProps {
    progress: number;
    size?: number;
    strokeWidth?: number;
    showLabel?: boolean;
}

export default function ProgressRing({
    progress,
    size = 80,
    strokeWidth = 8,
    showLabel = true,
}: ProgressRingProps) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;

    // Standardize progress to 0-100
    const safeProgress = Math.min(100, Math.max(0, progress));

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="progress-ring -rotate-90">
                <circle
                    className="stroke-gray-200 dark:stroke-gray-700"
                    fill="transparent"
                    strokeWidth={strokeWidth}
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
                <motion.circle
                    className="progress-ring-circle"
                    stroke="url(#gradient)"
                    fill="transparent"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{
                        strokeDashoffset:
                            circumference - (safeProgress / 100) * circumference,
                    }}
                    transition={{ duration: 1.5, ease: "easeOut", delay: 0.5 }}
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
                <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="50%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                </defs>
            </svg>
            {showLabel && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <motion.span
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.8 }}
                        className="text-lg font-bold text-gray-900 dark:text-white"
                    >
                        {safeProgress}%
                    </motion.span>
                </div>
            )}
        </div>
    );
}
