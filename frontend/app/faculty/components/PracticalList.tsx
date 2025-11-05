"use client";

export default function PracticalList({ practicals, onEdit, onAssign, onDelete, subjects }: any) {
  return (
    <div className="space-y-3">
      {practicals.map((p: any) => {
        const subj = subjects.find((s: any) => s.id === p.subject_id)?.name || "Unknown";
        const isPast = new Date(p.deadline) < new Date();

        return (
          <div
            key={p.id}
            className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition flex flex-col md:flex-row justify-between items-start md:items-center gap-3"
          >
            <div className="flex flex-col gap-1">
              <p className="font-semibold text-gray-900 dark:text-gray-100 text-lg">{p.title}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {subj} • {new Date(p.deadline).toLocaleString()} • Marks: {p.max_marks}
              </p>
              <span
                className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full font-medium ${
                  isPast ? "bg-red-200 text-red-800" : "bg-green-200 text-green-800"
                }`}
              >
                {isPast ? "Closed" : "Upcoming"}
              </span>
            </div>

            <div className="flex gap-2 mt-2 md:mt-0">
              <button
                onClick={() => onEdit(p)}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm"
              >
                Edit
              </button>
              <button
                onClick={() => onAssign(p.id)}
                className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition text-sm"
              >
                Assign
              </button>
              <button
                onClick={async () => {
                  if (!confirm("Delete this practical?")) return;
                  await onDelete(p.id);
                }}
                className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition text-sm"
              >
                Delete
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
