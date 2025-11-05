"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";
import { Calendar } from "@/components/ui/calendar";
import dynamic from "next/dynamic";
import type { User } from "@supabase/supabase-js";
import PracticalForm from "../../faculty/components/PracticalForm";
const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), { ssr: false });

// ---------------------- Types ----------------------
type Subject = { id: number; subject_name: string };
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
type ReferenceRow = {
  id: number;
  practical_id: number;
  author?: string | null;
  language: string;
  code?: string | null;
  is_primary?: boolean;
  version?: number;
};

// ---------------------- Initial states ----------------------
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

// ---------------------- Child Components ----------------------
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
  return (
    <div className="p-3 border rounded flex flex-col md:flex-row items-start md:items-center justify-between gap-2 hover:shadow-md transition">
      <div>
        <div className="font-medium text-gray-800 dark:text-gray-100">{practical.title}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          {subject} • {new Date(practical.deadline).toLocaleString()}
        </div>
        {practical.language && (
          <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">Language: {practical.language}</div>
        )}
        <span
          className={`mt-1 inline-block px-2 py-0.5 rounded text-xs ${isPast ? "bg-red-200 text-red-800" : "bg-green-200 text-green-800"
            }`}
        >
          {isPast ? "Closed" : "Upcoming"}
        </span>
      </div>
      <div className="flex gap-2 mt-2 md:mt-0">
        <button
          onClick={() => onEdit(practical)}
          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(practical.id)}
          className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

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
  return (
    <div className="md:col-span-1 rounded-xl border shadow bg-white dark:bg-gray-900 p-4 flex flex-col">
      <h2 className="font-semibold text-lg mb-3 text-gray-700 dark:text-gray-200">Calendar</h2>
      <Calendar
        mode="single"
        selected={selected}
        onSelect={(d) => d && !isNaN(d.getTime()) && onDateClick(d)}
        dayContent={(date) => {
          if (!(date instanceof Date) || isNaN(date.getTime())) return null;
          const iso = date.toISOString().slice(0, 10);
          const events = eventsByDate.get(iso) ?? [];
          const hasEvent = events.length > 0;
          return (
            <div
              className={`aspect-square w-full flex flex-col items-center justify-center rounded-md cursor-pointer select-none ${hasEvent ? "bg-blue-500 text-white font-semibold" : "hover:bg-gray-100 dark:hover:bg-gray-800"
                } transition`}
              title={events.map((e) => e.title).join("\n")}
            >
              {date.getDate()}
              {events.length > 1 && <span className="text-xs mt-1 bg-white text-blue-500 px-1 rounded">{events.length}</span>}
            </div>
          );
        }}
        className="w-full"
      />
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

  // Form & test case states
  const [editingPractical, setEditingPractical] = useState<Practical | null>(null);
  const [form, setForm] = useState<Practical>(initialPracticalForm);
  const [testCases, setTestCases] = useState<TestCase[]>([initialTestCase]);

  // Reference code states
  const [formStep, setFormStep] = useState<"details" | "reference">("details");
  const [sampleCode, setSampleCode] = useState<string>("");
  const [sampleLanguage, setSampleLanguage] = useState<string>("c");
  const [savedPracticalId, setSavedPracticalId] = useState<number | null>(null);
  const [referenceList, setReferenceList] = useState<ReferenceRow[]>([]);
  const [savedReferenceId, setSavedReferenceId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  // ------------------- Fetch user, subjects, practicals -------------------
  useEffect(() => {
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return router.push("/auth/login");
      setUser(data.user);
      setLoading(false);
    };
    fetchUser();
  }, [router, supabase]);

  useEffect(() => {
    const fetchSubjects = async () => {
      const { data, error } = await supabase.from("subjects").select("*");
      if (!error && data) setSubjects(data as Subject[]);
    };
    fetchSubjects();
  }, [supabase]);

  const fetchPracticals = async () => {
    if (!user) return;
    const { data, error } = await supabase.from("practicals").select("*").order("deadline", { ascending: true });
    if (!error && data) setPracticals(data as Practical[]);
  };
  useEffect(() => { if (user) fetchPracticals(); }, [user]);

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

  // ------------------- Modal Logic -------------------
  const openCreate = (date?: Date) => {
    const deadline = date
      ? new Date(date.getFullYear(), date.getMonth(), date.getDate(), 9, 0).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16);
    setEditingPractical(null);
    setForm({ ...initialPracticalForm, deadline });
    setTestCases([initialTestCase]);
    setFormStep("details");
    setSampleCode("");
    setSampleLanguage("c");
    setSavedPracticalId(null);
    setReferenceList([]);
    setSavedReferenceId(null);
    setModalOpen(true);
  };

  const openEdit = async (p: Practical) => {
    setEditingPractical(p);
    setForm({ ...p, deadline: p.deadline.slice(0, 16) });

    // Fetch test cases
    const { data: tcs } = await supabase.from("test_cases").select("*").eq("practical_id", p.id);
    setTestCases(tcs && tcs.length > 0 ? tcs : [initialTestCase]);

    // Fetch reference codes
    const { data: refs } = await supabase
      .from("reference_codes")
      .select("*")
      .eq("practical_id", p.id)
      .order("created_at", { ascending: false });
    if (refs) setReferenceList(refs as ReferenceRow[]);

    setSavedPracticalId(p.id);
    setFormStep("details");
    setModalOpen(true);
  };

  const deletePractical = async (id: number) => {
    if (!confirm("Delete this practical?")) return;
    const { error } = await supabase.from("practicals").delete().eq("id", id);
    if (!error) setPracticals((prev) => prev.filter((p) => p.id !== id));
  };

  // ------------------- Save Practical & Reference -------------------
  const savePractical = async () => {
    if (saving) return;
    setSaving(true);

    try {
      let practicalId = savedPracticalId;
      let practicalData: Practical;

      // Step 1: Save practical
      if (formStep === "details") {
        if (!form.title || !form.subject_id || !form.deadline) return alert("Please fill all required fields");
        if (editingPractical) {
          const { data } = await supabase.from("practicals").update(form).eq("id", editingPractical.id).select().single();
          practicalData = data!;
          await supabase.from("test_cases").delete().eq("practical_id", practicalData.id);
        } else {
          const { data } = await supabase.from("practicals").insert(form).select().single();
          practicalData = data!;
        }

        // Insert test cases
        if (testCases.length > 0) {
          const tcsToInsert = testCases.map((tc) => ({ practical_id: practicalData.id, ...tc }));
          await supabase.from("test_cases").insert(tcsToInsert);
        }

        setSavedPracticalId(practicalData.id);
        setFormStep("reference");
        fetchPracticals();
        setSaving(false);
        return;
      }

      // Step 2: Save reference code
      if (formStep === "reference") {
        if (!practicalId) return alert("Practical not saved");
        const lang = sampleLanguage.toLowerCase();
        const { data: existing } = await supabase.from("reference_codes").select("id").eq("practical_id", practicalId).eq("language", lang).limit(1);
        if (existing && existing.length > 0) {
          await supabase.from("reference_codes").update({ code: sampleCode, language: lang }).eq("id", existing[0].id);
        } else {
          await supabase.from("reference_codes").insert({ practical_id: practicalId, code: sampleCode, language: lang, is_primary: true, version: 1 });
        }
        setModalOpen(false);
        setForm(initialPracticalForm);
        setTestCases([initialTestCase]);
        setSampleCode("");
        setSampleLanguage("c");
        setSavedPracticalId(null);
        setReferenceList([]);
        setSavedReferenceId(null);
        fetchPracticals();
        alert("Practical saved successfully!");
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save practical. Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-600 dark:text-gray-300">Loading dashboard...</p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 pt-24 md:pt-28">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4 md:gap-0">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">Faculty Dashboard</h1>
          <button
            onClick={() => openCreate()}
            className="px-4 py-2 bg-green-600 text-white rounded shadow hover:bg-green-700 transition"
          >
            + Schedule Practical
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <CalendarPanel
            selected={selected}
            setSelected={setSelected}
            eventsByDate={eventsByDate}
            onDateClick={openCreate}
          />

          <div className="md:col-span-2 flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Upcoming Practicals</h2>
            <div className="flex flex-col gap-3 overflow-y-auto max-h-[70vh] rounded-xl border shadow bg-white dark:bg-gray-900 p-4">
              {practicals.length === 0 ? (
                <p className="text-gray-500 text-sm">No practicals scheduled.</p>
              ) : (
                practicals.map((p) => {
                  const subj = subjects.find((s) => s.id === p.subject_id)?.subject_name || "Unknown";
                  return <PracticalCard key={p.id} practical={p} subject={subj} onEdit={openEdit} onDelete={deletePractical} />;
                })
              )}
            </div>
          </div>
        </div>

        {/* Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => setModalOpen(false)} />
            <div className="relative bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-2xl shadow-lg overflow-y-auto max-h-[90vh]">
              <PracticalForm
                practical={editingPractical}
                subjects={subjects}
                supabase={supabase}
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
