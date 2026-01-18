"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import crypto from "crypto";

export async function login(formData: FormData) {
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const supabase = await createClient();

    const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        return { error: error.message };
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
        return { error: "User not found after login." };
    }

    // ENFORCE SINGLE SESSION
    const sessionId = crypto.randomUUID();

    // 1. Update DB with new session ID
    const { error: dbError } = await supabase
        .from("users")
        .update({
            active_session_id: sessionId,
            session_updated_at: new Date().toISOString()
        })
        .eq("uid", user.id);

    if (dbError) {
        console.error("Failed to update active session", dbError);
    }

    // 2. Set 'device_session_id' cookie
    const cookieStore = await cookies();
    cookieStore.set("device_session_id", sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7 // 1 week
    });

    const role = user.user_metadata?.role;
    const normalizedRole = role?.toLowerCase();

    let target = "/dashboard/student";
    if (normalizedRole === "admin") target = "/dashboard/admin";
    else if (normalizedRole === "faculty") target = "/dashboard/faculty";

    return { success: true, redirectUrl: target };
}
