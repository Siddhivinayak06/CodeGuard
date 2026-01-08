import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
    const supabase = await createClient();

    try {
        const { data, error } = await supabase
            .from("users")
            .select("batch")
            .eq("role", "student")
            .not("batch", "is", null);

        if (error) {
            console.error("Error fetching batches:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        // Extract unique batches and sort them
        const uniqueBatches = Array.from(new Set(data.map((item: { batch: string }) => item.batch))).sort();

        return NextResponse.json({ batches: uniqueBatches });
    } catch (error: any) {
        console.error("Unexpected error:", error);
        return NextResponse.json(
            { error: "An unexpected error occurred" },
            { status: 500 }
        );
    }
}
