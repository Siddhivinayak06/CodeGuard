"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";
import type { User } from "@supabase/supabase-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

type ApiUsersResponse = { success?: boolean; data?: any[] } | any[];

export default function AdminUsers() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const mountedRef = useRef<boolean>(false);

  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);

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

  // ---------------------------
  // Auth check
  // ---------------------------
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

  // ---------------------------
  // API Helpers
  // ---------------------------
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

  // ---------------------------
  // Load users dynamically
  // ---------------------------
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

  // ---------------------------
  // Save user (add/edit)
  // ---------------------------
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

      await loadUsers(); // refresh data
      setHighlightId(form.id ?? data.data?.uid ?? null); // highlight updated user
      setOpen(false);
    } catch (err: any) {
      console.error("Save failed:", err);
      alert(err.message ?? "Error saving user");
    } finally {
      setBusy(false);
    }
  };

  // ---------------------------
  // Delete user
  // ---------------------------
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

      await loadUsers(); // refresh data
    } catch (err: any) {
      console.error("Delete failed:", err);
      alert("Delete failed: " + (err?.message ?? "Unknown error"));
    } finally {
      setBusy(false);
    }
  };

  if (!user)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400 text-lg">Loading...</p>
      </div>
    );

  // ---------------------------
  // Group users by role
  // ---------------------------
  const usersByRole: Record<string, any[]> = { student: [], faculty: [], admin: [] };
  users.forEach((u) => {
    const r = (u.role ?? "student").toLowerCase();
    if (!usersByRole[r]) usersByRole[r] = [];
    usersByRole[r].push(u);
  });

  const renderUserTable = (arr: any[]) => (
    <div className="overflow-x-auto rounded-2xl shadow-md bg-white/50 dark:bg-gray-800/50">
      {arr.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 p-4">No users found.</p>
      ) : (
        <table className="w-full mt-2 bg-white/40 dark:bg-gray-800/40 border border-gray-200/50 dark:border-gray-700/50">
          <thead className="bg-gray-100/70 dark:bg-gray-700/50">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Email</th>
              {selectedRole === "student" && (
                <>
                  <th className="px-4 py-3 text-left">Roll No.</th>
                  <th className="px-4 py-3 text-left">Semester</th>
                </>
              )}
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {arr.map((u) => {
              const student = u.student_details ?? {};
              return (
                <tr
                  key={u.uid}
                  className={`border-t border-gray-200/40 dark:border-gray-700/40 hover:bg-gray-50/60 dark:hover:bg-gray-800/60 transition
                  ${highlightId === u.uid ? "bg-green-100 dark:bg-green-800/40" : ""}`}
                >
                  <td className="px-4 py-3">{u.name || "—"}</td>
                  <td className="px-4 py-3">{u.email}</td>
                  {selectedRole === "student" && (
                    <>
                      <td className="px-4 py-3">{student.roll_no || "—"}</td>
                      <td className="px-4 py-3">{student.semester || "—"}</td>
                    </>
                  )}
                  <td className="px-4 py-3 space-x-3">
                    <button
                      className="text-blue-500 hover:underline"
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
                    >
                      Edit
                    </button>
                    <button
                      className="text-red-500 hover:underline"
                      onClick={() => handleDelete(u.uid)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );

  // ---------------------------
  // Main render
  // ---------------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-950 dark:to-black">
      <Navbar />
      <div className="pt-24 px-6 md:px-12">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100">👥 Manage Users</h1>
          <Button
            onClick={() => {
              setForm({ id: "", name: "", email: "", role: "student", roll_no: "", semester: "" });
              setIsEditing(false);
              setOpen(true);
            }}
          >
            ➕ Add User
          </Button>
        </div>

        {/* Role Filter */}
        <div className="flex gap-4 mb-6">
          {(["student", "faculty", "admin"] as const).map((role) => (
            <Button
              key={role}
              variant={selectedRole === role ? "default" : "outline"}
              onClick={() => setSelectedRole(role)}
            >
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </Button>
          ))}
        </div>

        {loading ? (
          <p className="text-gray-500 dark:text-gray-400">Loading users...</p>
        ) : (
          renderUserTable(usersByRole[selectedRole])
        )}
      </div>

      {/* Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{isEditing ? "Edit User" : "Add New User"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Enter full name"
              />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => handleChange("email", e.target.value)}
                placeholder="Enter email"
                disabled={isEditing}
              />
            </div>

            <div>
              <Label>Role</Label>
              <Select onValueChange={(value) => handleChange("role", value)} value={form.role}>
                <SelectTrigger><SelectValue placeholder="Select Role" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="faculty">Faculty</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.role === "student" && (
              <>
                <div>
                  <Label htmlFor="roll_no">Roll No.</Label>
                  <Input
                    id="roll_no"
                    value={form.roll_no}
                    onChange={(e) => handleChange("roll_no", e.target.value)}
                    placeholder="Enter roll number"
                  />
                </div>
                <div>
                  <Label htmlFor="semester">Semester</Label>
                  <Input
                    id="semester"
                    value={form.semester}
                    onChange={(e) => handleChange("semester", e.target.value)}
                    placeholder="Enter semester"
                  />
                </div>
              </>
            )}
          </div>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={() => handleSave(form)} disabled={busy}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
