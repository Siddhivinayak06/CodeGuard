"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import PracticalForm from "../components/PracticalForm";
import PracticalList from "../components/PracticalList";
import StudentAssignmentForm from "../components/StudentAssignmentForm";
import { Calendar } from "@/components/ui/calendar";
import { format, isSameDay, parseISO } from "date-fns";

import { Practical, Subject, Student } from "../types";

// ---------------------- Icons ----------------------
const PlusIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const CloseIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const SpinnerIcon = () => (
  <svg className="animate-spin h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

const AlertIcon = () => (
  <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
  </svg>
);

const CalendarIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const ListIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
  </svg>
);

// ---------------------- Loading State ----------------------
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <SpinnerIcon />
      <p className="mt-4 text-lg font-medium text-gray-700 dark:text-gray-300">
        Loading practicals...
      </p>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        Please wait while we fetch your data
      </p>
    </div>
  );
}

// ---------------------- Error State ----------------------
function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4">
      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-full">
        <AlertIcon />
      </div>
      <h3 className="mt-6 text-xl font-bold text-gray-900 dark:text-white">
        Oops! Something went wrong
      </h3>
      <p className="mt-2 text-center text-gray-600 dark:text-gray-400 max-w-md">
        {message}
      </p>
      <button
        onClick={() => window.location.reload()}
        className="mt-6 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
      >
        Try Again
      </button>
    </div>
  );
}

// ---------------------- Main Component ----------------------
export default function FacultySchedulePage() {
  const supabase = useMemo(() => createClient(), []);
  const [practicals, setPracticals] = useState<Practical[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingPractical, setEditingPractical] = useState<Practical | null>(null);

  const [sampleCode, setSampleCode] = useState<string>("");
  const [sampleLanguage, setSampleLanguage] = useState<string>("c");

  const [assignmentModalOpen, setAssignmentModalOpen] = useState(false);
  const [selectedPracticalId, setSelectedPracticalId] = useState<number | null>(null);

  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // Derived state for calendar
  const practicalsOnSelectedDate = useMemo(() => {
    if (!selectedDate) return [];
    return practicals.filter(p => {
      if (!p.deadline) return false;
      return isSameDay(parseISO(p.deadline), selectedDate);
    });
  }, [practicals, selectedDate]);

  const daysWithPracticals = useMemo(() => {
    return practicals
      .filter(p => p.deadline)
      .map(p => parseISO(p.deadline!));
  }, [practicals]);

  // ------------------- Fetch Data -------------------
  const fetchPracticals = async () => {
    setLoading(true);
    setError(null);
    try {
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      if (userErr) {
        console.error("Failed to get user:", userErr);
        setError("Failed to get authenticated user.");
        setPracticals([]);
        return;
      }
      if (!user) {
        setError("No authenticated user found.");
        setPracticals([]);
        return;
      }

      const { data: facultySubjects, error: subjErr } = await supabase
        .from("subjects")
        .select("id, subject_name")
        .eq("faculty_id", user.id);

      if (subjErr) {
        console.error("Failed to fetch subjects for faculty:", subjErr);
        setError("Failed to load subjects.");
        setPracticals([]);
        return;
      }

      const subjectIds = (facultySubjects ?? []).map((s: any) => s.id);

      if (subjectIds.length === 0) {
        setPracticals([]);
        return;
      }

      const { data, error } = await supabase
        .from("practicals")
        .select("*")
        .in("subject_id", subjectIds)
        .order("deadline", { ascending: true });

      if (error) {
        console.error("Failed to fetch practicals:", error);
        setError("Failed to load practicals.");
        setPracticals([]);
      } else {
        setPracticals(data ?? []);
      }
    } catch (err) {
      console.error("Unexpected error in fetchPracticals:", err);
      setError("Unexpected error occurred.");
      setPracticals([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjects = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setSubjects([]);
        return;
      }

      const { data, error } = await supabase
        .from("subjects")
        .select("*")
        .eq("faculty_id", user.id);

      if (error) {
        console.error("Failed to fetch subjects:", error);
        setSubjects([]);
        return;
      }

      if (data) setSubjects(data as Subject[]);
    } catch (err) {
      console.error("Unexpected error in fetchSubjects:", err);
      setSubjects([]);
    }
  };

  const fetchStudents = async () => {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("uid, name, role")
        .eq("role", "student");

      if (error) {
        console.error("Failed to fetch students:", error, error?.message ?? null);
        setStudents([]);
        return;
      }

      if (!data) {
        setStudents([]);
        return;
      }

      const mapped = (data as any[])
        .filter((u) => u && u.uid)
        .map((u) => ({
          uid: String(u.uid), // Changed id to uid
          name: u.name
        }));

      setStudents(mapped as Student[]);
    } catch (err) {
      console.error("Unexpected error fetching students:", err);
      setStudents([]);
    }
  };

  useEffect(() => {
    fetchPracticals();
    fetchSubjects();
    fetchStudents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------- Modal Handlers -------------------
  const openCreate = () => {
    setEditingPractical(null);
    setSampleCode("");
    setSampleLanguage("c");
    setModalOpen(true);
  };

  const openEdit = async (p: Practical) => {
    setEditingPractical(p);

    const { data: refs, error } = await supabase
      .from("reference_codes")
      .select("*")
      .eq("practical_id", p.id)
      .order("created_at", { ascending: false });

    if (!error && refs && refs.length > 0) {
      setSampleCode(refs[0].code || "");
      setSampleLanguage(refs[0].language || "c");
    } else {
      setSampleCode("");
      setSampleLanguage("c");
    }

    setModalOpen(true);
  };

  const openAssign = (practicalId: number) => {
    setSelectedPracticalId(practicalId);
    setAssignmentModalOpen(true);
  };

  const deletePractical = async (id: number) => {
    if (!confirm("Delete this practical?")) return;
    const { error } = await supabase.from("practicals").delete().eq("id", id);
    if (error) {
      console.error("Failed to delete practical:", error);
    } else {
      fetchPracticals();
    }
  };

  // ------------------- Render -------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50/40 via-purple-50/40 to-pink-50/40 dark:from-gray-950 dark:via-indigo-950/20 dark:to-purple-950/20">

      <main className="w-full mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 pt-24 pb-12">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl shadow-lg">
                <CalendarIcon />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-gray-900 via-blue-900 to-purple-900 dark:from-white dark:via-blue-200 dark:to-purple-200 bg-clip-text text-transparent">
                  Practical Schedule
                </h1>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Manage and organize your practical assignments
                </p>
              </div>
            </div>

            <button
              onClick={openCreate}
              className="btn-primary flex items-center gap-2 px-6 py-3 rounded-xl hover-lift"
            >
              <PlusIcon />
              <span>Add Practical</span>
            </button>
          </div>

          <div className="mt-6 flex items-center justify-between">
            {/* View Toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
              <button
                onClick={() => setViewMode("list")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === "list"
                    ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
              >
                <ListIcon />
                List
              </button>
              <button
                onClick={() => setViewMode("calendar")}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === "calendar"
                    ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                  }`}
              >
                <CalendarIcon />
                Calendar
              </button>
            </div>

            <div className="text-sm text-gray-500 dark:text-gray-400">
              {practicals.length} assignments found
            </div>
          </div>

          {/* Stats Bar */}
          {!loading && !error && (
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="glass-card-premium rounded-2xl p-5 hover-lift animate-slideUp" style={{ animationDelay: "100ms" }}>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
                    <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Practicals</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{practicals.length}</p>
                  </div>
                </div>
              </div>

              <div className="glass-card-premium rounded-2xl p-5 hover-lift animate-slideUp" style={{ animationDelay: "200ms" }}>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl">
                    <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Students</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{students.length}</p>
                  </div>
                </div>
              </div>

              <div className="glass-card-premium rounded-2xl p-5 hover-lift animate-slideUp" style={{ animationDelay: "300ms" }}>
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl">
                    <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 00.787 0l7-3a1 1 0 000-1.838l-7-3zM3.31 9.397L5 10.12v4.102a8.969 8.969 0 00-1.05-.174 1 1 0 01-.89-.89 11.115 11.115 0 01.25-3.762zM9.3 16.573A9.026 9.026 0 007 14.935v-3.957l1.818.78a3 3 0 002.364 0l5.508-2.361a11.026 11.026 0 01.25 3.762 1 1 0 01-.89.89 8.968 8.968 0 00-5.35 2.524 1 1 0 01-1.4 0zM6 18a1 1 0 001-1v-2.065a8.935 8.935 0 00-2-.712V17a1 1 0 001 1z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Subjects</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{subjects.length}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content Section */}
        <div className="glass-panel rounded-2xl p-6 hover-lift animate-slideUp" style={{ animationDelay: "400ms" }}>
          {loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} />
          ) : viewMode === "list" ? (
            <PracticalList
              practicals={practicals}
              subjects={subjects}
              onEdit={openEdit}
              onAssign={openAssign}
              onDelete={deletePractical}
            />
          ) : (
            <div className="flex flex-col md:flex-row gap-8">
              <div className="md:w-[400px] flex-shrink-0">
                <div className="p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    className="rounded-md"
                    modifiers={{
                      hasPractical: daysWithPracticals
                    }}
                    modifiersStyles={{
                      hasPractical: {
                        fontWeight: "bold",
                        textDecoration: "underline",
                        textDecorationColor: "#3b82f6",
                        textDecorationThickness: "3px"
                      }
                    }}
                  />
                </div>
                <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl border border-blue-100 dark:border-blue-900/30">
                  <h4 className="flex items-center gap-2 font-medium text-blue-800 dark:text-blue-200">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    Pending Deadlines
                  </h4>
                  <p className="mt-1 text-xs text-blue-600 dark:text-blue-300">
                    Dates with underlines indicate assignment deadlines.
                  </p>
                </div>
              </div>

              <div className="flex-1">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                  {selectedDate ? (
                    <>
                      Deadlines for <span className="text-blue-600 dark:text-blue-400">{format(selectedDate, "MMMM do, yyyy")}</span>
                    </>
                  ) : (
                    "Select a date to view deadlines"
                  )}
                </h3>

                {practicalsOnSelectedDate.length > 0 ? (
                  <PracticalList
                    practicals={practicalsOnSelectedDate}
                    subjects={subjects}
                    onEdit={openEdit}
                    onAssign={openAssign}
                    onDelete={deletePractical}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-full mb-3">
                      <CalendarIcon />
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 font-medium">No deadlines on this date</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Practical Form Modal logic handled inside component */}
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
          isOpen={modalOpen}
        />

        {/* Student Assignment Modal */}
        {assignmentModalOpen && selectedPracticalId && (
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto pt-16 pb-8">
            <div className="w-full max-w-4xl mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 animate-in fade-in slide-in-from-top-4 duration-300">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gradient-to-br from-emerald-600 to-blue-600 rounded-lg">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Assign to Students
                  </h2>
                </div>
                <button
                  onClick={() => setAssignmentModalOpen(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  title="Close"
                >
                  <CloseIcon />
                </button>
              </div>

              {/* Modal Content */}
              <div className="max-h-[calc(100vh-12rem)] overflow-y-auto">
                <StudentAssignmentForm
                  practicalId={selectedPracticalId}
                  close={() => setAssignmentModalOpen(false)}
                  refresh={fetchPracticals}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}