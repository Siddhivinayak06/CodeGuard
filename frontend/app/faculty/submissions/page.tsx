"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { generatePdfClient } from "@/lib/ClientPdf";

export default function FacultySubmissionsPage() {
  const supabase = useMemo(() => createClient(), []);
  const mountedRef = useRef(true);

  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewingCode, setViewingCode] = useState<any | null>(null);
  const [pdfLoading, setPdfLoading] = useState<boolean>(false);

  // Fetch submissions from the view
  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("faculty_submissions_view")
        .select("*");

      if (error) throw error;
      if (mountedRef.current) setSubmissions(data ?? []);
    } catch (err) {
      console.error("Failed to fetch submissions:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchSubmissions();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // PDF download
  const handleDownloadPdf = async (submission: any) => {
    if (!submission) return;
    try {
      setPdfLoading(true);
      await generatePdfClient({
        code: submission.code,
        output: submission.output || "",
        user: submission.student_name || "Anonymous",
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <main className="max-w-6xl mx-auto p-6 pt-28">
        <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">
          Student Submissions
        </h1>

        {loading ? (
          <p className="text-gray-500 dark:text-gray-400">Loading submissions...</p>
        ) : submissions.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No submissions yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl shadow-md">
            <table className="w-full text-left border-collapse bg-white/40 dark:bg-gray-800/40 rounded-2xl overflow-hidden">
              <thead className="bg-gray-100/70 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Practical</th>
                  <th className="px-4 py-3">Language</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Marks</th>
                  <th className="px-4 py-3">Submitted At</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {submissions.map((s) => (
                  <tr
                    key={s.submission_id}
                    className="border-t border-gray-200/40 dark:border-gray-700/40 hover:bg-gray-50/60 dark:hover:bg-gray-800/60 transition"
                  >
                    <td className="px-4 py-3">{s.student_name}</td>
                    <td className="px-4 py-3">{s.practical_title}</td>
                    <td className="px-4 py-3">{s.language || "—"}</td>
                    <td className="px-4 py-3">{s.status}</td>
                    <td className="px-4 py-3">{s.marks_obtained ?? "—"}</td>
                    <td className="px-4 py-3">
                      {s.created_at ? new Date(s.created_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setViewingCode(s)}
                      >
                        View Code
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
      </main>

      {/* Modal to view code + output */}
      {viewingCode && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-11/12 max-w-4xl h-3/4 overflow-auto relative">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
              {viewingCode.student_name}'s Submission
            </h2>

            <div className="mb-4">
              <h3 className="font-bold mb-1 text-gray-700 dark:text-gray-200">Code:</h3>
              <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-auto whitespace-pre-wrap">
                {viewingCode.code || "No code submitted"}
              </pre>
            </div>

            <div>
              <h3 className="font-bold mb-1 text-gray-700 dark:text-gray-200">Output:</h3>
              <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-auto whitespace-pre-wrap">
                {viewingCode.output || "No output"}
              </pre>
            </div>

            <Button
              className="absolute top-4 right-4"
              variant="destructive"
              onClick={() => setViewingCode(null)}
            >
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
