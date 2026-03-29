import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const { email, password } = await request.json();

        if (!email || !password) {
            return NextResponse.json(
                { error: "Email and password are required." },
                { status: 400 }
            );
        }

        console.log("[LOGIN] Starting login attempt...");
        console.log("[LOGIN] SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "SET" : "MISSING");

        const supabase = await createClient();

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            console.error("[LOGIN] Auth error:", error.message);
            return NextResponse.json({ error: error.message }, { status: 401 });
        }

        console.log("[LOGIN] Sign in successful. Getting user...");
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error("[LOGIN] User fetch error:", authError?.message);
            return NextResponse.json(
                { error: "User not found after login." },
                { status: 401 }
            );
        }

        console.log("[LOGIN] User found:", user.id.slice(0, 8));

        // ENFORCE SINGLE SESSION
        const sessionId = crypto.randomUUID();

        const { error: dbError } = await supabase
            .from("users")
            .update({
                active_session_id: sessionId,
                session_updated_at: new Date().toISOString()
            } as never)
            .eq("uid", user.id);

        if (dbError) {
            console.error("[LOGIN] Failed to update active session", dbError);
        }

        // Set cookie
        const cookieStore = await cookies();
        cookieStore.set("device_session_id", sessionId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24 * 7,
        });

        const role = user.user_metadata?.role;
        const normalizedRole = role?.toLowerCase();

        let redirectUrl = "/dashboard/student";
        if (normalizedRole === "admin") redirectUrl = "/dashboard/admin";
        else if (normalizedRole === "faculty") redirectUrl = "/dashboard/faculty";

        console.log("[LOGIN] Success! Redirecting to:", redirectUrl);
        return NextResponse.json({ success: true, redirectUrl });
    } catch (err) {
        console.error("[LOGIN] CRITICAL CRASH:", err);
        return NextResponse.json(
            { error: "Internal server error during login." },
            { status: 500 }
        );
    }
}
