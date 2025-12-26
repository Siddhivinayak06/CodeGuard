"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    AreaChart,
    Area,
    Legend,
} from "recharts";
import {
    Users,
    GraduationCap,
    BookOpen,
    FileCode,
    CheckCircle2,
    XCircle,
    Clock,
    TrendingUp,
    Calendar,
    Award,
    BarChart3,
    PieChartIcon,
    Activity,
    ArrowUpRight,
    RefreshCw,
} from "lucide-react";
import Link from "next/link";

// Types
interface AnalyticsData {
    overview: {
        students: number;
        faculty: number;
        admins: number;
        subjects: number;
        practicals: number;
        totalSubmissions: number;
    };
    submissions: {
        submitted: number;
        evaluated: number;
        pending: number;
        accepted: number;
        failed: number;
        successRate: number;
    };
    activityData: Array<{
        day: string;
        total: number;
        evaluated: number;
        pending: number;
    }>;
    deadlines: {
        upcoming: Array<{ id: string; title: string; deadline: string }>;
        past: number;
    };
    subjectsWithPracticals: Array<{
        id: string;
        name: string;
        code: string;
        practicalCount: number;
    }>;
    topStudents: Array<{
        id: string;
        name: string;
        email: string;
        count: number;
    }>;
}

// Stat Card Component
function StatCard({
    label,
    value,
    icon,
    gradient,
    subtext,
    delay = 0,
}: {
    label: string;
    value: number | string;
    icon: React.ReactNode;
    gradient: string;
    subtext?: string;
    delay?: number;
}) {
    return (
        <div
            className="glass-card-premium rounded-3xl p-6 hover-lift animate-slideUp"
            style={{ animationDelay: `${delay}ms` }}
        >
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        {label}
                    </p>
                    <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                        {value}
                    </p>
                    {subtext && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtext}</p>
                    )}
                </div>
                <div className={`w-12 h-12 rounded-2xl ${gradient} flex items-center justify-center shadow-lg`}>
                    {icon}
                </div>
            </div>
        </div>
    );
}

// Chart Card Wrapper
function ChartCard({
    title,
    icon,
    children,
    delay = 0,
}: {
    title: string;
    icon: React.ReactNode;
    children: React.ReactNode;
    delay?: number;
}) {
    return (
        <div
            className="glass-card-premium rounded-3xl p-6 animate-slideUp"
            style={{ animationDelay: `${delay}ms` }}
        >
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4">
                {icon}
                {title}
            </h3>
            {children}
        </div>
    );
}

// Pie Chart Colors
const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e"];
const STATUS_COLORS = {
    passed: "#10b981",
    failed: "#ef4444",
    pending: "#f59e0b",
};

export default function AnalyticsPage() {
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);

    const [user, setUser] = useState<any>(null);
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    // Auth check
    useEffect(() => {
        const checkAuth = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                router.push("/auth/login");
                return;
            }
            setUser(user);
        };
        checkAuth();
    }, [router, supabase]);

    // Fetch analytics
    const fetchAnalytics = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/analytics");
            const json = await res.json();
            if (res.ok && !json.error) {
                setData(json);
            }
        } catch (err) {
            console.error("Failed to fetch analytics:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) fetchAnalytics();
    }, [user]);

    // Format deadline date
    const formatDeadline = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) return "Today";
        if (diffDays === 1) return "Tomorrow";
        if (diffDays < 7) return `In ${diffDays} days`;
        return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    };

    // User distribution data for pie chart
    const userDistribution = data ? [
        { name: "Students", value: data.overview.students, color: "#6366f1" },
        { name: "Faculty", value: data.overview.faculty, color: "#8b5cf6" },
        { name: "Admins", value: data.overview.admins, color: "#ec4899" },
    ] : [];

    // Submission status data for pie chart (from submissions)
    const submissionStatusData = data ? [
        { name: "Passed", value: data.submissions.accepted, color: STATUS_COLORS.passed },
        { name: "Failed", value: data.submissions.failed, color: STATUS_COLORS.failed },
        { name: "Pending", value: data.submissions.pending, color: STATUS_COLORS.pending },
    ] : [];

    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 dark:from-gray-950 dark:via-indigo-950/10 dark:to-purple-950/10">
                <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 dark:from-gray-950 dark:via-indigo-950/10 dark:to-purple-950/10">
            <div className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 xl:px-12 w-full mx-auto">
                {/* Header */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8 animate-slideUp">
                    <div className="flex items-center gap-4">
                        <div className="p-3 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 shadow-lg shadow-purple-500/25">
                            <BarChart3 className="w-8 h-8 text-white" />
                        </div>
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                                System Analytics
                            </h1>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                                Platform insights and statistics
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={fetchAnalytics}
                        disabled={loading}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-all disabled:opacity-60"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        Refresh
                    </button>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="glass-card rounded-3xl p-6 animate-pulse">
                                <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
                                <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                            </div>
                        ))}
                    </div>
                ) : data ? (
                    <>
                        {/* Overview Stats */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
                            <StatCard
                                label="Total Users"
                                value={data.overview.students + data.overview.faculty + data.overview.admins}
                                icon={<Users className="w-6 h-6 text-white" />}
                                gradient="bg-gradient-to-br from-indigo-500 to-purple-500"
                                subtext={`${data.overview.students} students`}
                                delay={100}
                            />
                            <StatCard
                                label="Subjects"
                                value={data.overview.subjects}
                                icon={<BookOpen className="w-6 h-6 text-white" />}
                                gradient="bg-gradient-to-br from-purple-500 to-pink-500"
                                delay={150}
                            />
                            <StatCard
                                label="Practicals"
                                value={data.overview.practicals}
                                icon={<FileCode className="w-6 h-6 text-white" />}
                                gradient="bg-gradient-to-br from-pink-500 to-rose-500"
                                delay={200}
                            />
                            <StatCard
                                label="Submissions"
                                value={data.overview.totalSubmissions}
                                icon={<TrendingUp className="w-6 h-6 text-white" />}
                                gradient="bg-gradient-to-br from-emerald-500 to-teal-500"
                                subtext={`${data.submissions.successRate}% success rate`}
                                delay={250}
                            />
                        </div>

                        {/* Submission Stats Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
                            <div className="glass-card rounded-2xl p-5 flex items-center gap-4 animate-slideUp" style={{ animationDelay: "300ms" }}>
                                <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                                    <CheckCircle2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.submissions.accepted}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Passed</p>
                                </div>
                            </div>
                            <div className="glass-card rounded-2xl p-5 flex items-center gap-4 animate-slideUp" style={{ animationDelay: "350ms" }}>
                                <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                    <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.submissions.failed}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Failed</p>
                                </div>
                            </div>
                            <div className="glass-card rounded-2xl p-5 flex items-center gap-4 animate-slideUp" style={{ animationDelay: "400ms" }}>
                                <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                    <FileCode className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{data.submissions.evaluated}</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Evaluated</p>
                                </div>
                            </div>
                        </div>

                        {/* Charts Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                            {/* Activity Chart */}
                            <ChartCard
                                title="Submission Activity (Last 7 Days)"
                                icon={<Activity className="w-5 h-5 text-indigo-500" />}
                                delay={450}
                            >
                                <div className="h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={data.activityData}>
                                            <defs>
                                                <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorPassed" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                                            <XAxis dataKey="day" className="text-xs" tick={{ fill: "#9ca3af" }} />
                                            <YAxis className="text-xs" tick={{ fill: "#9ca3af" }} />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                                                    borderRadius: "12px",
                                                    border: "1px solid #e5e7eb",
                                                    boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
                                                }}
                                            />
                                            <Legend />
                                            <Area
                                                type="monotone"
                                                dataKey="total"
                                                name="Total"
                                                stroke="#6366f1"
                                                strokeWidth={2}
                                                fill="url(#colorTotal)"
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="evaluated"
                                                name="Evaluated"
                                                stroke="#10b981"
                                                strokeWidth={2}
                                                fill="url(#colorPassed)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </ChartCard>

                            {/* Submission Status Pie Chart */}
                            <ChartCard
                                title="Submission Status"
                                icon={<PieChartIcon className="w-5 h-5 text-purple-500" />}
                                delay={500}
                            >
                                <div className="h-64 flex items-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={submissionStatusData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={90}
                                                paddingAngle={3}
                                                dataKey="value"
                                            >
                                                {submissionStatusData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                                                    borderRadius: "12px",
                                                    border: "1px solid #e5e7eb",
                                                }}
                                            />
                                            <Legend />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </ChartCard>
                        </div>

                        {/* Bottom Row */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Upcoming Deadlines */}
                            <ChartCard
                                title="Upcoming Deadlines"
                                icon={<Calendar className="w-5 h-5 text-pink-500" />}
                                delay={550}
                            >
                                {data.deadlines.upcoming.length === 0 ? (
                                    <div className="text-center py-8">
                                        <Calendar className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                                        <p className="text-gray-500 dark:text-gray-400">No upcoming deadlines</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {data.deadlines.upcoming.map((d) => (
                                            <div
                                                key={d.id}
                                                className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-gray-900 dark:text-white truncate">
                                                        {d.title}
                                                    </p>
                                                </div>
                                                <span className="ml-3 text-sm font-medium text-pink-600 dark:text-pink-400 whitespace-nowrap">
                                                    {formatDeadline(d.deadline)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ChartCard>

                            {/* Top Students */}
                            <ChartCard
                                title="Most Active Students"
                                icon={<Award className="w-5 h-5 text-amber-500" />}
                                delay={600}
                            >
                                {data.topStudents.length === 0 ? (
                                    <div className="text-center py-8">
                                        <GraduationCap className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                                        <p className="text-gray-500 dark:text-gray-400">No submissions yet</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {data.topStudents.map((student, idx) => (
                                            <div
                                                key={student.id}
                                                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50"
                                            >
                                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white ${idx === 0 ? "bg-amber-500" : idx === 1 ? "bg-gray-400" : idx === 2 ? "bg-orange-600" : "bg-gray-300"
                                                    }`}>
                                                    {idx + 1}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-gray-900 dark:text-white truncate">
                                                        {student.name}
                                                    </p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                        {student.email}
                                                    </p>
                                                </div>
                                                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                                                    {student.count}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ChartCard>

                            {/* Subjects Overview */}
                            <ChartCard
                                title="Subjects by Practicals"
                                icon={<BookOpen className="w-5 h-5 text-indigo-500" />}
                                delay={650}
                            >
                                {data.subjectsWithPracticals.length === 0 ? (
                                    <div className="text-center py-8">
                                        <BookOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                                        <p className="text-gray-500 dark:text-gray-400">No subjects found</p>
                                    </div>
                                ) : (
                                    <div className="space-y-3">
                                        {data.subjectsWithPracticals.slice(0, 5).map((subject) => (
                                            <div
                                                key={subject.id}
                                                className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-medium text-gray-900 dark:text-white truncate">
                                                        {subject.name}
                                                    </p>
                                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                                        {subject.code}
                                                    </p>
                                                </div>
                                                <span className="ml-3 px-2.5 py-1 text-sm font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                                                    {subject.practicalCount}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </ChartCard>
                        </div>
                    </>
                ) : (
                    <div className="text-center py-16">
                        <BarChart3 className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                        <p className="text-gray-500 dark:text-gray-400">Failed to load analytics data</p>
                        <button
                            onClick={fetchAnalytics}
                            className="mt-4 px-4 py-2 text-indigo-600 dark:text-indigo-400 hover:underline"
                        >
                            Try again
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
