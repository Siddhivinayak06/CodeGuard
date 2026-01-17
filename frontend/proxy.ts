import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { Database } from "@/lib/supabase/database.types"

/**
 * 🔒 TRUST BOUNDARY:
 * - This Proxy is a network-level boundary.
 * - Middleware does NOT protect APIs — all /api routes must self-verify.
 * - Trusts ONLY JWT claims (no DB queries in Edge context).
 * - Never rely on middleware for primary data access security.
 * - Stateless, deterministic, and Edge-compliant.
 */

/* -------------------------------------------------------------------------- */
/*                                CONFIGURATION                               */
/* -------------------------------------------------------------------------- */

const PUBLIC_ROUTES = ["/", "/auth", "/unauthorized", "/maintenance", "/lockdown"]

const PROTECTED_ROOTS = ["/dashboard", "/admin", "/faculty", "/student", "/profile", "/Interactive"]

const AUTH_REDIRECT = "/auth/login"

// Ordered by specificity (longest paths first) to prevent prefix shadowing
const ROUTE_POLICIES = [
  { prefix: "/dashboard/admin", roles: ["admin"] },
  { prefix: "/dashboard/faculty", roles: ["faculty"] },
  { prefix: "/dashboard/student", roles: ["student"] },
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/faculty", roles: ["faculty"] },
  { prefix: "/student", roles: ["student"] },
]

/* -------------------------------------------------------------------------- */
/*                                PURE HELPERS                                */
/* -------------------------------------------------------------------------- */

const isPublicRoute = (path: string) =>
  PUBLIC_ROUTES.some((route) => path === route || path.startsWith(route))

const isProtectedRoute = (path: string) =>
  PROTECTED_ROOTS.some((root) => path.startsWith(root))

const getInitialResponse = () => NextResponse.next()

// Strategic logging
const logAction = process.env.NODE_ENV === "production" ? console.warn : console.info

/**
 * 🔐 Controlled Redirect Safety
 * Sanitizes and validates internal redirect paths (Defense-in-Depth).
 */
const safeRedirect = (request: NextRequest, path: string, params?: Record<string, string>) => {
  if (params?.redirect) {
    // Length + Structural Protection
    if (
      params.redirect.length > 2048 ||
      params.redirect.includes("//") ||
      !params.redirect.startsWith("/")
    ) {
      console.warn("[SECURITY] Blocked suspicious redirect attempt", { untrusted: params.redirect })
      params.redirect = "/dashboard"
    }
  }

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
  /* 1. Normalization & Security Hardening */
  const rawPath = request.nextUrl.pathname
  let pathname = rawPath

  try {
    pathname = decodeURIComponent(rawPath).toLowerCase()
  } catch {
    console.warn("[SECURITY] Malformed URL encoding blocked", { rawPath })
    return safeRedirect(request, "/unauthorized")
  }

  // Canonicalize path (remove trailing slashes)
  pathname = pathname.replace(/\/+$/, "") || "/"

  // Enforce Canonical Case/Structure
  if (rawPath !== pathname && !isPublicRoute(pathname)) {
    return safeRedirect(request, pathname)
  }

  let response = getInitialResponse()

  /* 2. 🚨 Emergency Lockdown Hooks */
  if (process.env.AUTH_LOCKDOWN === "true" && pathname !== "/lockdown") {
    return safeRedirect(request, "/lockdown")
  }

  if (process.env.FEATURE_FREEZE === "true" && pathname.startsWith("/dashboard")) {
    return safeRedirect(request, "/maintenance")
  }

  /* 3. Public Fast-Path */
  if (isPublicRoute(pathname)) {
    return response
  }

  /* 4. Environment Hardening */
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV === "production") {
      console.error("[Proxy] CRITICAL: Environment variables missing")
      throw new Error("Supabase credentials missing")
    }
    return response
  }

  /* 5. Client Initialization (Edge Optimized) */
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
            maxAge: 60 * 60 * 2, // 2h
          })
        })
      },
    },
  })

  /* 6. JWT Auth Verification (Stateless) */
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      if (isProtectedRoute(pathname)) {
        logAction("[AUTH_BLOCKED] Unauthenticated attempt", {
          path: pathname,
          ip: request.headers.get("x-forwarded-for") || "unknown"
        })
        return safeRedirect(request, AUTH_REDIRECT, { redirect: pathname })
      }
      return response
    }

    /* 7. RBAC via JWT Claims (No DB Queries) */
    const role = (user.app_metadata?.role as string) || (user.user_metadata?.role as string)

    /**
     * Future ABAC Attributes Hook:
     * - department: user.app_metadata.department
     * - tenant_id: user.app_metadata.org_id
     */

    // Find first matching policy (specificity sorted)
    const matchingPolicy = ROUTE_POLICIES.find(p => pathname.startsWith(p.prefix))

    // 🛡️ Safety Net: Deny if protected area has no mapped policy
    if (isProtectedRoute(pathname) && !matchingPolicy) {
      console.error("[SECURITY] Protected route missing specific policy", { pathname })
      return safeRedirect(request, "/unauthorized")
    }

    // Role Enforcement
    if (matchingPolicy) {
      if (!role || !matchingPolicy.roles.includes(role)) {
        logAction("[AUTH_BLOCKED] Unauthorized role", {
          path: pathname,
          userId: user.id,
          role,
          required: matchingPolicy.roles
        })
        return safeRedirect(request, "/unauthorized")
      }
    }

    return response

  } catch (error) {
    /* 🛡️ Graceful Degradation */
    console.error("[Proxy] CRITICAL: Auth logic failure", { error, path: pathname })
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
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
