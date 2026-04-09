"use client";

import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  Suspense,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useSearchParams, useRouter } from "next/navigation";
import { generatePdfClient } from "@/lib/ClientPdf";
import { generateSubjectReport } from "@/lib/SubjectReportPdf";
import {
  Search as SearchIcon,
  LayoutGrid,
  BarChart3,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import SubmissionsSidebar from "./SubmissionsSidebar";
import GradingSheet, { ViewingSubmission } from "./GradingSheet";
import SubjectReportView from "./SubjectReportView";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Menu } from "lucide-react";
import { toast } from "sonner";

const shellVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.3 },
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
  code?: string;
  output?: string;
  language: string;
  status: string;
  marks_obtained: number | null;
  created_at: string;
  roll_no?: string;
  is_locked?: boolean;
  attempt_count?: number;
  max_attempts?: number;
  testCaseResults?: any[];
  level_id?: number | null;
  level_title?: string | null;
  level_max_marks?: number | null;
  assigned_set_name?: string | null;
}

interface GroupedSubmission {
  key: string; // student_id + practical_id
  student_id: string;
  student_name: string;
  roll_no: string;
  practical_id: number;
  practical_title: string;
  submissions: Submission[];
  totalMarks: number | null;
  totalMaxMarks: number;
  overallStatus: string;
  latestDate: string;
  attempt_count: number;
  max_attempts: number;
  assigned_set_name?: string | null;
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

  // Expanded Groups State (for grouped submissions)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

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
    practicalMaxMarks: number[];
    students: {
      student_name: string;
      roll_no: string;
      practicals: { title: string; marks: number | null; maxMarks: number }[];
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


  // Keep URL-driven practical selection in sync.
  useEffect(() => {
    const paramPracticalId = searchParams.get("practical");
    if (!paramPracticalId) return;

    const parsed = Number(paramPracticalId);
    if (Number.isFinite(parsed) && parsed > 0) {
      setSelectedPracticalId(parsed);
    }
  }, [searchParams]);

  // Fetch hierarchy + submissions through one server API call.
  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedPracticalId) {
        params.set("practicalId", String(selectedPracticalId));
      } else if (selectedSubjectId) {
        params.set("subjectId", String(selectedSubjectId));
      }

      const endpoint =
        params.size > 0
          ? `/api/faculty/submissions?${params.toString()}`
          : "/api/faculty/submissions";

      const response = await fetch(endpoint, { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Failed to fetch submissions");
      }

      const nextSubjects = Array.isArray(payload?.subjects)
        ? payload.subjects
        : [];
      const nextSubmissions = Array.isArray(payload?.submissions)
        ? payload.submissions
        : [];

      setSubjects(nextSubjects);
      setSubmissions(nextSubmissions);

      if (selectedPracticalId && !selectedSubjectId) {
        const subjectForPractical = nextSubjects.find((subject: any) =>
          (subject?.practicals || []).some(
            (practical: any) => Number(practical?.id) === Number(selectedPracticalId),
          ),
        );

        if (subjectForPractical?.id) {
          setSelectedSubjectId(Number(subjectForPractical.id));
        }
      }
    } catch (err) {
      console.error("Error fetching submissions:", err);
      toast.error("Failed to load submissions");
      setSubmissions([]);
    } finally {
      setLoading(false);
    }
  }, [selectedPracticalId, selectedSubjectId]);

  useEffect(() => {
    void fetchSubmissions();
  }, [fetchSubmissions]);

  const handleOpenSheet = async (sub: Submission) => {
    try {
      const response = await fetch(`/api/faculty/submissions/${sub.id}`, {
        cache: "no-store",
      });
      const payload = await response.json();

      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "Failed to load submission detail");
      }

      const detailSubmission: ViewingSubmission = payload.submission;
      const detailTestCases: TestCase[] = Array.isArray(payload.testCases)
        ? payload.testCases
        : [];

      setTestCases(detailTestCases);
      setViewingSubmission(detailSubmission);
      setIsSheetOpen(true);
    } catch (err) {
      console.error("Error opening grading sheet:", err);
      toast.error("Failed to open submission details");
    }
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
          status: (() => {
            const pct = (marksNum / 10) * 100;
            if (pct >= 90) return 'excellent';
            if (pct >= 75) return 'very_good';
            if (pct >= 60) return 'good';
            if (pct >= 40) return 'needs_improvement';
            return 'poor';
          })()
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
        status: status
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
      // 1. Resolve subject semester for semester-wise student filtering.
      const { data: subjectMeta, error: subjectMetaErr } = await supabase
        .from("subjects")
        .select("semester")
        .eq("id", selectedSubjectId)
        .maybeSingle();

      if (subjectMetaErr) throw subjectMetaErr;

      const subjectSemester = String((subjectMeta as any)?.semester || "").trim();
      if (!subjectSemester) {
        toast.error("Selected subject has no semester configured.");
        return;
      }

      // 2. Subject-wise report: include all practicals in the selected subject.
      const scopedPracticals = (() => {
        const available = (subject.practicals || []).filter(
          (p: any) => Number.isFinite(Number(p?.id)) && Number(p.id) > 0,
        );
        return available;
      })();

      if (scopedPracticals.length === 0) {
        toast.error("No matching practical found for this subject.");
        return;
      }

      const practicalIds = scopedPracticals.map((p: any) => Number(p.id));
      const practicalTitles = scopedPracticals.map((p: any) => String(p.title || ""));
      const practicalDeadlines = scopedPracticals.map(() => null);

      // 3. Fetch submissions and practical level marks.
      const [submissionsRes, practicalLevelsRes] = await Promise.all([
        supabase
          .from("submissions")
          .select("student_id, practical_id, marks_obtained")
          .in("practical_id", practicalIds),
        supabase
          .from("practical_levels")
          .select("practical_id, max_marks")
          .in("practical_id", practicalIds),
      ]);

      if (submissionsRes.error) throw submissionsRes.error;
      if (practicalLevelsRes.error) throw practicalLevelsRes.error;

      const allSubmissions = (submissionsRes.data || []) as any[];
      const practicalLevels = (practicalLevelsRes.data || []) as any[];

      // 4. Build report student scope:
      // subject-semester students + students with submissions + students assigned to practical/exam.
      const { data: semesterStudents, error: semesterStudentsErr } = await supabase
        .from("users")
        .select("uid, name, roll_no")
        .eq("role", "student")
        .eq("semester", subjectSemester);

      if (semesterStudentsErr) throw semesterStudentsErr;

      const { data: practicalAssignments, error: practicalAssignmentsErr } = await supabase
        .from("student_practicals")
        .select("student_id")
        .in("practical_id", practicalIds);

      if (practicalAssignmentsErr) throw practicalAssignmentsErr;

      const { data: examsData, error: examsDataErr } = await (supabase.from("exams") as any)
        .select("id, practical_id")
        .in("practical_id", practicalIds);

      if (examsDataErr) throw examsDataErr;

      const examIds = ((examsData || []) as any[]).map((e: any) => e.id);

      let examAssignedStudentIds: string[] = [];
      if (examIds.length > 0) {
        const { data: examAssignedSessions, error: examAssignedSessionsErr } = await (supabase
          .from("exam_sessions") as any)
          .select("student_id")
          .in("exam_id", examIds);

        if (examAssignedSessionsErr) throw examAssignedSessionsErr;

        examAssignedStudentIds = [
          ...new Set(
            ((examAssignedSessions || []) as any[])
              .map((row: any) => String(row.student_id || ""))
              .filter((id: string) => id.length > 0),
          ),
        ];
      }

      const submitterIds = [
        ...new Set(
          allSubmissions
            .map((s: any) => String(s.student_id || ""))
            .filter((id: string) => id.length > 0),
        ),
      ];

      const practicalAssignedStudentIds = [
        ...new Set(
          ((practicalAssignments || []) as any[])
            .map((row: any) => String(row.student_id || ""))
            .filter((id: string) => id.length > 0),
        ),
      ];

      let students = (semesterStudents || []) as any[];
      const knownStudentIdSet = new Set(
        students.map((s: any) => String(s.uid || "")),
      );

      const additionalStudentIds = [
        ...new Set([
          ...submitterIds,
          ...practicalAssignedStudentIds,
          ...examAssignedStudentIds,
        ]),
      ].filter(
        (id: string) => id.length > 0 && !knownStudentIdSet.has(id),
      );

      if (additionalStudentIds.length > 0) {
        const { data: additionalStudents, error: additionalStudentsErr } = await supabase
          .from("users")
          .select("uid, name, roll_no")
          .eq("role", "student")
          .in("uid", additionalStudentIds);

        if (additionalStudentsErr) throw additionalStudentsErr;

        students = [
          ...students,
          ...((additionalStudents || []) as any[]),
        ];
      }

      const dedupedStudents = new Map<string, any>();
      students.forEach((s: any) => {
        const uid = String(s.uid || "");
        if (!uid) return;
        dedupedStudents.set(uid, s);
      });
      students = Array.from(dedupedStudents.values());

      const maxMarksByPractical = new Map<number, number>();
      practicalIds.forEach((pid: number) => {
        const levels = (practicalLevels || []).filter((l: any) => l.practical_id === pid);
        if (levels.length > 0) {
          maxMarksByPractical.set(pid, levels.reduce((sum: number, l: any) => sum + (l.max_marks || 10), 0));
        } else {
          maxMarksByPractical.set(pid, 10); // Standard single practical
        }
      });

      const maxMarksBySession = new Map<string, number>(); // studentId_practicalId -> max_marks

      const visibleStudentIds = new Set(students.map((s: any) => String(s.uid || "")));

      if (examsData && examsData.length > 0 && visibleStudentIds.size > 0) {
        const examPracticalMap = new Map<string, number>(examsData.map((e: any) => [e.id, e.practical_id]));

        const { data: sessionsData } = await (supabase.from("exam_sessions") as any)
          .select(`
            student_id, 
            exam_id, 
            assigned_set_id, 
            exam_question_sets ( 
              exam_set_levels ( 
                practical_levels ( max_marks ) 
              ) 
            )
          `)
          .in("exam_id", examIds)
          .in("student_id", Array.from(visibleStudentIds));

        (sessionsData || []).forEach((sess: any) => {
          const practicalId = examPracticalMap.get(sess.exam_id);
          if (practicalId !== undefined && sess.exam_question_sets?.exam_set_levels) {
            const setLevels = sess.exam_question_sets.exam_set_levels;
            const setMaxMarks = setLevels.reduce((sum: number, sl: any) => sum + (sl.practical_levels?.max_marks || 0), 0);
            if (setMaxMarks > 0) {
              maxMarksBySession.set(`${sess.student_id}_${practicalId}`, setMaxMarks);
            }
          }
        });
      }

      students.sort((a, b) => (a.roll_no || "").localeCompare(b.roll_no || ""));

      const visibleSubmissions = allSubmissions.filter((sub: any) =>
        visibleStudentIds.has(String(sub.student_id || "")),
      );

      // 6. Build the report data structure
      const reportStudents = students.map(student => {
        const practicals = practicalIds.map((pid: number) => {
          const studentSubs = visibleSubmissions.filter(
            s => s.student_id === student.uid && s.practical_id === pid
          );
          
          let marks: number | null = null;
          if (studentSubs.length > 0) {
            marks = studentSubs.reduce((sum, sub) => sum + (sub.marks_obtained || 0), 0);
          }

          // Use assigned set max marks if available (for exams), else fallback to global practical max marks
          const studentSessionMaxMarks = maxMarksBySession.get(`${student.uid}_${pid}`);
          const maxMarksForPid = studentSessionMaxMarks || maxMarksByPractical.get(pid) || 10;

          return {
            title: subject.practicals.find((p: any) => p.id === pid)?.title || "",
            marks,
            maxMarks: maxMarksForPid
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
        practicalMaxMarks: practicalIds.map((pid: number) => maxMarksByPractical.get(pid) || 10),
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
          .update({ status: 'excellent' as const, marks_obtained: 10 } as never)
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

  // Group submissions by student + practical FIRST (before filtering)
  const allGroupedSubmissions = useMemo<GroupedSubmission[]>(() => {
    const map = new Map<string, GroupedSubmission>();

    submissions.forEach((sub) => {
      const key = `${sub.student_id}_${sub.practical_id}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          student_id: sub.student_id,
          student_name: sub.student_name,
          roll_no: sub.roll_no || 'N/A',
          practical_id: sub.practical_id,
          practical_title: sub.practical_title,
          submissions: [],
          totalMarks: null,
          totalMaxMarks: 0,
          overallStatus: 'pending',
          latestDate: sub.created_at,
          attempt_count: sub.attempt_count || 0,
          max_attempts: sub.max_attempts || 1,
          assigned_set_name: sub.assigned_set_name || null,
        });
      }
      const group = map.get(key)!;
      group.submissions.push(sub);
      if (sub.created_at > group.latestDate) {
        group.latestDate = sub.created_at;
      }
    });

    // Calculate aggregated status and marks
    map.forEach((group) => {
      const subs = group.submissions;
      // Sort by level title
      subs.sort((a, b) => (a.level_title || '').localeCompare(b.level_title || ''));

      const hasLevels = subs.some(s => s.level_id);
      if (hasLevels) {
        // Multi-task: aggregate marks
        let totalMarks = 0;
        let totalMaxMarks = 0;
        let allPassed = true;
        let anyFailed = false;
        let allGraded = true;

        subs.forEach(s => {
          totalMaxMarks += s.level_max_marks || 10;
          if (s.marks_obtained !== null && s.marks_obtained !== undefined) {
            totalMarks += s.marks_obtained;
          }
          if (!['excellent','very_good','good','passed'].includes(s.status)) allPassed = false;
          if (['poor','failed','needs_improvement'].includes(s.status)) anyFailed = true;
          if (s.status === 'pending' || s.status === 'submitted') allGraded = false;
        });

        group.totalMarks = allGraded ? totalMarks : null;
        group.totalMaxMarks = totalMaxMarks;

        if (allGraded) {
          // Compute grade from percentage
          const pct = totalMaxMarks > 0 ? (totalMarks / totalMaxMarks) * 100 : 0;
          if (pct >= 90) group.overallStatus = 'excellent';
          else if (pct >= 75) group.overallStatus = 'very_good';
          else if (pct >= 60) group.overallStatus = 'good';
          else if (pct >= 40) group.overallStatus = 'needs_improvement';
          else group.overallStatus = 'poor';
        } else {
          group.overallStatus = 'pending';
        }
      } else {
        // Single submission
        const s = subs[0];
        group.totalMarks = s.marks_obtained;
        group.totalMaxMarks = 10;
        group.overallStatus = s.status;
      }
    });

    return Array.from(map.values());
  }, [submissions]);

  // Now filter the grouped submissions by query and status
  const groupedSubmissions = useMemo<GroupedSubmission[]>(() => {
    return allGroupedSubmissions.filter((group) => {
      const matchesQuery = group.student_name.toLowerCase().includes(query.toLowerCase()) ||
        group.roll_no?.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = filterStatus === 'all' || group.overallStatus === filterStatus;
      return matchesQuery && matchesStatus;
    });
  }, [allGroupedSubmissions, query, filterStatus]);

  // Keep filteredSubmissions for backward compatibility with next/prev navigation
  const filteredSubmissions = useMemo(() => {
    return groupedSubmissions.flatMap(g => g.submissions);
  }, [groupedSubmissions]);

  const toggleGroupExpansion = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Check if we have set-based exam data
  const hasSetData = groupedSubmissions.some(g => g.assigned_set_name);

  // Set-wise stats (computed from grouped submissions)
  const setStats = useMemo(() => {
    const setNames = new Set<string>();
    groupedSubmissions.forEach(g => {
      if (g.assigned_set_name) setNames.add(g.assigned_set_name);
    });
    if (setNames.size === 0) return null;

    const result = Array.from(setNames).sort().map(setName => {
      const groups = groupedSubmissions.filter(g => g.assigned_set_name === setName);
      return {
        setName,
        total: groups.length,
        excellent: groups.filter(g => g.overallStatus === 'excellent').length,
        very_good: groups.filter(g => g.overallStatus === 'very_good').length,
        good: groups.filter(g => g.overallStatus === 'good').length,
        needs_improvement: groups.filter(g => g.overallStatus === 'needs_improvement').length,
        poor: groups.filter(g => ['poor','failed'].includes(g.overallStatus)).length,
        pending: groups.filter(g => g.overallStatus === 'pending').length,
      };
    });
    return result;
  }, [groupedSubmissions]);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-cyan-50/70 to-amber-50/70 dark:from-slate-950 dark:via-slate-900 dark:to-cyan-950/25 flex flex-col md:flex-row pt-16">
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
            <SheetTitle className="sr-only">Submissions Navigation</SheetTitle>
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
                  className="h-10 gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-sky-500/20 hover:shadow-sky-500/30 transition-all duration-300 font-semibold rounded-xl"
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
                {['all', 'excellent', 'very_good', 'good', 'needs_improvement', 'poor', 'pending'].map(status => (
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
                    <th className="px-4 py-3">Time</th>
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
                      <td colSpan={7} className="p-8 text-center text-gray-500">
                        Loading...
                      </td>
                    </tr>
                  ) : groupedSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-gray-500">
                        No submissions found
                      </td>
                    </tr>
                  ) : (
                    groupedSubmissions.map((group) => {
                      const isMultiTask = group.submissions.length > 1 && group.submissions.some(s => s.level_id);
                      const isExpanded = expandedGroups.has(group.key);

                      return (
                        <React.Fragment key={group.key}>
                          {/* Group Header Row */}
                          <motion.tr
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className={`group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${isMultiTask ? 'cursor-pointer' : ''}`}
                            onClick={() => {
                              if (isMultiTask) {
                                toggleGroupExpansion(group.key);
                              } else {
                                handleOpenSheet(group.submissions[0]);
                              }
                            }}
                          >
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <Checkbox
                                checked={group.submissions.every(s => selectedSubmissionIds.has(s.id))}
                                onCheckedChange={(checked) => {
                                  const next = new Set(selectedSubmissionIds);
                                  group.submissions.forEach(s => {
                                    if (checked) next.add(s.id);
                                    else next.delete(s.id);
                                  });
                                  setSelectedSubmissionIds(next);
                                }}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {isMultiTask && (
                                  <div className="text-gray-400">
                                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                  </div>
                                )}
                                <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-xs ring-2 ring-white dark:ring-gray-900">
                                  {group.student_name.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-medium text-gray-900 dark:text-white">{group.student_name}</div>
                                  <div className="text-xs text-gray-500 font-mono">{group.roll_no}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-gray-500">
                              {new Date(group.latestDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            {!selectedPracticalId && (
                              <td className="px-4 py-3 text-gray-600 dark:text-gray-300 max-w-[200px] truncate" title={group.practical_title}>
                                <div className="flex items-center gap-2">
                                  {group.practical_title}
                                  {group.assigned_set_name ? (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400">
                                      {group.assigned_set_name}
                                    </span>
                                  ) : isMultiTask ? (
                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400">
                                      {group.submissions.length} tasks
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                            )}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                {(() => {
                                  const gradeConfig: Record<string, { bar: string; text: string; bg: string, label: string }> = {
                                    excellent: { bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', label: 'Excellent' },
                                    very_good: { bar: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', label: 'Very Good' },
                                    good: { bar: 'bg-cyan-500', text: 'text-cyan-700 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-900/20', label: 'Good' },
                                    needs_improvement: { bar: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', label: 'Needs Improvement' },
                                    poor: { bar: 'bg-red-500', text: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', label: 'Poor' },
                                    failed: { bar: 'bg-red-500', text: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', label: 'Poor' },
                                    passed: { bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', label: 'Excellent' },
                                    pending: { bar: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', label: 'Pending' },
                                    submitted: { bar: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', label: 'Submitted' },
                                  };
                                  const gc = gradeConfig[group.overallStatus] || gradeConfig.pending;
                                  return (
                                    <>
                                      <div className={`w-1.5 h-8 rounded-full ${gc.bar}`} />
                                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${gc.text} ${gc.bg}`}>
                                        {gc.label}
                                      </span>
                                    </>
                                  );
                                })()}
                              </div>
                            </td>
                            <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                              {group.totalMarks !== null ? (
                                <span className="font-mono font-bold text-gray-900 dark:text-white">
                                  {group.totalMarks}/{group.totalMaxMarks}
                                </span>
                              ) : (
                                !isMultiTask ? (
                                  <input
                                    className="w-12 px-2 py-1 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="-"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleInlineGrade(group.submissions[0].id, e.currentTarget.value);
                                      }
                                    }}
                                  />
                                ) : (
                                  <span className="text-xs text-gray-400">—</span>
                                )
                              )}
                            </td>
                            <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-2">
                                {['poor','failed','needs_improvement'].includes(group.overallStatus) && group.attempt_count >= group.max_attempts && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="gap-1.5 text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/20 dark:text-amber-400 dark:hover:bg-amber-900/40"
                                    onClick={() => handleAllowReattempt(group.submissions[0])}
                                  >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Re-attempt
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40"
                                  onClick={() => {
                                    if (isMultiTask) {
                                      toggleGroupExpansion(group.key);
                                    } else {
                                      handleOpenSheet(group.submissions[0]);
                                    }
                                  }}
                                >
                                  {isMultiTask ? (isExpanded ? 'Collapse' : 'Expand') : 'Grade'}
                                </Button>
                              </div>
                            </td>
                          </motion.tr>

                          {/* Expanded Sub-rows for multi-task */}
                          {isMultiTask && isExpanded && group.submissions.map((sub) => (
                            <motion.tr
                              key={sub.id}
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="bg-gray-50/50 dark:bg-gray-800/30 hover:bg-gray-100/50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                              onClick={() => handleOpenSheet(sub)}
                            >
                              <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                                <Checkbox
                                  checked={selectedSubmissionIds.has(sub.id)}
                                  onCheckedChange={() => toggleSelection(sub.id)}
                                />
                              </td>
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-3 pl-7">
                                  <div className="w-1 h-6 rounded-full bg-indigo-200 dark:bg-indigo-800" />
                                  <div>
                                    <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      {sub.level_title || `Task`}
                                    </div>
                                    <div className="text-[10px] text-gray-400">
                                      max: {sub.level_max_marks || 10} marks
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-2" />
                              {!selectedPracticalId && <td className="px-4 py-2" />}
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-2">
                                  {(() => {
                                    const gc: Record<string, { bar: string; text: string; bg: string; label: string }> = {
                                      excellent: { bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', label: 'Excellent' },
                                      very_good: { bar: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', label: 'Very Good' },
                                      good: { bar: 'bg-cyan-500', text: 'text-cyan-700 dark:text-cyan-400', bg: 'bg-cyan-50 dark:bg-cyan-900/20', label: 'Good' },
                                      needs_improvement: { bar: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', label: 'Needs Improvement' },
                                      poor: { bar: 'bg-red-500', text: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', label: 'Poor' },
                                      failed: { bar: 'bg-red-500', text: 'text-red-700 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', label: 'Poor' },
                                      passed: { bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-900/20', label: 'Excellent' },
                                      pending: { bar: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', label: 'Pending' },
                                      submitted: { bar: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', label: 'Submitted' },
                                    };
                                    const c = gc[sub.status] || gc.pending;
                                    return (
                                      <>
                                        <div className={`w-1 h-5 rounded-full ${c.bar}`} />
                                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${c.text} ${c.bg}`}>
                                          {c.label}
                                        </span>
                                      </>
                                    );
                                  })()}
                                </div>
                              </td>
                              <td className="px-4 py-2" onClick={e => e.stopPropagation()}>
                                {!['pending','submitted'].includes(sub.status) ? (
                                  <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">
                                    {sub.marks_obtained}/{sub.level_max_marks || 10}
                                  </span>
                                ) : (
                                  <input
                                    className="w-12 px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="-"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        handleInlineGrade(sub.id, e.currentTarget.value);
                                      }
                                    }}
                                  />
                                )}
                              </td>
                              <td className="px-4 py-2 text-right" onClick={e => e.stopPropagation()}>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs bg-indigo-50 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400"
                                >
                                  Grade
                                </Button>
                              </td>
                            </motion.tr>
                          ))}
                        </React.Fragment>
                      );
                    })
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
          <SheetTitle className="sr-only">Submission Grading</SheetTitle>
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
