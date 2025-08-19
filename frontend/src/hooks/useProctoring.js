"use client";
import { useEffect, useState, useRef } from "react";

export default function useProctoring(maxViolations = 3) {
  const [violations, setViolations] = useState(0);
  const [locked, setLocked] = useState(false);
  const resizeTimeout = useRef(null);

  useEffect(() => {
    const handleViolation = () => {
      setViolations((prev) => {
        const newCount = prev + 1;
        if (newCount >= maxViolations) {
          setLocked(true);
        }
        return newCount;
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) handleViolation();
    };

    const handleBlur = () => {
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
