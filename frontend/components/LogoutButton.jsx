"use client";
import { useLogout } from "@/hooks/useLogout";

export default function LogoutButton() {
  const { logout } = useLogout();

  const handleLogout = async () => {
    await logout();
  };

  return (
    <button
      onClick={handleLogout}
      className="bg-red-500 text-white px-4 py-2 rounded"
    >
      Logout
    </button>
  );
}
