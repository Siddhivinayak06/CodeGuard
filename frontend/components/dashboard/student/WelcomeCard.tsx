"use client";

import Link from "next/link";
import { Code } from "lucide-react";
import { motion, Variants } from "framer-motion";

interface WelcomeCardProps {
    userName: string;
    passedPracticals: number;
    itemVariants: Variants;
}

export default function WelcomeCard({ userName, passedPracticals, itemVariants }: WelcomeCardProps) {
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 17) return "Good afternoon";
        return "Good evening";
    };

    return (
        <motion.div
            variants={itemVariants}
            className="md:col-span-2 glass-card-premium rounded-3xl p-8 relative overflow-hidden"
        >
            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-indigo-500/20 via-purple-500/10 to-transparent rounded-full blur-3xl" />
            <div className="relative z-10">
                <p className="text-gray-500 dark:text-gray-400 mb-1">
                    {getGreeting()},
                </p>
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                    {userName || "Student"} 👋
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                    {passedPracticals > 0
                        ? `You've passed ${passedPracticals} practicals. Keep going!`
                        : "Ready to start coding? Let's get productive today!"}
                </p>
                <Link
                    href="/Interactive"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all"
                >
                    <Code className="w-4 h-4" />
                    Open Editor
                </Link>
            </div>
        </motion.div>
    );
}
