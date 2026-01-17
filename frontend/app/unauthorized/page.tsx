import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl max-w-md w-full text-center space-y-6 border border-gray-100 dark:border-gray-700">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 text-red-600 rounded-full flex items-center justify-center mx-auto text-3xl font-bold">
          !
        </div>

        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">
          Access Denied
        </h1>

        <p className="text-gray-600 dark:text-gray-400 text-lg">
          You do not have permission to view this page.
        </p>

        <div className="text-xs text-left bg-gray-100 dark:bg-gray-950 p-4 rounded font-mono overflow-auto max-h-40">
          <p className="font-bold mb-1">Debug Info:</p>
          <p>
            This page usually appears if your User Role does not match the
            dashboard you are trying to access.
          </p>
          <p className="mt-2">
            If you see this immediately after login, your account might not have
            a Role assigned in the database.
          </p>
        </div>

        <div className="pt-2">
          <div className="space-y-4">
            <Link href="/auth/login" className="block">
              <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-all">
                Sign Out / Login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
