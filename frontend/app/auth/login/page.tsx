"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleAlert,
  Code2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getURL } from "@/lib/utils";

type ValueProp = {
  icon: LucideIcon;
  title: string;
  description: string;
  label: string;
};

const valueProps: ValueProp[] = [
  {
    icon: ShieldCheck,
    title: "Identity & Session Control",
    description: "Single-device enforcement with tracked policy events.",
    label: "Zero-trust",
  },
  {
    icon: Code2,
    title: "Containerized Runtime",
    description: "Run Python, C, and Java in isolated execution sandboxes.",
    label: "Sandboxed",
  },
  {
    icon: Sparkles,
    title: "Audit-Friendly Workflow",
    description: "Move quickly while preserving a clear, reviewable activity trail.",
    label: "Audit-ready",
  },
];

const authMetrics = [
  { value: "<1.8s", label: "Median sign-in" },
  { value: "3 layers", label: "Runtime isolation" },
  { value: "24x7", label: "Integrity watch" },
];

const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.2,
    },
  },
};

const fadeInUp = {
  hidden: { y: 20, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 280, damping: 24 },
  },
};

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950">
          <div className="h-11 w-11 rounded-full border-4 border-sky-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}

function LoginContent() {
  const isProduction = process.env.NODE_ENV === "production";
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) {
      const errorMessages: Record<string, string> = {
        UserNotRegistered:
          "Your account is not registered in CodeGuard. Please contact your administrator to get access.",
        AuthCodeError: "Authentication failed. Please try again.",
        AuthError: "An authentication error occurred. Please try again.",
      };
      setError(errorMessages[errorParam] || `Authentication error: ${errorParam}`);
    }
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("reset") !== "1") return;
    if (typeof window === "undefined") return;

    localStorage.removeItem("cg_session_id");
    document.cookie = "device_session_id=; path=/; max-age=0; SameSite=Lax";

    Object.keys(localStorage).forEach((key) => {
      const lowered = key.toLowerCase();
      if (lowered.startsWith("sb-") || lowered.includes("supabase")) {
        localStorage.removeItem(key);
      }
    });
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw new Error(signInError.message);
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        throw new Error("User not found after login.");
      }

      const sessionId = crypto.randomUUID();
      await supabase
        .from("users")
        .update({
          active_session_id: sessionId,
          session_updated_at: new Date().toISOString(),
        } as never)
        .eq("uid", user.id);

      document.cookie = `device_session_id=${sessionId}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;

      const role = user.user_metadata?.role;
      const normalizedRole = role?.toLowerCase();

      let target = "/dashboard/student";
      if (normalizedRole === "admin") target = "/dashboard/admin";
      else if (normalizedRole === "faculty") target = "/dashboard/faculty";

      setIsSuccess(true);
      setIsLoading(false);
      window.setTimeout(() => {
        window.location.href = target;
      }, 520);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred during login";
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <div className="relative h-[100svh] overflow-hidden bg-gradient-to-br from-slate-100 via-cyan-50 to-sky-50 text-slate-900 selection:bg-cyan-300/40 dark:from-slate-950 dark:via-slate-900 dark:to-cyan-950/30 dark:text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.18),transparent_46%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.14),transparent_42%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:42px_42px] [mask-image:radial-gradient(circle_at_60%_40%,black,transparent_78%)]" />

      <div className="auth-login-shell relative z-10 mx-auto flex h-full w-full max-w-[1440px] p-2 sm:p-4 lg:p-5">
        <div className="auth-login-grid grid h-full min-h-0 w-full overflow-hidden rounded-[24px] border border-slate-200/80 bg-white/45 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/35 lg:grid-cols-[1.02fr_0.98fr]">
        <motion.aside
          initial={{ opacity: 0, x: -36 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="auth-login-aside relative hidden h-full min-h-0 overflow-hidden bg-gradient-to-br from-cyan-100 via-sky-100 to-blue-50 px-6 py-6 text-slate-900 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 dark:text-slate-100 lg:flex lg:flex-col lg:justify-center xl:px-10"
        >
          <div className="pointer-events-none absolute -left-20 -top-20 h-64 w-64 rounded-full bg-cyan-500/18 blur-3xl dark:bg-cyan-400/20" />
          <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-sky-300/24 blur-3xl dark:bg-blue-500/20" />
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="auth-login-aside-content relative z-10 mx-auto flex w-full max-w-lg flex-col gap-4 lg:gap-5"
          >
            <motion.div variants={fadeInUp} className="space-y-4">
              <p className="inline-flex w-fit items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-100/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-cyan-800 shadow-sm dark:border-cyan-300/40 dark:bg-cyan-400/10 dark:text-cyan-100">
                <Building2 className="h-3.5 w-3.5" />
                Secure access workspace
              </p>
              <h1 className="text-balance text-3xl font-black leading-tight text-slate-900 dark:text-white xl:text-4xl 2xl:text-5xl">
                Professional sign-in for{" "}
                <span className="bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-700 bg-clip-text text-transparent dark:from-cyan-200 dark:via-sky-200 dark:to-blue-200">
                  CodeGuard
                </span>
              </h1>
              <p className="max-w-lg text-base leading-relaxed text-slate-700 dark:text-slate-300">
                Access your practical environment with strong controls, predictable performance, and clear policy visibility.
              </p>
            </motion.div>

            <div className="grid gap-2.5">
              {valueProps.map((feature) => (
                <motion.article
                  key={feature.title}
                  variants={fadeInUp}
                  whileHover={{ y: -3, transition: { duration: 0.2 } }}
                  className="rounded-2xl border border-slate-200/80 bg-white/75 p-3 shadow-[0_16px_32px_-26px_rgba(15,23,42,0.45)] backdrop-blur-md transition hover:border-cyan-300/80 dark:border-slate-700/80 dark:bg-slate-800/60 dark:shadow-[0_16px_36px_-26px_rgba(2,6,23,0.9)] dark:hover:border-cyan-400/70"
                >
                  <div className="mb-2.5 flex items-center justify-between">
                    <span className="inline-flex items-center rounded-full bg-cyan-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-200">
                      {feature.label}
                    </span>
                    <feature.icon className="h-5 w-5 text-cyan-700 dark:text-cyan-200" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{feature.title}</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{feature.description}</p>
                </motion.article>
              ))}
            </div>

            <motion.div variants={fadeInUp} className="auth-login-metrics grid grid-cols-3 gap-2.5">
              {authMetrics.map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-slate-200/80 bg-white/65 px-2.5 py-2 text-center dark:border-slate-700/80 dark:bg-slate-800/55"
                >
                  <p className="text-sm font-black text-slate-900 dark:text-slate-100 sm:text-base">{item.value}</p>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                    {item.label}
                  </p>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </motion.aside>

        <motion.main
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.65, delay: 0.12 }}
          className="auth-login-main flex h-full min-h-0 items-center justify-center bg-slate-50/70 px-3 py-4 sm:px-6 sm:py-6 dark:bg-slate-950/40 lg:px-8 lg:py-7"
        >
          <div className="auth-login-form-wrap w-full max-w-xl">
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="auth-login-mobile-hero mb-4 rounded-2xl border border-slate-200/80 bg-white/90 p-3 text-center shadow-[0_18px_40px_-30px_rgba(15,23,42,0.6)] backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/75 sm:p-4 lg:hidden"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-cyan-800 dark:text-cyan-300">
                Secure Access
              </p>
              <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white sm:text-3xl">CodeGuard Login</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Proctored environment for practical evaluations
              </p>
            </motion.div>

            <AnimatePresence mode="wait">
              {!isSuccess ? (
                <motion.section
                  key="login-form"
                  initial={{ opacity: 0, scale: 0.97, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 1.02, y: -10, filter: "blur(8px)" }}
                  transition={{ duration: 0.4 }}
                  className="auth-login-form-card relative overflow-hidden rounded-2xl border border-slate-200/85 bg-white/90 shadow-[0_28px_70px_-42px_rgba(15,23,42,0.62)] backdrop-blur-2xl dark:border-slate-700 dark:bg-slate-900/80 sm:rounded-3xl"
                >
                  <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-r from-cyan-400/25 via-white/10 to-sky-400/20" />
                  <div className="auth-login-form-card-body relative p-5 sm:p-6">
                    <div className="mb-5 text-center">
                      <motion.div
                        whileHover={{ rotate: 8, scale: 1.05 }}
                        transition={{ type: "spring", stiffness: 250, damping: 12 }}
                        className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-600 via-sky-600 to-blue-700 text-white shadow-lg shadow-cyan-900/30"
                      >
                        <Lock className="h-7 w-7" />
                      </motion.div>
                      <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">Welcome back</h2>
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                        Sign in to continue to your personalized dashboard.
                      </p>
                    </div>

                    <AnimatePresence mode="wait">
                      {error && (
                        <motion.div
                          key="auth-error"
                          initial={{ opacity: 0, y: -10, height: 0 }}
                          animate={{ opacity: 1, y: 0, height: "auto" }}
                          exit={{ opacity: 0, y: -10, height: 0 }}
                          className="mb-5 overflow-hidden rounded-xl border border-rose-200 bg-rose-50/90 px-4 py-3 dark:border-rose-900 dark:bg-rose-950/40"
                        >
                          <p className="flex items-start gap-2 text-sm font-medium text-rose-700 dark:text-rose-300">
                            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{error}</span>
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <form onSubmit={handleLogin} className="auth-login-form-fields space-y-3.5">
                      <label className="block space-y-2">
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
                          Email address
                        </span>
                        <div className="relative">
                          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
                          <input
                            type="email"
                            placeholder="you@college.edu"
                            className="h-11 w-full rounded-xl border border-slate-300 bg-white/95 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-100"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={isLoading}
                          />
                        </div>
                      </label>

                      <label className="block space-y-2">
                        <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
                          Password
                        </span>
                        <div className="relative">
                          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
                          <input
                            type={showPassword ? "text" : "password"}
                            placeholder="Enter your password"
                            className="h-11 w-full rounded-xl border border-slate-300 bg-white/95 pl-11 pr-12 text-sm font-medium text-slate-900 outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-500/20 dark:border-slate-700 dark:bg-slate-900/85 dark:text-slate-100"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={isLoading}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            aria-label={showPassword ? "Hide password" : "Show password"}
                            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 transition hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 dark:text-slate-400 dark:hover:text-slate-100"
                          >
                            {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                          </button>
                        </div>
                      </label>

                      <motion.button
                        whileHover={{ y: -2, scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        type="submit"
                        disabled={isLoading}
                        className="group relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-700 px-4 text-sm font-bold text-white shadow-lg shadow-cyan-900/25 transition disabled:cursor-not-allowed disabled:opacity-65"
                      >
                        <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
                        {isLoading ? (
                          <>
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              className="h-4 w-4 rounded-full border-2 border-white border-t-transparent"
                            />
                            <span className="relative z-10">Signing in...</span>
                          </>
                        ) : (
                          <>
                            <span className="relative z-10">Sign In</span>
                            <ArrowRight className="relative z-10 h-4.5 w-4.5" />
                          </>
                        )}
                      </motion.button>

                      <div className="relative py-1.5">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-slate-200 dark:border-slate-800" />
                        </div>
                        <p className="relative mx-auto w-fit bg-white/80 px-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:bg-slate-900/75 dark:text-slate-400">
                          Or continue with
                        </p>
                      </div>

                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={async () => {
                          const supabase = createClient();
                          const { error: oauthError } = await supabase.auth.signInWithOAuth({
                            provider: "azure",
                            options: {
                              scopes: "email",
                              redirectTo: `${getURL()}/auth/callback`,
                            },
                          });

                          if (oauthError) {
                            setError(oauthError.message);
                          }
                        }}
                        disabled={isLoading}
                        className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50/60 disabled:cursor-not-allowed disabled:opacity-65 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-cyan-900 dark:hover:bg-cyan-950/20"
                      >
                        <svg className="h-4.5 w-4.5" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                          <rect x="1" y="1" width="9" height="9" fill="#F25022" />
                          <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
                          <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
                          <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
                        </svg>
                        <span>Sign in with Microsoft</span>
                      </motion.button>
                    </form>

                    {!isProduction && (
                      <div className="auth-login-register">
                        <div className="my-5 flex items-center gap-3">
                          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                            Need an account?
                          </span>
                          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                        </div>
                        <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                          <Link
                            href="/auth/register"
                            className="flex h-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-sm font-bold text-slate-700 transition hover:border-cyan-300 hover:bg-cyan-50/60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:border-cyan-900 dark:hover:bg-cyan-950/20"
                          >
                            Create account
                          </Link>
                        </motion.div>
                      </div>
                    )}

                  </div>
                </motion.section>
              ) : (
                <motion.section
                  key="success"
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className="rounded-2xl border border-emerald-200 bg-emerald-50/90 p-6 text-center shadow-xl backdrop-blur dark:border-emerald-900 dark:bg-emerald-950/40 sm:rounded-3xl sm:p-8"
                >
                  <motion.div
                    initial={{ scale: 0.2, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 250, damping: 15 }}
                    className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-700/30"
                  >
                    <CheckCircle2 className="h-9 w-9" />
                  </motion.div>
                  <h2 className="text-2xl font-black text-emerald-900 dark:text-emerald-200">Sign in successful</h2>
                  <p className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                    Preparing your dashboard...
                  </p>
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    className="mx-auto mt-5 h-1.5 rounded-full bg-emerald-500"
                  />
                </motion.section>
              )}
            </AnimatePresence>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="auth-login-footer mt-4 text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400"
            >
              Protected by CodeGuard policy controls
            </motion.p>
          </div>
        </motion.main>
      </div>
      </div>
    </div>
  );
}
