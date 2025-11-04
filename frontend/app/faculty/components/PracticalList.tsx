"use client";

export default function PracticalList({ practicals, onEdit, onAssign, onDelete, subjects }: any) {
  return (
    <div className="space-y-2">
      {practicals.map((p: any) => {
        const subj = subjects.find((s: any) => s.id === p.subject_id)?.name || "Unknown";
        return (
          <div key={p.id} className="p-2 border rounded flex justify-between items-center">
            <div>
              <p className="font-medium">{p.title}</p>
              <p className="text-xs text-gray-500">
                {subj} • {new Date(p.deadline).toLocaleString()} • Marks: {p.max_marks}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => onEdit(p)} className="px-2 py-1 bg-blue-600 text-white rounded text-sm">
                Edit
              </button>
              <button onClick={() => onAssign(p.id)} className="px-2 py-1 bg-green-600 text-white rounded text-sm">
                Assign
              </button>
              <button
                onClick={async () => {
                  if (!confirm("Delete?")) return;
                  await onDelete(p.id);
                }}
                className="px-2 py-1 bg-red-500 text-white rounded text-sm"
              >
                Del
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
