"use client";
import { useRouter } from "next/navigation";
import api from "@/lib/api";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    await api.post("/auth/logout");
    router.push("/login");
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
