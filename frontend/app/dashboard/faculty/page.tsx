"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import type { User } from "@supabase/supabase-js";
import PracticalForm from "../../faculty/components/PracticalForm";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area
} from "recharts";
import {
  Users,
  FileCheck,
  TrendingUp,
  Clock,
  Plus,
  ArrowUpRight,
  Pencil,
  Trash2,
  BookOpen,
  ArrowRight,
} from "lucide-react";
import { motion } from "framer-motion";
import { Skeleton } from "@/components/ui/skeleton";
import FacultyDashboardSkeleton from "@/components/skeletons/FacultyDashboardSkeleton";
import FullPageLoader from "@/components/loaders/FullPageLoader";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
} as const;

const shellVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.3 }
  }
} as const;

const revealVariants = {
  hidden: { y: 10, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: {
      type: "spring" as const,
      stiffness: 260,
      damping: 30
    }
  }
} as const;

const itemVariants = revealVariants; // Aliasing for compatibility with existing code

import { Practical, Subject, TestCase } from "../../faculty/types";

// ---------------------- Types ----------------------
interface Submission {
  id: number;
  status: string;
  created_at: string;
  practical_id: number;
}

// ---------------------- Initial States ----------------------
const initialPracticalForm: Practical = {
  id: 0,
  title: "",
  subject_id: 0,
  description: "",
  language: null,
  deadline: new Date().toISOString().slice(0, 16),
  max_marks: 100,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  submitted: false,
};
const initialTestCase: TestCase = {
  id: 0,
  practical_id: null,
  input: "",
  expected_output: "",
  is_hidden: false,
  time_limit_ms: 2000,
  memory_limit_kb: 65536,
  created_at: new Date().toISOString(),
  level_id: null
};

// ---------------------- Components ----------------------

function PracticalCard({
  practical,
  subject,
  onEdit,
  onDelete,
}: {
  practical: Practical;
  subject: string;
  onEdit: (p: Practical) => void;
  onDelete: (id: number) => void;
}) {
  const isPast = new Date(practical.deadline || new Date()).getTime() < Date.now();
  const deadline = new Date(practical.deadline || new Date());
  const timeUntil = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="group p-4 bg-white dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700/50 rounded-xl hover:shadow-lg hover:border-indigo-200 dark:hover:border-indigo-800/50 transition-all duration-200">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Content */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-900 dark:text-white truncate">{practical.title}</h4>
          <div className="flex items-center gap-2 mt-1.5 text-xs">
            <span className="text-purple-600 dark:text-purple-400 font-medium">{subject}</span>
            {practical.language && (
              <>
                <span className="text-gray-300 dark:text-gray-600">•</span>
                <span className="text-blue-600 dark:text-blue-400">{practical.language}</span>
              </>
            )}
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <span className="text-gray-500 dark:text-gray-400">
              {deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Middle: Status */}
        <span
          className={cn(
            "shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full",
            isPast
              ? "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
              : timeUntil <= 2
                ? "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400"
                : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400"
          )}
        >
          <div
            className={cn(
              "w-1.5 h-1.5 rounded-full",
              isPast ? "bg-gray-400" : timeUntil <= 2 ? "bg-orange-500 animate-pulse" : "bg-emerald-500"
            )}
          />
          {isPast ? "Closed" : timeUntil <= 2 ? "Due Soon" : "Active"}
        </span>

        {/* Right: Actions */}
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => onEdit(practical)}
            className="p-2.5 rounded-lg text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
            title="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(practical.id)}
            className="p-2.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------- Faculty Dashboard ----------------------
export default function FacultyDashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [practicals, setPracticals] = useState<Practical[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selected, setSelected] = useState<Date>(new Date());
  const [modalOpen, setModalOpen] = useState(false);

  const [editingPractical, setEditingPractical] = useState<Practical | null>(null);
  const [sampleCode, setSampleCode] = useState<string>("");
  const [sampleLanguage, setSampleLanguage] = useState<string>("c");

  // Fetch data
  useEffect(() => {
    const init = async () => {
      // 1. Get user
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.push("/auth/login");
        return;
      }
      setUser(data.user);

      // Get display name
      const { data: userData } = await supabase
        .from("users")
        .select("name")
        .eq("uid", data.user.id)
        .single();
      if (userData) setUserName(userData.name);

      setLoading(false);

      // 2. Fetch subjects for this faculty
      setDataLoading(true);
      const { data: subjData, error: subjErr } = await supabase
        .from("subjects")
        .select("*")
        .eq("faculty_id", data.user.id);

      if (!subjErr && subjData) {
        setSubjects(subjData as Subject[]);
      } else {
        setSubjects([]);
      }

      // 3. Fetch practicals
      const subjectIds = (subjData ?? []).map((s) => s.id);
      if (subjectIds.length > 0) {
        const { data: pracData } = await supabase
          .from("practicals")
          .select("*")
          .in("subject_id", subjectIds)
          .order("deadline", { ascending: true });

        if (pracData) {
          setPracticals(pracData as Practical[]);

          // 4. Fetch Submissions (for charts)
          const pIds = pracData.map(p => p.id);
          if (pIds.length > 0) {
            const { data: subData } = await supabase
              .from("submissions")
              .select("id, status, created_at, practical_id")
              .in("practical_id", pIds);

            if (subData) {
              const mappedSubmissions = subData.map(s => ({
                id: s.id,
                status: s.status || "pending",
                created_at: s.created_at,
                practical_id: s.practical_id
              }));
              setSubmissions(mappedSubmissions as Submission[]);
            }
          }
        }
      }
      setDataLoading(false);
    };

    init();
  }, [supabase, router]);

  const fetchPracticals = async () => {
    if (!user) return;
    const subjectIds = subjects.map((s) => s.id);
    if (subjectIds.length === 0) return;

    const { data } = await supabase
      .from("practicals")
      .select("*")
      .in("subject_id", subjectIds)
      .order("deadline", { ascending: true });

    if (data) setPracticals(data as Practical[]);
  };

  const openCreate = (date?: Date) => {
    setEditingPractical(null);
    setSampleCode("");
    setSampleLanguage("c");
    setModalOpen(true);
  };

  const openEdit = async (p: Practical) => {
    setEditingPractical(p);

    const { data: refs } = await supabase
      .from("reference_codes")
      .select("*")
      .eq("practical_id", p.id)
      .order("created_at", { ascending: false });
    if (refs && refs.length > 0) {
      setSampleCode(refs[0].code || "");
      setSampleLanguage(refs[0].language || "c");
    }

    setModalOpen(true);
  };

  const deletePractical = async (id: number) => {
    if (!confirm("Delete this practical?")) return;
    const { error } = await supabase.from("practicals").delete().eq("id", id);
    if (!error) setPracticals((prev) => prev.filter((p) => p.id !== id));
  };

  // --- Chart Data Preparation ---
  // 1. Status Distribution
  const statusData = useMemo(() => {
    const counts = { passed: 0, failed: 0, pending: 0 };
    submissions.forEach(s => {
      const st = (s.status || "pending").toLowerCase();
      if (counts[st as keyof typeof counts] !== undefined) counts[st as keyof typeof counts]++;
      else counts.pending++;
    });
    return [
      { name: 'Passed', value: counts.passed, color: '#10b981' }, // green
      { name: 'Failed', value: counts.failed, color: '#ef4444' }, // red
      { name: 'Pending', value: counts.pending, color: '#fbbf24' }, // amber

    ].filter(d => d.value > 0);
  }, [submissions]);

  // 2. Activity (Submissions per day, last 7 days)
  const activityData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      return d.toISOString().slice(0, 10);
    });

    const data = last7Days.map(date => {
      const count = submissions.filter(s => s.created_at.startsWith(date)).length;
      return {
        date: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
        submissions: count
      };
    });
    return data;
  }, [submissions]);

  const activePracticalsCount = practicals.filter(p => new Date(p.deadline || new Date()).getTime() >= Date.now()).length;
  const eventsByDate = useMemo(() => {
    const map = new Map<string, Practical[]>();
    practicals.forEach((p) => {
      const iso = new Date(p.deadline || new Date()).toISOString().slice(0, 10);
      const arr = map.get(iso) ?? [];
      arr.push(p);
      map.set(iso, arr);
    });
    return map;
  }, [practicals]);

  // Dates with events for Calendar modifiers
  const eventDates = useMemo(() => {
    return practicals.map(p => new Date(p.deadline || new Date()));
  }, [practicals]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 dark:from-gray-950 dark:via-indigo-950/10 dark:to-purple-950/10">
      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 xl:px-12 w-full mx-auto">
        {/* Header Section */}
        <motion.div
          variants={shellVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12"
        >
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-gray-900 dark:text-white tracking-tight">
              Welcome back, <span className="text-gradient">{userName || (loading ? "..." : "Faculty")}</span> 👋
            </h1>
            <p className="text-gray-500 dark:text-gray-400 font-medium">
              Manage your practicals and track student performance.
            </p>
          </div>
          <button
            onClick={() => openCreate()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all hover:-translate-y-0.5"
          >
            <Plus size={20} />
            Create Practical
          </button>
        </motion.div>

        {/* BENTO GRID */}
        {loading || dataLoading ? (
          <FacultyDashboardSkeleton />
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6"
          >

            {/* 1. Quick Stats (Row 1) - Solid Gradient Icons */}
            <motion.div variants={itemVariants} className="glass-card-premium rounded-3xl p-6 hover-lift">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Active Practicals</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{activePracticalsCount}</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg">
                  <FileCheck className="w-6 h-6 text-white" />
                </div>
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="glass-card-premium rounded-3xl p-6 hover-lift">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total Submissions</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{submissions.length}</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
              </div>
            </motion.div>

            <motion.div variants={itemVariants} className="glass-card-premium rounded-3xl p-6 hover-lift">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">My Subjects</p>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{subjects.length}</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
              </div>
            </motion.div>

            <motion.div
              variants={itemVariants}
              onClick={() => router.push("/faculty/submissions")}
              className="glass-card rounded-2xl p-5 flex items-center gap-4 hover-lift group bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 cursor-pointer"
            >
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                <FileCheck className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white">Review Work</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">5 Pending Grinds</p>
              </div>
              <ArrowUpRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-all" />
            </motion.div>


            {/* 2. Charts Row (Row 2, split 2:2 or 3:1) */}

            {/* Activity Chart (Wide) - Reduced Height */}
            <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-3 glass-card-premium rounded-3xl p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Submission Activity</h3>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={activityData}>
                    <defs>
                      <linearGradient id="colorSubs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156, 163, 175, 0.2)" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#9ca3af', fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: 'rgba(255, 255, 255, 0.8)', borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="submissions"
                      stroke="#8b5cf6"
                      strokeWidth={3}
                      fillOpacity={1}
                      fill="url(#colorSubs)"
                      isAnimationActive={true}
                      animationDuration={1500}
                      animationEasing="ease-in-out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Status Donut Chart */}
            <motion.div variants={itemVariants} className="md:col-span-1 glass-card-premium rounded-3xl p-6 flex flex-col">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Submission Status</h3>
              <div className="flex-1 min-h-[200px] relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      isAnimationActive={true}
                      animationBegin={500}
                      animationDuration={1200}
                      animationEasing="ease-out"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Stat */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                  <span className="text-3xl font-bold text-gray-900 dark:text-white">{submissions.length}</span>
                  <span className="text-xs text-gray-500">Total</span>
                </div>
              </div>
            </motion.div>

            {/* 3. Main Content: List & Calendar */}

            {/* Practicals List (Wide) */}
            <motion.div variants={itemVariants} className="md:col-span-2 lg:col-span-3 glass-card-premium rounded-3xl p-6 min-h-[400px]">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Recent Practicals</h3>
                <button
                  onClick={() => router.push("/dashboard/faculty/practicals")}
                  className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors"
                >
                  View All <ArrowRight size={16} />
                </button>
              </div>

              <div className="space-y-4">
                {practicals.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                      <FileCheck className="text-gray-400" size={32} />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No practicals found</h3>
                    <p className="text-gray-500 max-w-xs mx-auto mt-2">Create your first practical to start assigning work to students.</p>
                  </div>
                ) : (
                  practicals.slice(0, 5).map(p => {
                    const subj = subjects.find(s => s.id === p.subject_id)?.subject_name || "Subject";
                    return <PracticalCard key={p.id} practical={p} subject={subj} onEdit={openEdit} onDelete={deletePractical} />;
                  })
                )}
              </div>
            </motion.div>

            {/* Calendar (Narrow) */}
            <motion.div variants={itemVariants} className="md:col-span-1 glass-card-premium rounded-3xl p-6 relative overflow-hidden">
              {/* Gradient overlay */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-indigo-500/10 via-purple-500/5 to-transparent rounded-full blur-2xl" />

              <div className="relative z-10">
                {/* Header with icon */}
                <div className="flex items-center gap-3 mb-5">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
                    <Clock size={18} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Schedule</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Click a date to create practical</p>
                  </div>
                </div>

                {/* Calendar */}
                <div className="bg-white/50 dark:bg-gray-800/50 rounded-2xl p-3 backdrop-blur-sm border border-gray-100 dark:border-gray-700/50">
                  <Calendar
                    mode="single"
                    selected={selected}
                    onSelect={(d) => d && setSelected(d)}
                    className="rounded-xl border-none shadow-none"
                    modifiers={{
                      hasEvent: eventDates
                    }}
                    modifiersClassNames={{
                      hasEvent: "after:content-[''] after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:bg-indigo-500 after:rounded-full"
                    }}
                  />
                </div>

                {/* Upcoming Deadlines */}
                <div className="mt-8 space-y-4">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Upcoming Deadlines</p>
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-800/50">
                      {practicals.filter(p => new Date(p.deadline || new Date()) >= new Date()).length} active
                    </span>
                  </div>

                  {practicals.filter(p => new Date(p.deadline || new Date()) >= new Date()).length === 0 ? (
                    <div className="text-center py-8 px-4 rounded-xl bg-gray-50/50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700/50 border-dashed">
                      <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white dark:bg-gray-700 shadow-sm flex items-center justify-center">
                        <Clock size={20} className="text-gray-300 dark:text-gray-500" />
                      </div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">All caught up!</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">No pending deadlines for now.</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {practicals.filter(p => new Date(p.deadline || new Date()) >= new Date()).slice(0, 4).map((p, index) => {
                        const deadline = new Date(p.deadline || new Date());
                        const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                        const isUrgent = daysLeft <= 2;

                        return (
                          <motion.div
                            key={p.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer hover:scale-[1.02]",
                              isUrgent
                                ? "bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border border-orange-200 dark:border-orange-800/50"
                                : "bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800"
                            )}
                          >
                            <div className={cn(
                              "p-2 rounded-lg shadow-sm",
                              isUrgent
                                ? "bg-gradient-to-br from-orange-500 to-red-500"
                                : "bg-white dark:bg-gray-700"
                            )}>
                              <Clock size={14} className={isUrgent ? "text-white" : "text-indigo-500"} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.title}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                              </p>
                            </div>
                            <span className={cn(
                              "text-xs font-semibold px-2 py-1 rounded-lg",
                              isUrgent
                                ? "text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30"
                                : "text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700"
                            )}>
                              {daysLeft === 0 ? 'Today' : daysLeft === 1 ? '1 day' : `${daysLeft}d`}
                            </span>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

          </motion.div>
        )}

        {/* Practical Modal */}
        <PracticalForm
          isOpen={modalOpen}
          practical={editingPractical}
          subjects={subjects}
          supabase={supabase}
          sampleCode={sampleCode}
          setSampleCode={setSampleCode}
          sampleLanguage={sampleLanguage}
          setSampleLanguage={setSampleLanguage}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            fetchPracticals();
            setModalOpen(false);
          }}
        />

      </main>
    </div>
  );
}