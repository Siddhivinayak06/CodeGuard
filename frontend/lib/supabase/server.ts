import { createServerClient } from "@supabase/ssr";
import { Database } from "./database.types";
import { cookies } from "next/headers";

/**
 * Creates a new Supabase client for each server request.
 * This ensures proper session handling and avoids cross-request leakage.
 */
export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing Supabase environment variables. Please check your .env file."
    );
  }

  return createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              // Let Supabase handle the correct maxAge for refresh/access tokens
              cookieStore.set(name, value, options),
            );
          } catch {
            // Safe to ignore if called from a Server Component.
            // Ensure you have middleware.ts refreshing the user session!
          }
        },
      },
    },
  );
}
