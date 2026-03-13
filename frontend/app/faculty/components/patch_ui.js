const fs = require('fs');

let content = fs.readFileSync('PracticalForm.tsx', 'utf-8');

// The active set header is currently:
// <div className="flex items-center gap-3">
//   <Layers className="w-5 h-5 text-indigo-500" />
//   <input type="text" value={activeSet.set_name} ... className="text-xl font-bold text-gray-900..." />

// We want to make it look like the Basic Information header:
/*
<div className="flex items-center justify-between mb-6">
  <div className="flex items-center gap-3">
    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
      <Layers className="w-5 h-5" />
    </div>
    <div>
      <input type="text" ... className="text-xl font-bold text-gray-900 dark:text-white bg-transparent border-none outline-none focus:ring-0 p-0" />
      <p className="text-sm text-gray-500">{activeSet.subQuestions.length} question(s)</p>
    </div>
  </div>
</div>
*/

const oldSetHeader = `{/* Set Name */}
                      <div className="flex items-center gap-3">
                        <Layers className="w-5 h-5 text-indigo-500" />
                        <input
                          type="text"
                          value={activeSet.set_name}
                          onChange={(e) => setExamSetDrafts(prev => prev.map((s, i) => i === activeSetIdx ? { ...s, set_name: e.target.value } : s))}
                          className="text-xl font-bold text-gray-900 dark:text-white bg-transparent border-none outline-none focus:ring-0 p-0"
                        />
                        <span className="text-sm text-gray-400">{activeSet.subQuestions.length} question{activeSet.subQuestions.length !== 1 ? "s" : ""}</span>
                      </div>`;

const newSetHeader = `{/* Set Name */}
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm">
                          <Layers className="w-4 h-4" />
                        </div>
                        <input
                          type="text"
                          value={activeSet.set_name}
                          onChange={(e) => setExamSetDrafts(prev => prev.map((s, i) => i === activeSetIdx ? { ...s, set_name: e.target.value } : s))}
                          className="text-lg font-bold text-gray-900 dark:text-white bg-transparent border-none outline-none focus:ring-0 p-0"
                        />
                        <span className="text-xs font-medium text-gray-400 ml-2">{activeSet.subQuestions.length} question{activeSet.subQuestions.length !== 1 ? "s" : ""}</span>
                      </div>`;

content = content.replace(oldSetHeader, newSetHeader);


// Sub-Question container is currently: bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden
// Change to: bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden

const oldQContainer = `className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"`;
const newQContainer = `className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden"`;

content = content.replace(oldQContainer, newQContainer); // wait, it might appear multiple times, but this is specific to sub-questions. Actually I'll use regex.
content = content.replace(/className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden"/g, newQContainer);

// The question header:
const oldQHeader = `<div className="px-5 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">`;
const newQHeader = `<div className="px-5 py-3 bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">`;
content = content.replace(/<div className="px-5 py-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">/g, newQHeader);

// The Question Title input:
// <input type="text" value={q.title} ... className="text-sm font-semibold text-gray-800 dark:text-gray-200 bg-transparent border-none outline-none" />
const oldQTitle = `className="text-sm font-semibold text-gray-800 dark:text-gray-200 bg-transparent border-none outline-none"`;
const newQTitle = `className="text-sm font-bold text-gray-900 dark:text-white bg-transparent border-none outline-none placeholder-gray-400"`;
content = content.replace(new RegExp(oldQTitle.replace(/[.*+?^$\{()|[\\]\\\\]/g, '\\\\$&'), 'g'), newQTitle);

// Change the "Marks:" input to standard input styling
const oldMarksInput = `className="w-16 px-2 py-1 text-sm bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg text-center"`;
const newMarksInput = `className="w-16 px-3 py-1.5 text-sm font-medium bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl text-center focus:ring-2 focus:ring-indigo-500/50 outline-none transition-all"`;
content = content.replace(new RegExp(oldMarksInput.replace(/[.*+?^$\{()|[\\]\\\\]/g, '\\\\$&'), 'g'), newMarksInput);

// Edit test cases add button
const oldTCAdd = `<button onClick={() => addTestCase(qIdx)} className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:text-indigo-700 transition-colors flex items-center gap-1">`;
const newTCAdd = `<button onClick={() => addTestCase(qIdx)} className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:text-indigo-700 transition-colors flex items-center gap-1">`;
content = content.replace(new RegExp(oldTCAdd.replace(/[.*+?^$\{()|[\\]\\\\]/g, '\\\\$&'), 'g'), newTCAdd);

// Test cases inputs
const oldTCInput = `className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm"`;
const newTCInput = `className="w-full px-4 py-2.5 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all placeholder-gray-400"`;
content = content.replace(new RegExp(oldTCInput.replace(/[.*+?^$\{()|[\\]\\\\]/g, '\\\\$&'), 'g'), newTCInput);


// Textarea
const oldTA = `className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm resize-y focus:ring-2 focus:ring-indigo-500/50 outline-none"`;
const newTA = `className="w-full px-4 py-3 bg-gray-50/50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700 rounded-2xl text-sm resize-y focus:ring-2 focus:ring-indigo-500/30 outline-none transition-all placeholder-gray-400"`;
content = content.replace(new RegExp(oldTA.replace(/[.*+?^$\{()|[\\]\\\\]/g, '\\\\$&'), 'g'), newTA);

fs.writeFileSync('PracticalForm.tsx', content);
