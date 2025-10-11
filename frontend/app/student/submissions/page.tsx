"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { generatePdfClient } from "@/lib/ClientPdf";
import type { User } from "@supabase/supabase-js";

export default function StudentSubmissions() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const mountedRef = useRef<boolean>(false);

  const [user, setUser] = useState<User | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewingSubmission, setViewingSubmission] = useState<{ code: string; output: string } | null>(null);
  const [pdfLoading, setPdfLoading] = useState<boolean>(false);

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

  // ✅ Fetch submissions
  useEffect(() => {
    if (!user?.id) return;

    const controller = new AbortController();
    const signal = controller.signal;

    const fetchSubmissions = async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/student/submissions/${encodeURIComponent(
            user.id
          )}`,
          { signal }
        );

        if (!res.ok) throw new Error("Failed to fetch submissions");

        const payload = await res.json();
        const items: any[] = Array.isArray(payload)
          ? payload
          : payload?.data ?? [];

        if (!signal.aborted && mountedRef.current) setSubmissions(items);
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

  // ✅ Download PDF
  const handleDownloadPdf = async (submission: any) => {
    if (!submission) return;
    try {
      setPdfLoading(true);
      await generatePdfClient({
        code: submission.code,
        output: submission.output || "",
        user: user?.email || "Anonymous",
        filename: submission.practical_title
          ? `${submission.practical_title.replace(/\s+/g, "_")}.pdf`
          : "submission.pdf",
      });
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setPdfLoading(false);
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
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Marks</th>
                  <th className="px-4 py-3 text-left">Submitted At</th>
                  <th className="px-4 py-3 text-left">Actions</th>
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
                    <td className="px-4 py-3">{s.status}</td>
                    <td className="px-4 py-3">{s.marks_obtained ?? "—"}</td>
                    <td className="px-4 py-3">
                      {s.created_at ? new Date(s.created_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setViewingSubmission({ code: s.code, output: s.output || "" })
                        }
                      >
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleDownloadPdf(s)}
                        disabled={pdfLoading}
                      >
                        {pdfLoading ? "Downloading..." : "Download PDF"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal for viewing code and output */}
      {viewingSubmission && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-11/12 max-w-3xl h-3/4 overflow-auto relative">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
              Submitted Code & Output
            </h2>
            <div className="mb-4">
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Code:</h3>
              <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-auto whitespace-pre-wrap">
                {viewingSubmission.code}
              </pre>
            </div>
            <div>
              <h3 className="font-semibold text-gray-700 dark:text-gray-300 mb-2">Output:</h3>
              <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-auto whitespace-pre-wrap">
                {viewingSubmission.output || "No output"}
              </pre>
            </div>
            <Button
              className="absolute top-4 right-4"
              variant="destructive"
              onClick={() => setViewingSubmission(null)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
