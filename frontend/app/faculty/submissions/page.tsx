"use client";

import React, { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams, useRouter } from "next/navigation";
import { generatePdfClient } from "@/lib/ClientPdf";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Download,
  Eye,
  X,
  Code2,
  FileText,
  ListFilter,
  Search as SearchIcon,
  GraduationCap,
  Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";

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
  roll_no?: string;
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
const initials = (name?: string) => (name || "?").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    passed: {
      bg: "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800",
      text: "text-emerald-700 dark:text-emerald-400",
      icon: <CheckCircle2 className="w-3.5 h-3.5" />,
    },
    failed: {
      bg: "bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800",
      text: "text-red-700 dark:text-red-400",
      icon: <XCircle className="w-3.5 h-3.5" />,
    },
    compile_error: {
      bg: "bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800",
      text: "text-orange-700 dark:text-orange-400",
      icon: <AlertCircle className="w-3.5 h-3.5" />,
    },
    runtime_error: {
      bg: "bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800",
      text: "text-red-700 dark:text-red-400",
      icon: <AlertCircle className="w-3.5 h-3.5" />,
    },
    pending: {
      bg: "bg-slate-100 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700",
      text: "text-slate-700 dark:text-slate-400",
      icon: <Clock className="w-3.5 h-3.5" />,
    },
  };

  const style = styles[status?.toLowerCase()] || styles.pending;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-lg border ${style.bg} ${style.text}`}
    >
      {style.icon}
      <span className="capitalize">{status?.replace(/_/g, " ") || "Unknown"}</span>
    </span>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  delay = 0
}: {
  label: string;
  value: number;
  icon: any;
  color: string;
  delay?: number;
}) {
  return (
    <div
      className="glass-card rounded-2xl p-5 hover-lift animate-slideUp group"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${color} bg-opacity-20 flex items-center justify-center`}>
          <Icon className={`w-6 h-6 text-gray-700 dark:text-white`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {value}
          </p>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

function FacultySubmissionsContent() {
  // Ensure supabase client is stable across renders
  const [supabase] = useState(() => createClient());

  const searchParams = useSearchParams();
  const router = useRouter();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [allPracticals, setAllPracticals] = useState<{ id: number; title: string }[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewingSubmission, setViewingSubmission] = useState<ViewingSubmission | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<number | null>(null);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [query, setQuery] = useState<string>(searchParams.get("q") || "");

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

  useEffect(() => {
    let isMounted = true;
    const fetchSubmissions = async () => {
      setLoading(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          if (isMounted) setLoading(false);
          return;
        }

        // 1. Get subjects for this faculty
        const { data: subjects } = await supabase
          .from("subjects")
          .select("id")
          .eq("faculty_id", userData.user.id);

        if (!subjects || subjects.length === 0) {
          if (isMounted) {
            setSubmissions([]);
            setLoading(false);
          }
          return;
        }

        const subjectIds = subjects.map(s => s.id);

        // 2. Get practicals
        const { data: practicals } = await supabase
          .from("practicals")
          .select("id, title")
          .in("subject_id", subjectIds);

        if (!practicals || practicals.length === 0) {
          if (isMounted) {
            setSubmissions([]);
            setLoading(false);
          }
          return;
        }

        const practicalIds = practicals.map(p => p.id);
        const practicalMap = new Map(practicals.map(p => [p.id, p.title]));

        if (isMounted) {
          setAllPracticals(practicals);
        }

        // 3. Get submissions
        const { data: subs, error } = await supabase
          .from("submissions")
          .select(`
            id,
            student_id,
            practical_id,
            code,
            language,
            status,
            marks_obtained,
            created_at,
            output,
            test_cases_passed
          `)
          .in("practical_id", practicalIds)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // 4. Fetch user details
        const studentIds = Array.from(new Set(subs?.map(s => s.student_id) || []));
        const { data: usersData } = await supabase
          .from("users")
          .select("uid, name, email")
          .in("uid", studentIds);

        const userMap = new Map(usersData?.map(u => [u.uid, u]) || []);

        // 5. Fetch student details (roll numbers)
        const { data: studentDetails } = await supabase
          .from("student_details")
          .select("student_id, roll_no")
          .in("student_id", studentIds);

        const rollNoMap = new Map(studentDetails?.map(sd => [sd.student_id, sd.roll_no]) || []);

        const formatted: Submission[] = (subs || []).map((s: any) => ({
          id: s.id,
          submission_id: s.id,
          student_id: s.student_id,
          student_name: userMap.get(s.student_id)?.name || "Unknown Student",
          practical_id: s.practical_id,
          practical_title: practicalMap.get(s.practical_id) || "Unknown Practical",
          code: s.code || "",
          output: s.output || "",
          language: s.language || "unknown",
          status: s.status || "pending",
          marks_obtained: s.marks_obtained,
          created_at: s.created_at,
          updated_at: s.created_at,
          roll_no: rollNoMap.get(s.student_id) || "N/A"
        }));

        if (isMounted) {
          setSubmissions(formatted);
        }
      } catch (err) {
        console.error("Error fetching submissions:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchSubmissions();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  // Handle PDF Download
  const handleDownloadPdf = async (sub: Submission) => {
    setPdfLoadingId(sub.submission_id);
    try {
      await generatePdfClient(
        {
          studentName: sub.student_name,
          rollNumber: sub.roll_no || sub.student_id,
          practicalTitle: sub.practical_title,
          code: sub.code,
          language: sub.language,
          submissionDate: new Date(sub.created_at).toLocaleDateString(),
          status: sub.status,
          marks: sub.marks_obtained ?? undefined
        }
      );
    } catch (e) {
      console.error("PDF generation failed", e);
      alert("Could not generate PDF");
    } finally {
      setPdfLoadingId(null);
    }
  };

  // Handle View Submission
  const handleViewSubmission = async (sub: Submission) => {
    // first fetch test cases for this practical
    const tcs = await fetchTestCases(sub.practical_id);
    setTestCases(tcs);

    // then fetch results
    const results = await fetchTestCaseResults(sub.submission_id);

    setViewingSubmission({
      ...sub,
      testCaseResults: results
    });
  };

  const filteredSubmissions = submissions.filter(s => {
    const matchesQuery = query === "" ||
      s.student_name.toLowerCase().includes(query.toLowerCase()) ||
      s.practical_title.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = filterStatus === "all" || s.status.toLowerCase() === filterStatus;

    // Allow filtering by practical ID via URL param
    const practicalParam = searchParams.get("practical");
    const matchesPractical = !practicalParam || s.practical_id.toString() === practicalParam;

    return matchesQuery && matchesStatus && matchesPractical;
  });

  const stats = useMemo(() => ({
    total: submissions.length,
    passed: submissions.filter(s => s.status?.toLowerCase() === "passed").length,
    failed: submissions.filter(s => s.status?.toLowerCase() === "failed").length,
    pending: submissions.filter(s => !["passed", "failed"].includes(s.status?.toLowerCase())).length,
  }), [submissions]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 dark:from-gray-950 dark:via-indigo-950/10 dark:to-purple-950/10">

      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-8">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-slideUp">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gradient">
                Student Submissions
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Review and grade student practical submissions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="group relative">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 group-focus-within:text-indigo-500 transition-colors" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search students..."
                className="pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all w-64 shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard
            label="Total"
            value={stats.total}
            icon={ListFilter}
            color="bg-blue-100 dark:bg-blue-900/30"
            delay={100}
          />
          <StatCard
            label="Passed"
            value={stats.passed}
            icon={CheckCircle2}
            color="bg-emerald-100 dark:bg-emerald-900/30"
            delay={200}
          />
          <StatCard
            label="Failed"
            value={stats.failed}
            icon={XCircle}
            color="bg-red-100 dark:bg-red-900/30"
            delay={300}
          />
          <StatCard
            label="Pending"
            value={stats.pending}
            icon={Clock}
            color="bg-amber-100 dark:bg-amber-900/30"
            delay={400}
          />
        </div>

        {/* Main Content Area */}
        <div className="glass-card-premium rounded-3xl overflow-hidden animate-slideUp animation-delay-500 flex flex-col min-h-[600px]">
          {/* Toolbar */}
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-4 bg-white/40 dark:bg-gray-800/40">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
              {["all", "passed", "failed"].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap capitalize ${filterStatus === status
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/30"
                    : "bg-white/50 dark:bg-gray-800/50 text-gray-600 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700"
                    }`}
                >
                  {status}
                </button>
              ))}
            </div>

            <div className="text-sm text-gray-500 hidden sm:block font-medium">
              Showing {filteredSubmissions.length} of {submissions.length} results
            </div>

            {/* Practical Filter Controls */}
            <div className="flex items-center gap-2">
              {searchParams.get("practical") ? (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-lg text-sm font-medium border border-indigo-200 dark:border-indigo-800 animate-fadeIn">
                  <Filter className="w-3.5 h-3.5" />
                  <span className="max-w-[150px] truncate">
                    {allPracticals.find(p => p.id.toString() === searchParams.get("practical"))?.title || "Practical"}
                  </span>
                  <button
                    onClick={() => router.push("/faculty/submissions")}
                    className="ml-1 hover:bg-indigo-200 dark:hover:bg-indigo-800 rounded-full p-0.5 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative group">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        router.push(`/faculty/submissions?practical=${e.target.value}`);
                      }
                    }}
                    className="pl-9 pr-8 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-800/50 text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer hover:bg-white dark:hover:bg-gray-800 transition-all w-[180px]"
                    defaultValue=""
                  >
                    <option value="" disabled>Filter by Practical</option>
                    {allPracticals.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead className="bg-gray-50/50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Practical</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Language</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Marks</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Submitted</th>
                  <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800/50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-10 w-40 bg-gray-200 dark:bg-gray-700 rounded-lg"></div></td>
                      <td className="px-6 py-4"><div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
                      <td className="px-6 py-4"><div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
                      <td className="px-6 py-4"><div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
                      <td className="px-6 py-4"><div className="h-6 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
                      <td className="px-6 py-4"><div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div></td>
                      <td className="px-6 py-4"></td>
                    </tr>
                  ))
                ) : filteredSubmissions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
                        <ListFilter className="w-12 h-12 mb-3 opacity-20" />
                        <p className="text-lg font-medium">No submissions found</p>
                        <p className="text-sm">Try adjusting your filters or search query</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredSubmissions.map((s) => (
                    <tr key={s.submission_id} className="group hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-indigo-500/20">
                            {initials(s.student_name)}
                          </div>
                          <div>
                            <div className="font-semibold text-gray-900 dark:text-white">{s.student_name}</div>
                            <div className="text-xs text-gray-500 font-mono">{s.roll_no || s.student_id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-800 dark:text-gray-200 max-w-[200px] truncate" title={s.practical_title}>
                          {s.practical_title}
                        </div>
                        <div className="text-xs text-gray-500">ID: {s.practical_id}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 uppercase">
                          {s.language}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-gray-900 dark:text-white">
                          {s.marks_obtained !== null ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-sm bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300">
                              {s.marks_obtained}
                            </span>
                          ) : <span className="text-gray-400">—</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(s.created_at).toLocaleDateString()}
                        <div className="text-xs opacity-70">
                          {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 transition-opacity">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleViewSubmission(s)}
                            className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
                            title="View Details"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDownloadPdf(s)}
                            disabled={pdfLoadingId === s.submission_id}
                            className="bg-purple-50 dark:bg-purple-900/20 text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/40"
                            title="Download PDF"
                          >
                            {pdfLoadingId === s.submission_id ? (
                              <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card-premium rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-lg">
                  {initials(viewingSubmission.student_name)}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {viewingSubmission.student_name}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="font-mono">{viewingSubmission.student_id}</span>
                    <span>•</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                      {viewingSubmission.practical_title}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setViewingSubmission(null)}
                className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 bg-gray-50/50 dark:bg-gray-950/50">

              {/* Left Column: Code & Output */}
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between">
                    <h4 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                      <Code2 className="w-4 h-4 text-indigo-500" /> Source Code
                    </h4>
                    <span className="text-xs font-mono px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase border border-gray-200 dark:border-gray-600">
                      {viewingSubmission.language}
                    </span>
                  </div>
                  <div className="p-0 overflow-auto max-h-[400px]">
                    <pre className="p-4 text-xs sm:text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                      {viewingSubmission.code || <span className="text-gray-400 italic">No code submitted</span>}
                    </pre>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                    <h4 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-purple-500" /> Standard Output
                    </h4>
                  </div>
                  <div className="p-4 bg-gray-900 text-gray-300 font-mono text-xs sm:text-sm rounded-b-2xl max-h-[200px] overflow-auto whitespace-pre-wrap">
                    {viewingSubmission.output || <span className="opacity-50">No output</span>}
                  </div>
                </div>
              </div>

              {/* Right Column: Test Cases & Status */}
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between">
                    <h4 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Test Results
                    </h4>
                    <StatusBadge status={viewingSubmission.status} />
                  </div>
                  <div className="p-4 space-y-3 max-h-[600px] overflow-auto">
                    {viewingSubmission.testCaseResults?.length ? (
                      viewingSubmission.testCaseResults.map((r: TestCaseResult, idx: number) => {
                        const tc = testCases.find((t: TestCase) => t.id === r.test_case_id);
                        return (
                          <div key={idx} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50/50 dark:bg-gray-900/50 transition-all hover:bg-white dark:hover:bg-gray-800 hover:shadow-md">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300 shadow-inner">
                                  {idx + 1}
                                </span>
                                <span className="font-medium text-sm text-gray-700 dark:text-gray-200">
                                  {tc?.is_hidden ? "Hidden Test Case" : "Public Test Case"}
                                </span>
                              </div>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded ${r.status?.toLowerCase() === 'passed'
                                ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20'
                                : 'text-red-600 bg-red-50 dark:bg-red-900/20'
                                }`}>
                                {r.status?.toUpperCase()}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <p className="text-gray-500 mb-1 font-medium">Input</p>
                                <div className="bg-white dark:bg-gray-950 p-2 rounded-lg border border-gray-200 dark:border-gray-700 font-mono truncate">
                                  {tc?.input || '—'}
                                </div>
                              </div>
                              <div>
                                <p className="text-gray-500 mb-1 font-medium">Expected</p>
                                <div className="bg-white dark:bg-gray-950 p-2 rounded-lg border border-gray-200 dark:border-gray-700 font-mono truncate">
                                  {tc?.expected_output || '—'}
                                </div>
                              </div>
                              <div className="col-span-2">
                                <p className="text-gray-500 mb-1 font-medium">Actual Output</p>
                                <div className="bg-white dark:bg-gray-950 p-2 rounded-lg border border-gray-200 dark:border-gray-700 font-mono whitespace-pre-wrap max-h-20 overflow-auto">
                                  {r.stdout || <span className="text-gray-400 opacity-50">No output</span>}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500">
                              <span className="flex items-center gap-1">
                                <Clock size={12} /> {r.execution_time_ms ?? 0} ms
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock size={12} /> {r.memory_used_kb ?? 0} KB
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                        <AlertCircle className="w-8 h-8 opacity-20 mb-2" />
                        <p>No test case results available</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setViewingSubmission(null)}
              >
                Close
              </Button>
              <Button
                onClick={() => handleDownloadPdf(viewingSubmission)}
                disabled={pdfLoadingId === viewingSubmission.submission_id}
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/20"
              >
                {pdfLoadingId === viewingSubmission.submission_id ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" /> Generating...</>
                ) : (
                  <><Download className="w-4 h-4 mr-2" /> Download Report</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function FacultySubmissionsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <FacultySubmissionsContent />
    </Suspense>
  );
}