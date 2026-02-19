"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { v4 as uuidv4 } from "uuid";

const POLL_INTERVAL = 30000; // 30 seconds

interface SessionState {
  isValid: boolean;
  isInvalidated: boolean;
  sessionId: string | null;
}

interface UseSessionValidatorOptions {
  onSessionInvalidated?: () => Promise<void>; // Called before logout (e.g., auto-submit)
  enabled?: boolean;
  userId?: string | null;
}

export function useSessionValidator(options: UseSessionValidatorOptions = {}) {
  const { onSessionInvalidated, enabled = true, userId } = options;
  const [sessionState, setSessionState] = useState<SessionState>({
    isValid: true,
    isInvalidated: false,
    sessionId: null,
  });
  const [showInvalidModal, setShowInvalidModal] = useState(false);
  const supabase = useMemo(() => createClient(), []);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isHandlingInvalidation = useRef(false);
  const logoutTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Get stored session ID
  const getStoredSessionId = useCallback(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("cg_session_id");
    }
    return null;
  }, []);

  // Store session ID (localStorage + cookie for middleware)
  const storeSessionId = useCallback((sessionId: string) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("cg_session_id", sessionId);
      // Also set as cookie so middleware can read it for single-session enforcement
      document.cookie = `device_session_id=${sessionId}; path=/; max-age=${60 * 60 * 24}; SameSite=Lax`;
    }
  }, []);

  // Clear session ID (localStorage + cookie)
  const clearSessionId = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("cg_session_id");
      // Clear the cookie by setting max-age=0
      document.cookie = "device_session_id=; path=/; max-age=0; SameSite=Lax";
    }
  }, []);

  const isRegisteringRef = useRef(false);

  // Register a new session on login (directly via Supabase)
  const registerSession = useCallback(
    async (uid: string): Promise<string | null> => {
      if (isRegisteringRef.current) return null; // Prevent double registration
      isRegisteringRef.current = true;

      try {
        const sessionId = uuidv4();

        // Update user's active_session_id in database FIRST
        const { error } = await supabase
          .from("users")
          .update({
            active_session_id: sessionId,
            session_updated_at: new Date().toISOString(),
          })
          .eq("uid", uid);

        if (error) {
          console.error(
            "Failed to register session. Full Error:",
            JSON.stringify(error, null, 2),
          );
          if (error.code === "42703") {
            console.error(
              'CRITICAL: The "active_session_id" column is missing in the "users" table. Please run the SQL migration.',
            );
          }
          isRegisteringRef.current = false;
          return null;
        }

        // Store locally ONLY after DB update succeeds (prevents localStorage/DB mismatch race)
        storeSessionId(sessionId);

        setSessionState((prev) => ({ ...prev, sessionId, isValid: true }));
        console.log("Session registered:", sessionId);
        isRegisteringRef.current = false;
        return sessionId;
      } catch (error) {
        console.error("Session registration error:", error);
        isRegisteringRef.current = false;
        return null;
      }
    },
    [supabase, storeSessionId],
  );

  // Verify current session (directly via Supabase)
  const verifySession = useCallback(async (): Promise<boolean> => {
    if (!userId) return true;
    // Skip verification if currently registering a new session (avoid race condition)
    if (isRegisteringRef.current) return true;

    try {
      const sessionId = getStoredSessionId();

      // If no local session ID exists, skip client-side enforcement.
      // The server-side middleware handles session enforcement via httpOnly cookies.
      // Missing localStorage just means registerSession was never called from client.
      if (!sessionId) return true;

      const { data, error } = await supabase
        .from("users")
        .select("active_session_id")
        .eq("uid", userId)
        .single();

      if (error) {
        console.error("Session verification error:", error);
        return true; // Default to valid on error (fail open to prevent lockout)
      }

      // If DB has an active session and local has one too, they must match
      if (data.active_session_id && data.active_session_id !== sessionId) {
        return false; // Mismatch -> Invalid (real multi-device case)
      }

      return true;
    } catch (error) {
      console.error("Session verification error:", error);
      return true; // Default to valid on error
    }
  }, [userId, supabase, getStoredSessionId]); // Removed registerSession dependency

  const enabledRef = useRef(enabled);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  // Store the latest callback in a ref to avoid dependency cycles
  const callbackRef = useRef(onSessionInvalidated);

  // Update the ref whenever the callback changes
  useEffect(() => {
    callbackRef.current = onSessionInvalidated;
  }, [onSessionInvalidated]);

  // Handle session invalidation
  const handleSessionInvalidated = useCallback(async () => {
    // Check if validation is still enabled
    if (isHandlingInvalidation.current || !enabledRef.current) return;
    isHandlingInvalidation.current = true;

    console.warn("Session invalidated - another login detected");
    setSessionState((prev) => ({
      ...prev,
      isValid: false,
      isInvalidated: true,
    }));
    setShowInvalidModal(true);

    // Stop polling
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    // Call the invalidation callback (e.g., auto-submit) via ref
    if (callbackRef.current) {
      try {
        await callbackRef.current();
      } catch (error) {
        console.error("Error during invalidation callback:", error);
      }
    }

    // Check availability again after async operation - preventing race condition
    if (!enabledRef.current) return;

    // Clear session and sign out after a delay
    logoutTimeoutRef.current = setTimeout(async () => {
      // Final check before logging out
      if (!enabledRef.current) return;

      clearSessionId();
      await supabase.auth.signOut();
      // Use window.location for hard redirect to ensure state clear
      window.location.href = "/auth/login?reason=session_invalidated";
    }, 3000);
  }, [clearSessionId, supabase]); // Removed onSessionInvalidated dependency

  // Cleanup timeout on unmount OR when disabled
  useEffect(() => {
    return () => {
      if (logoutTimeoutRef.current) {
        clearTimeout(logoutTimeoutRef.current);
        logoutTimeoutRef.current = null;
      }
    };
  }, []); // Run on unmount

  // Cleanup when disabled
  useEffect(() => {
    if (!enabled && logoutTimeoutRef.current) {
      clearTimeout(logoutTimeoutRef.current);
      logoutTimeoutRef.current = null;
    }
  }, [enabled]);

  // Polling effect
  useEffect(() => {
    if (!enabled || !userId) return;

    const poll = async () => {
      // Double-check enabled state before polling (in case it changed during async gap)
      if (!enabledRef.current) return;
      const isValid = await verifySession();
      if (!isValid && enabledRef.current) {
        handleSessionInvalidated();
      }
    };

    // Delay initial check to give registerSession time to complete
    const initialDelay = setTimeout(poll, 5000);

    // Start periodic polling
    pollingRef.current = setInterval(poll, POLL_INTERVAL);

    return () => {
      clearTimeout(initialDelay);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [enabled, userId, verifySession, handleSessionInvalidated]);

  // Invalidate session on logout
  const invalidateSession = useCallback(async () => {
    if (!userId) return;

    try {
      await supabase
        .from("users")
        .update({ active_session_id: null })
        .eq("uid", userId);

      clearSessionId();
    } catch (error) {
      console.error("Session invalidation error:", error);
    }
  }, [userId, supabase, clearSessionId]);

  // Dismiss modal
  const dismissModal = useCallback(() => {
    setShowInvalidModal(false);
  }, []);

  return {
    ...sessionState,
    showInvalidModal,
    registerSession,
    verifySession,
    invalidateSession,
    dismissModal,
    clearSessionId,
  };
}
