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

type Subject = {
  id: string;
  subject_name: string;
  subject_code: string;
  semester?: string;
  faculty_id?: string;
  faculty_name?: string;
};

type Faculty = {
  uid: string;
  name?: string;
  email: string;
};

export default function AdminSubjects() {
  const router = useRouter();
  const mountedRef = useRef<boolean>(false);
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    id: "",
    subject_name: "",
    subject_code: "",
    semester: "",
    faculty_id: "",
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
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const [subjRes, facRes] = await Promise.all([
        fetch(`/api/admin/subjects`, { headers }).then((r) =>
          r.json().catch(() => [])
        ),
        fetch(`/api/admin/faculty`, { headers }).then((r) =>
          r.json().catch(() => [])
        ),
      ]);

      if (!mountedRef.current) return;

      setSubjects(subjRes?.data ?? subjRes ?? []);
      setFaculty(facRes?.data ?? facRes ?? []);
    } catch (err) {
      console.error("Fetch failed:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleChange = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!form.subject_name.trim() || !form.subject_code.trim()) {
      alert("Subject name and code are required");
      return;
    }

    try {
      const method = isEditing ? "PUT" : "POST";
      const endpoint = `/api/admin/subjects`;
      const body = {
        id: form.id || undefined,
        subject_name: form.subject_name,
        subject_code: form.subject_code,
        semester: form.semester || undefined,
        faculty_id: form.faculty_id || undefined,
      };

      const token = await getAccessToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(endpoint, { method, headers, body: JSON.stringify(body) });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.success === false) throw new Error(payload?.error || "Operation failed");

      if (!mountedRef.current) return;

      setOpen(false);
      setForm({ id: "", subject_name: "", subject_code: "", semester: "", faculty_id: "" });
      setIsEditing(false);
      fetchData();
    } catch (err: any) {
      console.error("Save failed:", err);
      alert("Save failed: " + (err?.message || "Unknown error"));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this subject?")) return;

    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/admin/subjects?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers,
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok || payload?.success === false) throw new Error(payload?.error || "Delete failed");

      if (!mountedRef.current) return;
      setSubjects((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      console.error("Delete failed:", err);
      alert("Delete failed: " + (err?.message || "Unknown error"));
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
          <h1 className="text-3xl font-extrabold text-gray-800 dark:text-gray-100">📚 Manage Subjects</h1>
          <Button
            onClick={() => {
              setForm({ id: "", subject_name: "", subject_code: "", semester: "", faculty_id: "" });
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
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Semester</th>
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
                    <td className="px-4 py-3">{s.subject_name}</td>
                    <td className="px-4 py-3">{s.subject_code}</td>
                    <td className="px-4 py-3">{s.semester || "—"}</td>
                    <td className="px-4 py-3">{s.faculty_name || "—"}</td>
                    <td className="px-4 py-3 space-x-3">
                      <button
                        className="text-blue-500 hover:underline"
                        onClick={() => {
                          setForm({
                            id: s.id,
                            subject_name: s.subject_name,
                            subject_code: s.subject_code,
                            semester: s.semester || "",
                            faculty_id: s.faculty_id || "",
                          });
                          setIsEditing(true);
                          setOpen(true);
                        }}
                      >
                        Edit
                      </button>
                      <button className="text-red-500 hover:underline" onClick={() => handleDelete(s.id)}>
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
                value={form.subject_name}
                onChange={(e) => handleChange("subject_name", e.target.value)}
                placeholder="Enter subject name"
              />
            </div>

            <div>
              <Label htmlFor="code">Subject Code</Label>
              <Input
                id="code"
                value={form.subject_code}
                onChange={(e) => handleChange("subject_code", e.target.value)}
                placeholder="Enter subject code"
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

            <div>
              <Label>Assign Faculty</Label>
              <Select onValueChange={(value) => handleChange("faculty_id", value)} value={form.faculty_id}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Faculty" />
                </SelectTrigger>
                <SelectContent>
                  {faculty.map((f) => (
                    <SelectItem key={f.uid} value={f.uid}>
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
