"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";
import type { User } from "@supabase/supabase-js";

// Define types
type Subject = {
  id: string;
  name: string;
  practical_count?: number;
};

type Practical = {
  id: string;
  title: string;
  deadline?: string;
  submission_count?: number;
};

export default function FacultyDashboard() {
  const router = useRouter();
  const mountedRef = useRef(true);
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [practicals, setPracticals] = useState<Practical[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ Auth check
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

  // ✅ Fetch subjects safely
  useEffect(() => {
    if (!user?.id) return;

    const fetchSubjects = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/faculty/subjects/${user.id}`
        );
        const data = await res.json();

        // Ensure we always have an array
        setSubjects(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to load subjects:", err);
        setSubjects([]);
      } finally {
        setLoading(false);
      }
    };

    fetchSubjects();
  }, [user?.id]);

  // ✅ Load practicals safely
  const loadPracticals = async (subjectId: string) => {
    setSelected(subjectId);
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/faculty/practicals/${subjectId}`
      );
      const data = await res.json();

      // Ensure we always have an array
      setPracticals(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load practicals:", err);
      setPracticals([]);
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
      <Navbar />

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
                    {s.practical_count ?? 0} Practicals
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
                          <th className="px-4 py-3 text-left">Actions</th>
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
                            <td className="px-4 py-3">{p.submission_count ?? 0}</td>
                            <td className="px-4 py-3">
                              <button
                                onClick={() =>
                                  router.push(
                                    `/faculty/submissions?practical=${p.id}`
                                  )
                                }
                                className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition"
                              >
                                View Submissions
                              </button>
                            </td>
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
