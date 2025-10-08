import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: { subjectId: string } }
) {
  const supabase = createClient();

  const subjectId = params?.subjectId;
  if (!subjectId) {
    return NextResponse.json([], { status: 200 }); // empty array if missing
  }

  try {
    const { data, error } = await supabase
      .from("faculty_practicals_view")
      .select("*")
      .eq("subject_id", subjectId)
      .order("deadline", { ascending: true });

    if (error) {
      console.error("Supabase error fetching practicals:", error);
      return NextResponse.json([], { status: 200 });
    }

    return NextResponse.json(Array.isArray(data) ? data : []);
  } catch (err: any) {
    console.error("Unexpected error fetching practicals:", err);
    return NextResponse.json([], { status: 200 });
  }
}
