"use client";
import { useEffect, useState, useRef } from "react";

/**
 * @param {{ active?: boolean; maxViolations?: number; storageKey?: string | null }} options
 */
export default function useProctoring({
  active = true,
  maxViolations = 3,
  storageKey = null,
} = {}) {
  const readStoredViolations = () => {
    if (typeof window === "undefined" || !storageKey) return 0;
    const raw = window.localStorage.getItem(storageKey);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  };

  const [violations, setViolations] = useState(readStoredViolations);
  const [locked, setLocked] = useState(false);
  const resizeTimeout = useRef(null);
  const lastViolationTime = useRef(0);
  const isGracePeriod = useRef(false);

  const persistViolations = (count) => {
    if (typeof window === "undefined" || !storageKey) return;
    window.localStorage.setItem(storageKey, String(Math.max(0, count)));
  };

  useEffect(() => {
    const restored = readStoredViolations();
    setViolations(restored);
    setLocked(restored >= maxViolations);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, maxViolations]);

  useEffect(() => {
    setLocked(violations >= maxViolations);
  }, [violations, maxViolations]);

  useEffect(() => {
    if (!active) return;

    // Start grace period (e.g. 5 seconds) to allow fullscreen transition
    isGracePeriod.current = true;
    const graceTimeout = setTimeout(() => {
      isGracePeriod.current = false;
      console.log("Proctoring Guard: Grace period ended, monitoring active.");
    }, 5000);

    const handleViolation = (reason) => {
      if (isGracePeriod.current) return; // Ignore during grace period

      const now = Date.now();
      if (now - lastViolationTime.current < 1000) return; // Ignore duplicates (1s throttle)
      lastViolationTime.current = now;

      console.warn(`Proctoring violation detected: ${reason}`);

      setViolations((prev) => {
        const newCount = prev + 1;
        persistViolations(newCount);
        if (newCount >= maxViolations) setLocked(true);
        return newCount;
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) handleViolation("Tab Switch / Hidden");
    };

    const handleBlur = () => {
      handleViolation("Window Blur");
    };

    const handleResize = () => {
      if (resizeTimeout.current) return;
      resizeTimeout.current = setTimeout(() => {
        resizeTimeout.current = null;
      }, 1000);

      // Only count resize if we are NOT in fullscreen (optional check, but safer to just count it if significant)
      // Check if document is fullscreen, if so, resize is likely valid (or expected)
      if (!document.fullscreenElement) {
        handleViolation("Window Resize");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("resize", handleResize);

    return () => {
      clearTimeout(graceTimeout);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("resize", handleResize);
      if (resizeTimeout.current) clearTimeout(resizeTimeout.current);
    };
  }, [active, maxViolations]);

  const resetViolations = () => {
    setViolations(0);
    setLocked(false);
    if (typeof window !== "undefined" && storageKey) {
      window.localStorage.removeItem(storageKey);
    }
  };

  return { violations, locked, resetViolations };
}
