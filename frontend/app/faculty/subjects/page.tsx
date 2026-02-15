"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import type { User } from "@supabase/supabase-js";
import {
  BookOpen,
  FileCheck,
  ChevronRight,
  Clock,
  TrendingUp,
  Sparkles,
  Plus,
  Search,
  RefreshCw,
  Eye,
  X,
  FileText,
  CheckCircle2,
  ListFilter,
  Pencil,
} from "lucide-react";

import { Practical, Subject, TestCase } from "../types";

// dynamic import of PracticalForm to avoid SSR issues
const PracticalForm = dynamic(() => import("../components/PracticalForm"), {
  ssr: false,
});
const BulkImportModal = dynamic(() => import("../components/BulkImportModal"), {
  ssr: false,
});

// interface removed

export default function FacultySubjects() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const mountedRef = useRef(true);

  const [user, setUser] = useState<User | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selected, setSelected] = useState<number | string | null>(null);
  const [practicals, setPracticals] = useState<Practical[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [practicalsLoading, setPracticalsLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Modal & form states
  const [showPracticalModal, setShowPracticalModal] = useState(false);
  const [editingPractical, setEditingPractical] = useState<Practical | null>(
    null,
  );
  const [sampleCode, setSampleCode] = useState<string>(""); // initial sample code
  const [sampleLanguage, setSampleLanguage] = useState<string>("c");
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [importedPracticals, setImportedPracticals] = useState<any[]>([]);

  // View Modal state
  const [viewingPractical, setViewingPractical] = useState<Practical | null>(
    null,
  );

  // helpers
  const formatDate = (d?: string | null) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleDateString();
    } catch {
      return d;
    }
  };

  // --- put this useEffect inside your FacultySubjects component (near other useEffects) ---
  useEffect(() => {
    if (!showPracticalModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleModalClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showPracticalModal]);

  useEffect(() => {
    mountedRef.current = true;
    const fetchUser = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!data.user) {
          router.push("/auth/login");
          return;
        }
        if (!mountedRef.current) return;
        setUser(data.user);
      } catch (err) {
        console.error("Failed to fetch user:", err);
        router.push("/auth/login");
      }
    };

    fetchUser();
    return () => {
      mountedRef.current = false;
    };
  }, [router, supabase]);
  useEffect(() => {
    if (!user) return;
    let isMounted = true;

    const fetchSubjects = async () => {
      try {
        if (!user?.id) {
          console.warn("fetchSubjects: missing user.id", user);
          if (isMounted) setSubjects([]);
          return;
        }

        // First, get subject IDs assigned to this faculty via the junction table
        const { data: facultySubjects, error: fbError } = await supabase
          .from("subject_faculty_batches")
          .select("subject_id")
          .eq("faculty_id", user.id);

        if (fbError) {
          console.error("Error loading faculty subjects:", fbError?.message ?? fbError);
          if (isMounted) setSubjects([]);
          return;
        }

        const subjectIds = [...new Set((facultySubjects || []).map((fs) => fs.subject_id))];

        if (subjectIds.length === 0) {
          if (isMounted) setSubjects([]);
          return;
        }

        // Then get the actual subject details
        const res = await supabase
          .from("subjects")
          .select(`id, subject_name, subject_code, practicals(id), semester`)
          .in("id", subjectIds)
          .order("subject_name", { ascending: true });

        // Supabase returns { data, error }
        const { data, error } = res;

        if (error) {
          // Log useful bits (message/code) but avoid over-stringifying large stacks
          console.error(
            "Supabase error loading subjects:",
            error?.message ?? error,
            error?.code ? `code=${error.code}` : "",
          );
          if (isMounted) setSubjects([]);
          return;
        }

        if (!isMounted) return;

        const formatted = (data || []).map((s) => ({
          id: s.id,
          subject_name: s.subject_name,
          subject_code: s.subject_code,
          faculty_id: user.id, // We filtered by user.id so this is safe
          created_at: new Date().toISOString(), // Mocking if not selected, or should select it.
          semester: s.semester || "",
          practical_count: Array.isArray(s.practicals)
            ? s.practicals.length
            : 0,
        }));

        if (isMounted) {
          setSubjects(formatted);
          // Only auto-select if nothing is selected
          const firstId = formatted[0]?.id;
          if (firstId) {
            setSelected((prev) => prev || firstId);
          }
        }
      } catch (err) {
        // Ignore AbortError behavior (shouldn't happen since we removed AbortController),
        // but handle generically and log a short message.
        const msg = err instanceof Error ? err.message : String(err);
        console.error("Unexpected error fetching subjects:", msg);
        if (isMounted) setSubjects([]);
      } finally {
        if (isMounted) setInitialLoading(false);
      }
    };

    fetchSubjects();

    return () => {
      isMounted = false;
    };
  }, [user, supabase, refreshKey]);

  const loadPracticals = useCallback(
    async (subjectId: number | string) => {
      setPracticalsLoading(true);
      try {
        const { data, error } = await supabase
          .from("practicals")
          .select(`id, title, submissions(id)`)
          .eq("subject_id", Number(subjectId))
          .order("created_at", { ascending: false });

        if (error) throw error;

        const formatted = (data || []).map((p) => ({
          id: p.id,
          title: p.title,

          description: null,
          language: null,
          max_marks: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          submitted: false,
          subject_id: Number(subjectId),
          submission_count: p.submissions?.length || 0,
        }));

        setPracticals(formatted);
      } catch (err) {
        console.error("Failed to load practicals:", err);
        setPracticals([]);
      } finally {
        setPracticalsLoading(false);
      }
    },
    [supabase],
  );

  useEffect(() => {
    if (selected) {
      loadPracticals(selected);
    }
  }, [selected, loadPracticals]);



  const handleViewPractical = async (practical: Practical) => {
    try {
      // 1. Fetch full practical details
      const { data: practicalData, error: practicalError } = await supabase
        .from("practicals")
        .select("*")
        .eq("id", practical.id)
        .single();

      if (practicalError) throw practicalError;

      // 2. Fetch test cases
      const { data: testCases, error: tcError } = await supabase
        .from("test_cases")
        .select("*")
        .eq("practical_id", practical.id)
        .order("id", { ascending: true });

      if (tcError) throw tcError;

      setViewingPractical({
        ...practicalData,
        testCases: testCases || [],
      });
    } catch (err) {
      console.error("Failed to fetch practical details:", err);
      alert("Failed to load practical details.");
    }
  };

  const openNewPractical = () => {
    setEditingPractical(null);
    setSampleCode("");
    setSampleLanguage("c");
    setImportedPracticals([]);
    setShowPracticalModal(true);
  };

  const openEditPractical = async (practicalId: number | string) => {
    // fetch practical to edit (optional, if not already loaded)
    try {
      const { data, error } = await supabase
        .from("practicals")
        .select("*")
        .eq("id", Number(practicalId))
        .single();
      if (error) throw error;
      setEditingPractical(data as Practical);

      // optionally load sample code from your DB if you store it
      setImportedPracticals([]);
      setShowPracticalModal(true);
    } catch (err) {
      console.error("Failed to fetch practical for edit:", err);
      alert("Failed to load practical for editing.");
    }
  };

  const handleModalClose = () => {
    setShowPracticalModal(false);
    setEditingPractical(null);
    setImportedPracticals([]);
  };

  const handleSaved = () => {
    // refresh subjects/practicals after create/update
    setRefreshKey((k) => k + 1);
    // if a subject is selected, reload its practicals after a small delay (ensures DB write finished)
    if (selected) setTimeout(() => loadPracticals(selected), 400);
    // Do not close modal automatically if there are more drafts, or if user wants to create more
    // But for now, we close it as per original logic. User can re-open.
    // If we support multi-save, we might want to keep it open.
    // existing logic closes it.
    handleModalClose();
  };

  const handleBulkImport = async (importedPracticals: any[]) => {
    if (!selected) return;

    // OLD LOGIC: Create all practicals immediately
    // NEW LOGIC: Load them into the PracticalForm as drafts
    setImportedPracticals(importedPracticals);
    setShowBulkImport(false);
    setShowPracticalModal(true);
  };

  const totalPracticals = subjects.reduce(
    (sum, s) => sum + (s.practical_count || 0),
    0,
  );
  const selectedSubject = subjects.find((s) => s.id === selected);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-950 dark:via-purple-950/20 dark:to-blue-950/20">
      <main className="pt-24 px-4 sm:px-6 lg:px-8 xl:px-12 w-full mx-auto pb-12">
        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-lg">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">
                My Subjects
              </h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Manage subjects, practicals and submissions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-white/60 dark:bg-white/5 p-2 rounded-xl border border-white/30 dark:border-white/10 shadow-sm">
              <Search className="w-4 h-4 mr-2 text-gray-500" />
              <input
                aria-label="Search subjects"
                placeholder="Search subjects..."
                onChange={() => { }}
                className="bg-transparent outline-none text-sm w-56"
              />
            </div>

            {selected && (
              <button
                onClick={() => setShowBulkImport(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm transition-all"
              >
                <FileCheck size={18} />
                Import from PDF
              </button>
            )}

            <button
              onClick={openNewPractical}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all hover:-translate-y-0.5"
            >
              <Plus size={20} />
              New Practical
            </button>

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setRefreshKey((k) => k + 1)}
              className="flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="glass-card-premium rounded-3xl p-6 hover-lift">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total Subjects
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {subjects.length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center shadow-lg">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="glass-card-premium rounded-3xl p-6 hover-lift">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total Practicals
                </p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {totalPracticals}
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg">
                <FileCheck className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>

          <div className="glass-card-premium rounded-3xl p-6 hover-lift bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-950/20 dark:to-purple-950/20">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Active Subject
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2 truncate max-w-[200px]">
                  {selectedSubject ? selectedSubject.subject_name : "—"}
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 flex items-center justify-center shadow-lg">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        </div>

        {/* Main area: Unified Container with Subjects list and Practicals */}
        <div className="glass-card-premium rounded-3xl overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* Subjects column */}
            <aside className="lg:col-span-4 lg:border-r border-gray-100 dark:border-gray-800">
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Your Subjects
                  </h3>
                  <span className="text-sm text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-lg">
                    {subjects.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {initialLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={i}
                        className="animate-pulse h-14 rounded-xl bg-gray-100 dark:bg-gray-800"
                      />
                    ))
                  ) : subjects.length === 0 ? (
                    <div className="text-center py-8 text-sm text-gray-600">
                      No subjects found
                    </div>
                  ) : (
                    subjects.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSelected(s.id)}
                        className={`w-full text-left flex items-center gap-3 p-3 rounded-xl transition-all ${selected === s.id
                          ? "bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/30 dark:to-purple-900/30 border border-indigo-200 dark:border-indigo-800"
                          : "hover:bg-gray-50 dark:hover:bg-gray-800/50 border border-transparent"
                          }`}
                        aria-pressed={selected === s.id}
                      >
                        <div
                          className={`p-2 rounded-lg ${selected === s.id ? "bg-gradient-to-br from-indigo-500 to-purple-500" : "bg-gray-100 dark:bg-gray-800"}`}
                        >
                          <BookOpen
                            className={`w-5 h-5 ${selected === s.id ? "text-white" : "text-purple-600 dark:text-purple-400"}`}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white truncate">
                            {s.subject_name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {s.subject_code} • {s.practical_count} practicals
                          </div>
                        </div>
                        <ChevronRight
                          className={`w-4 h-4 shrink-0 transition-colors ${selected === s.id ? "text-indigo-500" : "text-gray-300 dark:text-gray-600"}`}
                        />
                      </button>
                    ))
                  )}
                </div>
              </div>
            </aside>

            {/* Practicals column */}
            <section className="lg:col-span-8">
              <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {selectedSubject?.subject_name || "Select a subject"}
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Managing {practicals.length} practical
                    {practicals.length !== 1 ? "s" : ""}
                  </p>
                </div>
                {selectedSubject && (
                  <button
                    onClick={openNewPractical}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Practical
                  </button>
                )}
              </div>

              <div className="p-4">
                {practicalsLoading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="animate-pulse h-16 rounded-xl bg-gray-100 dark:bg-gray-800"
                      />
                    ))}
                  </div>
                ) : practialsEmpty(practicals) ? (
                  <div className="p-12 text-center">
                    <div className="inline-flex p-6 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full mb-4">
                      <FileCheck className="w-12 h-12 text-gray-400" />
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 font-medium">
                      No practicals found
                    </p>
                    <p className="text-gray-500 text-sm mt-2">
                      Create a practical or select another subject.
                    </p>
                    <div className="mt-4">
                      <button
                        onClick={openNewPractical}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all hover:-translate-y-0.5"
                      >
                        <Plus size={20} />
                        Create Practical
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {practicals.map((p) => {

                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between p-4 bg-white dark:bg-gray-800/60 border border-gray-100 dark:border-gray-700/50 rounded-xl hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800/50 transition-all"
                        >
                          {/* Left: Title & Deadline */}
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 dark:text-white truncate">
                              {p.title}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs font-medium text-gray-500">
                                Created: {new Date(p.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          {/* Middle: Submissions Badge (Clickable) */}
                          <div className="px-4">
                            <button
                              onClick={() =>
                                router.push(
                                  `/faculty/submissions?practical=${p.id}`,
                                )
                              }
                              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${p.submission_count && p.submission_count > 0
                                ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                                : "bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                                }`}
                            >
                              <BookOpen className="w-4 h-4" />
                              {p.submission_count || 0} Submissions
                            </button>
                          </div>

                          {/* Right: Actions */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleViewPractical(p)}
                              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
                              title="Preview"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEditPractical(p.id)}
                              className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {/* Inline Add Button */}
                    <button
                      onClick={openNewPractical}
                      className="w-full p-4 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl text-gray-500 dark:text-gray-400 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition-all flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add New Practical
                    </button>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      </main>

      <PracticalForm
        isOpen={showPracticalModal}
        practical={editingPractical}
        subjects={subjects}
        supabase={supabase}
        sampleCode={sampleCode}
        setSampleCode={setSampleCode}
        sampleLanguage={sampleLanguage}
        setSampleLanguage={setSampleLanguage}
        onClose={handleModalClose}
        onSaved={handleSaved}
        defaultSubjectId={selected}
        initialDrafts={importedPracticals}
      />

      <BulkImportModal
        isOpen={showBulkImport}
        onClose={() => setShowBulkImport(false)}
        onImport={handleBulkImport}
        subjectId={selected || ""}
      />

      {/* View Practical Modal */}
      {viewingPractical && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="glass-card-premium rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-scaleIn">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-lg">
                  <FileCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {viewingPractical.title}
                  </h3>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span className="font-mono">ID: {viewingPractical.id}</span>
                    <span>•</span>
                    <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                      {selectedSubject?.subject_name}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setViewingPractical(null)}
                className="rounded-full hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-6 bg-gray-50/50 dark:bg-gray-950/50">
              {/* Left Column: Description */}
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between">
                    <h4 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-indigo-500" />{" "}
                      Description
                    </h4>
                    {viewingPractical.language && (
                      <span className="text-xs font-mono px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase border border-gray-200 dark:border-gray-600">
                        {viewingPractical.language}
                      </span>
                    )}
                  </div>
                  <div className="p-4 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {viewingPractical.description || (
                      <span className="text-gray-400 italic">
                        No description provided
                      </span>
                    )}
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50">
                    <h4 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-500" /> Details
                    </h4>
                  </div>
                  <div className="p-4 space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Subject</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {selectedSubject?.subject_name}
                      </span>
                    </div>

                    {viewingPractical.submission_count !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Submissions</span>
                        <span className="font-medium text-gray-900 dark:text-white">
                          {viewingPractical.submission_count}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column: Test Cases */}
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between">
                    <h4 className="font-semibold text-gray-700 dark:text-gray-200 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Test
                      Cases
                    </h4>
                  </div>
                  <div className="p-4 space-y-3 max-h-[600px] overflow-auto">
                    {viewingPractical.testCases &&
                      viewingPractical.testCases.length > 0 ? (
                      viewingPractical.testCases.map((tc, idx) => (
                        <div
                          key={tc.id}
                          className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50/50 dark:bg-gray-900/50 transition-all hover:bg-white dark:hover:bg-gray-800 hover:shadow-md"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <span className="w-6 h-6 rounded-full flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-xs font-bold text-gray-600 dark:text-gray-300 shadow-inner">
                              {idx + 1}
                            </span>
                            <span className="font-medium text-xs text-gray-500 dark:text-gray-400">
                              {tc.is_hidden ? "Hidden" : "Public"}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 gap-3 text-xs">
                            <div>
                              <p className="text-gray-500 mb-1 font-medium">
                                Input
                              </p>
                              <div className="bg-white dark:bg-gray-950 p-2 rounded-lg border border-gray-200 dark:border-gray-700 font-mono truncate">
                                {tc.input || "—"}
                              </div>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1 font-medium">
                                Expected Output
                              </p>
                              <div className="bg-white dark:bg-gray-950 p-2 rounded-lg border border-gray-200 dark:border-gray-700 font-mono truncate">
                                {tc.expected_output || "—"}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                        <ListFilter className="w-8 h-8 opacity-20 mb-2" />
                        <p>No test cases found</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setViewingPractical(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .card {
          background: rgba(255, 255, 255, 0.4);
          backdrop-filter: blur(8px);
          border-radius: 16px;
          padding: 1rem;
          border: 1px solid rgba(255, 255, 255, 0.5);
        }
      `}</style>
    </div>
  );
}

// helper to detect empty practicals gracefully
function practialsEmpty(list: unknown[]) {
  return !list || list.length === 0;
}
