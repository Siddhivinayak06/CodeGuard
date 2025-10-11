// /app/api/faculty/practicals/POST/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/service";

export async function POST(req: Request) {
  const body = await req.json();
  const { title, description, deadline, marks, subjectId, createdBy } = body;

  const { data, error } = await supabaseAdmin
    .from("practicals")
    .insert([{ title, description, deadline, marks, subject_id: subjectId, created_by: createdBy }])
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
