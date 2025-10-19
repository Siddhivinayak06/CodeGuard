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
  const [viewingSubmission, setViewingSubmission] = useState<any>(null);
  const [testCases, setTestCases] = useState<any[]>([]);
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

  // ✅ Fetch submissions directly from Supabase
  useEffect(() => {
    if (!user?.id) return;

    const fetchSubmissions = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("submissions")
          .select(`
            id,
            code,
            output,
            language,
            status,
            created_at,
            practical_id,
            marks_obtained,
            practicals ( title ),
            test_case_results ( test_case_id, status, stdout, stderr, execution_time_ms, memory_used_kb )
          `)
          .eq("student_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const formatted = data.map((s) => ({
          id: s.id,
          practical_id: s.practical_id,
          practical_title: (s.practicals as any)?.title || "Unknown",
          code: s.code,
          output: s.output,
          language: s.language,
          status: s.status,
          created_at: s.created_at,
          marks_obtained: s.marks_obtained,
          testCaseResults: s.test_case_results || [],
        }));

        if (mountedRef.current) setSubmissions(formatted);
      } catch (err: any) {
        console.error("Supabase fetch error:", err);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };

    fetchSubmissions();
  }, [user?.id, supabase]);

  // ✅ Fetch test cases when viewing a submission
  useEffect(() => {
    if (!viewingSubmission) {
      setTestCases([]);
      return;
    }

    const fetchTestCases = async () => {
      const { data, error } = await supabase
        .from("test_cases")
        .select("*")
        .eq("practical_id", viewingSubmission.practical_id)
        .order("id", { ascending: true });

      if (error) console.error("Failed to fetch test cases:", error);
      else setTestCases(data || []);
    };

    fetchTestCases();
  }, [viewingSubmission, supabase]);

// ✅ Download PDF
const handleDownloadPdf = async (submission: any) => {
  if (!submission) return;

  try {
    setPdfLoading(true);
 
     // Compute results summary
    const totalTestCases = submission.total_test_cases ?? 8; // default to 8 if not stored
    const passedTestCases = submission.test_cases_passed ?? 0; // number of passed test cases

    const resultsSummary = `Results: ${passedTestCases} / ${totalTestCases} test cases passed`;

    // Only include submitted code and results summary
    const pdfContent = `  {${resultsSummary} }`;
    await generatePdfClient({
      code: submission.code || "No code submitted",
      output: pdfContent,
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



  // ✅ Helper for status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "passed": return "text-green-600";
      case "failed": return "text-red-600";
      case "compile_error": return "text-orange-600";
      case "runtime_error": return "text-red-600";
      case "timeout": return "text-yellow-600";
      default: return "text-gray-600";
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
                      onClick={() => setViewingSubmission(s)}
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

    {/* Modal for viewing only code */}
    {viewingSubmission && (
      <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
        <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-11/12 max-w-4xl h-5/6 overflow-auto relative">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
            Submitted Code
          </h2>
          <div className="mb-4">
            <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-auto whitespace-pre-wrap text-sm">
              {viewingSubmission.code}
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