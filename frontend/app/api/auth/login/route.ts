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


        const supabase = await createClient();

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {

            return NextResponse.json({ error: error.message }, { status: 401 });
        }


        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {

            return NextResponse.json(
                { error: "User not found after login." },
                { status: 401 }
            );
        }



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
            console.error("Failed to update active session", dbError);
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


        return NextResponse.json({ success: true, redirectUrl });
    } catch (err) {
        console.error("Login error:", err);
        return NextResponse.json(
            { error: "Internal server error during login." },
            { status: 500 }
        );
    }
}
