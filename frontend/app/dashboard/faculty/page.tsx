"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import type { User } from "@supabase/supabase-js";
import PracticalForm from "../../faculty/components/PracticalForm";

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

// ---------------------- Practical Card ----------------------
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
    <div className="group relative p-5 bg-white/40 dark:bg-gray-800/40 backdrop-blur-xl border border-white/20 dark:border-gray-700/30 rounded-2xl hover:bg-white/60 dark:hover:bg-gray-800/60 hover:shadow-xl hover:shadow-blue-500/10 dark:hover:shadow-blue-500/5 transition-all duration-300">
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
                    ? "bg-gradient-to-br from-gray-500/10 to-gray-600/10 dark:from-gray-500/20 dark:to-gray-600/20 border-gray-500/20 dark:border-gray-500/30 text-gray-700 dark:text-gray-300"
                    : timeUntil <= 2
                    ? "bg-gradient-to-br from-orange-500/10 to-red-500/10 dark:from-orange-500/20 dark:to-red-500/20 border-orange-500/20 dark:border-orange-500/30 text-orange-700 dark:text-orange-300"
                    : "bg-gradient-to-br from-green-500/10 to-emerald-500/10 dark:from-green-500/20 dark:to-emerald-500/20 border-green-500/20 dark:border-green-500/30 text-green-700 dark:text-green-300"
                )}
              >
                <div
                  className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    isPast ? "bg-gray-400" : timeUntil <= 2 ? "bg-orange-500 animate-pulse" : "bg-green-500"
                  )}
                />
                {isPast ? "Closed" : timeUntil <= 2 ? "Due Soon" : "Active"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="font-medium">
              {deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} • {deadline.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
            </span>
            {!isPast && timeUntil >= 0 && (
              <span className="text-xs px-2 py-0.5 bg-blue-500/10 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded-full">
                {timeUntil === 0 ? 'Due today' : timeUntil === 1 ? 'Due tomorrow' : `${timeUntil} days left`}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => onEdit(practical)}
            className="p-2.5 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-white/20 dark:border-gray-700/30 text-gray-700 dark:text-gray-300 hover:bg-blue-500/10 dark:hover:bg-blue-500/20 hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-500/30 rounded-xl transition-all"
            title="Edit"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            onClick={() => onDelete(practical.id)}
            className="p-2.5 bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-white/20 dark:border-gray-700/30 text-gray-700 dark:text-gray-300 hover:bg-red-500/10 dark:hover:bg-red-500/20 hover:text-red-600 dark:hover:text-red-400 hover:border-red-500/30 rounded-xl transition-all"
            title="Delete"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------- Calendar Panel ----------------------
function CalendarPanel({
  selected,
  setSelected,
  eventsByDate,
  onDateClick,
}: {
  selected: Date;
  setSelected: (d: Date) => void;
  eventsByDate: Map<string, Practical[]>;
  onDateClick: (d: Date) => void;
}) {
  const [hoveredDate, setHoveredDate] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  const upcomingCount = Array.from(eventsByDate.values()).flat().filter(p => new Date(p.deadline) >= new Date()).length;

  // events for currently selected date
  const selectedIso = selected.toISOString().slice(0, 10);
  const eventsForSelected = eventsByDate.get(selectedIso) ?? [];

  return (
    <div className="bg-white/40 dark:bg-gray-800/40 backdrop-blur-xl border border-white/20 dark:border-gray-700/30 rounded-2xl overflow-hidden">
      <div className="p-4 bg-gradient-to-br from-blue-500/8 to-purple-500/8 dark:from-blue-500/18 dark:to-purple-500/18 border-b border-white/20 dark:border-gray-700/30">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-lg text-gray-900 dark:text-white">Calendar</h2>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
              {selected.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="px-3 py-1.5 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm border border-white/10 dark:border-gray-700/30 rounded-full">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{upcomingCount} upcoming</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                <span className="w-2 h-2 rounded-full bg-green-500 block" />
                <span>Active</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                <span className="w-2 h-2 rounded-full bg-orange-500 block" />
                <span>Due Soon</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                <span className="w-2 h-2 rounded-full bg-gray-400 block" />
                <span>Closed</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => d && !isNaN(d.getTime()) && setSelected(d)}
          components={{
            DayButton: ({ day, ...props }) => {
              const date = day.date;
              if (!(date instanceof Date) || isNaN(date.getTime())) return <></>;

              const iso = date.toISOString().slice(0, 10);
              const events = eventsByDate.get(iso) ?? [];
              const hasEvent = events.length > 0;
              const isToday = iso === today;
              const isHovered = hoveredDate === iso;

              return (
                <div
                  className="relative w-full h-full flex items-center justify-center"
                  onMouseEnter={() => setHoveredDate(iso)}
                  onMouseLeave={() => setHoveredDate(null)}
                  onClick={() => onDateClick(date)}
                >
                  <CalendarDayButton
                    day={day}
                    {...props}
                    className={cn(
                      "relative w-10 h-10 flex flex-col items-center justify-center rounded-xl text-sm font-medium transition-all",
                      isToday && !hasEvent && "bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 ring-1 ring-blue-300/30",
                      hasEvent && "bg-gradient-to-br from-blue-500 to-purple-600 text-white shadow-md hover:shadow-lg hover:scale-105",
                      !hasEvent && !isToday && "hover:bg-white/50 dark:hover:bg-gray-800/50"
                    )}
                  >
                    {date.getDate()}
                    {hasEvent && (
                      <div className="absolute -bottom-1 flex gap-0.5">
                        {events.slice(0, 3).map((_, idx) => (
                          <div key={idx} className="w-1 h-1 rounded-full bg-white/90"></div>
                        ))}
                      </div>
                    )}
                  </CalendarDayButton>

                  {isHovered && hasEvent && (
                    <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 w-56 bg-gray-900/95 dark:bg-gray-800/95 backdrop-blur-xl border border-gray-700/50 text-white text-xs rounded-xl shadow-2xl p-3 pointer-events-none">
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-gray-900/95 dark:bg-gray-800/95 border-l border-t border-gray-700/50 rotate-45"></div>
                      <div className="font-medium text-gray-200 mb-2">
                        {events.length} Practical{events.length > 1 ? 's' : ''}
                      </div>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {events.map((e, idx) => (
                          <div key={idx} className="text-gray-300">
                            <div className="font-medium truncate">{e.title}</div>
                            <div className="text-[10px] text-gray-400">
                              {new Date(e.deadline).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            }
          }}
          className="w-full"
        />
      </div>
    </div>
  );
}

// ---------------------- Faculty Dashboard ----------------------
export default function FacultyDashboardPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [practicals, setPracticals] = useState<Practical[]>([]);
  const [selected, setSelected] = useState<Date>(new Date());
  const [modalOpen, setModalOpen] = useState(false);

  const [editingPractical, setEditingPractical] = useState<Practical | null>(null);
  const [form, setForm] = useState<Practical>(initialPracticalForm);
  const [testCases, setTestCases] = useState<TestCase[]>([initialTestCase]);
  const [sampleCode, setSampleCode] = useState<string>("");
  const [sampleLanguage, setSampleLanguage] = useState<string>("c");

  // Fetch authenticated user, then faculty subjects & practicals for those subjects
  useEffect(() => {
    const init = async () => {
      // get user
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.push("/auth/login");
        return;
      }
      setUser(data.user);
      setLoading(false);

      // fetch subjects for this faculty only
      const { data: subjData, error: subjErr } = await supabase
        .from("subjects")
        .select("*")
        .eq("faculty_id", data.user.id);

      if (!subjErr && subjData) {
        setSubjects(subjData as Subject[]);
      } else {
        setSubjects([]);
        console.error("Failed to fetch subjects for faculty:", subjErr);
      }

      // if faculty has subjects, fetch practicals for those subject ids
      try {
        const subjectIds = (subjData ?? []).map((s: any) => s.id);
        if (subjectIds.length === 0) {
          setPracticals([]);
        } else {
          const { data: pracData, error: pracErr } = await supabase
            .from("practicals")
            .select("*")
            .in("subject_id", subjectIds)
            .order("deadline", { ascending: true });

          if (!pracErr && pracData) {
            setPracticals(pracData as Practical[]);
          } else {
            setPracticals([]);
            console.error("Failed to fetch practicals:", pracErr);
          }
        }
      } catch (e) {
        console.error("Error fetching practicals:", e);
        setPracticals([]);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, router]);

  // helper to refresh practicals (keeps subject filter)
  const fetchPracticals = async () => {
    if (!user) return;
    const subjectIds = subjects.map((s) => s.id);
    if (subjectIds.length === 0) {
      setPracticals([]);
      return;
    }
    const { data, error } = await supabase
      .from("practicals")
      .select("*")
      .in("subject_id", subjectIds)
      .order("deadline", { ascending: true });

    if (!error && data) setPracticals(data as Practical[]);
    else {
      console.error("Failed to refresh practicals:", error);
      setPracticals([]);
    }
  };

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
    if (refs && refs.length > 0) setSampleCode(refs[0].code || "");

    setSampleLanguage(refs && refs.length > 0 ? refs[0].language : "c");
    setModalOpen(true);
  };

  const deletePractical = async (id: number) => {
    if (!confirm("Delete this practical?")) return;
    const { error } = await supabase.from("practicals").delete().eq("id", id);
    if (!error) setPracticals((prev) => prev.filter((p) => p.id !== id));
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-4 border-gray-200/50 dark:border-gray-700/50"></div>
          <div className="w-16 h-16 rounded-full border-4 border-blue-600 border-t-transparent animate-spin absolute top-0"></div>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 pt-20">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">Faculty Dashboard</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {practicals.length} total • {practicals.filter(p => new Date(p.deadline) >= new Date()).length} active • {practicals.filter(p => new Date(p.deadline) < new Date()).length} closed
            </p>
          </div>
          <button
            onClick={() => openCreate()}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-medium rounded-xl hover:shadow-lg hover:shadow-blue-500/25 transition-all backdrop-blur-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            New Practical
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Left column: sticky calendar */}
          <div className="lg:col-span-1">
            <div className="sticky top-28">
              <CalendarPanel selected={selected} setSelected={setSelected} eventsByDate={eventsByDate} onDateClick={openCreate} />
            </div>
          </div>

          {/* Right column: practicals */}
          <div className="lg:col-span-2">
            <div className="bg-white/40 dark:bg-gray-800/40 backdrop-blur-xl border border-white/20 dark:border-gray-700/30 rounded-2xl overflow-hidden">
              <div className="p-5 bg-gradient-to-br from-blue-500/10 to-purple-500/10 dark:from-blue-500/20 dark:to-purple-500/20 border-b border-white/20 dark:border-gray-700/30">
                <h2 className="font-semibold text-lg text-gray-900 dark:text-white">All Practicals</h2>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Manage your practical assignments</p>
              </div>
              <div className="max-h-[calc(100vh-300px)] overflow-y-auto p-4">
                {practicals.length === 0 ? (
                  <div className="p-16 text-center">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-blue-500/10 to-purple-500/10 dark:from-blue-500/20 dark:to-purple-500/20 backdrop-blur-sm mb-4">
                      <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-1">No practicals yet</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Create your first practical to get started</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {practicals.map((p) => {
                      // robust id compare in case one side is string
                      const subjObj = subjects.find((s) => String(s.id) === String(p.subject_id));
                      const subj = subjObj ? subjObj.subject_name : "Unknown";
                      return <PracticalCard key={p.id} practical={p} subject={subj} onEdit={openEdit} onDelete={deletePractical} />;
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Practical modal */}
         {modalOpen && (
                  <div
          className="fixed top-16 left-0 right-0 bottom-0 z-50 flex flex-col bg-white dark:bg-gray-900 overflow-y-auto"
        >
          {/* Top bar inside modal */}
          <div className="flex justify-between items-center p-4 border-b border-gray-300 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {editingPractical ? "Edit Practical" : "Add Practical"}
            </h2>
            <button
              onClick={() => setModalOpen(false)}
              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
            >
              Close
            </button>
          </div>
        
          {/* Practical Form */}
          <div className="flex-1 ">
            <PracticalForm
              practical={editingPractical}
              subjects={subjects}
              supabase={supabase}
              sampleCode={sampleCode}
              setSampleCode={setSampleCode}
              sampleLanguage={sampleLanguage}
              setSampleLanguage={setSampleLanguage}
              onClose={() => setModalOpen(false)}
              onSaved={fetchPracticals}
            />
          </div>
        </div>
        
                )}
        
      </main>
    </div>
  );
}
