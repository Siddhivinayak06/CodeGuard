import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config({ path: ".env" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function test() {
  const { data, error } = await supabase.from("exam_sessions").select(`
    student_id,
    exam_id,
    assigned_set_id,
    exam_question_sets (
      set_name,
      exam_set_levels (
        practical_levels ( max_marks )
      )
    )
  `).limit(1);

  console.log("Error:", error);
  console.log("Data:", JSON.stringify(data, null, 2));
}

test();
