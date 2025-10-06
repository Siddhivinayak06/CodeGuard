"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";
import type { User } from "@supabase/supabase-js";

export default function FacultyDashboard() {
  const router = useRouter();
  const mountedRef = useRef(true);
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [practicals, setPracticals] = useState<any[]>([]);
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

  // ✅ Fetch subjects for logged-in faculty
  useEffect(() => {
    if (!user?.id) return;

    const fetchSubjects = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/faculty/subjects/${user.id}`
        );
        const data = await res.json();
        setSubjects(data || []);
      } catch (err) {
        console.error("Failed to load subjects:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSubjects();
  }, [user?.id]);

  // ✅ Load practicals when a subject is selected
  const loadPracticals = async (subjectId: number) => {
    setSelected(subjectId);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/faculty/practicals/${subjectId}`
      );
      const data = await res.json();
      setPracticals(data || []);
    } catch (err) {
      console.error("Failed to load practicals:", err);
    }
  };

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
          👩‍🏫 Faculty Dashboard
        </h1>

        {loading ? (
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        ) : subjects.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">
            No subjects assigned.
          </p>
        ) : (
          <>
            {/* Subjects List */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {subjects.map((s) => (
                <div
                  key={s.id}
                  className={`p-6 rounded-2xl cursor-pointer shadow-md transition ${
                    selected === s.id
                      ? "bg-blue-100/50 dark:bg-blue-900/30 border border-blue-400/30"
                      : "bg-white/50 dark:bg-gray-800/40 hover:bg-gray-100/60 dark:hover:bg-gray-700/60"
                  }`}
                  onClick={() => loadPracticals(s.id)}
                >
                  <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200">
                    {s.name}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {s.practical_count || 0} Practicals
                  </p>
                </div>
              ))}
            </div>

            {/* Practicals List */}
            {selected && (
              <div className="mt-12">
                <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
                  🧩 Practicals
                </h2>
                {practicals.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400">
                    No practicals found for this subject.
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-2xl shadow-md">
                    <table className="w-full bg-white/40 dark:bg-gray-800/40 border border-gray-200/50 dark:border-gray-700/50">
                      <thead className="bg-gray-100/70 dark:bg-gray-700/50">
                        <tr>
                          <th className="px-4 py-3 text-left">Title</th>
                          <th className="px-4 py-3 text-left">Deadline</th>
                          <th className="px-4 py-3 text-left">Submissions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {practicals.map((p) => (
                          <tr
                            key={p.id}
                            className="border-t border-gray-200/40 dark:border-gray-700/40 hover:bg-gray-50/60 dark:hover:bg-gray-800/60 transition"
                          >
                            <td className="px-4 py-3">{p.title}</td>
                            <td className="px-4 py-3">
                              {p.deadline
                                ? new Date(p.deadline).toLocaleDateString()
                                : "—"}
                            </td>
                            <td className="px-4 py-3">{p.submission_count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
