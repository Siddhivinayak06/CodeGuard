"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";

export default function StudentPracticals() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const mountedRef = useRef<boolean>(false);

  const [user, setUser] = useState<User | null>(null);
  const [practicals, setPracticals] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // 1️⃣ Fetch the logged-in user
  useEffect(() => {
    mountedRef.current = true;

    const fetchUser = async () => {
      try {
        const {
          data: { user },
          error,
        } = await supabase.auth.getUser();

        if (error) {
          console.error("Supabase auth error:", error);
          router.push("/auth/login");
          return;
        }

        if (!user) {
          router.push("/auth/login");
          return;
        }

        if (mountedRef.current) setUser(user);
      } catch (err) {
        console.error("Unexpected auth error:", err);
        router.push("/auth/login");
      }
    };

    fetchUser();

    return () => {
      mountedRef.current = false;
    };
  }, [router, supabase]);

  // 2️⃣ Fetch practicals directly from Supabase
  useEffect(() => {
    if (!user?.id) return;

    const controller = new AbortController();
    const signal = controller.signal;

    const fetchPracticals = async () => {
      setLoading(true);

      try {
        const { data, error } = await supabase
          .from("practicals")
          .select(`
            id,
            title,
            description,
            language,
            deadline,
            subject_id,
            subjects ( subject_name )
          `)
          .order("deadline", { ascending: true });

        if (error) {
          console.error("Supabase fetch error:", error.message, error.details, error.hint);
          setPracticals([]);
          return;
        }

        if (!data) {
          setPracticals([]);
          return;
        }

        // Map to desired format
        const formatted = data.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          language: p.language,
          deadline: p.deadline,
          subject_id: p.subject_id,
          subject_name: (p.subjects as any)?.subject_name || "Unknown",
        }));

        if (!signal.aborted && mountedRef.current) {
          setPracticals(formatted);
        }
      } catch (err) {
        if ((err as any).name === "AbortError") {
          console.debug("Fetch aborted");
        } else {
          console.error("Unexpected fetch error:", err);
        }
      } finally {
        if (!signal.aborted && mountedRef.current) setLoading(false);
      }
    };

    fetchPracticals();

    return () => {
      controller.abort();
    };
  }, [user?.id, supabase]);

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
          🧩 Assigned Practicals
        </h1>

        {loading ? (
          <p className="text-gray-500 dark:text-gray-400">Loading practicals...</p>
        ) : practicals.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No practicals assigned yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl shadow-md">
            <table className="w-full bg-white/40 dark:bg-gray-800/40 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl overflow-hidden">
              <thead className="bg-gray-100/70 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left">Title</th>
                  <th className="px-4 py-3 text-left">Subject</th>
                  <th className="px-4 py-3 text-left">Deadline</th>
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
                    <td className="px-4 py-3">{p.subject_name}</td>
                    <td className="px-4 py-3">
                      {p.deadline ? new Date(p.deadline).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        onClick={() =>
                          router.push(
                            `/editor?practicalId=${encodeURIComponent(
                              p.id
                            )}&subject=${encodeURIComponent(p.subject_id)}`
                          )
                        }
                      >
                        Open in Editor
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
