"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Building2,
  ChevronDown,
  CircleAlert,
  Code2,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Role = "student" | "faculty" | "admin";

type RoleOption = {
  value: Role;
  label: string;
  helper: string;
  icon: LucideIcon;
};

type ValueProp = {
  icon: LucideIcon;
  title: string;
  description: string;
  label: string;
};

const roleOptions: RoleOption[] = [
  {
    value: "student",
    label: "Student",
    helper: "Attempt assigned practicals and track progress.",
    icon: GraduationCap,
  },
  {
    value: "faculty",
    label: "Faculty",
    helper: "Manage evaluations and monitor candidate sessions.",
    icon: User,
  },
  {
    value: "admin",
    label: "Admin",
    helper: "Configure policies, users, and institution settings.",
    icon: ShieldCheck,
  },
];

const valueProps: ValueProp[] = [
  {
    icon: ShieldCheck,
    title: "Verified Exam Security",
    description: "Session lock, single-device policy, and violation tracking.",
    label: "Policy-first",
  },
  {
    icon: Code2,
    title: "Language-Isolated Runtime",
    description: "Execute Python, C, and Java in tightly controlled containers.",
    label: "Docker-isolated",
  },
  {
    icon: Sparkles,
    title: "Fast Workflow",
    description: "Move from login to dashboard in a few seconds, without friction.",
    label: "Low-latency",
  },
];

const authMetrics = [
  { value: "99.9%", label: "Session integrity" },
  { value: "< 2s", label: "Auth response" },
  { value: "24/7", label: "Policy monitoring" },
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

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [formData, setFormData] = useState<{
    email: string;
    password: string;
    confirmPassword: string;
    name: string;
    role: Role;
  }>({
    email: "",
    password: "",
    confirmPassword: "",
    name: "",
    role: "student",
  });

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordScore = useMemo(() => {
    const rules = [
      formData.password.length >= 8,
      /[A-Z]/.test(formData.password),
      /\d/.test(formData.password),
      /[^A-Za-z0-9]/.test(formData.password),
    ];

    return rules.filter(Boolean).length;
  }, [formData.password]);

  const passwordLabel = useMemo(() => {
    if (!formData.password) return "Add a strong password";
    if (passwordScore <= 1) return "Weak";
    if (passwordScore === 2) return "Fair";
    if (passwordScore === 3) return "Good";
    return "Strong";
  }, [formData.password, passwordScore]);

  const selectedRole = roleOptions.find((option) => option.value === formData.role);

  const handleInputChange = (field: keyof typeof formData, value: string) => {
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
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
            role: formData.role,
          },
        },
      });

      if (signUpError) throw signUpError;

      if (data.user) {
        const { error: insertError } = await supabase.from("users").insert({
          uid: data.user.id,
          email: formData.email,
          name: formData.name,
          role: formData.role,
        } as never);

        if (insertError) {
          console.error("Failed to create user profile:", insertError);
        }
      }

      if (data.session) {
        if (formData.role === "admin") router.push("/dashboard/admin");
        else if (formData.role === "faculty") router.push("/dashboard/faculty");
        else router.push("/dashboard/student");
      } else {
        setError("Please check your email to verify your account.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative h-[100dvh] overflow-hidden bg-gradient-to-br from-slate-50 via-purple-50 to-blue-50 text-slate-900 selection:bg-purple-400/30 dark:from-slate-950 dark:via-purple-950/30 dark:to-blue-950/30 dark:text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(129,140,248,0.20),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(236,72,153,0.16),transparent_42%)]" />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-[1400px] flex-col lg:grid lg:grid-cols-[1.05fr_0.95fr]">
        <motion.aside
          initial={{ opacity: 0, x: -36 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="hidden h-full border-r border-slate-200/60 px-10 py-10 dark:border-slate-800/80 lg:flex lg:items-center xl:px-16"
        >
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="mx-auto flex w-full max-w-xl flex-col gap-8"
          >
            <motion.div variants={fadeInUp} className="space-y-5">
              <p className="inline-flex w-fit items-center gap-2 rounded-full border border-indigo-200/80 bg-indigo-50/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-700 shadow-sm dark:border-indigo-800/70 dark:bg-indigo-900/30 dark:text-indigo-300">
                <Building2 className="h-3.5 w-3.5" />
                Trusted by labs and exam cells
              </p>
              <h1 className="text-balance text-5xl font-black leading-tight text-slate-900 dark:text-slate-50 xl:text-6xl">
                Create your <span className="text-gradient">CodeGuard</span> account
              </h1>
              <p className="max-w-xl text-lg leading-relaxed text-slate-600 dark:text-slate-300">
                Register once and access a role-specific dashboard built for secure practical evaluations.
              </p>
            </motion.div>

            <div className="grid gap-4">
              {valueProps.map((feature) => (
                <motion.article
                  key={feature.title}
                  variants={fadeInUp}
                  whileHover={{ x: 8, transition: { duration: 0.22 } }}
                  className="glass-card-premium rounded-2xl p-4 hover-lift"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="inline-flex items-center rounded-full bg-indigo-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-indigo-700 dark:text-indigo-300">
                      {feature.label}
                    </span>
                    <feature.icon className="h-5 w-5 text-indigo-600 dark:text-indigo-300" />
                  </div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{feature.title}</h3>
                  <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{feature.description}</p>
                </motion.article>
              ))}
            </div>

            <motion.div variants={fadeInUp} className="grid grid-cols-3 gap-3">
              {authMetrics.map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-slate-200/80 bg-white/75 px-3 py-2 text-center dark:border-slate-700 dark:bg-slate-900/70"
                >
                  <p className="text-base font-black text-slate-900 dark:text-slate-100">{item.value}</p>
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
          className="flex h-full items-start justify-center overflow-y-auto px-4 py-5 sm:px-8 sm:py-6 lg:items-center lg:overflow-hidden lg:px-12 lg:py-8"
        >
          <div className="w-full max-w-md">
            <motion.div
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="mb-6 glass-card-premium rounded-2xl p-4 text-center lg:hidden"
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-indigo-700 dark:text-indigo-300">
                New account
              </p>
              <h1 className="mt-1 text-2xl font-black text-slate-900 dark:text-white sm:text-3xl">CodeGuard Register</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Create your role-based account in one step
              </p>
            </motion.div>

            <motion.section
              initial={{ opacity: 0, scale: 0.97, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="glass-card-premium relative overflow-visible rounded-2xl sm:rounded-3xl"
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-r from-indigo-400/20 via-transparent to-pink-400/20" />

              <div className="relative p-6 sm:p-8">
                <div className="mb-6 text-center">
                  <motion.div
                    whileHover={{ rotate: -8, scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 250, damping: 12 }}
                    className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-lg shadow-purple-700/30"
                  >
                    <GraduationCap className="h-6 w-6" />
                  </motion.div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100">Create account</h2>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                    Set up your profile to access your dashboard.
                  </p>
                </div>

                <AnimatePresence mode="wait">
                  {error && (
                    <motion.div
                      key="register-error"
                      initial={{ opacity: 0, y: -10, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: "auto" }}
                      exit={{ opacity: 0, y: -10, height: 0 }}
                      className="mb-4 overflow-hidden rounded-xl border border-rose-200 bg-rose-50/90 px-4 py-3 dark:border-rose-900 dark:bg-rose-950/40"
                    >
                      <p className="flex items-start gap-2 text-sm font-medium text-rose-700 dark:text-rose-300">
                        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>{error}</span>
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
                        Full name
                      </span>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          placeholder="John Doe"
                          className="h-11 w-full rounded-xl border border-slate-300 bg-white/90 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
                          value={formData.name}
                          onChange={(e) => handleInputChange("name", e.target.value)}
                          required
                          disabled={isLoading}
                        />
                      </div>
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
                        Role
                      </span>
                      <div className="relative">
                        <motion.button
                          whileTap={{ scale: 0.98 }}
                          type="button"
                          onClick={() => setRoleMenuOpen((prev) => !prev)}
                          disabled={isLoading}
                          className="flex h-11 w-full items-center gap-2 rounded-xl border border-slate-300 bg-white/90 px-3 text-left text-sm font-medium text-slate-900 outline-none transition hover:bg-slate-50 focus-visible:ring-4 focus-visible:ring-purple-500/20 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100 dark:hover:bg-slate-800"
                        >
                          {selectedRole && <selectedRole.icon className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-300" />}
                          <span className="flex-1 truncate">{selectedRole?.label}</span>
                          <ChevronDown
                            className={`h-4 w-4 text-slate-500 transition-transform ${roleMenuOpen ? "rotate-180" : ""}`}
                          />
                        </motion.button>

                        <AnimatePresence>
                          {roleMenuOpen && (
                            <>
                              <motion.button
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                type="button"
                                className="fixed inset-0 z-20 cursor-default"
                                onClick={() => setRoleMenuOpen(false)}
                                aria-label="Close role menu"
                              />
                              <motion.div
                                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                                transition={{ duration: 0.2 }}
                                className="absolute left-0 right-0 top-full z-30 mt-2 max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900"
                              >
                                {roleOptions.map((option) => {
                                  const Icon = option.icon;
                                  const active = formData.role === option.value;
                                  return (
                                    <button
                                      key={option.value}
                                      type="button"
                                      onClick={() => {
                                        handleInputChange("role", option.value);
                                        setRoleMenuOpen(false);
                                      }}
                                      className={`w-full px-3 py-2.5 text-left transition ${
                                        active
                                          ? "bg-indigo-50 text-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-200"
                                          : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                                      }`}
                                    >
                                      <span className="flex items-center gap-2 text-sm font-semibold">
                                        <Icon className="h-4.5 w-4.5" />
                                        {option.label}
                                      </span>
                                      <p className="mt-0.5 text-xs opacity-80">{option.helper}</p>
                                    </button>
                                  );
                                })}
                              </motion.div>
                            </>
                          )}
                        </AnimatePresence>
                      </div>
                    </label>
                  </div>

                  <label className="block space-y-2">
                    <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
                      Email address
                    </span>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
                      <input
                        type="email"
                        placeholder="you@college.edu"
                        className="h-11 w-full rounded-xl border border-slate-300 bg-white/90 pl-11 pr-4 text-sm font-medium text-slate-900 outline-none transition focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        required
                        disabled={isLoading}
                      />
                    </div>
                  </label>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="block space-y-2">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
                        Password
                      </span>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
                        <input
                          type={showPassword ? "text" : "password"}
                          placeholder="Create password"
                          className="h-11 w-full rounded-xl border border-slate-300 bg-white/90 pl-11 pr-12 text-sm font-medium text-slate-900 outline-none transition focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
                          value={formData.password}
                          onChange={(e) => handleInputChange("password", e.target.value)}
                          required
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 transition hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:text-slate-400 dark:hover:text-slate-100"
                        >
                          {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                        </button>
                      </div>
                    </label>

                    <label className="block space-y-2">
                      <span className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600 dark:text-slate-300">
                        Confirm password
                      </span>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-slate-400" />
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          placeholder="Re-enter password"
                          className="h-11 w-full rounded-xl border border-slate-300 bg-white/90 pl-11 pr-12 text-sm font-medium text-slate-900 outline-none transition focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-100"
                          value={formData.confirmPassword}
                          onChange={(e) => handleInputChange("confirmPassword", e.target.value)}
                          required
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword((prev) => !prev)}
                          aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 transition hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 dark:text-slate-400 dark:hover:text-slate-100"
                        >
                          {showConfirmPassword ? (
                            <EyeOff className="h-4.5 w-4.5" />
                          ) : (
                            <Eye className="h-4.5 w-4.5" />
                          )}
                        </button>
                      </div>
                    </label>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/60">
                    <div className="mb-1.5 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.1em] text-slate-500 dark:text-slate-400">
                      <span>Password strength</span>
                      <span>{passwordLabel}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.max(8, passwordScore * 25)}%` }}
                        transition={{ duration: 0.25 }}
                        className={`h-full rounded-full ${
                          passwordScore <= 1
                            ? "bg-rose-500"
                            : passwordScore === 2
                              ? "bg-amber-500"
                              : passwordScore === 3
                                ? "bg-indigo-500"
                                : "bg-emerald-500"
                        }`}
                      />
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ y: -2, scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={isLoading}
                    className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-xl btn-primary px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-65"
                  >
                    <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/35 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
                    {isLoading ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="h-4 w-4 rounded-full border-2 border-white border-t-transparent"
                        />
                        <span className="relative z-10">Creating account...</span>
                      </>
                    ) : (
                      <>
                        <span className="relative z-10">Create account</span>
                        <ArrowRight className="relative z-10 h-4.5 w-4.5" />
                      </>
                    )}
                  </motion.button>
                </form>

                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    Already registered?
                  </span>
                  <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                </div>

                <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                  <Link
                    href="/auth/login"
                    className="flex h-11 items-center justify-center rounded-xl btn-secondary text-sm font-bold"
                  >
                    Sign in instead
                  </Link>
                </motion.div>
              </div>
            </motion.section>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-6 text-center text-xs font-semibold text-slate-500 dark:text-slate-400"
            >
              By registering you agree to our <Link href="#" className="underline decoration-purple-400 underline-offset-4">Terms</Link> and <Link href="#" className="underline decoration-purple-400 underline-offset-4">Privacy Policy</Link>.
            </motion.p>
          </div>
        </motion.main>
      </div>
    </div>
  );
}
