export default function Toolbar({ onRun, onDownload, locked }) {
  return (
    <div className="flex gap-4 mt-4">
      <button
        onClick={onRun}
        disabled={locked}
        className={`px-4 py-2 rounded text-white ${locked ? "bg-gray-500" : "bg-blue-500 hover:bg-blue-600"}`}
      >
        Run
      </button>
      <button
        onClick={onDownload}
        disabled={locked}
        className={`px-4 py-2 rounded text-white ${locked ? "bg-gray-500" : "bg-green-500 hover:bg-green-600"}`}
      >
        Download PDF
      </button>
    </div>
  );
}
