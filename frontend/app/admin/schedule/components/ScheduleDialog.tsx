"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { ConflictAlert } from "./ConflictAlert";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ScheduleDialogProps {
    onScheduleCreated: () => void;
    selectedDate?: Date;
}

export function ScheduleDialog({ onScheduleCreated, selectedDate }: ScheduleDialogProps) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [practicals, setPracticals] = useState<any[]>([]);
    const [faculty, setFaculty] = useState<any[]>([]);
    const [batches, setBatches] = useState<string[]>([]);

    // Form State
    const [formData, setFormData] = useState({
        date: selectedDate ? selectedDate.toISOString().split("T")[0] : "",
        start_time: "09:00",
        end_time: "11:00",
        practical_id: "",
        faculty_id: "",
        batch_name: "",
        title_placeholder: "",
    });

    const [conflict, setConflict] = useState<{ conflict: boolean; reason?: string } | undefined>(undefined);

    const supabase = createClient();

    // Load initial data
    useEffect(() => {
        async function loadData() {
            const { data: practs } = await supabase.from("practicals").select("id, title");
            const { data: facs } = await supabase.from("users").select("uid, email, role").eq("role", "faculty");

            try {
                const res = await fetch("/api/batches/get");
                const batchData = await res.json();
                if (batchData.batches) setBatches(batchData.batches);
            } catch (e) {
                console.error("Failed to load batches", e);
            }

            setPracticals(practs || []);
            if (facs) {
                setFaculty(facs.map(f => ({ id: f.uid, email: f.email })));
            }
        }
        if (open) loadData();
    }, [open, supabase]);

    // Update date if selectedDate changes
    useEffect(() => {
        if (selectedDate) {
            setFormData(prev => ({ ...prev, date: selectedDate.toISOString().split("T")[0] }));
        }
    }, [selectedDate]);

    // Check conflicts when key fields change
    useEffect(() => {
        if (formData.date && formData.start_time && formData.end_time && formData.faculty_id) {
            checkConflict();
        } else {
            setConflict(undefined);
        }
    }, [formData.date, formData.start_time, formData.end_time, formData.faculty_id]);

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
                // @ts-ignore
                delete payload.practical_id;
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
            <DialogTrigger asChild>
                <Button className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-500/20">
                    Schedule Practical
                </Button>
            </DialogTrigger>
            <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Schedule Practical Session</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">

                    <div className="space-y-2">
                        <Label>Practical (Optional)</Label>
                        <Select
                            value={formData.practical_id}
                            onValueChange={(val) => setFormData({ ...formData, practical_id: val })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select practical or leave empty" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="_none">No Practical (Lecture/Placeholder)</SelectItem>
                                {practicals.map(p => (
                                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {!formData.practical_id || formData.practical_id === "_none" ? (
                        <div className="space-y-2">
                            <Label>Session Title</Label>
                            <Input
                                placeholder="e.g. Intro to Python"
                                value={formData.title_placeholder || ""}
                                onChange={(e) => setFormData({ ...formData, title_placeholder: e.target.value })}
                                required
                            />
                        </div>
                    ) : null}

                    <div className="space-y-2">
                        <Label>Faculty</Label>
                        <Select
                            value={formData.faculty_id}
                            onValueChange={(val) => setFormData({ ...formData, faculty_id: val })}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select faculty" />
                            </SelectTrigger>
                            <SelectContent>
                                {faculty.map(f => (
                                    <SelectItem key={f.id} value={f.id}>{f.email}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Date</Label>
                            <Input
                                type="date"
                                value={formData.date}
                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Batch Name</Label>
                            <Select
                                value={formData.batch_name}
                                onValueChange={(val) => setFormData({ ...formData, batch_name: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select batch" />
                                </SelectTrigger>
                                <SelectContent>
                                    {batches.map(b => (
                                        <SelectItem key={b} value={b}>{b}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Start Time</Label>
                            <Input
                                type="time"
                                value={formData.start_time}
                                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>End Time</Label>
                            <Input
                                type="time"
                                value={formData.end_time}
                                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                                required
                            />
                        </div>
                    </div>

                    <ConflictAlert conflict={conflict} />

                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={loading || conflict?.conflict}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirm Schedule
                        </Button>
                    </div>

                </form>
            </DialogContent>
        </Dialog>
    );
}
