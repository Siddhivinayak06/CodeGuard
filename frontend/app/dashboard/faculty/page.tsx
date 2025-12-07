"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import type { User } from "@supabase/supabase-js";
import PracticalForm from "../../faculty/components/PracticalForm";
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
  Legend,
  AreaChart,
  Area
} from "recharts";
import {
  Users,
  FileCheck,
  TrendingUp,
  Clock,
  CalendarDays,
  Plus,
  ArrowUpRight,
  MoreVertical,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), { ssr: false });

// ---------------------- Types ----------------------
type Subject = { id: number; subject_name: string; faculty_id?: string };
type Practical = {
  id: number;
  subject_id: number;
  title: string;
  description?: string;
  language?: string;
  deadline: string;
  max_marks: number;
};
type TestCase = {
  id?: number;
  input: string;
  expected_output: string;
  is_hidden?: boolean;
  time_limit_ms?: number;
  memory_limit_kb?: number;
};

// ---------------------- Initial States ----------------------
const initialPracticalForm: Practical = {
  id: 0,
  title: "",
  subject_id: 0,
  description: "",
  language: "",
  deadline: new Date().toISOString().slice(0, 16),
  max_marks: 100,
};
const initialTestCase: TestCase = {
  input: "",
  expected_output: "",
  is_hidden: false,
  time_limit_ms: 2000,
  memory_limit_kb: 65536,
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
  const isPast = new Date(practical.deadline) < new Date();
  const deadline = new Date(practical.deadline);
  const timeUntil = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

  return (
    <div className="group relative p-5 bg-white/40 dark:bg-gray-800/40 backdrop-blur-xl border border-white/20 dark:border-gray-700/30 rounded-2xl hover:bg-white/60 dark:hover:bg-gray-800/60 hover:shadow-xl transition-all duration-300">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <h3 className="font-semibold text-lg text-gray-900 dark:text-white mb-1.5 truncate">{practical.title}</h3>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-br from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20 border border-purple-500/20 dark:border-purple-500/30 text-purple-700 dark:text-purple-300 text-xs font-medium rounded-full backdrop-blur-sm">
                {subject}
              </span>
              {practical.language && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 dark:from-blue-500/20 dark:to-cyan-500/20 border border-blue-500/20 dark:border-blue-500/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded-full backdrop-blur-sm">
                  {practical.language}
                </span>
              )}
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full backdrop-blur-sm border",
                  isPast
                    ? "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700"
                    : timeUntil <= 2
                      ? "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 border-orange-200 dark:border-orange-800"
                      : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
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
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <Clock className="w-4 h-4" />
            <span className="font-medium">
              {deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} • {deadline.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => onEdit(practical)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(practical.id)}
            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
          >
            Delete
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
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [practicals, setPracticals] = useState<Practical[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selected, setSelected] = useState<Date>(new Date());
  const [modalOpen, setModalOpen] = useState(false);

  const [editingPractical, setEditingPractical] = useState<Practical | null>(null);
  const [form, setForm] = useState<Practical>(initialPracticalForm);
  const [testCases, setTestCases] = useState<TestCase[]>([initialTestCase]);
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
      const subjectIds = (subjData ?? []).map((s: any) => s.id);
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

            if (subData) setSubmissions(subData);
          }
        }
      }
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
    const deadline = date
      ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16);

    setEditingPractical(null);
    setForm({ ...initialPracticalForm, deadline });
    setTestCases([initialTestCase]);
    setSampleCode("");
    setSampleLanguage("c");
    setModalOpen(true);
  };

  const openEdit = async (p: Practical) => {
    setEditingPractical(p);
    setForm({ ...p, deadline: p.deadline.slice(0, 16) });

    const { data: tcs } = await supabase.from("test_cases").select("*").eq("practical_id", p.id);
    setTestCases(tcs && tcs.length > 0 ? tcs : [initialTestCase]);

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
    const counts = { submitted: 0, graded: 0, pending: 0, rejected: 0 };
    submissions.forEach(s => {
      const st = (s.status || "pending").toLowerCase();
      if (counts[st as keyof typeof counts] !== undefined) counts[st as keyof typeof counts]++;
      else counts.pending++;
    });
    return [
      { name: 'Submitted', value: counts.submitted, color: '#3b82f6' }, // blue
      { name: 'Graded', value: counts.graded, color: '#10b981' }, // green
      { name: 'Pending', value: counts.pending, color: '#fbbf24' }, // amber
      { name: 'Rejected', value: counts.rejected, color: '#ef4444' } // red
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

  const activePracticalsCount = practicals.filter(p => new Date(p.deadline) >= new Date()).length;
  const eventsByDate = useMemo(() => {
    const map = new Map<string, Practical[]>();
    practicals.forEach((p) => {
      const iso = new Date(p.deadline).toISOString().slice(0, 10);
      const arr = map.get(iso) ?? [];
      arr.push(p);
      map.set(iso, arr);
    });
    return map;
  }, [practicals]);

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-800">

      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 max-w-[1600px] mx-auto">

        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 animate-slideUp">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Welcome back, {userName || "Faculty"} 👋
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
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
        </div>

        {/* BENTO GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">

          {/* 1. Quick Stats (Row 1) */}
          <div className="glass-card-premium rounded-3xl p-6 flex items-center justify-between animate-slideUp animation-delay-100">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Active Practicals</p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{activePracticalsCount}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <FileCheck size={24} />
            </div>
          </div>

          <div className="glass-card-premium rounded-3xl p-6 flex items-center justify-between animate-slideUp animation-delay-150">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Total Submissions</p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">{submissions.length}</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <TrendingUp size={24} />
            </div>
          </div>

          <div className="glass-card-premium rounded-3xl p-6 flex items-center justify-between animate-slideUp animation-delay-200">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Students Assigned</p>
              <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-1">--</h3>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-pink-100 dark:bg-pink-900/40 flex items-center justify-center text-pink-600 dark:text-pink-400">
              <Users size={24} />
            </div>
          </div>

          {/* Quick Action Tile */}
          <div
            onClick={() => router.push("/faculty/submissions")}
            className="glass-card-premium rounded-3xl p-6 flex flex-col justify-center cursor-pointer hover:scale-[1.02] transition-transform animate-slideUp animation-delay-250 bg-gradient-to-br from-indigo-600 to-purple-600 text-white"
          >
            <div className="flex items-center justify-between mb-2">
              <FileCheck size={28} className="text-white/80" />
              <ArrowUpRight size={24} className="text-white/60" />
            </div>
            <h3 className="text-lg font-bold">Review Submissions</h3>
            <p className="text-white/70 text-sm">Grading pending for 5 students</p>
          </div>


          {/* 2. Charts Row (Row 2, split 2:2 or 3:1) */}

          {/* Activity Chart (Wide) */}
          <div className="md:col-span-2 lg:col-span-3 glass-card rounded-3xl p-6 animate-slideUp animation-delay-300">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Submission Activity</h3>
            <div className="h-[250px] w-full">
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
                  <Area type="monotone" dataKey="submissions" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorSubs)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Status Donut Chart */}
          <div className="md:col-span-1 glass-card rounded-3xl p-6 animate-slideUp animation-delay-300 flex flex-col">
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
          </div>

          {/* 3. Main Content: List & Calendar */}

          {/* Practicals List (Wide) */}
          <div className="md:col-span-2 lg:col-span-3 glass-card rounded-3xl p-6 animate-slideUp animation-delay-400 min-h-[400px]">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">All Practicals</h3>
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
                practicals.map(p => {
                  const subj = subjects.find(s => s.id === p.subject_id)?.subject_name || "Subject";
                  return <PracticalCard key={p.id} practical={p} subject={subj} onEdit={openEdit} onDelete={deletePractical} />;
                })
              )}
            </div>
          </div>

          {/* Calendar (Narrow) */}
          <div className="md:col-span-1 glass-card rounded-3xl p-6 animate-slideUp animation-delay-400">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Schedule</h3>
            <Calendar
              mode="single"
              selected={selected}
              onSelect={(d) => d && setSelected(d)}
              className="rounded-xl border border-gray-100 dark:border-gray-800"
              components={{
                DayButton: ({ day, ...props }) => {
                  const date = day.date;
                  if (!(date instanceof Date) || isNaN(date.getTime())) return <></>;
                  const iso = date.toISOString().slice(0, 10);
                  const hasEvent = eventsByDate.has(iso);
                  return (
                    <div className="relative w-full h-full flex items-center justify-center" onClick={() => openCreate(date)}>
                      <CalendarDayButton day={day} {...props} className={cn(
                        props.className,
                        hasEvent && "font-bold text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 dark:text-indigo-400"
                      )} />
                      {hasEvent && <div className="absolute bottom-1 w-1 h-1 bg-indigo-500 rounded-full" />}
                    </div>
                  )
                }
              }}
            />

            {/* Upcoming Events List */}
            <div className="mt-6 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Upcoming Deadlines</p>
              {practicals.filter(p => new Date(p.deadline) >= new Date()).slice(0, 3).map(p => (
                <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <div className="p-2 bg-white dark:bg-gray-700 rounded-lg shadow-sm">
                    <Clock size={16} className="text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.title}</p>
                    <p className="text-xs text-gray-500">{new Date(p.deadline).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

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