"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { ModeToggle } from "@/components/layout/ModeToggle";
import NotificationPanel from "@/components/layout/NotificationPanel";
import { useLogout } from "@/hooks/useLogout";
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
  User as UserIcon,
  Clock,
} from "lucide-react";

// ─── Static helpers (outside component to avoid re-creation) ─────────────────

const getInitials = (name: string) => {
  if (!name) return "U";
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
};

const roleBadgeStyles: Record<string, string> = {
  admin:
    "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800",
  faculty:
    "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800",
  student:
    "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800",
};

// Pre-defined link configs – icons are lightweight Lucide components
const FACULTY_LINKS = [
  { name: "Dashboard", href: "/dashboard/faculty", icon: LayoutDashboard },
  { name: "Subjects", href: "/faculty/subjects", icon: BookOpen },
  { name: "Practicals", href: "/dashboard/faculty/practicals", icon: FileText },
  { name: "Exams", href: "/dashboard/faculty/exams", icon: Clock },
  { name: "Submissions", href: "/faculty/submissions", icon: FileCheck },
];

const ADMIN_LINKS = [
  { name: "Dashboard", href: "/dashboard/admin", icon: LayoutDashboard },
  { name: "Yearly Schedule", href: "/admin/schedule", icon: CalendarDays },
  { name: "Subjects", href: "/admin/subjects", icon: BookOpen },
  { name: "Users", href: "/admin/users", icon: Users },
];

const STUDENT_LINKS = [
  { name: "Dashboard", href: "/dashboard/student", icon: LayoutDashboard },
  { name: "Practicals", href: "/student/practicals", icon: FileText },
  { name: "Exams", href: "/student/exams", icon: Clock },
  { name: "Submissions", href: "/student/submissions", icon: FileCheck },
  { name: "Compiler", href: "/Interactive", icon: Code },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string>("student");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const [scrolled, setScrolled] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // ── Scroll detection with passive listener for perf ──
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrolled(window.scrollY > 20);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ── Close menus on route change ──
  useEffect(() => {
    setMobileMenuOpen(false);
    setUserMenuOpen(false);
  }, [pathname]);

  // ── Fetch user once ──
  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setUser(user);
      setRole(user.user_metadata?.role || "student");

      const { data: userProfile } = await supabase
        .from("users")
        .select("name")
        .eq("uid", user.id)
        .single();

      if ((userProfile as any)?.name) {
        setUserName((userProfile as any).name);
      }
    };
    fetchUser();
  }, [supabase]);

  const { logout } = useLogout();

  // ── Memoized callbacks ──
  const handleLogout = useCallback(async () => {
    await logout();
  }, [logout]);

  const toggleUserMenu = useCallback(() => {
    setUserMenuOpen((prev) => !prev);
  }, []);

  const closeUserMenu = useCallback(() => {
    setUserMenuOpen(false);
  }, []);

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  // ── Memoized links based on role ──
  const links = useMemo(() => {
    if (role === "faculty") return FACULTY_LINKS;
    if (role === "admin") return ADMIN_LINKS;
    return STUDENT_LINKS;
  }, [role]);

  const initials = useMemo(() => getInitials(userName), [userName]);

  return (
    <>
      <nav
        className={`fixed top-0 left-0 w-full z-50 transition-all duration-300 ${
          scrolled
            ? "bg-white/85 dark:bg-gray-900/85 backdrop-blur-2xl shadow-lg shadow-gray-900/5 dark:shadow-black/20 border-b border-gray-200/60 dark:border-gray-800/60"
            : "bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl border-b border-white/20 dark:border-white/5"
        }`}
      >
        <div className="w-full px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div
              onClick={() => router.push("/")}
              className="flex items-center gap-3 cursor-pointer group shrink-0"
            >
              <div className="relative flex items-center">
                <Image
                  src="/CodeGuard_Logo.png"
                  alt="CodeGuard Logo"
                  width={140}
                  height={40}
                  className="h-13 w-auto object-contain dark:hidden"
                  priority
                />
                <Image
                  src="/CodeGuard_Dark_Logo.png"
                  alt="CodeGuard Logo"
                  width={140}
                  height={40}
                  className="hidden h-13 w-auto object-contain dark:block"
                  priority
                />
              </div>
            </div>

            {/* Desktop Navigation – visible on md+ */}
            <div className="hidden md:flex items-center gap-2 min-w-0">
              {/* Navigation pill bar */}
              <div className="flex items-center bg-gray-100/60 dark:bg-gray-800/60 rounded-2xl p-1 gap-0.5 overflow-x-auto scrollbar-hide">
                {links.map((link) => {
                  const isActive = pathname === link.href;
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`relative flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl whitespace-nowrap transition-all duration-200 ${
                        isActive
                          ? "bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-900/30"
                      }`}
                    >
                      <Icon
                        size={17}
                        className={`shrink-0 transition-colors ${
                          isActive
                            ? "text-purple-600 dark:text-purple-400"
                            : "text-gray-400 dark:text-gray-500"
                        }`}
                      />
                      <span className="hidden lg:inline">{link.name}</span>
                    </Link>
                  );
                })}
              </div>

              {/* Right Section */}
              <div className="flex items-center gap-1.5 ml-3 shrink-0">
                <ModeToggle />
                <NotificationPanel />

                {/* User Menu */}
                {user ? (
                  <div className="relative">
                    <button
                      onClick={toggleUserMenu}
                      className="flex items-center gap-2.5 pl-2.5 pr-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200/80 dark:hover:bg-gray-700/80 transition-colors border border-transparent hover:border-gray-300/50 dark:hover:border-gray-600/50"
                    >
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold shadow-sm shrink-0">
                        {initials}
                      </div>
                      <div className="hidden lg:flex flex-col items-start">
                        <span className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
                          {userName || "User"}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-md font-semibold capitalize border ${
                            roleBadgeStyles[role] || roleBadgeStyles.student
                          }`}
                        >
                          {role}
                        </span>
                      </div>
                      <ChevronDown
                        size={14}
                        className={`text-gray-400 transition-transform duration-200 ${
                          userMenuOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {/* User Dropdown */}
                    {userMenuOpen && (
                      <>
                        <div
                          className="fixed inset-0 z-40"
                          onClick={closeUserMenu}
                        />
                        <div className="absolute top-full mt-2 right-0 z-50 w-56 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="p-3 border-b border-gray-100 dark:border-gray-800">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                              {userName || "User"}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {user.email}
                            </p>
                          </div>
                          <div className="p-1.5">
                            <button
                              onClick={() => {
                                closeUserMenu();
                                router.push("/profile");
                              }}
                              className="flex w-full items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                            >
                              <UserIcon size={16} />
                              Profile
                            </button>
                            <button
                              onClick={() => {
                                closeUserMenu();
                                handleLogout();
                              }}
                              className="flex w-full items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
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

            {/* Mobile: Right icons + hamburger */}
            <div className="flex md:hidden items-center gap-2">
              <ModeToggle />
              <NotificationPanel />
              <button
                onClick={toggleMobileMenu}
                className="p-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation – slide-in panel */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-16 bottom-0 z-[110]">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={closeMobileMenu}
          />

          {/* Menu Panel */}
          <div className="absolute top-0 right-0 w-80 max-w-[85vw] h-full bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
            <div className="flex flex-col h-full overflow-y-auto">
              {/* User Info */}
              {user && (
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white text-base font-bold shadow-md shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">
                        {userName || "User"}
                      </p>
                      <span
                        className={`inline-block text-[10px] px-2 py-0.5 rounded-md font-semibold capitalize border mt-1 ${
                          roleBadgeStyles[role] || roleBadgeStyles.student
                        }`}
                      >
                        {role}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Navigation Links */}
              <div className="flex-1 p-4">
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                  Navigation
                </p>
                <div className="space-y-1">
                  {links.map((link) => {
                    const isActive = pathname === link.href;
                    const Icon = link.icon;
                    return (
                      <Link
                        key={link.href}
                        href={link.href}
                        onClick={closeMobileMenu}
                        className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-colors ${
                          isActive
                            ? "bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                        }`}
                      >
                        <Icon
                          size={18}
                          className={
                            isActive
                              ? "text-purple-600 dark:text-purple-400"
                              : "text-gray-400"
                          }
                        />
                        {link.name}
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Bottom Actions */}
              <div className="p-4 border-t border-gray-100 dark:border-gray-800 space-y-2">
                {user && (
                  <>
                    <button
                      onClick={() => {
                        closeMobileMenu();
                        router.push("/profile");
                      }}
                      className="flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    >
                      <UserIcon size={18} />
                      Profile
                    </button>
                    <button
                      onClick={() => {
                        closeMobileMenu();
                        handleLogout();
                      }}
                      className="flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
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
      )}
    </>
  );
}
