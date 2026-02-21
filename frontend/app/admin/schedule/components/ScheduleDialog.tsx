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
import { Loader2, CalendarPlus, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface ScheduleDialogProps {
  onScheduleCreated: () => void;
  selectedDate?: Date;
  initialData?: {
    practical_id?: string;
    batch_name?: string;
    faculty_id?: string;
  };
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function ScheduleDialog({
  onScheduleCreated,
  selectedDate,
  initialData,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
}: ScheduleDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = isControlled ? setControlledOpen! : setInternalOpen;

  const [loading, setLoading] = useState(false);
  const [practicals, setPracticals] = useState<any[]>([]);
  const [faculty, setFaculty] = useState<any[]>([]);
  const [batches, setBatches] = useState<string[]>([]);

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

  const supabase = createClient();

  // Load initial data
  useEffect(() => {
    async function loadData() {
      const { data: practs } = await supabase
        .from("practicals")
        .select("id, title");
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

      setPracticals(practs || []);
      if (facs) {
        setFaculty((facs as any[]).map((f) => ({ id: f.uid, email: f.email })));
      }
    }
    if (open) loadData();
  }, [open, supabase]);

  // Update date if selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      setFormData((prev) => ({
        ...prev,
        date: selectedDate.toISOString().split("T")[0],
      }));
    }
  }, [selectedDate]);

  // Check conflicts when key fields change
  useEffect(() => {
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
  ]);

  async function checkConflict() {
    try {
      const res = await fetch("/api/schedule/check-conflict", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      setConflict(data);
    } catch (e) {
      console.error("Conflict check failed", e);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (conflict?.conflict) return;

    setLoading(true);
    try {
      const payload = { ...formData };
      if (payload.practical_id === "_none" || !payload.practical_id) {
        delete (payload as any).practical_id;
      }

      const res = await fetch("/api/schedule/create", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create schedule");
      }

      toast.success("Practical scheduled successfully");
      setOpen(false);
      onScheduleCreated();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && (
        <DialogTrigger asChild>
          <Button className="gap-2 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 hover:from-indigo-600 hover:via-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/30 hover:shadow-xl hover:shadow-purple-500/40 transition-all duration-300 hover:-translate-y-0.5">
            <CalendarPlus className="w-4 h-4" />
            Schedule
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-white/20 dark:border-gray-700/50 sm:max-w-[480px] shadow-2xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/30">
              <CalendarPlus className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Schedule Practical
              </DialogTitle>
              <p className="text-sm text-muted-foreground">
                Create a new practical session
              </p>
            </div>
          </div>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
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
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-lg shadow-indigo-500/25"
            >
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
