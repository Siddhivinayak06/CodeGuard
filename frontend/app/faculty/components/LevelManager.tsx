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

// dynamic to avoid SSR issues
const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), {
  ssr: false,
});

interface LevelManagerProps {
  levels: Level[];
  activeLevel: "easy" | "hard";
  setActiveLevel: (level: "easy" | "hard") => void;
  updateLevelField: (
    level: "easy" | "hard",
    field: string,
    value: string | number | boolean,
  ) => void;
  addLevelTestCase: (level: "easy" | "hard") => void;
  removeLevelTestCase: (
    level: "easy" | "hard",
    index: number,
  ) => void;
  updateLevelTestCase: (
    level: "easy" | "hard",
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
        {(["easy", "hard"] as const).map((lvl) => {
          const levelInfo = {
            easy: { label: "Easy", color: "emerald" },
            hard: { label: "Hard", color: "red" },
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
                placeholder={`${activeLevel.charAt(0).toUpperCase() + activeLevel.slice(1)} Task Title`}
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
              placeholder={`Describe the ${activeLevel} level problem...`}
            />
          </div>

          {/* Reference Code for this level context (simplified: using global sampleCode for now, but conceptually could be per level) */}
          {/* Reusing logic from main form for code editor but wrapped inside level context if needed. 
              Actually, the original implementation shared one sampleCode. We'll keep it simple. */}

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
