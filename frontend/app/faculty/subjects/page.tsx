"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Award
} from "lucide-react";

// dynamic import of PracticalForm to avoid SSR issues
const PracticalForm = dynamic(() => import("../components/PracticalForm"), { ssr: false });

type Subject = {
  id: number;
  subject_name: string;
  subject_code: string;
  practical_count?: number;
  semester?: string;
};

type Practical = {
  id: number;
  title: string;
  deadline: string | null;
  submission_count?: number;
};

export default function FacultySubjects() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const mountedRef = useRef(true);

  const [user, setUser] = useState<User | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [practicals, setPracticals] = useState<Practical[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  // Modal & form states
  const [showPracticalModal, setShowPracticalModal] = useState(false);
  const [editingPractical, setEditingPractical] = useState<Practical | null>(null);
  const [sampleCode, setSampleCode] = useState<string>(""); // initial sample code
  const [sampleLanguage, setSampleLanguage] = useState<string>("c");

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
      const { data, error } = res as any;

      if (error) {
        // Log useful bits (message/code) but avoid over-stringifying large stacks
        console.error("Supabase error loading subjects:", error?.message ?? error, error?.code ? `code=${error.code}` : "");
        if (isMounted) setSubjects([]);
        return;
      }

      if (!isMounted) return;

      const formatted = (data || []).map((s: any) => ({
        id: s.id,
        subject_name: s.subject_name,
        subject_code: s.subject_code,
        practical_count: s.practicals?.length || 0,
        semester: s.semester || "",
      }));

      if (isMounted) {
        setSubjects(formatted);
        if (!selected && formatted.length > 0) setSelected(formatted[0].id);
      }
    } catch (err: any) {
      // Ignore AbortError behavior (shouldn't happen since we removed AbortController),
      // but handle generically and log a short message.
      console.error("Unexpected error fetching subjects:", err?.message ?? err);
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



  const loadPracticals = async (subjectId: number) => {
    setSelected(subjectId);
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("practicals")
        .select(`id, title, deadline, submissions(id)`)
        .eq("subject_id", subjectId)
        .order("deadline", { ascending: true });

      if (error) throw error;

      const formatted = (data || []).map((p: any) => ({
        id: p.id,
        title: p.title,
        deadline: p.deadline,
        submission_count: p.submissions?.length || 0,
      }));

      setPracticals(formatted);
    } catch (err) {
      console.error("Failed to load practicals:", err);
      setPracticals([]);
    } finally {
      setLoading(false);
    }
  };

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

  const openNewPractical = () => {
    setEditingPractical(null);
    setSampleCode("");
    setSampleLanguage("c");
    setShowPracticalModal(true);
  };

  const openEditPractical = async (practicalId: number) => {
    // fetch practical to edit (optional, if not already loaded)
    try {
      const { data, error } = await supabase.from("practicals").select("*").eq("id", practicalId).single();
      if (error) throw error;
      setEditingPractical(data as any);
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

            <Button
              size="sm"
              onClick={openNewPractical}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-md"
            >
              <Plus className="w-4 h-4" />
              New Practical
            </Button>

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
                <p className="text-2xl font-bold">{selectedSubject ? selectedSubject.subject_name : "—"}</p>
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
                      onClick={() => loadPracticals(s.id)}
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
                      <Button onClick={openNewPractical}>
                        <Plus className="w-4 h-4 mr-2" /> Create Practical
                      </Button>
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
                                <Button size="sm" onClick={() => router.push(`/dashboard/faculty/submissions?practical=${p.id}`)} className="mr-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white">
                                  View
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => openEditPractical(p.id)}>Edit</Button>
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

      {showPracticalModal && (
        <div
          className="fixed top-16 left-0 right-0 bottom-0 z-50 flex flex-col bg-white dark:bg-gray-900 overflow-y-auto"
        >
          {/* Top bar inside modal */}
          <div className="flex justify-between items-center p-4 border-b border-gray-300 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
              {editingPractical ? "Edit Practical" : "Add Practical"}
            </h2>
            <button
              onClick={handleModalClose}
              className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
            >
              Close
            </button>
          </div>

          {/* Practical Form */}
          <div className="flex-1 ">
            <PracticalForm
              practical={editingPractical as any}
              subjects={subjects}
              supabase={supabase}
              sampleCode={sampleCode}
              setSampleCode={setSampleCode}
              sampleLanguage={sampleLanguage}
              setSampleLanguage={setSampleLanguage}
              onClose={handleModalClose}
              onSaved={handleSaved}
            />
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
function practialsEmpty(list: any[]) {
  return !list || list.length === 0;
}
