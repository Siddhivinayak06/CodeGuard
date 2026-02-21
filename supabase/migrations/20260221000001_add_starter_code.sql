-- Add starter_code to reference_codes to support pre-filling the student IDE
ALTER TABLE "public"."reference_codes" ADD COLUMN "starter_code" text;
