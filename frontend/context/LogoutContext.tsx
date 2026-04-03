"use client";

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface LogoutContextType {
  isLoggingOut: boolean;
  triggerLogout: () => Promise<void>;
}

const LogoutContext = createContext<LogoutContextType | undefined>(undefined);

export function LogoutProvider({ children }: { children: ReactNode }) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  // Reset loading state when path changes (e.g. after successful redirect to login)
  useEffect(() => {
    setIsLoggingOut(false);
  }, [pathname]);

  const clearClientSessionArtifacts = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("cg_session_id");
      document.cookie = "device_session_id=; path=/; max-age=0; SameSite=Lax";
    }
  };

  const triggerLogout = async () => {
    setIsLoggingOut(true);

    // Minimum animation duration (e.g., 1.5s) to ensure the user sees the exit effect
    const minDelay = new Promise((resolve) => setTimeout(resolve, 1500));

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        await supabase
          .from("users")
          .update({
            active_session_id: null,
            session_updated_at: new Date().toISOString(),
          } as never)
          .eq("uid", user.id);
      }
    } catch (error) {
      console.warn("Failed to clear active session during logout:", error);
    }

    clearClientSessionArtifacts();

    const logoutPromise = supabase.auth.signOut();
    await Promise.all([logoutPromise, minDelay]);

    router.push("/auth/login?reset=1");

    // Optional: Reset state after navigation (though component might unmount)
    // setIsLoggingOut(false);
  };

  return (
    <LogoutContext.Provider value={{ isLoggingOut, triggerLogout }}>
      {children}
    </LogoutContext.Provider>
  );
}

export function useLogoutContext() {
  const context = useContext(LogoutContext);
  if (context === undefined) {
    throw new Error("useLogoutContext must be used within a LogoutProvider");
  }
  return context;
}
