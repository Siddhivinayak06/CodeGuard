"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { generatePdfClient } from "@/lib/ClientPdf";
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  Download,
  Eye,
  X,
  Code2,
  FileText,
  Calendar,
  User,
  BookOpen,
  Award,
  Search as SearchIcon,
  Filter as FilterIcon
} from "lucide-react";

// TypeScript interfaces
interface Submission {
  id: number;
  submission_id: number;
  student_id: string;
  student_name: string;
  practical_id: number;
  practical_title: string;
  code: string;
  output: string;
  language: string;
  status: string;
  marks_obtained: number | null;
  created_at: string;
  updated_at: string;
}

interface TestCase {
  id: number;
  practical_id: number;
  input: string;
  expected_output: string;
  is_hidden: boolean;
}

interface TestCaseResult {
  id: number;
  submission_id: number;
  test_case_id: number;
  status: string;
  stdout: string;
  stderr: string;
  execution_time_ms: number;
  memory_used_kb: number;
}

interface ViewingSubmission extends Submission {
  testCaseResults: TestCaseResult[];
}

// small helper to render initials when no avatar
const initials = (name?: string) => (name || "?").split(" ").map(s => s[0]).slice(0,2).join("").toUpperCase();

export default function FacultySubmissionsPage() {
  const supabase = useMemo(() => createClient(), []);
  const mountedRef = useRef(true);

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewingSubmission, setViewingSubmission] = useState<ViewingSubmission | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<number | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [query, setQuery] = useState<string>("");

  // fetch helpers (unchanged logic but safer logs)
  const fetchTestCaseResults = async (submissionId: number | string): Promise<TestCaseResult[]> => {
    const { data, error } = await supabase
      .from("test_case_results")
      .select("*")
      .eq("submission_id", submissionId)
      .order("test_case_id", { ascending: true });
    if (error) console.error("Failed to fetch test case results:", error?.message ?? error);
    return data ?? [];
  };

  const fetchTestCases = async (practicalId: number | string): Promise<TestCase[]> => {
    const { data, error } = await supabase
      .from("test_cases")
      .select("*")
      .eq("practical_id", practicalId)
      .order("id", { ascending: true });
    if (error) console.error("Failed to fetch test cases:", error?.message ?? error);
    return data ?? [];
  };

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr) throw userErr;
      const user = userData?.user;
      if (!user) return setSubmissions([]);

      const { data: subjData, error: subjErr } = await supabase
        .from("subjects")
        .select("id")
        .eq("faculty_id", user.id);
      if (subjErr) throw subjErr;

      const subjectIds = (subjData ?? []).map((s: { id: number }) => s.id);
      if (subjectIds.length === 0) return setSubmissions([]);

      const { data: pracData, error: pracErr } = await supabase
        .from("practicals")
        .select("id, title, subject_id")
        .in("subject_id", subjectIds);
      if (pracErr) throw pracErr;

      const practicalsById = new Map<number, { id: number; title: string; subject_id: number }>();
      const practicalIds = (pracData ?? []).map((p: { id: number; title: string; subject_id: number }) => {
        practicalsById.set(p.id, p);
        return p.id;
      });

      if (practicalIds.length === 0) return setSubmissions([]);

      const { data: subData, error: subErr } = await supabase
        .from("submissions")
        .select("*")
        .in("practical_id", practicalIds)
        .order("created_at", { ascending: false });
      if (subErr) throw subErr;

      const studentIds = Array.from(new Set((subData ?? []).map((s: any) => s.student_id))).filter(Boolean);
      const studentsById = new Map<string, { uid: string; name: string }>();
      if (studentIds.length > 0) {
        const { data: usersData, error: usersErr } = await supabase
          .from("users")
          .select("uid, name")
          .in("uid", studentIds);
        if (usersErr) console.error("Failed to fetch student names:", usersErr);
        usersData?.forEach((u: { uid: string; name: string }) => studentsById.set(String(u.uid), u));
      }

      const enriched = (subData ?? []).map((s: any): Submission => {
        const stud = studentsById.get(String(s.student_id));
        const prac = practicalsById.get(s.practical_id);
        return {
          id: s.id,
          submission_id: s.id,
          student_id: s.student_id,
          student_name: stud?.name ?? s.student_id,
          practical_id: s.practical_id,
          practical_title: prac?.title ?? s.practical_id,
          code: s.code,
          output: s.output,
          language: s.language,
          status: s.status || "pending",
          marks_obtained: s.marks_obtained,
          created_at: s.created_at,
          updated_at: s.updated_at,
        };
      });

      if (mountedRef.current) setSubmissions(enriched);
    } catch (err: any) {
      console.error("Failed to fetch submissions:", err?.message ?? err);
      if (mountedRef.current) setSubmissions([]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    fetchSubmissions();
    return () => { mountedRef.current = false; };
  }, []);

  // PDF generation with per-submission loading state
  const handleDownloadPdf = async (submission: Submission) => {
    if (!submission) return;
    setPdfLoadingId(submission.submission_id);
    try {
      const { data: tcData, error: tcError } = await supabase
        .from("test_cases")
        .select("*")
        .eq("practical_id", submission.practical_id)
        .order("id", { ascending: true });
      if (tcError) console.error("Failed to fetch test cases:", tcError);

      const { data: resultsData, error: resultsError } = await supabase
        .from("test_case_results")
        .select("*")
        .eq("submission_id", submission.submission_id)
        .order("test_case_id", { ascending: true });
      if (resultsError) console.error("Failed to fetch test case results:", resultsError);

      const currentTestCases = tcData || [];
      const results = resultsData || [];

      let testCaseText = "";
      results.forEach((r: TestCaseResult, idx: number) => {
        const tc = currentTestCases.find((t: TestCase) => t.id === r.test_case_id);
        testCaseText += `Test #${idx + 1} ${tc?.is_hidden ? "(hidden)" : ""}\n`;
        testCaseText += `Status: ${String(r.status).toUpperCase()}\n`;
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
    } catch (err: any) {
      console.error("PDF generation failed:", err?.message ?? err);
    } finally {
      setPdfLoadingId(null);
    }
  };

  const handleViewSubmission = async (s: Submission) => {
    const results = await fetchTestCaseResults(s.submission_id);
    const cases = await fetchTestCases(s.practical_id);
    setViewingSubmission({ ...s, testCaseResults: results });
    setTestCases(cases);
  };

  const getStatusBadge = (status: string) => {
    const map: Record<string, { style: string; icon: React.ReactNode; label?: string }> = {
      passed: { style: "bg-green-50 text-green-800 dark:bg-green-900/20 dark:text-green-300", icon: <CheckCircle className="w-4 h-4" /> },
      failed: { style: "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300", icon: <XCircle className="w-4 h-4" /> },
      compile_error: { style: "bg-orange-50 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300", icon: <AlertCircle className="w-4 h-4" /> },
      runtime_error: { style: "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300", icon: <XCircle className="w-4 h-4" /> },
      timeout: { style: "bg-yellow-50 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300", icon: <Clock className="w-4 h-4" /> },
      pending: { style: "bg-gray-50 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300", icon: <Clock className="w-4 h-4" /> },
    };

    const entry = map[status] ?? map["pending"];
    return (
      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-semibold ${entry.style}`}>
        {entry.icon}
        <span className="capitalize">{(status || "pending").replace(/_/g, " ")}</span>
      </div>
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "passed": return "text-green-600 dark:text-green-400";
      case "failed": return "text-red-600 dark:text-red-400";
      case "compile_error": return "text-orange-600 dark:text-orange-400";
      case "runtime_error": return "text-red-600 dark:text-red-400";
      case "timeout": return "text-yellow-600 dark:text-yellow-400";
      default: return "text-gray-600 dark:text-gray-400";
    }
  };

  const filteredSubmissions = submissions
    .filter(s => filterStatus === "all" ? true : s.status === filterStatus)
    .filter(s => {
      if (!query) return true;
      const q = query.toLowerCase();
      return String(s.student_name || "").toLowerCase().includes(q) || String(s.practical_title || "").toLowerCase().includes(q);
    });

  const stats = {
    total: submissions.length,
    passed: submissions.filter(s => s.status === "passed").length,
    failed: submissions.filter(s => s.status === "failed").length,
    pending: submissions.filter(s => !["passed", "failed"].includes(s.status)).length,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-950 dark:via-purple-950/20 dark:to-blue-950/20">
      <Navbar />
      <main className="max-w-7xl mx-auto p-6 pt-28">
        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Student Submissions</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">Review and evaluate student code submissions</p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-72">
              <SearchIcon className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search student or practical..." className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900 text-sm" />
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setFilterStatus("all")} className={`px-3 py-1 rounded-lg text-sm ${filterStatus === "all" ? "bg-blue-600 text-white" : "bg-white/60 dark:bg-gray-800"}`}><FilterIcon className="w-4 h-4 mr-1 inline"/>All</button>
              <button onClick={() => setFilterStatus("passed")} className={`px-3 py-1 rounded-lg text-sm ${filterStatus === "passed" ? "bg-green-600 text-white" : "bg-white/60 dark:bg-gray-800"}`}>Passed</button>
              <button onClick={() => setFilterStatus("failed")} className={`px-3 py-1 rounded-lg text-sm ${filterStatus === "failed" ? "bg-red-600 text-white" : "bg-white/60 dark:bg-gray-800"}`}>Failed</button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <StatCard label="Total" value={stats.total} icon={<FileText className="w-6 h-6 text-blue-500"/>} />
          <StatCard label="Passed" value={stats.passed} icon={<CheckCircle className="w-6 h-6 text-green-500"/>} />
          <StatCard label="Failed" value={stats.failed} icon={<XCircle className="w-6 h-6 text-red-500"/>} />
          <StatCard label="Pending" value={stats.pending} icon={<Clock className="w-6 h-6 text-yellow-500"/>} />
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow border border-gray-200/50 dark:border-gray-700/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-gray-50 dark:bg-gray-800/40">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Student</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Practical</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Language</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Marks</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600">Submitted</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-32"/></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-40"/></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-20"/></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-24"/></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-10"/></td>
                      <td className="px-6 py-4"><div className="h-4 bg-gray-200 dark:bg-gray-800 rounded w-24"/></td>
                      <td className="px-6 py-4" />
                    </tr>
                  ))
                ) : filteredSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-gray-500">No submissions found</td>
                  </tr>
                ) : (
                  filteredSubmissions.map((s) => (
                    <tr key={s.submission_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                      <td className="px-6 py-4 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-700 text-white flex items-center justify-center font-semibold">
                          {initials(s.student_name)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 dark:text-gray-100">{s.student_name}</div>
                          <div className="text-xs text-gray-500">{s.student_id}</div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-800 dark:text-gray-200">{s.practical_title}</div>
                        <div className="text-xs text-gray-500">ID: {s.practical_id}</div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">{s.language || "—"}</span>
                      </td>

                      <td className="px-6 py-4">{getStatusBadge(s.status)}</td>

                      <td className="px-6 py-4"><div className="font-semibold">{s.marks_obtained ?? "—"}</div></td>

                      <td className="px-6 py-4 text-sm text-gray-600">{s.created_at ? new Date(s.created_at).toLocaleString() : "—"}</td>

                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleViewSubmission(s)}>
                            <Eye className="w-4 h-4 mr-1"/> View
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => handleDownloadPdf(s)} disabled={pdfLoadingId === s.submission_id}>
                            {pdfLoadingId === s.submission_id ? (
                              <span className="inline-flex items-center gap-2">Preparing...</span>
                            ) : (
                              <>
                                <Download className="w-4 h-4 mr-1"/> PDF
                              </>
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </main>

      {/* View Submission Modal */}
      {viewingSubmission && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden border border-gray-200 dark:border-gray-700">
            {/* Header */}
            <div className="flex items-start justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-gray-800">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2"><User className="w-5 h-5"/> {viewingSubmission.student_name}</h3>
                <p className="text-sm text-gray-600">{viewingSubmission.practical_title}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setViewingSubmission(null)} className="rounded-full"><X className="w-5 h-5"/></Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 overflow-auto" style={{ maxHeight: '72vh' }}>
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><Code2 className="w-4 h-4 text-blue-600"/> Code</h4>
                <div className="bg-gray-900 dark:bg-gray-950 rounded-lg overflow-auto border border-gray-700 p-3">
                  <pre className="text-xs text-gray-100 font-mono whitespace-pre-wrap">{viewingSubmission.code || 'No code submitted'}</pre>
                </div>

                <div className="mt-4">
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><FileText className="w-4 h-4 text-purple-600"/> Output</h4>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700 text-sm whitespace-pre-wrap">
                    {viewingSubmission.output || 'No output'}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-2"><FileText className="w-4 h-4 text-purple-600"/> Test Case Results</h4>
                <div className="space-y-3">
                  {viewingSubmission.testCaseResults?.length ? (
                    viewingSubmission.testCaseResults.map((r: TestCaseResult, idx: number) => {
                      const tc = testCases.find((t: TestCase) => t.id === r.test_case_id);
                      return (
                        <div key={idx} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-white dark:bg-gray-800">
                          <div className="flex items-center justify-between mb-2">
                            <div className="font-semibold">Test #{idx + 1} {tc?.is_hidden && <span className="text-xs ml-2 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">hidden</span>}</div>
                            <div className={`text-sm font-medium ${getStatusColor(r.status)}`}>{String(r.status).toUpperCase()}</div>
                          </div>

                          <div className="text-xs text-gray-600 dark:text-gray-300 space-y-2">
                            <div>
                              <div className="font-medium">Input</div>
                              <pre className="mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs font-mono">{tc?.input || '—'}</pre>
                            </div>
                            <div>
                              <div className="font-medium">Expected</div>
                              <pre className="mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs font-mono">{tc?.expected_output || '—'}</pre>
                            </div>
                            <div>
                              <div className="font-medium">Output</div>
                              <pre className="mt-1 p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs font-mono">{r.stdout || '—'}</pre>
                            </div>
                            {r.stderr && (
                              <div>
                                <div className="font-medium text-red-600">Error</div>
                                <pre className="mt-1 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs font-mono text-red-700">{r.stderr}</pre>
                              </div>
                            )}

                            <div className="flex items-center gap-4 text-xs text-gray-500 pt-2">
                              <div>⏱ {r.execution_time_ms ?? '-'} ms</div>
                              <div>💾 {r.memory_used_kb ?? '-'} KB</div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-6 text-gray-500">No test case results available</div>
                  )}
                </div>

                <div className="mt-4 flex gap-2">
                  <Button onClick={() => handleDownloadPdf(viewingSubmission)} disabled={pdfLoadingId === viewingSubmission.submission_id}>
                    <Download className="w-4 h-4 mr-1"/> {pdfLoadingId === viewingSubmission.submission_id ? 'Preparing...' : 'Download PDF'}
                  </Button>
                  <Button variant="ghost" onClick={() => setViewingSubmission(null)}>Close</Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-gray-900/60 rounded-xl p-4 border border-gray-200/50 dark:border-gray-700/50 flex items-center justify-between gap-4">
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
      <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">{icon}</div>
    </div>
  );
}