"use client";

import { useEffect, useState, useMemo } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Practical, Subject } from "../../../faculty/types";
import PracticalList from "../../../faculty/components/PracticalList";
import { ArrowLeft, Plus, Book } from "lucide-react";
import PracticalsSkeleton from "@/components/skeletons/PracticalsSkeleton";
import { motion } from "framer-motion";

const PracticalForm = dynamic(
  () => import("../../../faculty/components/PracticalForm"),
  { ssr: false },
);

const ExamForm = dynamic(() => import("../../../faculty/components/ExamForm"), {
  ssr: false,
});

const ScheduleDialog = dynamic(
  () =>
    import("@/app/admin/schedule/components/ScheduleDialog").then(
      (mod) => mod.ScheduleDialog,
    ),
  { ssr: false },
);

function sortPracticalsByNumber(rows: Practical[]): Practical[] {
  return [...rows].sort((a, b) => {
    const aNum = a.practical_number ?? Number.MAX_SAFE_INTEGER;
    const bNum = b.practical_number ?? Number.MAX_SAFE_INTEGER;

    if (aNum !== bNum) {
      return aNum - bNum;
    }

    const aCreatedAt = new Date(a.created_at || 0).getTime();
    const bCreatedAt = new Date(b.created_at || 0).getTime();
    if (aCreatedAt !== bCreatedAt) {
      return bCreatedAt - aCreatedAt;
    }

    return Number(a.id) - Number(b.id);
  });
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: any;
  color: "blue" | "green" | "orange" | "purple";
}) {
  const styles = {
    blue: "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400",
    green: "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400",
    orange: "bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400",
    purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400",
  };

  return (
    <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm flex items-center gap-4">
      <div className={`p-3 rounded-xl ${styles[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{value}</p>
      </div>
    </div>
  );
}

export default function AllPracticalsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [practicals, setPracticals] = useState<Practical[]>([]);
  const [user, setUser] = useState<any>(null);
  const [deletingPracticalIds, setDeletingPracticalIds] = useState<Set<number>>(new Set());

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPractical, setEditingPractical] = useState<Practical | null>(
    null,
  );
  const [creatingExamMode, setCreatingExamMode] = useState(false);
  const [sampleCode, setSampleCode] = useState<string>("");
  const [starterCode, setStarterCode] = useState<string>("");
  const [sampleLanguage, setSampleLanguage] = useState<string>("c");

  // Schedule dialog state
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [schedulePracticalId, setSchedulePracticalId] = useState<string>("");

  // Exam modal states
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [examPractical, setExamPractical] = useState<any>(null);
  const [existingExamConfig, setExistingExamConfig] = useState<any>(null);

  // Fetch data
  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        const authUser = session?.user || (await supabase.auth.getUser()).data.user;

        if (!authUser) {
          router.push("/auth/login");
          return;
        }

        if (cancelled) return;
        setUser(authUser);

        const { data: facultyBatches } = await supabase
          .from("subject_faculty_batches")
          .select("subject_id")
          .eq("faculty_id", authUser.id);

        const subjectIds = [
          ...new Set(
            ((facultyBatches as any[]) || [])
              .map((fb) => fb.subject_id)
              .filter(Boolean),
          ),
        ];

        if (subjectIds.length === 0) {
          if (!cancelled) {
            setSubjects([]);
            setPracticals([]);
          }
          return;
        }

        const [{ data: subjData }, { data: pracData }] = await Promise.all([
          supabase.from("subjects").select("*").in("id", subjectIds),
          supabase
            .from("practicals")
            .select("*")
            .in("subject_id", subjectIds)
            .eq("is_exam", false)
            .order("created_at", { ascending: false }),
        ]);

        if (!cancelled) {
          setSubjects((subjData as Subject[]) || []);
          setPracticals(sortPracticalsByNumber((pracData as Practical[]) || []));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
    };
  }, [supabase, router]);

  const fetchPracticals = async () => {
    if (!user) return;
    const subjectIds = subjects.map((s) => s.id);
    if (subjectIds.length === 0) {
      setPracticals([]);
      return;
    }

    const { data } = await supabase
      .from("practicals")
      .select("*")
      .in("subject_id", subjectIds)
      .eq("is_exam", false)
      .order("created_at", { ascending: false });

    if (data) setPracticals(sortPracticalsByNumber(data as Practical[]));
  };

  const openCreate = () => {
    setEditingPractical(null);
    setCreatingExamMode(false);
    setSampleCode("");
    setStarterCode("");
    setSampleLanguage("c");
    setModalOpen(true);
  };

  const openEdit = async (p: Practical) => {
    setEditingPractical(p);
    const { data: refsData } = await supabase
      .from("reference_codes")
      .select("*")
      .eq("practical_id", p.id)
      .order("created_at", { ascending: false });
    const refs = refsData as any[];
    if (refs && refs.length > 0) {
      setSampleCode(refs[0].code || "");
      setStarterCode(refs[0].starter_code || "");
      setSampleLanguage(refs[0].language || "c");
    }
    setModalOpen(true);
  };

  const openSchedule = (p: Practical) => {
    setSchedulePracticalId(String(p.id));
    setScheduleDialogOpen(true);
  };

  const deletePractical = async (id: number) => {
    if (!confirm("Are you sure you want to delete this practical? This will also delete all submissions, test cases, levels, schedules, and reference codes.")) return;

    if (deletingPracticalIds.has(id)) return;

    const previousPracticals = practicals;
    setDeletingPracticalIds((prev) => new Set(prev).add(id));
    // Optimistic UI: remove immediately so the action feels instant.
    setPracticals((prev) => prev.filter((p) => p.id !== id));

    try {
      // Keep schedule cleanup explicit; most related data is removed by DB cascades.
      const { error: schedulesDeleteError } = await supabase
        .from("schedules")
        .delete()
        .eq("practical_id", id);

      if (schedulesDeleteError) throw schedulesDeleteError;

      const { error: practicalDeleteError } = await supabase
        .from("practicals")
        .delete()
        .eq("id", id);

      if (practicalDeleteError) throw practicalDeleteError;
    } catch (err: any) {
      console.error("Delete error:", err);
      setPracticals(previousPracticals);
      alert("Failed to delete practical: " + (err?.message || "Unknown error"));
    } finally {
      setDeletingPracticalIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const stats = useMemo(() => {
    if (!practicals) return { total: 0 };
    return {
      total: practicals.length,
    };
  }, [practicals]);

  if (loading)
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 transition-colors duration-500">
        <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 xl:px-12 w-full mx-auto max-w-7xl">
          <PracticalsSkeleton />
        </main>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 xl:px-12 w-full mx-auto">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  All Practicals
                </h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Manage assignments for all your subjects
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl shadow-lg shadow-sky-500/20 transition-all hover:-translate-y-0.5"
              >
                <Plus size={20} />
                Create Practical
              </button>
            </div>
          </motion.div>

          {/* Stats Grid */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
          >
            <StatCard label="Total Practicals" value={stats.total} icon={Book} color="blue" />
          </motion.div>

          {/* List Component from shared */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <PracticalList
              practicals={practicals}
              subjects={subjects}
              onEdit={openEdit}
              onDelete={deletePractical}
              onSchedule={openSchedule}
              deletingPracticalIds={deletingPracticalIds}
            // onConfigureExam removed since exams are now separate
            />
          </motion.div>
        </div>

        {scheduleDialogOpen && (
          <ScheduleDialog
            open={scheduleDialogOpen}
            onOpenChange={(open) => {
              setScheduleDialogOpen(open);
              if (!open) setSchedulePracticalId("");
            }}
            initialData={{
              practical_id: schedulePracticalId || undefined,
              faculty_id: user?.id ? String(user.id) : "",
            }}
            showExistingSchedules={true}
            restrictFacultySelection={true}
            onScheduleCreated={fetchPracticals}
          />
        )}

        {/* Modal */}
        {modalOpen && (
          <PracticalForm
            isOpen={modalOpen}
            practical={editingPractical}
            subjects={subjects}
            supabase={supabase}
            sampleCode={sampleCode}
            setSampleCode={setSampleCode}
            starterCode={starterCode}
            setStarterCode={setStarterCode}
            sampleLanguage={sampleLanguage}
            setSampleLanguage={setSampleLanguage}
            isExam={creatingExamMode}
            onClose={() => setModalOpen(false)}
            onSaved={(newPracticalId?: number) => {
              fetchPracticals();
              setModalOpen(false);

              // Auto open ExamForm if we were creating an exam and got a new ID
              if (creatingExamMode && newPracticalId) {
                // We need the practical object/title for ExamForm header
                // Let's create a minimal payload or fetch it
                const minimalPractical = {
                  id: newPracticalId,
                  title: editingPractical ? editingPractical.title : "New Exam",
                };
                setExamPractical(minimalPractical);
                setExistingExamConfig(null); // Fresh config
                setExamModalOpen(true);
              }
            }}
          />
        )}

        {/* Exam Settings Modal */}
        {examPractical && (
          <ExamForm
            isOpen={examModalOpen}
            practicalId={examPractical.id}
            practicalTitle={examPractical.title}
            existingExam={existingExamConfig}
            onClose={() => {
              setExamModalOpen(false);
              setExamPractical(null);
              setExistingExamConfig(null);
            }}
            onSaved={() => {
              fetchPracticals();
              setExamModalOpen(false);
              setExamPractical(null);
              setExistingExamConfig(null);
            }}
          />
        )}
      </main>
    </div>
  );
}
