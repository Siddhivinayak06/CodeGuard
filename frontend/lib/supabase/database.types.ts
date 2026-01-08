export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            announcements: {
                Row: {
                    id: number
                    created_by: string | null
                    title: string
                    message: string
                    target_role: 'student' | 'faculty' | 'all'
                    created_at: string
                }
                Insert: {
                    id?: number
                    created_by?: string | null
                    title: string
                    message: string
                    target_role?: 'student' | 'faculty' | 'all'
                    created_at?: string
                }
                Update: {
                    id?: number
                    created_by?: string | null
                    title?: string
                    message?: string
                    target_role?: 'student' | 'faculty' | 'all'
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "announcements_created_by_fkey"
                        columns: ["created_by"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["uid"]
                    }
                ]
            }
            audit_logs: {
                Row: {
                    id: number
                    user_id: string | null
                    type: 'authentication' | 'system' | 'security'
                    action: string
                    details: Json | null
                    ip_address: string | null
                    device_info: string | null
                    metadata: Json
                    created_at: string
                }
                Insert: {
                    id?: never
                    user_id?: string | null
                    type: 'authentication' | 'system' | 'security'
                    action: string
                    details?: Json | null
                    ip_address?: string | null
                    device_info?: string | null
                    metadata?: Json
                    created_at?: string
                }
                Update: {
                    id?: never
                    user_id?: string | null
                    type?: 'authentication' | 'system' | 'security'
                    action?: string
                    details?: Json | null
                    ip_address?: string | null
                    device_info?: string | null
                    metadata?: Json
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "audit_logs_user_id_fkey"
                        columns: ["user_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["uid"]
                    }
                ]
            }
            faculty_availability: {
                Row: {
                    id: string
                    faculty_id: string | null
                    date: string
                    start_time: string
                    end_time: string
                    is_available: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    faculty_id?: string | null
                    date: string
                    start_time: string
                    end_time: string
                    is_available?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    faculty_id?: string | null
                    date?: string
                    start_time?: string
                    end_time?: string
                    is_available?: boolean
                    created_at?: string
                }
                Relationships: []
            }
            grades: {
                Row: {
                    id: number
                    student_id: string | null
                    subject_id: number | null
                    total_marks: number
                    grade: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | null
                    generated_at: string
                }
                Insert: {
                    id?: number
                    student_id?: string | null
                    subject_id?: number | null
                    total_marks?: number
                    grade?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | null
                    generated_at?: string
                }
                Update: {
                    id?: number
                    student_id?: string | null
                    subject_id?: number | null
                    total_marks?: number
                    grade?: 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | null
                    generated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "grades_student_id_fkey"
                        columns: ["student_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["uid"]
                    },
                    {
                        foreignKeyName: "grades_subject_id_fkey"
                        columns: ["subject_id"]
                        isOneToOne: false
                        referencedRelation: "subjects"
                        referencedColumns: ["id"]
                    }
                ]
            }
            holidays: {
                Row: {
                    id: string
                    date: string
                    description: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    date: string
                    description?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    date?: string
                    description?: string | null
                    created_at?: string
                }
                Relationships: []
            }
            notifications: {
                Row: {
                    id: string
                    user_id: string
                    type: 'practical_assigned' | 'submission_graded' | 'deadline_reminder' | 'announcement' | 'submission_received'
                    title: string
                    message: string | null
                    link: string | null
                    is_read: boolean
                    created_at: string
                    metadata: Json
                }
                Insert: {
                    id?: string
                    user_id: string
                    type: 'practical_assigned' | 'submission_graded' | 'deadline_reminder' | 'announcement' | 'submission_received'
                    title: string
                    message?: string | null
                    link?: string | null
                    is_read?: boolean
                    created_at?: string
                    metadata?: Json
                }
                Update: {
                    id?: string
                    user_id?: string
                    type?: 'practical_assigned' | 'submission_graded' | 'deadline_reminder' | 'announcement' | 'submission_received'
                    title?: string
                    message?: string | null
                    link?: string | null
                    is_read?: boolean
                    created_at?: string
                    metadata?: Json
                }
                Relationships: []
            }
            practical_levels: {
                Row: {
                    id: number
                    practical_id: number
                    level: 'easy' | 'medium' | 'hard'
                    title: string | null
                    description: string | null
                    max_marks: number
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: number
                    practical_id: number
                    level: 'easy' | 'medium' | 'hard'
                    title?: string | null
                    description?: string | null
                    max_marks?: number
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: number
                    practical_id?: number
                    level?: 'easy' | 'medium' | 'hard'
                    title?: string | null
                    description?: string | null
                    max_marks?: number
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "practical_levels_practical_id_fkey"
                        columns: ["practical_id"]
                        isOneToOne: false
                        referencedRelation: "practicals"
                        referencedColumns: ["id"]
                    }
                ]
            }
            practicals: {
                Row: {
                    id: number
                    subject_id: number | null
                    title: string
                    description: string | null
                    language: string | null
                    deadline: string | null
                    max_marks: number
                    created_at: string
                    updated_at: string
                    submitted: boolean | null
                }
                Insert: {
                    id?: number
                    subject_id?: number | null
                    title: string
                    description?: string | null
                    language?: string | null
                    deadline?: string | null
                    max_marks?: number
                    created_at?: string
                    updated_at?: string
                    submitted?: boolean | null
                }
                Update: {
                    id?: number
                    subject_id?: number | null
                    title?: string
                    description?: string | null
                    language?: string | null
                    deadline?: string | null
                    max_marks?: number
                    created_at?: string
                    updated_at?: string
                    submitted?: boolean | null
                }
                Relationships: [
                    {
                        foreignKeyName: "practicals_subject_id_fkey"
                        columns: ["subject_id"]
                        isOneToOne: false
                        referencedRelation: "subjects"
                        referencedColumns: ["id"]
                    }
                ]
            }
            reference_codes: {
                Row: {
                    id: number
                    practical_id: number
                    author: string | null
                    language: string
                    code: string | null
                    is_primary: boolean
                    version: number
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: never
                    practical_id: number
                    author?: string | null
                    language: string
                    code?: string | null
                    is_primary?: boolean
                    version?: number
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: never
                    practical_id?: number
                    author?: string | null
                    language?: string
                    code?: string | null
                    is_primary?: boolean
                    version?: number
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "reference_codes_practical_id_fkey"
                        columns: ["practical_id"]
                        isOneToOne: false
                        referencedRelation: "practicals"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "reference_codes_author_fkey"
                        columns: ["author"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["uid"]
                    }
                ]
            }
            schedule_allocations: {
                Row: {
                    id: string
                    schedule_id: string | null
                    student_id: string | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    schedule_id?: string | null
                    student_id?: string | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    schedule_id?: string | null
                    student_id?: string | null
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "schedule_allocations_schedule_id_fkey"
                        columns: ["schedule_id"]
                        isOneToOne: false
                        referencedRelation: "schedules"
                        referencedColumns: ["id"]
                    }
                ]
            }
            schedules: {
                Row: {
                    id: string
                    practical_id: number | null
                    faculty_id: string | null
                    date: string
                    start_time: string
                    end_time: string
                    batch_name: string | null
                    title_placeholder: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    practical_id?: number | null
                    faculty_id?: string | null
                    date: string
                    start_time: string
                    end_time: string
                    batch_name?: string | null
                    title_placeholder?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    practical_id?: number | null
                    faculty_id?: string | null
                    date?: string
                    start_time?: string
                    end_time?: string
                    batch_name?: string | null
                    title_placeholder?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "schedules_practical_id_fkey"
                        columns: ["practical_id"]
                        isOneToOne: false
                        referencedRelation: "practicals"
                        referencedColumns: ["id"]
                    }
                ]
            }
            student_practicals: {
                Row: {
                    id: number
                    student_id: string | null
                    practical_id: number | null
                    assigned_deadline: string | null
                    status: 'assigned' | 'in_progress' | 'completed' | 'overdue' | null
                    assigned_at: string
                    completed_at: string | null
                    notes: string | null
                    attempt_count: number | null
                    max_attempts: number | null
                    is_locked: boolean | null
                    lock_reason: string | null
                    last_locked_at: string | null
                }
                Insert: {
                    id?: number
                    student_id?: string | null
                    practical_id?: number | null
                    assigned_deadline?: string | null
                    status?: 'assigned' | 'in_progress' | 'completed' | 'overdue' | null
                    assigned_at?: string
                    completed_at?: string | null
                    notes?: string | null
                    attempt_count?: number | null
                    max_attempts?: number | null
                    is_locked?: boolean | null
                    lock_reason?: string | null
                    last_locked_at?: string | null
                }
                Update: {
                    id?: number
                    student_id?: string | null
                    practical_id?: number | null
                    assigned_deadline?: string | null
                    status?: 'assigned' | 'in_progress' | 'completed' | 'overdue' | null
                    assigned_at?: string
                    completed_at?: string | null
                    notes?: string | null
                    attempt_count?: number | null
                    max_attempts?: number | null
                    is_locked?: boolean | null
                    lock_reason?: string | null
                    last_locked_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "student_practicals_practical_id_fkey"
                        columns: ["practical_id"]
                        isOneToOne: false
                        referencedRelation: "practicals"
                        referencedColumns: ["id"]
                    }
                ]
            }
            subjects: {
                Row: {
                    id: number
                    subject_name: string
                    subject_code: string
                    faculty_id: string | null
                    semester: string | null
                    created_at: string
                }
                Insert: {
                    id?: number
                    subject_name: string
                    subject_code: string
                    faculty_id?: string | null
                    semester?: string | null
                    created_at?: string
                }
                Update: {
                    id?: number
                    subject_name?: string
                    subject_code?: string
                    faculty_id?: string | null
                    semester?: string | null
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "subjects_faculty_id_fkey"
                        columns: ["faculty_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["uid"]
                    }
                ]
            }
            submissions: {
                Row: {
                    id: number
                    student_id: string | null
                    practical_id: number | null
                    code: string | null
                    output: string | null
                    status: 'submitted' | 'passed' | 'failed' | 'pending' | null
                    marks_obtained: number | null
                    comments: string | null
                    language: string | null
                    created_at: string
                    updated_at: string
                    test_cases_passed: string | null
                    level_id: number | null
                    execution_details: Json | null
                }
                Insert: {
                    id?: number
                    student_id?: string | null
                    practical_id?: number | null
                    code?: string | null
                    output?: string | null
                    status?: 'submitted' | 'passed' | 'failed' | 'pending' | null
                    marks_obtained?: number | null
                    comments?: string | null
                    language?: string | null
                    created_at?: string
                    updated_at?: string
                    test_cases_passed?: string | null
                    level_id?: number | null
                    execution_details?: Json | null
                }
                Update: {
                    id?: number
                    student_id?: string | null
                    practical_id?: number | null
                    code?: string | null
                    output?: string | null
                    status?: 'submitted' | 'passed' | 'failed' | 'pending' | null
                    marks_obtained?: number | null
                    comments?: string | null
                    language?: string | null
                    created_at?: string
                    updated_at?: string
                    test_cases_passed?: string | null
                    level_id?: number | null
                    execution_details?: Json | null
                }
                Relationships: [
                    {
                        foreignKeyName: "submissions_practical_id_fkey"
                        columns: ["practical_id"]
                        isOneToOne: false
                        referencedRelation: "practicals"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "submissions_level_id_fkey"
                        columns: ["level_id"]
                        isOneToOne: false
                        referencedRelation: "practical_levels"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "submissions_student_id_fkey"
                        columns: ["student_id"]
                        isOneToOne: false
                        referencedRelation: "users"
                        referencedColumns: ["uid"]
                    }
                ]
            }
            test_case_results: {
                Row: {
                    id: number
                    submission_id: number | null
                    test_case_id: number | null
                    status: 'passed' | 'failed' | 'timeout' | 'runtime_error' | 'compile_error'
                    execution_time_ms: number | null
                    memory_used_kb: number | null
                    stdout: string | null
                    stderr: string | null
                    created_at: string
                }
                Insert: {
                    id?: number
                    submission_id?: number | null
                    test_case_id?: number | null
                    status: 'passed' | 'failed' | 'timeout' | 'runtime_error' | 'compile_error'
                    execution_time_ms?: number | null
                    memory_used_kb?: number | null
                    stdout?: string | null
                    stderr?: string | null
                    created_at?: string
                }
                Update: {
                    id?: number
                    submission_id?: number | null
                    test_case_id?: number | null
                    status?: 'passed' | 'failed' | 'timeout' | 'runtime_error' | 'compile_error'
                    execution_time_ms?: number | null
                    memory_used_kb?: number | null
                    stdout?: string | null
                    stderr?: string | null
                    created_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "test_case_results_submission_id_fkey"
                        columns: ["submission_id"]
                        isOneToOne: false
                        referencedRelation: "submissions"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "test_case_results_test_case_id_fkey"
                        columns: ["test_case_id"]
                        isOneToOne: false
                        referencedRelation: "test_cases"
                        referencedColumns: ["id"]
                    }
                ]
            }
            test_cases: {
                Row: {
                    id: number
                    practical_id: number | null
                    input: string
                    expected_output: string
                    is_hidden: boolean | null
                    time_limit_ms: number | null
                    memory_limit_kb: number | null
                    created_at: string
                    level_id: number | null
                }
                Insert: {
                    id?: number
                    practical_id?: number | null
                    input: string
                    expected_output: string
                    is_hidden?: boolean | null
                    time_limit_ms?: number | null
                    memory_limit_kb?: number | null
                    created_at?: string
                    level_id?: number | null
                }
                Update: {
                    id?: number
                    practical_id?: number | null
                    input?: string
                    expected_output?: string
                    is_hidden?: boolean | null
                    time_limit_ms?: number | null
                    memory_limit_kb?: number | null
                    created_at?: string
                    level_id?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "test_cases_practical_id_fkey"
                        columns: ["practical_id"]
                        isOneToOne: false
                        referencedRelation: "practicals"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "test_cases_level_id_fkey"
                        columns: ["level_id"]
                        isOneToOne: false
                        referencedRelation: "practical_levels"
                        referencedColumns: ["id"]
                    }
                ]
            }
            users: {
                Row: {
                    uid: string
                    name: string
                    email: string
                    role: 'student' | 'faculty' | 'admin'
                    profile_pic: string | null
                    created_at: string
                    updated_at: string
                    active_session_id: string | null
                    session_updated_at: string | null
                    roll_no: string | null
                    semester: string | null
                    department: string | null
                    batch: string | null
                }
                Insert: {
                    uid: string
                    name: string
                    email: string
                    role: 'student' | 'faculty' | 'admin'
                    profile_pic?: string | null
                    created_at?: string
                    updated_at?: string
                    active_session_id?: string | null
                    session_updated_at?: string | null
                    roll_no?: string | null
                    semester?: string | null
                    department?: string | null
                    batch?: string | null
                }
                Update: {
                    uid?: string
                    name?: string
                    email?: string
                    role?: 'student' | 'faculty' | 'admin'
                    profile_pic?: string | null
                    created_at?: string
                    updated_at?: string
                    active_session_id?: string | null
                    session_updated_at?: string | null
                    roll_no?: string | null
                    semester?: string | null
                    department?: string | null
                    batch?: string | null
                }
                Relationships: []
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]

