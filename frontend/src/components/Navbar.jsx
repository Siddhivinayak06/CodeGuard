// components/Navbar.jsx
"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ModeToggle } from "@/components/ModeToggle";
import { useAuth } from "@/context/AuthContext";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  const links = [
    { name: "Home", href: "/" },
    { name: "Practicals", href: "/practicals" },
    { name: "Submissions", href: "/submissions" },
  ];

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-white/30 dark:bg-gray-900/30 backdrop-blur-md border-b border-white/20 dark:border-gray-700/20 px-8 py-4 flex items-center justify-between shadow-lg">
      {/* Logo / Brand */}
      <h1 className="text-xl font-extrabold bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">
        CodeGuard
      </h1>

      {/* Links + ModeToggle + Logout */}
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

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="px-3 py-1.5 text-sm font-medium rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
