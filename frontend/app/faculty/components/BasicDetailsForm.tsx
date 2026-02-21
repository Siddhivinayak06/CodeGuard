"use client";

import React, { useState } from "react";
import { Info as InfoIcon, Sparkles, Calendar, Code2, BookOpen } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Practical, Subject, Level } from "../types";

interface BasicDetailsFormProps {
  form: Practical;
  subjects: Subject[];
  handleInput: (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => void;
  defaultSubjectId?: number | string | null;
  enableLevels: boolean;
  setEnableLevels: (enable: boolean) => void;
  levels: Level[];
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// Enhanced input wrapper with floating label effect
function FormInput({
  label,
  required,
  children,
  icon: Icon,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  icon?: React.ElementType;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative"
    >
      <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-gray-400 mb-2">
        {Icon && <Icon size={12} className="text-indigo-500" />}
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </motion.div>
  );
}

export default function BasicDetailsForm({
  form,
  subjects,
  handleInput,
  defaultSubjectId,
  enableLevels,
  setEnableLevels,
  levels,
}: BasicDetailsFormProps) {
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // Enhanced input class with glow effect
  const inputBaseClass = cx(
    "w-full px-4 py-3 bg-white dark:bg-gray-800/80 border-2 rounded-xl transition-all duration-200 text-sm",
    "text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500",
    "hover:border-indigo-300 dark:hover:border-indigo-700",
  );

  const getInputClass = (fieldName: string, disabled = false) =>
    cx(
      inputBaseClass,
      focusedField === fieldName
        ? "border-indigo-500 dark:border-indigo-400 ring-4 ring-indigo-500/10 dark:ring-indigo-400/10 shadow-lg shadow-indigo-500/5"
        : "border-gray-200 dark:border-gray-700",
      disabled && "opacity-60 cursor-not-allowed bg-gray-50 dark:bg-gray-900/50",
    );

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 30 }}
      className="relative overflow-hidden bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl rounded-2xl p-6 shadow-xl shadow-gray-200/50 dark:shadow-gray-900/50 border border-gray-100 dark:border-gray-800"
    >
      {/* Decorative gradient blob */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.15 }}
        className="relative flex items-center gap-3 pb-4 border-b border-gray-200/80 dark:border-gray-700/80 mb-6"
      >
        <motion.div
          whileHover={{ scale: 1.05, rotate: 5 }}
          className="p-2.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl text-white shadow-lg shadow-indigo-500/30"
        >
          <InfoIcon size={20} />
        </motion.div>
        <div>
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">
            Basic Information
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Essential details for the practical
          </p>
        </div>
      </motion.div>

      {/* Title & Practical No */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex gap-4 mb-5"
      >
        <div className="w-32 shrink-0">
          <FormInput label="Practical No" required>
            <input
              type="number"
              name="practical_number"
              value={form.practical_number || ""}
              onChange={handleInput}
              onFocus={() => setFocusedField("practical_number")}
              onBlur={() => setFocusedField(null)}
              placeholder={(() => {
                const selectedSubject = subjects.find(
                  (s) => String(s.id) === String(form.subject_id)
                );
                return selectedSubject?.practical_count
                  ? String(selectedSubject.practical_count + 1)
                  : "1";
              })()}
              className={cx(getInputClass("practical_number"), "text-center font-bold")}
              min={1}
            />
          </FormInput>
        </div>
        <div className="flex-1">
          <FormInput label="Practical Title" required>
            <input
              type="text"
              name="title"
              value={form.title}
              onChange={handleInput}
              onFocus={() => setFocusedField("title")}
              onBlur={() => setFocusedField(null)}
              placeholder="e.g., Binary Search Implementation"
              className={getInputClass("title")}
            />
          </FormInput>
        </div>
      </motion.div>

      {/* Row 2: Subject, Language */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5"
      >
        <FormInput label="Subject" required icon={BookOpen}>
          <select
            name="subject_id"
            value={String(form.subject_id ?? "")}
            onChange={handleInput}
            onFocus={() => setFocusedField("subject")}
            onBlur={() => setFocusedField(null)}
            disabled={Boolean(defaultSubjectId)}
            className={getInputClass("subject", Boolean(defaultSubjectId))}
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.subject_name}
              </option>
            ))}
          </select>
        </FormInput>

        <FormInput label="Language" icon={Code2}>
          <select
            name="language"
            value={form.language || ""}
            onChange={handleInput}
            onFocus={() => setFocusedField("language")}
            onBlur={() => setFocusedField(null)}
            className={getInputClass("language")}
          >
            <option value="">Any Language</option>
            <option value="java">☕ Java</option>
            <option value="python">🐍 Python</option>
            <option value="c">⚙️ C</option>
          </select>
        </FormInput>
      </motion.div>

      {/* Row 3: Max Marks + Multi-Level Toggle */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex flex-wrap items-end justify-between gap-4 pt-5 border-t border-gray-100 dark:border-gray-800"
      >
        <div className="w-36">
          <FormInput label="Max Marks" required>
            <input
              type="number"
              name="max_marks"
              value={
                enableLevels
                  ? levels.reduce((sum, l) => sum + l.max_marks, 0)
                  : (form.max_marks ?? "")
              }
              onChange={handleInput}
              onFocus={() => setFocusedField("marks")}
              onBlur={() => setFocusedField(null)}
              disabled={enableLevels}
              className={cx(
                getInputClass("marks", enableLevels),
                "text-center font-bold text-lg",
              )}
            />
          </FormInput>
        </div>

        {/* Multi-Level Toggle - Enhanced */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          className="flex items-center gap-4 px-5 py-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-2xl border border-amber-200/50 dark:border-amber-700/50 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <motion.div
              animate={{ rotate: enableLevels ? 360 : 0 }}
              transition={{ duration: 0.5 }}
            >
              <Sparkles size={18} className="text-amber-600 dark:text-amber-400" />
            </motion.div>
            <div>
              <span className="text-sm font-bold text-amber-800 dark:text-amber-200 block">
                Multi-Level Mode
              </span>
              <span className="text-[10px] text-amber-600/70 dark:text-amber-400/70 block truncate w-32">
                {levels.length > 0
                  ? levels.slice(0, 2).map((l) => l.level).join(", ") +
                  (levels.length > 2 ? ", ..." : "")
                  : "Task 1, Task 2"}
              </span>
            </div>
          </div>
          <motion.button
            type="button"
            onClick={() => setEnableLevels(!enableLevels)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={cx(
              "relative inline-flex h-7 w-12 items-center rounded-full transition-all duration-300 shadow-inner",
              enableLevels
                ? "bg-gradient-to-r from-amber-500 to-orange-500 shadow-amber-500/30"
                : "bg-gray-300 dark:bg-gray-600",
            )}
          >
            <motion.span
              animate={{ x: enableLevels ? 22 : 3 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
              className={cx(
                "inline-block h-5 w-5 rounded-full shadow-md transition-colors",
                enableLevels ? "bg-white" : "bg-white",
              )}
            />
          </motion.button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
