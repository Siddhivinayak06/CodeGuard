// /app/api/faculty/subjects/[facultyId]/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/service";

export async function GET(req: Request, { params }: { params: { facultyId: string } }) {
  const { facultyId } = params;
  const { data, error } = await supabaseAdmin
    .from("subjects")
    .select("*")
    .eq("faculty_id", facultyId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
