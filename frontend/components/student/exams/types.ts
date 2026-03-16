export interface FormattedPractical {
  id: number;
  exam_id?: string;
  exam_start_time?: string | null;
  exam_end_time?: string | null;
  subject_id: number | null;
  practical_id: number;
  practical_number?: number | null;
  title: string;
  description: string | null;
  status:
  | "assigned"
  | "in_progress"
  | "completed"
  | "overdue"
  | "passed"
  | "failed"
  | "submitted"
  | "pending";
  subject_name: string;
  subject_code?: string;
  subject_semester?: string | number | null;
  language: string | null;
  hasLevels: boolean;
  attempt_count: number;
  max_attempts: number;
  is_locked: boolean;
  lock_reason?: string | null;
  marks_obtained?: number;
  max_marks?: number;
  notes?: string | null;
  levels?: {
    id: number;
    level: "easy" | "medium" | "hard";
    title: string | null;
    description: string | null;
    max_marks: number;
  }[];
  schedule_date?: string | null;
  schedule_time?: string | null;
  is_exam?: boolean;
}

export type FilterType = "all" | "pending" | "overdue" | "completed";

export interface Submission {
  id: number;
  practical_id: number;
  practical_title: string;
  code: string;
  output: string;
  language: string;
  status: string;
  created_at: string;
  marks_obtained: number | null;
  testCaseResults: TestCaseResult[];
}

export interface TestCase {
  id: number;
  input: string;
  expected_output: string;
  is_hidden: boolean | null;
}

export interface TestCaseResult {
  test_case_id: number;
  status: string;
  stdout: string;
  stderr: string;
  execution_time_ms: number;
  memory_used_kb: number;
}
