"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "../../libs/api";   // ✅ centralized axios
import { useAuth } from "@/context/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  const { login } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post("/auth/login", { email, password }); // ✅ cleaner
      login(res.data.user);
      localStorage.setItem("token", res.data.token);
      router.push("/");
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
    }
  };

  return (
   <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
  <form
    onSubmit={handleLogin}
    className="p-8 w-96 rounded-2xl shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
  >
    {/* Logo */}
    <div className="flex justify-center mb-6">
      <img
        src= "/fcrit-logo.jpg"  // <-- replace with your logo path
        alt="App Logo"
        className="h-30 w-30 object-contain"
      />
    </div>

    <h1 className="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-gray-100">
      Welcome Back
    </h1>

    {error && (
      <p className="mb-4 text-sm text-red-600 bg-red-100 dark:bg-red-900/30 px-3 py-2 rounded-md">
        {error}
      </p>
    )}

    <input
      type="email"
      placeholder="Email"
      className="w-full mb-3 p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
    />

    <input
      type="password"
      placeholder="Password"
      className="w-full mb-5 p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
    />

    <button
      className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 dark:hover:bg-blue-500 transition duration-200 shadow-md"
    >
      Login
    </button>
  </form>
</div>

  );
}
