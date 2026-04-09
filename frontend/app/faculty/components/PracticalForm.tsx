"use client";

import React, { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { SupabaseClient } from "@supabase/supabase-js";
import {
  Check as CheckIcon,
  Loader2,
  Zap,
  Sparkles,
  Plus,
  FileText,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Layers,
  Timer,
  Clock,
  Maximize,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Practical, Subject, TestCase, Level, Student } from "../types";
import BasicDetailsForm from "./BasicDetailsForm";
import LevelManager from "./LevelManager";
import SingleLevelTestCases from "./SingleLevelTestCases";
import AssignStudentsStep from "./AssignStudentsStep";

interface PracticalFormProps {
  practical: Practical | null;
  subjects: Subject[];
  supabase: SupabaseClient;
  sampleCode?: string;
  setSampleCode: (code: string) => void;
  starterCode?: string;
  setStarterCode: (code: string) => void;
  sampleLanguage?: string;
  setSampleLanguage: (lang: string) => void;
  onClose: () => void;
  onSaved: (practicalId?: number) => void;
  isOpen?: boolean;
  defaultSubjectId?: number | string | null;
  onSaveStep1?: (id: number) => void;
  singleStep?: boolean;
  initialDrafts?: any[];
  isExam?: boolean;
  initialStep?: number;
}

interface QuestionSetDraft {
  set_name: string;
  level_names: string[];
}

// ---------------------- Small icons / helpers ----------------------
const LoadingSpinner = () => <Loader2 className="animate-spin h-5 w-5" />;

// simple classnames helper
function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function taskPreview(text?: string | null) {
  const raw = (text || "").trim();
  if (!raw) return "No description added yet.";

  // Keep previews readable by removing markdown control symbols and extra spaces.
  const cleaned = raw
    .replace(/[#*_`>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length <= 220) return cleaned;
  return `${cleaned.slice(0, 220)}...`;
}
function toLocalDateTimeInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  // datetime-local expects local wall time (no timezone suffix).
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

// ---------------------- Component ----------------------
export default function PracticalForm({
  practical,
  subjects,
  supabase,
  sampleCode = "",
  setSampleCode,
  starterCode = "",
  setStarterCode,
  sampleLanguage = "c",
  setSampleLanguage,
  onClose,
  onSaved,
  isOpen = false,
  defaultSubjectId,
  onSaveStep1,
  singleStep = false,
  initialDrafts,
  isExam = false,
  initialStep = 1,
}: PracticalFormProps) {
  // Level type for multi-level practicals - now using shared type

  const defaultLevels: Level[] = [
    {
      id: 0,
      practical_id: 0,
      created_at: "",
      updated_at: "",
      level: "Task 1",
      title: "Task 1",
      description: "",
      max_marks: 8,
      testCases: [
        {
          id: 0,
          practical_id: null,
          level_id: null,
          created_at: "",
          input: "",
          expected_output: "",
          is_hidden: false,
          time_limit_ms: 2000,
          memory_limit_kb: 65536,
        },
      ],
    },
    {
      id: 0,
      practical_id: 0,
      created_at: "",
      updated_at: "",
      level: "Task 2",
      title: "Task 2",
      description: "",
      max_marks: 2,
      testCases: [
        {
          id: 0,
          practical_id: null,
          level_id: null,
          created_at: "",
          input: "",
          expected_output: "",
          is_hidden: false,
          time_limit_ms: 2000,
          memory_limit_kb: 65536,
        },
      ],
    },
  ];

  const [form, setForm] = useState<Practical>({
    id: 0,
    title: "",
    subject_id: subjects[0]?.id ?? 0,
    description: "",
    language: "",
    max_marks: 10,
    practical_number: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    submitted: false,
    is_exam: false,
  });

  const [testCases, setTestCases] = useState<TestCase[]>([
    {
      id: 0,
      practical_id: null,
      level_id: null,
      created_at: "",
      input: "",
      expected_output: "",
      is_hidden: false,
      time_limit_ms: 2000,
      memory_limit_kb: 65536,
    },
  ]);

  // Multi-level support
  const [levels, setLevels] = useState<Level[]>(isExam ? [] : defaultLevels);
  const [activeLevel, setActiveLevel] = useState<string>(isExam ? "" : "Task 1");
  const [enableLevels, setEnableLevels] = useState(false);

  // Stepper state
  const [step, setStep] = useState(1);

  const [durationMinutes, setDurationMinutes] = useState(60);
  const [requireFullscreen, setRequireFullscreen] = useState(true);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [enableSets, setEnableSets] = useState(isExam);
  const [questionSets, setQuestionSets] = useState<QuestionSetDraft[]>([]);
  const [activeSetIdx, setActiveSetIdx] = useState(0);




  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<Student[]>([]);
  const [assignedStudentIds, setAssignedStudentIds] = useState<string[]>([]);
  const [assignedStudentIdsLoaded, setAssignedStudentIdsLoaded] = useState(false);
  const [didHydrateAssignedSelection, setDidHydrateAssignedSelection] = useState(false);
  const [assignmentDeadline, setAssignmentDeadline] = useState<string>(
    toLocalDateTimeInputValue(new Date().toISOString()),
  );
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingTests, setGeneratingTests] = useState(false);
  const [fuzzerCount, setFuzzerCount] = useState<number>(100);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [isFormatting, setIsFormatting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [practicalNumberConflictMessage, setPracticalNumberConflictMessage] = useState("");
  const [isCheckingPracticalNumber, setIsCheckingPracticalNumber] = useState(false);

  const [filters, setFilters] = useState({
    query: "",
    semester: "",
    batch: "",
    rollFrom: "",
    rollTo: "",
  });
  const [savedPracticals, setSavedPracticals] = useState<{ id: number }[]>([]);

  // ---------------------- Multi-Draft State ----------------------
  interface DraftPractical {
    id: string; // local draft ID
    form: Practical;
    testCases: TestCase[];
    levels: Level[];
    enableLevels: boolean;
    sampleCode?: string;
    starterCode?: string;
    sampleLanguage?: string;
  }

  const createEmptyDraft = (): DraftPractical => ({
    id: `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    form: {
      id: 0,
      title: "",
      subject_id: defaultSubjectId ? Number(defaultSubjectId) : (subjects[0]?.id ?? 0),
      description: "",
      language: "",
      max_marks: 10,
      practical_number: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      submitted: false,
      is_exam: isExam,
    },
    testCases: [{
      id: 0,
      practical_id: null,
      level_id: null,
      created_at: "",
      input: "",
      expected_output: "",
      is_hidden: false,
      time_limit_ms: 2000,
      memory_limit_kb: 65536,
    }],
    levels: isExam ? [] : JSON.parse(JSON.stringify(defaultLevels)),
    enableLevels: isExam ? true : false,
    sampleCode: "",
    starterCode: "",
    sampleLanguage: "c",
  });

  const [draftPracticals, setDraftPracticals] = useState<DraftPractical[]>([]);
  const [activeDraftIndex, setActiveDraftIndex] = useState<number>(0);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [availableBatches, setAvailableBatches] = useState<string[]>([]);

  const getLevelDisplayName = useCallback((level: Level, index: number) => {
    return level.title?.trim() || level.level || `Task ${index + 1}`;
  }, []);

  const resolveSetLevels = useCallback(
    (setDraft?: QuestionSetDraft) => {
      if (!setDraft) return [] as Array<{ level: Level; idx: number; name: string }>;

      const resolved: Array<{ level: Level; idx: number; name: string }> = [];
      const usedLevelIndices = new Set<number>();
      const normalizedSetName = (setDraft.set_name || "").trim().toLowerCase();
      const setTaskPrefix = normalizedSetName ? `${normalizedSetName} - task ` : "";

      setDraft.level_names.forEach((taskName) => {
        const normalizedTaskName = (taskName || "").trim().toLowerCase();
        const matchedIndex = levels.findIndex((lvl, idx) => {
          if (usedLevelIndices.has(idx)) return false;
          const display = getLevelDisplayName(lvl, idx).trim().toLowerCase();
          return display === normalizedTaskName;
        });

        if (matchedIndex >= 0) {
          usedLevelIndices.add(matchedIndex);
          resolved.push({
            level: levels[matchedIndex],
            idx: matchedIndex,
            name: taskName,
          });
        }
      });

      // Backward compatibility: older drafts/data may have created levels that follow
      // set naming but were not written into set.level_names.
      if (setTaskPrefix) {
        levels.forEach((lvl, idx) => {
          if (usedLevelIndices.has(idx)) return;
          const display = getLevelDisplayName(lvl, idx).trim().toLowerCase();
          if (display.startsWith(setTaskPrefix)) {
            usedLevelIndices.add(idx);
            resolved.push({
              level: lvl,
              idx,
              name: getLevelDisplayName(lvl, idx),
            });
          }
        });
      }

      return resolved;
    },
    [levels, getLevelDisplayName],
  );

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      // Initialize with one draft if creating new practicals (not editing)
      if (!practical) {
        if (initialDrafts && initialDrafts.length > 0) {
          // Map imported drafts to DraftPractical format
          const mappedDrafts = initialDrafts.map((d, idx) => {
            const isMultilevel = d.enableLevels || false;

            // Map imported levels to form levels structure
            // We use defaultLevels as base and merge imported data
            const mappedLevels = JSON.parse(JSON.stringify(defaultLevels)).map((defaultLevel: Level, levelIdx: number) => {
              if (!d.levels || d.levels.length === 0) return defaultLevel;

              // Map by index: 0 -> easy, 1 -> hard
              // If we have more than 2 levels, they are ignored for now as the system only supports 2 fixed levels.
              // If imported has only 1 level, it goes to "easy".
              const importedLevel = d.levels[levelIdx];

              if (!importedLevel) return defaultLevel;

              return {
                ...defaultLevel,
                title: importedLevel.title || defaultLevel.title,
                description: importedLevel.description || defaultLevel.description,
                max_marks: Number(importedLevel.max_marks) || defaultLevel.max_marks, // Ensure number
                testCases: importedLevel.testCases?.map((tc: any) => ({
                  id: 0,
                  practical_id: null,
                  level_id: null,
                  created_at: "",
                  input: tc.input || "",
                  expected_output: tc.expected_output || "",
                  is_hidden: false,
                  time_limit_ms: 2000,
                  memory_limit_kb: 65536,
                })) || [],
                reference_code: importedLevel.reference_code || "",
                starter_code: importedLevel.starter_code || ""
              };
            });


            return {
              id: `imported-${Date.now()}-${idx}`,
              form: {
                id: 0,
                title: d.title || "Untitled Practical",
                subject_id: defaultSubjectId ? Number(defaultSubjectId) : (subjects[0]?.id ?? 0),
                description: d.description || "",
                language: d.language || "c", // Map language
                max_marks: Number(d.max_marks) || 10,
                practical_number: d.practical_number,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                submitted: false,
                is_exam: false,
              },
              testCases: d.testCases?.map((tc: any) => ({
                id: 0,
                practical_id: null,
                level_id: null,
                created_at: "",
                input: tc.input || "",
                expected_output: tc.expected_output || "",
                is_hidden: false,
                time_limit_ms: 2000,
                memory_limit_kb: 65536,
              })) || [],
              levels: mappedLevels,
              enableLevels: isMultilevel,
              sampleCode: d.reference_code || "", // Map reference code
              starterCode: d.starter_code || "",  // Map starter code
              sampleLanguage: d.language || "c", // Map language
            };
          });
          setDraftPracticals(mappedDrafts);
          setActiveDraftIndex(0);

          // Initial Load of the first draft
          if (mappedDrafts.length > 0) {
            const first = mappedDrafts[0];
            setForm(first.form);
            setTestCases(first.testCases);
            setLevels(first.levels);
            setEnableLevels(first.enableLevels);
            if (first.sampleCode !== undefined) setSampleCode(first.sampleCode);
            if (first.starterCode !== undefined) setStarterCode(first.starterCode);
            if (first.sampleLanguage !== undefined) setSampleLanguage(first.sampleLanguage);
          }
        } else {
          const initialDraft = createEmptyDraft();
          setDraftPracticals([initialDraft]);
          setActiveDraftIndex(0);
          setForm(initialDraft.form);
          setTestCases(initialDraft.testCases);
          setLevels(initialDraft.levels);
          setEnableLevels(initialDraft.enableLevels);
          setActiveLevel(isExam ? "" : "Task 1");
          setSampleCode(initialDraft.sampleCode || "");
          setStarterCode(initialDraft.starterCode || "");
          setSampleLanguage(initialDraft.sampleLanguage || "c");
        }
      }
    }
  }, [isOpen, practical, initialDrafts, defaultSubjectId, subjects, setSampleCode, setSampleLanguage]);

  // set initial state when practical prop changes
  // set initial state when practical prop changes
  useEffect(() => {
    if (practical) {
      setSelectedStudents([]);
      setStudents([]);
      setAssignedStudentIds([]);
      setAssignedStudentIdsLoaded(false);
      setDidHydrateAssignedSelection(false);
      setStep(isExam ? initialStep : 1);
      setForm({
        ...practical,
      });
      setAssignmentDeadline(new Date().toISOString().slice(0, 16));

      const loadData = async () => {
        try {
          // load test cases for existing practical
          const { data: testData } = await supabase
            .from("test_cases")
            .select("*")
            .eq("practical_id", practical.id);
          if (testData && testData.length > 0) {
            setTestCases(testData as TestCase[]);
          }

          // Load already assigned students for existing practical.
          // Exam fallback handles legacy records where only exam_sessions exist.
          let assignedIds: string[] = [];
          const { data: studentData, error: studentError } = await supabase
            .from("student_practicals")
            .select("student_id")
            .eq("practical_id", practical.id);

          if (!studentError && studentData && studentData.length > 0) {
            assignedIds = studentData
              .map((sp: { student_id: string }) => sp.student_id)
              .filter(Boolean);
          }

          if (isExam && assignedIds.length === 0) {
            const { data: examMeta } = await (supabase
              .from("exams") as any)
              .select("id")
              .eq("practical_id", practical.id)
              .maybeSingle();

            if (examMeta?.id) {
              const { data: examSessions, error: examSessionError } = await (supabase
                .from("exam_sessions") as any)
                .select("student_id")
                .eq("exam_id", examMeta.id);

              if (!examSessionError && Array.isArray(examSessions)) {
                assignedIds = examSessions
                  .map((row: any) => String(row.student_id || ""))
                  .filter(Boolean);
              }
            }
          }

          setAssignedStudentIds(Array.from(new Set(assignedIds)));

          // load levels for existing practical
          const { data: levelsData } = await supabase
            .from("practical_levels")
            .select("*")
            .eq("practical_id", practical.id)
            .order("id", { ascending: true });

          if (levelsData && levelsData.length > 0) {
            setEnableLevels(true);

            // load reference codes too
            const { data: refsData } = await supabase
              .from("reference_codes")
              .select("*")
              .eq("practical_id", practical.id);

            // Match with test cases and reference codes
            const levelsWithTests = levelsData.map((l: any) => {
              const levelRef = refsData?.find((r: any) => r.level_id === l.id);
              return {
                ...l,
                reference_code: levelRef?.code || "",
                starter_code: levelRef?.starter_code || "",
                testCases: (testData || []).filter((tc: any) => tc.level_id === l.id) as TestCase[],
              };
            });
            setLevels(levelsWithTests);

            if (refsData && refsData.length > 0) {
              setSampleCode(refsData[0].code || "");
              setStarterCode(refsData[0].starter_code || "");
              setSampleLanguage(refsData[0].language || practical.language || "c");
            } else {
              setSampleLanguage(practical.language || "c");
            }
          } else {
            setEnableLevels(isExam ? true : false);
            // Even if no levels, load reference code for single level
            const { data: refsData } = await supabase
              .from("reference_codes")
              .select("*")
              .eq("practical_id", practical.id)
              .order("created_at", { ascending: false });

            if (refsData && refsData.length > 0) {
              setSampleCode(refsData[0].code || "");
              setStarterCode(refsData[0].starter_code || "");
              setSampleLanguage(refsData[0].language || practical.language || "c");
            } else {
              setSampleLanguage(practical.language || "c");
            }
          }

          if (isExam) {
            const { data: existingExam } = await supabase
              .from("exams")
              .select("id, duration_minutes, require_fullscreen, start_time, end_time")
              .eq("practical_id", practical.id)
              .maybeSingle();

            if (existingExam) {
              setDurationMinutes(existingExam.duration_minutes || 60);
              setRequireFullscreen(existingExam.require_fullscreen ?? true);
              setStartTime(
                toLocalDateTimeInputValue(existingExam.start_time)
              );
              setEndTime(
                toLocalDateTimeInputValue(existingExam.end_time)
              );
              setAssignmentDeadline(toLocalDateTimeInputValue(new Date().toISOString()));
              setAssignmentDeadline(toLocalDateTimeInputValue(new Date().toISOString()));

              const setsRes = await fetch(`/api/exam/sets?examId=${existingExam.id}`);
              const setsJson = await setsRes.json();

              if (setsJson?.success && Array.isArray(setsJson.sets) && setsJson.sets.length > 0) {
                const levelNameById = new Map<number, string>();
                (levelsData || []).forEach((lvl: any) => {
                  levelNameById.set(lvl.id, lvl.title || lvl.level);
                });

                const mappedSets = setsJson.sets.map((s: any) => ({
                  set_name: s.set_name,
                  level_names: (s.level_ids || [])
                    .map((id: number) => levelNameById.get(id))
                    .filter(Boolean),
                }));

                setEnableSets(true);
                setQuestionSets(mappedSets);
                setActiveSetIdx(0);
              }
            }
          }
        } catch (e) {
          console.error("Failed to fetch practical data:", e);
        } finally {
          setAssignedStudentIdsLoaded(true);
        }
      };

      loadData();
    } else {
      // reset for new practical
      setAssignedStudentIds([]);
      setAssignedStudentIdsLoaded(true);
      setDidHydrateAssignedSelection(false);
      setForm((prev) => ({
        ...prev,
        id: 0,
        title: "",
        description: "",
        language: "",
        max_marks: 10,
        practical_number: null,
        subject_id: defaultSubjectId
          ? Number(defaultSubjectId)
          : (subjects[0]?.id ?? prev.subject_id),
      }));
      setTestCases([
        {
          id: 0,
          practical_id: null,
          level_id: null,
          created_at: "",
          input: "",
          expected_output: "",
          is_hidden: false,
          time_limit_ms: 2000,
          memory_limit_kb: 65536,
        },
      ]);
      setAssignmentDeadline(new Date().toISOString().slice(0, 16));
      setSelectedStudents([]); // Clear selected students for new practical
      setStep(1);
      setDurationMinutes(60);
      setRequireFullscreen(true);
      setStartTime("");
      setEndTime("");
      setEnableSets(isExam);
      setQuestionSets([]);
      setActiveSetIdx(0);
      setEnableLevels(isExam ? true : false);
      setLevels(isExam ? [] : JSON.parse(JSON.stringify(defaultLevels)));
      setActiveLevel(isExam ? "" : "Task 1");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practical, subjects, defaultSubjectId, isExam, initialStep]);

  useEffect(() => {
    if (!isExam) return;
    if (!enableSets) {
      setEnableSets(true);
      return;
    }

    if (questionSets.length === 0) {
      setQuestionSets([
        { set_name: "Set A", level_names: [] },
        { set_name: "Set B", level_names: [] },
      ]);
      setActiveSetIdx(0);
    }
  }, [enableSets, isExam, questionSets.length]);

  useEffect(() => {
    if (isExam && !enableLevels) {
      setEnableLevels(true);
    }
  }, [isExam, enableLevels]);

  useEffect(() => {
    if (!enableSets || questionSets.length === 0) return;
    if (activeSetIdx >= questionSets.length) {
      setActiveSetIdx(Math.max(0, questionSets.length - 1));
    }
  }, [activeSetIdx, enableSets, questionSets.length]);

  useEffect(() => {
    if (!isExam || step !== 2 || !enableLevels) return;
    const activeSet = questionSets[activeSetIdx];
    if (!activeSet) return;

    const scopedLevels = resolveSetLevels(activeSet).map((item) => item.level);

    if (scopedLevels.length === 0) return;
    if (!scopedLevels.some((lvl) => lvl.level === activeLevel)) {
      setActiveLevel(scopedLevels[0].level);
    }
  }, [
    isExam,
    step,
    enableLevels,
    questionSets,
    activeSetIdx,
    activeLevel,
    resolveSetLevels,
  ]);

  // fetch students (with student_details) for assignment - filtered by selected subject's batches
  useEffect(() => {
    const fetchStudents = async () => {
      try {
        // 1. Get current faculty user
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        if (!currentUser) {
          setStudents([]);
          return;
        }

        // 2. Get batches assigned to the SELECTED SUBJECT for this faculty via junction table
        const selectedSubjectId = form.subject_id;
        const { data: subjectBatches } = await supabase
          .from("subject_faculty_batches")
          .select("batch")
          .eq("faculty_id", currentUser.id)
          .eq("subject_id", selectedSubjectId);

        const assignedBatches = [...new Set((subjectBatches || []).map(fb => fb.batch))];
        console.log("[Debug] Assigned Batches for subject:", selectedSubjectId, assignedBatches);
        setAvailableBatches(assignedBatches);
        const hasAllBatch = assignedBatches.includes("All");

        // 3. Fetch students - filter by batch if not "All"
        let query = supabase
          .from("users")
          .select(`uid, name, email, role, roll_no, semester, batch, department`)
          .eq("role", "student");

        // If subject has specific batches (not "All"), filter students by those batches
        if (!hasAllBatch && assignedBatches.length > 0) {
          query = query.in("batch", assignedBatches);
        }

        const { data, error } = await query;

        if (error) {
          console.error("Failed to fetch students:", error);
          setError("Failed to load students.");
          setStudents([]);
          return;
        }

        console.log("[Debug] Fetched students total:", data?.length);

        if (!data) {
          console.log("[Debug] No data returned from users query");
          setStudents([]);
          return;
        }

        const mapped = (data as any[]).map((s) => ({
          uid: s.uid,
          name: s.name,
          email: s.email,
          roll_no: s.roll_no || "",
          semester: s.semester || "",
          batch: s.batch || "",
          role: "student" as const,
          profile_pic: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          active_session_id: null,
          session_updated_at: null,
          department: s.department || null,
        }));
        setStudents(mapped);
      } catch (err) {
        console.error("Error fetching students:", err);
        setError("Failed to load students.");
      }
    };

    fetchStudents();
  }, [supabase, practical, form.subject_id]);

  useEffect(() => {
    if (!practical || didHydrateAssignedSelection || !assignedStudentIdsLoaded) return;
    if (students.length === 0) return;

    const assignedSet = new Set(assignedStudentIds);
    const preSelected = students.filter((s) => assignedSet.has(s.uid));
    setSelectedStudents(preSelected);
    setDidHydrateAssignedSelection(true);
  }, [
    practical,
    didHydrateAssignedSelection,
    assignedStudentIdsLoaded,
    students,
    assignedStudentIds,
  ]);

  useEffect(() => {
    if (isExam) {
      setPracticalNumberConflictMessage("");
      setIsCheckingPracticalNumber(false);
      return;
    }

    const subjectId = Number(form.subject_id) || 0;
    const practicalNumber = Number(form.practical_number) || 0;

    if (!subjectId || !practicalNumber) {
      setPracticalNumberConflictMessage("");
      setIsCheckingPracticalNumber(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setIsCheckingPracticalNumber(true);

        let query = supabase
          .from("practicals")
          .select("id")
          .eq("subject_id", subjectId)
          .eq("practical_number", practicalNumber);

        const practicalId = Number(form.id) || 0;
        if (practicalId > 0) {
          query = query.neq("id", practicalId);
        }

        const { data, error } = await query.limit(1);

        if (cancelled) return;

        if (error) {
          console.error("Failed to validate practical number:", error);
          setPracticalNumberConflictMessage("");
          return;
        }

        if (data && data.length > 0) {
          setPracticalNumberConflictMessage(
            `Practical Number ${practicalNumber} already exists for this subject.`,
          );
        } else {
          setPracticalNumberConflictMessage("");
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Practical number validation failed:", err);
          setPracticalNumberConflictMessage("");
        }
      } finally {
        if (!cancelled) {
          setIsCheckingPracticalNumber(false);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    isExam,
    form.subject_id,
    form.practical_number,
    form.id,
    supabase,
  ]);

  // ---------- handlers ----------
  const handleInput = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target as
      | HTMLInputElement
      | HTMLTextAreaElement
      | HTMLSelectElement;

    if (name === "language") {
      setSampleLanguage(value);
    }

    setForm((prev) => ({
      ...prev,
      [name]:
        name === "max_marks" || name === "practical_number"
          ? Number(value)
          : value,
    }));
  };

  const handleTestCaseChange = (
    index: number,
    field: keyof TestCase,
    value: string | number | boolean,
  ) => {
    setTestCases((prev) => {
      const copy = [...prev];
      if (copy[index]) {
        (copy[index] as any)[field] = value;
      }
      return copy;
    });
  };

  const addTestCase = () =>
    setTestCases((prev) => [
      ...prev,
      {
        id: 0,
        practical_id: null,
        level_id: null,
        created_at: "",
        input: "",
        expected_output: "",
        is_hidden: false,
        time_limit_ms: 2000,
        memory_limit_kb: 65536,
      },
    ]);
  const removeTestCase = (index: number) =>
    setTestCases((prev) => prev.filter((_, i) => i !== index));

  // Level management helpers
  const updateLevelField = (
    level: string,
    field: string,
    value: string | number | boolean,
  ) => {
    let previousDisplayName: string | null = null;
    let nextDisplayName: string | null = null;

    setLevels((prev) =>
      prev.map((l, idx) => {
        if (l.level !== level) return l;

        previousDisplayName = getLevelDisplayName(l, idx);
        const updated = { ...l, [field]: value };
        nextDisplayName = getLevelDisplayName(updated, idx);
        return updated;
      }),
    );

    if (
      (field === "title" || field === "level") &&
      previousDisplayName &&
      nextDisplayName &&
      previousDisplayName !== nextDisplayName
    ) {
      setQuestionSets((prev) =>
        prev.map((set, setIdx) => {
          if (setIdx !== activeSetIdx) return set;

          // Replace matched task in the active set (case-insensitive and trimmed)
          const names = [...set.level_names];
          const lowerPrevious = previousDisplayName!.trim().toLowerCase();
          const replaceIdx = names.findIndex((name) => name.trim().toLowerCase() === lowerPrevious);
          if (replaceIdx >= 0) {
            names[replaceIdx] = nextDisplayName!;
          } else if (!names.map(n => n.trim().toLowerCase()).includes(nextDisplayName!.trim().toLowerCase())) {
            // Fallback: if prior label cannot be found (e.g., after rapid edits),
            // keep the renamed task linked to the active set.
            names.push(nextDisplayName!);
          }

          return {
            ...set,
            level_names: names,
          };
        })
      );
    }
  };

  const addLevelTestCase = (level: string) => {
    setLevels((prev) =>
      prev.map((l) =>
        l.level === level
          ? {
            ...l,
            testCases: [
              ...l.testCases,
              {
                id: 0,
                practical_id: null,
                level_id: null,
                created_at: "",
                input: "",
                expected_output: "",
                is_hidden: false,
                time_limit_ms: 2000,
                memory_limit_kb: 65536,
              },
            ],
          }
          : l,
      ),
    );
  };

  const removeLevelTestCase = (
    level: string,
    index: number,
  ) => {
    setLevels((prev) =>
      prev.map((l) =>
        l.level === level
          ? { ...l, testCases: l.testCases.filter((_, i) => i !== index) }
          : l,
      ),
    );
  };

  const updateLevelTestCase = (
    level: string,
    index: number,
    field: keyof TestCase,
    value: string | number | boolean,
  ) => {
    setLevels((prev) =>
      prev.map((l) => {
        if (l.level !== level) return l;
        const newTestCases = [...l.testCases];
        (newTestCases[index] as any)[field] = value;
        return { ...l, testCases: newTestCases };
      }),
    );
  };

  const handleAddLevel = () => {
    setLevels((prev) => {
      const inserted = [
        ...prev,
        {
          id: 0,
          practical_id: typeof practical?.id === 'number' ? practical.id : 0,
          created_at: "",
          updated_at: "",
          level: `Task ${prev.length + 1}`,
          title: `Task ${prev.length + 1}`,
          description: "",
          max_marks: 8,
          testCases: [
            {
              id: 0,
              practical_id: null,
              level_id: null,
              created_at: "",
              input: "",
              expected_output: "",
              is_hidden: false,
              time_limit_ms: 2000,
              memory_limit_kb: 65536,
            },
          ],
        },
      ];

      // Ensure all tasks are named sequentially "Task 1", "Task 2", etc.
      const renamed = inserted.map((lvl, index) => {
        const expectedName = `Task ${index + 1}`;
        return {
          ...lvl,
          level: expectedName,
          title: lvl.title?.startsWith("Task ") ? expectedName : lvl.title
        }
      });

      setActiveLevel(`Task ${renamed.length}`);
      return renamed;
    });
  };

  const handleRemoveLevel = (levelToRemove: string) => {
    setLevels((prev) => {
      const filtered = prev.filter((l) => l.level !== levelToRemove);

      // Rename remaining tasks sequentially so there are no gaps
      const renamed = filtered.map((lvl, index) => {
        const expectedName = `Task ${index + 1}`;
        return {
          ...lvl,
          level: expectedName,
          title: lvl.title?.startsWith("Task ") ? expectedName : lvl.title
        }
      });

      if (renamed.length === 0) {
        setEnableLevels(false);
      } else {
        // Find the index of the removed task to intelligently focus the next available task
        const removedIndex = prev.findIndex(l => l.level === levelToRemove);
        const nextActiveIndex = Math.min(removedIndex, renamed.length - 1);
        setActiveLevel(renamed[nextActiveIndex].level);
      }
      return renamed;
    });
  };

  const createTaskForActiveSet = useCallback(() => {
    const activeSet = questionSets[activeSetIdx];
    if (!activeSet) return;

    if (!enableLevels) {
      setEnableLevels(true);
    }

    const defaultSetName = `Set ${String.fromCharCode(65 + activeSetIdx)}`;
    const setName = activeSet.set_name?.trim() || defaultSetName;
    const existingTaskNumbers = levels
      .map((lvl, idx) => {
        const display = getLevelDisplayName(lvl, idx);
        const match = display.match(new RegExp(`^${setName.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\s-\\sTask\\s(\\d+)$`));
        return match ? Number(match[1]) : null;
      })
      .filter((n): n is number => typeof n === "number" && Number.isFinite(n));
    const taskNumber = existingTaskNumbers.length > 0 ? Math.max(...existingTaskNumbers) + 1 : 1;
    const taskTitle = `${setName} - Task ${taskNumber}`;
    const internalLevelName = `Task ${levels.length + 1}`;

    setLevels((prev) => [
      ...prev,
      {
        id: 0,
        practical_id: typeof practical?.id === "number" ? practical.id : 0,
        created_at: "",
        updated_at: "",
        level: internalLevelName,
        title: taskTitle,
        description: "",
        max_marks: 5,
        testCases: [
          {
            id: 0,
            practical_id: null,
            level_id: null,
            created_at: "",
            input: "",
            expected_output: "",
            is_hidden: false,
            time_limit_ms: 2000,
            memory_limit_kb: 65536,
          },
        ],
      },
    ]);

    setQuestionSets((prev) =>
      prev.map((set, idx) =>
        idx === activeSetIdx
          ? { ...set, level_names: [...set.level_names, taskTitle] }
          : set
      )
    );
    setActiveLevel(internalLevelName);
  }, [activeSetIdx, enableLevels, levels, practical?.id, questionSets, getLevelDisplayName]);

  const removeTaskFromSet = useCallback((taskName: string) => {
    const levelToRemove = levels.find((lvl, idx) => getLevelDisplayName(lvl, idx) === taskName);
    if (!levelToRemove) return;

    setQuestionSets((prev) =>
      prev.map((set) => ({
        ...set,
        level_names: set.level_names.filter((name) => name !== taskName),
      }))
    );

    setLevels((prev) => prev.filter((lvl) => lvl.level !== levelToRemove.level));
  }, [levels, getLevelDisplayName]);

  const removeTaskFromSetByLevel = useCallback((levelKey: string) => {
    const levelIndex = levels.findIndex((lvl) => lvl.level === levelKey);
    if (levelIndex < 0) return;

    const taskName = getLevelDisplayName(levels[levelIndex], levelIndex);
    setQuestionSets((prev) =>
      prev.map((set) => ({
        ...set,
        level_names: set.level_names.filter((name) => name !== taskName),
      }))
    );

    setLevels((prev) => prev.filter((lvl) => lvl.level !== levelKey));
  }, [levels, getLevelDisplayName]);

  const getCurrentLevel = () => levels.find((l) => l.level === activeLevel) || levels[0];

  const generateTestCases = async () => {
    const currentLevel = enableLevels ? getCurrentLevel() : null;
    const sourceDescription = enableLevels
      ? currentLevel?.description || ""
      : form.description || "";
    const sourceReferenceCode = enableLevels
      ? currentLevel?.reference_code || ""
      : sampleCode || "";

    const normalizedLanguage = String(sampleLanguage || form.language || "c")
      .toLowerCase()
      .trim();
    const sourceLanguage =
      normalizedLanguage === "c++"
        ? "cpp"
        : normalizedLanguage === "py"
          ? "python"
          : normalizedLanguage;

    const requestedCount = Number.isFinite(fuzzerCount)
      ? Math.min(100, Math.max(1, Math.round(fuzzerCount)))
      : 100;

    if (enableLevels && !currentLevel) {
      alert("Please select a level first.");
      return;
    }

    if (!sourceDescription || sourceDescription.trim().length < 10) {
      alert("Please enter a detailed description first.");
      return;
    }

    if (!sourceReferenceCode || sourceReferenceCode.trim().length < 10) {
      alert("Please add reference code first. Fuzzer needs it to build expected outputs.");
      return;
    }

    setGeneratingTests(true);
    try {
      const currentCases = enableLevels
        ? currentLevel?.testCases || []
        : testCases;

      const existingInputs = currentCases
        .map((tc) => String(tc.input || "").trimEnd())
        .filter((input) => input.length > 0);

      const defaultTimeLimit = Number(currentCases[0]?.time_limit_ms || 2000);
      const defaultMemoryLimit = Number(
        currentCases[0]?.memory_limit_kb ||
          (sourceLanguage === "java" ? 262144 : 65536),
      );

      const savedSettings = localStorage.getItem("ai_settings");
      const aiConfig = savedSettings ? JSON.parse(savedSettings) : {};
      const fuzzerAiConfig = {
        requestTimeoutMs:
          Number(aiConfig?.requestTimeoutMs) > 0
            ? Number(aiConfig.requestTimeoutMs)
            : 300000,
        maxOutputTokens:
          Number(aiConfig?.maxOutputTokens) > 0
            ? Number(aiConfig.maxOutputTokens)
            : undefined,
      };
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch(`/api/ai/generate-fuzzer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({
          description: sourceDescription,
          referenceCode: sourceReferenceCode,
          language: sourceLanguage,
          count: requestedCount,
          existingInputs,
          timeLimitMs: defaultTimeLimit,
          memoryLimitKb: defaultMemoryLimit,
          config: fuzzerAiConfig,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || `API Error: ${res.statusText}`);
      }

      const generatedTests = Array.isArray(payload?.testCases)
        ? payload.testCases
        : [];

      if (generatedTests.length === 0) {
        throw new Error("No valid executable test cases were generated.");
      }

        const formattedTests: TestCase[] = generatedTests.map((t: any) => ({
          input: String(t.input || ""),
          expected_output: String(t.expected_output ?? t.expectedOutput ?? ""),
          is_hidden: Boolean(t.is_hidden || false),
          time_limit_ms: Number(t.time_limit_ms || defaultTimeLimit),
          memory_limit_kb: Number(t.memory_limit_kb || defaultMemoryLimit),
          id: 0,
          practical_id: null,
          level_id: null,
          created_at: "",
        }));

      if (enableLevels && currentLevel) {
        const currentLevelKey = currentLevel.level;
        const existingInputSet = new Set(
          currentLevel.testCases.map((tc) => tc.input.trimEnd()),
        );
        const uniqueTests = formattedTests.filter(
          (tc) => !existingInputSet.has(tc.input.trimEnd()),
        );

        setLevels((prev) =>
          prev.map((l) =>
            l.level === currentLevelKey
              ? { ...l, testCases: [...l.testCases, ...uniqueTests] }
              : l,
          ),
        );
      } else {
        const existingInputSet = new Set(testCases.map((tc) => tc.input.trimEnd()));
        const uniqueTests = formattedTests.filter(
          (tc) => !existingInputSet.has(tc.input.trimEnd()),
        );

        setTestCases((prev) => [...prev, ...uniqueTests]);
      }

      const generatedCount = Number(payload?.meta?.generatedCount || formattedTests.length);
      const requested = Number(payload?.meta?.requestedCount || requestedCount);
      if (generatedCount < requested) {
        alert(
          `Fuzzer generated ${generatedCount}/${requested} valid test cases. Try regenerating for more coverage.`,
        );
      }
    } catch (err: any) {
      console.error("Fuzzer Generation Error:", err);
      alert(
        "Failed to generate fuzz test cases. Please try again. " +
          (err.message || ""),
      );
    } finally {
      setGeneratingTests(false);
    }
  };
  const handleUploadPdf = async (file: File) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("pdf", file);
      formData.append("isExam", String(isExam));
      formData.append("language", form.language || "c");

      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(`/api/ai/generate-bulk`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${session?.access_token || ""}`
        },
        body: formData,
      });

      if (!res.ok) {
        let errorMsg = `Failed to autofill from PDF.`;
        try {
          const errData = await res.json();
          // The backend error middleware sends { error: { message, code } }
          errorMsg = errData.error?.message || errData.error || errorMsg;
        } catch (e) {
          errorMsg = `Server error (${res.status}): ${res.statusText}`;
        }
        throw new Error(errorMsg);
      }

      const data = await res.json();
      const practicals = Array.isArray(data) ? data : (data.practicals || []);
      
      if (practicals.length === 0) {
        throw new Error(isExam ? "No exam questions or sets found in the PDF. Please try a clearer document." : "No practicals found in the PDF.");
      }

      // Combine ALL levels and sets from all practicals found in the PDF
      let allMappedLevels: any[] = [];
      let allMappedSets: any[] = [];
      const firstPractical = practicals[0];

      practicals.forEach((p: any, pIdx: number) => {
        // 1. Extract Levels (Tasks)
        let currentPracticalLevels: any[] = [];
        
        if (p.levels && p.levels.length > 0) {
          currentPracticalLevels = p.levels.map((l: any, idx: number) => ({
            id: 0,
            practical_id: 0,
            created_at: "",
            updated_at: "",
            level: l.level || `Set${pIdx + 1}_Task${idx + 1}`,
            title: l.title || `Task ${idx + 1}`,
            description: l.description || "",
            max_marks: Number(l.max_marks || p.max_marks) || 5,
            reference_code: l.reference_code || p.reference_code || "",
            starter_code: l.starter_code || p.starter_code || "",
            testCases: (l.testCases || p.testCases || []).map((tc: any) => ({
              id: 0,
              practical_id: null,
              level_id: null,
              created_at: "",
              input: typeof tc.input === 'object' ? JSON.stringify(tc.input, null, 2) : (tc.input || ""),
              expected_output: typeof tc.expected_output === 'object' ? JSON.stringify(tc.expected_output, null, 2) : (tc.expected_output || ""),
              is_hidden: false,
              time_limit_ms: 2000,
              memory_limit_kb: 65536,
            }))
          }));
        } else if (p.description || (p.testCases && p.testCases.length > 0)) {
          // Practical itself IS a task (top-level structure)
          currentPracticalLevels = [{
            id: 0,
            practical_id: 0,
            created_at: "",
            updated_at: "",
            level: p.title || `Set ${pIdx + 1} Task 1`,
            title: p.title || `Set ${pIdx + 1} Task 1`,
            description: p.description || "",
            max_marks: Number(p.max_marks) || 10,
            reference_code: p.reference_code || "",
            starter_code: p.starter_code || "",
            testCases: (p.testCases || []).map((tc: any) => ({
              id: 0,
              practical_id: null,
              level_id: null,
              created_at: "",
              input: typeof tc.input === 'object' ? JSON.stringify(tc.input, null, 2) : (tc.input || ""),
              expected_output: typeof tc.expected_output === 'object' ? JSON.stringify(tc.expected_output, null, 2) : (tc.expected_output || ""),
              is_hidden: false,
              time_limit_ms: 2000,
              memory_limit_kb: 65536,
            }))
          }];
        }
        
        allMappedLevels = [...allMappedLevels, ...currentPracticalLevels];

        // 2. Extract/Create Sets
        if (isExam) {
          if (p.sets && p.sets.length > 0) {
            allMappedSets = [...allMappedSets, ...p.sets.map((s: any) => ({
              set_name: s.set_name || `Set ${pIdx + 1}`,
              level_names: s.level_names || currentPracticalLevels.map((l: any) => l.title || l.level)
            }))];
          } else {
            // Create a set for this practical
            const setName = p.title?.startsWith("Set") ? p.title : `Set ${p.practical_number || pIdx + 1}`;
            allMappedSets.push({
              set_name: setName,
              level_names: currentPracticalLevels.map((l: any) => l.title || l.level)
            });
          }
        }
      });

      // POST-PROCESSING: Ensure unique level titles and proper set↔level mapping
      if (isExam && allMappedLevels.length > 0) {
        // Step A: Ensure all level titles are globally unique
        const titleCounts = new Map<string, number>();
        allMappedLevels.forEach((l: any) => {
          const t = (l.title || "").trim().toLowerCase();
          titleCounts.set(t, (titleCounts.get(t) || 0) + 1);
        });

        const titleSeen = new Map<string, number>();
        const oldTitleToNew = new Map<string, string>(); // Track renames for set sync
        allMappedLevels = allMappedLevels.map((l: any) => {
          const t = (l.title || "").trim();
          const tLower = t.toLowerCase();
          if ((titleCounts.get(tLower) || 0) > 1) {
            const count = (titleSeen.get(tLower) || 0) + 1;
            titleSeen.set(tLower, count);
            const levelPrefix = l.level || `Variant ${count}`;
            const newTitle = `${t} (${levelPrefix})`;
            oldTitleToNew.set(t, newTitle); // Only last rename stored, but we handle below
            l.title = newTitle;
          }
          return l;
        });

        // Step B: Re-sync set level_names with actual level titles
        const allLevelTitles = new Set(allMappedLevels.map((l: any) => l.title));

        allMappedSets = allMappedSets.map((s: any) => {
          const existingValid = (s.level_names || []).filter((name: string) => allLevelTitles.has(name));
          
          if (existingValid.length > 0) {
            // Some level_names already match — keep them
            s.level_names = existingValid;
          } else {
            // No direct match — try matching by level key prefix (e.g. "Set A - Q1" starts with "Set A")
            const sNameLower = (s.set_name || "").trim().toLowerCase();
            const matchedByKey = allMappedLevels
              .filter((l: any) => {
                const levelKey = (l.level || "").toLowerCase();
                return levelKey.startsWith(sNameLower);
              })
              .map((l: any) => l.title);
            
            if (matchedByKey.length > 0) {
              s.level_names = matchedByKey;
            }
            // else keep original level_names as fallback
          }

          return s;
        });

        // Deduplicate sets by name (merge level_names)
        const setMap = new Map<string, any>();
        allMappedSets.forEach((s: any) => {
          const key = (s.set_name || "").trim();
          if (!setMap.has(key)) {
            setMap.set(key, { ...s });
          } else {
            const existing = setMap.get(key)!;
            existing.level_names = Array.from(new Set([
              ...(existing.level_names || []),
              ...(s.level_names || [])
            ]));
          }
        });
        allMappedSets = Array.from(setMap.values());
      }

      console.log("[Autofill] Post-processed levels:", allMappedLevels.map((l: any) => ({ level: l.level, title: l.title })));
      console.log("[Autofill] Post-processed sets:", allMappedSets.map((s: any) => ({ set_name: s.set_name, level_names: s.level_names })));

      // Update basic details from the first practical
      console.log("[Autofill] Found practicals count:", practicals.length);
      console.log("[Autofill] allMappedLevels count:", allMappedLevels.length);
      console.log("[Autofill] allMappedSets count:", allMappedSets.length);

      // Update basic details from the first practical
      let updatedTitle = firstPractical.title || form.title;
      let updatedDescription = firstPractical.description || form.description;
      let updatedLanguage = firstPractical.language || form.language || "c";
      
      if (isExam) {
        // Do not overwrite explicitly provided details from Step 1
        updatedTitle = form.title || updatedTitle;
        updatedDescription = form.description || updatedDescription;
        updatedLanguage = form.language || updatedLanguage;
      }

      const newFormState = {
        ...form,
        title: updatedTitle,
        description: updatedDescription,
        language: updatedLanguage,
        max_marks: Number(firstPractical.max_marks || (allMappedLevels.reduce((s: number, l: any) => s + l.max_marks, 0))) || form.max_marks,
        practical_number: form.practical_number, // Ignore AI-extracted practical number to allow safe auto-increment
        is_exam: isExam
      };

      setForm(newFormState);

      if (isExam && (firstPractical.duration_minutes || firstPractical.duration)) {
        setDurationMinutes(Number(firstPractical.duration_minutes || firstPractical.duration));
      }

      if (allMappedLevels.length > 0) {
        setEnableLevels(true);
        setLevels(allMappedLevels);
        setActiveLevel(allMappedLevels[0].level);
      }

      if (isExam && allMappedSets.length > 0) {
        setEnableSets(true);
        setQuestionSets(allMappedSets);
      }

      // Update single-level fields from the first practical if no levels
      let finalTestCases = testCases;
      if (allMappedLevels.length === 0) {
        const langToUse = firstPractical.language || form.language || "c";
        setSampleLanguage(langToUse);
        if (firstPractical.reference_code) setSampleCode(firstPractical.reference_code);
        if (firstPractical.starter_code) setStarterCode(firstPractical.starter_code);
        
        if (firstPractical.testCases && firstPractical.testCases.length > 0) {
          finalTestCases = firstPractical.testCases.map((tc: any) => ({
            id: 0,
            practical_id: null,
            level_id: null,
            created_at: "",
            input: typeof tc.input === 'object' ? JSON.stringify(tc.input, null, 2) : (tc.input || ""),
            expected_output: typeof tc.expected_output === 'object' ? JSON.stringify(tc.expected_output, null, 2) : (tc.expected_output || ""),
            is_hidden: false,
            time_limit_ms: 2000,
            memory_limit_kb: 65536,
          }));
          setTestCases(finalTestCases);
        }
      }

      // CRITICAL: Directly update the draft to avoid stale closures
      if (!practical && draftPracticals.length > 0) {
        setDraftPracticals(prev => {
          const copy = [...prev];
          if (copy[activeDraftIndex]) {
            copy[activeDraftIndex] = {
              ...copy[activeDraftIndex],
              form: newFormState,
              testCases: [...finalTestCases],
              levels: JSON.parse(JSON.stringify(allMappedLevels)),
              enableLevels: allMappedLevels.length > 0,
              sampleCode: allMappedLevels.length === 0 ? (firstPractical.reference_code || "") : "",
              starterCode: allMappedLevels.length === 0 ? (firstPractical.starter_code || "") : "",
              sampleLanguage: firstPractical.language || form.language || "c",
            };
          }
          return copy;
        });
      }

      alert(`Magic Autofill Success!\n- Extracted: ${allMappedLevels.length} Tasks\n- Created: ${allMappedSets.length} Sets\n\nCheck Step 2 to review the questions.`);
    } catch (err: any) {
      console.error("Autofill error:", err);
      const errorMessage = typeof err === 'string' 
        ? err 
        : (err.message || "Failed to autofill from PDF. Check backend logs.");
      alert(errorMessage);
    } finally {
      setIsUploading(false);
    }
  };

  const getLanguageExtension = useCallback(
    () => {
      const lang = String(sampleLanguage || "").toLowerCase();
      if (lang === "python") return python();
      if (lang === "java") return cpp(); // Use C++ mode for Java
      return cpp();
    },
    [sampleLanguage],
  );

  // Validate form data
  const validateForm = useCallback(() => {
    if (!isExam && !form.practical_number) {
      alert("Please enter a Practical Number");
      return false;
    }
    if (!isExam && practicalNumberConflictMessage) {
      return false;
    }
    if (!form.title.trim()) {
      alert("Please enter a Practical Title");
      return false;
    }

    if (!form.subject_id) {
      alert("Please select a Subject");
      return false;
    }

    // Exam Step 1 saves only core metadata and exam settings.
    // Question/set validation is enforced in later steps.
    if (isExam && step === 1) {
      return true;
    }

    if (enableLevels) {
      if (levels.length === 0) {
        alert("Please add at least one Level");
        return false;
      }
      for (let i = 0; i < levels.length; i++) {
        const lvl = levels[i];
        if (!lvl.title?.trim()) {
          alert(`Level ${i + 1} must have a title`);
          return false;
        }
        if (!isExam && !lvl.description?.trim()) {
          alert(`Level ${i + 1} must have a description`);
          return false;
        }
        if (lvl.max_marks <= 0) {
          alert(`Level ${i + 1} must have max marks greater than 0`);
          return false;
        }
        // Enforce at least one test case per level for strictness
        if (lvl.testCases.length === 0) {
          alert(`Level ${i + 1} must have at least one test case`);
          return false;
        }
      }
    } else {
      if (!form.description?.trim()) {
        alert("Please enter a Description");
        return false;
      }
      if ((form.max_marks ?? 0) <= 0) {
        alert("Max Marks must be greater than 0");
        return false;
      }
      // Strict: Require at least one test case
      if (testCases.length === 0) {
        alert("Please add at least one test case");
        return false;
      }
    }

    return true;
  }, [form, enableLevels, levels, testCases, isExam, step, practicalNumberConflictMessage]);

  const getSetValidationErrors = useCallback(() => {
    const errors: string[] = [];
    if (!enableLevels || levels.length === 0) {
      errors.push("Enable multi-level mode to configure question sets.");
      return errors;
    }
    if (questionSets.length < 2) {
      errors.push("At least 2 sets are required (Set A, Set B).");
    }

    questionSets.forEach((set, idx) => {
      if (!set.set_name.trim()) {
        errors.push(`Set ${idx + 1} must have a name.`);
      }
      if (resolveSetLevels(set).length === 0) {
        errors.push(`"${set.set_name || `Set ${idx + 1}`}" has no tasks created.`);
      }
    });

    return errors;
  }, [enableLevels, levels, questionSets, resolveSetLevels]);

  const saveExamConfiguration = useCallback(async (
    practicalId: number,
    options?: { skipSetSync?: boolean },
  ) => {
    let examId: number | null = null;
    const { data: existingExam } = await supabase
      .from("exams")
      .select("id")
      .eq("practical_id", practicalId)
      .maybeSingle();

    const examPayload = {
      practical_id: practicalId,
      duration_minutes: durationMinutes,
      require_fullscreen: requireFullscreen,
      start_time: startTime ? new Date(startTime).toISOString() : null,
      end_time: endTime ? new Date(endTime).toISOString() : null,
    };

    if (existingExam?.id) {
      const { error } = await supabase
        .from("exams")
        .update(examPayload)
        .eq("id", existingExam.id);
      if (error) throw error;
      examId = existingExam.id;
    } else {
      const { data, error } = await supabase
        .from("exams")
        .insert(examPayload)
        .select("id")
        .single();
      if (error) throw error;
      examId = data.id;
    }

    if (!examId) return;
    if (options?.skipSetSync) return;

    const { data: persistedLevels } = await supabase
      .from("practical_levels")
      .select("id, level, title")
      .eq("practical_id", practicalId)
      .order("id", { ascending: true });

    const levelIdByName = new Map<string, number>();
    (persistedLevels || []).forEach((lvl: any) => {
      const name = (lvl.title || lvl.level || "").trim().toLowerCase();
      if (name) levelIdByName.set(name, lvl.id);
    });

    const setsPayload = questionSets.map((set) => {
      const resolvedItems = resolveSetLevels(set);
      const resolvedNames = resolvedItems.map((item) =>
        getLevelDisplayName(item.level, item.idx).trim().toLowerCase()
      );

      const levelIds = resolvedNames
        .map((name) => levelIdByName.get(name))
        .filter((id): id is number => typeof id === "number");

      console.log(`[SaveExam] Set "${set.set_name}": resolved ${resolvedNames.length} names, found ${levelIds.length} IDs in DB mapping`, {
        resolvedNames,
        dbMappingKeys: Array.from(levelIdByName.keys())
      });

      return {
        set_name: set.set_name,
        level_ids: levelIds,
      };
    });

    const response = await fetch("/api/exam/sets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ examId, sets: setsPayload }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result?.error || "Failed to save question sets");
    }
  }, [
    supabase,
    durationMinutes,
    requireFullscreen,
    startTime,
    endTime,
    questionSets,
    resolveSetLevels,
    getLevelDisplayName,
  ]);

  // Save generic form components
  const saveReferenceCode = async (pId: number, code: string, lang: string, starterCode?: string, levelId?: number) => {
    if (!pId) return;
    // Allow saving even if code is empty, as long as starterCode exists (or vice versa)
    console.log(`[SaveRef] Saving for practical=${pId}, lang=${lang}, levelId=${levelId || 'none'}, hasCode=${!!code}, hasStarter=${!!starterCode}`);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;

      if (!userId) {
        console.warn("[SaveRef] No user ID found, skipping");
        return;
      }

      const insertPayload: Record<string, any> = {
        practical_id: pId,
        code: code || "",
        starter_code: starterCode || null,
        language: lang,
        author: userId,
        is_primary: true,
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (levelId) {
        insertPayload.level_id = levelId;
      }

      console.log("[SaveRef] Inserting payload:", JSON.stringify(insertPayload).substring(0, 200));

      const { data, error } = await supabase
        .from("reference_codes")
        .insert(insertPayload)
        .select("id, practical_id, level_id, starter_code")
        .single();

      if (error) {
        console.error("[SaveRef] INSERT FAILED:", error.message, error.details, error.hint, error.code);
        throw error;
      }

      console.log(`[SaveRef] ✅ Successfully saved! Row id=${data?.id}, practical=${data?.practical_id}, level_id=${data?.level_id}, has_starter=${!!data?.starter_code}`);
    } catch (err: any) {
      console.error("[SaveRef] Error:", err?.message || err?.code || err?.details || JSON.stringify(err));
    }
  };

  // Save practical (create/update)
  const handleSave = useCallback(async () => {
    if (!validateForm()) return false;

    setSaving(true);
    try {
      // Exams don't use practical numbers
      let resolvedPracticalNumber: number | null = null;

      if (!isExam) {
        resolvedPracticalNumber = Number(form.practical_number) || 0;

        if (!resolvedPracticalNumber && form.subject_id) {
          const { data: subjectPracticals, error: numErr } = await supabase
            .from("practicals")
            .select("practical_number")
            .eq("subject_id", form.subject_id);

          if (numErr) throw numErr;

          const maxExisting = Math.max(
            0,
            ...((subjectPracticals || [])
              .map((p: any) => Number(p.practical_number) || 0)
              .filter((n: number) => n > 0))
          );
          resolvedPracticalNumber = maxExisting + 1;
        }

        // Check for duplicate practical number in the same subject
        if (form.subject_id && resolvedPracticalNumber) {
          let query = supabase
            .from("practicals")
            .select("id")
            .eq("subject_id", form.subject_id)
            .eq("practical_number", resolvedPracticalNumber);

          const practicalId = Number(form.id) || 0;
          if (practicalId > 0) {
            query = query.neq("id", practicalId);
          }

          const { data: existing, error: checkError } = await query;

          if (checkError) throw checkError;

          if (existing && existing.length > 0) {
            setPracticalNumberConflictMessage(
              `Practical Number ${resolvedPracticalNumber} already exists for this subject.`,
            );
            setSaving(false);
            return false;
          }

          setPracticalNumberConflictMessage("");
        }
      }

      let practicalId = Number(form.id) || 0;
      const resolvedExamMaxMarks = (() => {
        if (!isExam || !enableLevels) {
          return enableLevels
            ? levels.reduce((sum, l) => sum + l.max_marks, 0)
            : (form.max_marks ?? 10);
        }

        if (questionSets.length === 0) {
          return levels.reduce((sum, l) => sum + l.max_marks, 0);
        }

        const setTotals = questionSets.map((set) =>
          resolveSetLevels(set).reduce((sum, item) => {
            return sum + (item.level.max_marks || 0);
          }, 0)
        );

        return Math.max(0, ...setTotals);
      })();

      const safeExamMaxMarks = isExam
        ? Math.max(1, Number(resolvedExamMaxMarks) || 0)
        : resolvedExamMaxMarks;

      const payload: Record<string, any> = {
        title: form.title,
        subject_id: form.subject_id,
        description: enableLevels ? "" : form.description,
        language: form.language,
        max_marks: safeExamMaxMarks,
        practical_number: resolvedPracticalNumber || null,
      };
      if (isExam) payload.is_exam = true;

      if (practicalId && practicalId > 0) {
        const { data, error } = await supabase
          .from("practicals")
          .update(payload)
          .eq("id", practicalId)
          .select()
          .single();
        if (error) throw error;
        practicalId = data.id;

        // Delete old test cases and reference codes (they will be re-inserted below)
        await supabase.from("reference_codes").delete().eq("practical_id", practicalId);
        await supabase.from("test_cases").delete().eq("practical_id", practicalId);

        // For levels: identify which levels to keep vs remove
        if (enableLevels) {
          const currentLevelNames = levels.map(l => l.level);
          // Fetch existing levels
          const { data: existingLevels } = await supabase
            .from("practical_levels")
            .select("id, level")
            .eq("practical_id", practicalId);

          // Remove levels that are no longer in the form
          if (existingLevels && existingLevels.length > 0) {
            const levelsToRemove = existingLevels.filter(
              (el: any) => !currentLevelNames.includes(el.level)
            );
            if (levelsToRemove.length > 0) {
              const removeIds = levelsToRemove.map((l: any) => l.id);
              // Clean up exam_set_levels first
              await supabase.from("exam_set_levels").delete().in("level_id", removeIds);
              await supabase.from("practical_levels").delete().in("id", removeIds);
            }
          }
        } else {
          // Single level mode: remove all levels
          const { data: existingLevels } = await supabase
            .from("practical_levels")
            .select("id")
            .eq("practical_id", practicalId);
          if (existingLevels && existingLevels.length > 0) {
            const removeIds = existingLevels.map((l: any) => l.id);
            await supabase.from("exam_set_levels").delete().in("level_id", removeIds);
            await supabase.from("practical_levels").delete().in("id", removeIds);
          }
        }
      } else {
        const { data, error } = await supabase
          .from("practicals")
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        practicalId = data.id;
      }

      if (enableLevels) {
        // Save levels with their test cases (upsert to handle both create and update)
        for (const level of levels) {
          const { data: levelData, error: levelErr } = await supabase
            .from("practical_levels")
            .upsert({
              practical_id: practicalId,
              level: level.level,
              title: level.title,
              description: level.description,
              max_marks: level.max_marks,
            }, { onConflict: "practical_id,level" })
            .select()
            .single();

          if (levelErr) throw levelErr;

          // Save reference code for this level
          await saveReferenceCode(practicalId, level.reference_code || "", form.language || "c", level.starter_code, levelData.id);

          // Insert test cases for this level
          if (levelData && level.testCases.length > 0) {
            const tcData = level.testCases.map((tc) => ({
              practical_id: practicalId,
              level_id: levelData.id,
              input: tc.input,
              expected_output: tc.expected_output,
              is_hidden: tc.is_hidden || false,
              time_limit_ms: Number(tc.time_limit_ms) || 2000,
              memory_limit_kb: Number(tc.memory_limit_kb) || 65536,
            }));
            const { error: tcErr } = await supabase
              .from("test_cases")
              .insert(tcData);
            if (tcErr) throw tcErr;
          }
        }
      } else {
        // Original single-level test cases
        if (practicalId && testCases.length > 0) {
          const insertData = testCases.map((tc) => ({
            practical_id: practicalId,
            input: tc.input,
            expected_output: tc.expected_output,
            is_hidden: tc.is_hidden || false,
            time_limit_ms: Number(tc.time_limit_ms) || 2000,
            memory_limit_kb: Number(tc.memory_limit_kb) || 65536,
          }));
          const { error: tcErr } = await supabase
            .from("test_cases")
            .insert(insertData);
          if (tcErr) throw tcErr;
        }

        // Save reference code for single level
        if (sampleCode || starterCode) {
          await saveReferenceCode(practicalId, sampleCode, sampleLanguage, starterCode);
        }
      }

      // update local form id
      setForm((prev) => ({ ...prev, id: practicalId }));

      if (onSaveStep1) {
        onSaveStep1(practicalId);
      }

      return practicalId; // Return the ID so caller can use it
    } catch (err: any) {
      console.error("Error saving practical:", err);
      alert("Failed to save practical: " + (err?.message || String(err)));
      return false; // Return failure
    } finally {
      setSaving(false);
    }
  }, [
    form,
    testCases,
    levels,
    enableLevels,
    questionSets,
    getLevelDisplayName,
    resolveSetLevels,
    isExam,
    sampleCode,
    starterCode,
    sampleLanguage,
    supabase,
    validateForm,
    onSaveStep1,
  ]);

  // Save ALL drafts (for bulk import mode)
  const handleSaveAll = useCallback(async () => {
    setSaving(true);
    let successCount = 0;
    let failCount = 0;
    let firstErrorMessage = "";
    const savedData: { id: number }[] = [];

    try {
      // Ensure currently edited draft state is included before iterating.
      const draftsToSave = [...draftPracticals];
      if (draftsToSave[activeDraftIndex]) {
        draftsToSave[activeDraftIndex] = {
          ...draftsToSave[activeDraftIndex],
          form: { ...form },
          testCases: [...testCases],
          levels: JSON.parse(JSON.stringify(levels)),
          enableLevels,
          sampleCode,
          starterCode,
          sampleLanguage,
        };
      }

      const resolvedPracticalNumbersByDraftId = new Map<string, number | null>();

      // Validate practical numbers up-front so duplicates are blocked before any insert.
      if (!isExam) {
        const usedNumbersBySubject = new Map<number, Set<number>>();

        for (const draft of draftsToSave) {
          const draftForm = draft.form;
          if (!draftForm.title?.trim() || !draftForm.subject_id) {
            continue;
          }

          const subjectId = Number(draftForm.subject_id);
          if (!usedNumbersBySubject.has(subjectId)) {
            const { data: subjectPracticals, error: numErr } = await supabase
              .from("practicals")
              .select("practical_number")
              .eq("subject_id", subjectId);

            if (numErr) throw numErr;

            const existingNumbers = new Set<number>(
              ((subjectPracticals || []) as any[])
                .map((p: any) => Number(p.practical_number) || 0)
                .filter((n: number) => n > 0),
            );

            usedNumbersBySubject.set(subjectId, existingNumbers);
          }

          const usedNumbers = usedNumbersBySubject.get(subjectId)!;
          const requestedPracticalNumber = Number(draftForm.practical_number) || 0;
          const resolvedPracticalNumber =
            requestedPracticalNumber > 0
              ? requestedPracticalNumber
              : Math.max(0, ...Array.from(usedNumbers)) + 1;

          if (usedNumbers.has(resolvedPracticalNumber)) {
            setPracticalNumberConflictMessage(
              `Practical Number ${resolvedPracticalNumber} already exists for this subject.`,
            );
            return [];
          }

          usedNumbers.add(resolvedPracticalNumber);
          resolvedPracticalNumbersByDraftId.set(draft.id, resolvedPracticalNumber);
        }
      }

      // Save each draft sequentially
      for (const draft of draftsToSave) {
        try {
          // Build payload from the draft's stored data
          const draftEnableLevels = draft.enableLevels;
          const draftLevels = draft.levels;
          const draftTestCases = draft.testCases;
          const draftForm = draft.form;

          // Validate this draft
          if (!draftForm.title?.trim()) {
            console.info(`Skipping empty draft without title: ${draft.id}`);
            continue;
          }
          if (!draftForm.subject_id) {
            console.warn(`Skipping draft without subject: ${draft.id}`);
            failCount++;
            if (!firstErrorMessage) firstErrorMessage = `Subject is required for draft: ${draftForm.title || "Untitled"}`;
            continue;
          }

          // Exams don't use practical numbers — skip number resolution and duplicate checks
          let resolvedPracticalNumber: number | null = null;

          if (!isExam) {
            resolvedPracticalNumber = resolvedPracticalNumbersByDraftId.get(draft.id) ?? null;
          }

          // Build payload
          const resolvedExamMaxMarks = (() => {
            if (!isExam || !draftEnableLevels) {
              return draftEnableLevels
                ? draftLevels.reduce((sum, l) => sum + l.max_marks, 0)
                : (draftForm.max_marks ?? 10);
            }

            if (questionSets.length === 0) {
              return draftLevels.reduce((sum, l) => sum + l.max_marks, 0);
            }

            const setTotals = questionSets.map((set) =>
              set.level_names.reduce((sum, levelName) => {
                const matched = draftLevels.find((lvl, idx) => getLevelDisplayName(lvl, idx) === levelName);
                return sum + (matched?.max_marks || 0);
              }, 0)
            );

            return Math.max(0, ...setTotals);
          })();

          const safeExamMaxMarks = isExam
            ? Math.max(1, Number(resolvedExamMaxMarks) || 0)
            : resolvedExamMaxMarks;

          const payload = {
            title: draftForm.title,
            subject_id: draftForm.subject_id,
            description: draftEnableLevels ? "" : draftForm.description,
            language: draftForm.language,
            max_marks: safeExamMaxMarks,
            practical_number: resolvedPracticalNumber || null,
            is_exam: isExam,
          };

          // Insert practical
          const { data: newPractical, error: insertErr } = await supabase
            .from("practicals")
            .insert(payload)
            .select()
            .single();

          if (insertErr) throw insertErr;
          const practicalId = newPractical.id;
          savedData.push({
            id: practicalId,
          });

          if (draftEnableLevels) {
            // Save levels with their test cases
            for (const level of draftLevels) {
              const { data: levelData, error: levelErr } = await supabase
                .from("practical_levels")
                .insert({
                  practical_id: practicalId,
                  level: level.level,
                  title: level.title,
                  description: level.description,
                  max_marks: level.max_marks,
                })
                .select()
                .single();

              if (levelErr) throw levelErr;

              // Save reference code for this level
              try {
                await saveReferenceCode(practicalId, level.reference_code || "", draftForm.language || "c", level.starter_code, levelData.id);
              } catch (refErr) {
                console.error("Failed to save reference code for level:", refErr);
              }

              if (levelData && level.testCases.length > 0) {
                const tcData = level.testCases.map((tc) => ({
                  practical_id: practicalId,
                  level_id: levelData.id,
                  input: tc.input,
                  expected_output: tc.expected_output,
                  is_hidden: tc.is_hidden || false,
                  time_limit_ms: Number(tc.time_limit_ms) || 2000,
                  memory_limit_kb: Number(tc.memory_limit_kb) || 65536,
                }));
                const { error: tcErr } = await supabase
                  .from("test_cases")
                  .insert(tcData);
                if (tcErr) throw tcErr;
              }
            }
          } else {
            // Single-level test cases
            if (draftTestCases.length > 0) {
              const insertData = draftTestCases.map((tc) => ({
                practical_id: practicalId,
                input: tc.input,
                expected_output: tc.expected_output,
                is_hidden: tc.is_hidden || false,
                time_limit_ms: Number(tc.time_limit_ms) || 2000,
                memory_limit_kb: Number(tc.memory_limit_kb) || 65536,
              }));
              const { error: tcErr } = await supabase
                .from("test_cases")
                .insert(insertData);
              if (tcErr) throw tcErr;
            }

            // Save reference code for single level
            if (draft.sampleCode || draft.starterCode) {
              await saveReferenceCode(practicalId, draft.sampleCode || "", draft.sampleLanguage || draftForm.language || "c", draft.starterCode);
            }
          }

          successCount++;
        } catch (draftErr) {
          console.error(`Error saving draft ${draft.id}:`, draftErr);
          if (!firstErrorMessage) {
            firstErrorMessage = (draftErr as any)?.message || String(draftErr);
          }
          failCount++;
        }
      }

      if (successCount > 0) {
        alert(`Successfully saved ${successCount} practicals. ${failCount > 0 ? `${failCount} failed.` : ""}`);
      } else {
        alert(
          failCount > 0
            ? `Failed to save any practicals. ${failCount} errors.${firstErrorMessage ? ` First error: ${firstErrorMessage}` : ""}`
            : "No filled drafts to save. Add a title to at least one exam."
        );
      }

      return savedData;
    } finally {
      setSaving(false);
    }
  }, [
    draftPracticals,
    activeDraftIndex,
    form,
    testCases,
    levels,
    enableLevels,
    sampleCode,
    starterCode,
    sampleLanguage,
    supabase,
    isExam,
    questionSets,
    getLevelDisplayName,
  ]);

  // Assign practical to selected students
  const assign = async (specificItems?: { id: number }[]) => {
    // Determine which items to assign
    const itemsToAssign = specificItems && specificItems.length > 0
      ? specificItems
      : savedPracticals.length > 0
        ? savedPracticals
        : (form.id ? [{ id: Number(form.id) }] : []);

    if (itemsToAssign.length === 0) {
      alert("Save the practical(s) before assigning.");
      return;
    }

    setLoading(true);
    let practicalsUpdated = 0;
    let assignedCount = 0;
    let removedCount = 0;
    let failCount = 0;

    try {
      const selectedStudentIds = selectedStudents.map((s) => s.uid);

      // Scope sync removals to what faculty is currently managing.
      // If a batch filter is selected, only that batch is synced for removals.
      const manageableStudentIds = students
        .filter((s) => !filters.batch || s.batch === filters.batch)
        .map((s) => s.uid);
      const manageableStudentSet = new Set(manageableStudentIds);

      // Assign each practical sequentially
      for (const item of itemsToAssign) {
        // Use assignmentDeadline state (which user might have edited in step 2)
        const deadlineToUse = assignmentDeadline || new Date().toISOString();

        try {
          // 1) Fetch current assignments for this practical.
          const currentResp = await fetch(
            `/api/admin/practicals/assign?practical_id=${item.id}`,
          );
          const currentResult = await currentResp.json();

          if (!currentResp.ok || !currentResult?.success) {
            console.error(`Failed to load assignments for practical ${item.id}:`, currentResult?.error);
            failCount++;
            continue;
          }

          const currentAssignments: Array<{ id: number; student_id: string }> =
            (currentResult?.data || []).map((row: any) => ({
              id: Number(row.id),
              student_id: String(row.student_id || ""),
            }));

          const currentStudentSet = new Set(
            currentAssignments.map((row) => row.student_id),
          );
          const selectedStudentSet = new Set(selectedStudentIds);

          const toAssign = selectedStudentIds.filter(
            (studentId) => !currentStudentSet.has(studentId),
          );

          const toRemove = currentAssignments.filter(
            (row) =>
              manageableStudentSet.has(row.student_id) &&
              !selectedStudentSet.has(row.student_id),
          );

          let itemChanged = false;

          // 2) Assign newly selected students.
          if (toAssign.length > 0) {
            const addResp = await fetch("/api/admin/practicals/assign", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                practical_id: item.id,
                student_ids: toAssign,
                assigned_deadline: deadlineToUse,
                notes,
              }),
            });

            const addResult = await addResp.json();
            if (addResp.ok && addResult?.success) {
              assignedCount += toAssign.length;
              itemChanged = true;
            } else {
              console.error(`Failed to assign practical ${item.id}:`, addResult?.error);
              failCount++;
            }
          }

          // 3) Remove students that were unselected via a single bulk DELETE request.
          if (toRemove.length > 0) {
            try {
              const assignmentIds = toRemove.map(a => a.id).join(",");
              const removeResp = await fetch(
                `/api/admin/practicals/assign?assignment_ids=${assignmentIds}`,
                { method: "DELETE" },
              );
              const removeResult = await removeResp.json();
              if (removeResp.ok && removeResult?.success) {
                removedCount += removeResult.deleted || toRemove.length;
                itemChanged = true;
              } else {
                console.error(`Failed to bulk remove assignments for practical ${item.id}:`, removeResult?.error);
                failCount++;
              }
            } catch (err) {
              console.error(`Error bulk removing assignments:`, err);
              failCount++;
            }
          }

          if (itemChanged) {
            practicalsUpdated += 1;
          }
        } catch (err) {
          console.error(`Error assigning practical ${item.id}:`, err);
          failCount++;
        }
      }

      if (practicalsUpdated > 0) {
        alert(
          `Updated assignments for ${practicalsUpdated} practical(s). ` +
          `${assignedCount} assigned, ${removedCount} removed.` +
          `${failCount > 0 ? ` ${failCount} failed.` : ""}`
        );
        onSaved();
      } else if (failCount === 0) {
        alert("No assignment changes detected.");
        onSaved();
      } else {
        alert("Failed to update some assignments.");
      }
    } catch (err) {
      console.error("Assign error:", err);
      alert("Failed to update assignments.");
    } finally {
      setLoading(false);
    }
  };

  // keyboard save: Ctrl/Cmd+S
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      if (
        (isMac && e.metaKey && e.key === "s") ||
        (!isMac && e.ctrlKey && e.key === "s")
      ) {
        e.preventDefault();
        if (!saving) handleSave();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [saving, handleSave]);

  // ---------------------- Draft Management Functions ----------------------
  // Update current draft state before switching or performing other actions
  const syncCurrentDraftState = useCallback(() => {
    if (draftPracticals.length === 0 || practical) return; // Skip if editing existing or no drafts
    setDraftPracticals(prev => {
      const copy = [...prev];
      if (copy[activeDraftIndex]) {
        copy[activeDraftIndex] = {
          ...copy[activeDraftIndex],
          form: { ...form },
          testCases: [...testCases],
          levels: JSON.parse(JSON.stringify(levels)),
          enableLevels,
          sampleCode, // Save current sample code
          starterCode, // Save current starter code
          sampleLanguage, // Save current language
        };
      }
      return copy;
    });
  }, [activeDraftIndex, form, testCases, levels, enableLevels, sampleCode, starterCode, sampleLanguage, draftPracticals.length, practical]);

  // Add a new draft
  const addDraft = useCallback(() => {
    // First save current draft state
    syncCurrentDraftState();
    const newDraft = createEmptyDraft();
    setDraftPracticals(prev => [...prev, newDraft]);
    // Switch to the new draft
    const newIndex = draftPracticals.length;
    setActiveDraftIndex(newIndex);
    // Load the new draft into form
    setForm(newDraft.form);
    setTestCases(newDraft.testCases);
    setLevels(newDraft.levels);
    setEnableLevels(newDraft.enableLevels);
  }, [syncCurrentDraftState, draftPracticals.length]);

  // Remove a draft
  const removeDraft = useCallback((index: number) => {
    if (draftPracticals.length <= 1) {
      alert("You must have at least one practical.");
      return;
    }
    setDraftPracticals(prev => prev.filter((_, i) => i !== index));
    // Adjust active index if needed
    if (index <= activeDraftIndex) {
      const newIndex = Math.max(0, activeDraftIndex - 1);
      setActiveDraftIndex(newIndex);
      // Load the new active draft
      const newActiveDraft = draftPracticals[newIndex === activeDraftIndex ? newIndex : index === 0 ? 0 : newIndex];
      if (newActiveDraft) {
        setForm(newActiveDraft.form);
        setTestCases(newActiveDraft.testCases);
        setLevels(newActiveDraft.levels);
        setEnableLevels(newActiveDraft.enableLevels);
      }
    }
  }, [draftPracticals, activeDraftIndex]);

  // Switch to a different draft
  const switchToDraft = useCallback((index: number) => {
    if (index === activeDraftIndex) return;
    // Save current draft state first
    syncCurrentDraftState();
    // Load the selected draft
    const draft = draftPracticals[index];
    if (draft) {
      setActiveDraftIndex(index);
      setForm(draft.form);
      setTestCases(draft.testCases);
      setLevels(draft.levels);
      setEnableLevels(draft.enableLevels);
      if (draft.sampleCode !== undefined) setSampleCode(draft.sampleCode);
      if (draft.starterCode !== undefined) setStarterCode(draft.starterCode);
      if (draft.sampleLanguage !== undefined) setSampleLanguage(draft.sampleLanguage);
    }
  }, [activeDraftIndex, draftPracticals, syncCurrentDraftState]);

  // Save all drafts at once
  const saveAllDrafts = async () => {
    // First sync current state
    syncCurrentDraftState();

    setSaving(true);
    let successCount = 0;
    let errorCount = 0;

    // Get the latest drafts state
    const draftsToSave = [...draftPracticals];
    // Update with current form if it's the active draft
    if (draftsToSave[activeDraftIndex]) {
      draftsToSave[activeDraftIndex] = {
        ...draftsToSave[activeDraftIndex],
        form: { ...form },
        testCases: [...testCases],
        levels: JSON.parse(JSON.stringify(levels)),
        enableLevels,
        sampleCode,
        starterCode,
        sampleLanguage,
      };
    }

    for (const draft of draftsToSave) {
      try {
        const payload = {
          title: draft.form.title,
          subject_id: draft.form.subject_id,
          description: draft.enableLevels ? "" : draft.form.description,
          language: draft.form.language,
          max_marks: draft.enableLevels
            ? draft.levels.reduce((sum, l) => sum + l.max_marks, 0)
            : (draft.form.max_marks ?? 10),
        };

        const { data, error } = await supabase
          .from("practicals")
          .insert(payload)
          .select()
          .single();

        if (error) throw error;
        const practicalId = data.id;

        if (draft.enableLevels) {
          for (const level of draft.levels) {
            const { data: levelData, error: levelErr } = await supabase
              .from("practical_levels")
              .insert({
                practical_id: practicalId,
                level: level.level,
                title: level.title,
                description: level.description,
                max_marks: level.max_marks,
              })
              .select()
              .single();

            if (levelErr) throw levelErr;

            // Save reference code for this level if present
            if (level.reference_code || level.starter_code) {
              await saveReferenceCode(practicalId, level.reference_code || "", draft.form.language || "c", level.starter_code, levelData.id);
            }

            if (levelData && level.testCases.length > 0) {
              const tcData = level.testCases.map((tc) => ({
                practical_id: practicalId,
                level_id: levelData.id,
                input: tc.input,
                expected_output: tc.expected_output,
                is_hidden: tc.is_hidden || false,
                time_limit_ms: Number(tc.time_limit_ms) || 2000,
                memory_limit_kb: Number(tc.memory_limit_kb) || 65536,
              }));
              const { error: tcErr } = await supabase.from("test_cases").insert(tcData);
              if (tcErr) throw tcErr;
            }
          }
        } else {
          if (draft.testCases.length > 0) {
            const insertData = draft.testCases.map((tc) => ({
              practical_id: practicalId,
              input: tc.input,
              expected_output: tc.expected_output,
              is_hidden: tc.is_hidden || false,
              time_limit_ms: Number(tc.time_limit_ms) || 2000,
              memory_limit_kb: Number(tc.memory_limit_kb) || 65536,
            }));
            const { error: tcErr } = await supabase.from("test_cases").insert(insertData);
            if (tcErr) throw tcErr;
          }
        }

        // Save reference code if available in draft
        if (draft.sampleCode || draft.starterCode) {
          await saveReferenceCode(practicalId, draft.sampleCode || "", draft.sampleLanguage || draft.form.language || "c", draft.starterCode);
        }

        successCount++;
      } catch (err: any) {
        console.error(`Error saving draft "${draft.form.title}":`, err);
        // Alert the first error to help debugging
        if (errorCount === 0) {
          alert("Save Failed: " + (err?.message || JSON.stringify(err)));
        }
        errorCount++;
      }
    }

    setSaving(false);

    if (errorCount === 0) {
      alert(`Successfully created ${successCount} practical(s)!`);
      onSaved();
    } else {
      alert(`Created ${successCount} practical(s), but ${errorCount} failed.`);
    }
  };

  // Check if we're in multi-draft mode (creating new, not editing)
  const isMultiDraftMode = !practical && draftPracticals.length > 0;

  // ---------------------- Render ----------------------
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-gray-50/95 dark:bg-gray-950/95 backdrop-blur-sm overflow-y-auto custom-scrollbar"
        >
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="min-h-screen"
          >
            {/* Sticky top bar */}
            <div className="sticky top-0 z-40 backdrop-blur-sm bg-white/80 dark:bg-gray-900/80 border-b border-gray-200 dark:border-gray-700">
              <div className="w-full mx-auto px-4 xl:px-12 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center font-bold bg-gradient-to-br from-blue-600 to-purple-600 text-white shadow"
                  >
                    {isExam ? (singleStep ? 1 : step) : 1}
                  </div>
                  <div className="leading-tight">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      {isExam && singleStep
                        ? (step === 2
                          ? "Edit Exam Settings"
                          : step === 3
                            ? "Assign Exam"
                            : "Exam Details")
                        : isExam
                          ? (step === 1
                            ? "Step 1: Exam Details & Settings"
                            : step === 2
                              ? "Step 2: Questions & Sets"
                              : "Step 3: Assign Students")
                          : "Practical Details"}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {isExam && singleStep
                        ? (step === 2
                          ? "Update exam question sets and timing settings"
                          : step === 3
                            ? "Select students and finalize assignment"
                            : "Title, subject, language, duration, and exam window")
                        : isExam
                          ? (step === 1
                            ? "Title, subject, language, duration, and exam window"
                            : step === 2
                              ? "Manage questions and set-wise sub-question mapping"
                              : "Select students and finalize assignment")
                          : "Fill details & test cases"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onClose}
                    className="px-4 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={async () => {
                      if (isExam && step === 1) {
                        const itemsToConfigure = savedPracticals.length > 0
                          ? savedPracticals
                          : [];

                        let resolvedItems = itemsToConfigure;

                        if (resolvedItems.length === 0) {
                          if (isMultiDraftMode) {
                            const savedData = await handleSaveAll();
                            if (!savedData || savedData.length === 0) {
                              return;
                            }
                            setSavedPracticals(savedData);
                            // CRITICAL: Update form.id so that Step 2's handleSave does UPDATE, not INSERT
                            setForm(prev => ({ ...prev, id: savedData[0].id }));
                            resolvedItems = savedData;
                          } else {
                            const savedPracticalId = await handleSave();
                            if (!savedPracticalId) {
                              return;
                            }
                            const singleSaved = [{ id: savedPracticalId as number }];
                            setSavedPracticals(singleSaved);
                            resolvedItems = singleSaved;
                          }
                        }

                        if (resolvedItems.length === 0) return;

                        try {
                          setSaving(true);
                          for (const item of resolvedItems) {
                            await saveExamConfiguration(item.id, { skipSetSync: true });
                          }
                          if (singleStep) {
                            onSaved(resolvedItems[0]?.id);
                          } else {
                            setStep(2);
                          }
                        } catch (err: any) {
                          alert(err?.message || "Failed to save exam details.");
                        } finally {
                          setSaving(false);
                        }
                      } else if (isExam && step === 2) {
                        const setErrors = getSetValidationErrors();
                        if (setErrors.length > 0) {
                          alert(setErrors[0]);
                          return;
                        }

                        // Step 2: Save levels/test cases via handleSave (will UPDATE since form.id is set from Step 1),
                        // then sync question sets via saveExamConfiguration.
                        // handleSave updates levels & test cases in DB so saveExamConfiguration can resolve level IDs.
                        const savedPracticalId = await handleSave();
                        if (!savedPracticalId) {
                          return;
                        }
                        const resolvedItems = [{ id: savedPracticalId as number }];
                        setSavedPracticals(resolvedItems);

                        if (resolvedItems.length === 0) return;

                        try {
                          setSaving(true);
                          for (const item of resolvedItems) {
                            await saveExamConfiguration(item.id);
                          }
                          if (singleStep) {
                            onSaved(resolvedItems[0]?.id);
                          } else {
                            setStep(3);
                          }
                        } catch (err: any) {
                          alert(err?.message || "Failed to save exam settings.");
                        } finally {
                          setSaving(false);
                        }
                      } else if (isExam && step === 3) {
                        await assign();
                      } else {
                        // Original Practical Flow
                        if (isMultiDraftMode) {
                          const savedData = await handleSaveAll();
                          if (savedData && savedData.length > 0) {
                            onSaved(savedData[0]?.id);
                          }
                        } else {
                          const savedPracticalId = await handleSave();
                          if (savedPracticalId) {
                            onSaved(savedPracticalId as number);
                          }
                        }
                      }
                    }}
                    disabled={saving || loading}
                    className={cx(
                      "inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg",
                      (saving || loading)
                        ? "bg-gray-300 dark:bg-gray-700 text-gray-500 cursor-wait"
                        : "bg-gradient-to-r from-cyan-600 to-sky-700 text-white hover:from-cyan-700 hover:to-sky-800 shadow-sky-500/30",
                    )}
                  >
                    {(saving || loading) ? <LoadingSpinner /> : null}
                    {saving
                      ? "Saving..."
                      : loading
                        ? "Assigning..."
                        : isExam
                          ? (singleStep
                            ? (step === 2
                              ? "Save Settings"
                              : step === 3
                                ? "Finish & Assign"
                                : "Save Exam")
                            : (step === 1
                              ? "Next: Questions & Sets"
                              : step === 2
                                ? "Next: Assign Students"
                                : "Finish & Assign"))
                          : "Save Practical"}
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Main content container with optional sidebar */}
            <div className={cx(
              "w-full mx-auto py-6 flex",
              isMultiDraftMode && !isExam && !sidebarCollapsed && step === 1 ? "pl-0" : "px-4 xl:px-12"
            )}>
              {/* Sidebar for multi-draft mode */}
              {isMultiDraftMode && !isExam && step === 1 && (
                <motion.div
                  initial={{ width: sidebarCollapsed ? 48 : 280 }}
                  animate={{ width: sidebarCollapsed ? 48 : 280 }}
                  transition={{ duration: 0.2 }}
                  className="shrink-0 border-r border-gray-200 dark:border-gray-700 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm min-h-[calc(100vh-120px)] sticky top-[60px] self-start"
                >
                  {sidebarCollapsed ? (
                    <div className="p-2 flex flex-col items-center gap-2">
                      <button
                        onClick={() => setSidebarCollapsed(false)}
                        className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                        title="Expand sidebar"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                      <div className="w-8 h-px bg-gray-200 dark:bg-gray-700" />
                      <button
                        onClick={addDraft}
                        className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-sky-600 text-white shadow-md hover:shadow-lg transition-all"
                        title="Add practical"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <div className="flex flex-col gap-1 mt-2">
                        {draftPracticals.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => switchToDraft(idx)}
                            className={cx(
                              "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold transition-all",
                              idx === activeDraftIndex
                                ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 ring-2 ring-indigo-500"
                                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                            )}
                          >
                            {idx + 1}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 h-full flex flex-col">
                      {/* Sidebar Header */}
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                          {isExam ? "Exams" : "Practicals"} ({draftPracticals.length})
                        </h3>
                        <button
                          onClick={() => setSidebarCollapsed(true)}
                          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
                          title="Collapse sidebar"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Add New Button */}
                      <button
                        onClick={addDraft}
                        className="w-full group flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-gradient-to-r from-cyan-600 to-sky-700 text-white text-sm font-bold shadow-lg shadow-sky-500/20 hover:shadow-sky-500/40 hover:-translate-y-0.5 transition-all duration-300 mb-6"
                      >
                        <div className="p-1 rounded-lg bg-white/20 group-hover:bg-white/30 transition-colors">
                          <Plus className="w-4 h-4" />
                        </div>
                        {isExam ? "Add New Exam" : "Add New Practical"}
                      </button>

                      {/* Draft List */}
                      <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar">
                        {draftPracticals.map((draft, idx) => {
                          // Use live form state for active draft, otherwise use draft state
                          const isActiveDraft = idx === activeDraftIndex;
                          const currentTitle = isActiveDraft ? form.title : draft.form.title;
                          const currentTestCases = isActiveDraft ? testCases : draft.testCases;
                          const currentPracticalNumber = isActiveDraft ? form.practical_number : draft.form.practical_number;

                          const hasTitle = currentTitle.trim() !== "";
                          const hasTestCases = currentTestCases.some(tc => tc.input.trim() !== "" || tc.expected_output.trim() !== "");
                          const displayTitle = hasTitle ? currentTitle : isExam ? `Exam ${idx + 1}` : `Practical ${idx + 1}`;
                          const subjectName = subjects.find(s => s.id === (isActiveDraft ? form.subject_id : draft.form.subject_id))?.subject_name || "No subject";

                          // Calculate completion percentage
                          const fields = [hasTitle, hasTestCases];
                          const completedFields = fields.filter(Boolean).length;
                          const completionPercent = Math.round((completedFields / fields.length) * 100);
                          const isComplete = completionPercent === 100;

                          // SVG circle properties for progress ring
                          const radius = 10;
                          const circumference = 2 * Math.PI * radius;
                          const strokeDashoffset = circumference - (completionPercent / 100) * circumference;

                          return (
                            <div
                              key={draft.id}
                              onClick={() => switchToDraft(idx)}
                              className={cx(
                                "group relative p-4 rounded-2xl cursor-pointer transition-all duration-200 border",
                                idx === activeDraftIndex
                                  ? "bg-white dark:bg-gray-800 border-indigo-500/50 shadow-lg shadow-sky-500/10 ring-1 ring-indigo-500/20"
                                  : "bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/50 hover:border-gray-200 dark:hover:border-gray-700"
                              )}
                            >
                              <div className="flex items-start gap-3">
                                {/* Progress Ring */}
                                <div className="relative shrink-0">
                                  <svg width="28" height="28" className="transform -rotate-90">
                                    <circle
                                      cx="14"
                                      cy="14"
                                      r={radius}
                                      fill="none"
                                      stroke={idx === activeDraftIndex ? "rgba(99, 102, 241, 0.2)" : "rgba(156, 163, 175, 0.3)"}
                                      strokeWidth="3"
                                    />
                                    <circle
                                      cx="14"
                                      cy="14"
                                      r={radius}
                                      fill="none"
                                      stroke={isComplete ? "#10b981" : idx === activeDraftIndex ? "#6366f1" : "#9ca3af"}
                                      strokeWidth="3"
                                      strokeLinecap="round"
                                      strokeDasharray={circumference}
                                      strokeDashoffset={strokeDashoffset}
                                      className="transition-all duration-500"
                                    />
                                  </svg>
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    {isComplete ? (
                                      <CheckIcon className="w-3 h-3 text-emerald-500" />
                                    ) : (
                                      <FileText className={cx(
                                        "w-3 h-3",
                                        idx === activeDraftIndex ? "text-indigo-500" : "text-gray-400"
                                      )} />
                                    )}
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className={cx(
                                    "flex flex-col gap-0.5 min-w-0 font-medium transition-colors",
                                    idx === activeDraftIndex ? "opacity-100" : "opacity-70 group-hover:opacity-100"
                                  )}>
                                    <div className={cx(
                                      "text-[10px] uppercase tracking-wider font-bold mb-0.5",
                                      idx === activeDraftIndex
                                        ? "text-indigo-600 dark:text-indigo-400"
                                        : "text-gray-500 dark:text-gray-400"
                                    )}>
                                      {isExam ? "Exam" : "Practical"} {currentPracticalNumber ?? idx + 1}
                                    </div>
                                    <div className={cx(
                                      "truncate text-sm font-semibold",
                                      idx === activeDraftIndex
                                        ? "text-gray-900 dark:text-white"
                                        : "text-gray-700 dark:text-gray-300"
                                    )}>
                                      {hasTitle ? currentTitle : (isExam ? "Untitled Exam" : "Untitled Practical")}
                                    </div>
                                  </div>

                                </div>
                                {draftPracticals.length > 1 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeDraft(idx);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-all"
                                    title={isExam ? "Remove exam" : "Remove practical"}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* Main Form Area */}
              <div className={cx(
                "flex-1",
                isMultiDraftMode && !isExam ? "px-4 xl:px-8" : ""
              )}>
                {/* ---------- FORM CONTENT ---------- */}
                {!isExam && (
                  <div className="space-y-6">
                    <BasicDetailsForm
                      form={form}
                      subjects={subjects}
                      handleInput={handleInput}
                      defaultSubjectId={defaultSubjectId}
                      enableLevels={enableLevels}
                      setEnableLevels={setEnableLevels}
                      levels={levels}
                      isExam={isExam}
                      showAssessmentControls={true}
                      showNumberField={!isExam}
                      practicalNumberConflictMessage={practicalNumberConflictMessage}
                      isCheckingPracticalNumber={isCheckingPracticalNumber}
                      onMarkdownChange={(val) => setForm(prev => ({ ...prev, description: val }))}
                      onMagicFormat={async (text, callback) => {
                        setIsFormatting(true);
                        try {
                          const savedSettings = localStorage.getItem("ai_settings");
                          const config = savedSettings ? JSON.parse(savedSettings) : {};
                          const apiUrl = process.env.NEXT_PUBLIC_AI_API_URL || "http://localhost:5002/ai";
                          const { data: { session } } = await supabase.auth.getSession();
                          const prompt = `You are a markdown formatting expert. Take the following problem description and format it beautifully using markdown. Keep the content the same but improve the formatting with headers, lists, code blocks, bold/italic where appropriate. Return ONLY the formatted markdown, no explanations.\n\n${text}`;
                          const res = await fetch(`${apiUrl}/chat`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token || ""}` },
                            body: JSON.stringify({ messages: [{ role: "user", parts: [{ text: prompt }] }], config }),
                          });
                          if (!res.ok || !res.body) throw new Error("API error");
                          const reader = res.body.getReader();
                          const decoder = new TextDecoder();
                          let fullText = "";
                          while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            const chunk = decoder.decode(value, { stream: true });
                            for (const line of chunk.split("\n\n")) {
                              if (line.startsWith("data: ")) {
                                const dataStr = line.slice(6);
                                if (dataStr === "[DONE]") break;
                                try { const parsed = JSON.parse(dataStr); if (parsed.text) fullText += parsed.text; } catch (e) { /* ignore parse error */ }
                              }
                            }
                          }
                          callback(fullText.trim());
                        } catch (err) { console.error("Magic format error:", err); alert("Failed to format. Try again."); }
                        finally { setIsFormatting(false); }
                      }}
                      isFormatting={isFormatting}
                    />

                    {enableLevels && (
                      <LevelManager
                        levels={levels}
                        activeLevel={activeLevel}
                        setActiveLevel={setActiveLevel}
                        updateLevelField={updateLevelField}
                        addLevelTestCase={addLevelTestCase}
                        removeLevelTestCase={removeLevelTestCase}
                        updateLevelTestCase={updateLevelTestCase}
                        generateTestCases={generateTestCases}
                        fuzzerCount={fuzzerCount}
                        setFuzzerCount={setFuzzerCount}
                        generatingTests={generatingTests}
                        sampleCode={sampleCode}
                        setSampleCode={setSampleCode}
                        sampleLanguage={sampleLanguage || "c"}
                        onAddLevel={handleAddLevel}
                        onRemoveLevel={handleRemoveLevel}
                        onMarkdownChange={(level, val) => updateLevelField(level, "description", val)}
                        onGenerateCode={async (level, type) => {
                          const currentLvl = levels.find(l => l.level === level);
                          if (!currentLvl?.description?.trim()) { alert("Please enter a description first."); return; }
                          setIsGeneratingCode(true);
                          try {
                            const savedSettings = localStorage.getItem("ai_settings");
                            const config = savedSettings ? JSON.parse(savedSettings) : {};
                            const apiUrl = process.env.NEXT_PUBLIC_AI_API_URL || "http://localhost:5002/ai";
                            const { data: { session } } = await supabase.auth.getSession();
                            const lang = sampleLanguage || form.language || "c";
                            const ioInstructions = "CRITICAL REQUIREMENT: Provide complete competitive programming style standard input/output handling. The code MUST read all inputs from standard input (stdin) and print strictly the expected output to standard output (stdout). Do NOT just write a function! For Java, write a class with a public static void main method that uses a Scanner or BufferedReader. For C/C++, use standard main reading from cin/scanf. For Python, use input() or sys.stdin.read().";
                            let prompt = "";
                            if (type === 'starter') {
                              prompt = `Generate a simple, incomplete starter code template in ${lang} for the following problem.\n\n${ioInstructions}\n\nInclude the full boilerplate for reading inputs and printing outputs, but leave the core algorithm logic incomplete (e.g., an empty function) for the student to solve. Return ONLY the raw code, NO markdown blocks (\`\`\`), NO explanations.\n\nProblem Description:\n${currentLvl.description}`;
                            } else {
                              const baseContext = currentLvl.starter_code ? `\n\nUse the following starter code as the exact structural template (DO NOT change class or function names, just fill in the missing logic):\n\n${currentLvl.starter_code}` : "";
                              prompt = `Generate a simple, complete working solution in ${lang} for the following problem.\n\n${ioInstructions}\n\nThe code should compile, read from stdin, execute the logic, and print to stdout correctly. Return ONLY the raw code, NO markdown blocks (\`\`\`), NO formatting, NO explanations.${baseContext}\n\nProblem Description:\n\n${currentLvl.description}`;
                            }
                            const res = await fetch(`${apiUrl}/chat`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token || ""}` },
                              body: JSON.stringify({ messages: [{ role: "user", parts: [{ text: prompt }] }], config }),
                            });
                            if (!res.ok || !res.body) throw new Error("API error");
                            const reader = res.body.getReader();
                            const decoder = new TextDecoder();
                            let fullText = "";
                            while (true) {
                              const { done, value } = await reader.read();
                              if (done) break;
                              const chunk = decoder.decode(value, { stream: true });
                              for (const line of chunk.split("\n\n")) {
                                if (line.startsWith("data: ")) {
                                  const dataStr = line.slice(6);
                                  if (dataStr === "[DONE]") break;
                                  try { const parsed = JSON.parse(dataStr); if (parsed.text) fullText += parsed.text; } catch (e) { /* ignore parse error */ }
                                }
                              }
                            }
                            let code = fullText.trim();
                            code = code.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
                            updateLevelField(level, type === 'starter' ? 'starter_code' : 'reference_code', code);
                          } catch (err) { console.error("Code gen error:", err); alert("Failed to generate code. Try again."); }
                          finally { setIsGeneratingCode(false); }
                        }}
                        onMagicFormat={async (text, callback) => {
                          setIsFormatting(true);
                          try {
                            const savedSettings = localStorage.getItem("ai_settings");
                            const config = savedSettings ? JSON.parse(savedSettings) : {};
                            const apiUrl = process.env.NEXT_PUBLIC_AI_API_URL || "http://localhost:5002/ai";
                            const { data: { session } } = await supabase.auth.getSession();
                            const prompt = `You are a markdown formatting expert. Take the following problem description and format it beautifully using markdown. Keep the content the same but improve the formatting. Return ONLY the formatted markdown, no explanations.\n\n${text}`;
                            const res = await fetch(`${apiUrl}/chat`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token || ""}` },
                              body: JSON.stringify({ messages: [{ role: "user", parts: [{ text: prompt }] }], config }),
                            });
                            if (!res.ok || !res.body) throw new Error("API error");
                            const reader = res.body.getReader();
                            const decoder = new TextDecoder();
                            let fullText = "";
                            while (true) {
                              const { done, value } = await reader.read();
                              if (done) break;
                              const chunk = decoder.decode(value, { stream: true });
                              for (const line of chunk.split("\n\n")) {
                                if (line.startsWith("data: ")) {
                                  const dataStr = line.slice(6);
                                  if (dataStr === "[DONE]") break;
                                  try { const parsed = JSON.parse(dataStr); if (parsed.text) fullText += parsed.text; } catch (e) { /* ignore parse error */ }
                                }
                              }
                            }
                            callback(fullText.trim());
                          } catch (err) { console.error("Magic format error:", err); alert("Failed to format. Try again."); }
                          finally { setIsFormatting(false); }
                        }}
                        isFormatting={isFormatting}
                        isGeneratingCode={isGeneratingCode}
                      />
                    )}

                    {!enableLevels && (
                      <SingleLevelTestCases
                        form={form}
                        handleInput={handleInput}
                        sampleCode={sampleCode}
                        setSampleCode={setSampleCode}
                        starterCode={starterCode}
                        setStarterCode={setStarterCode}
                        sampleLanguage={sampleLanguage}
                        setSampleLanguage={setSampleLanguage}
                        getLanguageExtension={getLanguageExtension}
                        testCases={testCases}
                        handleTestCaseChange={handleTestCaseChange}
                        addTestCase={addTestCase}
                        removeTestCase={removeTestCase}
                        generateTestCases={generateTestCases}
                        fuzzerCount={fuzzerCount}
                        setFuzzerCount={setFuzzerCount}
                        generatingTests={generatingTests}
                        isExam={isExam}
                        onGenerateCode={async (type) => {
                          if (!form.description?.trim()) { alert("Please enter a description first."); return; }
                          setIsGeneratingCode(true);
                          try {
                            const savedSettings = localStorage.getItem("ai_settings");
                            const config = savedSettings ? JSON.parse(savedSettings) : {};
                            const apiUrl = process.env.NEXT_PUBLIC_AI_API_URL || "http://localhost:5002/ai";
                            const { data: { session } } = await supabase.auth.getSession();
                            const lang = sampleLanguage || form.language || "c";
                            const ioInstructions = "CRITICAL REQUIREMENT: Provide complete competitive programming style standard input/output handling. The code MUST read all inputs from standard input (stdin) and print strictly the expected output to standard output (stdout). Do NOT just write a function! For Java, write a class with a public static void main method that uses a Scanner or BufferedReader. For C/C++, use standard main reading from cin/scanf. For Python, use input() or sys.stdin.read().";
                            let prompt = "";
                            if (type === 'starter') {
                              prompt = `Generate a simple, incomplete starter code template in ${lang} for the following problem.\n\n${ioInstructions}\n\nInclude the full boilerplate for reading inputs and printing outputs, but leave the core algorithm logic incomplete (e.g., an empty function) for the student to solve. Return ONLY the raw code, NO markdown blocks (\`\`\`), NO explanations.\n\nProblem Description:\n${form.description}`;
                            } else {
                              const baseContext = starterCode ? `\n\nUse the following starter code as the exact structural template (DO NOT change class or function names, just fill in the missing logic):\n\n${starterCode}` : "";
                              prompt = `Generate a simple, complete working solution in ${lang} for the following problem.\n\n${ioInstructions}\n\nThe code should compile, read from stdin, execute the logic, and print to stdout correctly. Return ONLY the raw code, NO markdown blocks (\`\`\`), NO formatting, NO explanations.${baseContext}\n\nProblem Description:\n\n${form.description}`;
                            }
                            const res = await fetch(`${apiUrl}/chat`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token || ""}` },
                              body: JSON.stringify({ messages: [{ role: "user", parts: [{ text: prompt }] }], config }),
                            });
                            if (!res.ok || !res.body) throw new Error("API error");
                            const reader = res.body.getReader();
                            const decoder = new TextDecoder();
                            let fullText = "";
                            while (true) {
                              const { done, value } = await reader.read();
                              if (done) break;
                              const chunk = decoder.decode(value, { stream: true });
                              for (const line of chunk.split("\n\n")) {
                                if (line.startsWith("data: ")) {
                                  const dataStr = line.slice(6);
                                  if (dataStr === "[DONE]") break;
                                  try { const parsed = JSON.parse(dataStr); if (parsed.text) fullText += parsed.text; } catch (e) { /* ignore parse error */ }
                                }
                              }
                            }
                            let code = fullText.trim();
                            code = code.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
                            if (type === 'starter') setStarterCode(code);
                            else setSampleCode(code);
                          } catch (err) { console.error("Code gen error:", err); alert("Failed to generate code. Try again."); }
                          finally { setIsGeneratingCode(false); }
                        }}
                        isGeneratingCode={isGeneratingCode}
                      />
                    )}
                  </div>
                )}

                {isExam && step === 1 && (
                  <div className="space-y-6">
                    <BasicDetailsForm
                      form={form}
                      subjects={subjects}
                      handleInput={handleInput}
                      defaultSubjectId={defaultSubjectId}
                      enableLevels={enableLevels}
                      setEnableLevels={setEnableLevels}
                      levels={levels}
                      isExam={isExam}
                      showAssessmentControls={false}
                      showNumberField={false}
                    />

                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 space-y-5">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Exam Settings</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Configure duration, fullscreen requirement, and exam time window.
                        </p>
                      </div>

                      <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          <Timer className="w-4 h-4 text-orange-500" />
                          Duration (minutes)
                        </label>
                        <input
                          type="number"
                          min={5}
                          max={300}
                          value={durationMinutes}
                          onChange={(e) => setDurationMinutes(Number(e.target.value) || 60)}
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-orange-500/40 outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            <Clock className="w-4 h-4 text-blue-500" />
                            Start Time
                          </label>
                          <input
                            type="datetime-local"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/40 outline-none"
                          />
                        </div>
                        <div>
                          <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                            <Clock className="w-4 h-4 text-red-500" />
                            End Time
                          </label>
                          <input
                            type="datetime-local"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-red-500/40 outline-none"
                          />
                        </div>
                      </div>

                      <label className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <Maximize className="w-4 h-4 text-indigo-500" />
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Require Fullscreen</span>
                        <input
                          type="checkbox"
                          checked={requireFullscreen}
                          onChange={(e) => setRequireFullscreen(e.target.checked)}
                          className="ml-auto w-4 h-4"
                        />
                      </label>
                    </div>
                  </div>
                )}

                {isExam && step === 2 && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6 items-start">
                      <aside className="space-y-4 xl:sticky xl:top-24">
                        {/* Magic Autofill Section */}
                        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 p-4 shadow-sm shadow-indigo-100/30 dark:shadow-none space-y-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Sparkles className="w-4 h-4 text-indigo-500" />
                            <h3 className="text-sm font-bold text-gray-900 dark:text-white">AI Tools</h3>
                          </div>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400">
                            Upload your exam PDF to automatically generate all sets and questions.
                          </p>
                          <input
                            type="file"
                            id="step2-pdf-autofill"
                            className="hidden"
                            accept=".pdf"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadPdf(file);
                            }}
                            disabled={isUploading}
                          />
                          <button
                            type="button"
                            disabled={isUploading}
                            onClick={() => document.getElementById("step2-pdf-autofill")?.click()}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-sky-500/20"
                          >
                            {isUploading ? (
                              <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <Sparkles size={14} />
                            )}
                            {isUploading ? "Magic in Progress..." : "Magic Autofill (PDF)"}
                          </button>
                        </div>

                        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 p-4 shadow-sm shadow-indigo-100/30 dark:shadow-none space-y-4">
                          <div className="rounded-xl bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/30 dark:to-blue-950/20 border border-indigo-100 dark:border-indigo-900/40 p-3">
                            <div className="flex items-start gap-2">
                              <div className="p-1.5 rounded-lg bg-white dark:bg-gray-900 border border-indigo-100 dark:border-indigo-900/50">
                                <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                              </div>
                              <div>
                                <h3 className="text-sm font-bold text-gray-900 dark:text-white">Question Sets</h3>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Create, select, and manage set-wise tasks.</p>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-2.5">
                            {questionSets.map((set, idx) => (
                              (() => {
                                const resolvedSetItems = resolveSetLevels(set);
                                const setTotalMarks = resolvedSetItems.reduce(
                                  (sum, item) => sum + (item.level.max_marks || 0),
                                  0,
                                );
                                const setTaskCount = resolvedSetItems.length;
                                return (
                                  <button
                                    key={`${set.set_name}-${idx}`}
                                    type="button"
                                    onClick={() => setActiveSetIdx(idx)}
                                    className={cx(
                                      "group relative w-full text-left px-3.5 py-3 rounded-xl border transition",
                                      idx === activeSetIdx
                                        ? "bg-indigo-100/80 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-700 text-indigo-800 dark:text-indigo-200"
                                        : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-700 hover:bg-indigo-50/40 dark:hover:bg-indigo-900/20 text-gray-700 dark:text-gray-300"
                                    )}
                                  >
                                    {idx === activeSetIdx && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-indigo-500" />}
                                    <div className="flex items-start justify-between gap-3 pl-1">
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold">{set.set_name}</p>
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{setTaskCount} task(s)</p>
                                      </div>
                                      <div className="text-right shrink-0">
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400">Marks</p>
                                        <p className="text-xs font-bold">{setTotalMarks}</p>
                                      </div>
                                    </div>
                                  </button>
                                );
                              })()
                            ))}

                            <button
                              type="button"
                              onClick={() => {
                                const nextLetter = String.fromCharCode(65 + questionSets.length);
                                const nextIndex = questionSets.length;
                                setQuestionSets((prev) => [
                                  ...prev,
                                  { set_name: `Set ${nextLetter}`, level_names: [] },
                                ]);
                                setActiveSetIdx(nextIndex);
                              }}
                              className="w-full inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-dashed border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-400 text-sm font-semibold hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                            >
                              <Plus className="w-4 h-4" /> Add Set
                            </button>
                          </div>
                        </div>

                      </aside>

                      <div className="space-y-6">
                        <div className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-indigo-100 dark:border-indigo-900/50 p-6 space-y-4">
                          {enableLevels && (() => {
                            const setErrors = getSetValidationErrors();
                            const activeSet = questionSets[activeSetIdx];
                            const assignedLevels = resolveSetLevels(activeSet);

                            return (
                              <div className="space-y-4">
                                {setErrors.length > 0 && (
                                  <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-900/20 px-3 py-2">
                                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">{setErrors[0]}</p>
                                  </div>
                                )}

                                {activeSet && (
                                  <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-5 bg-white/70 dark:bg-gray-900/40">
                                    <div className="flex items-center justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <Layers className="w-4 h-4 text-indigo-500" />
                                          <input
                                            type="text"
                                            value={activeSet.set_name}
                                            onChange={(e) => {
                                              const value = e.target.value;
                                              setQuestionSets((prev) =>
                                                prev.map((set, idx) =>
                                                  idx === activeSetIdx ? { ...set, set_name: value } : set
                                                )
                                              );
                                            }}
                                            className="text-base font-bold bg-transparent border-none outline-none p-0 text-gray-900 dark:text-white min-w-0"
                                          />
                                        </div>
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">Create and edit tasks for this selected set.</p>
                                      </div>
                                      {questionSets.length > 2 && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setQuestionSets((prev) => prev.filter((_, idx) => idx !== activeSetIdx));
                                            setActiveSetIdx((prev) => Math.max(0, prev - 1));
                                          }}
                                          className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline shrink-0"
                                        >
                                          Remove Set
                                        </button>
                                      )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2.5 bg-gray-50/60 dark:bg-gray-800/40">
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400">Set Max Marks</p>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">
                                          {assignedLevels.reduce((sum, item) => sum + (item.level.max_marks || 0), 0)}
                                        </p>
                                      </div>
                                      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-2.5 bg-gray-50/60 dark:bg-gray-800/40">
                                        <p className="text-[11px] text-gray-500 dark:text-gray-400">Tasks in Set</p>
                                        <p className="text-sm font-bold text-gray-900 dark:text-white">{assignedLevels.length}</p>
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-end">
                                      <button
                                        type="button"
                                        onClick={createTaskForActiveSet}
                                        className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold shadow-sm"
                                      >
                                        <span className="inline-flex items-center gap-1"><Plus className="w-4 h-4" />Create Task for This Set</span>
                                      </button>
                                    </div>

                                    <div>
                                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
                                        Selected Set Details
                                      </p>
                                      {assignedLevels.length > 0 ? (
                                        <div className="space-y-3">
                                          {assignedLevels.map(({ level, idx, name }) => (
                                            <div
                                              key={`${name}-${idx}`}
                                              className="rounded-2xl border border-gray-200 dark:border-gray-700 p-4 bg-gradient-to-br from-white to-gray-50/70 dark:from-gray-900 dark:to-gray-800/70 shadow-sm hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-700 transition-all"
                                            >
                                              <div className="flex items-start justify-between gap-3">
                                                <div>
                                                  <p className="text-base font-semibold text-gray-900 dark:text-white">{name}</p>
                                                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1 leading-relaxed">
                                                    {taskPreview(level.description)}
                                                  </p>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-700/70">
                                                    {level.max_marks} marks
                                                  </span>
                                                  <button
                                                    type="button"
                                                    onClick={() => setActiveLevel(level.level)}
                                                    className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                                                  >
                                                    Open
                                                  </button>
                                                  <button
                                                    type="button"
                                                    onClick={() => removeTaskFromSet(name)}
                                                    className="text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
                                                  >
                                                    Delete
                                                  </button>
                                                </div>
                                              </div>
                                              <div className="mt-3 flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                                                <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                                                {(level.testCases || []).length} test case(s)
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">No tasks assigned to this set yet.</p>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                          {!enableLevels && (
                            <p className="text-sm text-amber-600 dark:text-amber-400">
                              Turn on Multi-Level Mode to configure question sets.
                            </p>
                          )}
                        </div>

                        {enableLevels ? (() => {
                          const activeSet = questionSets[activeSetIdx];
                          const scopedLevels = resolveSetLevels(activeSet).map((item) => item.level);

                          if (!activeSet || scopedLevels.length === 0) {
                            return (
                              <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-6">
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  No tasks in this set yet. Use "Create Task for This Set" above to start.
                                </p>
                              </div>
                            );
                          }

                          const managerLevels = scopedLevels.map((lvl, idx) => ({
                            ...lvl,
                            level: `Task ${idx + 1}`,
                          }));

                          const originalLevelByDisplay = new Map<string, string>();
                          managerLevels.forEach((lvl, idx) => {
                            originalLevelByDisplay.set(lvl.level, scopedLevels[idx].level);
                          });

                          const activeScopedIndex = scopedLevels.findIndex((lvl) => lvl.level === activeLevel);
                          const managerActiveLevel = activeScopedIndex >= 0
                            ? `Task ${activeScopedIndex + 1}`
                            : (managerLevels[0]?.level || "Task 1");

                          return (
                            <LevelManager
                              levels={managerLevels}
                              activeLevel={managerActiveLevel}
                              setActiveLevel={(displayLevel) => {
                                const originalLevel = originalLevelByDisplay.get(displayLevel);
                                if (originalLevel) setActiveLevel(originalLevel);
                              }}
                              updateLevelField={(displayLevel, field, value) => {
                                const originalLevel = originalLevelByDisplay.get(displayLevel);
                                if (originalLevel) updateLevelField(originalLevel, field, value);
                              }}
                              addLevelTestCase={(displayLevel) => {
                                const originalLevel = originalLevelByDisplay.get(displayLevel);
                                if (originalLevel) addLevelTestCase(originalLevel);
                              }}
                              removeLevelTestCase={(displayLevel, index) => {
                                const originalLevel = originalLevelByDisplay.get(displayLevel);
                                if (originalLevel) removeLevelTestCase(originalLevel, index);
                              }}
                              updateLevelTestCase={(displayLevel, index, field, value) => {
                                const originalLevel = originalLevelByDisplay.get(displayLevel);
                                if (originalLevel) updateLevelTestCase(originalLevel, index, field, value);
                              }}
                              generateTestCases={generateTestCases}
                              fuzzerCount={fuzzerCount}
                              setFuzzerCount={setFuzzerCount}
                              generatingTests={generatingTests}
                              sampleCode={sampleCode}
                              setSampleCode={setSampleCode}
                              sampleLanguage={sampleLanguage || form.language || "c"}
                              onAddLevel={createTaskForActiveSet}
                              onRemoveLevel={(displayLevel) => {
                                const originalLevel = originalLevelByDisplay.get(displayLevel);
                                if (originalLevel) removeTaskFromSetByLevel(originalLevel);
                              }}
                              onMarkdownChange={(displayLevel, val) => {
                                const originalLevel = originalLevelByDisplay.get(displayLevel);
                                if (originalLevel) updateLevelField(originalLevel, "description", val);
                              }}
                              onGenerateCode={async (displayLevel, type) => {
                                const originalLevel = originalLevelByDisplay.get(displayLevel);
                                if (!originalLevel) return;
                                const currentLvl = levels.find(l => l.level === originalLevel);
                                if (!currentLvl?.description?.trim()) { alert("Please enter a description first."); return; }
                                setIsGeneratingCode(true);
                                try {
                                  const savedSettings = localStorage.getItem("ai_settings");
                                  const config = savedSettings ? JSON.parse(savedSettings) : {};
                                  const apiUrl = process.env.NEXT_PUBLIC_AI_API_URL || "http://localhost:5002/ai";
                                  const { data: { session } } = await supabase.auth.getSession();
                                  const lang = sampleLanguage || form.language || "c";
                                  const ioInstructions = "CRITICAL REQUIREMENT: Provide complete competitive programming style standard input/output handling. The code MUST read all inputs from standard input (stdin) and print strictly the expected output to standard output (stdout). Do NOT just write a function! For Java, write a class with a public static void main method that uses a Scanner or BufferedReader. For C/C++, use standard main reading from cin/scanf. For Python, use input() or sys.stdin.read().";
                                  let prompt = "";
                                  if (type === 'starter') {
                                    prompt = `Generate a simple, incomplete starter code template in ${lang} for the following problem.\n\n${ioInstructions}\n\nInclude the full boilerplate for reading inputs and printing outputs, but leave the core algorithm logic incomplete (e.g., an empty function) for the student to solve. Return ONLY the raw code, NO markdown blocks (\`\`\`), NO explanations.\n\nProblem Description:\n${currentLvl.description}`;
                                  } else {
                                    const baseContext = currentLvl.starter_code ? `\n\nUse the following starter code as the exact structural template (DO NOT change class or function names, just fill in the missing logic):\n\n${currentLvl.starter_code}` : "";
                                    prompt = `Generate a simple, complete working solution in ${lang} for the following problem.\n\n${ioInstructions}\n\nThe code should compile, read from stdin, execute the logic, and print to stdout correctly. Return ONLY the raw code, NO markdown blocks (\`\`\`), NO formatting, NO explanations.${baseContext}\n\nProblem Description:\n\n${currentLvl.description}`;
                                  }
                                  const res = await fetch(`${apiUrl}/chat`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token || ""}` },
                                    body: JSON.stringify({ messages: [{ role: "user", parts: [{ text: prompt }] }], config }),
                                  });
                                  if (!res.ok || !res.body) throw new Error("API error");
                                  const reader = res.body.getReader();
                                  const decoder = new TextDecoder();
                                  let fullText = "";
                                  while (true) {
                                    const { done, value } = await reader.read();
                                    if (done) break;
                                    const chunk = decoder.decode(value, { stream: true });
                                    for (const line of chunk.split("\n\n")) {
                                      if (line.startsWith("data: ")) {
                                        const dataStr = line.slice(6);
                                        if (dataStr === "[DONE]") break;
                                        try { const parsed = JSON.parse(dataStr); if (parsed.text) fullText += parsed.text; } catch (e) { /* ignore parse error */ }
                                      }
                                    }
                                  }
                                  let code = fullText.trim();
                                  code = code.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
                                  updateLevelField(originalLevel, type === 'starter' ? 'starter_code' : 'reference_code', code);
                                } catch (err) { console.error("Code gen error:", err); alert("Failed to generate code. Try again."); }
                                finally { setIsGeneratingCode(false); }
                              }}
                              onMagicFormat={async (text, callback) => {
                                setIsFormatting(true);
                                try {
                                  const savedSettings = localStorage.getItem("ai_settings");
                                  const config = savedSettings ? JSON.parse(savedSettings) : {};
                                  const apiUrl = process.env.NEXT_PUBLIC_AI_API_URL || "http://localhost:5002/ai";
                                  const { data: { session } } = await supabase.auth.getSession();
                                  const prompt = `You are a markdown formatting expert. Take the following problem description and format it beautifully using markdown. Keep the content the same but improve the formatting. Return ONLY the formatted markdown, no explanations.\n\n${text}`;
                                  const res = await fetch(`${apiUrl}/chat`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token || ""}` },
                                    body: JSON.stringify({ messages: [{ role: "user", parts: [{ text: prompt }] }], config }),
                                  });
                                  if (!res.ok || !res.body) throw new Error("API error");
                                  const reader = res.body.getReader();
                                  const decoder = new TextDecoder();
                                  let fullText = "";
                                  while (true) {
                                    const { done, value } = await reader.read();
                                    if (done) break;
                                    const chunk = decoder.decode(value, { stream: true });
                                    for (const line of chunk.split("\n\n")) {
                                      if (line.startsWith("data: ")) {
                                        const dataStr = line.slice(6);
                                        if (dataStr === "[DONE]") break;
                                        try { const parsed = JSON.parse(dataStr); if (parsed.text) fullText += parsed.text; } catch (e) { /* ignore parse error */ }
                                      }
                                    }
                                  }
                                  callback(fullText.trim());
                                } catch (err) { console.error("Magic format error:", err); alert("Failed to format. Try again."); }
                                finally { setIsFormatting(false); }
                              }}
                              isFormatting={isFormatting}
                              isGeneratingCode={isGeneratingCode}
                            />
                          );
                        })() : (
                          <SingleLevelTestCases
                            form={form}
                            handleInput={handleInput}
                            sampleCode={sampleCode}
                            setSampleCode={setSampleCode}
                            starterCode={starterCode}
                            setStarterCode={setStarterCode}
                            sampleLanguage={sampleLanguage || form.language || "c"}
                            setSampleLanguage={setSampleLanguage}
                            getLanguageExtension={getLanguageExtension}
                            testCases={testCases}
                            handleTestCaseChange={handleTestCaseChange}
                            addTestCase={addTestCase}
                            removeTestCase={removeTestCase}
                            generateTestCases={generateTestCases}
                            fuzzerCount={fuzzerCount}
                            setFuzzerCount={setFuzzerCount}
                            generatingTests={generatingTests}
                            isExam={isExam}
                            onGenerateCode={async (type) => {
                              if (!form.description?.trim()) { alert("Please enter a description first."); return; }
                              setIsGeneratingCode(true);
                              try {
                                const savedSettings = localStorage.getItem("ai_settings");
                                const config = savedSettings ? JSON.parse(savedSettings) : {};
                                const apiUrl = process.env.NEXT_PUBLIC_AI_API_URL || "http://localhost:5002/ai";
                                const { data: { session } } = await supabase.auth.getSession();
                                const lang = sampleLanguage || form.language || "c";
                                const ioInstructions = "CRITICAL REQUIREMENT: Provide complete competitive programming style standard input/output handling. The code MUST read all inputs from standard input (stdin) and print strictly the expected output to standard output (stdout). Do NOT just write a function! For Java, write a class with a public static void main method that uses a Scanner or BufferedReader. For C/C++, use standard main reading from cin/scanf. For Python, use input() or sys.stdin.read().";
                                let prompt = "";
                                if (type === 'starter') {
                                  prompt = `Generate a simple, incomplete starter code template in ${lang} for the following problem.\n\n${ioInstructions}\n\nInclude the full boilerplate for reading inputs and printing outputs, but leave the core algorithm logic incomplete (e.g., an empty function) for the student to solve. Return ONLY the raw code, NO markdown blocks (\`\`\`), NO explanations.\n\nProblem Description:\n${form.description}`;
                                } else {
                                  const baseContext = starterCode ? `\n\nUse the following starter code as the exact structural template (DO NOT change class or function names, just fill in the missing logic):\n\n${starterCode}` : "";
                                  prompt = `Generate a simple, complete working solution in ${lang} for the following problem.\n\n${ioInstructions}\n\nThe code should compile, read from stdin, execute the logic, and print to stdout correctly. Return ONLY the raw code, NO markdown blocks (\`\`\`), NO formatting, NO explanations.${baseContext}\n\nProblem Description:\n\n${form.description}`;
                                }
                                const res = await fetch(`${apiUrl}/chat`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session?.access_token || ""}` },
                                  body: JSON.stringify({ messages: [{ role: "user", parts: [{ text: prompt }] }], config }),
                                });
                                if (!res.ok || !res.body) throw new Error("API error");
                                const reader = res.body.getReader();
                                const decoder = new TextDecoder();
                                let fullText = "";
                                while (true) {
                                  const { done, value } = await reader.read();
                                  if (done) break;
                                  const chunk = decoder.decode(value, { stream: true });
                                  for (const line of chunk.split("\n\n")) {
                                    if (line.startsWith("data: ")) {
                                      const dataStr = line.slice(6);
                                      if (dataStr === "[DONE]") break;
                                      try { const parsed = JSON.parse(dataStr); if (parsed.text) fullText += parsed.text; } catch (e) { /* ignore parse error */ }
                                    }
                                  }
                                }
                                let code = fullText.trim();
                                code = code.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
                                if (type === 'starter') setStarterCode(code);
                                else setSampleCode(code);
                              } catch (err) { console.error("Code gen error:", err); alert("Failed to generate code. Try again."); }
                              finally { setIsGeneratingCode(false); }
                            }}
                            isGeneratingCode={isGeneratingCode}
                          />
                        )}

                        {!singleStep && (
                          <button
                            type="button"
                            onClick={() => setStep(1)}
                            className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                          >
                            <ChevronLeft className="w-4 h-4" /> Back to Exam Details & Settings
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {isExam && step === 3 && (
                  <div className="space-y-6">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Notes (Optional)
                        </label>
                        <input
                          type="text"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Instructions for students"
                          className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/40 outline-none"
                        />
                      </div>
                    </div>

                    <div className="rounded-xl border border-indigo-200/70 dark:border-indigo-800/60 bg-indigo-50/70 dark:bg-indigo-900/20 px-4 py-3 text-sm text-indigo-800 dark:text-indigo-200">
                      Assignment sync mode is enabled: selected students are assigned, unselected students are removed from the current visible scope (selected batch or all visible batches). For exams, each assigned student gets exactly one random question set (Set A/Set B/...).
                    </div>

                    <AssignStudentsStep
                      students={students}
                      selectedStudents={selectedStudents}
                      setSelectedStudents={setSelectedStudents}
                      filters={filters}
                      setFilters={setFilters}
                      availableBatches={availableBatches}
                    />

                    {!singleStep && (
                      <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                      >
                        <ChevronLeft className="w-4 h-4" /> Back to Questions & Sets
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div >
      )
      }
    </AnimatePresence >
  );
}
