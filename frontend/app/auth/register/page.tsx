"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  Shield,
  Code,
  Zap,
  GraduationCap,
  ChevronDown,
} from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
    role: "student",
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (formData.password.length < 6) {
      setError("Password must be at least 6 characters long");
      return;
    }

    setIsLoading(true);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          emailRedirectTo:
            process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL ||
            `${window.location.origin}/auth/verify-email`,
          data: {
            name: formData.name,
            role: formData.role,
          },
        },
      });

      if (signUpError) throw signUpError;

      router.push("/auth/verify-email");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const roleOptions = [
    {
      value: "student",
      label: "Student",
      icon: <GraduationCap className="w-4 h-4" />,
    },
    { value: "faculty", label: "Faculty", icon: <User className="w-4 h-4" /> },
    { value: "admin", label: "Admin", icon: <Shield className="w-4 h-4" /> },
  ];

  const selectedRole = roleOptions.find((r) => r.value === formData.role);

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

  return (
    <div className="flex min-h-screen selection:bg-indigo-500/30">
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
            className="absolute w-80 h-80 bg-indigo-400/20 rounded-full -bottom-20 right-20 blur-3xl opacity-30"
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
              Join the Secure Programming Environment
            </p>
          </motion.div>

          {/* Features */}
          <div className="space-y-8">
            {[
              {
                icon: Shield,
                title: "Secure Environment",
                desc: "Proctored sessions with violation tracking",
              },
              {
                icon: Code,
                title: "Multi-Language Support",
                desc: "Code in Python, C, or Java",
              },
              {
                icon: Zap,
                title: "Instant Feedback",
                desc: "Real-time code execution and grading",
              },
            ].map((feature, index) => (
              <motion.div
                key={index}
                variants={itemVariants}
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

      {/* Right Panel - Register Form */}
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
            className="lg:hidden text-center mb-8"
          >
            <h1 className="text-4xl font-black text-gradient">CodeGuard</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400 font-medium">
              Create your account
            </p>
          </motion.div>

          {/* Form Card */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="glass-card-premium rounded-3xl p-6 sm:p-8 border border-white/20 dark:border-gray-800 shadow-2xl"
          >
            {/* Header */}
            <div className="text-center mb-5">
              <motion.div
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.8, ease: "anticipate" }}
                className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30 animate-pulse-glow"
              >
                <GraduationCap className="w-6 h-6 text-white" />
              </motion.div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white leading-tight">
                Create Account
              </h2>
            </div>

            {/* Error Message */}
            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ height: 0, opacity: 0, y: -10 }}
                  animate={{ height: "auto", opacity: 1, y: 0 }}
                  exit={{ height: 0, opacity: 0, y: -10 }}
                  className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 overflow-hidden"
                >
                  <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2 font-medium">
                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    {error}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Form */}
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Name Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 ml-1">
                    Full Name
                  </label>
                  <motion.div whileFocus={{ scale: 1.01 }} className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="John Doe"
                      className="input-premium pl-9 !py-2.5 text-sm h-11"
                      value={formData.name}
                      onChange={(e) =>
                        handleInputChange("name", e.target.value)
                      }
                      required
                    />
                  </motion.div>
                </div>

                {/* Role Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 ml-1">
                    Role
                  </label>
                  <div className="relative">
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                      className="input-premium flex items-center gap-3 pl-3 pr-10 !py-2.5 text-sm cursor-pointer h-11 bg-white/80 dark:bg-gray-800/80 overflow-hidden"
                    >
                      <div className="flex-shrink-0 text-gray-400 w-4 h-4 flex items-center justify-center">
                        {formData.role === "student" && (
                          <GraduationCap className="w-4 h-4" />
                        )}
                        {formData.role === "faculty" && (
                          <User className="w-4 h-4" />
                        )}
                        {formData.role === "admin" && (
                          <Shield className="w-4 h-4" />
                        )}
                      </div>
                      <span className="truncate font-medium flex-1 text-left">
                        {selectedRole?.label}
                      </span>
                      <ChevronDown
                        className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-transform duration-300 ${roleMenuOpen ? "rotate-180" : ""}`}
                      />
                    </motion.button>

                    <AnimatePresence>
                      {roleMenuOpen && (
                        <>
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-10"
                            onClick={() => setRoleMenuOpen(false)}
                          />
                          <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="absolute top-full left-0 right-0 mt-2 z-20 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
                          >
                            {roleOptions.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                  handleInputChange("role", option.value);
                                  setRoleMenuOpen(false);
                                }}
                                className={`w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm font-semibold ${
                                  formData.role === option.value
                                    ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400"
                                    : "text-gray-700 dark:text-gray-300"
                                }`}
                              >
                                {option.icon}
                                {option.label}
                                {formData.role === option.value && (
                                  <motion.div
                                    layoutId="role-indicator"
                                    className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500"
                                  />
                                )}
                              </button>
                            ))}
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              {/* Email Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-700 dark:text-gray-300 ml-1">
                  Email Address
                </label>
                <motion.div whileFocus={{ scale: 1.01 }} className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    className="input-premium pl-9 !py-2.5 text-sm h-11"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    required
                  />
                </motion.div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Password Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 ml-1">
                    Password
                  </label>
                  <motion.div whileFocus={{ scale: 1.01 }} className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      className="input-premium pl-9 !py-2.5 text-sm h-11"
                      value={formData.password}
                      onChange={(e) =>
                        handleInputChange("password", e.target.value)
                      }
                      required
                    />
                  </motion.div>
                </div>

                {/* Confirm Password Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-gray-300 ml-1">
                    Confirm Password
                  </label>
                  <motion.div whileFocus={{ scale: 1.01 }} className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      className="input-premium pl-9 !py-2.5 text-sm h-11"
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        handleInputChange("confirmPassword", e.target.value)
                      }
                      required
                    />
                  </motion.div>
                </div>
              </div>

              {/* Submit Button */}
              <motion.button
                whileHover={{ scale: 1.02, translateY: -2 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={isLoading}
                className="w-full py-4 px-6 rounded-xl btn-primary flex items-center justify-center gap-3 text-base font-bold disabled:opacity-60 shadow-xl mt-2"
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
                      className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                    />
                    Creating Account...
                  </>
                ) : (
                  <>
                    Create Account
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </form>

            {/* Divider */}
            <div className="my-5 flex items-center gap-4">
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
              <span className="text-xs text-gray-500 font-medium">
                Already a member?
              </span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-800" />
            </div>

            {/* Login Link */}
            <motion.div whileHover={{ scale: 1.02 }}>
              <Link
                href="/auth/login"
                className="block w-full py-3.5 px-6 rounded-xl btn-secondary text-sm font-bold text-center hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
              >
                Sign In Instead
              </Link>
            </motion.div>
          </motion.div>

          {/* Footer */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1 }}
            className="mt-6 text-center text-xs text-gray-500 font-medium leading-relaxed"
          >
            By registering, you agree to our <br />
            <Link href="#" className="text-indigo-500 hover:underline">
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link href="#" className="text-indigo-500 hover:underline">
              Privacy Policy
            </Link>
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
}
