"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";
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
} from "lucide-react";

type Subject = {
  id: string;
  subject_code?: string;
  subject_name?: string;
  faculty_name?: string;
  semester?: number | null;
};

// Stat Card Component
function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="glass-card-premium rounded-2xl p-5 hover-lift">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {label}
          </p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
            {value}
          </p>
        </div>
        <div className={`icon-container-lg ${color}`}>{icon}</div>
      </div>
    </div>
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
    faculty_name: "",
    semester: "",
  });

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
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const [statsRes, subjRes] = await Promise.all([
          fetch(`/api/admin/stats`, { headers }).then((r) =>
            r.json().catch(() => ({}))
          ),
          fetch(`/api/admin/subjects`, { headers }).then((r) =>
            r.json().catch(() => [])
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

  // Form helpers
  const openAddForm = () => {
    setFormData({ id: "", subject_code: "", subject_name: "", faculty_name: "", semester: "" });
    setIsEditing(false);
    setFormOpen(true);
  };

  const openEditForm = (s: Subject) => {
    setFormData({
      id: s.id,
      subject_code: s.subject_code ?? "",
      subject_name: s.subject_name ?? "",
      faculty_name: s.faculty_name ?? "",
      semester: s.semester?.toString() ?? "",
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
        faculty_name: formData.faculty_name?.trim() || undefined,
        semester: formData.semester ? Number(formData.semester) : undefined,
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

      if (!res.ok) throw new Error(payload?.error ?? payload?.message ?? "Operation failed");

      const returned = payload?.data ?? payload ?? null;

      if (isEditing) {
        const updated = Array.isArray(returned) ? returned[0] : returned;
        setSubjects((prev) => prev.map((p) => (p.id === updated?.id ? updated : p)));
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
    if (!confirm(`Delete "${s.subject_name ?? s.subject_code}"? This can't be undone.`)) return;

    setBusy(true);
    try {
      if (!user?.id) throw new Error("User not found");

      const res = await fetch(
        `/api/admin/subjects?id=${encodeURIComponent(s.id)}&uid=${encodeURIComponent(user.id)}`,
        { method: "DELETE" }
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
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const [statsRes, subjRes] = await Promise.all([
        fetch(`/api/admin/stats`, { headers }).then((r) => r.json().catch(() => ({}))),
        fetch(`/api/admin/subjects`, { headers }).then((r) => r.json().catch(() => [])),
      ]);
      setStats(statsRes?.data ?? statsRes ?? {});
      setSubjects(subjRes?.data ?? subjRes ?? []);
    } catch (err) {
      console.error("Refresh failed:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  if (!user)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-red-50/20 to-orange-50/20 dark:from-gray-950 dark:via-red-950/10 dark:to-orange-950/10">
      <Navbar />

      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 animate-slideUp">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-red-500 to-orange-600 shadow-lg shadow-red-500/25">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gradient-warm">Admin Dashboard</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Manage subjects, users, and system settings
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={openAddForm}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-medium shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-60"
            >
              <Plus className="w-4 h-4" />
              Add Subject
            </button>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10 animate-slideUp animation-delay-100">
          <StatCard
            label="Students"
            value={stats.students ?? 0}
            icon={<GraduationCap className="w-6 h-6 text-blue-600 dark:text-blue-400" />}
            color="bg-blue-100 dark:bg-blue-900/30"
          />
          <StatCard
            label="Faculty"
            value={stats.faculty ?? 0}
            icon={<Users className="w-6 h-6 text-purple-600 dark:text-purple-400" />}
            color="bg-purple-100 dark:bg-purple-900/30"
          />
          <StatCard
            label="Subjects"
            value={stats.subjects ?? 0}
            icon={<BookOpen className="w-6 h-6 text-amber-600 dark:text-amber-400" />}
            color="bg-amber-100 dark:bg-amber-900/30"
          />
          <StatCard
            label="Practicals"
            value={stats.practicals ?? 0}
            icon={<FileCode className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />}
            color="bg-emerald-100 dark:bg-emerald-900/30"
          />
        </section>

        {/* Subjects Table */}
        <section className="glass-card rounded-2xl overflow-hidden animate-slideUp animation-delay-200">
          <div className="px-6 py-4 border-b border-gray-200/50 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-800/50">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-500" />
              Subjects Management
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead className="bg-gray-100/70 dark:bg-gray-800/70">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    Code
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    Subject
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    Faculty
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                    Semester
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
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
                      <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-500 dark:text-gray-400">
                        No subjects found. Add your first subject!
                      </p>
                    </td>
                  </tr>
                ) : (
                  subjects.map((s) => (
                    <tr
                      key={s.id}
                      className="hover:bg-gray-50/60 dark:hover:bg-gray-800/60 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <span className="inline-flex px-2.5 py-1 text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg">
                          {s.subject_code ?? "—"}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-medium text-gray-900 dark:text-white">
                        {s.subject_name ?? "—"}
                      </td>
                      <td className="px-5 py-4 text-gray-600 dark:text-gray-400">
                        {s.faculty_name ?? "—"}
                      </td>
                      <td className="px-5 py-4">
                        {s.semester ? (
                          <span className="inline-flex px-2.5 py-1 text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg">
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
                            className="p-2 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
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
        </section>

        {/* Form Modal */}
        {formOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => !busy && setFormOpen(false)}
            />
            <form
              onSubmit={handleFormSubmit}
              className="relative w-full max-w-lg glass-card-premium rounded-2xl p-6 shadow-2xl animate-scaleIn"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {isEditing ? "Edit Subject" : "Add Subject"}
                </h3>
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
                <input
                  className="input-premium"
                  placeholder="Subject Code (CS101)"
                  value={formData.subject_code}
                  onChange={(e) => setFormData((f) => ({ ...f, subject_code: e.target.value }))}
                  required
                />
                <input
                  className="input-premium"
                  placeholder="Semester (number)"
                  value={formData.semester}
                  onChange={(e) => setFormData((f) => ({ ...f, semester: e.target.value }))}
                  inputMode="numeric"
                />
                <input
                  className="input-premium sm:col-span-2"
                  placeholder="Subject Name"
                  value={formData.subject_name}
                  onChange={(e) => setFormData((f) => ({ ...f, subject_name: e.target.value }))}
                  required
                />
                <input
                  className="input-premium sm:col-span-2"
                  placeholder="Faculty Name (optional)"
                  value={formData.faculty_name}
                  onChange={(e) => setFormData((f) => ({ ...f, faculty_name: e.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="btn-secondary"
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
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