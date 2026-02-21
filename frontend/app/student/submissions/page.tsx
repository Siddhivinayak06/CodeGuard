"use client";

import React, { useEffect, useState, useMemo, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { generatePdfClient } from "@/lib/ClientPdf";
import type { User } from "@supabase/supabase-js";
import {
  FileText,
  Code,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Search,
  X,
  Code2,
  Sparkles,
  LayoutGrid,
  Menu,
} from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import SubmissionsSidebar from "../../faculty/submissions/SubmissionsSidebar";
import { toast } from "sonner";
import { motion } from "framer-motion";
import StatCard from "@/components/dashboard/student/StatCard";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
} as const;

const shellVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.3 },
  },
} as const;

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 20,
    },
  },
} as const;

// ============================================================================
// TYPES
// ============================================================================

interface Submission {
  id: number;
  practical_id: number;
  practical_title: string;
  subject_id: number | null;
  subject_name?: string;
  subject_code?: string;
  code: string;
  output: string;
  language: string;
  status: string;
  created_at: string;
  marks_obtained: number | null;
  testCaseResults: TestCaseResult[];
  attempt_count?: number;
  max_attempts?: number;
  is_locked?: boolean;
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

// For Sidebar
interface SidebarSubject {
  id: number;
  subject_name: string;
  subject_code: string;
  practicals: { id: number; title: string }[];
}

// ============================================================================
// COMPONENTS
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  const styles: Record<
    string,
    { bg: string; text: string; icon: React.ReactNode }
  > = {
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
      <span className="capitalize">
        {status?.replace(/_/g, " ") || "Unknown"}
      </span>
    </span>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td colSpan={7} className="px-4 py-4">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
      </td>
    </tr>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

function StudentSubmissionsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const mountedRef = useRef<boolean>(false);

  // Data State
  const [user, setUser] = useState<User | null>(null);
  const [studentDetails, setStudentDetails] = useState<{ name: string; roll_number: string } | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [subjects, setSubjects] = useState<SidebarSubject[]>([]);

  // UI State
  const [loading, setLoading] = useState<boolean>(true);
  const [viewingSubmission, setViewingSubmission] = useState<Submission | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);
  const [pdfLoading, setPdfLoading] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Filtering State
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedPracticalId, setSelectedPracticalId] = useState<number | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Request Reattempt State
  const [requestingReattempt, setRequestingReattempt] = useState<number | null>(null);

  // Auth & Initial Fetch
  useEffect(() => {
    mountedRef.current = true;
    const init = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/auth/login");
          return;
        }
        if (mountedRef.current) setUser(user);

        // Fetch user profile
        const { data: profile } = await supabase
          .from("users")
          .select("name, roll_no")
          .eq("uid", user.id)
          .single();

        if (mountedRef.current) {
          setStudentDetails({
            name: (profile as any)?.name || user.email || "Student",
            roll_number: (profile as any)?.roll_no || "N/A",
          });
        }
      } catch (err) {
        console.error("Auth error:", err);
        router.push("/auth/login");
      }
    };
    init();
    return () => { mountedRef.current = false; };
  }, [router, supabase]);

  // Fetch Submissions & Build Hierarchy
  useEffect(() => {
    if (!user?.id) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch submissions with practical & subject details
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
            practicals (
              title,
              subject_id,
              subjects (
                id,
                subject_name,
                subject_code
              )
            ),
            execution_details
          `)
          .eq("student_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        // Process Submissions
        const rawSubmissions = (data as any[]) || [];
        const processedSubmissions: Submission[] = rawSubmissions.map(s => ({
          id: s.id,
          practical_id: s.practical_id,
          practical_title: s.practicals?.title || "Unknown Practical",
          subject_id: s.practicals?.subject_id || null,
          subject_name: s.practicals?.subjects?.subject_name || "Unknown Subject",
          subject_code: s.practicals?.subjects?.subject_code || "",
          code: s.code,
          output: s.output,
          language: s.language,
          status: s.status,
          created_at: s.created_at,
          marks_obtained: s.marks_obtained,
          testCaseResults: s.execution_details?.results || [],
        }));

        if (mountedRef.current) setSubmissions(processedSubmissions);

        // Build Sidebar Hierarchy from Submissions
        const subjectMap = new Map<number, SidebarSubject>();

        processedSubmissions.forEach(sub => {
          if (sub.subject_id) {
            if (!subjectMap.has(sub.subject_id)) {
              subjectMap.set(sub.subject_id, {
                id: sub.subject_id,
                subject_name: sub.subject_name || "Subject",
                subject_code: sub.subject_code || "",
                practicals: []
              });
            }
            const subjectEntry = subjectMap.get(sub.subject_id)!;
            if (!subjectEntry.practicals.some(p => p.id === sub.practical_id)) {
              subjectEntry.practicals.push({
                id: sub.practical_id,
                title: sub.practical_title
              });
            }
          }
        });

        // Convert Map to Array and Sort
        const sidebarSubjects = Array.from(subjectMap.values()).sort((a, b) => a.subject_name.localeCompare(b.subject_name));
        sidebarSubjects.forEach(s => s.practicals.sort((a, b) => a.title.localeCompare(b.title)));

        if (mountedRef.current) setSubjects(sidebarSubjects);

      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };

    fetchData();
  }, [user?.id, supabase]);

  // Handle URL Params for deep linking
  useEffect(() => {
    const pid = searchParams?.get("practicalId");
    if (pid && submissions.length > 0) {
      const sub = submissions.find(s => s.practical_id.toString() === pid);
      if (sub) {
        // Auto-open logic if needed
      }
    }
  }, [searchParams, submissions]);

  // Handlers
  const handleSelectSubject = (id: number | null) => {
    setSelectedSubjectId(id);
    setSelectedPracticalId(null);
  };

  const handleSelectPractical = (id: number | null) => {
    setSelectedPracticalId(id);
    if (id && subjects.length > 0) {
      const subj = subjects.find(s => s.practicals.some(p => p.id === id));
      if (subj) setSelectedSubjectId(subj.id);
    }
  };

  const handleView = async (initialSub: Submission) => {
    setLoadingDetails(true);
    setViewingSubmission(initialSub);
    try {
      const { data: fullSub, error } = await supabase
        .from("submissions")
        .select(`*, practicals(title), execution_details`)
        .eq("id", initialSub.id)
        .single();

      if (!error && fullSub) {
        setViewingSubmission(prev => prev ? ({
          ...prev,
          code: (fullSub as any).code || "",
          output: (fullSub as any).output || "",
          status: (fullSub as any).status || "pending",
          testCaseResults: ((fullSub as any).execution_details as any)?.results || []
        }) : null);
      }

      const { data: tcData } = await supabase
        .from("test_cases")
        .select("*")
        .eq("practical_id", initialSub.practical_id)
        .order("id");

    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleDownloadPdf = async (sub: Submission) => {
    setPdfLoading(true);
    try {
      await generatePdfClient({
        studentName: studentDetails?.name || "Student",
        rollNumber: studentDetails?.roll_number || "N/A",
        practicalTitle: sub.practical_title,
        code: sub.code,
        language: sub.language,
        submissionDate: new Date(sub.created_at).toLocaleDateString(),
        status: sub.status,
        marks: sub.marks_obtained ?? undefined,
        filename: `${sub.practical_title.replace(/\s+/g, "_")}_Report.pdf`
      });
    } catch (e) {
      console.error(e);
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

  // derived state
  const filteredSubmissions = useMemo(() => {
    return submissions.filter(s => {
      const matchSubject = selectedSubjectId ? s.subject_id === selectedSubjectId : true;
      const matchPractical = selectedPracticalId ? s.practical_id === selectedPracticalId : true;
      const matchSearch = searchQuery ? (s.practical_title.toLowerCase().includes(searchQuery.toLowerCase()) || s.subject_name?.toLowerCase().includes(searchQuery.toLowerCase())) : true;
      const matchStatus = filterStatus === 'all' ? true : s.status === filterStatus;

      return matchSubject && matchPractical && matchSearch && matchStatus;
    });
  }, [submissions, selectedSubjectId, selectedPracticalId, searchQuery, filterStatus]);

  const stats = useMemo(() => ({
    total: submissions.length,
    passed: submissions.filter(s => s.status === 'passed').length,
    failed: submissions.filter(s => s.status === 'failed').length,
    pending: submissions.filter(s => ['pending', 'submitted'].includes(s.status)).length
  }), [submissions]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 dark:from-gray-950 dark:via-indigo-950/10 dark:to-purple-950/10 flex flex-col md:flex-row pt-16">
      {/* Sidebar - Master View */}
      <div className="w-full md:w-64 lg:w-72 flex-shrink-0 md:h-[calc(100vh-4rem)] md:sticky md:top-16 md:border-r border-gray-200 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur-xl z-20 hidden md:block overflow-y-auto">
        <SubmissionsSidebar
          subjects={subjects}
          selectedSubjectId={selectedSubjectId}
          selectedPracticalId={selectedPracticalId}
          onSelectSubject={handleSelectSubject}
          onSelectPractical={handleSelectPractical}
        />
      </div>

      {/* Mobile Sidebar Trigger */}
      <div className="md:hidden p-4 bg-white/50 dark:bg-gray-900/20 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 flex items-center gap-3">
        <Sheet open={isMobileSidebarOpen} onOpenChange={setIsMobileSidebarOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="-ml-2">
              <Menu className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-80 border-r-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl">
            <SubmissionsSidebar
              subjects={subjects}
              selectedSubjectId={selectedSubjectId}
              selectedPracticalId={selectedPracticalId}
              onSelectSubject={(id) => { handleSelectSubject(id); setIsMobileSidebarOpen(false); }}
              onSelectPractical={(id) => { handleSelectPractical(id); setIsMobileSidebarOpen(false); }}
              className="border-none bg-transparent"
            />
          </SheetContent>
        </Sheet>
        <h2 className="font-semibold text-gray-900 dark:text-white">My Submissions</h2>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <main className="p-4 sm:p-6 lg:p-8 xl:p-12 space-y-8 max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            variants={shellVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-6"
          >
            <div className="space-y-1">
              <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                {selectedPracticalId
                  ? subjects.flatMap(s => s.practicals).find(p => p.id === selectedPracticalId)?.title
                  : selectedSubjectId
                    ? <><span className="text-gray-500 font-medium">Subject: </span> {subjects.find(s => s.id === selectedSubjectId)?.subject_name}</>
                    : "All Submissions"
                }
              </h1>
              <p className="text-gray-500 dark:text-gray-400 font-medium">
                Track your progress and review past code submissions
              </p>
            </div>

            <div className="relative group self-start sm:self-center">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search submissions..."
                className="pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/60 backdrop-blur-md text-sm w-64 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 outline-none shadow-sm hover:shadow transition-all duration-200"
              />
            </div>
          </motion.div>

          {/* Stats Row */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-2 md:grid-cols-4 gap-6"
          >
            <StatCard
              label="Pending"
              value={stats.pending}
              icon={Clock}
              colorClass="text-amber-600 dark:text-amber-400"
              itemVariants={itemVariants}
              loading={loading}
            />
            <StatCard
              label="Passed"
              value={stats.passed}
              icon={CheckCircle2}
              colorClass="text-emerald-600 dark:text-emerald-400"
              itemVariants={itemVariants}
              loading={loading}
            />
            <StatCard
              label="Failed"
              value={stats.failed}
              icon={AlertCircle}
              colorClass="text-red-600 dark:text-red-400"
              itemVariants={itemVariants}
              loading={loading}
            />
            <StatCard
              label="Total"
              value={stats.total}
              icon={LayoutGrid}
              colorClass="text-indigo-600 dark:text-indigo-400"
              itemVariants={itemVariants}
              loading={loading}
            />
          </motion.div>

          {/* Submissions Table Card */}
          <motion.div
            variants={shellVariants}
            initial="hidden"
            animate="visible"
            className="glass-card-premium rounded-3xl overflow-hidden flex flex-col min-h-[500px]"
          >
            {/* Filters Bar */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center gap-4 bg-white/40 dark:bg-gray-900/40 backdrop-blur-md overflow-x-auto no-scrollbar">
              {['all', 'pending', 'passed', 'failed'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold capitalize transition-all whitespace-nowrap ${filterStatus === status
                    ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                    : 'text-gray-600 hover:bg-white/60 dark:hover:bg-gray-800/60 hover:text-indigo-600'
                    }`}
                >
                  {status}
                </button>
              ))}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50/30 dark:bg-gray-800/30 border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    <th className="px-6 py-4 font-semibold tracking-wider">Date</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Subject</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Practical</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Language</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Status</th>
                    <th className="px-6 py-4 font-semibold tracking-wider">Marks</th>
                    <th className="px-6 py-4 font-semibold tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100/50 dark:divide-gray-800/50">
                  {loading ? (
                    [1, 2, 3, 4, 5].map(i => <SkeletonRow key={i} />)
                  ) : filteredSubmissions.length === 0 ? (
                    <tr><td colSpan={7} className="p-12 text-center text-gray-500">
                      <div className="flex flex-col items-center justify-center gap-3 opacity-60">
                        <LayoutGrid className="w-10 h-10" />
                        <p>No submissions found.</p>
                      </div>
                    </td></tr>
                  ) : (
                    filteredSubmissions.map((sub) => {
                      let statusColor = "bg-gray-300 dark:bg-gray-600";
                      if (sub.status === 'passed') statusColor = "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]";
                      else if (sub.status === 'failed') statusColor = "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.3)]";
                      else if (sub.status === 'pending' || sub.status === 'submitted') statusColor = "bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]";

                      return (
                        <tr key={sub.id} className="group hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-all duration-300 relative cursor-pointer" onClick={() => handleView(sub)}>
                          <td className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full transition-all ${statusColor}`} />

                          <td className="px-6 py-4 font-mono text-xs text-gray-500">
                            {new Date(sub.created_at).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 font-medium text-gray-900 dark:text-gray-200">
                            {sub.subject_code || "—"}
                          </td>
                          <td className="px-6 py-4 max-w-[200px]" title={sub.practical_title}>
                            <div className="font-medium text-gray-800 dark:text-gray-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{sub.practical_title}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-1.5">
                              <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${getLanguageColor(sub.language)}`}></div>
                              <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wide">
                                {sub.language}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge status={sub.status} />
                          </td>
                          <td className="px-6 py-4">
                            {sub.marks_obtained !== null ? (
                              <span className="flex items-center gap-1.5 text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/30 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 w-fit shadow-sm">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                                {sub.marks_obtained}/10
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-80 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0 rounded-full text-gray-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-indigo-900/30 hover:shadow-md transition-all"
                                onClick={(e) => { e.stopPropagation(); handleDownloadPdf(sub); }}
                                disabled={pdfLoading}
                                title="Download Report"
                              >
                                {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-3 rounded-full text-xs font-semibold text-indigo-600 bg-indigo-50/50 dark:bg-indigo-900/10 hover:bg-indigo-500 hover:text-white transition-all shadow-sm hover:shadow-indigo-500/25"
                              >
                                View
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        </main>
      </div>

      {/* Detail Modal */}
      {viewingSubmission && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md animate-fadeIn">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="glass-card-premium rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xl"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
              <div className="flex items-center gap-5">
                <div
                  className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${getLanguageColor(viewingSubmission.language)} text-white flex items-center justify-center font-bold shadow-lg shadow-indigo-500/20`}
                >
                  <Code2 className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                    {viewingSubmission.practical_title}
                  </h3>
                  <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                    <StatusBadge status={viewingSubmission.status} />
                    {viewingSubmission.marks_obtained !== null && (
                      <>
                        <span className="text-gray-300">•</span>
                        <span className="flex items-center gap-1 font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-md border border-indigo-100 dark:border-indigo-800/50">
                          <Sparkles className="w-3.5 h-3.5" />
                          {viewingSubmission.marks_obtained} / 10
                        </span>
                      </>
                    )}
                    <span className="text-gray-300">•</span>
                    <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-400">
                      {new Date(viewingSubmission.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setViewingSubmission(null)}
                className="rounded-full w-10 h-10 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 bg-gray-50/50 dark:bg-gray-950/50">
              {/* Left: Code */}
              <div className="space-y-6 flex flex-col min-h-0">
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm flex-1 flex flex-col group hover:shadow-md transition-shadow">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between flex-shrink-0">
                    <h4 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                      <Code className="w-4 h-4 text-indigo-500" /> Submitted Code
                    </h4>
                    <span className="text-[10px] font-bold tracking-wider px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase border border-gray-200 dark:border-gray-600">
                      {viewingSubmission.language}
                    </span>
                  </div>
                  <div className="p-0 overflow-auto flex-1 relative">
                    <pre className="p-5 text-xs sm:text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
                      {viewingSubmission.code}
                    </pre>
                  </div>
                </div>
              </div>

              {/* Right: Output & Test Cases */}
              <div className="space-y-6 flex flex-col min-h-0">
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm flex-shrink-0 group hover:shadow-md transition-shadow">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                    <h4 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-purple-500" /> Standard Output
                    </h4>
                  </div>
                  <div className="p-4 bg-gray-900 text-gray-300 font-mono text-xs sm:text-sm max-h-[200px] overflow-auto whitespace-pre-wrap">
                    {viewingSubmission.output || (
                      <span className="opacity-50 italic">No output captured</span>
                    )}
                  </div>
                </div>

                {/* Test Cases Results (Simplified) */}
                {viewingSubmission.testCaseResults && viewingSubmission.testCaseResults.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm flex-1 flex flex-col group hover:shadow-md transition-shadow">
                    <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                      <h4 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Test Case Results
                      </h4>
                    </div>
                    <div className="p-4 overflow-y-auto space-y-3">
                      {viewingSubmission.testCaseResults.map((tc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Test Case #{idx + 1}</span>
                          <StatusBadge status={tc.status} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

export default function StudentSubmissionsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <StudentSubmissionsPageContent />
    </Suspense>
  );
}
