"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { ModeToggle } from "@/components/ModeToggle";
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
  Sparkles
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string>("student");
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userName, setUserName] = useState<string>("");
  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      setUser(user);
      const userRole = user.user_metadata?.role || "student";
      setRole(userRole);

      // ✅ Fetch name from public.users table
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
        ]
        : [
          { name: "Dashboard", href: "/dashboard/student", icon: <LayoutDashboard size={18} /> },
          { name: "Practicals", href: "/student/practicals", icon: <FileText size={18} /> },
          { name: "Submissions", href: "/student/submissions", icon: <FileCheck size={18} /> },
          { name: "Compiler", href: "/Interactive", icon: <Code size={18} /> },
        ];

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl border-b border-white/20 dark:border-white/5 shadow-sm transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo with animated gradient */}
          <div
            onClick={() => router.push("/")}
            className="flex items-center gap-2 cursor-pointer group"
          >
            <h1 className="text-2xl font-extrabold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent select-none hover:opacity-80 transition-opacity">
              CodeGuard
            </h1>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-3">
            {/* Quick Actions Dropdown for Faculty */}
            {role === "faculty" && (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-white/50 dark:bg-white/5 backdrop-blur-sm border border-white/20 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-white/80 dark:hover:bg-white/10 transition-all duration-300 shadow-sm hover:shadow-md"
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
                      className="fixed inset-0 z-10"
                      onClick={() => setMenuOpen(false)}
                    ></div>
                    <div className="absolute top-14 right-0 z-20 bg-white/80 dark:bg-gray-900/80 backdrop-blur-2xl rounded-2xl shadow-2xl p-2 w-60 border border-white/20 dark:border-white/10 animate-in fade-in slide-in-from-top-2 duration-300">
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          router.push("/faculty/schedule");
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl hover:bg-white/60 dark:hover:bg-white/10 transition-all duration-200 text-gray-700 dark:text-gray-300"
                      >
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                          <CalendarDays size={16} className="text-blue-600 dark:text-blue-400" />
                        </div>
                        <span>Schedule Practical</span>
                      </button>
                      <button
                        onClick={() => {
                          setMenuOpen(false);
                          router.push("/faculty/submissions");
                        }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl hover:bg-white/60 dark:hover:bg-white/10 transition-all duration-200 text-gray-700 dark:text-gray-300"
                      >
                        <div className="p-2 bg-purple-500/10 rounded-lg">
                          <FileCheck size={16} className="text-purple-600 dark:text-purple-400" />
                        </div>
                        <span>Review Submissions</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Navigation Links */}
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`relative flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-300 ${pathname === link.href
                  ? "bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-gray-200"
                  }`}
              >
                <span className={pathname === link.href ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300"}>
                  {link.icon}
                </span>
                {link.name}
              </Link>
            ))}

            {/* Mode Toggle */}
            <div className="ml-2">
              <ModeToggle />
            </div>

            {/* User Info + Logout */}
            {user ? (
              <div className="flex items-center gap-3 ml-2 pl-2 border-l border-gray-200 dark:border-gray-800">
                <div className="hidden lg:flex flex-col items-end">
                  <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                    {userName || "User"}
                  </span>
                  <span className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold">
                    {role}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-all duration-300 border border-transparent hover:border-red-200 dark:hover:border-red-900/30"
                  title="Logout"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => router.push("/auth/login")}
                className="px-6 py-2 text-sm font-medium rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:from-blue-700 hover:to-purple-700 transition-all duration-300 shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30"
              >
                Login
              </button>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl bg-white/50 dark:bg-white/5 backdrop-blur-sm border border-white/20 dark:border-white/10 text-gray-700 dark:text-gray-300"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-2xl border-b border-white/20 dark:border-white/10 shadow-2xl animate-in slide-in-from-top duration-300">
          <div className="px-4 py-6 space-y-3">
            {/* Mobile Quick Actions for Faculty */}
            {role === "faculty" && (
              <div className="space-y-2 pb-3 border-b border-gray-200 dark:border-gray-800">
                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-2">
                  Quick Actions
                </p>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    router.push("/faculty/schedule");
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                >
                  <CalendarDays size={18} className="text-blue-600 dark:text-blue-400" />
                  Schedule Practical
                </button>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    router.push("/faculty/submissions");
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
                >
                  <FileCheck size={18} className="text-purple-600 dark:text-purple-400" />
                  Review Submissions
                </button>
              </div>
            )}

            {/* Mobile Navigation Links */}
            <div className="space-y-1">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 text-sm font-medium rounded-xl transition-all ${pathname === link.href
                    ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                    : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                >
                  {link.icon}
                  {link.name}
                </Link>
              ))}
            </div>

            {/* Mobile User Section */}
            {user && (
              <div className="pt-3 border-t border-gray-200 dark:border-gray-800 space-y-3">
                <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                      {userName || "User"}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 capitalize font-medium">
                      {role}
                    </p>
                  </div>
                  <ModeToggle />
                </div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-all"
                >
                  <LogOut size={18} />
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}