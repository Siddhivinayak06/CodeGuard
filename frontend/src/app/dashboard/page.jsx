// app/dashboard/page.jsx
"use client";

import StudentDashboard from "@/components/StudentDashboard";

export default function DashboardPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <StudentDashboard />
    </main>
  );
}
