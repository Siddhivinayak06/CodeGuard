import { Tables } from "@/lib/supabase/database.types";

export type TestCase = Tables<"test_cases">;
export type Practical = Tables<"practicals"> & {
  testCases?: TestCase[];
  submission_count?: number;
  practical_number?: number;
  schedules?: { batch_name: string | null; date: string }[];
};
export type Subject = Tables<"subjects"> & { practical_count?: number };
export type Student = Tables<"users">;
export type Level = Tables<"practical_levels"> & { testCases: TestCase[]; reference_code?: string };
