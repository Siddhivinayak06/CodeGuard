// /components/PracticalCard.tsx
"use client";
import { Practical } from "@/lib/types";

interface Props {
  practical: Practical;
}

export default function PracticalCard({ practical }: Props) {
  return (
    <div className="border p-4 rounded shadow">
      <h3 className="font-bold">{practical.title}</h3>

      <p>Marks: {practical.marks || 0}</p>
      <p>Submissions: {practical.submission_count || 0}</p>
    </div>
  );
}
