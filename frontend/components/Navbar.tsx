"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { ModeToggle } from "@/components/ModeToggle";
import { ChevronDown, CalendarDays, FileCheck, LogOut, LayoutDashboard } from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string>("student");
  const [menuOpen, setMenuOpen] = useState(false);

  // ✅ Fetch user + role
  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setUser(user);
      const userRole = user.user_metadata?.role || "student";
      setRole(userRole);
    };
    fetchUser();
  }, [supabase]);

  // ✅ Handle logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  // ✅ Role-based links
  const links =
    role === "faculty"
      ? [
          { name: "Dashboard", href: "/dashboard/faculty", icon: <LayoutDashboard size={16} /> },
          { name: "Subjects", href: "/faculty/subjects", icon: <FileCheck size={16} /> },
          { name: "Submissions", href: "/faculty/submissions", icon: <FileCheck size={16} /> },
        ]
      : role === "admin"
      ? [
          { name: "Dashboard", href: "/dashboard/admin" },
          { name: "Subjects", href: "/admin/subjects" },
          { name: "Users", href: "/admin/users" },
        ]
      : [
          { name: "Dashboard", href: "/dashboard/student" },
          { name: "Practicals", href: "/student/practicals" },
          { name: "Submissions", href: "/student/submissions" },
          { name: "Compiler", href: "/Interactive" },
        ];

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-white/30 dark:bg-gray-900/30 backdrop-blur-md border-b border-white/20 dark:border-gray-700/20 px-8 py-3 flex items-center justify-between shadow-lg">
      {/* Logo */}
      <h1
        onClick={() => router.push("/")}
        className="text-xl font-extrabold bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent cursor-pointer select-none"
      >
        CodeGuard
      </h1>

      {/* Navigation links */}
      <div className="flex items-center gap-6 relative">
        {role === "faculty" && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="flex items-center gap-1 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 transition-all"
            >
              Quick Actions <ChevronDown size={16} className={`transition-transform ${menuOpen ? "rotate-180" : ""}`} />
            </button>
            {menuOpen && (
              <div className="absolute top-8 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 w-52 border border-gray-100 dark:border-gray-700 animate-in fade-in slide-in-from-top-1">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/faculty/schedule");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                  <CalendarDays size={16} />
                  Schedule Practical
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/faculty/submissions");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                  <FileCheck size={16} />
                  Review Submissions
                </button>
              </div>
            )}
          </div>
        )}

        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`relative flex items-center gap-1 text-sm font-medium transition-all duration-300 px-2 py-1 rounded-md ${
              pathname === link.href
                ? "bg-blue-100/60 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
                : "text-gray-700 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-gray-100/50 dark:hover:bg-gray-800/40"
            }`}
          >
            {link.icon}
            {link.name}
          </Link>
        ))}

        <ModeToggle />

        {/* User Info + Logout */}
        {user ? (
          <div className="flex items-center gap-3 ml-2">
            <span className="hidden md:inline text-sm text-gray-600 dark:text-gray-300">
              {user.email?.split("@")[0]}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1 px-3 py-1.5 text-sm font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 transition-all"
            >
              <LogOut size={15} />
              Logout
            </button>
          </div>
        ) : (
          <button
            onClick={() => router.push("/auth/login")}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition"
          >
            Login
          </button>
        )}
      </div>
    </nav>
  );
}
