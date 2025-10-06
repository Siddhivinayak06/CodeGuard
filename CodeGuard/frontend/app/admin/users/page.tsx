"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";
import type { User } from "@supabase/supabase-js";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

export default function AdminUsers() {
  const router = useRouter();
  const mountedRef = useRef(true);
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    id: null,
    name: "",
    email: "",
    role: "student",
  });

  // ✅ Auth check
  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) router.push("/auth/login");
      else if (mountedRef.current) setUser(user);
    };
    fetchUser();
    return () => {
      mountedRef.current = false;
    };
  }, [router, supabase]);

  // ✅ Fetch all users
  useEffect(() => {
    if (!user) return;
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/admin/users`
        );
        const data = await res.json();
        setUsers(data || []);
      } catch (err) {
        console.error("Fetch users failed:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [user]);

  // ✅ Form handling
  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ✅ Save (Add or Edit)
  const handleSave = async () => {
    try {
      const endpoint = isEditing
        ? `${process.env.NEXT_PUBLIC_API_URL}/api/admin/users/${form.id}`
        : `${process.env.NEXT_PUBLIC_API_URL}/api/admin/users`;

      const method = isEditing ? "PUT" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Save failed");

      setOpen(false);
      setForm({ id: null, name: "", email: "", role: "student" });
      setIsEditing(false);

      // refresh
      const data = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/users`
      ).then((r) => r.json());
      setUsers(data);
    } catch (err) {
      console.error("Save user failed:", err);
    }
  };

  // ✅ Delete user
  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this user?")) return;
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/admin/users/${id}`,
        { method: "DELETE" }
      );
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  // ✅ UI Loading
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
              setForm({ id: null, name: "", email: "", role: "student" });
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
                    key={u.id}
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
                            id: u.id,
                            name: u.name,
                            email: u.email,
                            role: u.role,
                          });
                          setIsEditing(true);
                          setOpen(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="text-red-500 hover:underline"
                        onClick={() => handleDelete(u.id)}
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

      {/* ✅ Add/Edit Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Edit User" : "Add New User"}
            </DialogTitle>
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
              <Select
                onValueChange={(value) => handleChange("role", value)}
                value={form.role}
              >
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
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {isEditing ? "Save Changes" : "Add User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
