"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { ModeToggle } from "@/components/ModeToggle";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string>("student"); // default role

  // ✅ Fetch user + role from Supabase
  useEffect(() => {
    const fetchUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setUser(user);
      // role is stored in user_metadata.role in Supabase
      const userRole = user.user_metadata?.role || "student";
      setRole(userRole);
    };

    fetchUser();
  }, [supabase]);

  // ✅ Handle Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/auth/login");
  };

  // ✅ Role-Based Navigation Links
  const links =
    role === "admin"
      ? [
          { name: "Dashboard", href: "/dashboard/admin" },
          { name: "Subjects", href: "/admin/subjects" },
          { name: "Users", href: "/admin/users" },
        ]
      : role === "faculty"
      ? [
          { name: "Dashboard", href: "/dashboard/faculty" },
          { name: "Subjects", href: "/faculty/subjects" },
          { name: "Submissions", href: "/faculty/submissions" },
        ]
      : [
          { name: "Dashboard", href: "/dashboard/student" },
          { name: "Practicals", href: "/student/practicals" },
          { name: "Submissions", href: "/student/submissions" },
        ];

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-white/30 dark:bg-gray-900/30 backdrop-blur-md border-b border-white/20 dark:border-gray-700/20 px-8 py-4 flex items-center justify-between shadow-lg">
      {/* Logo / Brand */}
      <h1
        onClick={() => router.push("/")}
        className="text-xl font-extrabold bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent cursor-pointer"
      >
        CodeGuard
      </h1>

      {/* Links */}
      <div className="flex items-center gap-6">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`relative text-sm font-medium transition duration-300 ${
              pathname === link.href
                ? "text-blue-600 dark:text-blue-400"
                : "text-gray-700 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400"
            }`}
          >
            {link.name}
            <span
              className={`absolute left-0 -bottom-1 h-[2px] w-full rounded-full transition-all duration-300 ${
                pathname === link.href
                  ? "bg-blue-500 scale-x-100"
                  : "bg-blue-500 scale-x-0 hover:scale-x-100"
              }`}
            />
          </Link>
        ))}

        {/* Mode Toggle */}
        <ModeToggle />

        {/* User + Logout */}
        {user ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700 dark:text-gray-300 hidden md:inline">
              {user.email}
            </span>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
            >
              Logout
            </button>
          </div>
        ) : (
          <button
            onClick={() => router.push("/auth/login")}
            className="px-3 py-1.5 text-sm font-medium rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
          >
            Login
          </button>
        )}
      </div>
    </nav>
  );
}
