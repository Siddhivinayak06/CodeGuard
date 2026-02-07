export interface StudentDetails {
    semester: string | number;
    name?: string;
}

export interface ProgressData {
    subject_id: string;
    subject_name: string;
    total_count: number;
    passed_count: number;
    failed_count: number;
}

export interface DashboardSubmission {
    id: string;
    practical_title: string;
    language: string;
    status: string;
    marks_obtained: number | null;
    created_at: string;
}
