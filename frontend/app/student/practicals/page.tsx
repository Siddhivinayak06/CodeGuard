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

  // Auth — set mountedRef explicitly
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

  // Helper: get access token from supabase client
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

  // Fetch practicals (cancellable)
  useEffect(() => {
    if (!user?.id) return;

    const controller = new AbortController();
    const signal = controller.signal;

    const fetchPracticals = async () => {
      setLoading(true);
      try {
        const token = await getAccessToken();
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        // Use your API endpoint — keep same URL but include token
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/student/practicals/${encodeURIComponent(user.id)}`,
          { method: "GET", headers, signal }
        );

        if (!res.ok) {
          // Try to read server message for better error logs
          const text = await res.text().catch(() => null);
          throw new Error(`Failed to fetch practicals: ${res.status} ${text ?? ""}`);
        }

        const payload = await res.json().catch(() => null);

        // Support both shapes: raw array OR { success: true, data: [...] }
        let items: any[] = [];
        if (Array.isArray(payload)) {
          items = payload;
        } else if (payload && Array.isArray(payload.data)) {
          items = payload.data;
        } else if (payload && payload.success && Array.isArray(payload.items)) {
          // some APIs use items
          items = payload.items;
        } else {
          // fallback: try payload?.data?.rows etc.
          items = payload?.data ?? [];
        }

        if (!signal.aborted && mountedRef.current) {
          setPracticals(items);
        }
      } catch (err: any) {
        if (err.name === "AbortError") {
          // fetch was aborted — not an error to show
          console.debug("Practicals fetch aborted");
        } else {
          console.error("Failed to load practicals:", err);
        }
      } finally {
        if (!signal.aborted && mountedRef.current) {
          setLoading(false);
        }
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
                          router.push(`/editor?practicalId=${encodeURIComponent(p.id)}&subject=${encodeURIComponent(p.subject_id)}`)
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
