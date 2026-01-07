"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { v4 as uuidv4 } from 'uuid';

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
    const supabase = createClient();
    const pollingRef = useRef<NodeJS.Timeout | null>(null);
    const isHandlingInvalidation = useRef(false);

    // Get stored session ID
    const getStoredSessionId = useCallback(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('cg_session_id');
        }
        return null;
    }, []);

    // Store session ID
    const storeSessionId = useCallback((sessionId: string) => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('cg_session_id', sessionId);
        }
    }, []);

    // Clear session ID
    const clearSessionId = useCallback(() => {
        if (typeof window !== 'undefined') {
            localStorage.removeItem('cg_session_id');
        }
    }, []);

    const isRegisteringRef = useRef(false);

    // Register a new session on login (directly via Supabase)
    const registerSession = useCallback(async (uid: string): Promise<string | null> => {
        if (isRegisteringRef.current) return null; // Prevent double registration
        isRegisteringRef.current = true;

        try {
            const sessionId = uuidv4();

            // Clear old session immediately to avoid race with polling
            storeSessionId(sessionId);

            // Update user's active_session_id in database
            const { error } = await supabase
                .from('users')
                .update({
                    active_session_id: sessionId,
                    session_updated_at: new Date().toISOString()
                })
                .eq('uid', uid);

            if (error) {
                console.error('Failed to register session. Full Error:', JSON.stringify(error, null, 2));
                // Check if it's a column missing error
                if (error.code === '42703') { // Postgres code for undefined column
                    console.error('CRITICAL: The "active_session_id" column is missing in the "users" table. Please run the SQL migration.');
                }
                isRegisteringRef.current = false;
                return null;
            }

            setSessionState(prev => ({ ...prev, sessionId, isValid: true }));
            console.log('Session registered:', sessionId);
            isRegisteringRef.current = false;
            return sessionId;
        } catch (error) {
            console.error('Session registration error:', error);
            isRegisteringRef.current = false;
            return null;
        }
    }, [supabase, storeSessionId]);

    // Verify current session (directly via Supabase)
    const verifySession = useCallback(async (): Promise<boolean> => {
        if (!userId) return true;
        // Skip verification if currently registering a new session (avoid race condition)
        if (isRegisteringRef.current) return true;

        try {
            const sessionId = getStoredSessionId();

            const { data, error } = await supabase
                .from('users')
                .select('active_session_id')
                .eq('uid', userId)
                .single();

            if (error) {
                console.error('Session verification error:', error);
                return true; // Default to valid on error (fail open to prevent lockout)
            }

            // If DB has an active session, local must match it
            if (data.active_session_id) {
                if (!sessionId) return false; // DB has session, local doesn't -> Invalid
                if (data.active_session_id !== sessionId) return false; // Mismatch -> Invalid
            }
            // If DB has no active session, we consider it valid (or should we?)
            // Usually means user logged out elsewhere or first login.

            return true;
        } catch (error) {
            console.error('Session verification error:', error);
            return true; // Default to valid on error
        }
    }, [userId, supabase, getStoredSessionId]); // Removed registerSession dependency

    // Handle session invalidation
    const handleSessionInvalidated = useCallback(async () => {
        if (isHandlingInvalidation.current) return;
        isHandlingInvalidation.current = true;

        console.warn('Session invalidated - another login detected');
        setSessionState(prev => ({ ...prev, isValid: false, isInvalidated: true }));
        setShowInvalidModal(true);

        // Stop polling
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }

        // Call the invalidation callback (e.g., auto-submit)
        if (onSessionInvalidated) {
            try {
                await onSessionInvalidated();
            } catch (error) {
                console.error('Error during invalidation callback:', error);
            }
        }

        // Clear session and sign out after a delay
        setTimeout(async () => {
            clearSessionId();
            await supabase.auth.signOut();
            // Use window.location for hard redirect to ensure state clear
            window.location.href = '/auth/login?reason=session_invalidated';
        }, 3000);
    }, [onSessionInvalidated, clearSessionId, supabase]);

    // Polling effect
    useEffect(() => {
        if (!enabled || !userId) return;

        const poll = async () => {
            const isValid = await verifySession();
            if (!isValid) {
                handleSessionInvalidated();
            }
        };

        // Initial check
        poll();

        // Start polling
        pollingRef.current = setInterval(poll, POLL_INTERVAL);

        return () => {
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
                .from('users')
                .update({ active_session_id: null })
                .eq('uid', userId);

            clearSessionId();
        } catch (error) {
            console.error('Session invalidation error:', error);
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
