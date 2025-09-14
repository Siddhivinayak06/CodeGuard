// app/page.jsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
      router.push("/login");
    }, 2000); // ⏳ 2 sec loading then redirect

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500">
      {loading && (
        <div className="flex flex-col items-center gap-4 text-white">
          {/* Spinner */}
          <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
          <h1 className="text-2xl font-bold">CodeGuard</h1>
          <p className="text-sm opacity-80">Loading your workspace...</p>
        </div>
      )}
    </main>
  );
}
