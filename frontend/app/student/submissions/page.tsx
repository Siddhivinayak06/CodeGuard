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
} from "lucide-react";

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

export default function StudentSubmissions() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const mountedRef = useRef<boolean>(false);

  const [user, setUser] = useState<User | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [viewingSubmission, setViewingSubmission] = useState<any>(null);
  const [pdfLoading, setPdfLoading] = useState<boolean>(false);

  const [studentDetails, setStudentDetails] = useState<{ name: string; roll_number: string } | null>(null);

  // ✅ Auth check & Fetch User Details
  useEffect(() => {
    mountedRef.current = true;

    const fetchUserAndDetails = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/auth/login");
          return;
        }

        if (mountedRef.current) setUser(user);

        // Fetch additional details
        const { data: userProfile } = await supabase
          .from("users")
          .select("name")
          .eq("uid", user.id)
          .single();

        const { data: sDetails } = await supabase
          .from("student_details")
          .select("roll_number")
          .eq("student_id", user.id)
          .maybeSingle();

        if (mountedRef.current) {
          setStudentDetails({
            name: userProfile?.name || user.email || "Student",
            roll_number: sDetails?.roll_number || "N/A"
          });
        }

      } catch (err) {
        console.error("Auth fetch error:", err);
        router.push("/auth/login");
      }
    };

    fetchUserAndDetails();

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

  // ✅ Download PDF
  const handleDownloadPdf = async (submission: any) => {
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
        marks: submission.marks_obtained,
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

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 dark:from-gray-950 dark:via-indigo-950/10 dark:to-purple-950/10">

      <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 animate-slideUp">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gradient">
              My Submissions
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 ml-14">
            Track your coding progress and history
          </p>
        </div>

        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : submissions.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center animate-fadeIn">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <FileCode className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No Submissions Yet
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              You haven't submitted any practicals yet. Time to code!
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {submissions.map((s, index) => (
              <div
                key={s.id}
                className="glass-card rounded-2xl p-5 hover-lift animate-slideUp group"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${getLanguageColor(s.language)} flex items-center justify-center shadow-lg flex-shrink-0`}>
                    <Code className="w-6 h-6 text-white" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
                          {s.practical_title}
                        </h3>
                        <div className="flex flex-wrap items-center gap-3 mt-1.5">
                          <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                            {s.language}
                          </span>
                          <span className="text-gray-300 dark:text-gray-600">|</span>
                          <span className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
                            <Calendar className="w-3.5 h-3.5" />
                            {new Date(s.created_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <StatusBadge status={s.status} />
                        {s.marks_obtained !== null && (
                          <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                            {s.marks_obtained} Marks
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex sm:flex-col gap-2 pt-4 sm:pt-0 border-t sm:border-t-0 border-gray-100 dark:border-gray-800">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 sm:flex-none justify-center gap-2"
                      onClick={() => setViewingSubmission(s)}
                    >
                      <Eye className="w-4 h-4" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 sm:flex-none justify-center gap-2 text-gray-500 hover:text-indigo-600"
                      onClick={() => handleDownloadPdf(s)}
                      disabled={pdfLoading}
                    >
                      <Download className="w-4 h-4" />
                      PDF
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal for viewing code */}
      {viewingSubmission && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-slideUp">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
                  <Code className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900 dark:text-white">
                    {viewingSubmission.practical_title}
                  </h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Submitted on {new Date(viewingSubmission.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewingSubmission(null)}
                className="hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
              >
                Close
              </Button>
            </div>

            <div className="flex-1 overflow-auto p-0">
              <pre className="p-6 text-sm font-mono leading-relaxed overflow-x-auto text-gray-800 dark:text-gray-200">
                {viewingSubmission.code}
              </pre>
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setViewingSubmission(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}