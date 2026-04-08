"use client";

import React from "react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import { FileText, Code as CodeIcon, Sparkles, Loader2 } from "lucide-react";
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
  starterCode: string;
  setStarterCode: (code: string) => void;
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
  fuzzerCount: number;
  setFuzzerCount: (count: number) => void;
  generatingTests: boolean;
  isExam?: boolean;
  onGenerateCode?: (type: 'starter' | 'reference') => Promise<void>;
  isGeneratingCode?: boolean;
}

export default function SingleLevelTestCases({
  form,
  handleInput,
  sampleCode,
  setSampleCode,
  starterCode,
  setStarterCode,
  sampleLanguage,
  setSampleLanguage,
  getLanguageExtension,
  testCases,
  handleTestCaseChange,
  addTestCase,
  removeTestCase,
  generateTestCases,
  fuzzerCount,
  setFuzzerCount,
  generatingTests,
  isExam,
  onGenerateCode,
  isGeneratingCode = false,
}: SingleLevelTestCasesProps) {
  const { theme } = useTheme();

  return (
    <>
      {/* Starter Code */}
      <div className="glass-card-premium rounded-2xl p-5 shadow-sm mb-6">
        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-cyan-500 to-sky-600 rounded-xl text-white shadow-lg shadow-sky-500/25">
              <CodeIcon size={18} />
            </div>
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white">
                Starter Code
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Provide the initial code template for students
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onGenerateCode && (
              <button
                type="button"
                onClick={() => onGenerateCode('starter')}
                disabled={isGeneratingCode || !form.description?.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-600 hover:to-sky-700 text-white rounded-lg text-[10px] font-bold shadow-md shadow-sky-500/20 transition-all disabled:opacity-50"
              >
                {isGeneratingCode ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Sparkles size={12} />
                )}
                ✨ Generate with AI
              </button>
            )}
            <span className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300">
              {String(sampleLanguage || "c").toUpperCase()}
            </span>
          </div>
        </div>
        <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <CodeMirror
            value={starterCode}
            height="200px"
            extensions={[getLanguageExtension()]}
            theme={theme === "dark" ? oneDark : "light"}
            onChange={(val) => setStarterCode(val)}
            className="text-sm"
          />
        </div>
      </div>

      {/* Reference Code */}
      <div className="glass-card-premium rounded-2xl p-5 shadow-sm mb-6">
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
          <div className="flex items-center gap-2">
            {onGenerateCode && (
              <button
                type="button"
                onClick={() => onGenerateCode('reference')}
                disabled={isGeneratingCode || !form.description?.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white rounded-lg text-[10px] font-bold shadow-md shadow-pink-500/20 transition-all disabled:opacity-50"
              >
                {isGeneratingCode ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <Sparkles size={12} />
                )}
                ✨ Generate Solution
              </button>
            )}
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
        fuzzerCount={fuzzerCount}
        setFuzzerCount={setFuzzerCount}
        generatingTests={generatingTests}
        description={form.description || ""}
      />
    </>
  );
}
