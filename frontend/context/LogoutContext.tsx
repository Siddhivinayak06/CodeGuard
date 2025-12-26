"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
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

    const triggerLogout = async () => {
        setIsLoggingOut(true);

        // Minimum animation duration (e.g., 1.5s) to ensure the user sees the exit effect
        const minDelay = new Promise((resolve) => setTimeout(resolve, 1500));

        // Perform actual logout logic
        const logoutPromise = supabase.auth.signOut();

        await Promise.all([logoutPromise, minDelay]);

        router.push("/auth/login");

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
