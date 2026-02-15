const formatError = (error) => {
  if (!error) return null;

  // Split into lines
  const lines = error.split("\n");
  const cleanedLines = [];
  let skipUntilUserCode = false;

  for (let line of lines) {
    // Noise reduction: Hide references to the internal wrapper script
    if (
      line.includes("interactive_wrapper.py") ||
      line.includes('File "<string>", line')
    ) {
      // For SyntaxErrors in <string>, we want to keep the line info but maybe reformat
      if (line.includes('File "<string>", line')) {
        cleanedLines.push(line.replace('File "<string>",', "At"));
      }
      continue;
    }

    // Hide internal exec calls
    if (line.includes("exec(code, globals())")) continue;

    // Hide Traceback (most recent call last): if it's the only line left before user code
    if (line.includes("Traceback (most recent call last):")) continue;

    cleanedLines.push(line);
  }

  return cleanedLines.join("\n").trim();
};

export default function OutputPane({ output, error, language = "Python", onExplainError }) {
  const formattedError = formatError(error);

  if (!output && !formattedError) {
    return (
      <div className="h-full bg-white dark:bg-gray-900 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200/50 dark:border-gray-800/50">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-gray-500 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span className="text-gray-500 dark:text-gray-400 text-xs font-mono uppercase tracking-wider">
              Console Output
            </span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center text-gray-400 dark:text-gray-600">
          <div className="text-center">
            <p className="text-sm font-medium">No output yet</p>
            <p className="text-xs mt-1 opacity-70 italic">
              Run your {language} code to see results
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-white dark:bg-gray-900 flex flex-col font-mono text-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-900/50 border-b border-gray-200/50 dark:border-gray-800/50">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400/80" />
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
          </div>
          <span className="ml-2 text-gray-500 dark:text-gray-400 text-xs font-mono uppercase tracking-wider">
            Terminal Output
          </span>
        </div>
      </div>

      <div className="flex-1 p-4 overflow-auto scrollbar-thin scrollbar-thumb-gray-200 dark:scrollbar-thumb-gray-800">
        {formattedError && (
          <div className="mb-6 animate-in fade-in slide-in-from-top-1 duration-300 group">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-red-500 dark:text-red-400 font-bold uppercase text-xs tracking-widest">
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Standard Error
              </div>
              {onExplainError && (
                <button
                  onClick={() => onExplainError(formattedError)}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40 rounded transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                  title="Ask AI to explain this error"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  Explain Error
                </button>
              )}
            </div>
            <div className="text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-900/10 border-l-2 border-red-500 p-4 rounded-r-lg whitespace-pre-wrap leading-relaxed">
              {formattedError}
            </div>
          </div>
        )}

        {output && (
          <div className="animate-in fade-in duration-500">
            <div className="flex items-center gap-2 text-emerald-500 dark:text-emerald-400 font-bold mb-2 uppercase text-xs tracking-widest">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Standard Output
            </div>
            <div className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed pl-6 border-l border-gray-100 dark:border-gray-800">
              {output}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
