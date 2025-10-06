"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar"; // ✅ Shared role-based navbar
import type { User } from "@supabase/supabase-js";

export default function AdminDashboard() {
  const router = useRouter();
  const mountedRef = useRef(true);
  const supabase = useMemo(() => createClient(), []);

  // ✅ Typed state
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ Auth check and user fetch
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

  // ✅ Fetch dashboard data
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const [statsRes, subjRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/stats`).then(
            (res) => res.json()
          ),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/subjects`).then(
            (res) => res.json()
          ),
        ]);

        setStats(statsRes || {});
        setSubjects(subjRes || []);
      } catch (err) {
        console.error("Admin fetch failed:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  // ✅ Loading state
  if (!user)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400 text-lg">Loading...</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-950 dark:to-black">
      {/* ✅ Shared Navbar */}
      <Navbar />

      {/* Main Content */}
      <div className="pt-24 px-6 md:px-12">
        <h1 className="text-3xl font-extrabold mb-8 text-gray-800 dark:text-gray-100">
          🧑‍💼 Admin Dashboard
        </h1>

        {loading ? (
          <p className="text-gray-500 dark:text-gray-400">Loading data...</p>
        ) : (
          <>
            {/* Stats Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {["students", "faculty", "subjects", "practicals"].map((key) => (
                <div
                  key={key}
                  className="p-6 rounded-2xl bg-white/40 dark:bg-gray-800/40 backdrop-blur-md shadow-md hover:shadow-xl transition"
                >
                  <p className="text-gray-600 dark:text-gray-400 capitalize">
                    {key}
                  </p>
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200">
                    {stats[key] || 0}
                  </h2>
                </div>
              ))}
            </div>

            {/* Subjects Section */}
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
              📚 Subjects
            </h2>
            {subjects.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">
                No subjects found.
              </p>
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
                          <button className="text-blue-500 hover:underline">
                            Edit
                          </button>
                          <button className="text-red-500 hover:underline">
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
