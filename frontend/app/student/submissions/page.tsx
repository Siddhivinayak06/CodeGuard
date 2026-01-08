"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { generatePdfClient } from "@/lib/ClientPdf";
import type { User } from "@supabase/supabase-js";
import {
  FileText,
  Code,
  Download,
  Eye,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  FileCode,
  Search,
  ListFilter,
  X,
  Code2,
  Sparkles
} from "lucide-react";

// Types
interface Submission {
  id: number;
  practical_id: number;
  practical_title: string;
  code: string;
  output: string;
  language: string;
  status: string;
  created_at: string;
  marks_obtained: number | null;
  testCaseResults: TestCaseResult[];
}

interface TestCase {
  id: number;
  input: string;
  expected_output: string;
  is_hidden: boolean | null;
}

interface TestCaseResult {
  test_case_id: number;
  status: string;
  stdout: string;
  stderr: string;
  execution_time_ms: number;
  memory_used_kb: number;
}

// Status badge component matching dashboard/practicals
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
      icon: <AlertCircle className="w-3.5 h-3.5" />,
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
    timeout: {
      bg: "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800",
      text: "text-yellow-700 dark:text-yellow-400",
      icon: <Clock className="w-3.5 h-3.5" />,
    },
    pending: {
      bg: "bg-slate-100 dark:bg-slate-900/30 border-slate-200 dark:border-slate-700",
      text: "text-slate-700 dark:text-slate-400",
      icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />,
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
  icon: React.ComponentType<{ className?: string }>;
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

// Skeleton loader for cards
function SkeletonCard() {
  return (
    <div className="p-5 glass-card rounded-2xl animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-gray-200 dark:bg-gray-700" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 rounded" />
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
        </div>
        <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded-lg" />
      </div>
    </div>
  );
}

interface SubmissionFetched {
  id: number;
  code: string;
  output: string;
  language: string;
  status: string;
  created_at: string;
  practical_id: number;
  marks_obtained: number | null;
  practicals: { title: string } | null;
  test_case_results: TestCaseResult[];
}

export default function StudentSubmissions() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const mountedRef = useRef<boolean>(false);

  const [user, setUser] = useState<User | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewingSubmission, setViewingSubmission] = useState<Submission | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [pdfLoading, setPdfLoading] = useState<boolean>(false);

  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [studentDetails, setStudentDetails] = useState<{ name: string; roll_number: string } | null>(null);

  // Auth check & Fetch User Details
  useEffect(() => {
    mountedRef.current = true;
    const fetchUserAndDetails = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/auth/login");
          return;
        }
        if (mountedRef.current) setUser(user);

        // Fetch additional details
        const { data: userProfile } = await supabase
          .from("users")
          .select("name, roll_no")
          .eq("uid", user.id)
          .single();

        if (mountedRef.current) {
          setStudentDetails({
            name: userProfile?.name || user.email || "Student",
            roll_number: userProfile?.roll_no || "N/A"
          });
        }
      } catch (err) {
        console.error("Auth fetch error:", err);
        router.push("/auth/login");
      }
    };
    fetchUserAndDetails();
    return () => { mountedRef.current = false; };
  }, [router, supabase]);

  // Fetch submissions
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
            execution_details
          `)
          .eq("student_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        const formatted: Submission[] = (data as unknown as any[]).map((s) => ({
          id: s.id,
          practical_id: s.practical_id,
          practical_title: s.practicals?.title || "Unknown",
          code: s.code,
          output: s.output,
          language: s.language,
          status: s.status,
          created_at: s.created_at,
          marks_obtained: s.marks_obtained,
          testCaseResults: s.execution_details?.results || [],
        }));

        if (mountedRef.current) setSubmissions(formatted);
      } catch (err) {
        console.error("Supabase fetch error:", err);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };

    fetchSubmissions();
  }, [user?.id, supabase]);

  // Handle View with Test Cases Fetching
  const handleView = async (submission: Submission) => {
    setLoadingDetails(true);
    setViewingSubmission(submission);
    try {
      const { data, error } = await supabase
        .from("test_cases")
        .select("*")
        .eq("practical_id", submission.practical_id)
        .order("id", { ascending: true });

      if (error) throw error;
      setTestCases(data || []);
    } catch (err) {
      console.error("Failed to fetch test cases:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Download PDF
  const handleDownloadPdf = async (submission: Submission) => {
    if (!submission) return;
    try {
      setPdfLoading(true);
      await generatePdfClient({
        studentName: studentDetails?.name || "Student",
        rollNumber: studentDetails?.roll_number || "N/A",
        practicalTitle: submission.practical_title,
        code: submission.code || "No code submitted",
        language: submission.language,
        submissionDate: new Date(submission.created_at).toLocaleDateString(),
        status: submission.status,
        marks: submission.marks_obtained ?? undefined,
        filename: submission.practical_title
          ? `${submission.practical_title.replace(/\s+/g, "_")}_Report.pdf`
          : "submission_report.pdf",
      });
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setPdfLoading(false);
    }
  };

  const getLanguageColor = (lang: string) => {
    switch (lang?.toLowerCase()) {
      case "python": return "from-yellow-400 to-blue-500";
      case "java": return "from-red-500 to-orange-500";
      case "c": return "from-blue-500 to-cyan-500";
      case "cpp": return "from-blue-600 to-blue-400";
      case "javascript": return "from-yellow-300 to-yellow-500";
      default: return "from-indigo-400 to-indigo-600";
    }
  };

  // Stats calculation
  const stats = useMemo(() => ({
    total: submissions.length,
    passed: submissions.filter(s => s.status?.toLowerCase() === "passed").length,
    failed: submissions.filter(s => s.status?.toLowerCase() === "failed").length,
    pending: submissions.filter(s => !["passed", "failed"].includes(s.status?.toLowerCase())).length,
  }), [submissions]);

  // Filtering
  const filteredSubmissions = submissions.filter(s => {
    const matchesSearch = s.practical_title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterStatus === "all" || s.status.toLowerCase() === filterStatus;
    return matchesSearch && matchesFilter;
  });

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 dark:from-gray-950 dark:via-indigo-950/10 dark:to-purple-950/10">
      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 xl:px-12 w-full mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 animate-slideUp">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gradient">My Submissions</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Track your coding journey</p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard label="Total" value={stats.total} icon={ListFilter} color="bg-blue-100 dark:bg-blue-900/30" delay={100} />
          <StatCard label="Passed" value={stats.passed} icon={CheckCircle2} color="bg-emerald-100 dark:bg-emerald-900/30" delay={200} />
          <StatCard label="Failed" value={stats.failed} icon={AlertCircle} color="bg-red-100 dark:bg-red-900/30" delay={300} />
          <StatCard label="Pending" value={stats.pending} icon={Clock} color="bg-amber-100 dark:bg-amber-900/30" delay={400} />
        </div>

        {/* Filters & Content */}
        <div className="glass-card-premium rounded-3xl overflow-hidden animate-slideUp animation-delay-500 flex flex-col min-h-[600px]">
          {/* Toolbar */}
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4 bg-white/40 dark:bg-gray-800/40">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 no-scrollbar w-full sm:w-auto">
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

            <div className="w-full sm:w-auto relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search practicals..."
                className="w-full sm:w-64 pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all shadow-sm"
              />
            </div>
          </div>

          <div className="p-4 space-y-4 bg-gray-50/30 dark:bg-gray-900/30 flex-1">
            {loading ? (
              [1, 2, 3].map((i) => <SkeletonCard key={i} />)
            ) : filteredSubmissions.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center opacity-50">
                  <FileCode className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Results Found</h3>
                <p className="text-gray-500 dark:text-gray-400">Try adjusting your filters or search query.</p>
              </div>
            ) : (
              filteredSubmissions.map((s) => (
                <div
                  key={s.id}
                  className="glass-card rounded-2xl p-5 hover-lift group border border-white/40 dark:border-gray-800"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getLanguageColor(s.language)} flex items-center justify-center shadow-lg flex-shrink-0 text-white font-bold`}>
                      <Code className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="md:flex md:items-start md:justify-between gap-4">
                        <div>
                          <h3 className="font-bold text-lg text-gray-900 dark:text-white truncate">
                            {s.practical_title}
                          </h3>
                          <div className="flex flex-wrap items-center gap-3 mt-1.5">
                            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                              {s.language}
                            </span>
                            <span className="text-gray-300 dark:text-gray-700">|</span>
                            <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                              <Calendar className="w-3.5 h-3.5" />
                              {new Date(s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 md:mt-0 flex items-center gap-3">
                          <StatusBadge status={s.status} />
                          {s.marks_obtained !== null && (
                            <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/50">
                              <Sparkles className="w-3.5 h-3.5" />
                              <span className="text-sm font-bold">{s.marks_obtained}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex sm:flex-col gap-2 pt-4 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-800">
                      <Button size="sm" variant="outline" className="flex-1 sm:flex-none justify-center gap-2" onClick={() => handleView(s)}>
                        <Eye className="w-4 h-4" /> View
                      </Button>
                      <Button size="sm" variant="ghost" className="flex-1 sm:flex-none justify-center gap-2 text-gray-500 hover:text-indigo-600" onClick={() => handleDownloadPdf(s)} disabled={pdfLoading}>
                        <Download className="w-4 h-4" /> PDF
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Enhanced View Modal */}
      {viewingSubmission && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card-premium rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getLanguageColor(viewingSubmission.language)} text-white flex items-center justify-center font-bold shadow-lg`}>
                  <Code2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {viewingSubmission.practical_title}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <StatusBadge status={viewingSubmission.status} />
                    <span>•</span>
                    <span className="font-mono">{new Date(viewingSubmission.created_at).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setViewingSubmission(null)} className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 bg-gray-50/50 dark:bg-gray-950/50">
              {/* Left: Code & Output */}
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between">
                    <h4 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                      <Code className="w-4 h-4 text-indigo-500" /> Submitted Code
                    </h4>
                    <span className="text-xs font-mono px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase">
                      {viewingSubmission.language}
                    </span>
                  </div>
                  <div className="p-0 overflow-auto max-h-[400px]">
                    <pre className="p-4 text-xs sm:text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                      {viewingSubmission.code}
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

              {/* Right: Test Results */}
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between">
                    <h4 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Test Results
                    </h4>
                  </div>
                  <div className="p-4 space-y-3 max-h-[600px] overflow-auto">
                    {loadingDetails ? (
                      <div className="text-center py-8"><Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" /></div>
                    ) : viewingSubmission.testCaseResults?.length > 0 ? (
                      viewingSubmission.testCaseResults.map((r, idx) => {
                        const tc = testCases.find(t => t.id === r.test_case_id);
                        return (
                          <div key={idx} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50/50 dark:bg-gray-900/50">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-3">
                                <span className="w-6 h-6 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300 shadow-inner">
                                  {idx + 1}
                                </span>
                                <span className="font-medium text-xs text-gray-500 dark:text-gray-400">
                                  {tc?.is_hidden ? "Hidden" : "Public"}
                                </span>
                              </div>
                              <span className={`text-xs font-bold px-2 py-0.5 rounded ${r.status?.toLowerCase() === 'passed' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20' : 'text-red-600 bg-red-50 dark:bg-red-900/20'
                                }`}>
                                {r.status?.toUpperCase()}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <p className="text-gray-500 mb-1 font-medium">Input</p>
                                <div className="bg-white dark:bg-gray-950 p-2 rounded-lg border border-gray-200 dark:border-gray-700 font-mono truncate">{tc?.input || '—'}</div>
                              </div>
                              <div>
                                <p className="text-gray-500 mb-1 font-medium">Expected</p>
                                <div className="bg-white dark:bg-gray-950 p-2 rounded-lg border border-gray-200 dark:border-gray-700 font-mono truncate">{tc?.expected_output || '—'}</div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-8 text-gray-500">No test results available</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}