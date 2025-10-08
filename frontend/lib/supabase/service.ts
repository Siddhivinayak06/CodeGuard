// lib/supabase/service.ts
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const supabaseAdmin = createSupabaseClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // use your Supabase Service Role Key
  { auth: { persistSession: false } }
);
