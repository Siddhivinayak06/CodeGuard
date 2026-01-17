"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { FileText, Code as CodeIcon } from "lucide-react";
import { oneDark } from "@codemirror/theme-one-dark";
import { Extension } from "@codemirror/state";
import { TestCase, Practical } from "../types";
import TestCaseManager from "./TestCaseManager";

// Dynamic CodeMirror to avoid SSR issues
const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), {
  ssr: false,
});

interface SingleLevelTestCasesProps {
  form: Practical;
  handleInput: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
  sampleCode: string;
  setSampleCode: (code: string) => void;
  sampleLanguage: string;
  setSampleLanguage: (lang: string) => void;
  getLanguageExtension: () => Extension;
  testCases: TestCase[];
  handleTestCaseChange: (
    index: number,
    field: keyof TestCase,
    value: string | number | boolean,
  ) => void;
  addTestCase: () => void;
  removeTestCase: (index: number) => void;
  generateTestCases: () => Promise<void>;
  generatingTests: boolean;
}

export default function SingleLevelTestCases({
  form,
  handleInput,
  sampleCode,
  setSampleCode,
  sampleLanguage,
  setSampleLanguage,
  getLanguageExtension,
  testCases,
  handleTestCaseChange,
  addTestCase,
  removeTestCase,
  generateTestCases,
  generatingTests,
}: SingleLevelTestCasesProps) {
  const { theme } = useTheme();

  return (
    <>
      {/* Description */}
      <div className="glass-card-premium rounded-2xl p-5 shadow-sm">
        <div className="flex items-center gap-3 pb-3 border-b border-gray-200 dark:border-gray-700 mb-4">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl text-white shadow-lg shadow-blue-500/25">
            <FileText size={18} />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">
              Problem Description
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Detailed explanation of the practical task
            </p>
          </div>
        </div>
        <textarea
          name="description"
          value={form.description || ""}
          onChange={handleInput}
          className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[150px] text-sm"
          placeholder="Describe the problem, requirements, and constraints..."
        />
      </div>

      {/* Reference Code */}
      <div className="glass-card-premium rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl text-white shadow-lg shadow-pink-500/25">
              <CodeIcon size={18} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">
                Reference Code
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Provide a starting template or solution
              </p>
            </div>
          </div>
          <select
            value={sampleLanguage}
            onChange={(e) => setSampleLanguage(e.target.value)}
            className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300"
          >
            <option value="c">C / C++</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
          </select>
        </div>
        <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <CodeMirror
            value={sampleCode}
            height="200px"
            extensions={[getLanguageExtension()]}
            theme={theme === "dark" ? oneDark : "light"}
            onChange={(val) => setSampleCode(val)}
            className="text-sm"
          />
        </div>
      </div>

      {/* Test Cases */}
      <TestCaseManager
        testCases={testCases}
        handleTestCaseChange={handleTestCaseChange}
        addTestCase={addTestCase}
        removeTestCase={removeTestCase}
        generateTestCases={generateTestCases}
        generatingTests={generatingTests}
        description={form.description || ""}
      />
    </>
  );
}
