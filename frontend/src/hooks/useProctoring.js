"use client"
import { useEffect, useState } from "react";

export default function useProctoring(maxViolations = 3) {
  const [violations, setViolations] = useState(0);
  const [locked, setLocked] = useState(false);

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

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("blur", handleBlur);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("blur", handleBlur);
    };
  }, [maxViolations]);

  return { violations, locked };
}
