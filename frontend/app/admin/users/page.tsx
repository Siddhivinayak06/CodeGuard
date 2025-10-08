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
  const mountedRef = useRef<boolean>(false);
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);

  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    id: "",
    name: "",
    email: "",
    role: "student",
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

        if (!u) {
          router.push("/auth/login");
          return;
        }
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
  // Helper: get access token
  // ---------------------------
  const getAccessToken = async (): Promise<string | null> => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token ?? null;
    } catch (err) {
      console.error("Error getting session token:", err);
      return null;
    }
  };

  // ---------------------------
  // Safe fetch JSON
  // ---------------------------
  const safeFetchJson = async (url: string, opts?: RequestInit): Promise<ApiUsersResponse> => {
    const res = await fetch(url, opts);
    const text = await res.text();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} - ${text || "<no body>"}`);
    if (!text) return [];
    try {
      return JSON.parse(text);
    } catch {
      return text as any;
    }
  };

  // ---------------------------
  // Load users
  // ---------------------------
  const loadUsers = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const payload = await safeFetchJson(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/users`, { headers });
      const arr = (payload && (payload as any).data) ?? payload ?? [];

      if (!Array.isArray(arr)) {
        console.warn("Expected array, got:", arr);
        setUsers([]);
      } else {
        setUsers(arr);
      }
    } catch (err: any) {
      console.error("Fetch users failed:", err);
      setUsers([]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [user]);

  // ---------------------------
  // Form handling
  // ---------------------------
  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  async function handleSave(form: any) {
  if (!form.id) {
    console.error("User ID is missing!");
    return;
  }

  try {
    const res = await fetch(`/api/admin/users/${form.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email,
        role: form.role,
        name: form.name,
      }),
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Save failed");

    console.log("User updated:", data.user);

    // Update the local users state
    setUsers((prev) =>
      prev.map((u) => (u.id === form.id ? { ...u, ...form } : u))
    );

    setOpen(false);
  } catch (err) {
    console.error("Save user failed:", err);
  }
}




  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    setBusy(true);
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/users/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers,
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`Delete failed: ${res.status} ${res.statusText} - ${text || "<no body>"}`);

      if (mountedRef.current) setUsers((prev) => prev.filter((u) => String(u.id) !== String(id)));
    } catch (err: any) {
      console.error("Delete failed:", err);
      alert("Delete failed: " + (err?.message ?? "Unknown error"));
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  if (!user)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400 text-lg">Loading...</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-950 dark:to-black">
      <Navbar />
      <div className="pt-24 px-6 md:px-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100">
            👥 Manage Users
          </h1>
          <Button
            onClick={() => {
              setForm({ id: "", name: "", email: "", role: "student" });
              setIsEditing(false);
              setOpen(true);
            }}
          >
            ➕ Add User
          </Button>
        </div>

        {loading ? (
          <p className="text-gray-500 dark:text-gray-400">Loading users...</p>
        ) : users.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No users found.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl shadow-md">
            <table className="w-full bg-white/40 dark:bg-gray-800/40 border border-gray-200/50 dark:border-gray-700/50">
              <thead className="bg-gray-100/70 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Role</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id ?? u.uid ?? Math.random().toString()}
                    className="border-t border-gray-200/40 dark:border-gray-700/40 hover:bg-gray-50/60 dark:hover:bg-gray-800/60 transition"
                  >
                    <td className="px-4 py-3">{u.name || "—"}</td>
                    <td className="px-4 py-3">{u.email}</td>
                    <td className="px-4 py-3 capitalize">{u.role}</td>
                    <td className="px-4 py-3 space-x-3">
                      <button
                        className="text-blue-500 hover:underline"
                        onClick={() => {
                          setForm({
                            id: String(u.id ?? u.uid ?? ""),
                            name: u.name ?? "",
                            email: u.email ?? "",
                            role: u.role ?? "student",
                          });
                          setIsEditing(true);
                          setOpen(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="text-red-500 hover:underline"
                        onClick={() => handleDelete(String(u.id ?? u.uid ?? ""))}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
              <Input id="name" value={form.name} onChange={(e) => handleChange("name", e.target.value)} placeholder="Enter full name" />
            </div>

            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} placeholder="Enter email" disabled={isEditing} />
            </div>

            <div>
              <Label>Role</Label>
              <Select onValueChange={(value) => handleChange("role", value)} value={form.role}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Student</SelectItem>
                  <SelectItem value="faculty">Faculty</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={() => handleSave(form)}>Save</Button>

          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
