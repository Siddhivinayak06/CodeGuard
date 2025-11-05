"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Navbar from "@/components/Navbar";
import { Calendar } from "@/components/ui/calendar";
import type { User } from "@supabase/supabase-js";

type Subject = { id: number; subject_name: string };

type Practical = {
  id?: number;
  subject_id: number;
  title: string;
  description?: string;
  language?: string;
  deadline: string;
  max_marks: number;
  created_at?: string;
  updated_at?: string;
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
  created_at?: string;
  updated_at?: string;
};

const initialPracticalForm: Omit<Practical, "id" | "created_at" | "updated_at"> = {
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
  const [form, setForm] = useState<Partial<Practical>>(initialPracticalForm);
  const [testCases, setTestCases] = useState<TestCase[]>([initialTestCase]);

  // Multi-step & reference state
  const [formStep, setFormStep] = useState<"details" | "reference">("details");
  const [sampleCode, setSampleCode] = useState<string>("");
  const [sampleLanguage, setSampleLanguage] = useState<string>("c");
  const [savedPracticalId, setSavedPracticalId] = useState<number | null>(null);

  // References
  const [referenceList, setReferenceList] = useState<ReferenceRow[]>([]);
  const [savedReferenceId, setSavedReferenceId] = useState<number | null>(null);

  // ------------------- Fetch user, subjects, practicals -------------------
  useEffect(() => {
    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.push("/auth/login");
        return;
      }
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

  useEffect(() => {
    if (user) fetchPracticals();
  }, [user]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, Practical[]>();
    practicals.forEach((p) => {
      if (!p.deadline) return;
      const iso = new Date(p.deadline).toISOString().slice(0, 10);
      const arr = map.get(iso) ?? [];
      arr.push(p);
      map.set(iso, arr);
    });
    return map;
  }, [practicals]);

  // ------------------- Modal logic -------------------
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
    setForm({ ...p, deadline: p.deadline?.slice(0, 16) });
    const { data: tcs } = await supabase.from("test_cases").select("*").eq("practical_id", p.id);
    setTestCases(tcs && tcs.length > 0 ? tcs : [initialTestCase]);

    // Fetch all reference codes for this practical
    try {
      const { data: refs, error } = await supabase
        .from("reference_codes")
        .select("id, practical_id, author, language, code, is_primary, version, created_at, updated_at")
        .eq("practical_id", p.id)
        .order("created_at", { ascending: false });

      if (!error && refs) {
        setReferenceList(refs as ReferenceRow[]);
        // pick initial language: prefer practical.language if valid, else first ref or 'c'
        const candidate =
          p.language && ["c", "python"].includes((p.language ?? "").toLowerCase())
            ? p.language!
            : (refs[0]?.language ?? "c");
        setSampleLanguage(candidate);
        const found = (refs as ReferenceRow[]).find((r) => (r.language ?? "").toLowerCase() === candidate.toLowerCase());
        if (found) {
          setSampleCode(found.code ?? "");
          setSavedReferenceId(found.id);
        } else {
          setSampleCode("");
          setSavedReferenceId(null);
        }
      } else {
        setReferenceList([]);
        setSampleLanguage(p.language && ["c", "python"].includes(p.language?.toLowerCase() ?? "") ? p.language! : "c");
        setSampleCode("");
        setSavedReferenceId(null);
      }

      setSavedPracticalId(p.id ?? null);
    } catch (err) {
      console.error("failed to fetch reference codes:", err);
      setReferenceList([]);
      setSampleLanguage(p.language && ["c", "python"].includes(p.language?.toLowerCase() ?? "") ? p.language! : "c");
      setSampleCode("");
      setSavedReferenceId(null);
      setSavedPracticalId(p.id ?? null);
    }

    setFormStep("details");
    setModalOpen(true);
  };

  const [saving, setSaving] = useState(false);

  // Save practical (Step 1). On success, move to Step 2 with savedPracticalId set.
  const savePractical = async () => {
    if (saving) return;
    if (formStep === "details") {
      if (!form.title || !form.subject_id || !form.deadline) {
        return alert("Please fill title, subject, and deadline");
      }

      setSaving(true);
      try {
        let practicalData: any;

        if (editingPractical && editingPractical.id) {
          // update — omit id from payload
          const { id: _id, ...updatePayload } = form as any;
          const { data, error } = await supabase
            .from("practicals")
            .update(updatePayload)
            .eq("id", editingPractical.id)
            .select()
            .single();
          if (error) throw error;
          practicalData = data;

          // replace test cases
          await supabase.from("test_cases").delete().eq("practical_id", practicalData.id);
        } else {
          // insert — omit id if present
          const { id: _id, ...payload } = form as any;
          const { data, error } = await supabase.from("practicals").insert(payload).select().single();
          if (error) throw error;
          practicalData = data;
        }

        if (testCases.length > 0) {
          const tcsToInsert = testCases.map((tc) => ({
            practical_id: practicalData.id,
            input: tc.input,
            expected_output: tc.expected_output,
            is_hidden: tc.is_hidden ?? false,
            time_limit_ms: tc.time_limit_ms ?? 2000,
            memory_limit_kb: tc.memory_limit_kb ?? 65536,
          }));
          await supabase.from("test_cases").insert(tcsToInsert);
        }

        setSavedPracticalId(practicalData.id);
        setFormStep("reference");

        // set sample language sensible default (c or python)
        const langDefault =
          practicalData.language && ["c", "python"].includes((practicalData.language ?? "").toLowerCase())
            ? practicalData.language
            : form.language && ["c", "python"].includes((form.language ?? "").toLowerCase())
            ? form.language
            : "c";
        setSampleLanguage(langDefault ?? "c");
        setSampleCode("");

        const { data: refsAfter, error: refsErr } = await supabase
          .from("reference_codes")
          .select("id, language, code, is_primary, created_at")
          .eq("practical_id", practicalData.id)
          .order("created_at", { ascending: false });

        if (!refsErr && refsAfter && refsAfter.length > 0) {
          setReferenceList(refsAfter as ReferenceRow[]);
          const found = (refsAfter as ReferenceRow[]).find((r) => (r.language ?? "").toLowerCase() === (langDefault ?? "c").toLowerCase());
          if (found) {
            setSampleCode(found.code ?? "");
            setSavedReferenceId(found.id);
          } else {
            setSampleCode("");
            setSavedReferenceId(null);
          }
        } else {
          setReferenceList([]);
          setSampleCode("");
          setSavedReferenceId(null);
        }

        fetchPracticals();
      } catch (err: any) {
        console.error(err);
        alert("Failed to save practical: " + (err.message ?? JSON.stringify(err)));
      } finally {
        setSaving(false);
      }
      return;
    }

    // If currently on reference step, save or update reference
    if (formStep === "reference") {
      await saveReferenceCode();
    }
  };

  // Upsert reference code for chosen language (update if exists, else insert)
  const saveReferenceCode = async () => {
    if (saving) return;
    setSaving(true);

    try {
      // 1) Ensure we have a practical to attach to. If not, create it.
      let practicalId = savedPracticalId;
      if (!practicalId) {
        // validate minimal details
        if (!form.title || !form.subject_id || !form.deadline) {
          setSaving(false);
          return alert("Please fill Title, Subject and Deadline before saving sample code (they will be auto-saved).");
        }

        // avoid sending id to DB
        const { id: _id, ...payload } = form as any;
        const { data: createdPractical, error: createErr } = await supabase
          .from("practicals")
          .insert([payload])
          .select()
          .single();

        if (createErr || !createdPractical) {
          console.error("Failed to auto-create practical:", createErr);
          setSaving(false);
          return alert("Failed to create practical to attach sample code. Try again.");
        }

        practicalId = createdPractical.id;
        setSavedPracticalId(practicalId);

        // insert test cases (if any)
        if (testCases && testCases.length > 0) {
          const tcsToInsert = testCases.map((tc) => ({
            practical_id: practicalId,
            input: tc.input,
            expected_output: tc.expected_output,
            is_hidden: tc.is_hidden ?? false,
            time_limit_ms: tc.time_limit_ms ?? 2000,
            memory_limit_kb: tc.memory_limit_kb ?? 65536,
          }));
          const { error: tcsErr } = await supabase.from("test_cases").insert(tcsToInsert);
          if (tcsErr) {
            console.warn("Failed to insert test cases while auto-creating practical:", tcsErr);
          }
        }
      }

      // 2) Now upsert the reference code for (practicalId, language)
      let lang = (sampleLanguage ?? "c").toLowerCase();
      if (lang !== "c" && lang !== "python") lang = "c";

      const { data: existingRefs, error: fetchErr } = await supabase
        .from("reference_codes")
        .select("id, language, code")
        .eq("practical_id", practicalId)
        .eq("language", lang)
        .limit(1);

      if (fetchErr) {
        console.warn("Failed to fetch existing reference row:", fetchErr);
      }

      if (existingRefs && existingRefs.length > 0) {
        const existingId = existingRefs[0].id;
        const { error: updateErr } = await supabase
          .from("reference_codes")
          .update({
            code: sampleCode,
            language: lang,
            author: user?.id ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingId);

        if (updateErr) {
          console.error("Failed to update reference code:", updateErr);
          setSaving(false);
          return alert("Failed to update sample code. Try again.");
        }
      } else {
        const payload = {
          practical_id: practicalId,
          author: user?.id ?? null,
          language: lang,
          code: sampleCode,
          is_primary: true,
          version: 1,
        };
        const { error: insertErr } = await supabase.from("reference_codes").insert(payload);
        if (insertErr) {
          console.error("Failed to insert reference code:", insertErr);
          setSaving(false);
          return alert("Failed to save sample code. Try again.");
        }
      }

      // 3) refresh references and practicals
      const { data: refreshed, error: refErr } = await supabase
        .from("reference_codes")
        .select("id, practical_id, author, language, code, is_primary, version, created_at, updated_at")
        .eq("practical_id", practicalId)
        .order("created_at", { ascending: false });

      if (!refErr && refreshed) {
        setReferenceList(refreshed as ReferenceRow[]);
        const found = (refreshed as ReferenceRow[]).find((r) => (r.language ?? "").toLowerCase() === lang);
        if (found) setSavedReferenceId(found.id);
      }

      fetchPracticals();

      // 4) finish up
      setModalOpen(false);
      setForm(initialPracticalForm);
      setTestCases([initialTestCase]);
      setFormStep("details");
      setSampleCode("");
      setSampleLanguage("c");
      setSavedPracticalId(null);
      setSavedReferenceId(null);

      alert("Sample reference code saved successfully.");
    } catch (err: any) {
      console.error("Failed to save reference code (auto-flow):", err);
      alert("Failed to save sample code: " + (err?.message ?? JSON.stringify(err)));
    } finally {
      setSaving(false);
    }
  };

  const deletePractical = async (id: number) => {
    if (!confirm("Delete this practical?")) return;
    const { error } = await supabase.from("practicals").delete().eq("id", id);
    if (!error) setPracticals((prev) => prev.filter((p) => p.id !== id));
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
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6 gap-4 md:gap-0">
          <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-100">Faculty Dashboard</h1>
          <button onClick={() => openCreate()} className="px-4 py-2 bg-green-600 text-white rounded shadow hover:bg-green-700 transition">
            + Schedule Practical
          </button>
        </header>

        {/* Main grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Calendar panel */}
          <div className="md:col-span-1 rounded-xl border shadow bg-white dark:bg-gray-900 p-4 flex flex-col">
            <h2 className="font-semibold text-lg mb-3 text-gray-700 dark:text-gray-200">Calendar</h2>
            <Calendar
              mode="single"
              selected={selected}
              onSelect={(d) => {
                if (!d || isNaN(d.getTime())) return;
                setSelected(d);
                openCreate(d);
              }}
              dayContent={(date) => {
                if (!(date instanceof Date) || isNaN(date.getTime())) return null;
                const iso = date.toISOString().slice(0, 10);
                const events = eventsByDate.get(iso) ?? [];
                const hasEvent = events.length > 0;
                return (
                  <div
                    className={`aspect-square w-full flex items-center justify-center rounded-md cursor-pointer select-none ${
                      hasEvent ? "bg-blue-500 text-white font-semibold" : "hover:bg-gray-100 dark:hover:bg-gray-800"
                    } transition`}
                    title={events.map((e) => e.title).join("\n")}
                  >
                    {date.getDate()}
                  </div>
                );
              }}
              className="w-full"
            />
          </div>

          {/* Practicals panel */}
          <div className="md:col-span-2 flex flex-col gap-4">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">Upcoming Practicals</h2>
            <div className="flex flex-col gap-3 overflow-y-auto max-h-[70vh] rounded-xl border shadow bg-white dark:bg-gray-900 p-4">
              {practicals.length === 0 ? (
                <p className="text-gray-500 text-sm">No practicals scheduled.</p>
              ) : (
                practicals.map((p) => {
                  const subj = subjects.find((s) => s.id === p.subject_id)?.subject_name || "Unknown";
                  return (
                    <div key={p.id} className="p-3 border rounded flex flex-col md:flex-row items-start md:items-center justify-between gap-2 hover:shadow-md transition">
                      <div>
                        <div className="font-medium text-gray-800 dark:text-gray-100">{p.title}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{subj} • {new Date(p.deadline).toLocaleString()}</div>
                        {p.language && <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">Language: {p.language}</div>}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(p)} className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition">Edit</button>
                        <button onClick={() => deletePractical(p.id!)} className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 transition">Delete</button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Modal for Practical (two-step) */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={() => { setModalOpen(false); setFormStep("details"); }} />
            <div className="relative bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-2xl shadow-lg overflow-y-auto max-h-[90vh]">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">{formStep === "details" ? (editingPractical ? "Edit Practical" : "Schedule Practical") : "Add Sample / Reference Code"}</h3>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <span className={`px-2 py-1 rounded ${formStep === "details" ? "bg-blue-100 text-blue-700" : "bg-gray-100 dark:bg-gray-800"}`}>1. Details</span>
                  <span className={`px-2 py-1 rounded ${formStep === "reference" ? "bg-blue-100 text-blue-700" : "bg-gray-100 dark:bg-gray-800"}`}>2. Sample Code</span>
                </div>
              </div>

              {/* Step 1: details */}
              {formStep === "details" && (
                <div className="space-y-3">
                  <input value={form.title ?? ""} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Title" className="w-full px-3 py-2 rounded border" />
                  <select value={form.subject_id ?? 0} onChange={(e) => setForm((f) => ({ ...f, subject_id: parseInt(e.target.value) }))} className="w-full px-3 py-2 rounded border">
                    <option value={0}>Select Subject</option>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.subject_name}</option>)}
                  </select>
                  <textarea value={form.description ?? ""} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Description" className="w-full px-3 py-2 rounded border h-24" />
                  <select value={form.language ?? ""} onChange={(e) => { setForm((f) => ({ ...f, language: e.target.value })); setSampleLanguage(e.target.value); }} className="w-full px-3 py-2 rounded border">
                    <option value="">Select language (optional)</option>
                    <option value="c">C</option>
                    <option value="python">Python</option>
                  </select>
                  <input type="datetime-local" value={form.deadline ?? ""} onChange={(e) => setForm((f) => ({ ...f, deadline: e.target.value }))} className="px-3 py-2 rounded border w-full" />
                  <input type="number" value={form.max_marks ?? 100} onChange={(e) => setForm((f) => ({ ...f, max_marks: parseInt(e.target.value) }))} placeholder="Max Marks" className="px-3 py-2 rounded border w-full" />

                  {/* Test Cases */}
                  <div className="mt-4 space-y-2">
                    <h4 className="font-medium">Test Cases</h4>
                    {testCases.map((tc, idx) => (
                      <div key={idx} className="flex flex-col md:flex-row gap-2 items-start border p-2 rounded">
                        <textarea value={tc.input} onChange={(e) => setTestCases((prev) => prev.map((t, i) => (i === idx ? { ...t, input: e.target.value } : t)))} placeholder="Input" className="w-full md:w-1/2 px-2 py-1 border rounded" />
                        <textarea value={tc.expected_output} onChange={(e) => setTestCases((prev) => prev.map((t, i) => (i === idx ? { ...t, expected_output: e.target.value } : t)))} placeholder="Expected Output" className="w-full md:w-1/2 px-2 py-1 border rounded" />
                        <button onClick={() => setTestCases((prev) => prev.filter((_, i) => i !== idx))} className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition mt-1 md:mt-0">X</button>
                      </div>
                    ))}
                    <button onClick={() => setTestCases((prev) => [...prev, initialTestCase])} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition">+ Add Test Case</button>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2 mt-4">
                    <button onClick={() => { setModalOpen(false); setFormStep("details"); }} className="px-3 py-1 rounded border">Cancel</button>
                    <button onClick={savePractical} disabled={saving} className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50">
                      {saving ? "Saving..." : "Save & Next"}
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: sample/reference code */}
              {formStep === "reference" && (
                <div className="space-y-3">
                  <div className="text-sm text-gray-600">Attach a sample / reference implementation for students. This is optional but recommended.</div>

                  <div className="flex items-center gap-3">
                    <select value={sampleLanguage} onChange={(e) => {
                      const lang = e.target.value;
                      setSampleLanguage(lang);
                      const found = referenceList.find((r) => (r.language ?? "").toLowerCase() === lang.toLowerCase());
                      if (found) {
                        setSampleCode(found.code ?? "");
                        setSavedReferenceId(found.id);
                      } else {
                        setSampleCode("");
                        setSavedReferenceId(null);
                      }
                    }} className="w-48 px-2 py-1 rounded border">
                      <option value="c">C</option>
                      <option value="python">Python</option>
                    </select>

                    {referenceList.length > 0 && (
                      <div className="text-sm text-gray-500">
                        Existing: {Array.from(new Set(referenceList.map((r) => r.language).filter(Boolean).map((l) => (l ?? "").toLowerCase()).filter((l) => l === "c" || l === "python"))).join(", ") || "—"}
                      </div>
                    )}
                  </div>

                  <textarea value={sampleCode} onChange={(e) => setSampleCode(e.target.value)} placeholder="// Paste sample/reference code here" className="w-full h-56 px-3 py-2 border rounded font-mono text-sm whitespace-pre-wrap" />

                  <div className="flex justify-between items-center">
                    <div className="flex gap-2">
                      <button onClick={() => { setFormStep("details"); }} className="px-3 py-1 rounded border">Back</button>
                      <button onClick={() => {
                        if (!confirm("Skip adding sample code? You can always add it later.")) return;
                        setModalOpen(false);
                        setFormStep("details");
                        setForm(initialPracticalForm);
                        setTestCases([initialTestCase]);
                        setSampleCode("");
                        setSampleLanguage("c");
                        setSavedPracticalId(null);
                        setReferenceList([]);
                        setSavedReferenceId(null);
                      }} className="px-3 py-1 rounded border">Skip</button>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => { setFormStep("details"); }} className="px-3 py-1 rounded border">Edit Details</button>
                      <button onClick={savePractical} disabled={saving} className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50">
                        {saving ? "Saving..." : "Save Sample & Finish"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
