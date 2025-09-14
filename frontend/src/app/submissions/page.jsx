"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import Navbar from "@/components/Navbar";

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState([]);
  const userId = 1; // 🔑 Replace with logged-in user

  useEffect(() => {
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/api/dashboard/submissions/${userId}`)
      .then((res) => setSubmissions(res.data))
      .catch((err) => console.error(err));
  }, [userId]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">📝 Submissions</h2>
        <table className="w-full border border-gray-300 dark:border-gray-700 rounded">
          <thead className="bg-gray-100 dark:bg-gray-700">
            <tr>
              <th className="px-3 py-2">Practical</th>
              <th className="px-3 py-2">Language</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Submitted At</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s) => (
              <tr key={s.id} className="border-t dark:border-gray-600">
                <td className="px-3 py-2">{s.practical_title}</td>
                <td className="px-3 py-2">{s.language}</td>
                <td
                  className={`px-3 py-2 ${
                    s.status === "Success" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {s.status}
                </td>
                <td className="px-3 py-2">
                  {new Date(s.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
