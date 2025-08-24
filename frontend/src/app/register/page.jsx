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

  // 🔹 real register function
  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    // client validation
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
    <div className="flex items-center justify-center min-h-screen">
      <form onSubmit={handleRegister} className="p-6 border rounded w-96">
        <h1 className="text-xl font-semibold mb-4">Create an account</h1>

        {error && <p className="mb-2 text-red-500">{error}</p>}

        <label className="block mb-1">Full name</label>
        <input
          type="text"
          placeholder="Your name"
          className="w-full mb-2 p-2 border rounded"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <label className="block mb-1">Email</label>
        <input
          type="email"
          placeholder="you@example.com"
          className="w-full mb-2 p-2 border rounded"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />

        <label className="block mb-1">Password</label>
        <input
          type="password"
          placeholder="Password"
          className="w-full mb-2 p-2 border rounded"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <label className="block mb-1">Confirm password</label>
        <input
          type="password"
          placeholder="Confirm password"
          className="w-full mb-4 p-2 border rounded"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />

        <button
          type="submit"
          className="w-full p-2 border rounded bg-blue-500 text-white disabled:opacity-60"
          disabled={submitting}
        >
          {submitting ? "Creating account..." : "Register"}
        </button>

        <div className="mt-3 text-sm">
          Already have an account?{" "}
          <a href="/login" className="underline">
            Login
          </a>
        </div>
      </form>
    </div>
  );
}
