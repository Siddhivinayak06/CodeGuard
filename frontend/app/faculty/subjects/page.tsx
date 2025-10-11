"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";

type Subject = {
  id: number;
  subject_name: string;
  subject_code: string;
  practical_count?: number;
};

type Practical = {
  id: number;
  title: string;
  deadline: string | null;
  submission_count?: number;
};

export default function FacultySubjects() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const mountedRef = useRef(true);

  const [user, setUser] = useState<User | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [practicals, setPracticals] = useState<Practical[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ Auth
 useEffect(() => {
  const fetchUser = async () => {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (!data.user) {
        router.push("/auth/login");
        return;
      }
      setUser(data.user);
    } catch (err) {
      console.error("Failed to fetch user:", err);
      router.push("/auth/login");
    } finally {
      setLoading(false);
    }
  };
  fetchUser();
}, [router, supabase]);


  // ✅ Fetch subjects for logged-in faculty
  useEffect(() => {
    if (!user) return;
    const fetchSubjects = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("subjects")
          .select(`id, subject_name, subject_code, practicals(id)`)
          .eq("faculty_id", user.id);

        if (error) throw error;

        const formatted = (data || []).map((s: any) => ({
          id: s.id,
          subject_name: s.subject_name,
          subject_code: s.subject_code,
          practical_count: s.practicals?.length || 0,
        }));

        setSubjects(formatted);
      } catch (err) {
        console.error("Failed to load subjects:", err);
        setSubjects([]);
      } finally {
        setLoading(false);
      }
    };
    fetchSubjects();
  }, [user, supabase]);

  // ✅ Load practicals for selected subject
  const loadPracticals = async (subjectId: number) => {
    setSelected(subjectId);
    try {
      const { data, error } = await supabase
        .from("practicals")
        .select(`id, title, deadline, submissions(id)`)
        .eq("subject_id", subjectId)
        .order("deadline", { ascending: true });

      if (error) throw error;

      const formatted = (data || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        deadline: p.deadline,
        submission_count: p.submissions?.length || 0,
      }));

      setPracticals(formatted);
    } catch (err) {
      console.error("Failed to load practicals:", err);
      setPracticals([]);
    }
  };

  if (!user)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <p className="text-gray-500 dark:text-gray-400">Loading...</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-950 dark:to-black">
      <Navbar />
      <div className="pt-24 px-6 md:px-12">
        <h1 className="text-3xl font-extrabold mb-8 text-gray-800 dark:text-gray-100">
          👩‍🏫 Faculty Subjects
        </h1>

        {loading ? (
          <p className="text-gray-500 dark:text-gray-400">Loading subjects...</p>
        ) : subjects.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No subjects assigned.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {subjects.map((s) => (
              <div
                key={s.id}
                onClick={() => loadPracticals(s.id)}
                className={`p-6 rounded-2xl cursor-pointer shadow-md transition ${
                  selected === s.id
                    ? "bg-blue-100/60 dark:bg-blue-900/30 border border-blue-400/50"
                    : "bg-white/40 dark:bg-gray-800/40"
                } hover:-translate-y-1`}
              >
                <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200">
                  {s.subject_name}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {s.practical_count || 0} Practicals
                </p>
              </div>
            ))}
          </div>
        )}

        {selected && (
          <div className="mt-12">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
              🧩 Practicals for {subjects.find((s) => s.id === selected)?.subject_name}
            </h2>
            {practicals.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">No practicals found.</p>
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
                          {p.deadline ? new Date(p.deadline).toLocaleDateString() : "—"}
                        </td>
                        <td className="px-4 py-3">{p.submission_count || 0}</td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            onClick={() => router.push(`/dashboard/faculty/submissions?practical=${p.id}`)}
                          >
                            View Submissions
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
