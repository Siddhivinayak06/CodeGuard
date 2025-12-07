"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import {
    BookOpen,
    CheckCircle2,
    Clock,
    TrendingUp,
    Code,
    FileText,
    ChevronRight,
    Sparkles,
    Calendar,
    Award,
    Target,
    Zap,
    ArrowUpRight,
    GraduationCap,
    Trophy,
} from "lucide-react";
import Link from "next/link";

// Progress Ring Component
function ProgressRing({
    progress,
    size = 80,
    strokeWidth = 8,
    showLabel = true,
}: {
    progress: number;
    size?: number;
    strokeWidth?: number;
    showLabel?: boolean;
}) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <div className="relative" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="progress-ring -rotate-90">
                <circle
                    className="stroke-gray-200 dark:stroke-gray-700"
                    fill="transparent"
                    strokeWidth={strokeWidth}
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
                <circle
                    className="progress-ring-circle"
                    stroke="url(#gradient)"
                    fill="transparent"
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    r={radius}
                    cx={size / 2}
                    cy={size / 2}
                />
                <defs>
                    <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="50%" stopColor="#8b5cf6" />
                        <stop offset="100%" stopColor="#ec4899" />
                    </linearGradient>
                </defs>
            </svg>
            {showLabel && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-bold text-gray-900 dark:text-white">{progress}%</span>
                </div>
            )}
        </div>
    );
}

// Status Badge
function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        submitted: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
        graded: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400",
        pending: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
        rejected: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
    };
    return (
        <span className={`px-2.5 py-1 text-xs font-semibold rounded-lg ${styles[status.toLowerCase()] || styles.pending}`}>
            {status}
        </span>
    );
}

export default function StudentDashboard() {
    const router = useRouter();
    const mountedRef = useRef(true);
    const supabase = useMemo(() => createClient(), []);

    const [user, setUser] = useState<User | null>(null);
    const [userName, setUserName] = useState("");
    const [studentDetails, setStudentDetails] = useState<{
        semester: number;
        name?: string;
    } | null>(null);
    const [progress, setProgress] = useState<
        {
            subject_id: string;
            subject_name: string;
            total_count: number;
            completed_count: number;
        }[]
    >([]);
    const [submissions, setSubmissions] = useState<
        {
            id: string;
            practical_title: string;
            language: string;
            status: string;
            marks_obtained: number | null;
            created_at: string;
        }[]
    >([]);
    const [loading, setLoading] = useState(true);

    // Stats
    const totalPracticals = progress.reduce((acc, p) => acc + p.total_count, 0);
    const completedPracticals = progress.reduce((acc, p) => acc + p.completed_count, 0);
    const overallProgress = totalPracticals > 0 ? Math.round((completedPracticals / totalPracticals) * 100) : 0;

    // Greeting based on time
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 17) return "Good afternoon";
        return "Good evening";
    };

    // Auth check
    useEffect(() => {
        mountedRef.current = true;

        const fetchUser = async () => {
            try {
                const { data } = await supabase.auth.getUser();
                const u = data?.user ?? null;

                if (!u) {
                    router.push("/auth/login");
                    return;
                }

                if (mountedRef.current) setUser(u);

                // Fetch user name
                const { data: userData } = await supabase
                    .from("users")
                    .select("name")
                    .eq("uid", u.id)
                    .single();

                if (userData?.name) setUserName(userData.name);
            } catch {
                router.push("/auth/login");
            }
        };

        fetchUser();
        return () => {
            mountedRef.current = false;
        };
    }, [router, supabase]);

    // Fetch dashboard data
    useEffect(() => {
        if (!user?.id) return;

        const fetchDashboardData = async () => {
            setLoading(true);
            try {
                const { data: sd, error: sdErr } = await supabase
                    .from("student_details")
                    .select("*")
                    .eq("student_id", user.id)
                    .maybeSingle();

                if (sdErr || !sd) throw new Error("Failed to fetch student details");
                setStudentDetails(sd);

                const { data: subjects, error: subjErr } = await supabase
                    .from("subjects")
                    .select(`id, subject_name, semester, practicals(id, title)`)
                    .eq("semester", sd.semester);

                if (subjErr) throw subjErr;

                interface Subject {
                    id: string;
                    subject_name: string;
                    practicals: { id: string; title: string }[] | null;
                }

                const progressData = await Promise.all(
                    (subjects ?? []).map(async (subject: Subject) => {
                        const total_count = subject.practicals?.length || 0;
                        const { count: completed_count } = await supabase
                            .from("submissions")
                            .select("*", { count: "exact", head: true })
                            .eq("student_id", user.id)
                            .in("practical_id", subject.practicals?.map((p) => p.id) || []);

                        return {
                            subject_id: subject.id,
                            subject_name: subject.subject_name,
                            total_count,
                            completed_count: completed_count || 0,
                        };
                    })
                );
                setProgress(progressData);

                interface SubmissionRow {
                    id: string;
                    practicals: { title: string } | null;
                    language: string;
                    status: string;
                    marks_obtained: number | null;
                    created_at: string;
                }

                const { data: submissionsData } = await supabase
                    .from("submissions")
                    .select(`id, practicals(title), language, status, marks_obtained, created_at`)
                    .eq("student_id", user.id)
                    .order("created_at", { ascending: false })
                    .limit(5);

                const formattedSubmissions = ((submissionsData as SubmissionRow[] | null) ?? []).map((s) => ({
                    id: s.id,
                    practical_title: s.practicals?.title || "Unknown",
                    language: s.language,
                    status: s.status,
                    marks_obtained: s.marks_obtained,
                    created_at: s.created_at,
                }));

                setSubmissions(formattedSubmissions);
            } catch (err) {
                console.error("Dashboard fetch error:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [supabase, user?.id]);

    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 dark:from-gray-950 dark:via-indigo-950/10 dark:to-purple-950/10">
                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 dark:from-gray-950 dark:via-indigo-950/10 dark:to-purple-950/10">

            <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
                {/* ===== BENTO GRID LAYOUT ===== */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
                    {/* ===== WELCOME CARD - Large (2x1) ===== */}
                    <div className="md:col-span-2 glass-card-premium rounded-3xl p-8 animate-slideUp relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-indigo-500/20 via-purple-500/10 to-transparent rounded-full blur-3xl" />
                        <div className="relative z-10">
                            <p className="text-gray-500 dark:text-gray-400 mb-1">{getGreeting()},</p>
                            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                                {userName || "Student"} 👋
                            </h1>
                            <p className="text-gray-600 dark:text-gray-400 mb-6">
                                {completedPracticals > 0
                                    ? `You've completed ${completedPracticals} practicals. Keep going!`
                                    : "Ready to start coding? Let's get productive today!"}
                            </p>
                            <Link
                                href="/Interactive"
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all"
                            >
                                <Code className="w-4 h-4" />
                                Open Editor
                            </Link>
                        </div>
                    </div>

                    {/* ===== OVERALL PROGRESS - Square ===== */}
                    <div className="glass-card-premium rounded-3xl p-6 animate-slideUp animation-delay-100 flex flex-col items-center justify-center text-center">
                        <ProgressRing progress={loading ? 0 : overallProgress} size={100} strokeWidth={10} />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mt-4">Overall Progress</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            {loading ? "--" : `${completedPracticals}/${totalPracticals}`} completed
                        </p>
                    </div>

                    {/* ===== SEMESTER INFO - Square ===== */}
                    <div className="glass-card rounded-3xl p-6 animate-slideUp animation-delay-200 flex flex-col items-center justify-center text-center bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/25 mb-3">
                            <GraduationCap className="w-7 h-7 text-white" />
                        </div>
                        <h3 className="text-3xl font-bold text-gray-900 dark:text-white">
                            Sem {studentDetails?.semester || "--"}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Current Semester</p>
                    </div>

                    {/* ===== QUICK STATS ROW (4 small cards) ===== */}
                    <div className="glass-card rounded-2xl p-5 animate-slideUp animation-delay-100 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                            <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{loading ? "--" : completedPracticals}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Completed</p>
                        </div>
                    </div>

                    <div className="glass-card rounded-2xl p-5 animate-slideUp animation-delay-150 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                            <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{loading ? "--" : totalPracticals - completedPracticals}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Pending</p>
                        </div>
                    </div>

                    <div className="glass-card rounded-2xl p-5 animate-slideUp animation-delay-200 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <BookOpen className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{loading ? "--" : progress.length}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Subjects</p>
                        </div>
                    </div>

                    <div className="glass-card rounded-2xl p-5 animate-slideUp animation-delay-250 flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-pink-100 dark:bg-pink-900/30 flex items-center justify-center">
                            <FileText className="w-6 h-6 text-pink-600 dark:text-pink-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{loading ? "--" : submissions.length}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Submissions</p>
                        </div>
                    </div>

                    {/* ===== QUICK ACTIONS - Wide (2x1) ===== */}
                    <div className="md:col-span-2 grid grid-cols-2 gap-4 animate-slideUp animation-delay-200">
                        <Link
                            href="/Interactive"
                            className="glass-card rounded-2xl p-5 flex items-center gap-4 hover-lift group bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20"
                        >
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                                <Code className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 dark:text-white">Code Editor</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Practice coding</p>
                            </div>
                            <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all" />
                        </Link>

                        <Link
                            href="/student/practicals"
                            className="glass-card rounded-2xl p-5 flex items-center gap-4 hover-lift group bg-gradient-to-br from-pink-50 to-orange-50 dark:from-pink-950/20 dark:to-orange-950/20"
                        >
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-pink-500 to-orange-500 flex items-center justify-center shadow-lg">
                                <FileText className="w-6 h-6 text-white" />
                            </div>
                            <div className="flex-1">
                                <h3 className="font-semibold text-gray-900 dark:text-white">Practicals</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">View assignments</p>
                            </div>
                            <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-pink-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all" />
                        </Link>
                    </div>

                    {/* ===== SUBJECT PROGRESS - Tall (spans remaining) ===== */}
                    <div className="md:col-span-2 glass-card rounded-3xl p-6 animate-slideUp animation-delay-300">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2">
                                <TrendingUp className="w-5 h-5 text-indigo-500" />
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Subject Progress</h2>
                            </div>
                        </div>

                        {loading ? (
                            <div className="space-y-4">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="flex items-center gap-4 animate-pulse">
                                        <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700" />
                                        <div className="flex-1">
                                            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                                            <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : progress.length === 0 ? (
                            <div className="text-center py-8">
                                <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                                <p className="text-gray-500 dark:text-gray-400">No subjects found</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {progress.map((p) => {
                                    const percentage = Math.round((p.completed_count / (p.total_count || 1)) * 100);
                                    return (
                                        <div key={p.subject_id} className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                                                <BookOpen className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-medium text-gray-900 dark:text-white truncate">{p.subject_name}</span>
                                                    <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">{percentage}%</span>
                                                </div>
                                                <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                                                        style={{ width: `${percentage}%` }}
                                                    />
                                                </div>
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                    {p.completed_count}/{p.total_count} completed
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* ===== RECENT SUBMISSIONS - Wide (2x1) ===== */}
                    <div className="md:col-span-2 lg:col-span-4 glass-card rounded-3xl p-6 animate-slideUp animation-delay-400">
                        <div className="flex items-center justify-between mb-5">
                            <div className="flex items-center gap-2">
                                <FileText className="w-5 h-5 text-indigo-500" />
                                <h2 className="text-lg font-bold text-gray-900 dark:text-white">Recent Submissions</h2>
                            </div>
                            <Link
                                href="/student/submissions"
                                className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1"
                            >
                                View All <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>

                        {loading ? (
                            <div className="space-y-3">
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 animate-pulse">
                                        <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700" />
                                        <div className="flex-1">
                                            <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                                            <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                                        </div>
                                        <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                                    </div>
                                ))}
                            </div>
                        ) : submissions.length === 0 ? (
                            <div className="text-center py-8">
                                <FileText className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                                <p className="text-gray-500 dark:text-gray-400">No submissions yet</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {submissions.map((s) => (
                                    <div
                                        key={s.id}
                                        className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0">
                                            <Code className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-medium text-gray-900 dark:text-white truncate">{s.practical_title}</h4>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                {s.language} • {new Date(s.created_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                        <StatusBadge status={s.status} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}