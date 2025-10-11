"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";
import type { User } from "@supabase/supabase-js";

export default function StudentDashboard() {
  const router = useRouter();
  const mountedRef = useRef(true);
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [progress, setProgress] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
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

  // ✅ Fetch progress & submissions
  useEffect(() => {
    if (!user?.id) return;

    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // 1️⃣ Fetch all subjects for the student
        const { data: subjects } = await supabase
          .from("subjects")
          .select(`
            id,
            subject_name,
            practicals (
              id,
              title
            )
          `);

        // 2️⃣ Calculate progress per subject
        const progressData = await Promise.all(
          (subjects ?? []).map(async (subject: any) => {
            const total_count = subject.practicals?.length || 0;
            const { count: completed_count } = await supabase
              .from("submissions")
              .select("*", { count: "exact", head: true })
              .eq("student_id", user.id)
              .in(
                "practical_id",
                subject.practicals?.map((p: any) => p.id) || []
              );

            return {
              subject_id: subject.id,
              subject_name: subject.subject_name,
              total_count,
              completed_count: completed_count || 0,
            };
          })
        );
        setProgress(progressData);

        // 3️⃣ Fetch recent submissions with practical titles
        const { data: submissionsData } = await supabase
          .from("submissions")
          .select(`
            id,
            practicals (title),
            language,
            status,
            marks_obtained,
            created_at
          `)
          .eq("student_id", user.id)
          .order("created_at", { ascending: false });

        const formattedSubmissions = (submissionsData ?? []).map((s: any) => ({
          id: s.id,
          practical_title: s.practicals?.title || "Unknown",
          language: s.language,
          status: s.status,
          marks_obtained: s.marks_obtained,
          created_at: s.created_at,
        }));

        setSubmissions(formattedSubmissions);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [supabase, user?.id]);

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
          📊 Student Dashboard
        </h1>

        {loading ? (
          <p className="text-gray-600 dark:text-gray-400">Loading data...</p>
        ) : (
          <>
            {/* Progress Section */}
            <section>
              <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
                📚 Progress
              </h2>
              {progress.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">No subjects found.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {progress.map((p) => {
                    const percentage =
                      ((p.completed_count || 0) / (p.total_count || 1)) * 100;
                    return (
                      <div
                        key={p.subject_id}
                        className="p-6 rounded-2xl bg-white/40 dark:bg-gray-800/40 backdrop-blur-md shadow-md hover:shadow-xl transition transform hover:-translate-y-1"
                      >
                        <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200">
                          {p.subject_name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          {p.completed_count}/{p.total_count} completed
                        </p>
                        <div className="w-full bg-gray-200/60 dark:bg-gray-700/60 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Submissions Section */}
            <section className="mt-12">
              <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
                📝 Recent Submissions
              </h2>
              {submissions.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">No submissions yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-2xl shadow-md">
                  <table className="w-full backdrop-blur-md bg-white/40 dark:bg-gray-800/40 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl overflow-hidden">
                    <thead className="bg-gray-100/70 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left">Practical</th>
                        <th className="px-4 py-3 text-left">Language</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Marks</th>
                        <th className="px-4 py-3 text-left">Submitted At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((s) => (
                        <tr
                          key={s.id}
                          className="border-t border-gray-200/40 dark:border-gray-700/40 hover:bg-gray-50/60 dark:hover:bg-gray-800/60 transition"
                        >
                          <td className="px-4 py-3">{s.practical_title}</td>
                          <td className="px-4 py-3">{s.language || "N/A"}</td>
                          <td className="px-4 py-3">{s.status}</td>
                          <td className="px-4 py-3">{s.marks_obtained ?? "—"}</td>
                          <td className="px-4 py-3">
                            {s.created_at
                              ? new Date(s.created_at).toLocaleString()
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
