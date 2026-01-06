"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/layout/Navbar";

// Routes that should NOT show the navbar
const noNavbarRoutes = [
    "/auth/login",
    "/auth/register",
    "/auth/verify-email",
    "/auth/error",
    "/editor", // Full-screen editor
];

export default function NavbarLayout() {
    const pathname = usePathname();

    // Check if current route should hide navbar
    const shouldHideNavbar = noNavbarRoutes.some(
        (route) => pathname === route || pathname.startsWith(route + "/")
    );

    // Also hide on root page if it's a landing page
    if (pathname === "/") return null;

    if (shouldHideNavbar) return null;

    return <Navbar />;
}
