"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Practical, Subject } from "../../../faculty/types";
import PracticalList from "../../../faculty/components/PracticalList";
import PracticalForm from "../../../faculty/components/PracticalForm";
import FullPageLoader from "@/components/loaders/FullPageLoader";
import { ArrowLeft, Plus } from "lucide-react";
import { motion } from "framer-motion";

export default function AllPracticalsPage() {
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);

    const [loading, setLoading] = useState(true);
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [practicals, setPracticals] = useState<Practical[]>([]);
    const [user, setUser] = useState<any>(null);

    // Modal states
    const [modalOpen, setModalOpen] = useState(false);
    const [editingPractical, setEditingPractical] = useState<Practical | null>(null);
    const [sampleCode, setSampleCode] = useState<string>("");
    const [sampleLanguage, setSampleLanguage] = useState<string>("c");

    // Fetch data
    useEffect(() => {
        const init = async () => {
            // 1. Get user
            const { data: userData, error: userError } = await supabase.auth.getUser();
            if (userError || !userData.user) {
                router.push("/auth/login");
                return;
            }
            setUser(userData.user);

            // 2. Fetch subjects
            const { data: subjData } = await supabase
                .from("subjects")
                .select("*")
                .eq("faculty_id", userData.user.id);

            if (subjData) {
                setSubjects(subjData as Subject[]);
                const subjectIds = subjData.map((s) => s.id);

                // 3. Fetch practicals
                if (subjectIds.length > 0) {
                    const { data: pracData } = await supabase
                        .from("practicals")
                        .select("*")
                        .in("subject_id", subjectIds)
                        .order("deadline", { ascending: true });

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
            .order("deadline", { ascending: true });

        if (data) setPracticals(data as Practical[]);
    };

    const openCreate = () => {
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
        if (!confirm("Are you sure you want to delete this practical?")) return;
        const { error } = await supabase.from("practicals").delete().eq("id", id);
        if (!error) {
            setPracticals((prev) => prev.filter((p) => p.id !== id));
        } else {
            alert("Failed to delete practical");
        }
    };

    if (loading) return <FullPageLoader />;

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50/30 dark:from-gray-950 dark:via-indigo-950/10 dark:to-purple-950/10">
            <main className="pt-24 pb-12 px-4 sm:px-6 lg:px-8 xl:px-12 w-full mx-auto">
                <div className="max-w-7xl mx-auto space-y-6">
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
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">All Practicals</h1>
                                <p className="text-gray-500 dark:text-gray-400 text-sm">Manage assignments for all your subjects</p>
                            </div>
                        </div>

                        <button
                            onClick={openCreate}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all hover:-translate-y-0.5"
                        >
                            <Plus size={20} />
                            Create Practical
                        </button>
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
                        // onAssign logic could be added if needed, or left optional
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
