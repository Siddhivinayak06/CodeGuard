"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { ModeToggle } from "@/components/ModeToggle";
import NotificationPanel from "@/components/NotificationPanel";
import {
    ChevronDown,
    CalendarDays,
    FileCheck,
    LogOut,
    LayoutDashboard,
    Menu,
    X,
    BookOpen,
    Users,
    Code,
    FileText,
    Sparkles,
    User as UserIcon,
    BarChart3,
} from "lucide-react";
import { motion } from "framer-motion";

// Get initials from name
const getInitials = (name: string) => {
    if (!name) return "U";
    return name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase();
};

// Role badge colors
const roleBadgeStyles: Record<string, string> = {
    admin: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
    faculty: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800",
    student: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
};

export default function Navbar() {
    const pathname = usePathname();
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);

    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<string>("student");
    const [menuOpen, setMenuOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [userName, setUserName] = useState<string>("");
    const [scrolled, setScrolled] = useState(false);
    const [userMenuOpen, setUserMenuOpen] = useState(false);

    // Scroll detection for glass effect
    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    useEffect(() => {
        const fetchUser = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();

            if (!user) return;

            setUser(user);
            const userRole = user.user_metadata?.role || "student";
            setRole(userRole);

            // Fetch name from public.users table
            const { data: userProfile } = await supabase
                .from("users")
                .select("name")
                .eq("uid", user.id)
                .single();

            if (userProfile?.name) {
                setUserName(userProfile.name);
            }
        };

        fetchUser();
    }, [supabase]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/auth/login");
    };

    // Role-based links with icons
    const links =
        role === "faculty"
            ? [
                { name: "Dashboard", href: "/dashboard/faculty", icon: <LayoutDashboard size={18} /> },
                { name: "Subjects", href: "/faculty/subjects", icon: <BookOpen size={18} /> },
                { name: "Submissions", href: "/faculty/submissions", icon: <FileCheck size={18} /> },
            ]
            : role === "admin"
                ? [
                    { name: "Dashboard", href: "/dashboard/admin", icon: <LayoutDashboard size={18} /> },
                    { name: "Subjects", href: "/admin/subjects", icon: <BookOpen size={18} /> },
                    { name: "Users", href: "/admin/users", icon: <Users size={18} /> },
                    { name: "Analytics", href: "/admin/analytics", icon: <BarChart3 size={18} /> },
                ]
                : [
                    { name: "Dashboard", href: "/dashboard/student", icon: <LayoutDashboard size={18} /> },
                    { name: "Practicals", href: "/student/practicals", icon: <FileText size={18} /> },
                    { name: "Submissions", href: "/student/submissions", icon: <FileCheck size={18} /> },
                    { name: "Compiler", href: "/Interactive", icon: <Code size={18} /> },
                ];

    return (
        <>
            <nav
                className={`fixed top-0 left-0 w-full z-50 transition-all duration-500 ${scrolled
                    ? "bg-white/80 dark:bg-gray-900/80 backdrop-blur-2xl shadow-lg shadow-gray-900/5 dark:shadow-black/20 border-b border-gray-200/50 dark:border-gray-800/50"
                    : "bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl border-b border-white/20 dark:border-white/5"
                    }`}
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        {/* Logo with animated icon */}
                        <div
                            onClick={() => router.push("/")}
                            className="flex items-center gap-3 cursor-pointer group"
                        >
                            <div className="relative flex items-center">
                                <Image
                                    src="/CodeGuard_Logo.png"
                                    alt="CodeGuard Logo"
                                    width={140}
                                    height={40}
                                    className="h-13 w-auto object-contain"
                                    priority
                                />
                            </div>
                        </div>

                        {/* Desktop Navigation */}
                        <div className="hidden md:flex items-center gap-2">
                            {/* Quick Actions Dropdown for Faculty */}
                            {role === "faculty" && (
                                <div className="relative mr-2">
                                    <button
                                        onClick={() => setMenuOpen(!menuOpen)}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-gradient-to-r from-purple-500/10 to-pink-500/10 dark:from-purple-500/20 dark:to-pink-500/20 border border-purple-500/20 dark:border-purple-500/30 text-purple-700 dark:text-purple-300 hover:from-purple-500/20 hover:to-pink-500/20 transition-all duration-300"
                                    >
                                        <Sparkles size={16} className="text-purple-500" />
                                        Quick Actions
                                        <ChevronDown
                                            size={16}
                                            className={`transition-transform duration-300 ${menuOpen ? "rotate-180" : ""}`}
                                        />
                                    </button>

                                    {menuOpen && (
                                        <>
                                            <div
                                                className="fixed inset-0 z-40"
                                                onClick={() => setMenuOpen(false)}
                                            />
                                            <div className="absolute top-full mt-2 right-0 z-50 w-56 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden animate-scaleIn origin-top-right">
                                                <div className="p-2">
                                                    <button
                                                        onClick={() => {
                                                            setMenuOpen(false);
                                                            router.push("/faculty/schedule");
                                                        }}
                                                        className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all group"
                                                    >
                                                        <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 group-hover:scale-110 transition-transform">
                                                            <CalendarDays size={16} />
                                                        </div>
                                                        <span>Schedule Practical</span>
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setMenuOpen(false);
                                                            router.push("/faculty/submissions");
                                                        }}
                                                        className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-all group"
                                                    >
                                                        <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform">
                                                            <FileCheck size={16} />
                                                        </div>
                                                        <span>Review Submissions</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* Navigation Links with animated indicator */}
                            <div className="flex items-center bg-gray-100/60 dark:bg-gray-800/60 rounded-2xl p-1.5">
                                {links.map((link) => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        className={`relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 ${pathname === link.href
                                            ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-md"
                                            : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                                            }`}
                                    >
                                        <span
                                            className={`transition-colors ${pathname === link.href
                                                ? "text-purple-600 dark:text-purple-400"
                                                : "text-gray-400 dark:text-gray-500"
                                                }`}
                                        >
                                            {link.icon}
                                        </span>
                                        <span className="hidden lg:inline">{link.name}</span>
                                    </Link>
                                ))}
                            </div>

                            {/* Right Section */}
                            <div className="flex items-center gap-2 ml-4">
                                {/* Mode Toggle */}
                                <ModeToggle />

                                {/* Notifications */}
                                <NotificationPanel />

                                {/* User Menu */}
                                {user ? (
                                    <div className="relative">
                                        <motion.button
                                            onClick={() => setUserMenuOpen(!userMenuOpen)}
                                            whileHover="hover"
                                            className="flex items-center gap-3 pl-3 pr-4 py-1.5 rounded-2xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all border border-transparent hover:border-indigo-500/30 group"
                                        >
                                            {/* Avatar with floating and hover effects */}
                                            <motion.div
                                                variants={{
                                                    hover: {
                                                        scale: 1.1,
                                                        rotateY: 15,
                                                        rotateX: -10,
                                                        boxShadow: "0 0 20px rgba(99, 102, 241, 0.6)",
                                                        transition: { type: "spring", stiffness: 400, damping: 10 }
                                                    }
                                                }}
                                                animate={{
                                                    y: [0, -4, 0],
                                                }}
                                                transition={{
                                                    duration: 4,
                                                    repeat: Infinity,
                                                    ease: "easeInOut"
                                                }}
                                                className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold shadow-lg relative z-10"
                                            >
                                                {getInitials(userName)}
                                                {/* Soft pulse glow behind avatar */}
                                                <motion.div
                                                    className="absolute inset-0 rounded-xl bg-indigo-500/20 -z-10"
                                                    animate={{
                                                        scale: [1, 1.4, 1],
                                                        opacity: [0.5, 0, 0.5],
                                                    }}
                                                    transition={{
                                                        duration: 2,
                                                        repeat: Infinity,
                                                        ease: "easeInOut"
                                                    }}
                                                />
                                            </motion.div>
                                            <div className="hidden lg:flex flex-col items-start">
                                                <span className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                                                    {userName || "User"}
                                                </span>
                                                <span
                                                    className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold capitalize border ${roleBadgeStyles[role] || roleBadgeStyles.student}`}
                                                >
                                                    {role}
                                                </span>
                                            </div>
                                            <ChevronDown
                                                size={14}
                                                className={`text-gray-400 transition-transform duration-300 ${userMenuOpen ? "rotate-180" : ""}`}
                                            />
                                        </motion.button>

                                        {/* User Dropdown */}
                                        {userMenuOpen && (
                                            <>
                                                <div
                                                    className="fixed inset-0 z-40"
                                                    onClick={() => setUserMenuOpen(false)}
                                                />
                                                <div className="absolute top-full mt-2 right-0 z-50 w-56 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden animate-scaleIn origin-top-right">
                                                    <div className="p-3 border-b border-gray-100 dark:border-gray-800">
                                                        <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                                            {userName || "User"}
                                                        </p>
                                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                                            {user.email}
                                                        </p>
                                                    </div>
                                                    <div className="p-2">
                                                        <button
                                                            onClick={() => {
                                                                setUserMenuOpen(false);
                                                                router.push("/profile");
                                                            }}
                                                            className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
                                                        >
                                                            <UserIcon size={16} />
                                                            Profile
                                                        </button>
                                                        <button
                                                            onClick={() => {
                                                                setUserMenuOpen(false);
                                                                handleLogout();
                                                            }}
                                                            className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                                        >
                                                            <LogOut size={16} />
                                                            Sign Out
                                                        </button>
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => router.push("/auth/login")}
                                        className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 transition-all duration-300 shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:-translate-y-0.5"
                                    >
                                        Login
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Mobile menu button */}
                        <button
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="md:hidden p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        >
                            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                        </button>
                    </div>
                </div>
            </nav>

            {/* Mobile Navigation - Slide in (OUTSIDE nav for proper z-index) */}
            <div
                className={`md:hidden fixed inset-x-0 top-16 bottom-0 z-[110] transition-all duration-300 ${mobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                    }`}
            >
                {/* Backdrop */}
                <div
                    className={`absolute inset-0 bg-black/20 backdrop-blur-sm transition-opacity ${mobileMenuOpen ? "opacity-100" : "opacity-0"
                        }`}
                    onClick={() => setMobileMenuOpen(false)}
                />

                {/* Menu Panel */}
                <div
                    className={`absolute top-0 right-0 w-80 max-w-[85vw] h-full bg-white dark:bg-gray-900 shadow-2xl transition-transform duration-300 ${mobileMenuOpen ? "translate-x-0" : "translate-x-full"
                        }`}
                >
                    <div className="flex flex-col h-full overflow-y-auto">
                        {/* User Info at Top */}
                        {user && (
                            <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white text-lg font-bold shadow-lg">
                                        {getInitials(userName)}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-gray-900 dark:text-white">
                                            {userName || "User"}
                                        </p>
                                        <span
                                            className={`inline-block text-[10px] px-2 py-0.5 rounded-md font-semibold capitalize border mt-1 ${roleBadgeStyles[role] || roleBadgeStyles.student}`}
                                        >
                                            {role}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Quick Actions for Faculty */}
                        {role === "faculty" && (
                            <div className="p-4 border-b border-gray-100 dark:border-gray-800">
                                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                                    Quick Actions
                                </p>
                                <div className="space-y-2">
                                    <button
                                        onClick={() => {
                                            setMobileMenuOpen(false);
                                            router.push("/faculty/schedule");
                                        }}
                                        className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all"
                                    >
                                        <CalendarDays size={18} />
                                        Schedule Practical
                                    </button>
                                    <button
                                        onClick={() => {
                                            setMobileMenuOpen(false);
                                            router.push("/faculty/submissions");
                                        }}
                                        className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-all"
                                    >
                                        <FileCheck size={18} />
                                        Review Submissions
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Navigation Links */}
                        <div className="flex-1 p-4">
                            <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                                Navigation
                            </p>
                            <div className="space-y-1">
                                {links.map((link) => (
                                    <Link
                                        key={link.href}
                                        href={link.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={`flex items-center gap-3 px-4 py-3.5 text-sm font-medium rounded-xl transition-all ${pathname === link.href
                                            ? "bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800"
                                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                                            }`}
                                    >
                                        <span
                                            className={
                                                pathname === link.href
                                                    ? "text-purple-600 dark:text-purple-400"
                                                    : "text-gray-400"
                                            }
                                        >
                                            {link.icon}
                                        </span>
                                        {link.name}
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Bottom Actions */}
                        <div className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-3">
                            <div className="flex items-center justify-between px-2">
                                <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    Theme
                                </span>
                                <ModeToggle />
                            </div>

                            {user && (
                                <>
                                    <button
                                        onClick={() => {
                                            setMobileMenuOpen(false);
                                            router.push("/profile");
                                        }}
                                        className="flex w-full items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                                    >
                                        <UserIcon size={18} />
                                        Profile
                                    </button>
                                    <button
                                        onClick={() => {
                                            setMobileMenuOpen(false);
                                            handleLogout();
                                        }}
                                        className="flex w-full items-center justify-center gap-2 px-4 py-3.5 text-sm font-semibold rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
                                    >
                                        <LogOut size={18} />
                                        Sign Out
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}