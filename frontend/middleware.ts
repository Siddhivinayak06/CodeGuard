import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { Database } from "@/lib/supabase/database.types"


/* -------------------------------------------------------------------------- */
/*                                CONFIGURATION                               */
/* -------------------------------------------------------------------------- */

const PUBLIC_ROUTES = ["/unauthorized", "/maintenance", "/lockdown", "/api"]

const PROTECTED_ROOTS = ["/dashboard", "/admin", "/faculty", "/student", "/profile", "/interactive", "/notifications"]

const AUTH_REDIRECT = "/auth/login"

/**
 * 🧱 Permission Engine (ABAC Ready)
 * Roles are mapped to granular permissions. Routes check for a specific permission.
 */
const ROLE_MAP: Record<string, string[]> = {
  admin: ["access:admin", "access:profile", "access:shared"],
  faculty: ["access:faculty", "access:profile", "access:shared"],
  student: ["access:student", "access:profile", "access:interactive", "access:shared"],
}

const ROUTE_PERMISSIONS = Object.freeze([
  { prefix: "/dashboard/admin", permission: "access:admin" },
  { prefix: "/admin", permission: "access:admin" },
  { prefix: "/dashboard/faculty", permission: "access:faculty" },
  { prefix: "/faculty", permission: "access:faculty" },
  { prefix: "/dashboard/student", permission: "access:student" },
  { prefix: "/student", permission: "access:student" },
  { prefix: "/interactive", permission: "access:interactive" },
  { prefix: "/profile", permission: "access:profile" },
  { prefix: "/notifications", permission: "access:shared" },
  { prefix: "/dashboard", permission: "access:shared" },
].sort((a, b) => b.prefix.length - a.prefix.length))

/* -------------------------------------------------------------------------- */
/*                                PURE HELPERS                                */
/* -------------------------------------------------------------------------- */

const isPublicRoute = (path: string) =>
  PUBLIC_ROUTES.some((route) => path === route || path.startsWith(route + "/"))

const isProtectedRoute = (path: string) =>
  PROTECTED_ROOTS.some((root) => path === root || path.startsWith(root + "/"))

/**
 * 🔐 Controlled Redirect Safety
 * Sanitizes and validates internal redirect paths.
 */
const safeRedirect = (request: NextRequest, path: string, options: { params?: Record<string, string>, cookiesToCopy?: NextResponse['cookies'] } = {}) => {
  const { params, cookiesToCopy } = options
  if (params?.redirect) {
    if (params.redirect.length > 2048 || params.redirect.includes("//") || !params.redirect.startsWith("/")) {
      params.redirect = "/dashboard"
    }
  }
  const url = new URL(path, request.url)
  if (params) Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value))

  const response = NextResponse.redirect(url)
  if (cookiesToCopy) {
    cookiesToCopy.getAll().forEach((cookie) => response.cookies.set(cookie))
  }
  return response
}

/**
 * 🛠️ Security Header Injection (WAF-lite)
 */
const injectSecurityHeaders = (response: NextResponse) => {
  const isProd = process.env.NODE_ENV === "production"

  const csp = [
    "frame-ancestors 'none'",
    isProd ? "upgrade-insecure-requests" : ""
  ].filter(Boolean).join("; ")

  const headers = {
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Permitted-Cross-Domain-Policies": "none",
    "Content-Security-Policy": csp,
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  }
  Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value))
  return response
}

/* -------------------------------------------------------------------------- */
/*                               PROXY LOGIC                                  */
/* -------------------------------------------------------------------------- */

export async function middleware(request: NextRequest) {
  const startTime = performance.now()

  const requestId = crypto.randomUUID()

  const logSecurityEvent = (event: string, data: Record<string, any>) => {
    const log = process.env.NODE_ENV === "production" ? console.warn : console.info
    log(JSON.stringify({ type: "SECURITY_EVENT", event, requestId, ...data, timestamp: new Date().toISOString() }))
  }

  /* 1. Normalization & Sanitization */

  const rawPath = request.nextUrl.pathname
  let pathname = rawPath

  try {
    pathname = decodeURIComponent(rawPath).normalize("NFKC").toLowerCase()
  } catch {
    logSecurityEvent("MALFORMED_URL", { rawPath })
    return safeRedirect(request, "/unauthorized")
  }

  pathname = pathname.replace(/\/+$/, "") || "/"

  // Early return for assets and static files not handled by matcher
  if (pathname.includes(".")) return injectSecurityHeaders(NextResponse.next())

  /* 2. Emergency Global Hooks */
  if (process.env.AUTH_LOCKDOWN === "true" && pathname !== "/lockdown") {
    return safeRedirect(request, "/lockdown")
  }

  if (process.env.FEATURE_FREEZE === "true" && pathname.startsWith("/dashboard")) {
    return safeRedirect(request, "/maintenance")
  }

  /* 3. Fast Path Short-Circuits */
  if (isPublicRoute(pathname)) {
    const response = injectSecurityHeaders(NextResponse.next())
    response.headers.set("Server-Timing", `proxy;dur=${(performance.now() - startTime).toFixed(3)}`)
    return response
  }

  /* 4. Env Validation */
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    if (process.env.NODE_ENV === "production") {
      logSecurityEvent("CRITICAL_ENV_MISSING", { env: "SUPABASE" })
      throw new Error("Supabase credentials missing")
    }
    return injectSecurityHeaders(NextResponse.next())
  }

  /* 5. Supabase Initialization */
  const response = injectSecurityHeaders(NextResponse.next())
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
            maxAge: 60 * 60 * 2,
          })
        })
      },
    },
  })

  /* 6. Authentication & Authorization Enforcement */
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    // 🛡️ AUTH CHECK
    if (authError || !user) {
      if (isProtectedRoute(pathname)) {
        logSecurityEvent("AUTH_BLOCKED", { path: pathname, reason: "UNAUTHENTICATED" })
        return safeRedirect(request, AUTH_REDIRECT, { params: { redirect: pathname }, cookiesToCopy: response.cookies })
      }
      return response
    }

    // 🛡️ SINGLE SESSION ENFORCEMENT
    if (isProtectedRoute(pathname)) {
      const deviceSessionId = request.cookies.get("device_session_id")?.value;

      if (user) {
        // Fetch the active session ID from the users table
        const { data: userData, error: userError } = (await supabase
          .from("users")
          .select("active_session_id")
          .eq("uid", user.id)
          .single()) as any;

        if (!userError && userData && userData.active_session_id) {
          // Only enforce if cookie EXISTS but doesn't match (single-session protection).
          // If cookie is missing, skip enforcement — it just means user hasn't entered the editor yet.
          if (deviceSessionId && userData.active_session_id !== deviceSessionId) {
            console.warn(`[Proxy] Session Invalid: DB=${userData.active_session_id} vs Cookie=${deviceSessionId}`);
            logSecurityEvent("SESSION_INVALIDATED", { path: pathname, userId: user.id });

            const redirectRes = safeRedirect(request, AUTH_REDIRECT, { params: { error: "Session Expired. You logged in on another device." } });

            // CRITICAL: Delete BOTH the device session cookie AND the Supabase auth cookie
            redirectRes.cookies.delete("device_session_id");

            // Find and delete the auth token cookie dynamically
            const authCookie = request.cookies.getAll().find(c => c.name.includes("auth-token"));
            if (authCookie) {
              redirectRes.cookies.delete(authCookie.name);
            }

            return redirectRes;
          }
        }
      }
    }

    // 🛡️ AUTHENTICATED REDIRECTS (e.g., /auth/login -> /dashboard)
    if (pathname.startsWith("/auth") || pathname === "/") {
      const role = (user.app_metadata?.role as string) || (user.user_metadata?.role as string) || "student"
      const target = `/dashboard/${role}`
      return safeRedirect(request, target, { cookiesToCopy: response.cookies })
    }

    // 🛡️ PERMISSION CHECK (RBAC)
    if (isProtectedRoute(pathname)) {
      const role = (user.app_metadata?.role as string) || (user.user_metadata?.role as string) || "none"
      const userPermissions = ROLE_MAP[role] || []
      const matchingPolicy = ROUTE_PERMISSIONS.find(p => pathname === p.prefix || pathname.startsWith(p.prefix + "/"))

      if (!matchingPolicy) {
        logSecurityEvent("POLICY_MISSING", { path: pathname, userId: user.id.slice(0, 8) })
        return safeRedirect(request, "/unauthorized", { cookiesToCopy: response.cookies })
      }

      if (!userPermissions.includes(matchingPolicy.permission)) {
        logSecurityEvent("AUTH_BLOCKED", {
          path: pathname, reason: "PERMISSION_DENIED",
          userId: user.id.slice(0, 8), role, required: matchingPolicy.permission
        })
        return safeRedirect(request, "/unauthorized", { cookiesToCopy: response.cookies })
      }
    }

    // Add Telemetry Header
    response.headers.set("Server-Timing", `proxy;dur=${(performance.now() - startTime).toFixed(3)}`)
    return response

  } catch (error) {
    console.error("[Proxy] CRITICAL: Operation failure", { error, path: pathname, requestId })
    return process.env.NODE_ENV === "production" ? safeRedirect(request, "/maintenance") : response
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
