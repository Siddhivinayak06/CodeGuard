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
  activeLevel: string;
  setActiveLevel: (level: string) => void;
  updateLevelField: (
    level: string,
    field: string,
    value: string | number | boolean,
  ) => void;
  addLevelTestCase: (level: string) => void;
  removeLevelTestCase: (
    level: string,
    index: number,
  ) => void;
  updateLevelTestCase: (
    level: string,
    index: number,
    field: keyof TestCase,
    value: string | number | boolean,
  ) => void;
  onAddLevel?: () => void;
  onRemoveLevel?: (level: string) => void;
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
  onAddLevel,
  onRemoveLevel,
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
      <div className="flex flex-wrap gap-2 mb-6 pb-2">
        {levels.map((levelObj, index) => {
          const lvl = levelObj.level;
          const isCompact = levels.length > 5;
          const matchNum = lvl.match(/\d+/);
          const numStr = matchNum ? matchNum[0] : "";
          const prefixStr = matchNum ? lvl.replace(numStr, "") : "";

          const colorStyles = [
            { active: "bg-emerald-500 text-white border-emerald-600 shadow-md", inactive: "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-emerald-300" },
            { active: "bg-blue-500 text-white border-blue-600 shadow-md", inactive: "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-blue-300" },
            { active: "bg-purple-500 text-white border-purple-600 shadow-md", inactive: "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-purple-300" },
            { active: "bg-pink-500 text-white border-pink-600 shadow-md", inactive: "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-pink-300" },
            { active: "bg-orange-500 text-white border-orange-600 shadow-md", inactive: "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-orange-300" },
            { active: "bg-red-500 text-white border-red-600 shadow-md", inactive: "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-red-300" }
          ];

          const style = colorStyles[index % colorStyles.length];
          const isActive = activeLevel === lvl;
          return (
            <div key={lvl} className={cx(
              "flex items-center relative group flex-1",
              "min-w-[48px] max-w-[200px] transition-all duration-300"
            )}>
              <motion.button
                type="button"
                onClick={() => setActiveLevel(lvl)}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={cx(
                  "w-full py-2.5 rounded-xl text-sm font-bold border transition-all line-clamp-1 truncate",
                  "px-2 lg:pl-4 lg:pr-10 text-center xl:text-left",
                  isActive ? style.active : style.inactive
                )}
              >
                <span className="hidden xl:inline">{prefixStr}</span>
                <span>{numStr || lvl}</span>
              </motion.button>
              {levels.length > 1 && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onRemoveLevel) onRemoveLevel(lvl);
                  }}
                  className={cx(
                    "absolute p-1 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 transition-colors z-10",
                    "xl:right-2 xl:p-1.5 xl:rounded-lg xl:-top-auto xl:bg-transparent xl:shadow-none xl:-translate-y-0",
                    "xl:opacity-0 group-hover:xl:opacity-100",
                    isActive ? "xl:opacity-100 xl:text-white xl:hover:bg-white/20" : "xl:text-gray-400 xl:hover:text-red-500 xl:hover:bg-red-50 dark:xl:hover:bg-red-900/30",
                    "-top-2 -right-2 xl:top-auto"
                  )}
                  title="Remove Task"
                >
                  <TrashIcon className="w-3 h-3 xl:w-4 xl:h-4" />
                </button>
              )}
            </div>
          );
        })}
        {onAddLevel && (
          <motion.button
            type="button"
            onClick={onAddLevel}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={cx(
              "flex-1 flex items-center justify-center py-2.5 rounded-xl text-sm font-bold border border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-indigo-500 hover:text-indigo-500 transition-all bg-transparent",
              "min-w-[48px] max-w-[200px] px-2 lg:px-4"
            )}
            title="Add Task"
          >
            <PlusIcon size={16} className="xl:mr-2" />
            <span className="hidden xl:inline">Add Task</span>
          </motion.button>
        )}
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
