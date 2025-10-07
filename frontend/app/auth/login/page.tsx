"use client"

import type React from "react"

import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import { useState } from "react"
import Link from "next/link"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (error) throw error
      router.push("/Editor")
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <form
        onSubmit={handleLogin}
        className="p-8 w-96 rounded-2xl shadow-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
      >
        <div className="flex justify-center mb-6">
          <img src="/fcrit-logo.jpg" alt="App Logo" className="h-30 w-30 object-contain" />
        </div>

        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800 dark:text-gray-100">Welcome Back</h1>

        {error && (
          <p className="mb-4 text-sm text-red-600 bg-red-100 dark:bg-red-900/30 px-3 py-2 rounded-md">{error}</p>
        )}

        <input
          type="email"
          placeholder="Email"
          className="w-full mb-3 p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full mb-5 p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button
          type="submit"
          className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 dark:hover:bg-blue-500 transition duration-200 shadow-md disabled:opacity-60"
          disabled={isLoading}
        >
          {isLoading ? "Signing In..." : "Login"}
        </button>

        <p className="mt-4 text-sm text-center text-gray-600 dark:text-gray-400">
          Don't have an account?{" "}
          <Link href="/auth/register" className="text-blue-600 dark:text-blue-400 hover:underline">
            Register
          </Link>
        </p>
      </form>
    </div>
  )
}
