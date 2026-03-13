import re

with open("PracticalForm.tsx", "r") as f:
    content = f.read()

# Since multi_replace_file_content can be tricky with huge blocks, we use python to cleanly find and replace
# We need to turn:
# 1. `{isExam && step === 1 && (` ... (lines 2020-2083) into Step 2 Exam Settings
# 2. `{isExam && step === 2 && (() => {` ... (lines 2140-2319) into Step 1 Exam Details + Sets

step1_orig = re.search(r"\{/\* ========== STEP 1 FOR EXAMS: Basic Info \+ Exam Settings ========== \*/\}.*?\{/\* ========== STEP 1 FOR NON-EXAMS: Original form content ========== \*/\}", content, re.DOTALL).group(0)
step2_orig = re.search(r"\{/\* ========== STEP 2 FOR EXAMS: Per-Set Sub-Question Editor ========== \*/\}.*?\{/\* ========== STEP 3: ASSIGN STUDENTS ========== \*/\}", content, re.DOTALL).group(0)

# Extract BasicDetails from step1_orig
basic_details = re.search(r"<BasicDetailsForm.*?/>", step1_orig, re.DOTALL).group(0)

# Extract Exam Settings from step1_orig
exam_settings = re.search(r"\{/\* Exam Settings \*/\}.*?(?=</div>\n                  </div)", step1_orig, re.DOTALL).group(0)

# Extract Sets Editor from step2_orig
sets_editor_func = re.search(r"\{\(\) => \{.*?(?=</div>\n                  \);\n                \}\)\(\)\}", step2_orig, re.DOTALL).group(0)

# Rebuild Step 1
new_step_1 = f"""{{/* ========== STEP 1 FOR EXAMS: Basic Info + Question Sets ========== */}}
                {{isExam && step === 1 && (() => {{
{sets_editor_func.split('return (')[0]}
                  return (
                    <div className="max-w-3xl mx-auto space-y-6">
{basic_details}
{sets_editor_func.split('return (')[1].split('{/* Back button */}')[0]}
                    </div>
                  );
                }})()}}

                {{/* ========== STEP 1 FOR NON-EXAMS: Original form content ========== */}}"""

# Rebuild Step 2
new_step_2 = f"""{{/* ========== STEP 2 FOR EXAMS: Exam Settings ========== */}}
                {{isExam && step === 2 && (
                  <div className="max-w-3xl mx-auto space-y-6">
{exam_settings}
                    <button onClick={{() => setStep(1)}}
                      className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                      <ChevronLeft className="w-4 h-4" /> Back to Exam Details & Sets
                    </button>
                  </div>
                )}}

                {{/* ========== STEP 3: ASSIGN STUDENTS ========== */}}"""

content = content.replace(step1_orig, new_step_1)
content = content.replace(step2_orig, new_step_2)

with open("PracticalForm.tsx", "w") as f:
    f.write(content)

