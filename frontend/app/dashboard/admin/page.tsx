"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";

type Subject = {
  id: string;
  subject_code?: string;
  subject_name?: string;
  faculty_name?: string;
  semester?: number | null;
};

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

  // -----------------------------------------
  // lifecycle: auth check
  // -----------------------------------------
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

  // -----------------------------------------
  // helper: get access token
  // -----------------------------------------
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

  // -----------------------------------------
  // load stats + subjects
  // -----------------------------------------
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const token = await getAccessToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const [statsRes, subjRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/stats`, { headers }).then((r) =>
            r.json().catch(() => ({}))
          ),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/subjects`, { headers }).then((r) =>
            r.json().catch(() => [])
          ),
        ]);

        // normalize shapes
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

  // -----------------------------------------
  // form helpers
  // -----------------------------------------
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
        uid: user.id, // <-- include UID here
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

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/subjects`, {
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
      alert(isEditing ? "Subject updated" : "Subject added");
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
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/subjects?id=${encodeURIComponent(s.id)}&uid=${encodeURIComponent(user.id)}`,
        { method: "DELETE" }
      );

      const payload = await res.json().catch(() => null);
      if (!res.ok) throw new Error(payload?.error ?? "Delete failed");

      setSubjects((prev) => prev.filter((x) => x.id !== s.id));
      alert("Deleted.");
    } catch (err: any) {
      console.error("Delete failed:", err);
      alert("Delete failed: " + (err?.message ?? "Unknown error"));
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };


  // -----------------------------------------
  // small UI helpers
  // -----------------------------------------
  const statCard = (label: string, value: number) => (
    <div className="p-5 bg-white/60 dark:bg-gray-800/60 rounded-2xl shadow-sm hover:shadow-lg transition">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-3 text-2xl font-bold text-gray-800 dark:text-gray-100">{value}</p>
    </div>
  );

  if (!user)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400 text-lg">Loading...</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-950 dark:to-black">
      <Navbar />

      <main className="pt-24 px-4 md:px-12 pb-12">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100">🧑‍💼 Admin Dashboard</h1>

          <div className="flex items-center gap-3">
            <button
              onClick={openAddForm}
              disabled={busy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
            >
              + Add Subject
            </button>
            <button
              onClick={async () => {
                setLoading(true);
                try {
                  const token = await getAccessToken();
                  const headers: Record<string, string> = { "Content-Type": "application/json" };
                  if (token) headers["Authorization"] = `Bearer ${token}`;
                  const [statsRes, subjRes] = await Promise.all([
                    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/stats`, { headers }).then((r) =>
                      r.json().catch(() => ({}))
                    ),
                    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/subjects`, { headers }).then((r) =>
                      r.json().catch(() => [])
                    ),
                  ]);
                  setStats(statsRes?.data ?? statsRes ?? {});
                  setSubjects(subjRes?.data ?? subjRes ?? []);
                } catch (err) {
                  console.error("Refresh failed:", err);
                } finally {
                  if (mountedRef.current) setLoading(false);
                }
              }}
              className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              Refresh
            </button>
          </div>
        </div>

        {/* Stats grid */}
        <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {statCard("Students", stats.students ?? 0)}
          {statCard("Faculty", stats.faculty ?? 0)}
          {statCard("Subjects", stats.subjects ?? 0)}
          {statCard("Practicals", stats.practicals ?? 0)}
        </section>

        {/* Subjects table */}
        <section className="bg-transparent">
          <div className="overflow-hidden rounded-2xl shadow-md">
            <table className="min-w-full text-left divide-y divide-gray-200 dark:divide-gray-700 bg-white/40 dark:bg-gray-800/40">
              <thead className="bg-gray-100/70 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-sm font-medium text-gray-600">Code</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-600">Subject</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-600">Faculty</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-600">Semester</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {subjects.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                      {loading ? "Loading subjects..." : "No subjects found."}
                    </td>
                  </tr>
                ) : (
                  subjects.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60 transition">
                      <td className="px-4 py-3 text-sm">{s.subject_code ?? "—"}</td>
                      <td className="px-4 py-3 text-sm">{s.subject_name ?? "—"}</td>
                      <td className="px-4 py-3 text-sm">{s.faculty_name ?? "—"}</td>
                      <td className="px-4 py-3 text-sm">{s.semester ?? "—"}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => openEditForm(s)}
                            className="text-blue-600 hover:underline"
                            disabled={busy}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(s)}
                            className="text-red-600 hover:underline"
                            disabled={busy}
                          >
                            Delete
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
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => !busy && setFormOpen(false)} />
            <form
              onSubmit={handleFormSubmit}
              className="relative w-full max-w-lg bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-2xl mx-4"
            >
              <h3 className="text-xl font-semibold mb-4">{isEditing ? "Edit Subject" : "Add Subject"}</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  className="p-3 border rounded-md bg-gray-50 dark:bg-gray-700"
                  placeholder="Subject Code (CS101)"
                  value={formData.subject_code}
                  onChange={(e) => setFormData((f) => ({ ...f, subject_code: e.target.value }))}
                  required
                />
                <input
                  className="p-3 border rounded-md bg-gray-50 dark:bg-gray-700 col-span-1 sm:col-span-1"
                  placeholder="Semester (number)"
                  value={formData.semester}
                  onChange={(e) => setFormData((f) => ({ ...f, semester: e.target.value }))}
                  inputMode="numeric"
                />
                <input
                  className="p-3 border rounded-md bg-gray-50 dark:bg-gray-700 col-span-1 sm:col-span-2"
                  placeholder="Subject Name"
                  value={formData.subject_name}
                  onChange={(e) => setFormData((f) => ({ ...f, subject_name: e.target.value }))}
                  required
                />
                <input
                  className="p-3 border rounded-md bg-gray-50 dark:bg-gray-700 col-span-1 sm:col-span-2"
                  placeholder="Faculty Name (optional)"
                  value={formData.faculty_name}
                  onChange={(e) => setFormData((f) => ({ ...f, faculty_name: e.target.value }))}
                />
              </div>

              <div className="flex justify-end gap-3 mt-4">
                <button
                  type="button"
                  onClick={() => setFormOpen(false)}
                  className="px-4 py-2 rounded-md border"
                  disabled={busy}
                >
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 rounded-md bg-blue-600 text-white" disabled={busy}>
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
