"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  X,
  Search,
  GraduationCap,
  UserCog,
  Shield,
  Mail,
  ChevronDown,
  Hash,
  Calendar,
} from "lucide-react";

type ApiUsersResponse = { success?: boolean; data?: any[] } | any[];

// Role badge component
function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    student: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200/50 dark:border-blue-800/50",
    faculty: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200/50 dark:border-purple-800/50",
    admin: "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400 border-pink-200/50 dark:border-pink-800/50",
  };

  const icons: Record<string, React.ReactNode> = {
    student: <GraduationCap className="w-3 h-3" />,
    faculty: <UserCog className="w-3 h-3" />,
    admin: <Shield className="w-3 h-3" />,
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border ${styles[role.toLowerCase()] || styles.student}`}>
      {icons[role.toLowerCase()]}
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}

// Skeleton Row
function SkeletonRow({ showStudentCols = false }: { showStudentCols?: boolean }) {
  return (
    <tr className="animate-pulse">
      <td className="px-5 py-4"><div className="flex items-center gap-3"><div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-xl" /><div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded" /></div></td>
      <td className="px-5 py-4"><div className="h-4 w-36 bg-gray-200 dark:bg-gray-700 rounded" /></td>
      {showStudentCols && (
        <>
          <td className="px-5 py-4"><div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" /></td>
          <td className="px-5 py-4"><div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" /></td>
        </>
      )}
      <td className="px-5 py-4"><div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded" /></td>
    </tr>
  );
}

// Stat Card
function StatCard({ label, value, icon, gradient }: { label: string; value: number; icon: React.ReactNode; gradient: string }) {
  return (
    <div className="glass-card rounded-2xl p-5 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl ${gradient} flex items-center justify-center shadow-lg`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const mountedRef = useRef<boolean>(false);

  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"student" | "faculty" | "admin">("student");

  const [form, setForm] = useState({
    id: "",
    name: "",
    email: "",
    role: "student",
    roll_no: "",
    semester: "",
  });

  // Auth check
  useEffect(() => {
    mountedRef.current = true;
    const fetchUser = async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const u = data?.user ?? null;
        if (!u) return router.push("/auth/login");
        if (mountedRef.current) setUser(u);
      } catch (err) {
        console.error("Auth fetch error:", err);
        router.push("/auth/login");
      }
    };
    fetchUser();
    return () => { mountedRef.current = false; };
  }, [router, supabase]);

  // API Helpers
  const getAccessToken = async (): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token ?? null;
    } catch {
      return null;
    }
  };

  const safeFetchJson = async (url: string, opts?: RequestInit): Promise<ApiUsersResponse> => {
    const res = await fetch(url, opts);
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} - ${text || "<no body>"}`);
    if (!text) return [];
    try { return JSON.parse(text); } catch { return text as any; }
  };

  // Load users
  const loadUsers = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const payload = await safeFetchJson(`/api/admin/users`, { headers });
      const arr = (payload && (payload as any).data) ?? payload ?? [];

      if (!Array.isArray(arr)) setUsers([]);
      else setUsers(arr);
    } catch (err: any) {
      console.error("Fetch users failed:", err);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); }, [user]);

  const handleChange = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  // Save user
  const handleSave = async (form: any) => {
    if (!form.email) { alert("Email is required!"); return; }

    setBusy(true);
    try {
      const method = form.id ? "PUT" : "POST";
      const url = form.id ? `/api/admin/users/${form.id}` : `/api/admin/users`;

      const payload: any = {
        name: form.name,
        email: form.email,
        role: form.role,
      };
      if (form.role === "student") {
        payload.roll_no = form.roll_no;
        payload.semester = form.semester;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      await loadUsers();
      setHighlightId(form.id ?? data.data?.uid ?? null);
      setOpen(false);
    } catch (err: any) {
      console.error("Save failed:", err);
      alert(err.message ?? "Error saving user");
    } finally {
      setBusy(false);
    }
  };

  // Delete user
  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    setBusy(true);
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, { method: "DELETE", headers });
      const text = await res.text();
      if (!res.ok) throw new Error(`Delete failed: ${res.status} ${res.statusText} - ${text || "<no body>"}`);

      await loadUsers();
    } catch (err: any) {
      console.error("Delete failed:", err);
      alert("Delete failed: " + (err?.message ?? "Unknown error"));
    } finally {
      setBusy(false);
    }
  };

  if (!user)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 dark:from-gray-950 dark:via-indigo-950/10 dark:to-purple-950/10">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );

  // Group users by role
  const usersByRole: Record<string, any[]> = { student: [], faculty: [], admin: [] };
  users.forEach((u) => {
    const r = (u.role ?? "student").toLowerCase();
    if (!usersByRole[r]) usersByRole[r] = [];
    usersByRole[r].push(u);
  });

  // Filter by search
  const filteredUsers = usersByRole[selectedRole].filter((u) =>
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.student_details?.roll_no?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 dark:from-gray-950 dark:via-indigo-950/10 dark:to-purple-950/10">
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 animate-slideUp">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-purple-500/25">
              <Users className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Manage Users
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                {users.length} user{users.length !== 1 ? "s" : ""} total
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              setForm({ id: "", name: "", email: "", role: "student", roll_no: "", semester: "" });
              setIsEditing(false);
              setOpen(true);
            }}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white font-medium shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:-translate-y-0.5 transition-all"
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 animate-slideUp" style={{ animationDelay: "100ms" }}>
          <StatCard
            label="Students"
            value={usersByRole.student.length}
            icon={<GraduationCap className="w-6 h-6 text-white" />}
            gradient="bg-gradient-to-br from-blue-500 to-cyan-500"
          />
          <StatCard
            label="Faculty"
            value={usersByRole.faculty.length}
            icon={<UserCog className="w-6 h-6 text-white" />}
            gradient="bg-gradient-to-br from-purple-500 to-pink-500"
          />
          <StatCard
            label="Admins"
            value={usersByRole.admin.length}
            icon={<Shield className="w-6 h-6 text-white" />}
            gradient="bg-gradient-to-br from-indigo-500 to-purple-500"
          />
        </div>

        {/* Role Tabs & Search */}
        <div className="glass-card rounded-2xl p-4 mb-6 animate-slideUp" style={{ animationDelay: "150ms" }}>
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            {/* Role Tabs */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
              {(["student", "faculty", "admin"] as const).map((role) => (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${selectedRole === role
                      ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                    }`}
                >
                  {role === "student" && <GraduationCap className="w-4 h-4" />}
                  {role === "faculty" && <UserCog className="w-4 h-4" />}
                  {role === "admin" && <Shield className="w-4 h-4" />}
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                  <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${selectedRole === role
                      ? "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                    }`}>
                    {usersByRole[role].length}
                  </span>
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Users Table */}
        <div className="glass-card-premium rounded-3xl overflow-hidden animate-slideUp" style={{ animationDelay: "200ms" }}>
          <div className="px-6 py-5 border-b border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-r from-indigo-50/50 to-purple-50/50 dark:from-indigo-900/20 dark:to-purple-900/20">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              {selectedRole === "student" && <GraduationCap className="w-5 h-5 text-blue-500" />}
              {selectedRole === "faculty" && <UserCog className="w-5 h-5 text-purple-500" />}
              {selectedRole === "admin" && <Shield className="w-5 h-5 text-pink-500" />}
              {selectedRole.charAt(0).toUpperCase() + selectedRole.slice(1)}s
              {filteredUsers.length !== usersByRole[selectedRole].length && (
                <span className="text-sm font-normal text-gray-500">
                  ({filteredUsers.length} of {usersByRole[selectedRole].length})
                </span>
              )}
            </h2>
          </div>

          {loading ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-gray-50/70 dark:bg-gray-800/70">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">User</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Email</th>
                    {selectedRole === "student" && (
                      <>
                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Roll No.</th>
                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Semester</th>
                      </>
                    )}
                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200/50 dark:divide-gray-700/50">
                  {[1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} showStudentCols={selectedRole === "student"} />)}
                </tbody>
              </table>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <Users className="w-10 h-10 text-gray-400" />
              </div>
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                {searchTerm ? "No users match your search" : `No ${selectedRole}s found`}
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                {searchTerm ? "Try a different search term" : `Add your first ${selectedRole} to get started`}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-gray-50/70 dark:bg-gray-800/70">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">User</th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Email</th>
                    {selectedRole === "student" && (
                      <>
                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Roll No.</th>
                        <th className="px-5 py-3.5 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Semester</th>
                      </>
                    )}
                    <th className="px-5 py-3.5 text-right text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200/50 dark:divide-gray-700/50">
                  {filteredUsers.map((u) => {
                    const student = u.student_details ?? {};
                    const initials = (u.name || u.email || "U").split(" ").map((n: string) => n[0]).slice(0, 2).join("").toUpperCase();

                    return (
                      <tr
                        key={u.uid}
                        className={`hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-colors ${highlightId === u.uid ? "bg-emerald-50 dark:bg-emerald-900/20" : ""
                          }`}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold shadow-lg">
                              {initials}
                            </div>
                            <span className="font-medium text-gray-900 dark:text-white">
                              {u.name || "—"}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                            <Mail className="w-4 h-4" />
                            {u.email}
                          </div>
                        </td>
                        {selectedRole === "student" && (
                          <>
                            <td className="px-5 py-4">
                              {student.roll_no ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-lg">
                                  <Hash className="w-3 h-3" />
                                  {student.roll_no}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                            <td className="px-5 py-4">
                              {student.semester ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-lg">
                                  <Calendar className="w-3 h-3" />
                                  Sem {student.semester}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              )}
                            </td>
                          </>
                        )}
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => {
                                setForm({
                                  id: u.uid,
                                  name: u.name ?? "",
                                  email: u.email ?? "",
                                  role: u.role ?? "student",
                                  roll_no: student.roll_no ?? "",
                                  semester: student.semester ?? "",
                                });
                                setIsEditing(true);
                                setOpen(true);
                              }}
                              disabled={busy}
                              className="p-2 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors disabled:opacity-50"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(u.uid)}
                              disabled={busy}
                              className="p-2 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
          <div className="relative w-full max-w-lg glass-card-premium rounded-3xl p-8 shadow-2xl animate-scaleIn">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                  {isEditing ? "Edit User" : "Add New User"}
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

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                <input
                  className="input-premium"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Enter full name"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Email *</label>
                <input
                  className="input-premium"
                  type="email"
                  value={form.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  placeholder="Enter email"
                  disabled={isEditing}
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Role</label>
                <div className="relative">
                  <select
                    className="input-premium appearance-none pr-10 cursor-pointer"
                    value={form.role}
                    onChange={(e) => handleChange("role", e.target.value)}
                  >
                    <option value="student">Student</option>
                    <option value="faculty">Faculty</option>
                    <option value="admin">Admin</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {form.role === "student" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Roll No.</label>
                    <input
                      className="input-premium"
                      value={form.roll_no}
                      onChange={(e) => handleChange("roll_no", e.target.value)}
                      placeholder="e.g., 2024001"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-gray-700 dark:text-gray-300">Semester</label>
                    <input
                      className="input-premium"
                      value={form.semester}
                      onChange={(e) => handleChange("semester", e.target.value)}
                      placeholder="e.g., 1"
                    />
                  </div>
                </div>
              )}
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
                onClick={() => handleSave(form)}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all"
                disabled={busy}
              >
                {busy ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
