import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/dashboard";

    if (code) {
        const supabase = await createClient();
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            // Get the authenticated user
            const { data: { user }, error: userError } = await supabase.auth.getUser();

            if (userError || !user) {
                return NextResponse.redirect(`${origin}/auth/login?error=AuthError`);
            }

            // Check if user exists in the users table (pre-registered by admin)
            const { data: existingUser, error: checkError } = await supabase
                .from("users")
                .select("uid, role")
                .eq("uid", user.id)
                .single();

            if (checkError || !existingUser) {
                // User is NOT registered in the system - deny access
                // Sign them out first to clear the session
                await supabase.auth.signOut();

                return NextResponse.redirect(
                    `${origin}/auth/login?error=UserNotRegistered`
                );
            }

            // User exists - redirect to appropriate dashboard based on role
            const role = (existingUser as any).role?.toLowerCase();
            let redirectPath = "/dashboard/student";
            if (role === "admin") redirectPath = "/dashboard/admin";
            else if (role === "faculty") redirectPath = "/dashboard/faculty";

            return NextResponse.redirect(`${origin}${redirectPath}`);
        }
    }

    // Return the user to an error page with instructions
    return NextResponse.redirect(`${origin}/auth/login?error=AuthCodeError`);
}
