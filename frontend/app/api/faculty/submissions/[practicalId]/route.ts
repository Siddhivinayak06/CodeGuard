import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: { practicalId: string } }
) {
  const supabase = createClient();
  const { practicalId } = params;

  try {
    const { data, error } = await supabase
      .from("faculty_submissions_view")
      .select("*")
      .eq("practical_id", practicalId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("Error fetching submissions:", err.message);
    return NextResponse.json(
      { error: "Failed to fetch submissions" },
      { status: 500 }
    );
  }
}
