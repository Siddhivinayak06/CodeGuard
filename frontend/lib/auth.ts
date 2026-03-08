import { NextResponse } from "next/server";
import { SupabaseClient } from "@supabase/supabase-js";

type AuthResult = {
    user: any;
    role: string;
    response: null;
} | {
    user: null;
    role: null;
    response: NextResponse;
};

/**
 * Require an authenticated user. Returns the user or a 401 response.
 * Usage:
 *   const { user, response: authError } = await requireAuth(supabase);
 *   if (authError) return authError;
 */
export async function requireAuth(supabase: SupabaseClient): Promise<AuthResult> {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
            return {
                user: null,
                role: null,
                response: NextResponse.json(
                    { error: "Authentication required" },
                    { status: 401 }
                ),
            };
        }

        // Determine role from metadata
        const role =
            (user.app_metadata?.role as string) ||
            (user.user_metadata?.role as string) ||
            "student";

        return { user, role, response: null };
    } catch {
        return {
            user: null,
            role: null,
            response: NextResponse.json(
                { error: "Authentication failed" },
                { status: 401 }
            ),
        };
    }
}

/**
 * Require an authenticated user with a specific role.
 * Falls back to checking the `users` table if metadata doesn't have the role.
 * Returns the user or a 401/403 response.
 *
 * Usage:
 *   const { user, response: authError } = await requireRole(supabase, ["admin"]);
 *   if (authError) return authError;
 */
export async function requireRole(
    supabase: SupabaseClient,
    allowedRoles: string[]
): Promise<AuthResult> {
    const result = await requireAuth(supabase);
    if (result.response) return result;

    let role = result.role;

    // If role from metadata is not in allowed list, double-check the users table
    if (!allowedRoles.includes(role)) {
        try {
            const { data: row, error } = await supabase
                .from("users")
                .select("role")
                .eq("uid", result.user.id)
                .limit(1)
                .maybeSingle();

            if (!error && row?.role) {
                role = row.role;
            }
        } catch {
            // Fall through to the permission check below
        }
    }

    if (!allowedRoles.includes(role)) {
        return {
            user: null,
            role: null,
            response: NextResponse.json(
                { error: "Forbidden: insufficient permissions" },
                { status: 403 }
            ),
        };
    }

    return { user: result.user, role, response: null };
}
