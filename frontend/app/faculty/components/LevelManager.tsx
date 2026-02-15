"use client";

import React, { useCallback } from "react";
import {
  Sparkles,
  FlaskConical as TestIcon,
  Plus as PlusIcon,
  Trash2 as TrashIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { TestCase, Level } from "../types";
import TestCaseManager from "./TestCaseManager";
import dynamic from "next/dynamic";
import { cpp } from "@codemirror/lang-cpp";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { useTheme } from "next-themes";

// dynamic to avoid SSR issues
const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), {
  ssr: false,
});

interface LevelManagerProps {
  levels: Level[];
  activeLevel: "Task 1" | "Task 2";
  setActiveLevel: (level: "Task 1" | "Task 2") => void;
  updateLevelField: (
    level: "Task 1" | "Task 2",
    field: string,
    value: string | number | boolean,
  ) => void;
  addLevelTestCase: (level: "Task 1" | "Task 2") => void;
  removeLevelTestCase: (
    level: "Task 1" | "Task 2",
    index: number,
  ) => void;
  updateLevelTestCase: (
    level: "Task 1" | "Task 2",
    index: number,
    field: keyof TestCase,
    value: string | number | boolean,
  ) => void;
  generateTestCases: () => void;
  generatingTests: boolean;
  sampleCode: string;
  setSampleCode: (code: string) => void;
  sampleLanguage: string;
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export default function LevelManager({
  levels,
  activeLevel,
  setActiveLevel,
  updateLevelField,
  addLevelTestCase,
  removeLevelTestCase,
  updateLevelTestCase,
  generateTestCases,
  generatingTests,
  sampleCode,
  setSampleCode,
  sampleLanguage,
}: LevelManagerProps) {
  const { theme } = useTheme();
  const getCurrentLevel = () => levels.find((l) => l.level === activeLevel)!;

  const getLanguageExtension = useCallback(
    () =>
      String(sampleLanguage || "").toLowerCase() === "python"
        ? python()
        : cpp(),
    [sampleLanguage],
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass-card-premium rounded-xl p-6"
    >
      <div className="flex items-center gap-3 pb-4 border-b border-gray-200 dark:border-gray-700 mb-4">
        <div className="p-2 bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg text-white shadow-md">
          <Sparkles size={20} />
        </div>
        <div>
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">
            Difficulty Levels
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Configure each difficulty level separately
          </p>
        </div>
      </div>

      {/* Level Tabs */}
      <div className="flex gap-2 mb-6">
        {(["Task 1", "Task 2"] as const).map((lvl) => {
          const levelInfo = {
            "Task 1": { label: "Task 1", color: "emerald" },
            "Task 2": { label: "Task 2", color: "red" },
          }[lvl];
          const isActive = activeLevel === lvl;
          return (
            <motion.button
              key={lvl}
              type="button"
              onClick={() => setActiveLevel(lvl)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={cx(
                "flex-1 py-3 px-4 rounded-xl text-sm font-bold border transition-all",
                isActive
                  ? `bg-${levelInfo.color}-500 text-white border-${levelInfo.color}-600 shadow-md`
                  : `bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-${levelInfo.color}-300`,
              )}
            >
              {levelInfo.label}
            </motion.button>
          );
        })}
      </div>

      {/* Active Level Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeLevel}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.2 }}
          className="space-y-6"
        >
          {/* Level Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-2">
                Task Title
              </label>
              <input
                type="text"
                value={getCurrentLevel().title || ""}
                onChange={(e) =>
                  updateLevelField(activeLevel, "title", e.target.value)
                }
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder={`${activeLevel} Title`}
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-2">
                Marks for Level
              </label>
              <input
                type="number"
                value={getCurrentLevel().max_marks}
                onChange={(e) =>
                  updateLevelField(
                    activeLevel,
                    "max_marks",
                    Number(e.target.value),
                  )
                }
                className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-2">
              Problem Description
            </label>
            <textarea
              value={getCurrentLevel().description || ""}
              onChange={(e) =>
                updateLevelField(activeLevel, "description", e.target.value)
              }
              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-h-[120px]"
              placeholder={`Describe the ${activeLevel} problem...`}
            />
          </div>

          {/* Reference Code - Styled like SingleLevelTestCases */}
          <div className="glass-card-premium rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-700 mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl text-white shadow-lg shadow-pink-500/25">
                  <TestIcon size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">
                    Reference Code
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Provide solution code for test validation
                  </p>
                </div>
              </div>
              <span className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300">
                {String(sampleLanguage || "c").toUpperCase()}
              </span>
            </div>
            <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
              <CodeMirror
                value={getCurrentLevel().reference_code || ""}
                height="200px"
                extensions={[getLanguageExtension()]}
                theme={theme === "dark" ? oneDark : "light"}
                onChange={(value) =>
                  updateLevelField(activeLevel, "reference_code", value)
                }
                className="text-sm"
              />
            </div>
          </div>

          {/* Test Cases for Level */}
          <TestCaseManager
            testCases={getCurrentLevel().testCases}
            handleTestCaseChange={(idx, field, val) =>
              updateLevelTestCase(activeLevel, idx, field, val)
            }
            addTestCase={() => addLevelTestCase(activeLevel)}
            removeTestCase={(idx) => removeLevelTestCase(activeLevel, idx)}
            generateTestCases={generateTestCases}
            generatingTests={generatingTests}
            description={getCurrentLevel().description || ""}
          />
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
