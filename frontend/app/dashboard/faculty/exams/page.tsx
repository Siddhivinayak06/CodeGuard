"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Practical, Subject } from "../../../faculty/types";
import PracticalList from "../../../faculty/components/PracticalList";
import PracticalForm from "../../../faculty/components/PracticalForm";
import ExamForm from "../../../faculty/components/ExamForm";
import { ArrowLeft, Plus, Book, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import PracticalsSkeleton from "@/components/skeletons/PracticalsSkeleton";
import { motion } from "framer-motion";

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

  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPractical, setEditingPractical] = useState<Practical | null>(
    null,
  );
  const [creatingExamMode, setCreatingExamMode] = useState(false);
  const [sampleCode, setSampleCode] = useState<string>("");
  const [starterCode, setStarterCode] = useState<string>("");
  const [sampleLanguage, setSampleLanguage] = useState<string>("c");

  // Exam modal states
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [examPractical, setExamPractical] = useState<any>(null);
  const [existingExamConfig, setExistingExamConfig] = useState<any>(null);

  // Fetch data
  useEffect(() => {
    const init = async () => {
      // 1. Get user
      const { data: userData, error: userError } =
        await supabase.auth.getUser();
      if (userError || !userData.user) {
        router.push("/auth/login");
        return;
      }
      setUser(userData.user);

      // 2. Fetch subjects via junction table
      const { data: facultyBatches } = await supabase
        .from("subject_faculty_batches")
        .select("subject_id")
        .eq("faculty_id", userData.user.id);

      const subjectIds = [...new Set(((facultyBatches as any[]) || []).map((fb) => fb.subject_id))];

      if (subjectIds.length > 0) {
        const { data: subjData } = await supabase
          .from("subjects")
          .select("*")
          .in("id", subjectIds);

        if (subjData) {
          setSubjects(subjData as Subject[]);

          // 3. Fetch practicals
          const { data: pracData } = await supabase
            .from("practicals")
            .select("*")
            .in("subject_id", subjectIds)
            .eq("is_exam", true)
            .order("created_at", { ascending: false });

          if (pracData) {
            setPracticals(pracData as Practical[]);
          }
        }
      }
      setLoading(false);
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
      .eq("is_exam", true)
      .order("created_at", { ascending: false });

    if (data) setPracticals(data as Practical[]);
  };

  const openCreateExam = () => {
    setEditingPractical(null);
    setCreatingExamMode(true);
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

  const deletePractical = async (id: number) => {
    if (!confirm("Are you sure you want to delete this practical? This will also delete all submissions, test cases, levels, schedules, and reference codes.")) return;

    try {
      // Delete in FK dependency order (children first)

      // 1. Delete test_case_results (depends on submissions + test_cases)
      const { data: subIds } = await supabase
        .from("submissions")
        .select("id")
        .eq("practical_id", id);
      if (subIds && subIds.length > 0) {
        await supabase
          .from("test_case_results")
          .delete()
          .in("submission_id", (subIds as any[]).map(s => s.id));
      }

      // 2. Delete submissions
      await supabase.from("submissions").delete().eq("practical_id", id);

      // 3. Delete schedule_allocations (depends on schedules)
      const { data: schedIds } = await supabase
        .from("schedules")
        .select("id")
        .eq("practical_id", id);
      if (schedIds && schedIds.length > 0) {
        await supabase
          .from("schedule_allocations")
          .delete()
          .in("schedule_id", (schedIds as any[]).map(s => s.id));
      }

      // 4. Delete schedules
      await supabase.from("schedules").delete().eq("practical_id", id);

      // 5. Delete student_practicals
      await supabase.from("student_practicals").delete().eq("practical_id", id);

      // 6. Delete reference_codes (depends on practical_levels)
      await supabase.from("reference_codes").delete().eq("practical_id", id);

      // 7. Delete test_cases (depends on practical_levels)
      await supabase.from("test_cases").delete().eq("practical_id", id);

      // 8. Delete practical_levels
      await supabase.from("practical_levels").delete().eq("practical_id", id);

      // 9. Finally delete the practical itself
      const { error } = await supabase.from("practicals").delete().eq("id", id);

      if (!error) {
        setPracticals((prev) => prev.filter((p) => p.id !== id));
      } else {
        console.error("Failed to delete practical:", error);
        alert("Failed to delete practical: " + error.message);
      }
    } catch (err: any) {
      console.error("Delete error:", err);
      alert("Failed to delete practical: " + (err?.message || "Unknown error"));
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
                  All Exams
                </h1>
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Manage exams for all your subjects
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={openCreateExam}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-600 hover:to-orange-600 text-white font-medium rounded-xl shadow-lg shadow-orange-500/20 transition-all hover:-translate-y-0.5 border border-orange-400/20"
              >
                <Plus size={20} />
                Create Exam
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
            <StatCard label="Total Exams" value={stats.total} icon={Book} color="blue" />
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
              isExamMode={true}
            />
          </motion.div>
        </div>

        {/* Modal */}
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
