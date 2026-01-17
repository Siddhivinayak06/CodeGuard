"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useLogoutContext } from "@/context/LogoutContext";
import { LogOut } from "lucide-react";

export default function LogoutOverlay() {
  const { isLoggingOut } = useLogoutContext();

  return (
    <AnimatePresence>
      {isLoggingOut && (
        <motion.div
          key="logout-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[99999] flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl"
        >
          <div className="relative">
            {/* Pulsing rings */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{
                scale: [1, 1.5, 2],
                opacity: [0.5, 0.2, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeOut",
              }}
              className="absolute inset-0 bg-red-500/30 rounded-full"
            />
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{
                scale: [1, 1.3, 1.8],
                opacity: [0.4, 0.1, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeOut",
                delay: 0.5,
              }}
              className="absolute inset-0 bg-purple-500/30 rounded-full"
            />

            {/* Icon */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 20,
              }}
              className="relative z-10 w-24 h-24 rounded-3xl bg-gradient-to-br from-red-500 via-pink-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-red-500/40"
            >
              <LogOut className="w-10 h-10 text-white" />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 text-center"
          >
            <h2 className="text-3xl font-black text-white tracking-tight mb-2">
              See You Soon!
            </h2>
            <p className="text-white/60 font-medium">
              Securely signing you out...
            </p>
          </motion.div>

          {/* Progress bar */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-purple-500 to-indigo-500 origin-left"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
