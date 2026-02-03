"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  BookOpen,
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  ChevronDown,
  Users,
} from "lucide-react";

type FacultyBatch = {
  id?: number;
  batch: string;
  faculty_id: string;
  faculty_name?: string;
};

type Subject = {
  id: string;
  subject_name: string;
  subject_code: string;
  semester?: string;
  faculty_batches?: FacultyBatch[];
};

type Faculty = {
  uid: string;
  name?: string;
  email: string;
};

// Skeleton Row
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="px-5 py-4">
        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
      </td>
      <td className="px-5 py-4">
        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
      </td>
      <td className="px-5 py-4">
        <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
      </td>
      <td className="px-5 py-4">
        <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded" />
      </td>
      <td className="px-5 py-4">
        <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
      </td>
    </tr>
  );
}

// Hash string to pastel color
function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    "from-blue-400 to-cyan-500",
    "from-purple-400 to-pink-500",
    "from-emerald-400 to-teal-500",
    "from-orange-400 to-amber-500",
    "from-rose-400 to-pink-500",
    "from-indigo-400 to-violet-500",
    "from-sky-400 to-blue-500",
    "from-fuchsia-400 to-purple-500",
  ];
  return colors[Math.abs(hash) % colors.length];
}

export default function AdminSubjects() {
  const router = useRouter();
  const mountedRef = useRef<boolean>(false);
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [availableBatches, setAvailableBatches] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSemester, setFilterSemester] = useState<string>("all");

  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    id: "",
    subject_name: "",
    subject_code: "",
    semester: "",
    faculty_batches: [] as { batch: string; faculty_id: string }[],
  });

  // Auth check
  useEffect(() => {
    mountedRef.current = true;

    const fetchUser = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();
        if (error) throw error;

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

  const fetchData = async () => {
    if (!user || !mountedRef.current) return;

    setLoading(true);
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const [subjRes, facRes] = await Promise.all([
        fetch(`/api/admin/subjects`, { headers }).then((r) =>
          r.json().catch(() => []),
        ),
        fetch(`/api/admin/faculty`, { headers }).then((r) =>
          r.json().catch(() => []),
        ),
      ]);

      if (!mountedRef.current) return;

      setSubjects(subjRes?.data ?? subjRes ?? []);
      setFaculty(facRes?.data ?? facRes ?? []);

      // Get unique batches from users
      const batchesFromData = (facRes?.data ?? facRes ?? [])
        .map((f: any) => f.batch)
        .filter((b: any) => b && typeof b === "string");
      const allBatches = ["All", "1", "2", "3", "4", ...batchesFromData];
      setAvailableBatches([...new Set(allBatches)].sort());
    } catch (err) {
      console.error("Fetch failed:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleChange = (key: string, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const addFacultyBatch = () => {
    setForm((prev) => ({
      ...prev,
      faculty_batches: [...prev.faculty_batches, { batch: "", faculty_id: "" }],
    }));
  };

  const updateFacultyBatch = (index: number, field: "batch" | "faculty_id", value: string) => {
    setForm((prev) => {
      const updated = [...prev.faculty_batches];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, faculty_batches: updated };
    });
  };

  const removeFacultyBatch = (index: number) => {
    setForm((prev) => ({
      ...prev,
      faculty_batches: prev.faculty_batches.filter((_, i) => i !== index),
    }));
  };

  const handleSave = async () => {
    if (!form.subject_name.trim() || !form.subject_code.trim()) {
      alert("Subject name and code are required");
      return;
    }

    // Validate faculty batches
    const validBatches = form.faculty_batches.filter(
      (fb) => fb.batch && fb.faculty_id
    );

    setBusy(true);
    try {
      const method = isEditing ? "PUT" : "POST";
      const endpoint = `/api/admin/subjects`;
      const body = {
        id: form.id || undefined,
        subject_name: form.subject_name,
        subject_code: form.subject_code,
        semester: form.semester || undefined,
        faculty_batches: validBatches,
      };

      const token = await getAccessToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(endpoint, {
        method,
        headers,
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.success === false)
        throw new Error(payload?.error || "Operation failed");

      if (!mountedRef.current) return;

      setOpen(false);
      setForm({
        id: "",
        subject_name: "",
        subject_code: "",
        semester: "",
        faculty_batches: [],
      });
      setIsEditing(false);
      fetchData();
    } catch (err: any) {
      console.error("Save failed:", err);
      alert("Save failed: " + (err?.message || "Unknown error"));
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this subject?")) return;

    setBusy(true);
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(
        `/api/admin/subjects?id=${encodeURIComponent(id)}`,
        {
          method: "DELETE",
          headers,
        },
      );

      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.success === false)
        throw new Error(payload?.error || "Delete failed");

      if (!mountedRef.current) return;
      setSubjects((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      console.error("Delete failed:", err);
      alert("Delete failed: " + (err?.message || "Unknown error"));
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  // Filter subjects
  const filteredSubjects = subjects.filter((s) => {
    const facultyNames = s.faculty_batches?.map((fb) => fb.faculty_name).join(" ") || "";
    const matchesSearch =
      s.subject_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.subject_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      facultyNames.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSemester =
      filterSemester === "all" || s.semester === filterSemester;
    return matchesSearch && matchesSemester;
  });

  // Get unique semesters
  const semesters = [
    ...new Set(subjects.map((s) => s.semester).filter(Boolean)),
  ].sort();

  const openEditModal = (s: Subject) => {
    setForm({
      id: s.id,
      subject_name: s.subject_name,
      subject_code: s.subject_code,
      semester: s.semester || "",
      faculty_batches:
        s.faculty_batches?.map((fb) => ({
          batch: fb.batch,
          faculty_id: fb.faculty_id,
        })) || [],
    });
    setIsEditing(true);
    setOpen(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 dark:from-gray-950 dark:via-indigo-950/10 dark:to-purple-950/10">
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 xl:px-12 w-full mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 animate-slideUp">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-purple-500/25">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Manage Subjects
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                {subjects.length} subject{subjects.length !== 1 ? "s" : ""}{" "}
                total
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setForm({
                id: "",
                subject_name: "",
                subject_code: "",
                semester: "",
                faculty_batches: [],
              });
              setIsEditing(false);
              setOpen(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-medium shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:-translate-y-0.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add Subject
          </button>
        </div>

        {/* Subjects Table */}
        <div
          className="glass-card-premium rounded-3xl overflow-hidden animate-slideUp"
          style={{ animationDelay: "100ms" }}
        >
          {/* Header with Search & Filter */}
          <div className="px-6 py-4 border-b border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/20 dark:to-purple-900/20">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <BookOpen className="w-4 h-4 text-indigo-500" />
                <span className="font-medium">
                  {filteredSubjects.length === subjects.length
                    ? `${subjects.length} subjects`
                    : `${filteredSubjects.length} of ${subjects.length} subjects`}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-4 py-2 w-full sm:w-48 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
                  />
                </div>
                <div className="relative">
                  <select
                    value={filterSemester}
                    onChange={(e) => setFilterSemester(e.target.value)}
                    className="appearance-none pl-4 pr-8 py-2 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all cursor-pointer"
                  >
                    <option value="all">All Semesters</option>
                    {semesters.map((sem) => (
                      <option key={sem} value={sem}>
                        Sem {sem}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="bg-gray-50/70 dark:bg-gray-800/70">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                      Name
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                      Code
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                      Semester
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                      Faculty Assignments
                    </th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200/50 dark:divide-gray-700/50">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <SkeletonRow key={i} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : filteredSubjects.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <BookOpen className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                {searchTerm || filterSemester !== "all"
                  ? "No subjects match your filters"
                  : "No subjects found"}
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                {searchTerm || filterSemester !== "all"
                  ? "Try adjusting your search or filter"
                  : "Add your first subject to get started"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px]">
                <thead className="bg-gray-50/70 dark:bg-gray-800/70">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                      Name
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                      Code
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                      Semester
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                      Faculty Assignments
                    </th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200/50 dark:divide-gray-700/50">
                  {filteredSubjects.map((s) => (
                    <tr
                      key={s.id}
                      className="hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors"
                    >
                      <td className="px-5 py-4 font-medium text-gray-900 dark:text-white">
                        {s.subject_name}
                      </td>
                      <td className="px-5 py-4">
                        <span className="inline-flex px-3 py-1.5 text-xs font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg uppercase tracking-wide">
                          {s.subject_code}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        {s.semester ? (
                          <span className="inline-flex px-3 py-1.5 text-xs font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg">
                            Sem {s.semester}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        {s.faculty_batches && s.faculty_batches.length > 0 ? (
                          <div className="flex flex-wrap gap-2">
                            {s.faculty_batches.map((fb, idx) => (
                              <div
                                key={idx}
                                className="flex items-center gap-2 px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs"
                              >
                                <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                  {fb.batch}:
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <div
                                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-gradient-to-br ${stringToColor(fb.faculty_name || "")}`}
                                  >
                                    {(fb.faculty_name || "?").charAt(0).toUpperCase()}
                                  </div>
                                  <span className="text-gray-700 dark:text-gray-300">
                                    {fb.faculty_name || "Unknown"}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">
                            Not assigned
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => openEditModal(s)}
                            disabled={busy}
                            className="p-2.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors disabled:opacity-50"
                            title="Edit"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(s.id)}
                            disabled={busy}
                            className="p-2.5 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors disabled:opacity-50"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => !busy && setOpen(false)}
          />
          <div className="relative w-full max-w-2xl glass-card-premium rounded-3xl p-8 shadow-2xl animate-scaleIn max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500">
                  <BookOpen className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {isEditing ? "Edit Subject" : "Add New Subject"}
                </h3>
              </div>
              <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Subject Name *
                </label>
                <input
                  className="input-premium"
                  value={form.subject_name}
                  onChange={(e) => handleChange("subject_name", e.target.value)}
                  placeholder="Enter subject name"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Subject Code *
                  </label>
                  <input
                    className="input-premium"
                    value={form.subject_code}
                    onChange={(e) =>
                      handleChange("subject_code", e.target.value)
                    }
                    placeholder="e.g., CS101"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Semester
                  </label>
                  <input
                    className="input-premium"
                    value={form.semester}
                    onChange={(e) => handleChange("semester", e.target.value)}
                    placeholder="e.g., 1"
                  />
                </div>
              </div>

              {/* Batch-wise Faculty Assignments */}
              <div className="space-y-3">
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

                {form.faculty_batches.length === 0 ? (
                  <div className="p-4 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-center text-sm text-gray-500">
                    No batch-faculty assignments yet. Click "Add Batch" to assign faculty.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {form.faculty_batches.map((fb, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex-1 grid grid-cols-2 gap-3">
                          <div className="relative">
                            <select
                              value={fb.batch}
                              onChange={(e) =>
                                updateFacultyBatch(index, "batch", e.target.value)
                              }
                              className="input-premium appearance-none pr-10 cursor-pointer text-sm"
                            >
                              <option value="">Select Batch</option>
                              {availableBatches.map((batch) => (
                                <option key={batch} value={batch}>
                                  {batch}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                          </div>
                          <div className="relative">
                            <select
                              value={fb.faculty_id}
                              onChange={(e) =>
                                updateFacultyBatch(index, "faculty_id", e.target.value)
                              }
                              className="input-premium appearance-none pr-10 cursor-pointer text-sm"
                            >
                              <option value="">Select Faculty</option>
                              {faculty.map((f) => (
                                <option key={f.uid} value={f.uid}>
                                  {f.name || f.email}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFacultyBatch(index)}
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
                onClick={() => setOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                disabled={busy}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all"
                disabled={busy}
              >
                {busy
                  ? "Saving..."
                  : isEditing
                    ? "Save Changes"
                    : "Add Subject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
