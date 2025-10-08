import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Creates a new Supabase client for each server request.
 * This ensures proper session handling and avoids cross-request leakage.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, { ...options, maxAge: 7200 })
            );
          } catch {
            // Safe to ignore if called from a Server Component
          }
        },
      },
    }
  );
}
