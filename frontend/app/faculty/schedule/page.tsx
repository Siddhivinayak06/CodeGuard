"use client";

import React, { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, Plus, Calendar as CalendarIcon, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import PracticalForm from "../components/PracticalForm";
import { toast } from "sonner";

export default function FacultySchedulePage() {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSchedule, setSelectedSchedule] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // PracticalForm state
  const [sampleCode, setSampleCode] = useState("");
  const [sampleLanguage, setSampleLanguage] = useState("c");

  const supabase = createClient();

  // Load data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Fetch schedules
      const { data: scheduleData } = await supabase
        .from("schedules")
        .select(`
        *,
        practicals (id, title)
      `)
        .eq("faculty_id", user.id)
        .order("date", { ascending: true })
        .order("start_time", { ascending: true });

      if (scheduleData) setSchedules(scheduleData);

      // 2. Fetch subjects
      const { data: subjectData } = await supabase.from("subjects").select("*");
      if (subjectData) setSubjects(subjectData);

      setLoading(false);
    };

    loadData();
  }, [supabase]);

  const handleCreateClick = (schedule: any) => {
    setSelectedSchedule(schedule);
    setDialogOpen(true);
    // Reset form state if needed
    setSampleCode("");
    setSampleLanguage("c");
  };

  const handlePracticalCreated = async (practicalId: number) => {
    if (!selectedSchedule) return;

    try {
      // Link the new practical to the schedule
      const { error } = await supabase
        .from("schedules")
        .update({
          practical_id: practicalId,
          title_placeholder: null // Clear placeholder since we have a real practical now
        })
        .eq("id", selectedSchedule.id);

      if (error) throw error;

      toast.success("Practical created and linked to schedule!");
      setDialogOpen(false);

      // Refresh schedules
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("schedules")
          .select(`
            *,
            practicals (id, title)
          `)
          .eq("faculty_id", user.id)
          .order("date", { ascending: true })
          .order("start_time", { ascending: true });

        if (data) setSchedules(data);
      }

    } catch (e: any) {
      console.error("Failed to link practical", e);
      toast.error("Failed to link practical to schedule: " + e.message);
    }
  };

  return (
    <div className="container mx-auto py-8 pt-24 space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Schedule</h1>
        <p className="text-gray-500 dark:text-gray-400">View your assigned practical sessions and add details.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {schedules.map((schedule) => (
            <Card key={schedule.id} className="relative overflow-hidden border-gray-200 dark:border-gray-800">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                      {schedule.practicals?.title || schedule.title_placeholder || "Untitled Session"}
                    </CardTitle>
                    <CardDescription className="mt-1 flex items-center gap-2">
                      <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wide">
                        {schedule.batch_name || "All Batches"}
                      </span>
                    </CardDescription>
                  </div>
                  {/* Status Indicator */}
                  <div className={`w-3 h-3 rounded-full ${schedule.practical_id ? "bg-green-500" : "bg-orange-500"}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-2">
                    <CalendarIcon size={16} />
                    <span>{new Date(schedule.date).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={16} />
                    <span>{schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}</span>
                  </div>
                </div>

                <div className="mt-6">
                  {schedule.practical_id ? (
                    <Button variant="outline" className="w-full pointer-events-none opacity-80">
                      Details Added
                    </Button>
                  ) : (
                    <Button
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => handleCreateClick(schedule)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Practical Details
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}

          {schedules.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-500">
              No assigned schedules found.
            </div>
          )}
        </div>
      )}

      {/* Full Practical Form Modal */}
      {dialogOpen && (
        <PracticalForm
          isOpen={dialogOpen}
          onClose={() => setDialogOpen(false)}
          practical={null} // Always creating new
          subjects={subjects}
          supabase={supabase}
          sampleCode={sampleCode}
          setSampleCode={setSampleCode}
          sampleLanguage={sampleLanguage}
          setSampleLanguage={setSampleLanguage}
          onSaved={() => { }} // Not used as we capture step 1 save
          onSaveStep1={handlePracticalCreated}
        />
      )}
    </div>
  );
}