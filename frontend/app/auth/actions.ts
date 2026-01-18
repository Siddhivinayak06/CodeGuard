"use server";

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

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

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: "User not found after login." };
    }

    const role = user.user_metadata?.role;
    const normalizedRole = role?.toLowerCase();

    let target = "/dashboard/student";
    if (normalizedRole === "admin") target = "/dashboard/admin";
    else if (normalizedRole === "faculty") target = "/dashboard/faculty";

    return { success: true, redirectUrl: target };
}
