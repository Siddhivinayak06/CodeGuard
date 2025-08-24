"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext"; // optional (for auto-login mock)

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const router = useRouter();
  const { login } = useAuth(); // optional: auto-login after register

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // simple client-side validation
    if (!name.trim() || !email.trim() || !password.trim() || !confirm.trim()) {
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
      // ---------- OPTION A: Mock registration + auto-login (no backend) ----------
      // Remove this block if you switch to API below
      login({ email, name });
      router.push("/"); // go to editor
      // --------------------------------------------------------------------------

      // ---------- OPTION B: Use backend API (uncomment to use) ----------
      // const res = await fetch("http://localhost:5000/auth/register", {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify({ name, email, password }),
      // });
      // if (!res.ok) {
      //   const data = await res.json().catch(() => ({}));
      //   throw new Error(data?.error || "Registration failed");
      // }
      // // Redirect to login (or auto-login if your API returns a token)
      // router.push("/login");
      // -------------------------------------------------------------------
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen">
      <form onSubmit={handleSubmit} className="p-6 border rounded w-96">
        <h1 className="text-xl font-semibold mb-4">Create an account</h1>

        {error && <p className="mb-2">{error}</p>}

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
          className="w-full p-2 border rounded disabled:opacity-60"
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
