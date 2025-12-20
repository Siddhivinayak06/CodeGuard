"use client";

import { motion } from "framer-motion";
import Image from "next/image";

export default function LogoLoader({ size = 80 }: { size?: number }) {
    return (
        <div className="relative flex items-center justify-center" style={{ width: size * 2, height: size * 2 }}>
            {/* Outer Pulsing Rings */}
            <motion.div
                className="absolute inset-0 rounded-full border-2 border-indigo-500/20"
                animate={{
                    scale: [1, 1.5, 1],
                    opacity: [0.3, 0, 0.3],
                }}
                transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            />
            <motion.div
                className="absolute inset-4 rounded-full border-2 border-purple-500/30"
                animate={{
                    scale: [1, 1.3, 1],
                    opacity: [0.5, 0.1, 0.5],
                }}
                transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                    delay: 0.5,
                }}
            />

            {/* Branded Logo with Pulse */}
            <motion.div
                className="relative z-10 p-4 rounded-3xl bg-white dark:bg-gray-900 shadow-2xl shadow-indigo-500/20"
                animate={{
                    scale: [0.95, 1.05, 0.95],
                    rotateY: [0, 10, -10, 0],
                }}
                transition={{
                    duration: 4,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            >
                <Image
                    src="/CodeGuard_Logo.png"
                    alt="CodeGuard Logo"
                    width={size}
                    height={size}
                    className="object-contain"
                />

                {/* Shimmering Glow overlay */}
                <motion.div
                    className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-transparent via-white/40 to-transparent -z-10"
                    animate={{
                        x: ["-100%", "100%"],
                    }}
                    transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                    }}
                />
            </motion.div>

            {/* Ambient Glow */}
            <motion.div
                className="absolute inset-0 bg-indigo-500/10 blur-[60px] rounded-full"
                animate={{
                    opacity: [0.4, 0.8, 0.4],
                    scale: [1, 1.2, 1],
                }}
                transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                }}
            />
        </div>
    );
}
