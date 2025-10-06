import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { GraduationCap, CheckCircle, User, Mail, Shield } from "lucide-react"

export default async function SuccessPage() {
  const supabase = await createClient()

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    redirect("/auth/login")
  }

  // Fetch user profile from our users table
  const { data: profile } = await supabase.from("users").select("*").eq("uid", data.user.id).single()

  const handleSignOut = async () => {
    "use server"
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect("/")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <GraduationCap className="h-8 w-8 text-blue-600" />
              <h1 className="text-xl font-bold text-gray-900">Student Portal</h1>
            </div>
            <form action={handleSignOut}>
              <Button variant="outline" type="submit">
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-green-600" />
          </div>
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Welcome to Your Account!</h2>
          <p className="text-xl text-gray-600">You have successfully logged in to the Student Portal.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* User Information */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                Your Profile
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-500">Name</p>
                  <p className="font-medium">{profile?.name || "Not set"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium">{data.user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-500">Role</p>
                  <p className="font-medium capitalize">{profile?.role || "student"}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Status */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                Account Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Email Verified</span>
                <span className="text-green-600 font-medium">
                  {data.user.email_confirmed_at ? "✓ Verified" : "⚠ Pending"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Account Created</span>
                <span className="text-gray-900 font-medium">{new Date(data.user.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Last Sign In</span>
                <span className="text-gray-900 font-medium">
                  {data.user.last_sign_in_at ? new Date(data.user.last_sign_in_at).toLocaleDateString() : "First time"}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="mt-8 text-center">
          <p className="text-gray-600 mb-4">Your authentication system is working perfectly!</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <Link href="/">Back to Home</Link>
            </Button>
            <form action={handleSignOut} className="inline">
              <Button variant="outline" type="submit">
                Sign Out
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  )
}
