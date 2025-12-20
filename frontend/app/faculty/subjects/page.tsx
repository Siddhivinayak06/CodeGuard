"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
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
  ListFilter
} from "lucide-react";

import { Practical, Subject, TestCase } from "../types";

// dynamic import of PracticalForm to avoid SSR issues
const PracticalForm = dynamic(() => import("../components/PracticalForm"), { ssr: false });

interface ViewingPractical extends Practical {
  description?: string;
  language?: string;
  testCases?: TestCase[];
}

export default function FacultySubjects() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const mountedRef = useRef(true);

  const [user, setUser] = useState<User | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selected, setSelected] = useState<number | string | null>(null);
  const [practicals, setPracticals] = useState<Practical[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Modal & form states
  const [showPracticalModal, setShowPracticalModal] = useState(false);
  const [editingPractical, setEditingPractical] = useState<Practical | null>(null);
  const [sampleCode, setSampleCode] = useState<string>(""); // initial sample code
  const [sampleLanguage, setSampleLanguage] = useState<string>("c");

  // View Modal state
  const [viewingPractical, setViewingPractical] = useState<ViewingPractical | null>(null);

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
      } finally {
        if (mountedRef.current) setLoading(false);
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
      setLoading(true);
      try {
        if (!user?.id) {
          console.warn("fetchSubjects: missing user.id", user);
          if (isMounted) setSubjects([]);
          return;
        }

        const res = await supabase
          .from("subjects")
          .select(`id, subject_name, subject_code, practicals(id), semester`)
          .eq("faculty_id", user.id)
          .order("subject_name", { ascending: true });

        // Supabase returns { data, error }
        const { data, error } = res;

        if (error) {
          // Log useful bits (message/code) but avoid over-stringifying large stacks
          console.error("Supabase error loading subjects:", error?.message ?? error, error?.code ? `code=${error.code}` : "");
          if (isMounted) setSubjects([]);
          return;
        }

        if (!isMounted) return;

        const formatted = (data || []).map((s) => ({
          id: s.id,
          subject_name: s.subject_name,
          subject_code: s.subject_code,
          practical_count: Array.isArray(s.practicals) ? s.practicals.length : 0,
          semester: s.semester || "",
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
        if (isMounted) setLoading(false);
      }
    };

    fetchSubjects();

    return () => {
      isMounted = false;
    };
  }, [user, supabase, refreshKey]);



  const loadPracticals = useCallback(async (subjectId: number | string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("practicals")
        .select(`id, title, deadline, submissions(id)`)
        .eq("subject_id", subjectId)
        .order("deadline", { ascending: true });

      if (error) throw error;

      const formatted = (data || []).map((p) => ({
        id: p.id,
        title: p.title,
        deadline: p.deadline as string | null,
        submission_count: p.submissions?.length || 0,
        subject_id: subjectId, // Added subject_id
      }));

      setPracticals(formatted);
    } catch (err) {
      console.error("Failed to load practicals:", err);
      setPracticals([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (selected) {
      loadPracticals(selected);
    }
  }, [selected, loadPracticals]);

  const getDeadlineStatus = (deadline: string | null) => {
    if (!deadline) return { text: "No deadline", pill: "gray" as const };
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const daysLeft = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (daysLeft < 0) return { text: "Overdue", pill: "red" as const };
    if (daysLeft === 0) return { text: "Today", pill: "orange" as const };
    if (daysLeft <= 3) return { text: `${daysLeft} days`, pill: "yellow" as const };
    return { text: `${daysLeft} days`, pill: "green" as const };
  };

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
        testCases: testCases || []
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
    setShowPracticalModal(true);
  };

  const openEditPractical = async (practicalId: number | string) => {
    // fetch practical to edit (optional, if not already loaded)
    try {
      const { data, error } = await supabase.from("practicals").select("*").eq("id", practicalId).single();
      if (error) throw error;
      setEditingPractical(data as Practical);

      // optionally load sample code from your DB if you store it
      setShowPracticalModal(true);
    } catch (err) {
      console.error("Failed to fetch practical for edit:", err);
      alert("Failed to load practical for editing.");
    }
  };

  const handleModalClose = () => {
    setShowPracticalModal(false);
    setEditingPractical(null);
  };

  const handleSaved = () => {
    // refresh subjects/practicals after create/update
    setRefreshKey((k) => k + 1);
    // if a subject is selected, reload its practicals after a small delay (ensures DB write finished)
    if (selected) setTimeout(() => loadPracticals(selected), 400);
    handleModalClose();
  };

  const totalPracticals = subjects.reduce((sum, s) => sum + (s.practical_count || 0), 0);
  const selectedSubject = subjects.find((s) => s.id === selected);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 dark:from-gray-950 dark:via-purple-950/20 dark:to-blue-950/20">

      <main className="pt-24 px-6 md:px-12 max-w-7xl mx-auto pb-12">
        {/* Header */}
        <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow-lg">
              <BookOpen className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">My Subjects</h1>
              <p className="text-gray-600 dark:text-gray-400 text-sm">Manage subjects, practicals and submissions</p>
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

            <button
              onClick={openNewPractical}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all hover:-translate-y-0.5"
            >
              <Plus size={20} />
              New Practical
            </button>

            <Button size="sm" variant="ghost" onClick={() => setRefreshKey(k => k + 1)} className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Subjects</p>
                <p className="text-2xl font-bold">{subjects.length}</p>
              </div>
              <div className="p-3 bg-blue-500/10 rounded-xl">
                <BookOpen className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Practicals</p>
                <p className="text-2xl font-bold">{totalPracticals}</p>
              </div>
              <div className="p-3 bg-purple-500/10 rounded-xl">
                <FileCheck className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Active Subject</p>
                <p className="text-2xl font-bold">{selectedSubject ? (selectedSubject.subject_name || selectedSubject.name) : "—"}</p>
              </div>
              <div className="p-3 bg-pink-500/10 rounded-xl">
                <Sparkles className="w-6 h-6 text-pink-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Main area: Subjects list and Practicals */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Subjects column */}
          <aside className="lg:col-span-1">
            <div className="bg-white/40 dark:bg-white/5 rounded-2xl p-4 border border-white/50 dark:border-white/10">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Your Subjects</h3>
                <span className="text-sm text-gray-500">{subjects.length}</span>
              </div>

              <div className="space-y-3">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => <div key={i} className="animate-pulse h-12 rounded-lg bg-white/30" />)
                ) : subjects.length === 0 ? (
                  <div className="text-center py-8 text-sm text-gray-600">No subjects found</div>
                ) : (
                  subjects.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => setSelected(s.id)}
                      className={`w-full text-left flex items-center gap-3 p-3 rounded-lg transition-all ${selected === s.id ? "bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-200" : "hover:bg-white/30"}`}
                      aria-pressed={selected === s.id}
                    >
                      <div className="p-2 rounded-md bg-white/20">
                        <BookOpen className="w-5 h-5 text-purple-600" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{s.subject_name}</div>
                        <div className="text-xs text-gray-500">{s.subject_code} • {s.practical_count} practicals</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </button>
                  ))
                )}
              </div>
            </div>
          </aside>

          {/* Practicals column */}
          <section className="lg:col-span-2">
            <div className="bg-white/40 dark:bg-white/5 rounded-2xl overflow-hidden border border-white/50 dark:border-white/10">
              <div className="p-5 border-b border-white/30 dark:border-white/10 flex items-center justify-between">
                <div>
                  <h2 className="font-extrabold text-lg">Practicals</h2>
                  <p className="text-sm text-gray-600">{selectedSubject?.subject_name || "Select a subject"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-sm text-gray-500">{practicals.length} items</div>
                  <div className="px-3 py-1 rounded-xl bg-white/60 dark:bg-white/5 border border-white/30">
                    <TrendingUp className="w-4 h-4 inline-block align-middle mr-2" />
                    <span className="align-middle text-sm">{practicals.length} total</span>
                  </div>
                </div>
              </div>

              <div className="p-4">
                {loading ? (
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => <div key={i} className="animate-pulse h-16 rounded-lg bg-white/20" />)}
                  </div>
                ) : practialsEmpty(practicals) ? (
                  <div className="p-12 text-center">
                    <div className="inline-flex p-6 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full mb-4">
                      <FileCheck className="w-12 h-12 text-gray-400" />
                    </div>
                    <p className="text-gray-600 font-medium">No practicals found</p>
                    <p className="text-gray-500 text-sm mt-2">Create a practical or select another subject.</p>
                    <div className="mt-4">
                      <button onClick={openNewPractical} className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all hover:-translate-y-0.5">
                        <Plus size={20} />
                        Create Practical
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full table-auto divide-y divide-white/20">
                      <thead>
                        <tr className="text-left text-xs text-gray-600 uppercase tracking-wider">
                          <th className="px-4 py-3">Title</th>
                          <th className="px-4 py-3">Deadline</th>
                          <th className="px-4 py-3">Submissions</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {practicals.map((p, idx) => {
                          const status = getDeadlineStatus(p.deadline);
                          return (
                            <tr key={p.id} className={`${idx % 2 === 0 ? "bg-white/5" : "bg-transparent"}`}>
                              <td className="px-4 py-4">
                                <div className="font-semibold">{p.title}</div>
                              </td>
                              <td className="px-4 py-4">
                                {p.deadline ? (
                                  <div className="flex items-center gap-3">
                                    <Clock className="w-4 h-4 text-gray-400" />
                                    <div>
                                      <div className="text-sm font-medium">{formatDate(p.deadline)}</div>
                                      <div className={`text-xs mt-0.5 font-medium`}>{status.text}</div>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-sm text-gray-500">No deadline</span>
                                )}
                              </td>
                              <td className="px-4 py-4">
                                <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full ${p.submission_count && p.submission_count > 0 ? "bg-green-500/10 text-green-700" : "bg-gray-500/10 text-gray-600"}`}>
                                  <BookOpen className="w-4 h-4" />
                                  <span className="text-sm font-semibold">{p.submission_count || 0}</span>
                                </div>
                              </td>
                              <td className="px-4 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleViewPractical(p)}
                                    className="bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 hover:bg-indigo-100 dark:hover:bg-indigo-900/40"
                                    title="View Details"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => router.push(`/faculty/submissions?practical=${p.id}`)}
                                    className="bg-gradient-to-r from-blue-500 to-purple-500 text-white"
                                  >
                                    Submissions
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={() => openEditPractical(p.id)} title="Edit">
                                    <FileText className="w-4 h-4" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </section>
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
                      <FileText className="w-4 h-4 text-indigo-500" /> Description
                    </h4>
                    {viewingPractical.language && (
                      <span className="text-xs font-mono px-2 py-1 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase border border-gray-200 dark:border-gray-600">
                        {viewingPractical.language}
                      </span>
                    )}
                  </div>
                  <div className="p-4 text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                    {viewingPractical.description || <span className="text-gray-400 italic">No description provided</span>}
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
                      <span className="font-medium text-gray-900 dark:text-white">{selectedSubject?.subject_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Deadline</span>
                      <span className="font-medium text-gray-900 dark:text-white">{formatDate(viewingPractical.deadline)}</span>
                    </div>
                    {viewingPractical.submission_count !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Submissions</span>
                        <span className="font-medium text-gray-900 dark:text-white">{viewingPractical.submission_count}</span>
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
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Test Cases
                    </h4>
                  </div>
                  <div className="p-4 space-y-3 max-h-[600px] overflow-auto">
                    {viewingPractical.testCases && viewingPractical.testCases.length > 0 ? (
                      viewingPractical.testCases.map((tc, idx) => (
                        <div key={tc.id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50/50 dark:bg-gray-900/50 transition-all hover:bg-white dark:hover:bg-gray-800 hover:shadow-md">
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
                              <p className="text-gray-500 mb-1 font-medium">Input</p>
                              <div className="bg-white dark:bg-gray-950 p-2 rounded-lg border border-gray-200 dark:border-gray-700 font-mono truncate">
                                {tc.input || '—'}
                              </div>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1 font-medium">Expected Output</p>
                              <div className="bg-white dark:bg-gray-950 p-2 rounded-lg border border-gray-200 dark:border-gray-700 font-mono truncate">
                                {tc.expected_output || '—'}
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
          background: rgba(255,255,255,0.4);
          backdrop-filter: blur(8px);
          border-radius: 16px;
          padding: 1rem;
          border: 1px solid rgba(255,255,255,0.5);
        }
      `}</style>
    </div>
  );
}

// helper to detect empty practicals gracefully
function practialsEmpty(list: unknown[]) {
  return !list || list.length === 0;
}
