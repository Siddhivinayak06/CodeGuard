"use client";
import { useEffect, useState, useRef } from "react";

export default function useProctoring({ active = true, maxViolations = 3 } = {}) {
  const [violations, setViolations] = useState(0);
  const [locked, setLocked] = useState(false);
  const resizeTimeout = useRef(null);
  const lastViolationTime = useRef(0);
  const isGracePeriod = useRef(false);

  useEffect(() => {
    if (!active) return;

    // Start grace period (e.g. 3 seconds) to allow fullscreen transition
    isGracePeriod.current = true;
    const graceTimeout = setTimeout(() => {
      isGracePeriod.current = false;
      console.log("Proctoring Guard: Grace period ended, monitoring active.");
    }, 3000);

    const handleViolation = (reason) => {
      if (isGracePeriod.current) return; // Ignore during grace period

      const now = Date.now();
      if (now - lastViolationTime.current < 1000) return; // Ignore duplicates (1s throttle)
      lastViolationTime.current = now;

      console.warn(`Proctoring violation detected: ${reason}`);

      setViolations((prev) => {
        const newCount = prev + 1;
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

  return { violations, locked };
}
