"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import {
  Mail,
  Lock,
  ArrowRight,
  Shield,
  Code,
  Zap,
  CheckCircle,
} from "lucide-react";
import { getURL } from "@/lib/utils";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("email", email);
    formData.append("password", password);

    try {
      const { login } = await import("@/app/auth/actions");
      const result = await login(formData);

      if (result.error) {
        throw new Error(result.error);
      }

      if (result.success && result.redirectUrl) {
        setIsSuccess(true);
        setIsLoading(false);
        // Use hard navigation to ensure cookies are sent to middleware
        console.log("LOGIN SUCCESS. Cookies:", document.cookie);
        window.location.href = result.redirectUrl;
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred during login";
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { type: "spring" as const, stiffness: 300, damping: 24 },
    },
  };

  const featureVariants = {
    hidden: { x: -20, opacity: 0 },
    visible: {
      x: 0,
      opacity: 1,
      transition: { type: "spring" as const, stiffness: 300, damping: 24 },
    },
  };

  return (
    <div className="flex min-h-screen selection:bg-purple-500/30">
      {/* Left Panel - Animated Background */}
      <motion.div
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600"
      >
        {/* Animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/90 via-purple-600/90 to-pink-600/90 animate-gradient-slow" />

        {/* Floating shapes with Parallax */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            animate={{
              y: [0, -20, 0],
              rotate: [0, 5, 0],
            }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            className="absolute w-96 h-96 bg-white/10 rounded-full -top-20 -left-20 blur-3xl opacity-50"
          />
          <motion.div
            animate={{
              y: [0, 20, 0],
              rotate: [0, -5, 0],
            }}
            transition={{
              duration: 7,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 1,
            }}
            className="absolute w-72 h-72 bg-pink-400/20 rounded-full top-1/3 left-1/4 blur-3xl opacity-40"
          />
          <motion.div
            animate={{
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 2,
            }}
            className="absolute w-64 h-64 bg-cyan-400/20 rounded-full bottom-20 left-10 blur-3xl opacity-30"
          />
        </div>

        {/* Content */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="relative z-10 flex flex-col justify-center px-12 xl:px-20"
        >
          {/* Logo */}
          <motion.div variants={itemVariants} className="mb-12">
            <h1 className="text-5xl xl:text-6xl font-black text-white tracking-tight">
              Code<span className="text-pink-200">Guard</span>
            </h1>
            <p className="mt-3 text-lg text-white/80 font-medium tracking-wide">
              Secure Programming Environment
            </p>
          </motion.div>

          {/* Features */}
          <div className="space-y-8">
            {[
              {
                icon: Shield,
                title: "Proctored Environment",
                desc: "Secure code execution with violation tracking",
              },
              {
                icon: Code,
                title: "Multi-Language Support",
                desc: "Python, C, Java with Docker isolation",
              },
              {
                icon: Zap,
                title: "AI-Powered Assistance",
                desc: "Get intelligent help while learning",
              },
            ].map((feature, index) => (
              <motion.div
                key={index}
                variants={featureVariants}
                whileHover={{ x: 10 }}
                className="flex items-start gap-4"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-xl">
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white leading-tight">
                    {feature.title}
                  </h3>
                  <p className="mt-1 text-white/70 font-medium">
                    {feature.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>

      {/* Right Panel - Login Form */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-gray-50 dark:bg-gray-950"
      >
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="lg:hidden text-center mb-10"
          >
            <h1 className="text-4xl font-black text-gradient">CodeGuard</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Secure Programming Environment
            </p>
          </motion.div>

          {/* Form Card */}
          <AnimatePresence mode="wait">
            {!isSuccess ? (
              <motion.div
                key="login-form"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.05, opacity: 0, filter: "blur(10px)" }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="glass-card-premium rounded-3xl p-8 sm:p-10 border border-white/20 dark:border-gray-800 shadow-2xl"
              >
                {/* Header */}
                <div className="text-center mb-8">
                  <motion.div
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.8, ease: "anticipate" }}
                    className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30 animate-pulse-glow"
                  >
                    <Lock className="w-8 h-8 text-white" />
                  </motion.div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Welcome Back
                  </h2>
                  <p className="mt-2 text-gray-600 dark:text-gray-400 font-medium">
                    Sign in to continue to your dashboard
                  </p>
                </div>

                {/* Error Message */}
                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div
                      initial={{ height: 0, opacity: 0, y: -10 }}
                      animate={{ height: "auto", opacity: 1, y: 0 }}
                      exit={{ height: 0, opacity: 0, y: -10 }}
                      className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 overflow-hidden"
                    >
                      <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2 font-medium">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        {error}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Form */}
                <form onSubmit={handleLogin} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">
                      Email Address
                    </label>
                    <motion.div
                      whileFocus={{ scale: 1.01 }}
                      className="relative"
                    >
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        placeholder="you@example.com"
                        className="input-premium pl-12 h-14"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </motion.div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-1">
                      Password
                    </label>
                    <motion.div
                      whileFocus={{ scale: 1.01 }}
                      className="relative"
                    >
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="password"
                        placeholder="••••••••"
                        className="input-premium pl-12 h-14"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </motion.div>
                  </div>

                  {/* Submit Button */}
                  <motion.button
                    whileHover={{ scale: 1.02, translateY: -2 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-4 px-6 rounded-xl btn-primary flex items-center justify-center gap-3 text-lg font-bold disabled:opacity-60 shadow-xl overflow-hidden relative group"
                  >
                    {isLoading ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{
                            duration: 1,
                            repeat: Infinity,
                            ease: "linear",
                          }}
                          className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                        />
                        Signing In...
                      </>
                    ) : (
                      <>
                        <span className="relative z-10">Sign In</span>
                        <ArrowRight className="w-5 h-5 relative z-10" />
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                      </>
                    )}
                  </motion.button>

                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-200 dark:border-gray-800" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-white dark:bg-gray-950 text-gray-500">
                        Or continue with
                      </span>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={async () => {
                      const supabase = createClient();
                      const { error } = await supabase.auth.signInWithOAuth({
                        provider: "azure",
                        options: {
                          scopes: "email",
                          redirectTo: `${getURL()}/auth/callback`,
                        },
                      });
                      if (error) setError(error.message);
                    }}
                    disabled={isLoading}
                    className="w-full py-3.5 px-6 rounded-xl bg-[#2F2F2F] hover:bg-[#1a1a1a] dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 border border-transparent flex items-center justify-center gap-3 font-semibold transition-all shadow-lg"
                  >
                    <svg
                      className="w-5 h-5"
                      viewBox="0 0 21 21"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
                    </svg>
                    <span>Sign in with Microsoft</span>
                  </motion.button>
                </form>

                {/* Divider */}
                <div className="my-8 flex items-center gap-4">
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
                  <span className="text-sm text-gray-500 font-medium">
                    New here?
                  </span>
                  <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
                </div>

                {/* Register Link */}
                <motion.div whileHover={{ scale: 1.02 }}>
                  <Link
                    href="/auth/register"
                    className="block w-full py-4 px-6 rounded-xl btn-secondary text-center font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors shadow-md"
                  >
                    Create an Account
                  </Link>
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="success-overlay"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-center p-12 glass-card-premium rounded-3xl border border-white/20 dark:border-gray-800 shadow-2xl flex flex-col items-center gap-6"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 200,
                    damping: 10,
                    delay: 0.2,
                  }}
                  className="w-24 h-24 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/30"
                >
                  <CheckCircle className="w-12 h-12 text-white" />
                </motion.div>
                <div>
                  <h2 className="text-3xl font-black text-gray-900 dark:text-white">
                    Sign In Successful!
                  </h2>
                  <p className="mt-2 text-gray-600 dark:text-gray-400 font-semibold text-lg">
                    Redirecting you to your dashboard...
                  </p>
                </div>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: "100%" }}
                  transition={{ duration: 1.5, ease: "easeInOut" }}
                  className="h-1.5 bg-green-500 rounded-full mt-4"
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-8 text-center text-sm text-gray-500 font-medium"
          >
            Protected by CodeGuard Security
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
}
