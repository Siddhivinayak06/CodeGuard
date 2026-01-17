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
    { cookies: { get: (key) => request.cookies.get(key)?.value } },
  );

  // Step 3: Fetch user + role
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Public routes (no restriction)
  // Check for public routes or if the path starts with /auth, /api, or /unauthorized
  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/unauthorized");

  if (isPublicRoute) return response;

  // Require login for anything else
  if (!user) return NextResponse.redirect(new URL("/auth/login", request.url));

  // Step 4: Get user role from Supabase DB (stored in 'users' table, not 'profiles')
  const { data: dbUser } = await supabase
    .from("users")
    .select("role")
    .eq("uid", user.id)
    .single();

  // Fallback to user_metadata if db role is missing
  const role = dbUser?.role || user?.user_metadata?.role;

  console.log("Middleware Debug:", {
    path: pathname,
    userId: user?.id,
    role: role,
    source: dbUser?.role ? "db_users_table" : "user_metadata_fallback",
    redirectingToUnauthorized:
      (pathname.startsWith("/dashboard/admin") && role !== "admin") ||
      (pathname.startsWith("/dashboard/faculty") && role !== "faculty") ||
      (pathname.startsWith("/dashboard/student") && role !== "student"),
  });

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
