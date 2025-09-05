"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const router = useRouter();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    if (!name || !email || !password || !confirm) {
      setError("All fields are required");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("http://localhost:5000/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Registration failed");
      }

      alert("Registration successful! Please login.");
      router.push("/login");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <form
        onSubmit={handleRegister}
        className="p-8 w-96 rounded-2xl shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
      >
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-gray-100">
          Create an Account
        </h1>

        {error && (
          <p className="mb-4 text-sm text-red-600 bg-red-100 dark:bg-red-900/30 px-3 py-2 rounded-md">
            {error}
          </p>
        )}

        <label className="block mb-1 text-gray-700 dark:text-gray-300">Full name</label>
        <input
          type="text"
          placeholder="Your name"
          className="w-full mb-3 p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label className="block mb-1 text-gray-700 dark:text-gray-300">Email</label>
        <input
          type="email"
          placeholder="you@example.com"
          className="w-full mb-3 p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="block mb-1 text-gray-700 dark:text-gray-300">Password</label>
        <input
          type="password"
          placeholder="Password"
          className="w-full mb-3 p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <label className="block mb-1 text-gray-700 dark:text-gray-300">Confirm password</label>
        <input
          type="password"
          placeholder="Confirm password"
          className="w-full mb-5 p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        <button
          type="submit"
          className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 dark:hover:bg-blue-500 transition duration-200 shadow-md disabled:opacity-60"
          disabled={submitting}
        >
          {submitting ? "Creating account..." : "Register"}
        </button>

        <p className="mt-4 text-sm text-center text-gray-600 dark:text-gray-400">
          Already have an account?{" "}
          <a href="/login" className="text-blue-600 dark:text-blue-400 hover:underline">
            Login
          </a>
        </p>
      </form>
    </div>
  );
}
