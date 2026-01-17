import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { Database } from "@/lib/supabase/database.types"

/* -------------------------------------------------------------------------- */
/*                                CONFIGURATION                               */
/* -------------------------------------------------------------------------- */

const PUBLIC_ROUTES = ["/", "/auth/", "/api/", "/unauthorized", "/maintenance", "/lockdown"]

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

/**
 * 🔐 Controlled Redirect Safety
 * Prevents Open-Redirect attacks by ensuring redirect paths are internal.
 */
const safeRedirect = (request: NextRequest, path: string, params?: Record<string, string>) => {
  let finalPath = path

  // If params has a 'redirect' key, validate it to prevent open-redirect
  if (params?.redirect && !params.redirect.startsWith("/")) {
    console.warn("[SECURITY] Blocked potential open-redirect attempt", { untrustedPath: params.redirect })
    params.redirect = "/dashboard" // Fallback to safe path
  }

  const url = new URL(finalPath, request.url)
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

  /* 1. 🚨 Emergency Lockdown (Kill-Switch) */
  if (process.env.AUTH_LOCKDOWN === "true" && pathname !== "/lockdown") {
    return safeRedirect(request, "/lockdown")
  }

  /* 2. Fast Path: Public Routes */
  if (isPublicRoute(pathname)) {
    return response
  }

  /* 3. Environment Hardening */
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV === "production") {
      console.error("[Proxy] CRITICAL: Supabase environment variables missing in production")
      throw new Error("Supabase environment variables missing")
    }
    return response
  }

  /* 4. Initialize Supabase Client (Edge-Compatible) */
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

  /* 5. 🚧 Graceful Degradation & Auth Enforcement */
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      if (isProtectedRoute(pathname)) {
        console.info("[AUTH_BLOCKED] Unauthenticated access attempt", {
          path: pathname,
          ip: request.headers.get("x-forwarded-for") || "unknown",
          ua: request.headers.get("user-agent") || "none"
        })
        return safeRedirect(request, AUTH_REDIRECT, { redirect: pathname })
      }
      return response
    }

    /* 6. Role-Based Access Control (Policies) */
    const role = user.app_metadata?.role || user.user_metadata?.role || await (async () => {
      const { data } = await supabase.from("users").select("role").eq("uid", user.id).single()
      return data?.role
    })()

    // Enforce isolation and policy
    for (const [routePrefix, allowedRoles] of Object.entries(ROUTE_POLICIES)) {
      if (pathname.startsWith(routePrefix)) {
        if (!role || !allowedRoles.includes(role)) {
          console.warn("[AUTH_BLOCKED] Unauthorized role", {
            path: pathname,
            userId: user.id,
            role,
            required: allowedRoles
          })
          return safeRedirect(request, "/unauthorized")
        }
        break
      }
    }

    // Success audit trail
    // console.debug("[AUTH_GRANTED]", { path: pathname, userId: user.id, role })
    return response

  } catch (error) {
    /* 🛡️ Graceful Failure: If Supabase is down, don't crash the Edge runtime */
    console.error("[Proxy] CRITICAL: Auth service failure", { error, path: pathname })
    if (process.env.NODE_ENV === "production") {
      return safeRedirect(request, "/maintenance")
    }
    return response
  }
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
