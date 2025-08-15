// OutputPane.js
export default function OutputPane({ output, error }) {
  if (!output && !error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <div className="w-16 h-16 rounded-full bg-gray-200/50 dark:bg-gray-800/30 backdrop-blur-sm border border-gray-300/30 dark:border-gray-700/50 flex items-center justify-center mb-4">
          <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <p className="text-sm font-medium">No output yet</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Run your code to see results here</p>
      </div>
    );
  }

  return (
    <div className="h-full">
      {output && (
        <div className="rounded-lg bg-gray-100/50 dark:bg-gray-900/30 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 p-4 font-mono text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap overflow-auto">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200/50 dark:border-gray-700/30">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Output</span>
          </div>
          {output}
        </div>
      )}
    </div>
  );
}