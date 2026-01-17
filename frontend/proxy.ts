import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { Database } from "@/lib/supabase/database.types"

/* -------------------------------------------------------------------------- */
/*                                CONFIGURATION                               */
/* -------------------------------------------------------------------------- */

const PUBLIC_ROUTES = ["/", "/auth/", "/api/", "/unauthorized"]

const PROTECTED_ROOTS = ["/dashboard", "/admin", "/faculty", "/student", "/profile", "/Interactive"]

const AUTH_REDIRECT = "/auth/login"

const ROUTE_POLICIES: Record<string, string[]> = {
  "/dashboard/admin": ["admin"],
  "/admin": ["admin"],
  "/dashboard/faculty": ["faculty"],
  "/faculty": ["faculty"],
  "/dashboard/student": ["student"],
  "/student": ["student"],
}

/* -------------------------------------------------------------------------- */
/*                                PURE HELPERS                                */
/* -------------------------------------------------------------------------- */

const isPublicRoute = (pathname: string) =>
  PUBLIC_ROUTES.some((route) => pathname === route || pathname.startsWith(route))

const isProtectedRoute = (pathname: string) =>
  PROTECTED_ROOTS.some((root) => pathname.startsWith(root))

const getInitialResponse = (request: NextRequest) =>
  NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

const redirect = (request: NextRequest, path: string, params?: Record<string, string>) => {
  const url = new URL(path, request.url)
  if (params) {
    Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))
  }
  return NextResponse.redirect(url)
}

/* -------------------------------------------------------------------------- */
/*                               PROXY LOGIC                                  */
/* -------------------------------------------------------------------------- */

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  let response = getInitialResponse(request)

  /* 1. Fast Path: Public Routes */
  if (isPublicRoute(pathname)) {
    return response
  }

  /* 2. Environment Hardening */
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV === "production") {
      console.error("[Proxy] CRITICAL: Supabase environment variables missing in production")
      throw new Error("Supabase environment variables missing")
    }
    console.warn("[Proxy] Supabase environment variables missing")
    return response
  }

  /* 3. Initialize Supabase Client (Edge-Compatible) */
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

  /* 4. Auth Enforcement (Zero-Trust) */
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    if (isProtectedRoute(pathname)) {
      console.info("[AUTH_BLOCKED] Unauthenticated access attempt", {
        path: pathname,
        ip: request.headers.get("x-forwarded-for") || "unknown"
      })
      return redirect(request, AUTH_REDIRECT, { redirect: pathname })
    }
    return response
  }

  /* 5. Role-Based Access Control (Enterprise Policy) */
  // Fetch user role (prefer app_metadata for Edge performance if available)
  const role = user.app_metadata?.role || user.user_metadata?.role || await (async () => {
    const { data } = await supabase.from("users").select("role").eq("uid", user.id).single()
    return data?.role
  })()

  // Match current path against policies
  for (const [routePrefix, allowedRoles] of Object.entries(ROUTE_POLICIES)) {
    if (pathname.startsWith(routePrefix)) {
      if (!role || !allowedRoles.includes(role)) {
        console.warn("[AUTH_BLOCKED] Unauthorized role", { path: pathname, role, required: allowedRoles })
        return redirect(request, "/unauthorized")
      }
      break // Match found and authorized
    }
  }

  console.debug("[AUTH_GRANTED]", { path: pathname, userId: user.id, role })
  return response
}

/* -------------------------------------------------------------------------- */
/*                                   MATCHER                                   */
/* -------------------------------------------------------------------------- */

export const config = {
  matcher: [
    /*
     * Exclude static files, images, and non-app routes
     */
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
