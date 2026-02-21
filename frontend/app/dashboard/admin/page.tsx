"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Users,
  BookOpen,
  GraduationCap,
  FileCode,
  Plus,
  RefreshCw,
  Pencil,
  Trash2,
  X,
  Shield,
  ArrowUpRight,
  Settings,
  BarChart3,
  UserCog,
  ChevronRight,
  ChevronDown,
  Minus,
} from "lucide-react";

// Motion variants for consistent animations
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
} as const;

const itemVariants = {
  hidden: { y: 10, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring" as const,
      stiffness: 260,
      damping: 30,
    },
  },
} as const;

type FacultyBatch = {
  batch: string;
  faculty_id: string;
  faculty_name?: string;
};

type Subject = {
  id: string;
  subject_code?: string;
  subject_name?: string;
  semester?: string | null;
  faculty_batches?: FacultyBatch[];
};

// Stat Card Component
function StatCard({
  label,
  value,
  icon,
  colorClass,
  trend,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  colorClass: string;
  trend?: string;
}) {
  return (
    <motion.div
      variants={itemVariants}
      className="glass-card rounded-2xl p-5 hover-lift flex items-center gap-4 border border-gray-100 dark:border-gray-800"
    >
      <div
        className={`w-12 h-12 rounded-xl ${colorClass.replace("text-", "bg-").replace("600", "100").replace("500", "100")} dark:bg-opacity-20 flex items-center justify-center`}
      >
        {/* Clone element to force color if needed, or rely on parent class */}
        <div className={colorClass}>{icon}</div>
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {value}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">
          {label}
        </p>
        {trend && (
          <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
            {trend}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// Quick Action Card
function QuickActionCard({
  title,
  description,
  icon,
  href,
  colorClass,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  colorClass: string;
}) {
  return (
    <motion.div variants={itemVariants}>
      <Link
        href={href}
        className="glass-card rounded-2xl p-6 hover-lift group block border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/50 hover:border-gray-300 dark:hover:border-gray-700 transition-all"
      >
        <div className="flex items-start justify-between mb-4">
          <div
            className={`p-3 rounded-xl ${colorClass.replace("text-", "bg-").replace("600", "50").replace("500", "50")} dark:bg-opacity-20`}
          >
            <div className={colorClass}>{icon}</div>
          </div>
          <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
          {title}
        </h3>
        <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
          {description}
        </p>
      </Link>
    </motion.div>
  );
}

// Skeleton loader for table
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-5 py-4">
        <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
      </td>
      <td className="px-5 py-4">
        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
      </td>
      <td className="px-5 py-4">
        <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
      </td>
      <td className="px-5 py-4">
        <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded" />
      </td>
      <td className="px-5 py-4">
        <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
      </td>
    </tr>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const mountedRef = useRef<boolean>(false);
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<any | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [stats, setStats] = useState<Record<string, number>>({});
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);

  // modal / form state
  const [formOpen, setFormOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    id: "",
    subject_code: "",
    subject_name: "",
    semester: "",
    faculty_batches: [] as { batch: string; faculty_id: string }[],
  });

  // Faculty and batch data
  const [facultyList, setFacultyList] = useState<{ uid: string; name: string }[]>([]);
  const availableBatches = ["All", "1", "2", "3", "4"];

  // Auth check
  useEffect(() => {
    mountedRef.current = true;

    const fetchUser = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/auth/login");
          return;
        }
        if (mountedRef.current) setUser(user);

        // Get display name
        const { data: userData } = await supabase
          .from("users")
          .select("name")
          .eq("uid", user.id)
          .single();
        if (userData) setUserName((userData as any).name);
      } catch (err) {
        console.error("Auth fetch error:", err);
        router.push("/auth/login");
      }
    };

    fetchUser();
    return () => {
      mountedRef.current = false;
    };
  }, [router, supabase]);

  // Get access token
  const getAccessToken = async (): Promise<string | null> => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return session?.access_token ?? null;
    } catch (err) {
      console.error("Error getting session token:", err);
      return null;
    }
  };

  // Load stats + subjects
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const token = await getAccessToken();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const [statsRes, subjRes] = await Promise.all([
          fetch(`/api/admin/stats`, { headers }).then((r) =>
            r.json().catch(() => ({})),
          ),
          fetch(`/api/admin/subjects`, { headers }).then((r) =>
            r.json().catch(() => []),
          ),
        ]);

        const statsData = statsRes?.data ?? statsRes ?? {};
        const subjData = subjRes?.data ?? subjRes ?? [];

        setStats(statsData);
        setSubjects(Array.isArray(subjData) ? subjData : []);
      } catch (err) {
        console.error("Admin fetch failed:", err);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };

    loadData();
  }, [user]);

  // Load faculty list
  useEffect(() => {
    const loadFaculty = async () => {
      try {
        const { data } = await supabase
          .from("users")
          .select("uid, name")
          .eq("role", "faculty");
        if (data) setFacultyList(data);
      } catch (err) {
        console.error("Failed to load faculty:", err);
      }
    };
    loadFaculty();
  }, [supabase]);

  // Faculty batch helpers
  const addFacultyBatch = () => {
    setFormData((prev) => ({
      ...prev,
      faculty_batches: [...prev.faculty_batches, { batch: "All", faculty_id: "" }],
    }));
  };

  const removeFacultyBatch = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      faculty_batches: prev.faculty_batches.filter((_, i) => i !== index),
    }));
  };

  const updateFacultyBatch = (index: number, field: "batch" | "faculty_id", value: string) => {
    setFormData((prev) => ({
      ...prev,
      faculty_batches: prev.faculty_batches.map((fb, i) =>
        i === index ? { ...fb, [field]: value } : fb
      ),
    }));
  };

  // Form helpers
  const openAddForm = () => {
    setFormData({
      id: "",
      subject_code: "",
      subject_name: "",
      semester: "",
      faculty_batches: [],
    });
    setIsEditing(false);
    setFormOpen(true);
  };

  const openEditForm = (s: Subject) => {
    setFormData({
      id: s.id,
      subject_code: s.subject_code ?? "",
      subject_name: s.subject_name ?? "",
      semester: s.semester ?? "",
      faculty_batches: s.faculty_batches?.map((fb) => ({
        batch: fb.batch,
        faculty_id: fb.faculty_id,
      })) || [],
    });
    setIsEditing(true);
    setFormOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);

    try {
      if (!user?.id) throw new Error("User not found");

      const method = isEditing ? "PUT" : "POST";
      const body = {
        uid: user.id,
        id: formData.id || undefined,
        subject_code: formData.subject_code.trim(),
        subject_name: formData.subject_name.trim(),
        semester: formData.semester || undefined,
        faculty_batches: formData.faculty_batches.filter(
          (fb) => fb.batch && fb.faculty_id
        ),
      };

      if (!body.subject_code || !body.subject_name) {
        alert("Please provide subject code and subject name.");
        setBusy(false);
        return;
      }

      const res = await fetch(`/api/admin/subjects`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = await res.json().catch(() => null);

      if (!res.ok)
        throw new Error(
          payload?.error ?? payload?.message ?? "Operation failed",
        );

      const returned = payload?.data ?? payload ?? null;

      if (isEditing) {
        const updated = Array.isArray(returned) ? returned[0] : returned;
        setSubjects((prev) =>
          prev.map((p) => (p.id === updated?.id ? updated : p)),
        );
      } else {
        const newItem = Array.isArray(returned) ? returned[0] : returned;
        if (newItem) setSubjects((prev) => [...prev, newItem]);
      }

      setFormOpen(false);
    } catch (err: any) {
      console.error("Save failed:", err);
      alert("Save failed: " + (err?.message ?? "Unknown error"));
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  const handleDelete = async (s: Subject) => {
    if (
      !confirm(
        `Delete "${s.subject_name ?? s.subject_code}"? This can't be undone.`,
      )
    )
      return;

    setBusy(true);
    try {
      if (!user?.id) throw new Error("User not found");

      const res = await fetch(
        `/api/admin/subjects?id=${encodeURIComponent(s.id)}&uid=${encodeURIComponent(user.id)}`,
        { method: "DELETE" },
      );

      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "Delete failed");

      setSubjects((prev) => prev.filter((x) => x.id !== s.id));
    } catch (err: any) {
      console.error("Delete failed:", err);
      alert("Delete failed: " + (err?.message ?? "Unknown error"));
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const [statsRes, subjRes] = await Promise.all([
        fetch(`/api/admin/stats`, { headers }).then((r) =>
          r.json().catch(() => ({})),
        ),
        fetch(`/api/admin/subjects`, { headers }).then((r) =>
          r.json().catch(() => []),
        ),
      ]);
      setStats(statsRes?.data ?? statsRes ?? {});
      setSubjects(subjRes?.data ?? subjRes ?? []);
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  // Greeting based on time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 dark:from-gray-950 dark:via-indigo-950/10 dark:to-purple-950/10">
      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 xl:px-12 w-full mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-12"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-purple-500/25 animate-pulse-glow">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div className="space-y-1">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {getGreeting()},
              </p>
              <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                <span className="text-gradient">{userName || "Admin"}</span> 👋
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                Manage your platform from here
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={openAddForm}
              disabled={busy}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-semibold shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-60"
            >
              <Plus className="w-4 h-4" />
              Add Subject
            </button>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all disabled:opacity-60"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8"
        >
          <StatCard
            label="Students"
            value={stats.students ?? 0}
            icon={<GraduationCap className="w-6 h-6" />}
            colorClass="text-blue-600 dark:text-blue-400"
            trend="⬆ 12% vs last month"
          />
          <StatCard
            label="Faculty"
            value={stats.faculty ?? 0}
            icon={<Users className="w-6 h-6" />}
            colorClass="text-purple-600 dark:text-purple-400"
            trend="⬆ 4% vs last month"
          />
          <StatCard
            label="Subjects"
            value={stats.subjects ?? 0}
            icon={<BookOpen className="w-6 h-6" />}
            colorClass="text-indigo-600 dark:text-indigo-400"
            trend="Stable"
          />
          <StatCard
            label="Practicals"
            value={stats.practicals ?? 0}
            icon={<FileCode className="w-6 h-6" />}
            colorClass="text-emerald-600 dark:text-emerald-400"
            trend="⬆ 8% vs last month"
          />
        </motion.section>

        {/* Quick Actions */}
        <motion.section
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8"
        >
          <QuickActionCard
            title="Manage Users"
            description="Add, edit, or remove users"
            icon={<UserCog className="w-6 h-6" />}
            href="/admin/users"
            colorClass="text-indigo-600 dark:text-indigo-400"
          />
          <QuickActionCard
            title="Manage Subjects"
            description="Configure courses and subjects"
            icon={<BookOpen className="w-6 h-6" />}
            href="/admin/subjects"
            colorClass="text-purple-600 dark:text-purple-400"
          />
          <QuickActionCard
            title="System Analytics"
            description="View platform statistics"
            icon={<BarChart3 className="w-6 h-6" />}
            href="/admin/analytics"
            colorClass="text-pink-600 dark:text-pink-400"
          />
        </motion.section>

        {/* Subjects Table */}
        <motion.section
          variants={itemVariants}
          initial="hidden"
          animate="visible"
          className="glass-card-premium rounded-3xl overflow-hidden"
        >
          <div className="px-6 py-5 border-b border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/20 dark:to-purple-900/20">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-500" />
                Recent Subjects
              </h2>
              <Link
                href="/admin/subjects"
                className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1"
              >
                View All <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-gray-50/70 dark:bg-gray-800/70">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    Code
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    Subject
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    Faculty (Batch)
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    Semester
                  </th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200/50 dark:divide-gray-700/50">
                {loading ? (
                  [1, 2, 3].map((i) => <SkeletonRow key={i} />)
                ) : subjects.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center">
                      <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                        <BookOpen className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 font-medium">
                        No subjects found
                      </p>
                      <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                        Add your first subject to get started
                      </p>
                    </td>
                  </tr>
                ) : (
                  subjects.slice(0, 5).map((s) => (
                    <tr
                      key={s.id}
                      className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <span className="inline-flex px-3 py-1.5 text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg">
                          {s.subject_code ?? "—"}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-medium text-gray-900 dark:text-white">
                        {s.subject_name ?? "—"}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1.5">
                          {s.faculty_batches && s.faculty_batches.length > 0 ? (
                            s.faculty_batches.slice(0, 2).map((fb, idx) => (
                              <span
                                key={idx}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg"
                              >
                                {fb.faculty_name || "Unknown"}
                                <span className="text-indigo-500/60">({fb.batch})</span>
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400 text-sm">Not Assigned</span>
                          )}
                          {s.faculty_batches && s.faculty_batches.length > 2 && (
                            <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-lg">
                              +{s.faculty_batches.length - 2} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {s.semester ? (
                          <span
                            className={`inline-flex px-3 py-1 text-xs font-bold rounded-full
                             ${s.semester === "1" || s.semester === "2"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                : s.semester === "3" || s.semester === "4"
                                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                                  : s.semester === "5" || s.semester === "6"
                                    ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                                    : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                              }
                          `}
                          >
                            Sem {s.semester}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditForm(s)}
                            disabled={busy}
                            className="p-2 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors disabled:opacity-50"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(s)}
                            disabled={busy}
                            className="p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </motion.section>

        {/* Form Modal */}
        {formOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => !busy && setFormOpen(false)}
            />
            <form
              onSubmit={handleFormSubmit}
              className="relative w-full max-w-lg glass-card-premium rounded-3xl p-8 shadow-2xl animate-scaleIn"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {isEditing ? "Edit Subject" : "Add Subject"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  disabled={busy}
                  className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Subject Code
                  </label>
                  <input
                    className="input-premium"
                    placeholder="e.g., CS101"
                    value={formData.subject_code}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        subject_code: e.target.value,
                      }))
                    }
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Semester
                  </label>
                  <input
                    className="input-premium"
                    placeholder="e.g., 1"
                    value={formData.semester}
                    onChange={(e) =>
                      setFormData((f) => ({ ...f, semester: e.target.value }))
                    }
                    inputMode="numeric"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Subject Name
                  </label>
                  <input
                    className="input-premium"
                    placeholder="Enter subject name"
                    value={formData.subject_name}
                    onChange={(e) =>
                      setFormData((f) => ({
                        ...f,
                        subject_name: e.target.value,
                      }))
                    }
                    required
                  />
                </div>

                {/* Faculty-Batch Assignments */}
                <div className="space-y-3 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                      <Users className="w-4 h-4 text-indigo-500" />
                      Faculty Assignments by Batch
                    </label>
                    <button
                      type="button"
                      onClick={addFacultyBatch}
                      className="text-xs px-3 py-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Add Batch
                    </button>
                  </div>
                  {formData.faculty_batches.length === 0 ? (
                    <div className="p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-center text-sm text-gray-500">
                      No batch-faculty assignments yet. Click &quot;Add Batch&quot; to assign faculty.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {formData.faculty_batches.map((fb, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
                        >
                          <div className="flex-1 grid grid-cols-2 gap-3">
                            <div className="relative">
                              <select
                                value={fb.batch}
                                onChange={(e) => updateFacultyBatch(idx, "batch", e.target.value)}
                                className="input-premium appearance-none pr-10 cursor-pointer text-sm"
                              >
                                <option value="">Select Batch</option>
                                {availableBatches.map((b) => (
                                  <option key={b} value={b}>{b}</option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                            <div className="relative">
                              <select
                                value={fb.faculty_id}
                                onChange={(e) => updateFacultyBatch(idx, "faculty_id", e.target.value)}
                                className="input-premium appearance-none pr-10 cursor-pointer text-sm"
                              >
                                <option value="">Select Faculty</option>
                                {facultyList.map((f) => (
                                  <option key={f.uid} value={f.uid}>{f.name || f.uid}</option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFacultyBatch(idx)}
                            className="p-2 rounded-lg text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all"
                  disabled={busy}
                >
                  {busy ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
