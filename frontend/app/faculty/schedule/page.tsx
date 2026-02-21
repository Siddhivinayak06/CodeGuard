"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Loader2,
  Plus,
  Calendar as CalendarIcon,
  Clock,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import PracticalForm from "../components/PracticalForm";
import { toast } from "sonner";

// Helper to format date with day name
function formatScheduleDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// Helper to get days until deadline
function getDaysUntil(dateStr: string): number {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// Priority sorting function
function sortByPriority(a: any, b: any): number {
  const aConfigured = !!a.practical_id;
  const bConfigured = !!b.practical_id;
  const aDays = getDaysUntil(a.date);
  const bDays = getDaysUntil(b.date);

  // 1. Pending setup items first (not configured)
  if (!aConfigured && bConfigured) return -1;
  if (aConfigured && !bConfigured) return 1;

  // 2. Within same configuration status, sort by date proximity
  // Closer dates have higher priority
  if (aDays !== bDays) return aDays - bDays;

  // 3. Same day - sort by start time
  return a.start_time.localeCompare(b.start_time);
}

export default function FacultySchedulePage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSchedule, setSelectedSchedule] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPractical, setEditingPractical] = useState<any | null>(null);
  const [loadingEdit, setLoadingEdit] = useState<number | null>(null); // Track which schedule is loading

  // PracticalForm state
  const [sampleCode, setSampleCode] = useState("");
  const [sampleLanguage, setSampleLanguage] = useState("c");

  const supabase = createClient();

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch schedules
      const { data: scheduleData } = await supabase
        .from("schedules")
        .select(
          `
        *,
        practicals (id, title, subjects (subject_name))
      `,
        )
        .eq("faculty_id", user.id)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

      if (scheduleData) {
        // Sort by priority
        const sorted = [...scheduleData].sort(sortByPriority);
        setSchedules(sorted);
      }

      // 2. Fetch subjects assigned to this faculty via junction table
      const { data: facultyBatches } = await supabase
        .from("subject_faculty_batches")
        .select("subject_id")
        .eq("faculty_id", user.id);

      const subjectIds = [...new Set((facultyBatches || []).map((fb: any) => fb.subject_id))];

      if (subjectIds.length > 0) {
        const { data: subjectData } = await supabase
          .from("subjects")
          .select("*")
          .in("id", subjectIds);
        if (subjectData) setSubjects(subjectData);
      } else {
        setSubjects([]);
      }

      setLoading(false);
    };

    loadData();
  }, [supabase]);

  const handleCreateClick = (schedule: any) => {
    setSelectedSchedule(schedule);
    setEditingPractical(null); // Creating new
    setSampleCode("");
    setSampleLanguage("c");
    setDialogOpen(true);
  };

  const handleEditClick = async (schedule: any) => {
    if (!schedule.practical_id) return;

    // Show loading state immediately
    setLoadingEdit(schedule.id);

    // Fetch the full practical data
    const { data: practical } = await supabase
      .from("practicals")
      .select("*")
      .eq("id", schedule.practical_id)
      .single();

    if (practical) {
      setEditingPractical(practical);
      setSelectedSchedule(schedule);

      // Fetch reference code if exists
      const { data: refs } = await supabase
        .from("reference_codes")
        .select("*")
        .eq("practical_id", (practical as any).id)
        .order("created_at", { ascending: false });

      if (refs && (refs as any[]).length > 0) {
        setSampleCode((refs as any[])[0].code || "");
        setSampleLanguage((refs as any[])[0].language || "c");
      } else {
        setSampleCode("");
        setSampleLanguage((practical as any).language || "c");
      }

      setDialogOpen(true);
    }

    setLoadingEdit(null);
  };

  const refreshSchedules = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("schedules")
        .select(
          `
          *,
          practicals (id, title, subjects (subject_name))
        `,
        )
        .eq("faculty_id", user.id)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

      if (data) {
        // Sort by priority
        const sorted = [...data].sort(sortByPriority);
        setSchedules(sorted);
      }
    }
  };

  const handlePracticalCreated = async (practicalId: number) => {
    if (!selectedSchedule) return;

    try {
      // Link the new practical to the schedule
      const { error } = await supabase
        .from("schedules")
        .update({
          practical_id: practicalId,
          title_placeholder: null, // Clear placeholder since we have a real practical now
        } as never)
        .eq("id", selectedSchedule.id);

      if (error) throw error;

      toast.success("Practical created and linked to schedule!");
      setDialogOpen(false);

      // Refresh schedules
      await refreshSchedules();
    } catch (e: any) {
      console.error("Failed to link practical", e);
      toast.error("Failed to link practical to schedule: " + e.message);
    }
  };

  return (
    <div className="container mx-auto py-8 pt-24 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          My Schedule
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          View your assigned practical sessions and add details.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {schedules.map((schedule) => {
            const isConfigured = !!schedule.practical_id;
            const subjectName = schedule.practicals?.subjects?.subject_name;
            const practicalTitle =
              schedule.practicals?.title ||
              schedule.title_placeholder ||
              "Untitled Session";
            const daysUntil = getDaysUntil(schedule.date);
            const isToday = daysUntil === 0;
            const isUrgent = daysUntil <= 2 && daysUntil >= 0;
            const isPast = daysUntil < 0;

            return (
              <Card
                key={schedule.id}
                className={`relative overflow-hidden bg-white dark:bg-gray-900/50 border-gray-100 dark:border-gray-800 hover:shadow-lg transition-all ${!isConfigured && !isPast
                  ? "ring-2 ring-orange-300 dark:ring-orange-700 border-orange-200 dark:border-orange-800"
                  : isToday
                    ? "ring-2 ring-indigo-300 dark:ring-indigo-700 border-indigo-200 dark:border-indigo-800"
                    : "hover:border-indigo-200 dark:hover:border-indigo-800/50"
                  }`}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    {/* Batch Badge */}
                    <span className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-300 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wide">
                      {schedule.batch_name || "All Batches"}
                    </span>
                    {/* Status Badge */}
                    <span
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${isPast
                        ? "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                        : isConfigured
                          ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                          : "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400"
                        }`}
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${isPast
                          ? "bg-gray-400"
                          : isConfigured
                            ? "bg-emerald-500"
                            : "bg-orange-500 animate-pulse"
                          }`}
                      />
                      {isPast
                        ? "Completed"
                        : isConfigured
                          ? "Ready"
                          : "Pending Setup"}
                    </span>
                  </div>
                  {/* Subject Eyebrow + Title */}
                  <div className="mt-3">
                    {subjectName && (
                      <CardDescription className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">
                        {subjectName}
                      </CardDescription>
                    )}
                    <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white leading-tight">
                      {practicalTitle}
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Date & Time */}
                  <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-2">
                    <div className="flex items-center gap-1.5">
                      <CalendarIcon size={14} className="text-gray-400" />
                      <span>{formatScheduleDate(schedule.date)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock size={14} className="text-gray-400" />
                      <span>
                        {schedule.start_time.slice(0, 5)} -{" "}
                        {schedule.end_time.slice(0, 5)}
                      </span>
                    </div>
                  </div>

                  {/* Priority Indicator */}
                  {!isPast && (
                    <div
                      className={`text-xs font-medium mb-4 ${isToday
                        ? "text-indigo-600 dark:text-indigo-400"
                        : isUrgent
                          ? "text-orange-600 dark:text-orange-400"
                          : "text-gray-400 dark:text-gray-500"
                        }`}
                    >
                      {isToday
                        ? "📍 Today"
                        : isUrgent
                          ? `⚡ ${daysUntil} day${daysUntil === 1 ? "" : "s"} left`
                          : `${daysUntil} days away`}
                    </div>
                  )}
                  {isPast && (
                    <div className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-4">
                      Ended {Math.abs(daysUntil)} day
                      {Math.abs(daysUntil) === 1 ? "" : "s"} ago
                    </div>
                  )}

                  {/* Action Button */}
                  {isConfigured ? (
                    <Button
                      variant="outline"
                      className="w-full border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                      onClick={() => handleEditClick(schedule)}
                      disabled={loadingEdit === schedule.id}
                    >
                      {loadingEdit === schedule.id ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Pencil className="mr-2 h-4 w-4" />
                      )}
                      {loadingEdit === schedule.id
                        ? "Loading..."
                        : "Edit Details"}
                    </Button>
                  ) : (
                    <Button
                      className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25"
                      onClick={() => handleCreateClick(schedule)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Configuration
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {schedules.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500">
              No assigned schedules found.
            </div>
          )}
        </div>
      )}

      {dialogOpen && (
        <PracticalForm
          isOpen={dialogOpen}
          onClose={() => {
            setDialogOpen(false);
            setEditingPractical(null);
          }}
          practical={editingPractical}
          subjects={subjects}
          supabase={supabase}
          sampleCode={sampleCode}
          setSampleCode={setSampleCode}
          sampleLanguage={sampleLanguage}
          setSampleLanguage={setSampleLanguage}
          setStarterCode={() => { }} // Added missing required prop
          singleStep={true}
          onSaved={async () => {
            setDialogOpen(false);
            setEditingPractical(null);
            await refreshSchedules();
          }}
          onSaveStep1={editingPractical ? undefined : handlePracticalCreated}
        />
      )}
    </div>
  );
}
