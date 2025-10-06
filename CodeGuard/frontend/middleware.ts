import { updateSession } from "@/lib/supabase/middleware";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  // Step 1: Maintain session
  const response = await updateSession(request);

  // Step 2: Create a Supabase client using the updated session
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (key) => request.cookies.get(key)?.value } }
  );

  // Step 3: Fetch user + role
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Public routes (no restriction)
  const publicRoutes = ["/", "/lauth/ogin", "/auth/register", "/api"];
  if (publicRoutes.some((r) => pathname.startsWith(r))) return response;

  // Require login for anything else
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  // Step 4: Get user role from Supabase DB (if stored in 'profiles' table)
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;

  // Step 5: Role-based access control
  if (pathname.startsWith("/dashboard/admin") && role !== "admin")
    return NextResponse.redirect(new URL("/unauthorized", request.url));

  if (pathname.startsWith("/dashboard/faculty") && role !== "faculty")
    return NextResponse.redirect(new URL("/unauthorized", request.url));

  if (pathname.startsWith("/dashboard/student") && role !== "student")
    return NextResponse.redirect(new URL("/unauthorized", request.url));

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
