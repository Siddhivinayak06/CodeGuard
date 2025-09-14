"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import Navbar from "@/components/Navbar";

export default function StudentDashboard() {
  const [progress, setProgress] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  const userId = 1; // 🔑 Replace with logged-in user context/auth

  useEffect(() => {
    async function fetchData() {
      try {
        const [progRes, submRes] = await Promise.all([
          axios.get(
            `${process.env.NEXT_PUBLIC_API_URL}/api/dashboard/progress/${userId}`
          ),
          axios.get(
            `${process.env.NEXT_PUBLIC_API_URL}/api/dashboard/submissions/${userId}`
          ),
        ]);

        setProgress(progRes.data || []);
        setSubmissions(submRes.data || []);
      } catch (err) {
        console.error("❌ Dashboard fetch failed:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [userId]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-950 dark:to-black">
      {/* Navbar (Glass effect) */}
      <Navbar />

      {/* Main Content */}
      <div className="pt-24 px-6 md:px-12">
        <h1 className="text-3xl font-extrabold mb-8 text-gray-800 dark:text-gray-100">
          📊 Student Dashboard
        </h1>

        {loading ? (
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        ) : (
          <>
            {/* Progress Section */}
            <section>
              <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
                📚 Progress
              </h2>
              {progress.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">
                  No subjects found.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {progress.map((p) => {
                    const percentage =
                      ((p.completed_count || 0) / (p.total_count || 1)) * 100;

                    return (
                      <div
                        key={p.subject_id}
                        className="p-6 rounded-2xl bg-white/40 dark:bg-gray-800/40 backdrop-blur-md shadow-md hover:shadow-xl transition transform hover:-translate-y-1"
                      >
                        <h3 className="font-semibold text-lg text-gray-800 dark:text-gray-200">
                          {p.subject}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          {p.completed_count || 0}/{p.total_count || 0} completed
                        </p>
                        <div className="w-full bg-gray-200/60 dark:bg-gray-700/60 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-blue-500 to-purple-500 h-2 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Submissions Section */}
            <section className="mt-12">
              <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-200">
                📝 Recent Submissions
              </h2>
              {submissions.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400">
                  No submissions yet.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-2xl shadow-md">
                  <table className="w-full backdrop-blur-md bg-white/40 dark:bg-gray-800/40 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl overflow-hidden">
                    <thead className="bg-gray-100/70 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-4 py-3 text-left">Practical</th>
                        <th className="px-4 py-3 text-left">Language</th>
                        <th className="px-4 py-3 text-left">Status</th>
                        <th className="px-4 py-3 text-left">Submitted At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {submissions.map((s) => (
                        <tr
                          key={s.id}
                          className="border-t border-gray-200/40 dark:border-gray-700/40 hover:bg-gray-50/60 dark:hover:bg-gray-800/60 transition"
                        >
                          <td className="px-4 py-3">{s.practical_title}</td>
                          <td className="px-4 py-3">{s.language}</td>
                          <td
                            className={`px-4 py-3 font-medium ${
                              s.status === "Success"
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                          >
                            {s.status}
                          </td>
                          <td className="px-4 py-3">
                            {new Date(s.created_at).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
