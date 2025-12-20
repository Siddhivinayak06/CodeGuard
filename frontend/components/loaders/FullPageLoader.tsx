"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import LogoLoader from "./LogoLoader";

const statusMessages = [
    "Securing environment...",
    "Initializing workspace...",
    "Compiling system logic...",
    "Optimizing performance...",
    "Syncing your projects...",
    "Shielding your code...",
];

export default function FullPageLoader() {
    const [statusIndex, setStatusIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setStatusIndex((prev) => (prev + 1) % statusMessages.length);
        }, 2500);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4">
            {/* Immersive Glass Backdrop */}
            <div className="absolute inset-0 bg-white/60 dark:bg-gray-950/80 backdrop-blur-2xl" />

            {/* Decorative background shapes */}
            <motion.div
                className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-[100px]"
                animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.2, 0.4, 0.2],
                }}
                transition={{ duration: 10, repeat: Infinity }}
            />
            <motion.div
                className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-[100px]"
                animate={{
                    scale: [1.5, 1, 1.5],
                    opacity: [0.1, 0.3, 0.1],
                }}
                transition={{ duration: 8, repeat: Infinity }}
            />

            <div className="relative z-10 flex flex-col items-center gap-8">
                <LogoLoader size={100} />

                <div className="h-8 flex flex-col items-center justify-center">
                    <AnimatePresence mode="wait">
                        <motion.p
                            key={statusIndex}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.5 }}
                            className="text-lg font-medium text-gray-600 dark:text-gray-300 tracking-wide text-center"
                        >
                            {statusMessages[statusIndex]}
                        </motion.p>
                    </AnimatePresence>
                </div>

                {/* Minimal progress line */}
                <div className="w-48 h-1 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                        className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"
                        animate={{
                            x: ["-100%", "100%"],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "linear",
                        }}
                    />
                </div>
            </div>
        </div>
    );
}
