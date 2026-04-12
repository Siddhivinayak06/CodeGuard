"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { ConflictAlert } from "./ConflictAlert";
import {
  Loader2,
  CalendarPlus,
  Sparkles,
  CalendarRange,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

interface ScheduleDialogProps {
  onScheduleCreated: () => void;
  selectedDate?: Date;
  initialSubjectId?: string | number;
  initialData?: {
    practical_id?: string;
    batch_name?: string;
    faculty_id?: string;
  };
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  showExistingSchedules?: boolean;
  restrictFacultySelection?: boolean;
}

export function ScheduleDialog({
  onScheduleCreated,
  selectedDate,
  initialSubjectId,
  initialData,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  showExistingSchedules = false,
  restrictFacultySelection = false,
}: ScheduleDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen;

  const [loading, setLoading] = useState(false);
  const [practicals, setPracticals] = useState<any[]>([]);
  const [assignedSubjects, setAssignedSubjects] = useState<any[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [faculty, setFaculty] = useState<any[]>([]);
  const [batches, setBatches] = useState<string[]>([]);
  const [existingSchedules, setExistingSchedules] = useState<any[]>([]);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);

  // Matrix cell editor state (admin-style mini popup)
  const [editingCell, setEditingCell] = useState<{
    pid: string;
    batch: string;
    isExisting?: boolean;
    id?: string;
  } | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editStart, setEditStart] = useState("09:00");
  const [editEnd, setEditEnd] = useState("11:00");
  const [checkingConflict, setCheckingConflict] = useState(false);
  const [cellConflictError, setCellConflictError] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    date: selectedDate ? selectedDate.toISOString().split("T")[0] : "",
    start_time: "09:00",
    end_time: "11:00",
    practical_id: initialData?.practical_id || "",
    faculty_id: initialData?.faculty_id || "",
    batch_name: initialData?.batch_name || "",
    title_placeholder: "",
  });

  // Effect to update form when initialData changes
  useEffect(() => {
    if (initialData) {
      setFormData(prev => ({
        ...prev,
        practical_id: initialData.practical_id || prev.practical_id,
        batch_name: initialData.batch_name || prev.batch_name,
        faculty_id: initialData.faculty_id || prev.faculty_id
      }));
    }
  }, [initialData]);

  const [conflict, setConflict] = useState<
    { conflict: boolean; reason?: string } | undefined
  >(undefined);

  const supabase = React.useMemo(() => createClient(), []);

  // Load shared data (faculty, batches, and assigned subjects in faculty-grid mode)
  useEffect(() => {
    async function loadBaseData() {
      const { data: facs } = await supabase
        .from("users")
        .select("uid, email, role")
        .eq("role", "faculty");

      try {
        const res = await fetch("/api/batches/get");
        const batchData = await res.json();
        if (batchData.batches) setBatches(batchData.batches);
      } catch (e) {
        console.error("Failed to load batches", e);
      }

      if (facs) {
        setFaculty((facs as any[]).map((f) => ({ id: f.uid, email: f.email })));
      }

      if (showExistingSchedules && formData.faculty_id) {
        const { data: assignedRows } = await supabase
          .from("subject_faculty_batches")
          .select("subject_id")
          .eq("faculty_id", formData.faculty_id);

        const subjectIds = Array.from(
          new Set(
            ((assignedRows as any[]) || [])
              .map((row) => Number(row.subject_id))
              .filter((id) => Number.isFinite(id)),
          ),
        );

        if (subjectIds.length === 0) {
          setAssignedSubjects([]);
          setSelectedSubjectId("");
          return;
        }

        const { data: subjectRows } = await supabase
          .from("subjects")
          .select("id, subject_name, subject_code")
          .in("id", subjectIds)
          .order("subject_name", { ascending: true });

        const nextSubjects = (subjectRows as any[]) || [];
        setAssignedSubjects(nextSubjects);

        let nextSelected = selectedSubjectId;
        const preferredInitialSubjectId =
          initialSubjectId !== undefined && initialSubjectId !== null
            ? String(initialSubjectId)
            : null;

        // Always prioritize the explicitly requested subject when it is assigned.
        if (
          preferredInitialSubjectId &&
          nextSubjects.some((s) => String(s.id) === preferredInitialSubjectId)
        ) {
          nextSelected = preferredInitialSubjectId;
        }

        const hasSelected = nextSubjects.some((s) => String(s.id) === String(nextSelected));

        if (!nextSelected || !hasSelected) {
          let preferredSubject: string | null = null;

          if (
            preferredInitialSubjectId &&
            nextSubjects.some(
              (s) => String(s.id) === preferredInitialSubjectId,
            )
          ) {
            preferredSubject = preferredInitialSubjectId;
          }

          const preferredPracticalId = initialData?.practical_id || formData.practical_id;

          if (!preferredSubject && preferredPracticalId && preferredPracticalId !== "_none") {
            const { data: preferredPractical } = await supabase
              .from("practicals")
              .select("subject_id")
              .eq("id", Number(preferredPracticalId))
              .single();

            const preferredId = Number((preferredPractical as any)?.subject_id);
            if (
              Number.isFinite(preferredId) &&
              nextSubjects.some((s) => Number(s.id) === preferredId)
            ) {
              preferredSubject = String(preferredId);
            }
          }

          nextSelected = preferredSubject || (nextSubjects[0] ? String(nextSubjects[0].id) : "");
        }

        setSelectedSubjectId(nextSelected);
      } else {
        setAssignedSubjects([]);
        setSelectedSubjectId("");
      }
    }

    if (open) loadBaseData();
  }, [
    open,
    showExistingSchedules,
    formData.faculty_id,
    formData.practical_id,
    initialSubjectId,
    initialData?.practical_id,
    selectedSubjectId,
    supabase,
  ]);

  // Load practicals based on mode + selected subject
  useEffect(() => {
    async function loadPracticals() {
      if (!open) return;

      if (showExistingSchedules) {
        if (!selectedSubjectId) {
          setPracticals([]);
          return;
        }

        const { data: practs } = await supabase
          .from("practicals")
          .select("id, title, practical_number, subject_id")
          .eq("is_exam", false)
          .eq("subject_id", Number(selectedSubjectId))
          .order("practical_number", { ascending: true })
          .order("id", { ascending: true });

        setPracticals((practs as any[]) || []);
        return;
      }

      const { data: practs } = await supabase
        .from("practicals")
        .select("id, title, practical_number")
        .order("id", { ascending: true });

      setPracticals((practs as any[]) || []);
    }

    loadPracticals();
  }, [open, showExistingSchedules, selectedSubjectId, supabase]);

  // Update date if selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      setFormData((prev) => ({
        ...prev,
        date: selectedDate.toISOString().split("T")[0],
      }));
    }
  }, [selectedDate]);

  useEffect(() => {
    if (!open) {
      setEditingScheduleId(null);
      setConflict(undefined);
      setEditingCell(null);
      setCellConflictError(null);
    }
  }, [open]);

  async function loadExistingSchedules() {
    if (!showExistingSchedules || !formData.faculty_id) {
      setExistingSchedules([]);
      return;
    }

    if (showExistingSchedules && !selectedSubjectId) {
      setExistingSchedules([]);
      return;
    }

    try {
      let query = supabase
        .from("schedules")
        .select(
          `
          id,
          faculty_id,
          practical_id,
          batch_name,
          date,
          start_time,
          end_time,
          title_placeholder,
          practicals!inner (id, title, subject_id)
        `,
        )
        .eq("faculty_id", formData.faculty_id)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

      if (showExistingSchedules && selectedSubjectId) {
        query = query.eq("practicals.subject_id", Number(selectedSubjectId));
      }

      const { data, error } = await query;
      if (error) throw error;
      setExistingSchedules((data as any[]) || []);
    } catch (error) {
      console.error("Failed to load existing schedules", error);
      setExistingSchedules([]);
    }
  }

  useEffect(() => {
    if (!open || !showExistingSchedules) return;
    loadExistingSchedules();
  }, [open, showExistingSchedules, formData.faculty_id, selectedSubjectId]);

  const scheduleGridBatches = React.useMemo(() => {
    const seen = new Set<string>();
    const cols: string[] = [];

    batches.forEach((batch) => {
      const key = String(batch || "").trim();
      if (!key || seen.has(key)) return;
      seen.add(key);
      cols.push(key);
    });

    existingSchedules.forEach((schedule) => {
      const batchRaw = schedule?.batch_name ? String(schedule.batch_name).trim() : "";
      const key = batchRaw || "All";
      if (seen.has(key)) return;
      seen.add(key);
      cols.push(key);
    });

    return cols;
  }, [batches, existingSchedules]);

  const scheduleGridRows = React.useMemo(() => {
    const rows: Array<{ id: number; title: string; practicalNumber: number | null }> = [];
    const seen = new Set<number>();

    practicals.forEach((p: any) => {
      const idNum = Number(p?.id);
      if (!Number.isFinite(idNum) || seen.has(idNum)) return;
      seen.add(idNum);
      rows.push({
        id: idNum,
        title: String(p?.title || `Practical ${idNum}`),
        practicalNumber:
          typeof p?.practical_number === "number" ? Number(p.practical_number) : null,
      });
    });

    existingSchedules.forEach((schedule: any) => {
      const idNum = Number(schedule?.practical_id);
      if (!Number.isFinite(idNum) || seen.has(idNum)) return;
      seen.add(idNum);
      rows.push({
        id: idNum,
        title: String(
          schedule?.practicals?.title ||
            schedule?.title_placeholder ||
            `Practical ${idNum}`,
        ),
        practicalNumber: null,
      });
    });

    return rows;
  }, [practicals, existingSchedules]);

  const scheduleGridMap = React.useMemo(() => {
    const map: Record<string, Record<string, any>> = {};

    existingSchedules.forEach((schedule: any) => {
      const practicalId = Number(schedule?.practical_id);
      if (!Number.isFinite(practicalId)) return;

      const batchKey = schedule?.batch_name
        ? String(schedule.batch_name).trim()
        : "All";

      const practicalKey = String(practicalId);
      if (!map[practicalKey]) {
        map[practicalKey] = {};
      }
      map[practicalKey][batchKey] = schedule;
    });

    return map;
  }, [existingSchedules]);

  const formatBatchLabel = (batch: string) => {
    if (batch === "All") return "All Batches";
    if (/^\d+$/.test(batch)) return `Batch ${batch}`;
    return batch;
  };

  const openCreateForCell = (practicalId: number, batchName: string) => {
    setEditingScheduleId(null);
    setCellConflictError(null);
    setEditingCell({
      pid: String(practicalId),
      batch: batchName,
      isExisting: false,
    });
    setEditDate(formData.date || selectedDate?.toISOString().split("T")[0] || "");
    setEditStart("09:00");
    setEditEnd("11:00");

    setFormData((prev) => ({
      ...prev,
      practical_id: String(practicalId),
      batch_name: batchName === "All" ? "" : batchName,
      title_placeholder: "",
    }));
  };

  const openEditorForExistingCell = (schedule: any, batchName: string) => {
    const toHHMM = (value?: string) => {
      if (!value) return "";
      return String(value).slice(0, 5);
    };

    setEditingScheduleId(String(schedule.id));
    setCellConflictError(null);
    setEditingCell({
      pid: String(schedule.practical_id),
      batch: batchName,
      isExisting: true,
      id: String(schedule.id),
    });
    setEditDate(String(schedule.date || ""));
    setEditStart(toHHMM(schedule.start_time) || "09:00");
    setEditEnd(toHHMM(schedule.end_time) || "11:00");
  };

  const closeCellEditor = () => {
    setEditingCell(null);
    setEditingScheduleId(null);
    setCellConflictError(null);
  };

  const checkCellConflict = async (options: {
    batchName: string;
    excludeId?: string;
    date: string;
    start: string;
    end: string;
  }) => {
    if (!formData.faculty_id) {
      return { conflict: true, reason: "Faculty is required before scheduling." };
    }

    try {
      const res = await fetch("/api/schedule/check-conflict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          faculty_id: formData.faculty_id,
          batch_name: options.batchName === "All" ? null : options.batchName,
          date: options.date,
          start_time: options.start,
          end_time: options.end,
          exclude_id: options.excludeId,
        }),
      });
      const data = await res.json();
      return {
        conflict: Boolean(data?.conflict),
        reason: data?.reason as string | undefined,
      };
    } catch (error) {
      console.error("Cell conflict check failed", error);
      return { conflict: true, reason: "Failed to validate conflict." };
    }
  };

  const saveCell = async () => {
    if (!editingCell) return;
    if (!editDate) {
      setCellConflictError("Date is required.");
      return;
    }

    if (!formData.faculty_id) {
      setCellConflictError("Faculty is required before scheduling.");
      return;
    }

    setCheckingConflict(true);
    setCellConflictError(null);

    try {
      const conflictResult = await checkCellConflict({
        batchName: editingCell.batch,
        excludeId: editingCell.isExisting ? editingCell.id : undefined,
        date: editDate,
        start: editStart,
        end: editEnd,
      });

      if (conflictResult.conflict) {
        setCellConflictError(conflictResult.reason || "Time conflict detected.");
        return;
      }

      let response: Response;
      if (editingCell.isExisting && editingCell.id) {
        response = await fetch("/api/schedule/manage", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: editingCell.id,
            practical_id: Number(editingCell.pid),
            faculty_id: formData.faculty_id,
            batch_name: editingCell.batch === "All" ? null : editingCell.batch,
            date: editDate,
            start_time: editStart,
            end_time: editEnd,
          }),
        });
      } else {
        response = await fetch("/api/schedule/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            practical_id: Number(editingCell.pid),
            faculty_id: formData.faculty_id,
            batch_name: editingCell.batch === "All" ? null : editingCell.batch,
            date: editDate,
            start_time: editStart,
            end_time: editEnd,
          }),
        });
      }

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to save schedule");
      }

      toast.success(editingCell.isExisting ? "Schedule updated" : "Schedule created");
      closeCellEditor();
      await loadExistingSchedules();
      onScheduleCreated();
    } catch (error: any) {
      setCellConflictError(error?.message || "Failed to save schedule");
    } finally {
      setCheckingConflict(false);
    }
  };

  const scheduledCount = React.useMemo(() => {
    return Object.values(scheduleGridMap).reduce((acc, row) => acc + Object.keys(row).length, 0);
  }, [scheduleGridMap]);

  const totalSlots = scheduleGridRows.length * scheduleGridBatches.length;
  const emptyCount = Math.max(totalSlots - scheduledCount, 0);
  const progressPercent = totalSlots > 0 ? (scheduledCount / totalSlots) * 100 : 0;
  const selectedSubject = React.useMemo(
    () =>
      assignedSubjects.find(
        (subject: any) => String(subject.id) === String(selectedSubjectId),
      ) || null,
    [assignedSubjects, selectedSubjectId],
  );

  // Check conflicts when key fields change
  useEffect(() => {
    if (showExistingSchedules) return;

    if (
      formData.date &&
      formData.start_time &&
      formData.end_time &&
      formData.faculty_id
    ) {
      checkConflict();
    } else {
      setConflict(undefined);
    }
  }, [
    formData.date,
    formData.start_time,
    formData.end_time,
    formData.faculty_id,
    editingScheduleId,
  ]);

  async function checkConflict() {
    try {
      const res = await fetch("/api/schedule/check-conflict", {
        method: "POST",
        body: JSON.stringify({
          ...formData,
          exclude_id: editingScheduleId || undefined,
        }),
      });
      const data = await res.json();
      setConflict(data);
    } catch (e) {
      console.error("Conflict check failed", e);
    }
  }

  const startEditingSchedule = (schedule: any) => {
    const toHHMM = (value?: string) => {
      if (!value) return "";
      return String(value).slice(0, 5);
    };

    setEditingScheduleId(String(schedule.id));
    setFormData((prev) => ({
      ...prev,
      practical_id: schedule.practical_id ? String(schedule.practical_id) : "_none",
      faculty_id: schedule.faculty_id || prev.faculty_id,
      batch_name: schedule.batch_name || "",
      date: schedule.date || prev.date,
      start_time: toHHMM(schedule.start_time) || prev.start_time,
      end_time: toHHMM(schedule.end_time) || prev.end_time,
      title_placeholder: schedule.title_placeholder || "",
    }));
  };

  const resetEditMode = () => {
    setEditingScheduleId(null);
    setConflict(undefined);
    setFormData((prev) => ({
      ...prev,
      date: selectedDate ? selectedDate.toISOString().split("T")[0] : prev.date,
      start_time: "09:00",
      end_time: "11:00",
      batch_name: initialData?.batch_name || prev.batch_name,
      title_placeholder: "",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (conflict?.conflict) return;

    setLoading(true);
    try {
      const payload: any = { ...formData };
      payload.practical_id =
        payload.practical_id === "_none" || !payload.practical_id
          ? null
          : Number(payload.practical_id);
      payload.batch_name = payload.batch_name || null;
      payload.title_placeholder = payload.title_placeholder?.trim() || null;

      if (!payload.practical_id && !payload.title_placeholder) {
        throw new Error("Session title is required when no practical is selected");
      }

      let res: Response;
      if (editingScheduleId) {
        res = await fetch("/api/schedule/manage", {
          method: "PUT",
          body: JSON.stringify({
            id: editingScheduleId,
            ...payload,
          }),
        });
      } else {
        const createPayload = { ...payload };
        if (createPayload.practical_id === null) {
          delete createPayload.practical_id;
        }

        res = await fetch("/api/schedule/create", {
          method: "POST",
          body: JSON.stringify(createPayload),
        });
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save schedule");
      }

      toast.success(editingScheduleId ? "Schedule updated successfully" : "Practical scheduled successfully");
      setOpen(false);
      setEditingScheduleId(null);
      onScheduleCreated();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (showExistingSchedules) {
    return (
      <>
        <Dialog open={open} onOpenChange={setOpen}>
          {!isControlled && (
            <DialogTrigger asChild>
              <Button className="gap-2 bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-indigo-600 hover:via-sky-600 hover:to-blue-700 text-white shadow-lg shadow-sky-500/30 hover:shadow-xl hover:shadow-sky-500/40 transition-all duration-300 hover:-translate-y-0.5">
                <CalendarPlus className="w-4 h-4" />
                Schedule
              </Button>
            </DialogTrigger>
          )}

          <DialogContent className="w-[96vw] max-w-[1400px] max-h-[92vh] p-0 overflow-hidden bg-white dark:bg-gray-950 border-0 shadow-2xl flex flex-col rounded-2xl">
            <div className="relative bg-gradient-to-r from-indigo-600 via-sky-600 to-blue-600 px-8 py-6 shrink-0 overflow-hidden">
              <div
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage:
                    'url("data:image/svg+xml,%3Csvg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="%23fff" fill-opacity="0.4"%3E%3Ccircle cx="1" cy="1" r="1"/%3E%3C/g%3E%3C/svg%3E")',
                }}
              />
              <DialogHeader className="relative z-10">
                <DialogTitle className="text-white text-2xl font-bold flex items-center gap-2.5 tracking-tight">
                  <Sparkles className="w-6 h-6 text-amber-300" />
                  Schedule Manager
                </DialogTitle>
                <p className="text-white/60 text-sm mt-1">
                  Manage practical sessions and update your schedule allocations efficiently.
                </p>
              </DialogHeader>
            </div>

            <div className="px-8 pt-5 pb-0 shrink-0">
              <div className="flex items-center gap-6 mb-5">
                <div className="w-[320px] space-y-2 p-1">
                  <Label className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <CalendarRange className="w-3.5 h-3.5" />
                    Select Subject
                  </Label>
                  <Select
                    value={selectedSubjectId}
                    onValueChange={setSelectedSubjectId}
                    disabled={assignedSubjects.length === 0}
                  >
                    <SelectTrigger className="h-11 bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-sm hover:shadow-md hover:border-indigo-300 rounded-xl">
                      <SelectValue placeholder="No assigned subjects" />
                    </SelectTrigger>
                    <SelectContent>
                      {assignedSubjects.map((subject: any) => (
                        <SelectItem key={subject.id} value={String(subject.id)}>
                          <span className="font-medium">{subject.subject_name}</span>{" "}
                          {subject.subject_code ? (
                            <span className="text-gray-400">({subject.subject_code})</span>
                          ) : null}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 flex items-center gap-3 justify-end">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-semibold text-gray-700 dark:text-gray-300">
                    <span className="w-2 h-2 rounded-full bg-gray-400" />
                    {totalSlots} Total
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-900/20 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/40">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    {scheduledCount} Scheduled
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 dark:bg-orange-900/20 text-xs font-semibold text-orange-700 dark:text-orange-300 border border-orange-200/60 dark:border-orange-800/40">
                    <span className="w-2 h-2 rounded-full bg-orange-400" />
                    {emptyCount} Empty
                  </div>
                  <div className="px-2.5 py-1 rounded-full bg-indigo-600 text-[11px] font-bold text-white tabular-nums">
                    {Math.round(progressPercent)}%
                  </div>
                </div>
              </div>
            </div>

            <div className="px-8 py-5 overflow-y-auto flex-1 h-full min-h-0">
              {!formData.faculty_id ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Faculty details are loading. Please wait a moment.
                  </p>
                </div>
              ) : assignedSubjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No subjects are assigned to this faculty.
                  </p>
                </div>
              ) : !selectedSubjectId ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Select an assigned subject to view schedules.
                  </p>
                </div>
              ) : scheduleGridRows.length === 0 || scheduleGridBatches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    No practicals found for {selectedSubject?.subject_name || "the selected subject"}.
                  </p>
                </div>
              ) : (
                <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden h-full flex flex-col bg-white dark:bg-gray-950 shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
                  <div className="overflow-auto flex-1 max-h-[calc(92vh-320px)]">
                    <table className="w-full text-sm border-collapse">
                      <thead className="sticky top-0 z-20">
                        <tr className="bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-900 border-b-2 border-gray-200 dark:border-gray-800">
                          <th className="px-5 py-3.5 border-r border-gray-200 dark:border-gray-800 min-w-[280px] text-left font-semibold text-gray-500 dark:text-gray-400 sticky left-0 bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-900 z-30 text-xs uppercase tracking-widest">
                            Practical
                          </th>
                          {scheduleGridBatches.map((batch) => (
                            <th
                              key={batch}
                              className="px-4 py-3.5 border-r border-gray-200 dark:border-gray-800 min-w-[180px] text-center font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-widest bg-gradient-to-b from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-900"
                            >
                              {formatBatchLabel(batch)}
                            </th>
                          ))}
                        </tr>
                      </thead>

                      <tbody>
                        {scheduleGridRows.map((practical, idx) => (
                          <tr
                            key={practical.id}
                            className={`transition-colors ${
                              idx % 2 === 0
                                ? "bg-white dark:bg-gray-950"
                                : "bg-gray-50/40 dark:bg-gray-900/20"
                            } hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10`}
                          >
                            <td className="px-5 py-3.5 border-b border-r border-gray-100 dark:border-gray-800 font-medium sticky left-0 z-10 bg-inherit text-gray-800 dark:text-gray-200 shadow-[2px_0_8px_-4px_rgba(0,0,0,0.1)] dark:shadow-[2px_0_8px_-4px_rgba(0,0,0,0.4)]">
                              <div className="flex items-center gap-3 max-w-[260px]">
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-indigo-50 dark:bg-indigo-900/30 text-[11px] font-bold text-indigo-500 dark:text-indigo-400 shrink-0">
                                  {practical.practicalNumber ?? idx + 1}
                                </span>
                                <span className="truncate text-[13px] font-medium" title={practical.title}>
                                  {practical.title}
                                </span>
                              </div>
                            </td>

                            {scheduleGridBatches.map((batch) => {
                              const schedule = scheduleGridMap[String(practical.id)]?.[batch];
                              const isEditingThis =
                                schedule && String(schedule.id) === editingScheduleId;

                              if (schedule) {
                                return (
                                  <td
                                    key={`${practical.id}-${batch}`}
                                    className="p-2 border-b border-r border-gray-100 dark:border-gray-800 relative group cursor-pointer"
                                    onClick={() => openEditorForExistingCell(schedule, batch)}
                                  >
                                    <div
                                      className={`flex flex-col gap-0.5 px-3 py-2 rounded-xl border transition-all ${
                                        isEditingThis
                                          ? "bg-cyan-50 dark:bg-cyan-900/20 border-cyan-300 dark:border-cyan-700"
                                          : "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200/60 dark:border-emerald-800/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                                      }`}
                                    >
                                      <div className="flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                        <span className="font-semibold text-[11px] text-emerald-700 dark:text-emerald-300">
                                          {String(schedule.date)}
                                        </span>
                                      </div>
                                      <div className="pl-3 opacity-70 text-[10px] text-emerald-600 dark:text-emerald-400">
                                        {String(schedule.start_time).slice(0, 8)} - {String(schedule.end_time).slice(0, 8)}
                                      </div>
                                    </div>
                                  </td>
                                );
                              }

                              return (
                                <td
                                  key={`${practical.id}-${batch}`}
                                  className="p-2 border-b border-r border-gray-100 dark:border-gray-800 cursor-pointer group"
                                  onClick={() => openCreateForCell(practical.id, batch)}
                                >
                                  <div className="flex items-center justify-center h-[42px] rounded-xl border border-dashed border-gray-200/80 dark:border-gray-700/60 group-hover:border-cyan-400 dark:group-hover:border-cyan-500 group-hover:bg-gradient-to-br group-hover:from-cyan-50 group-hover:to-sky-50/50 dark:group-hover:from-cyan-900/20 dark:group-hover:to-sky-900/10 transition-all duration-200">
                                    <span className="text-gray-300 dark:text-gray-600 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 text-xl font-light transition-colors">+
                                    </span>
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="px-8 py-3.5 border-t border-gray-200 dark:border-gray-800 bg-gradient-to-r from-gray-50 to-gray-50/50 dark:from-gray-900/80 dark:to-gray-900/30 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-5 text-xs text-gray-500 dark:text-gray-400 font-medium">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-md bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-300 dark:border-emerald-700" />
                  Scheduled
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-md bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600" />
                  Empty
                </span>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                Click a cell to set or update schedule.
              </span>
            </div>
          </DialogContent>
        </Dialog>

        {editingCell && (
          <Dialog
            open={!!editingCell}
            onOpenChange={(nextOpen) => {
              if (!nextOpen) closeCellEditor();
            }}
          >
            <DialogContent className="sm:max-w-[380px] p-0 overflow-hidden border-0 shadow-2xl">
              <div className="bg-gradient-to-r from-cyan-500 to-sky-600 px-5 py-4 flex justify-between items-center">
                <DialogHeader>
                  <DialogTitle className="text-white text-base">
                    {editingCell.isExisting ? "Edit Schedule" : "Set Schedule"}
                  </DialogTitle>
                </DialogHeader>
                <span className="px-2 py-0.5 rounded-full bg-white/20 text-white text-xs font-medium">
                  {formatBatchLabel(editingCell.batch)}
                </span>
              </div>

              <div className="px-5 py-4 space-y-4">
                {cellConflictError && (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-red-700 dark:text-red-300">{cellConflictError}</p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Date
                  </Label>
                  <Input
                    type="date"
                    value={editDate}
                    onChange={(e) => {
                      setEditDate(e.target.value);
                      setCellConflictError(null);
                    }}
                    className="h-10 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      Start
                    </Label>
                    <Input
                      type="time"
                      value={editStart}
                      onChange={(e) => {
                        setEditStart(e.target.value);
                        setCellConflictError(null);
                      }}
                      className="h-10 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                      End
                    </Label>
                    <Input
                      type="time"
                      value={editEnd}
                      onChange={(e) => {
                        setEditEnd(e.target.value);
                        setCellConflictError(null);
                      }}
                      className="h-10 bg-gray-50 dark:bg-gray-900 focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {!formData.faculty_id && (
                  <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                    <span className="text-amber-500 text-sm">!</span>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      No faculty assigned. Reload and try again.
                    </p>
                  </div>
                )}
              </div>

              <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={closeCellEditor}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={saveCell}
                  disabled={!editDate || checkingConflict || !formData.faculty_id}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[84px]"
                >
                  {checkingConflict ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : editingCell.isExisting ? (
                    "Update"
                  ) : (
                    "Set"
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button className="gap-2 bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-600 hover:from-indigo-600 hover:via-sky-600 hover:to-blue-700 text-white shadow-lg shadow-sky-500/30 hover:shadow-xl hover:shadow-sky-500/40 transition-all duration-300 hover:-translate-y-0.5">
            <CalendarPlus className="w-4 h-4" />
            Schedule
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-white/20 dark:border-gray-700/50 w-[95vw] sm:max-w-[980px] max-h-[90vh] overflow-y-auto shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-cyan-500 to-sky-600 rounded-xl shadow-lg shadow-sky-500/30">
              <CalendarPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                {editingScheduleId ? "Update Schedule" : "Schedule Practical"}
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                {editingScheduleId
                  ? "Modify an existing schedule entry"
                  : "Create a new practical session"}
              </p>
            </div>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4 min-w-0">
          {showExistingSchedules && (
            <div className="space-y-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/40 p-3 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300">
                  Existing Schedules for Faculty
                </p>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {existingSchedules.length} found
                </span>
              </div>

              {existingSchedules.length === 0 ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  No schedules found for this faculty.
                </p>
              ) : (
                <div className="border rounded-lg overflow-x-auto bg-white dark:bg-gray-900 shadow-sm animate-fadeIn min-w-0">
                  <table className="w-full min-w-[760px] text-sm text-left border-collapse">
                    <thead className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                      <tr>
                        <th className="p-3 border-b border-r min-w-[220px] sticky left-0 bg-gray-50 dark:bg-gray-800 z-10 font-medium uppercase tracking-wider">
                          Practical
                        </th>
                        {scheduleGridBatches.map((batch) => (
                          <th
                            key={batch}
                            className="p-3 border-b border-r min-w-[170px] text-center font-medium uppercase tracking-wider"
                          >
                            {formatBatchLabel(batch)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {scheduleGridRows.map((practical, index) => (
                        <tr
                          key={practical.id}
                          className="hover:bg-gray-50/50 dark:hover:bg-gray-800/20"
                        >
                          <td className="p-3 border-b border-r bg-white dark:bg-gray-900 sticky left-0 z-10">
                            <div className="flex items-center gap-3 min-w-0">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300 text-sm font-bold shrink-0">
                                {index + 1}
                              </span>
                              <span className="font-medium text-gray-800 dark:text-gray-200 truncate">
                                {practical.title}
                              </span>
                            </div>
                          </td>

                          {scheduleGridBatches.map((batch) => {
                            const schedule = scheduleGridMap[String(practical.id)]?.[batch];
                            const isEditingThis =
                              schedule && String(schedule.id) === editingScheduleId;

                            return (
                              <td
                                key={`${practical.id}-${batch}`}
                                className={`p-2 border-b border-r max-w-[170px] transition-colors relative group ${
                                  schedule
                                    ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                                }`}
                              >
                                {schedule ? (
                                  <button
                                    type="button"
                                    onClick={() => startEditingSchedule(schedule)}
                                    className={`w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                                      isEditingThis
                                        ? "border-cyan-400 bg-cyan-100/80 dark:border-cyan-600 dark:bg-cyan-900/30"
                                        : "border-emerald-300 bg-emerald-100/70 dark:border-emerald-700 dark:bg-emerald-900/30"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-semibold text-base leading-tight">
                                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                                      {String(schedule.date)}
                                    </div>
                                    <div className="mt-1 text-emerald-600/90 dark:text-emerald-300/90 text-[15px]">
                                      {String(schedule.start_time).slice(0, 8)} - {String(schedule.end_time).slice(0, 8)}
                                    </div>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => openCreateForCell(practical.id, batch)}
                                    className="w-full h-14 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 text-gray-400 dark:text-gray-500 hover:text-cyan-600 dark:hover:text-cyan-400 hover:border-cyan-300 dark:hover:border-cyan-700 transition-colors flex items-center justify-center"
                                  >
                                    <span className="text-3xl leading-none">+</span>
                                  </button>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-sm font-medium">Practical (Optional)</Label>
            <Select
              value={formData.practical_id}
              onValueChange={(val) =>
                setFormData({ ...formData, practical_id: val })
              }
            >
              <SelectTrigger className="bg-white/80 dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500/30">
                <SelectValue placeholder="Select practical or leave empty" />
              </SelectTrigger>
              <SelectContent className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-gray-200 dark:border-gray-700">
                <SelectItem value="_none">
                  No Practical (Lecture/Placeholder)
                </SelectItem>
                {practicals.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!formData.practical_id || formData.practical_id === "_none" ? (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Session Title</Label>
              <Input
                placeholder="e.g. Intro to Python"
                value={formData.title_placeholder || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    title_placeholder: e.target.value,
                  })
                }
                required
                className="bg-white/80 dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label className="text-sm font-medium">Faculty</Label>
            <Select
              value={formData.faculty_id}
              disabled={restrictFacultySelection}
              onValueChange={(val) =>
                setFormData({ ...formData, faculty_id: val })
              }
            >
              <SelectTrigger className="bg-white/80 dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500/30">
                <SelectValue placeholder="Select faculty" />
              </SelectTrigger>
              <SelectContent className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-gray-200 dark:border-gray-700">
                {faculty.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Date</Label>
              <Input
                type="date"
                value={formData.date}
                onChange={(e) =>
                  setFormData({ ...formData, date: e.target.value })
                }
                required
                className="bg-white/80 dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Batch</Label>
              <Select
                value={formData.batch_name}
                onValueChange={(val) =>
                  setFormData({ ...formData, batch_name: val })
                }
              >
                <SelectTrigger className="bg-white/80 dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500/30">
                  <SelectValue placeholder="Select batch" />
                </SelectTrigger>
                <SelectContent className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-gray-200 dark:border-gray-700">
                  {batches.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Start Time</Label>
              <Input
                type="time"
                value={formData.start_time}
                onChange={(e) =>
                  setFormData({ ...formData, start_time: e.target.value })
                }
                required
                className="bg-white/80 dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">End Time</Label>
              <Input
                type="time"
                value={formData.end_time}
                onChange={(e) =>
                  setFormData({ ...formData, end_time: e.target.value })
                }
                required
                className="bg-white/80 dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
          </div>

          <ConflictAlert conflict={conflict} />

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
            {editingScheduleId && (
              <Button
                type="button"
                variant="outline"
                onClick={resetEditMode}
                className="bg-white/80 dark:bg-gray-800/80"
              >
                Create New Instead
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              className="bg-white/80 dark:bg-gray-800/80"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || conflict?.conflict}
              className="bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-600 hover:to-sky-700 text-white shadow-lg shadow-sky-500/25"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingScheduleId ? "Update Schedule" : "Confirm"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
