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
      practicals: {
        Row: {
          created_at: string
          description: string | null
          id: number
          language: string | null
          max_marks: number | null
          practical_number: number | null
          subject_id: number | null
          submitted: boolean | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: number
          language?: string | null
          max_marks?: number | null
          practical_number?: number | null
          subject_id?: number | null
          submitted?: boolean | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          language?: string | null
          max_marks?: number | null
          practical_number?: number | null
          subject_id?: number | null
          submitted?: boolean | null
          title?: string
          updated_at?: string
        }
      }
      practical_levels: {
        Row: {
          created_at: string
          description: string | null
          id: number
          level: string
          max_marks: number
          practical_id: number | null
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: number
          level: string
          max_marks?: number
          practical_id?: number | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: number
          level?: string
          max_marks?: number
          practical_id?: number | null
          title?: string | null
          updated_at?: string
        }
      }
      reference_codes: {
        Row: {
          author: string | null
          code: string
          created_at: string
          id: number
          is_primary: boolean | null
          language: string
          practical_id: number | null
          starter_code: string | null
        }
        Insert: {
          author?: string | null
          code: string
          created_at?: string
          id?: number
          is_primary?: boolean | null
          language: string
          practical_id?: number | null
          starter_code?: string | null
        }
        Update: {
          author?: string | null
          code?: string
          created_at?: string
          id?: number
          is_primary?: boolean | null
          language?: string
          practical_id?: number | null
          starter_code?: string | null
        }
      }
      subjects: {
        Row: {
          created_at: string
          id: number
          subject_code: string
          subject_name: string
        }
        Insert: {
          created_at?: string
          id?: number
          subject_code: string
          subject_name: string
        }
        Update: {
          created_at?: string
          id?: number
          subject_code?: string
          subject_name?: string
        }
      }
      test_cases: {
        Row: {
          created_at: string
          expected_output: string
          id: number
          input: string
          is_hidden: boolean | null
          level_id: number | null
          memory_limit_kb: number | null
          practical_id: number | null
          time_limit_ms: number | null
        }
        Insert: {
          created_at?: string
          expected_output: string
          id?: number
          input: string
          is_hidden?: boolean | null
          level_id?: number | null
          memory_limit_kb?: number | null
          practical_id?: number | null
          time_limit_ms?: number | null
        }
        Update: {
          created_at?: string
          expected_output?: string
          id?: number
          input?: string
          is_hidden?: boolean | null
          level_id?: number | null
          memory_limit_kb?: number | null
          practical_id?: number | null
          time_limit_ms?: number | null
        }
      }
      users: {
        Row: {
          active_session_id: string | null
          batch: string | null
          created_at: string
          department: string | null
          email: string
          name: string | null
          profile_pic: string | null
          role: string
          roll_no: string | null
          semester: string | null
          session_updated_at: string | null
          uid: string
          updated_at: string
        }
        Insert: {
          active_session_id?: string | null
          batch?: string | null
          created_at?: string
          department?: string | null
          email: string
          name?: string | null
          profile_pic?: string | null
          role: string
          roll_no?: string | null
          semester?: string | null
          session_updated_at?: string | null
          uid: string
          updated_at?: string
        }
        Update: {
          active_session_id?: string | null
          batch?: string | null
          created_at?: string
          department?: string | null
          email?: string
          name?: string | null
          profile_pic?: string | null
          role?: string
          roll_no?: string | null
          semester?: string | null
          session_updated_at?: string | null
          uid?: string
          updated_at?: string
        }
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

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

// ... (abbreviated types for brevity as only reference_codes changed)
