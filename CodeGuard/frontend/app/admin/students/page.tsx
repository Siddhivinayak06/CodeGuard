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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export default function AdminSubjects() {
  const router = useRouter();
  const mountedRef = useRef(true);
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [faculty, setFaculty] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({ id: null, name: "", faculty_id: "" });

  // ✅ Auth
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

  // ✅ Fetch data
  useEffect(() => {
    if (!user) return;
    const fetchAll = async () => {
      setLoading(true);
      try {
        const [subjRes, facRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/subjects`).then((r) => r.json()),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/faculty`).then((r) => r.json()),
        ]);
        setSubjects(subjRes || []);
        setFaculty(facRes || []);
      } catch (err) {
        console.error("Fetch failed:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [user]);

  // ✅ Handle form input
  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  // ✅ Handle Add/Edit
  const handleSave = async () => {
    try {
      const endpoint = isEditing
        ? `${process.env.NEXT_PUBLIC_API_URL}/api/admin/subjects/${form.id}`
        : `${process.env.NEXT_PUBLIC_API_URL}/api/admin/subjects`;

      const method = isEditing ? "PUT" : "POST";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("Save failed");
      setOpen(false);
      setForm({ id: null, name: "", faculty_id: "" });
      setIsEditing(false);
      // refresh data
      const newData = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/subjects`).then((r) =>
        r.json()
      );
      setSubjects(newData);
    } catch (err) {
      console.error(err);
    }
  };

  // ✅ Handle Delete
  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this subject?")) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/subjects/${id}`, { method: "DELETE" });
      setSubjects((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  // ✅ UI
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
            📚 Manage Subjects
          </h1>
          <Button
            onClick={() => {
              setForm({ id: null, name: "", faculty_id: "" });
              setIsEditing(false);
              setOpen(true);
            }}
          >
            ➕ Add Subject
          </Button>
        </div>

        {loading ? (
          <p className="text-gray-500 dark:text-gray-400">Loading subjects...</p>
        ) : subjects.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No subjects found.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl shadow-md">
            <table className="w-full bg-white/40 dark:bg-gray-800/40 border border-gray-200/50 dark:border-gray-700/50">
              <thead className="bg-gray-100/70 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left">Subject</th>
                  <th className="px-4 py-3 text-left">Faculty</th>
                  <th className="px-4 py-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((s) => (
                  <tr
                    key={s.id}
                    className="border-t border-gray-200/40 dark:border-gray-700/40 hover:bg-gray-50/60 dark:hover:bg-gray-800/60 transition"
                  >
                    <td className="px-4 py-3">{s.name}</td>
                    <td className="px-4 py-3">{s.faculty_name || "—"}</td>
                    <td className="px-4 py-3 space-x-3">
                      <button
                        className="text-blue-500 hover:underline"
                        onClick={() => {
                          setForm({
                            id: s.id,
                            name: s.name,
                            faculty_id: s.faculty_id || "",
                          });
                          setIsEditing(true);
                          setOpen(true);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="text-red-500 hover:underline"
                        onClick={() => handleDelete(s.id)}
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
            <DialogTitle>{isEditing ? "Edit Subject" : "Add New Subject"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <Label htmlFor="name">Subject Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Enter subject name"
              />
            </div>

            <div>
              <Label>Assign Faculty</Label>
              <Select
                onValueChange={(value) => handleChange("faculty_id", value)}
                value={form.faculty_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Faculty" />
                </SelectTrigger>
                <SelectContent>
                  {faculty.map((f) => (
                    <SelectItem key={f.id} value={f.id.toString()}>
                      {f.name || f.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>{isEditing ? "Save Changes" : "Add Subject"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
