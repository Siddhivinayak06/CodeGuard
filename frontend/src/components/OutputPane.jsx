export default function OutputPane({ output, error, language = "Python" }) {
  if (!output && !error) {
    return (
      <div className="h-full bg-white dark:bg-gray-900 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-gray-700 dark:text-gray-300 text-sm font-medium">OUTPUT</span>
          </div>
        </div>
        
        <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-sm">No output</p>
            <p className="text-sm mt-1 opacity-60">
              Run your {language.charAt(0).toUpperCase() + language.slice(1)} code to see the output</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-white dark:bg-gray-900 flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-600 dark:text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-gray-700 dark:text-gray-300 text-sm font-medium">OUTPUT</span>
        </div>
      </div>
      
      <div className="flex-1 p-4 font-mono text-sm text-gray-800 dark:text-gray-200 overflow-auto">
        {error && (
          <div className="mb-4">
            <div className="text-red-600 dark:text-red-400 mb-1">❌ Error:</div>
            <div className="text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 pl-4 py-2">
              {error}
            </div>
          </div>
        )}
        
        {output && (
          <div>
            <div className="text-green-600 dark:text-green-400 mb-2">✅ Output:</div>
            <div className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap leading-relaxed">
              {output}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
