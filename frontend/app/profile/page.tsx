"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import ProfileSkeleton from "@/components/skeletons/ProfileSkeleton";
import { motion, AnimatePresence } from "framer-motion";
import {
  User as UserIcon,
  Mail,
  Shield,
  Key,
  GraduationCap,
  Save,
  Loader2,
  Camera,
  CheckCircle2,
  AlertCircle,
  Users,
  Sparkles,
  Award,
  TrendingUp,
  Code2,
  Calendar,
} from "lucide-react";

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 20 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 24 },
  },
  hover: {
    y: -4,
    transition: { type: "spring" as const, stiffness: 400, damping: 17 },
  },
};

const glowVariants = {
  animate: {
    scale: [1, 1.2, 1],
    opacity: [0.5, 0.8, 0.5],
    transition: {
      duration: 3,
      repeat: Infinity,
      ease: "easeInOut" as const,
    },
  },
};

const floatingVariants = {
  animate: {
    y: [-10, 10, -10],
    rotate: [0, 5, -5, 0],
    transition: {
      duration: 6,
      repeat: Infinity,
      ease: "easeInOut",
    },
  },
};

// Floating decoration component
function FloatingOrb({ className, delay = 0 }: { className: string; delay?: number }) {
  return (
    <motion.div
      className={`absolute rounded-full blur-3xl pointer-events-none ${className}`}
      animate={{
        y: [-20, 20, -20],
        x: [-10, 10, -10],
        scale: [1, 1.1, 1],
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        ease: "easeInOut",
        delay,
      }}
    />
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "student",
    semester: "",
    batch: "",
  });

  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/auth/login");
          return;
        }

        setUser(user);

        const { data: profile } = await supabase
          .from("users")
          .select("name, role, semester, batch")
          .eq("uid", user.id)
          .single();

        let studentSemester = "";
        let studentBatch = "";

        if (profile?.role === "student") {
          studentSemester = profile.semester || "";
          studentBatch = profile.batch || "";
        }

        setFormData({
          name: profile?.name || user.user_metadata?.full_name || "",
          email: user.email || "",
          role: profile?.role || user.user_metadata?.role || "student",
          semester: studentSemester,
          batch: studentBatch,
        });
      } catch (error) {
        console.error("Error fetching profile:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [supabase, router]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);

    try {
      if (!user) return;

      const updates: any = {
        name: formData.name,
      };

      if (formData.role === "student") {
        if (formData.semester) updates.semester = formData.semester;
        if (formData.batch) updates.batch = formData.batch;
      }

      const { error: userError } = await supabase
        .from("users")
        .update(updates)
        .eq("uid", user.id);

      if (userError) throw userError;

      setMessage({ type: "success", text: "Profile updated successfully!" });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.message || "Failed to update profile.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match." });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setMessage({
        type: "error",
        text: "Password must be at least 6 characters.",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      });

      if (error) throw error;

      setMessage({ type: "success", text: "Password updated successfully!" });
      setPasswordData({ newPassword: "", confirmPassword: "" });
    } catch (error: any) {
      setMessage({
        type: "error",
        text: error.message || "Failed to update password.",
      });
    } finally {
      setSaving(false);
    }
  };

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "N/A";

  if (loading) return <ProfileSkeleton />;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/50 dark:from-gray-950 dark:via-indigo-950/20 dark:to-purple-950/20 relative overflow-hidden">
      {/* Animated background orbs */}
      <FloatingOrb className="w-96 h-96 bg-indigo-400/20 dark:bg-indigo-600/10 -top-48 -left-48" delay={0} />
      <FloatingOrb className="w-80 h-80 bg-purple-400/20 dark:bg-purple-600/10 top-1/3 -right-40" delay={2} />
      <FloatingOrb className="w-64 h-64 bg-pink-400/20 dark:bg-pink-600/10 bottom-20 left-1/4" delay={4} />

      {/* Subtle grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />

      <main className="relative pt-24 pb-12 px-4 sm:px-6 lg:px-8 xl:px-12 max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="mb-10"
        >
          <div className="flex items-center gap-3 mb-2">
            <motion.div
              className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25"
              whileHover={{ scale: 1.05, rotate: 5 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <Sparkles className="w-5 h-5 text-white" />
            </motion.div>
            <h1 className="text-3xl font-extrabold bg-gradient-to-r from-gray-900 via-indigo-800 to-purple-800 dark:from-white dark:via-indigo-200 dark:to-purple-200 bg-clip-text text-transparent">
              Profile Settings
            </h1>
          </div>
          <p className="text-gray-500 dark:text-gray-400 ml-14">
            Manage your account settings and preferences
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 lg:grid-cols-3 gap-8"
        >
          {/* User Card - Left Column */}
          <motion.div variants={itemVariants} className="lg:col-span-1 space-y-6">
            {/* Avatar Card */}
            <motion.div
              variants={cardVariants}
              whileHover="hover"
              className="relative overflow-hidden rounded-3xl bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border border-white/50 dark:border-gray-800/50 shadow-xl shadow-indigo-500/5"
            >
              {/* Animated gradient header */}
              <div className="absolute top-0 inset-x-0 h-28 overflow-hidden">
                <motion.div
                  className="absolute inset-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500"
                  animate={{
                    backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                  }}
                  transition={{
                    duration: 10,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                  style={{ backgroundSize: "200% 200%" }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent" />
              </div>

              <div className="relative pt-16 pb-6 px-6">
                {/* Avatar */}
                <motion.div
                  className="relative mx-auto w-28 h-28 mb-4"
                  whileHover={{ scale: 1.05 }}
                  transition={{ type: "spring", stiffness: 400 }}
                >
                  <motion.div
                    variants={glowVariants}
                    animate="animate"
                    className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 blur-lg"
                  />
                  <div className="relative w-full h-full rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-1 shadow-2xl">
                    <div className="w-full h-full rounded-full bg-white dark:bg-gray-900 flex items-center justify-center">
                      <span className="text-4xl font-bold bg-gradient-to-br from-indigo-500 to-purple-600 bg-clip-text text-transparent">
                        {formData.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    className="absolute -bottom-1 -right-1 p-2.5 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-shadow"
                  >
                    <Camera size={14} />
                  </motion.button>
                </motion.div>

                {/* Name & Email */}
                <div className="text-center">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                    {formData.name}
                  </h2>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                    {formData.email}
                  </p>

                  {/* Role Badges */}
                  <div className="flex flex-wrap justify-center gap-2">
                    <motion.span
                      whileHover={{ scale: 1.05 }}
                      className="px-4 py-1.5 rounded-full text-xs font-bold bg-gradient-to-r from-indigo-500/10 to-purple-500/10 dark:from-indigo-500/20 dark:to-purple-500/20 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700/50 uppercase tracking-wide"
                    >
                      {formData.role}
                    </motion.span>
                    {formData.role === "student" && formData.semester && (
                      <motion.span
                        whileHover={{ scale: 1.05 }}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-700/50"
                      >
                        Sem {formData.semester}
                      </motion.span>
                    )}
                    {formData.role === "student" && formData.batch && (
                      <motion.span
                        whileHover={{ scale: 1.05 }}
                        className="px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-700/50"
                      >
                        Batch {formData.batch}
                      </motion.span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Account Status Card */}
            <motion.div
              variants={cardVariants}
              whileHover="hover"
              className="relative overflow-hidden rounded-3xl bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border border-white/50 dark:border-gray-800/50 shadow-xl shadow-emerald-500/5 p-6"
            >
              <div className="flex items-center gap-3 mb-5">
                <motion.div
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                  className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/25"
                >
                  <Shield className="w-4 h-4 text-white" />
                </motion.div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                  Account Status
                </h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800/30">
                  <span className="text-sm text-gray-600 dark:text-gray-400">Status</span>
                  <span className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 rounded-full">
                    <motion.div
                      className="w-1.5 h-1.5 rounded-full bg-emerald-500"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    Verified
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50/50 dark:bg-gray-800/30">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Member since</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {memberSince}
                  </span>
                </div>
              </div>
            </motion.div>


          </motion.div>

          {/* Forms - Right Column */}
          <motion.div variants={itemVariants} className="lg:col-span-2 space-y-6">
            {/* Message Alert */}
            <AnimatePresence mode="wait">
              {message && (
                <motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -10, scale: 0.95 }}
                  className={`p-4 rounded-2xl border flex items-center gap-3 backdrop-blur-sm ${message.type === "success"
                    ? "bg-emerald-50/80 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                    : "bg-red-50/80 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
                    }`}
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, delay: 0.1 }}
                  >
                    {message.type === "success" ? (
                      <CheckCircle2 size={20} />
                    ) : (
                      <AlertCircle size={20} />
                    )}
                  </motion.div>
                  {message.text}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Personal Information Card */}
            <motion.div
              variants={cardVariants}
              whileHover="hover"
              className="relative overflow-hidden rounded-3xl bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border border-white/50 dark:border-gray-800/50 shadow-xl p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <motion.div
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                  className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25"
                >
                  <UserIcon className="w-4 h-4 text-white" />
                </motion.div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Personal Information
                </h3>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Name Field */}
                  <motion.div
                    className="space-y-2"
                    animate={focusedField === "name" ? { scale: 1.02 } : { scale: 1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Full Name
                    </label>
                    <div className="relative group">
                      <UserIcon className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${focusedField === "name" ? "text-indigo-500" : "text-gray-400"}`} />
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        onFocus={() => setFocusedField("name")}
                        onBlur={() => setFocusedField(null)}
                        className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                        placeholder="John Doe"
                      />
                    </div>
                  </motion.div>

                  {/* Email Field */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Email Address
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        value={formData.email}
                        disabled
                        className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-500 cursor-not-allowed outline-none"
                      />
                    </div>
                  </div>

                  {formData.role === "student" && (
                    <>
                      {/* Semester Field */}
                      <motion.div
                        className="space-y-2"
                        animate={focusedField === "semester" ? { scale: 1.02 } : { scale: 1 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Semester
                        </label>
                        <div className="relative">
                          <GraduationCap className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${focusedField === "semester" ? "text-indigo-500" : "text-gray-400"}`} />
                          <input
                            type="number"
                            value={formData.semester}
                            onChange={(e) => setFormData({ ...formData, semester: e.target.value })}
                            onFocus={() => setFocusedField("semester")}
                            onBlur={() => setFocusedField(null)}
                            className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                            placeholder="e.g. 5"
                          />
                        </div>
                      </motion.div>

                      {/* Batch Field */}
                      <motion.div
                        className="space-y-2"
                        animate={focusedField === "batch" ? { scale: 1.02 } : { scale: 1 }}
                        transition={{ type: "spring", stiffness: 300 }}
                      >
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          Batch
                        </label>
                        <div className="relative">
                          <Users className={`absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors ${focusedField === "batch" ? "text-indigo-500" : "text-gray-400"}`} />
                          <input
                            type="text"
                            value={formData.batch}
                            onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                            onFocus={() => setFocusedField("batch")}
                            onBlur={() => setFocusedField(null)}
                            className="w-full pl-11 pr-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all"
                            placeholder="e.g. A1"
                          />
                        </div>
                      </motion.div>
                    </>
                  )}
                </div>

                <div className="flex justify-end pt-4">
                  <motion.button
                    type="submit"
                    disabled={saving}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-7 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-semibold hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/40 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Save Changes
                  </motion.button>
                </div>
              </form>
            </motion.div>

            {/* Security Card */}
            <motion.div
              variants={cardVariants}
              whileHover="hover"
              className="relative overflow-hidden rounded-3xl bg-white/70 dark:bg-gray-900/70 backdrop-blur-xl border border-white/50 dark:border-gray-800/50 shadow-xl p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <motion.div
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                  className="p-2.5 rounded-xl bg-gradient-to-br from-rose-500 to-pink-600 shadow-lg shadow-rose-500/25"
                >
                  <Key className="w-4 h-4 text-white" />
                </motion.div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  Security
                </h3>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <motion.div
                    className="space-y-2"
                    animate={focusedField === "newPassword" ? { scale: 1.02 } : { scale: 1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      New Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      onFocus={() => setFocusedField("newPassword")}
                      onBlur={() => setFocusedField(null)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 focus:border-rose-500 dark:focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 outline-none transition-all"
                      placeholder="••••••••"
                    />
                  </motion.div>

                  <motion.div
                    className="space-y-2"
                    animate={focusedField === "confirmPassword" ? { scale: 1.02 } : { scale: 1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Confirm Password
                    </label>
                    <input
                      type="password"
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      onFocus={() => setFocusedField("confirmPassword")}
                      onBlur={() => setFocusedField(null)}
                      className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 focus:border-rose-500 dark:focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10 outline-none transition-all"
                      placeholder="••••••••"
                    />
                  </motion.div>
                </div>

                <div className="flex justify-end pt-4">
                  <motion.button
                    type="submit"
                    disabled={saving}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 font-semibold hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Key className="w-4 h-4" />
                    )}
                    Update Password
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        </motion.div>
      </main>
    </div>
  );
}
