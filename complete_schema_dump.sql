Initialising login role...
Dumping schemas from remote database...



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" character varying, "p_title" character varying, "p_message" "text" DEFAULT NULL::"text", "p_link" character varying DEFAULT NULL::character varying, "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  notification_id UUID;
BEGIN
  INSERT INTO notifications (user_id, type, title, message, link, metadata)
  VALUES (p_user_id, p_type, p_title, p_message, p_link, p_metadata)
  RETURNING id INTO notification_id;
  
  RETURN notification_id;
END;
$$;


ALTER FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" character varying, "p_title" character varying, "p_message" "text", "p_link" character varying, "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_role"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT role FROM public.users WHERE uid = auth.uid();
$$;


ALTER FUNCTION "public"."current_user_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  INSERT INTO public.users (uid, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'Student'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'student')
  );
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_submission_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_max_attempts INTEGER;
    v_attempt_count INTEGER;
    v_is_locked BOOLEAN;
    v_sp_id INTEGER;
BEGIN
    -- Get current state from student_practicals
    SELECT id, max_attempts, attempt_count, is_locked
    INTO v_sp_id, v_max_attempts, v_attempt_count, v_is_locked
    FROM student_practicals
    WHERE student_id = NEW.student_id AND practical_id = NEW.practical_id;

    -- If no record exists, create one (Safety fallback, though Start API should handle this)
    IF v_sp_id IS NULL THEN
        INSERT INTO student_practicals (student_id, practical_id, status, attempt_count, max_attempts)
        VALUES (NEW.student_id, NEW.practical_id, 'in_progress', 1, 1)
        RETURNING id, max_attempts, attempt_count, is_locked
        INTO v_sp_id, v_max_attempts, v_attempt_count, v_is_locked;
    END IF;

    -- LOGIC MATRIX:
    
    -- 1. Passed -> Auto Complete + Lock
    IF NEW.status = 'passed' THEN
        UPDATE student_practicals
        SET status = 'completed',
            is_locked = TRUE,
            lock_reason = 'Practical passed successfully.',
            last_locked_at = NOW(),
            completed_at = NOW()
        WHERE id = v_sp_id;
        
    -- 2. Failed -> Check attempts
    ELSIF NEW.status = 'failed' THEN
        -- Increment attempt count logic is tricky. 
        -- Submissions might be updated multiple times during a single "attempt" session?
        -- OR does every submission count as an attempt?
        -- User requirement: "First submission -> attempt_count = 1".
        -- Let's assume every finalized submission (not pending) counts?
        -- Or rely on 'attempt_count' being managed by Start API?
        
        -- User request: "Increment attempt_count" in trigger.
        -- This implies every INSERT in submissions is an attempt.
        -- We must be careful not to double count updates.
        
        IF (TG_OP = 'INSERT') THEN
            UPDATE student_practicals
            SET attempt_count = attempt_count + 1,
                status = CASE 
                    WHEN (attempt_count + 1) >= max_attempts THEN 'in_progress' -- actually, failed but locked? context says 'failed'
                    ELSE 'in_progress' 
                END
            WHERE id = v_sp_id;
            
            -- Re-fetch to check lock condition
            SELECT attempt_count INTO v_attempt_count FROM student_practicals WHERE id = v_sp_id;
            
            IF v_attempt_count >= v_max_attempts THEN
                 UPDATE student_practicals
                 SET is_locked = TRUE,
                     lock_reason = 'Maximum attempts reached.',
                     last_locked_at = NOW()
                 WHERE id = v_sp_id;
            END IF;
        END IF;

    -- 3. Pending/Submitted (Initial State)
    ELSIF NEW.status = 'submitted' OR NEW.status = 'pending' THEN
        -- Ensure status is active
         UPDATE student_practicals
         SET status = 'in_progress' -- or 'submitted'? Let's keep 'in_progress' for simplicity unless we want 'submitted'
         WHERE id = v_sp_id AND status != 'completed';
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_submission_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT current_user_role() = 'admin';
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_faculty"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT current_user_role() = 'faculty';
$$;


ALTER FUNCTION "public"."is_faculty"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_student"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  SELECT current_user_role() = 'student';
$$;


ALTER FUNCTION "public"."is_student"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prevent_submission_if_locked"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_is_locked BOOLEAN;
BEGIN
    SELECT is_locked INTO v_is_locked
    FROM student_practicals
    WHERE student_id = NEW.student_id AND practical_id = NEW.practical_id;
    
    IF v_is_locked THEN
        RAISE EXCEPTION 'Cannot submit: Practical is locked.';
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."prevent_submission_if_locked"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_practical_status"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  -- If completed_at is set, mark as completed
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    NEW.status = 'completed';
  -- If deadline has passed and not completed, mark as overdue
  ELSIF NEW.assigned_deadline < NOW() AND NEW.completed_at IS NULL AND NEW.status != 'completed' THEN
    NEW.status = 'overdue';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_practical_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_timestamp"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."announcements" (
    "id" integer NOT NULL,
    "created_by" "uuid",
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "target_role" "text" DEFAULT 'all'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "announcements_target_role_check" CHECK (("target_role" = ANY (ARRAY['student'::"text", 'faculty'::"text", 'all'::"text"])))
);


ALTER TABLE "public"."announcements" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."announcements_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."announcements_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."announcements_id_seq" OWNED BY "public"."announcements"."id";



CREATE TABLE IF NOT EXISTS "public"."audit_logs" (
    "id" integer NOT NULL,
    "user_id" "uuid",
    "type" "text" NOT NULL,
    "action" "text" NOT NULL,
    "details" "jsonb",
    "ip_address" "text",
    "device_info" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "audit_logs_type_check" CHECK (("type" = ANY (ARRAY['authentication'::"text", 'system'::"text", 'security'::"text"])))
);


ALTER TABLE "public"."audit_logs" OWNER TO "postgres";


ALTER TABLE "public"."audit_logs" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."audit_logs_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."faculty_availability" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "faculty_id" "uuid",
    "date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "is_available" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."faculty_availability" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."practicals" (
    "id" integer NOT NULL,
    "subject_id" integer,
    "title" "text" NOT NULL,
    "description" "text",
    "language" "text",
    "deadline" timestamp with time zone,
    "max_marks" integer DEFAULT 100,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "submitted" boolean DEFAULT false,
    "practical_number" integer
);


ALTER TABLE "public"."practicals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."submissions" (
    "id" integer NOT NULL,
    "student_id" "uuid",
    "practical_id" integer,
    "code" "text",
    "output" "text",
    "status" "text" DEFAULT 'submitted'::"text",
    "marks_obtained" integer DEFAULT 0,
    "comments" "text",
    "language" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "test_cases_passed" "text",
    "level_id" integer,
    "execution_details" "jsonb",
    CONSTRAINT "submissions_status_check" CHECK (("status" = ANY (ARRAY['passed'::"text", 'failed'::"text", 'pending'::"text"])))
);


ALTER TABLE "public"."submissions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "uid" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "email" "text" NOT NULL,
    "role" "text" NOT NULL,
    "profile_pic" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "active_session_id" "uuid",
    "session_updated_at" timestamp with time zone,
    "roll_no" "text",
    "semester" "text",
    "department" "text",
    "batch" "text",
    CONSTRAINT "users_role_check" CHECK (("role" = ANY (ARRAY['student'::"text", 'faculty'::"text", 'admin'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."faculty_submissions_view" AS
 SELECT "s"."id" AS "submission_id",
    "s"."student_id",
    "u"."name" AS "student_name",
    "s"."practical_id",
    "p"."title" AS "practical_title",
    "s"."code",
    "s"."output",
    "s"."status",
    "s"."marks_obtained",
    "s"."language",
    "s"."created_at"
   FROM (("public"."submissions" "s"
     JOIN "public"."users" "u" ON (("s"."student_id" = "u"."uid")))
     JOIN "public"."practicals" "p" ON (("s"."practical_id" = "p"."id")))
  ORDER BY "s"."created_at" DESC;


ALTER VIEW "public"."faculty_submissions_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."grades" (
    "id" integer NOT NULL,
    "student_id" "uuid",
    "subject_id" integer,
    "total_marks" integer DEFAULT 0,
    "grade" "text",
    "generated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "grades_grade_check" CHECK (("grade" = ANY (ARRAY['A'::"text", 'B'::"text", 'C'::"text", 'D'::"text", 'E'::"text", 'F'::"text"])))
);


ALTER TABLE "public"."grades" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."grades_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."grades_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."grades_id_seq" OWNED BY "public"."grades"."id";



CREATE TABLE IF NOT EXISTS "public"."holidays" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date" "date" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."holidays" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" character varying(50) NOT NULL,
    "title" character varying(255) NOT NULL,
    "message" "text",
    "link" character varying(500),
    "is_read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    CONSTRAINT "notifications_type_check" CHECK ((("type")::"text" = ANY ((ARRAY['practical_assigned'::character varying, 'submission_graded'::character varying, 'deadline_reminder'::character varying, 'announcement'::character varying, 'submission_received'::character varying])::"text"[])))
);


ALTER TABLE "public"."notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."practical_levels" (
    "id" integer NOT NULL,
    "practical_id" integer NOT NULL,
    "level" "text" NOT NULL,
    "title" "text",
    "description" "text",
    "max_marks" integer DEFAULT 10,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "practical_levels_level_check" CHECK (("level" = ANY (ARRAY['easy'::"text", 'medium'::"text", 'hard'::"text"])))
);


ALTER TABLE "public"."practical_levels" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."practical_levels_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."practical_levels_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."practical_levels_id_seq" OWNED BY "public"."practical_levels"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."practicals_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."practicals_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."practicals_id_seq" OWNED BY "public"."practicals"."id";



CREATE TABLE IF NOT EXISTS "public"."reference_codes" (
    "id" integer NOT NULL,
    "practical_id" integer NOT NULL,
    "author" "uuid",
    "language" "text" NOT NULL,
    "code" "text",
    "is_primary" boolean DEFAULT false,
    "version" integer DEFAULT 1,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."reference_codes" OWNER TO "postgres";


ALTER TABLE "public"."reference_codes" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."reference_codes_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."schedule_allocations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "schedule_id" "uuid",
    "student_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."schedule_allocations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schedules" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "practical_id" integer,
    "faculty_id" "uuid",
    "date" "date" NOT NULL,
    "start_time" time without time zone NOT NULL,
    "end_time" time without time zone NOT NULL,
    "batch_name" "text",
    "title_placeholder" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."schedules" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_practicals" (
    "id" integer NOT NULL,
    "student_id" "uuid",
    "practical_id" integer,
    "assigned_deadline" timestamp with time zone,
    "status" "text" DEFAULT 'assigned'::"text",
    "assigned_at" timestamp with time zone DEFAULT "now"(),
    "completed_at" timestamp with time zone,
    "notes" "text",
    "attempt_count" integer DEFAULT 0,
    "max_attempts" integer DEFAULT 1,
    "is_locked" boolean DEFAULT false,
    "lock_reason" "text",
    "last_locked_at" timestamp with time zone,
    CONSTRAINT "student_practicals_status_check" CHECK (("status" = ANY (ARRAY['assigned'::"text", 'in_progress'::"text", 'completed'::"text", 'overdue'::"text"])))
);


ALTER TABLE "public"."student_practicals" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."student_practicals_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."student_practicals_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."student_practicals_id_seq" OWNED BY "public"."student_practicals"."id";



CREATE TABLE IF NOT EXISTS "public"."subjects" (
    "id" integer NOT NULL,
    "subject_name" "text" NOT NULL,
    "subject_code" "text" NOT NULL,
    "faculty_id" "uuid",
    "semester" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."subjects" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."subjects_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."subjects_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."subjects_id_seq" OWNED BY "public"."subjects"."id";



CREATE SEQUENCE IF NOT EXISTS "public"."submissions_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."submissions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."submissions_id_seq" OWNED BY "public"."submissions"."id";



CREATE TABLE IF NOT EXISTS "public"."test_case_results" (
    "id" integer NOT NULL,
    "submission_id" integer,
    "test_case_id" integer,
    "status" "text" NOT NULL,
    "execution_time_ms" integer,
    "memory_used_kb" integer,
    "stdout" "text",
    "stderr" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "test_case_results_status_check" CHECK (("status" = ANY (ARRAY['passed'::"text", 'failed'::"text", 'timeout'::"text", 'runtime_error'::"text", 'compile_error'::"text"])))
);


ALTER TABLE "public"."test_case_results" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."test_case_results_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."test_case_results_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."test_case_results_id_seq" OWNED BY "public"."test_case_results"."id";



CREATE TABLE IF NOT EXISTS "public"."test_cases" (
    "id" integer NOT NULL,
    "practical_id" integer,
    "input" "text" NOT NULL,
    "expected_output" "text" NOT NULL,
    "is_hidden" boolean DEFAULT false,
    "time_limit_ms" integer DEFAULT 2000,
    "memory_limit_kb" integer DEFAULT 65536,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "level_id" integer
);


ALTER TABLE "public"."test_cases" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."test_cases_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."test_cases_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."test_cases_id_seq" OWNED BY "public"."test_cases"."id";



ALTER TABLE ONLY "public"."announcements" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."announcements_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."grades" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."grades_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."practical_levels" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."practical_levels_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."practicals" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."practicals_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."student_practicals" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."student_practicals_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."subjects" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."subjects_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."submissions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."submissions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."test_case_results" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."test_case_results_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."test_cases" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."test_cases_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."faculty_availability"
    ADD CONSTRAINT "faculty_availability_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."grades"
    ADD CONSTRAINT "grades_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."grades"
    ADD CONSTRAINT "grades_student_id_subject_id_key" UNIQUE ("student_id", "subject_id");



ALTER TABLE ONLY "public"."holidays"
    ADD CONSTRAINT "holidays_date_key" UNIQUE ("date");



ALTER TABLE ONLY "public"."holidays"
    ADD CONSTRAINT "holidays_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."practical_levels"
    ADD CONSTRAINT "practical_levels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."practical_levels"
    ADD CONSTRAINT "practical_levels_practical_id_level_key" UNIQUE ("practical_id", "level");



ALTER TABLE ONLY "public"."practicals"
    ADD CONSTRAINT "practicals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reference_codes"
    ADD CONSTRAINT "reference_codes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedule_allocations"
    ADD CONSTRAINT "schedule_allocations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_practicals"
    ADD CONSTRAINT "student_practicals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_practicals"
    ADD CONSTRAINT "student_practicals_student_id_practical_id_key" UNIQUE ("student_id", "practical_id");



ALTER TABLE ONLY "public"."subjects"
    ADD CONSTRAINT "subjects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subjects"
    ADD CONSTRAINT "subjects_subject_code_key" UNIQUE ("subject_code");



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_student_id_practical_id_key" UNIQUE ("student_id", "practical_id");



ALTER TABLE ONLY "public"."test_case_results"
    ADD CONSTRAINT "test_case_results_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."test_case_results"
    ADD CONSTRAINT "test_case_results_submission_id_test_case_id_key" UNIQUE ("submission_id", "test_case_id");



ALTER TABLE ONLY "public"."test_cases"
    ADD CONSTRAINT "test_cases_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("uid");



CREATE INDEX "idx_grades_student" ON "public"."grades" USING "btree" ("student_id");



CREATE INDEX "idx_grades_subject" ON "public"."grades" USING "btree" ("subject_id");



CREATE INDEX "idx_notifications_created_at" ON "public"."notifications" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_notifications_is_read" ON "public"."notifications" USING "btree" ("user_id", "is_read");



CREATE INDEX "idx_notifications_user_id" ON "public"."notifications" USING "btree" ("user_id");



CREATE INDEX "idx_notifications_user_unread" ON "public"."notifications" USING "btree" ("user_id") WHERE ("is_read" = false);



CREATE INDEX "idx_practical_levels_practical_id" ON "public"."practical_levels" USING "btree" ("practical_id");



CREATE INDEX "idx_schedules_date" ON "public"."schedules" USING "btree" ("date");



CREATE INDEX "idx_schedules_faculty" ON "public"."schedules" USING "btree" ("faculty_id");



CREATE INDEX "idx_student_practicals_deadline" ON "public"."student_practicals" USING "btree" ("assigned_deadline");



CREATE INDEX "idx_student_practicals_lookup" ON "public"."student_practicals" USING "btree" ("student_id", "practical_id");



CREATE INDEX "idx_student_practicals_practical" ON "public"."student_practicals" USING "btree" ("practical_id");



CREATE INDEX "idx_student_practicals_practical_id" ON "public"."student_practicals" USING "btree" ("practical_id");



CREATE INDEX "idx_student_practicals_status" ON "public"."student_practicals" USING "btree" ("status");



CREATE INDEX "idx_student_practicals_student" ON "public"."student_practicals" USING "btree" ("student_id");



CREATE INDEX "idx_student_practicals_student_id" ON "public"."student_practicals" USING "btree" ("student_id");



CREATE INDEX "idx_subjects_faculty" ON "public"."subjects" USING "btree" ("faculty_id");



CREATE INDEX "idx_submissions_level_id" ON "public"."submissions" USING "btree" ("level_id");



CREATE INDEX "idx_submissions_lookup" ON "public"."submissions" USING "btree" ("student_id", "practical_id");



CREATE INDEX "idx_submissions_practical" ON "public"."submissions" USING "btree" ("practical_id");



CREATE INDEX "idx_submissions_status" ON "public"."submissions" USING "btree" ("status");



CREATE INDEX "idx_submissions_student" ON "public"."submissions" USING "btree" ("student_id");



CREATE INDEX "idx_tc_results_submission" ON "public"."test_case_results" USING "btree" ("submission_id");



CREATE INDEX "idx_tcr_submission_testcase" ON "public"."test_case_results" USING "btree" ("submission_id", "test_case_id");



CREATE INDEX "idx_test_cases_level_id" ON "public"."test_cases" USING "btree" ("level_id");



CREATE INDEX "idx_testcases_practical" ON "public"."test_cases" USING "btree" ("practical_id");



CREATE INDEX "reference_codes_practical_id_idx" ON "public"."reference_codes" USING "btree" ("practical_id");



CREATE UNIQUE INDEX "reference_codes_practical_primary_idx" ON "public"."reference_codes" USING "btree" ("practical_id") WHERE "is_primary";



CREATE OR REPLACE TRIGGER "set_timestamp_practicals" BEFORE UPDATE ON "public"."practicals" FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_submissions" BEFORE UPDATE ON "public"."submissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();



CREATE OR REPLACE TRIGGER "set_timestamp_users" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();



CREATE OR REPLACE TRIGGER "trg_update_practicals" BEFORE UPDATE ON "public"."practicals" FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();



CREATE OR REPLACE TRIGGER "trg_update_submissions" BEFORE UPDATE ON "public"."submissions" FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();



CREATE OR REPLACE TRIGGER "trg_update_users" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."update_timestamp"();



CREATE OR REPLACE TRIGGER "trigger_prevent_submission_locked" BEFORE INSERT OR UPDATE ON "public"."submissions" FOR EACH ROW EXECUTE FUNCTION "public"."prevent_submission_if_locked"();



CREATE OR REPLACE TRIGGER "trigger_update_practical_on_submission" AFTER INSERT OR UPDATE ON "public"."submissions" FOR EACH ROW EXECUTE FUNCTION "public"."handle_submission_update"();



CREATE OR REPLACE TRIGGER "trigger_update_practical_status" BEFORE UPDATE ON "public"."student_practicals" FOR EACH ROW EXECUTE FUNCTION "public"."update_practical_status"();



ALTER TABLE ONLY "public"."announcements"
    ADD CONSTRAINT "announcements_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("uid") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."audit_logs"
    ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("uid");



ALTER TABLE ONLY "public"."faculty_availability"
    ADD CONSTRAINT "faculty_availability_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."grades"
    ADD CONSTRAINT "grades_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."users"("uid") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."grades"
    ADD CONSTRAINT "grades_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."practical_levels"
    ADD CONSTRAINT "practical_levels_practical_id_fkey" FOREIGN KEY ("practical_id") REFERENCES "public"."practicals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."practicals"
    ADD CONSTRAINT "practicals_subject_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reference_codes"
    ADD CONSTRAINT "reference_codes_author_fkey" FOREIGN KEY ("author") REFERENCES "public"."users"("uid");



ALTER TABLE ONLY "public"."reference_codes"
    ADD CONSTRAINT "reference_codes_practical_id_fkey" FOREIGN KEY ("practical_id") REFERENCES "public"."practicals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_allocations"
    ADD CONSTRAINT "schedule_allocations_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "public"."schedules"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."schedule_allocations"
    ADD CONSTRAINT "schedule_allocations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."schedules"
    ADD CONSTRAINT "schedules_practical_id_fkey" FOREIGN KEY ("practical_id") REFERENCES "public"."practicals"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."student_practicals"
    ADD CONSTRAINT "student_practicals_practical_id_fkey" FOREIGN KEY ("practical_id") REFERENCES "public"."practicals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_practicals"
    ADD CONSTRAINT "student_practicals_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."subjects"
    ADD CONSTRAINT "subjects_faculty_id_fkey" FOREIGN KEY ("faculty_id") REFERENCES "public"."users"("uid") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "public"."practical_levels"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_practical_id_fkey" FOREIGN KEY ("practical_id") REFERENCES "public"."practicals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."submissions"
    ADD CONSTRAINT "submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."users"("uid") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_case_results"
    ADD CONSTRAINT "test_case_results_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_case_results"
    ADD CONSTRAINT "test_case_results_test_case_id_fkey" FOREIGN KEY ("test_case_id") REFERENCES "public"."test_cases"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_cases"
    ADD CONSTRAINT "test_cases_level_id_fkey" FOREIGN KEY ("level_id") REFERENCES "public"."practical_levels"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."test_cases"
    ADD CONSTRAINT "test_cases_practical_id_fkey" FOREIGN KEY ("practical_id") REFERENCES "public"."practicals"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_uid_fkey" FOREIGN KEY ("uid") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Admins can insert users" ON "public"."users" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins can select all users" ON "public"."users" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "auth"."users" "users_1"
  WHERE (("users_1"."id" = "auth"."uid"()) AND (("users_1"."role")::"text" = 'admin'::"text")))));



CREATE POLICY "Allow faculty to manage practical_levels" ON "public"."practical_levels" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."practicals" "p"
     JOIN "public"."subjects" "s" ON (("p"."subject_id" = "s"."id")))
  WHERE (("p"."id" = "practical_levels"."practical_id") AND ("s"."faculty_id" = "auth"."uid"())))));



CREATE POLICY "Allow read access to practical_levels" ON "public"."practical_levels" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow select for all (dev only)" ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "Create submissions" ON "public"."submissions" FOR INSERT WITH CHECK (("student_id" = "auth"."uid"()));



CREATE POLICY "Faculty can view and manage assignments" ON "public"."student_practicals" USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."uid" = "auth"."uid"()) AND ("users"."role" = ANY (ARRAY['faculty'::"text", 'admin'::"text"]))))));



CREATE POLICY "Insert notifications" ON "public"."notifications" FOR INSERT WITH CHECK (("public"."is_admin"() OR "public"."is_faculty"() OR ("user_id" = "auth"."uid"())));



CREATE POLICY "Manage announcements" ON "public"."announcements" USING (("public"."is_admin"() OR "public"."is_faculty"()));



CREATE POLICY "Manage grades" ON "public"."grades" USING (("public"."is_admin"() OR "public"."is_faculty"()));



CREATE POLICY "Manage practical levels" ON "public"."practical_levels" USING (("public"."is_admin"() OR "public"."is_faculty"()));



CREATE POLICY "Manage practicals" ON "public"."practicals" USING (("public"."is_admin"() OR "public"."is_faculty"()));



CREATE POLICY "Manage reference codes" ON "public"."reference_codes" USING (("public"."is_admin"() OR "public"."is_faculty"()));



CREATE POLICY "Manage student practicals" ON "public"."student_practicals" USING (("public"."is_admin"() OR "public"."is_faculty"()));



CREATE POLICY "Manage subjects" ON "public"."subjects" USING (("public"."is_admin"() OR "public"."is_faculty"()));



CREATE POLICY "Manage test case results" ON "public"."test_case_results" USING (((EXISTS ( SELECT 1
   FROM "public"."submissions" "s"
  WHERE (("s"."id" = "test_case_results"."submission_id") AND ("s"."student_id" = "auth"."uid"())))) OR "public"."is_admin"() OR "public"."is_faculty"()));



CREATE POLICY "Manage test cases" ON "public"."test_cases" USING (("public"."is_admin"() OR "public"."is_faculty"()));



CREATE POLICY "Service can insert notifications" ON "public"."notifications" FOR INSERT WITH CHECK (true);



CREATE POLICY "Students can view their own assignments" ON "public"."student_practicals" FOR SELECT USING (("auth"."uid"() = "student_id"));



CREATE POLICY "Update own notifications" ON "public"."notifications" FOR UPDATE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Update submissions" ON "public"."submissions" FOR UPDATE USING ((("student_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_faculty"()));



CREATE POLICY "Users are viewable by everyone" ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "Users can delete their own profile" ON "public"."users" FOR DELETE USING (("auth"."uid"() = "uid"));



CREATE POLICY "Users can insert their own profile" ON "public"."users" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "uid"));



CREATE POLICY "Users can insert their own row" ON "public"."users" FOR INSERT WITH CHECK (("auth"."uid"() = "uid"));



CREATE POLICY "Users can read their own profile" ON "public"."users" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "uid"));



CREATE POLICY "Users can select their own row" ON "public"."users" FOR SELECT USING (("auth"."uid"() = "uid"));



CREATE POLICY "Users can update own notifications" ON "public"."notifications" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update own profile" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "uid"));



CREATE POLICY "Users can update their own profile" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "uid"));



CREATE POLICY "Users can update their own row" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "uid"));



CREATE POLICY "Users can update their own session" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "uid")) WITH CHECK (("auth"."uid"() = "uid"));



CREATE POLICY "Users can view own notifications" ON "public"."notifications" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own profile" ON "public"."users" FOR SELECT USING (("auth"."uid"() = "uid"));



CREATE POLICY "View announcements" ON "public"."announcements" FOR SELECT USING ((("target_role" = 'all'::"text") OR ("target_role" = "public"."current_user_role"())));



CREATE POLICY "View grades" ON "public"."grades" FOR SELECT USING ((("student_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_faculty"()));



CREATE POLICY "View own notifications" ON "public"."notifications" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "View practical levels" ON "public"."practical_levels" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "View practicals" ON "public"."practicals" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "View reference codes" ON "public"."reference_codes" FOR SELECT USING (("public"."is_admin"() OR "public"."is_faculty"()));



CREATE POLICY "View student practicals" ON "public"."student_practicals" FOR SELECT USING ((("student_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_faculty"()));



CREATE POLICY "View subjects" ON "public"."subjects" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



CREATE POLICY "View submissions" ON "public"."submissions" FOR SELECT USING ((("student_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_faculty"()));



CREATE POLICY "View test case results" ON "public"."test_case_results" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."submissions" "s"
  WHERE (("s"."id" = "test_case_results"."submission_id") AND (("s"."student_id" = "auth"."uid"()) OR "public"."is_admin"() OR "public"."is_faculty"())))));



CREATE POLICY "View test cases" ON "public"."test_cases" FOR SELECT USING (("auth"."role"() = 'authenticated'::"text"));



ALTER TABLE "public"."announcements" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."grades" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."practical_levels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."practicals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reference_codes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_practicals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subjects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."submissions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."test_case_results" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."test_cases" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notifications";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" character varying, "p_title" character varying, "p_message" "text", "p_link" character varying, "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" character varying, "p_title" character varying, "p_message" "text", "p_link" character varying, "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_notification"("p_user_id" "uuid", "p_type" character varying, "p_title" character varying, "p_message" "text", "p_link" character varying, "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_submission_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_submission_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_submission_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_faculty"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_faculty"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_faculty"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_student"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_student"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_student"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prevent_submission_if_locked"() TO "anon";
GRANT ALL ON FUNCTION "public"."prevent_submission_if_locked"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prevent_submission_if_locked"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_practical_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_practical_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_practical_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_timestamp"() TO "service_role";


















GRANT ALL ON TABLE "public"."announcements" TO "anon";
GRANT ALL ON TABLE "public"."announcements" TO "authenticated";
GRANT ALL ON TABLE "public"."announcements" TO "service_role";



GRANT ALL ON SEQUENCE "public"."announcements_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."announcements_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."announcements_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."audit_logs" TO "anon";
GRANT ALL ON TABLE "public"."audit_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."audit_logs" TO "service_role";



GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."audit_logs_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."faculty_availability" TO "anon";
GRANT ALL ON TABLE "public"."faculty_availability" TO "authenticated";
GRANT ALL ON TABLE "public"."faculty_availability" TO "service_role";



GRANT ALL ON TABLE "public"."practicals" TO "anon";
GRANT ALL ON TABLE "public"."practicals" TO "authenticated";
GRANT ALL ON TABLE "public"."practicals" TO "service_role";



GRANT ALL ON TABLE "public"."submissions" TO "anon";
GRANT ALL ON TABLE "public"."submissions" TO "authenticated";
GRANT ALL ON TABLE "public"."submissions" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."faculty_submissions_view" TO "anon";
GRANT ALL ON TABLE "public"."faculty_submissions_view" TO "authenticated";
GRANT ALL ON TABLE "public"."faculty_submissions_view" TO "service_role";



GRANT ALL ON TABLE "public"."grades" TO "anon";
GRANT ALL ON TABLE "public"."grades" TO "authenticated";
GRANT ALL ON TABLE "public"."grades" TO "service_role";



GRANT ALL ON SEQUENCE "public"."grades_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."grades_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."grades_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."holidays" TO "anon";
GRANT ALL ON TABLE "public"."holidays" TO "authenticated";
GRANT ALL ON TABLE "public"."holidays" TO "service_role";



GRANT ALL ON TABLE "public"."notifications" TO "anon";
GRANT ALL ON TABLE "public"."notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."notifications" TO "service_role";



GRANT ALL ON TABLE "public"."practical_levels" TO "anon";
GRANT ALL ON TABLE "public"."practical_levels" TO "authenticated";
GRANT ALL ON TABLE "public"."practical_levels" TO "service_role";



GRANT ALL ON SEQUENCE "public"."practical_levels_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."practical_levels_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."practical_levels_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."practicals_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."practicals_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."practicals_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."reference_codes" TO "anon";
GRANT ALL ON TABLE "public"."reference_codes" TO "authenticated";
GRANT ALL ON TABLE "public"."reference_codes" TO "service_role";



GRANT ALL ON SEQUENCE "public"."reference_codes_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."reference_codes_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."reference_codes_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."schedule_allocations" TO "anon";
GRANT ALL ON TABLE "public"."schedule_allocations" TO "authenticated";
GRANT ALL ON TABLE "public"."schedule_allocations" TO "service_role";



GRANT ALL ON TABLE "public"."schedules" TO "anon";
GRANT ALL ON TABLE "public"."schedules" TO "authenticated";
GRANT ALL ON TABLE "public"."schedules" TO "service_role";



GRANT ALL ON TABLE "public"."student_practicals" TO "anon";
GRANT ALL ON TABLE "public"."student_practicals" TO "authenticated";
GRANT ALL ON TABLE "public"."student_practicals" TO "service_role";



GRANT ALL ON SEQUENCE "public"."student_practicals_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."student_practicals_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."student_practicals_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."subjects" TO "anon";
GRANT ALL ON TABLE "public"."subjects" TO "authenticated";
GRANT ALL ON TABLE "public"."subjects" TO "service_role";



GRANT ALL ON SEQUENCE "public"."subjects_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."subjects_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."subjects_id_seq" TO "service_role";



GRANT ALL ON SEQUENCE "public"."submissions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."submissions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."submissions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."test_case_results" TO "anon";
GRANT ALL ON TABLE "public"."test_case_results" TO "authenticated";
GRANT ALL ON TABLE "public"."test_case_results" TO "service_role";



GRANT ALL ON SEQUENCE "public"."test_case_results_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."test_case_results_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."test_case_results_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."test_cases" TO "anon";
GRANT ALL ON TABLE "public"."test_cases" TO "authenticated";
GRANT ALL ON TABLE "public"."test_cases" TO "service_role";



GRANT ALL ON SEQUENCE "public"."test_cases_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."test_cases_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."test_cases_id_seq" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































