"use client";
import { useEffect, useState } from "react";
import axios from "axios";
import Navbar from "@/components/Navbar";

export default function PracticalsPage() {
  const [subjects, setSubjects] = useState([]);

  useEffect(() => {
    axios
      .get(`${process.env.NEXT_PUBLIC_API_URL}/api/dashboard/subjects`)
      .then((res) => setSubjects(res.data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      <div className="p-6">
        <h2 className="text-2xl font-bold mb-4">🧑‍💻 Practicals</h2>
        {subjects.map((subj) => (
          <div key={subj.id} className="mb-6">
            <h3 className="font-semibold text-lg mb-2">{subj.name}</h3>
            <ul className="list-disc pl-6 text-gray-700 dark:text-gray-300">
              {subj.practicals?.map((p) => (
                <li key={p.id}>{p.title}</li>
              )) || <li>No practicals added</li>}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
