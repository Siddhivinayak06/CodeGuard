export interface TestCase {
    id?: number;
    practical_id?: number;
    level_id?: number;
    input: string;
    expected_output: string;
    is_hidden?: boolean;
    time_limit_ms?: number;
    memory_limit_kb?: number;
}

export interface Practical {
    id: number;
    title: string;
    subject_id: number | string;
    description?: string;
    language?: string;
    deadline: string | null;
    max_marks?: number;
    submission_count?: number;
    testCases?: TestCase[];
}

export interface Subject {
    id: number | string;
    subject_name?: string;
    subject_code?: string;
    practical_count?: number;
    semester?: string;
    name?: string; // used in some components
}

export interface Student {
    uid: string;
    name: string;
    email?: string;
    roll?: string;
    semester?: string;
}

export interface Level {
    id?: number;
    level: 'easy' | 'medium' | 'hard';
    title: string;
    description: string;
    max_marks: number;
    testCases: TestCase[];
}
