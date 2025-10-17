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
  const [viewingSubmission, setViewingSubmission] = useState<any | null>(null);
  const [pdfLoading, setPdfLoading] = useState<boolean>(false);
  const [testCases, setTestCases] = useState<any[]>([]);

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

  // Fetch test case results for a submission
  const fetchTestCaseResults = async (submissionId: string) => {
    const { data, error } = await supabase
      .from("test_case_results")
      .select("*")
      .eq("submission_id", submissionId)
      .order("test_case_id", { ascending: true });
    if (error) console.error("Failed to fetch test case results:", error);
    return data ?? [];
  };

  // Fetch test cases for the practical
  const fetchTestCases = async (practicalId: string) => {
    const { data, error } = await supabase
      .from("test_cases")
      .select("*")
      .eq("practical_id", practicalId)
      .order("id", { ascending: true });
    if (error) console.error("Failed to fetch test cases:", error);
    return data ?? [];
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchSubmissions();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // ✅ Fixed: faculty PDF download
  const handleDownloadPdf = async (submission: any) => {
    if (!submission) return;

    try {
      setPdfLoading(true);

      // Fetch all test cases for this practical
      const { data: tcData, error: tcError } = await supabase
        .from("test_cases")
        .select("*")
        .eq("practical_id", submission.practical_id)
        .order("id", { ascending: true });
      if (tcError) console.error("Failed to fetch test cases:", tcError);
      const currentTestCases = tcData || [];

      // ✅ Fetch test case results for this submission (faculty)
      const { data: resultsData, error: resultsError } = await supabase
        .from("test_case_results")
        .select("*")
        .eq("submission_id", submission.submission_id)
        .order("test_case_id", { ascending: true });
      if (resultsError) console.error("Failed to fetch test case results:", resultsError);
      const results = resultsData || [];

      // Format test case results for PDF
      let testCaseText = "";
      results.forEach((r: any, idx: number) => {
        const tc = currentTestCases.find((t: any) => t.id === r.test_case_id);
        testCaseText += `Test #${idx + 1} ${tc?.is_hidden ? "(hidden)" : ""}\n`;
        testCaseText += `Status: ${r.status.toUpperCase()}\n`;
        testCaseText += `Input: ${tc?.input || ""}\n`;
        testCaseText += `Expected: ${tc?.expected_output || ""}\n`;
        testCaseText += `Output: ${r.stdout || ""}\n`;
        if (r.stderr) testCaseText += `Error: ${r.stderr}\n`;
        testCaseText += `Time: ${r.execution_time_ms ?? "-"} ms | Memory: ${r.memory_used_kb ?? "-"} KB\n\n`;
      });

      const pdfContent = `Program Output:\n${submission.output || "No output"}\n\nTest Case Results:\n${testCaseText}`;

      await generatePdfClient({
        code: submission.code || "No code submitted",
        output: pdfContent,
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

  // View submission and fetch test case results + test cases
  const handleViewSubmission = async (s: any) => {
    const results = await fetchTestCaseResults(s.submission_id);
    const cases = await fetchTestCases(s.practical_id);
    setViewingSubmission({ ...s, testCaseResults: results });
    setTestCases(cases);
  };

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
                      <Button size="sm" variant="outline" onClick={() => handleViewSubmission(s)}>
                        View Code
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handleDownloadPdf(s)} disabled={pdfLoading}>
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

      {viewingSubmission && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-xl p-6 w-11/12 max-w-4xl h-5/6 overflow-auto relative">
            <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100">
              {viewingSubmission.student_name}'s Submission
            </h2>

            <div className="mb-4">
              <h3 className="font-bold mb-1 text-gray-700 dark:text-gray-200">Code:</h3>
              <pre className="bg-gray-100 dark:bg-gray-800 p-4 rounded-md overflow-auto whitespace-pre-wrap">
                {viewingSubmission.code || "No code submitted"}
              </pre>
            </div>

            <div>
              <h3 className="font-bold mb-1 text-gray-700 dark:text-gray-200">Test Case Results:</h3>
              <div className="space-y-2 max-h-96 overflow-auto">
                {viewingSubmission.testCaseResults?.length ? (
                  viewingSubmission.testCaseResults.map((r: any, idx: number) => {
                    const tc = testCases.find((t) => t.id === r.test_case_id);
                    return (
                      <div key={idx} className="border border-gray-200 dark:border-gray-700 rounded p-2">
                        <div className="flex justify-between items-center mb-1">
                          <div className="text-sm">Test #{idx + 1} {tc?.is_hidden ? "(hidden)" : ""}</div>
                          <div className={`font-semibold text-sm ${getStatusColor(r.status)}`}>
                            {r.status.toUpperCase()}
                          </div>
                        </div>
                        <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
                          <div><strong>Input:</strong> <pre className="whitespace-pre-wrap">{tc?.input || ""}</pre></div>
                          <div><strong>Expected:</strong> <pre className="whitespace-pre-wrap">{tc?.expected_output || ""}</pre></div>
                          <div><strong>Output:</strong> <pre className="whitespace-pre-wrap">{r.stdout || ""}</pre></div>
                          {r.stderr && <div className="text-red-500"><strong>Error:</strong> {r.stderr}</div>}
                          <div>Time: {r.execution_time_ms ?? "-"} ms • Memory: {r.memory_used_kb ?? "-"} KB</div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-gray-500 dark:text-gray-400">No test case results available</div>
                )}
              </div>
            </div>

            <Button className="absolute top-4 right-4" variant="destructive" onClick={() => setViewingSubmission(null)}>
              Close
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
