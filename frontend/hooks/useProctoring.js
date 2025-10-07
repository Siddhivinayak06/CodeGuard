"use client";
import { useEffect, useState, useRef } from "react";

export default function useProctoring(maxViolations = 3) {
  const [violations, setViolations] = useState(0);
  const [locked, setLocked] = useState(false);
  const resizeTimeout = useRef(null);
  const lastViolationTime = useRef(0);

  const ignoreInitialBlur = useRef(true); // ✅ Ignore blur right after login

  useEffect(() => {
    const handleViolation = () => {
      const now = Date.now();
      if (now - lastViolationTime.current < 500) return; // Ignore duplicates
      lastViolationTime.current = now;

      setViolations((prev) => {
        const newCount = prev + 1;
        if (newCount >= maxViolations) setLocked(true);
        return newCount;
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) handleViolation();
    };

    const handleBlur = () => {
      // ✅ Ignore first blur caused by browser prompts
      if (ignoreInitialBlur.current) {
        ignoreInitialBlur.current = false;
        return;
      }
      handleViolation();
    };

    const handleResize = () => {
      if (resizeTimeout.current) return;
      resizeTimeout.current = setTimeout(() => {
        resizeTimeout.current = null;
      }, 1000);
      handleViolation();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("resize", handleResize);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("resize", handleResize);
      if (resizeTimeout.current) clearTimeout(resizeTimeout.current);
    };
  }, [maxViolations]);

  return { violations, locked };
}
