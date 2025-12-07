"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
        err instanceof Error ? err.message : "An unexpected error occurred"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const roleOptions = [
    { value: "student", label: "Student", icon: <GraduationCap className="w-4 h-4" /> },
    { value: "faculty", label: "Faculty", icon: <User className="w-4 h-4" /> },
    { value: "admin", label: "Admin", icon: <Shield className="w-4 h-4" /> },
  ];

  const selectedRole = roleOptions.find((r) => r.value === formData.role);

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Animated Background */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 animate-page-slide-left">
        {/* Animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/90 via-purple-600/90 to-pink-600/90 animate-gradient-slow" />

        {/* Floating shapes */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="floating-shape w-96 h-96 bg-white/20 -top-20 -left-20 animate-float" />
          <div className="floating-shape w-72 h-72 bg-pink-400/30 top-1/3 left-1/4 animate-float-reverse animation-delay-200" />
          <div className="floating-shape w-64 h-64 bg-cyan-400/20 bottom-20 left-10 animate-float animation-delay-400" />
          <div className="floating-shape w-80 h-80 bg-indigo-400/20 -bottom-20 right-20 animate-float-reverse" />
          <div className="floating-shape w-48 h-48 bg-white/10 top-20 right-10 animate-float animation-delay-300" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-12 xl:px-20">
          {/* Logo */}
          <div className="mb-12">
            <h1 className="text-5xl xl:text-6xl font-black text-white tracking-tight">
              Code<span className="text-pink-200">Guard</span>
            </h1>
            <p className="mt-3 text-lg text-white/80 font-medium">
              Join the Secure Programming Environment
            </p>
          </div>

          {/* Features */}
          <div className="space-y-8">
            <div className="flex items-start gap-4 animate-slideUp">
              <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">
                  Secure Environment
                </h3>
                <p className="mt-1 text-white/70">
                  Proctored sessions with violation tracking
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 animate-slideUp animation-delay-100">
              <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Code className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">
                  Multi-Language Support
                </h3>
                <p className="mt-1 text-white/70">
                  Code in Python, C, or Java
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4 animate-slideUp animation-delay-200">
              <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">
                  Instant Feedback
                </h3>
                <p className="mt-1 text-white/70">
                  Real-time code execution and grading
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom decoration */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black/20 to-transparent" />
      </div>

      {/* Right Panel - Register Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 animate-fade-slide-right">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <h1 className="text-4xl font-black text-gradient">CodeGuard</h1>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Create your account
            </p>
          </div>

          {/* Form Card */}
          <div className="glass-card-premium rounded-3xl p-6 sm:p-8 animate-scaleIn">
            {/* Header */}
            <div className="text-center mb-5">
              <div className="w-12 h-12 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/30 animate-pulse-glow">
                <GraduationCap className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Create Account
              </h2>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 animate-slideDown">
                <p className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  {error}
                </p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleRegister} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Name Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="John Doe"
                      className="input-premium pl-9 !py-2.5 text-sm"
                      value={formData.name}
                      onChange={(e) => handleInputChange("name", e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Role Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Role
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                      className="input-premium pl-10 pr-10 !py-2.5 text-sm flex items-center cursor-pointer"
                    >
                      <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <span className="truncate">
                        {selectedRole?.label}
                      </span>
                      <ChevronDown
                        className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 transition-transform ${roleMenuOpen ? "rotate-180" : ""}`}
                      />
                    </button>

                    {roleMenuOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setRoleMenuOpen(false)}
                        />
                        <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                          {roleOptions.map((option) => (
                            <button
                              key={option.value}
                              type="button"
                              onClick={() => {
                                handleInputChange("role", option.value);
                                setRoleMenuOpen(false);
                              }}
                              className={`w-full px-4 py-2.5 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm ${formData.role === option.value
                                ? "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400"
                                : "text-gray-700 dark:text-gray-300"
                                }`}
                            >
                              {option.icon}
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Email Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    placeholder="you@example.com"
                    className="input-premium pl-9 !py-2.5 text-sm"
                    value={formData.email}
                    onChange={(e) => handleInputChange("email", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Password Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      className="input-premium pl-9 !py-2.5 text-sm"
                      value={formData.password}
                      onChange={(e) =>
                        handleInputChange("password", e.target.value)
                      }
                      required
                    />
                  </div>
                </div>

                {/* Confirm Password Input */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="password"
                      placeholder="••••••••"
                      className="input-premium pl-9 !py-2.5 text-sm"
                      value={formData.confirmPassword}
                      onChange={(e) =>
                        handleInputChange("confirmPassword", e.target.value)
                      }
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 px-6 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-semibold shadow-lg shadow-purple-500/25 hover:shadow-xl hover:shadow-purple-500/40 transition-all duration-300 hover:-translate-y-0.5 flex items-center justify-center gap-3 text-base disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none mt-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create Account
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Divider */}
            <div className="my-5 flex items-center gap-4">
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Already member?
              </span>
              <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            </div>

            {/* Login Link */}
            <Link
              href="/auth/login"
              className="block w-full py-3 px-6 rounded-xl btn-secondary text-sm font-medium text-center hover-lift"
            >
              Sign In Instead
            </Link>
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
            By registering, you agree to our Terms of Service
          </p>
        </div>
      </div>
    </div>
  );
}