import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { Database } from "@/lib/supabase/database.types"

/* -------------------------------------------------------------------------- */
/*                                CONFIGURATION                               */
/* -------------------------------------------------------------------------- */

const PUBLIC_ROUTES = [
  "/",
  "/auth/",
  "/api/",
  "/unauthorized",
]

const AUTH_REDIRECT = "/auth/login"

/* -------------------------------------------------------------------------- */
/*                               PROXY LOGIC                                  */
/* -------------------------------------------------------------------------- */

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const { pathname } = request.nextUrl

  /* ------------------------------------------------------------------------ */
  /*                               PUBLIC ROUTES                               */
  /* ------------------------------------------------------------------------ */

  if (PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route))) {
    return response
  }

  /* ------------------------------------------------------------------------ */
  /*                              ENV VALIDATION                               */
  /* ------------------------------------------------------------------------ */

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Proxy] Supabase environment variables missing")
    }
    return response
  }

  /* ------------------------------------------------------------------------ */
  /*                          SUPABASE SERVER CLIENT                           */
  /* ------------------------------------------------------------------------ */

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, {
            ...options,
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 2, // 2 hours
          })
        })
      },
    },
  })

  /* ------------------------------------------------------------------------ */
  /* ⚠️ CRITICAL: DO NOT INSERT LOGIC BETWEEN CLIENT & getUser()                */
  /* ------------------------------------------------------------------------ */

  const {
    data: { user },
  } = await supabase.auth.getUser()

  /* ------------------------------------------------------------------------ */
  /*                             AUTH ENFORCEMENT                              */
  /* ------------------------------------------------------------------------ */

  if (!user) {
    const redirectUrl = new URL(AUTH_REDIRECT, request.url)
    redirectUrl.searchParams.set("redirect", pathname)

    return NextResponse.redirect(redirectUrl)
  }

  /* ------------------------------------------------------------------------ */
  /*                          ROLE-BASED ACCESS CONTROL                        */
  /* ------------------------------------------------------------------------ */

  // Fetch user role from 'users' table
  const { data: dbUser } = await supabase
    .from("users")
    .select("role")
    .eq("uid", user.id)
    .single()

  const role = dbUser?.role || user?.user_metadata?.role

  if (pathname.startsWith("/dashboard/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/unauthorized", request.url))
  }

  if (pathname.startsWith("/dashboard/faculty") && role !== "faculty") {
    return NextResponse.redirect(new URL("/unauthorized", request.url))
  }

  if (pathname.startsWith("/dashboard/student") && role !== "student") {
    return NextResponse.redirect(new URL("/unauthorized", request.url))
  }

  return response
}

/* -------------------------------------------------------------------------- */
/*                                   MATCHER                                   */
/* -------------------------------------------------------------------------- */

export const config = {
  matcher: [
    /*
     * Exclude static files & API routes
     */
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
