"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";
import type { User } from "@supabase/supabase-js";

export default function StudentSubmissions() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const mountedRef = useRef<boolean>(false);

  const [user, setUser] = useState<User | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

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

  // ✅ Helper to get access token
  const getAccessToken = async (): Promise<string | null> => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      return session?.access_token ?? null;
    } catch (err) {
      console.error("Failed to get session token:", err);
      return null;
    }
  };

  // ✅ Fetch submissions (cancellable)
  useEffect(() => {
    if (!user?.id) return;

    const controller = new AbortController();
    const signal = controller.signal;

    const fetchSubmissions = async () => {
      setLoading(true);
      try {
        const token = await getAccessToken();
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/student/submissions/${encodeURIComponent(user.id)}`,
          { headers, signal }
        );

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`Failed to fetch submissions: ${res.status} ${text}`);
        }

        const payload = await res.json().catch(() => null);

        const items: any[] = Array.isArray(payload)
          ? payload
          : payload?.data ?? [];

        if (!signal.aborted && mountedRef.current) {
          setSubmissions(items);
        }
      } catch (err: any) {
        if (err.name === "AbortError") console.debug("Fetch aborted");
        else console.error("Failed to load submissions:", err);
      } finally {
        if (!signal.aborted && mountedRef.current) setLoading(false);
      }
    };

    fetchSubmissions();

    return () => {
      controller.abort();
    };
  }, [user?.id, supabase]);

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
          📝 My Submissions
        </h1>

        {loading ? (
          <p className="text-gray-500 dark:text-gray-400">Loading submissions...</p>
        ) : submissions.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No submissions found.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl shadow-md">
            <table className="w-full bg-white/40 dark:bg-gray-800/40 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl overflow-hidden">
              <thead className="bg-gray-100/70 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left">Practical</th>
                  <th className="px-4 py-3 text-left">Language</th>
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
                    <td className="px-4 py-3">{s.language}</td>
                    <td className="px-4 py-3">
                      {s.created_at ? new Date(s.created_at).toLocaleString() : "—"}
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
