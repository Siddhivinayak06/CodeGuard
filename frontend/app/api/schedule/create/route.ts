import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const body = await request.json();
    const {
      practical_id,
      faculty_id,
      date,
      start_time,
      end_time,
      batch_name,
      students,
      title_placeholder,
    } = body;

    // 1. Basic Validation
    if (!faculty_id || !date || !start_time || !end_time) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    // 2. Conflict Checks

    // 2.1 Check Holiday
    const { data: holiday } = await supabase
      .from("holidays")
      .select("id, description")
      .eq("date", date)
      .single();

    if (holiday) {
      return NextResponse.json(
        { error: `Cannot schedule on a holiday: ${holiday.description}` },
        { status: 409 },
      );
    }

    // 2.2 Check Faculty Availability (assuming table 'faculty_availability' tracks defined slots or blocks)
    // For this MVP, let's assume if there's an entry in 'schedules' for this faculty at this time, it's a conflict.
    // Also check 'faculty_availability' table. If we interpret it as "Busy Times", we check for overlap.

    // Check existing schedules for this faculty
    const { data: facultyConflicts } = await supabase
      .from("schedules")
      .select("id")
      .eq("faculty_id", faculty_id)
      .eq("date", date)
      .or(`and(start_time.lte.${end_time},end_time.gte.${start_time})`); // Overlap logic

    if (facultyConflicts && facultyConflicts.length > 0) {
      return NextResponse.json(
        {
          error:
            "Faculty is already scheduled for another session at this time.",
        },
        { status: 409 },
      );
    }

    // 3. Create Schedule
    const { data: schedule, error: scheduleError } = await supabase
      .from("schedules")
      .insert({
        practical_id: practical_id || null, // Allow null
        faculty_id,
        date,
        start_time,
        end_time,
        batch_name,
        title_placeholder: title_placeholder || "Untitled Session", // Default title if no practical
      })
      .select()
      .single();

    if (scheduleError) {
      return NextResponse.json(
        { error: scheduleError.message },
        { status: 500 },
      );
    }

    // 4. Assign Students
    let studentIdsToAllocate: string[] = students || [];

    // If batch_name is provided, fetch students from that batch
    if (batch_name) {
      const { data: batchStudents, error: batchError } = await supabase
        .from("users")
        .select("uid")
        .eq("batch", batch_name)
        .eq("role", "student");

      if (!batchError && batchStudents) {
        const batchIds = batchStudents.map((s: any) => s.uid);
        // Merge and deduplicate
        studentIdsToAllocate = Array.from(
          new Set([...studentIdsToAllocate, ...batchIds]),
        );
      } else {
        console.error("Error fetching batch students:", batchError);
      }
    }

    if (studentIdsToAllocate.length > 0) {
      const allocations = studentIdsToAllocate.map((studentId: string) => ({
        schedule_id: schedule.id,
        student_id: studentId,
      }));

      const { error: allocationError } = await supabase
        .from("schedule_allocations")
        .insert(allocations);

      if (allocationError) {
        // Log error but maybe don't fail the whole request? Or try to rollback?
        // For MVP, just return error
        return NextResponse.json(
          {
            error: `Schedule created but failed to assign students: ${allocationError.message}`,
          },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ success: true, schedule });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
