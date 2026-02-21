"use client";

import React, {
  useEffect,
  useState,
  useCallback,
  Suspense,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams, useRouter } from "next/navigation";
import { generatePdfClient } from "@/lib/ClientPdf";
import { generateSubjectReport } from "@/lib/SubjectReportPdf";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Search as SearchIcon,
  LayoutGrid,
  BarChart3,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import StatCard from "@/components/dashboard/student/StatCard";
import SubmissionsSidebar from "./SubmissionsSidebar";
import GradingSheet, { ViewingSubmission } from "./GradingSheet";
import SubjectReportView from "./SubjectReportView";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { toast } from "sonner";

// Animation Variants
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

// Interfaces (aligned with GradingSheet)
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
  roll_no?: string;
  is_locked?: boolean;
  attempt_count?: number;
  max_attempts?: number;
  testCaseResults?: any[];
}

interface TestCase {
  id: number;
  practical_id: number;
  input: string;
  expected_output: string;
  is_hidden: boolean;
}

function FacultySubmissionsContentInner() {
  const [supabase] = useState(() => createClient());
  const searchParams = useSearchParams();
  const router = useRouter();

  // Data State
  const [subjects, setSubjects] = useState<any[]>([]); // Hierarchy
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [, setTestCases] = useState<TestCase[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Selection State (Master-Detail)
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedPracticalId, setSelectedPracticalId] = useState<number | null>(null);

  // UI State
  const [query, setQuery] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [viewingSubmission, setViewingSubmission] = useState<ViewingSubmission | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [, setPdfLoadingId] = useState<number | null>(null);

  // Bulk Selection
  const [selectedSubmissionIds, setSelectedSubmissionIds] = useState<Set<number>>(new Set());

  // Inline Grading State
  const [, setGradingLoadingId] = useState<number | null>(null);

  // Report Generation State
  const [reportLoading, setReportLoading] = useState(false);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [isReportViewOpen, setIsReportViewOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [reportData, setReportData] = useState<{
    subjectName: string;
    subjectCode: string;
    practicalTitles: string[];
    practicalDeadlines: (string | null)[];
    students: {
      student_name: string;
      roll_no: string;
      practicals: { title: string; marks: number | null }[];
    }[];
  } | null>(null);

  const handleSelectSubject = (id: number | null) => {
    setSelectedSubjectId(id);
    setSelectedPracticalId(null);
    // Clear URL params when changing subject (or selecting 'All')
    router.replace('/faculty/submissions');
  }

  const handleSelectPractical = (id: number | null) => {
    setSelectedPracticalId(id);
    if (id) {
      router.replace(`/faculty/submissions?practical=${id}`);
    } else {
      router.replace('/faculty/submissions');
    }
  }


  // 1. Fetch Subjects Hierarchy (Sidebar Data)
  useEffect(() => {
    const fetchHierarchy = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get subjects for faculty
      const { data: facultyBatches } = await supabase
        .from("subject_faculty_batches")
        .select("subject_id")
        .eq("faculty_id", user.id);

      const subjectIds = [...new Set((facultyBatches || []).map((fb: any) => fb.subject_id))];

      if (subjectIds.length === 0) return;

      const { data: subjectsDataPlain } = await supabase
        .from("subjects")
        .select(`
          id, 
          subject_name, 
          subject_code, 
          practicals (id, title)
        `)
        .in("id", subjectIds)
        .order("subject_name");

      // Format for sidebar
      const formatted = (subjectsDataPlain || []).map((s: any) => ({
        ...s,
        practicals: s.practicals || [],
      }));

      setSubjects(formatted);

      // Handle URL params for initial selection
      const paramPracticalId = searchParams.get("practical");
      if (paramPracticalId) {
        const pid = parseInt(paramPracticalId);
        setSelectedPracticalId(pid);
        // Find subject for this practical
        const subj = formatted.find((s: any) => s.practicals.some((p: any) => p.id === pid));
        if (subj) setSelectedSubjectId(subj.id);
      }
    };

    fetchHierarchy();
  }, [supabase, searchParams]);


  // 2. Fetch Submissions based on Selection
  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      let queryBuilder = supabase
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
            execution_details,
            practicals ( title, subject_id )
        `)
        .order("created_at", { ascending: false });

      if (selectedPracticalId) {
        queryBuilder = queryBuilder.eq("practical_id", selectedPracticalId);
      } else if (selectedSubjectId) {
        // Find all practical IDs for this subject
        const subject = subjects.find(s => s.id === selectedSubjectId);
        if (subject) {
          const pIds = subject.practicals.map((p: any) => p.id);
          if (pIds.length > 0) {
            queryBuilder = queryBuilder.in("practical_id", pIds);
          } else {
            setSubmissions([]);
            setLoading(false);
            return;
          }
        }
      } else {
        // "All Submissions" - maybe limit or filter by faculty's subjects
        const allPracticalIds = subjects.flatMap(s => s.practicals.map((p: any) => p.id));
        if (allPracticalIds.length > 0) {
          queryBuilder = queryBuilder.in("practical_id", allPracticalIds);
        } else {
          setSubmissions([]);
          setLoading(false);
          return;
        }
      }

      const { data, error } = await queryBuilder;
      if (error) throw error;

      // Enrich with Student Info (Name, Roll No)
      const studentIds = [...new Set(((data || []) as any[]).map(s => s.student_id).filter((id): id is string => id !== null))];
      const { data: students } = await supabase
        .from("users")
        .select("uid, name, roll_no")
        .in("uid", studentIds);

      const studentMap = new Map((students as any[])?.map(s => [s.uid, s]));

      const formatted: Submission[] = ((data || []) as any[]).map((s: any) => ({
        id: s.id,
        submission_id: s.id,
        student_id: s.student_id,
        student_name: studentMap.get(s.student_id)?.name || "Unknown",
        roll_no: studentMap.get(s.student_id)?.roll_no || "N/A",
        practical_id: s.practical_id,
        practical_title: s.practicals?.title || "Unknown",
        code: s.code,
        output: s.output,
        language: s.language,
        status: s.status,
        marks_obtained: s.marks_obtained,
        created_at: s.created_at,
        testCaseResults: s.execution_details?.results || [],
      }));

      setSubmissions(formatted);
    } catch (err) {
      console.error("Error fetching submissions:", err);
    } finally {
      setLoading(false);
    }
  }, [supabase, selectedPracticalId, selectedSubjectId, subjects]);

  useEffect(() => {
    if (subjects.length > 0) {
      fetchSubmissions();
    }
  }, [fetchSubmissions, subjects.length]);

  // Fetch test cases when viewing a submission
  const loadTestCases = async (practicalId: number) => {
    const { data } = await supabase
      .from("test_cases")
      .select("*")
      .eq("practical_id", practicalId)
      .order("id");
    // Cast to our TestCase interface, filtering out any with null practical_id
    const validTestCases: TestCase[] = ((data || []) as any[]).filter(
      (tc): tc is typeof tc & { practical_id: number; is_hidden: boolean } =>
        tc.practical_id !== null
    ).map((tc: any) => ({
      id: tc.id,
      practical_id: tc.practical_id,
      input: tc.input,
      expected_output: tc.expected_output,
      is_hidden: tc.is_hidden ?? false,
    }));
    setTestCases(validTestCases);
  };

  const handleOpenSheet = async (sub: Submission) => {
    await loadTestCases(sub.practical_id);
    setViewingSubmission({ ...sub, testCaseResults: sub.testCaseResults }); // cast to ViewingSubmission
    setIsSheetOpen(true);
  };



  // Inline Grading logic
  const handleInlineGrade = async (submissionId: number, marks: string) => {
    const marksNum = parseInt(marks);
    if (isNaN(marksNum) || marksNum < 0 || marksNum > 10) return;

    setGradingLoadingId(submissionId);
    try {
      const { error } = await supabase
        .from("submissions")
        .update({
          marks_obtained: marksNum,
          status: marksNum >= 5 ? 'passed' : 'failed'
        } as never)
        .eq("id", submissionId);

      if (error) throw error;
      toast.success("Grade saved!");
      fetchSubmissions(); // refresh
    } catch (e) {
      toast.error("Failed to save grade");
    } finally {
      setGradingLoadingId(null);
    }
  }

  const handleSheetSave = async (sid: number, marks: number, status: string) => {
    const { error } = await supabase
      .from("submissions")
      .update({
        marks_obtained: marks,
        status: status as "passed" | "failed" | "pending" | "submitted"
      } as never)
      .eq("id", sid);

    if (!error) {
      toast.success("Graded successfully");
      fetchSubmissions();
      // Optional: Move to next or close
      // setIsSheetOpen(false);
    }
  }

  // Generate Subject Report PDF
  const handleDownloadSubjectReport = async () => {
    if (!selectedSubjectId) return;

    const subject = subjects.find(s => s.id === selectedSubjectId);
    if (!subject) return;

    setReportLoading(true);
    try {
      // 1. Get current faculty user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");

      // 2. Get batches assigned to this faculty for this subject
      const { data: facultyBatches } = await supabase
        .from("subject_faculty_batches")
        .select("batch")
        .eq("subject_id", selectedSubjectId)
        .eq("faculty_id", user.id);

      const batches = [...new Set(((facultyBatches || []) as any[]).map(b => b.batch))];
      const hasAllBatch = batches.includes("All");

      // 3. Get all practicals for this subject
      const practicalIds = subject.practicals.map((p: any) => p.id);
      const practicalTitles = subject.practicals.map((p: any) => p.title);
      // Fetch deadlines as well - deadline column removed, passing null
      const practicalDeadlines = subject.practicals.map((p: any) => null);

      // 4. Fetch all submissions for these practicals
      const { data: allSubmissions } = await supabase
        .from("submissions")
        .select("student_id, practical_id, marks_obtained")
        .in("practical_id", practicalIds);

      // Get unique student IDs from submissions
      const submitterIds = [...new Set(((allSubmissions || []) as any[]).map(s => s.student_id).filter(id => id !== null))];

      // 5. Fetch students (Both from batches AND from submissions to be safe)
      const studentQuery = supabase
        .from("users")
        .select("uid, name, roll_no, batch")
        .eq("role", "student");

      const { data: allStudents } = await studentQuery; // Ensure variable usage if needed, but logic below handles it

      // Filter in memory to avoid complex OR query
      let students: any[] = [];

      if (hasAllBatch) {
        const { data } = await supabase.from("users").select("uid, name, roll_no").eq("role", "student");
        students = data || [];
      } else {
        let batchStudents: any[] = [];
        if (batches.length > 0) {
          const { data } = await supabase.from("users").select("uid, name, roll_no").eq("role", "student").in("batch", batches);
          batchStudents = data || [];
        }

        const missingSubmitters = submitterIds.filter(id => !batchStudents.some(s => s.uid === id));
        let extraStudents: any[] = [];
        if (missingSubmitters.length > 0) {
          const { data } = await supabase.from("users").select("uid, name, roll_no").in("uid", missingSubmitters);
          extraStudents = data || [];
        }

        students = [...batchStudents, ...extraStudents];
        students = Array.from(new Map(students.map(s => [s.uid, s])).values());
      }

      students.sort((a, b) => (a.roll_no || "").localeCompare(b.roll_no || ""));

      // 6. Build the report data structure
      const reportStudents = students.map(student => {
        const practicals = practicalIds.map((pid: number) => {
          const submission = ((allSubmissions || []) as any[]).find(
            s => s.student_id === student.uid && s.practical_id === pid
          );
          return {
            title: subject.practicals.find((p: any) => p.id === pid)?.title || "",
            marks: submission?.marks_obtained ?? null,
          };
        });

        return {
          student_name: student.name || "Unknown",
          roll_no: student.roll_no || "N/A",
          practicals,
        };
      });

      setReportData({
        subjectName: subject.subject_name,
        subjectCode: subject.subject_code,
        practicalTitles,
        practicalDeadlines,
        students: reportStudents,
      });
      setIsReportViewOpen(true);
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error("Failed to load report data");
    } finally {
      setReportLoading(false);
    }
  };

  // Download PDF from report view
  const handleDownloadReportPdf = async () => {
    if (!reportData) return;
    await generateSubjectReport({
      ...reportData,
      practicalDeadlines: reportData.practicalDeadlines
    });
    toast.success("Report downloaded!");
  };

  // Bulk Actions
  const handleBulkAction = async (action: 'pass' | 'reattempt') => {
    if (selectedSubmissionIds.size === 0) return;

    setBulkActionLoading(true);
    try {
      if (action === 'pass') {
        const { error } = await supabase
          .from("submissions")
          .update({ status: 'passed' as const, marks_obtained: 10 } as never)
          .in("id", Array.from(selectedSubmissionIds));
        if (error) throw error;
      } else {
        // For reattempt: call the allow-reattempt API for each selected submission
        const selectedSubs = submissions.filter(s => selectedSubmissionIds.has(s.id));
        const results = await Promise.allSettled(
          selectedSubs.map(sub =>
            fetch("/api/faculty/allow-reattempt", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                studentId: sub.student_id,
                practicalId: sub.practical_id,
                reason: "Faculty granted re-attempt (bulk action)",
              }),
            }).then(res => res.json())
          )
        );
        const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success));
        if (failed.length > 0) {
          toast.warning(`${results.length - failed.length}/${results.length} re-attempts granted`);
        }
      }

      toast.success(action === 'pass' ? "Marked as passed" : "Re-attempt granted — max_attempts increased");
      setSelectedSubmissionIds(new Set());
      fetchSubmissions();
    } catch (error) {
      console.error("Bulk action failed:", error);
      toast.error("Failed to perform action");
    } finally {
      setBulkActionLoading(false);
    }
  };

  // Per-student allow re-attempt
  const handleAllowReattempt = async (sub: Submission) => {
    try {
      const res = await fetch("/api/faculty/allow-reattempt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: sub.student_id,
          practicalId: sub.practical_id,
          reason: "Faculty granted re-attempt",
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(`Re-attempt granted (max attempts: ${data.newMaxAttempts})`);
      fetchSubmissions();
    } catch (err: any) {
      console.error("Allow re-attempt failed:", err);
      toast.error(err.message || "Failed to grant re-attempt");
    }
  };

  // Filter Submissions locally
  const filteredSubmissions = submissions.filter((s) => {
    const matchesQuery = s.student_name.toLowerCase().includes(query.toLowerCase()) ||
      s.roll_no?.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = filterStatus === 'all' || s.status === filterStatus;
    return matchesQuery && matchesStatus;
  });

  const stats = {
    total: submissions.length,
    passed: submissions.filter(s => s.status === 'passed').length,
    failed: submissions.filter(s => s.status === 'failed').length,
    pending: submissions.filter(s => ['pending', 'submitted'].includes(s.status)).length,
  };

  // Bulk Actions
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSubmissionIds(new Set(filteredSubmissions.map(s => s.id)));
    } else {
      setSelectedSubmissionIds(new Set());
    }
  }

  const toggleSelection = (id: number) => {
    const next = new Set(selectedSubmissionIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedSubmissionIds(next);
  }

  // Next/Prev Logic for Sheet
  const currentIndex = viewingSubmission
    ? filteredSubmissions.findIndex(s => s.id === viewingSubmission.id)
    : -1;
  const hasNext = currentIndex >= 0 && currentIndex < filteredSubmissions.length - 1;
  const hasPrev = currentIndex > 0;

  const handleNext = () => {
    if (hasNext) handleOpenSheet(filteredSubmissions[currentIndex + 1]);
  }

  const handlePrev = () => {
    if (hasPrev) handleOpenSheet(filteredSubmissions[currentIndex - 1]);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 dark:from-gray-950 dark:via-indigo-950/10 dark:to-purple-950/10 flex flex-col md:flex-row pt-16">
      {/* Sidebar - Master View */}
      <div className="w-full md:w-64 lg:w-72 flex-shrink-0 md:h-[calc(100vh-4rem)] md:sticky md:top-16 md:border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 z-20 hidden md:block overflow-y-auto">
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
              onSelectSubject={(id) => {
                handleSelectSubject(id);
              }}
              onSelectPractical={(id) => {
                handleSelectPractical(id);
                setIsMobileSidebarOpen(false); // Close on practical selection
              }}
              className="border-none bg-transparent"
            />
          </SheetContent>
        </Sheet>
        <h2 className="font-semibold text-gray-900 dark:text-white">faculty/submissions</h2>
      </div>

      {/* Main Content - Detail View */}
      <div className="flex-1 min-w-0">
        <main className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">

          {/* Header */}
          <motion.div
            variants={shellVariants}
            initial="hidden"
            animate="visible"
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                {selectedPracticalId
                  ? subjects.flatMap(s => s.practicals).find((p: any) => p.id === selectedPracticalId)?.title
                  : selectedSubjectId
                    ? subjects.find(s => s.id === selectedSubjectId)?.subject_name
                    : "All Submissions"
                }
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-500 mt-1 font-medium">
                {selectedSubjectId && <span className="text-indigo-600 dark:text-indigo-400 font-bold">
                  {subjects.find(s => s.id === selectedSubjectId)?.subject_code}
                </span>}
                {selectedSubjectId && <span className="text-gray-300">•</span>}
                <span>{filteredSubmissions.length} submissions found</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* View Subject Report */}
              {selectedSubjectId && (
                <Button
                  size="sm"
                  className="h-10 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 transition-all duration-300 font-semibold rounded-xl"
                  onClick={handleDownloadSubjectReport}
                  disabled={reportLoading}
                >
                  <BarChart3 className="w-4 h-4" />
                  {reportLoading ? "Loading..." : "View Report"}
                </Button>
              )}
              {/* Search */}
              <div className="relative group">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search students..."
                  className="pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white/60 dark:bg-gray-900/60 backdrop-blur-md text-sm w-64 focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 outline-none shadow-sm hover:shadow transition-all duration-200"
                />
              </div>
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
              icon={XCircle}
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
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-4 bg-white/40 dark:bg-gray-900/40 backdrop-blur-md">
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                {['all', 'pending', 'passed', 'failed'].map(status => (
                  <button
                    key={status}
                    onClick={() => setFilterStatus(status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors whitespace-nowrap ${filterStatus === status
                      ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400'
                      : 'text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                  >
                    {status}
                  </button>
                ))}
              </div>
              {/* Bulk Actions Toolbar (Visible when selected) */}
              {selectedSubmissionIds.size > 0 && (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400 mr-2 hidden sm:inline">
                    {selectedSubmissionIds.size} selected
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100 hover:text-emerald-700 hover:border-emerald-300 transition-colors"
                    onClick={() => handleBulkAction('pass')}
                    disabled={bulkActionLoading}
                  >
                    {bulkActionLoading ? "Processing..." : "Mark Passed"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-colors"
                    onClick={() => handleBulkAction('reattempt')}
                    disabled={bulkActionLoading}
                  >
                    {bulkActionLoading ? "Processing..." : "Grant Re-attempt"}
                  </Button>
                </div>
              )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-gray-500 uppercase bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    <th className="px-4 py-3 w-[40px]">
                      <Checkbox
                        checked={filteredSubmissions.length > 0 && selectedSubmissionIds.size === filteredSubmissions.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </th>
                    <th className="px-4 py-3">Student</th>
                    {/* Conditionally hide Practical column if single practical selected */}
                    {!selectedPracticalId && <th className="px-4 py-3">Practical</th>}
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 w-[120px]">Marks</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {loading ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-500">
                        Loading...
                      </td>
                    </tr>
                  ) : filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-500">
                        No submissions found
                      </td>
                    </tr>
                  ) : (
                    filteredSubmissions.map((sub) => (
                      <motion.tr
                        key={sub.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                        onClick={() => handleOpenSheet(sub)}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedSubmissionIds.has(sub.id)}
                            onCheckedChange={() => toggleSelection(sub.id)}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs ring-2 ring-white dark:ring-gray-900">
                              {/* Initials could be better */}
                              {sub.student_name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900 dark:text-white">{sub.student_name}</div>
                              <div className="text-xs text-gray-500 font-mono">{sub.roll_no}</div>
                            </div>
                          </div>
                        </td>
                        {!selectedPracticalId && (
                          <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-[200px] truncate" title={sub.practical_title}>
                            {sub.practical_title}
                          </td>
                        )}
                        <td className="px-4 py-3">
                          {/* Traffic Light Status Bar */}
                          <div className="flex items-center gap-2">
                            <div className={`w-1.5 h-8 rounded-full ${sub.status === 'passed' ? 'bg-emerald-500' :
                              sub.status === 'failed' ? 'bg-red-500' :
                                'bg-amber-400'
                              }`} />
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded uppercase ${sub.status === 'passed' ? 'text-emerald-700 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20' :
                              sub.status === 'failed' ? 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/20' :
                                'text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20'
                              }`}>
                              {sub.status}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                          {/* Marks Input / Display */}
                          {sub.status === 'passed' || sub.status === 'failed' ? (
                            <span className="font-mono font-bold text-gray-900 dark:text-white">
                              {sub.marks_obtained}/10
                            </span>
                          ) : (
                            <input
                              className="w-12 px-2 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                              placeholder="-"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleInlineGrade(sub.id, e.currentTarget.value);
                                }
                              }}
                            />
                          )}
                        </td>
                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            {sub.status === 'failed' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="gap-1.5 text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40"
                                onClick={() => handleAllowReattempt(sub)}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Re-attempt
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40"
                            >
                              Grade
                            </Button>
                          </div>
                        </td>
                      </motion.tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination / Footer can go here */}
          </motion.div>
        </main>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="w-[90vw] sm:max-w-xl p-0 border-l border-gray-200 dark:border-gray-800">
          {viewingSubmission && (
            <GradingSheet
              isOpen={isSheetOpen}
              onClose={() => setIsSheetOpen(false)}
              submission={viewingSubmission}
              testCases={[]}
              onSaveGrade={handleSheetSave}
              onNext={hasNext ? handleNext : undefined}
              onPrev={hasPrev ? handlePrev : undefined}
              hasNext={hasNext}
              hasPrev={hasPrev}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Report Modal */}
      {isReportViewOpen && reportData && (
        <SubjectReportView
          isOpen={isReportViewOpen}
          onClose={() => setIsReportViewOpen(false)}
          {...reportData}
          onDownloadPdf={handleDownloadReportPdf}
        />
      )}

    </div>
  );
}

export default function FacultySubmissionsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <FacultySubmissionsContentInner />
    </Suspense>
  );
}
