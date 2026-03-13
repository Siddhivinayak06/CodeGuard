const fs = require('fs');

const content = fs.readFileSync('PracticalForm.tsx', 'utf-8');

const step1Start = "{/* ========== STEP 1 FOR EXAMS: Basic Info + Exam Settings ========== */}";
const step1NonExamsStart = "{/* ========== STEP 1 FOR NON-EXAMS: Original form content ========== */}";
const step2Start = "{/* ========== STEP 2 FOR EXAMS: Per-Set Sub-Question Editor ========== */}";
const step3Start = "{/* ========== STEP 3: ASSIGN STUDENTS ========== */}";

const step1Block = content.substring(content.indexOf(step1Start), content.indexOf(step1NonExamsStart));
const step2Block = content.substring(content.indexOf(step2Start), content.indexOf(step3Start));

// Extract basic details from step1Block
const basicDetailsMatch = step1Block.match(/<BasicDetailsForm[\s\S]*?\/>/);
if (!basicDetailsMatch) {
    console.error("Could not find BasicDetailsForm");
    process.exit(1);
}
const basicDetails = basicDetailsMatch[0];

// Extract Exam Settings from step1Block
const examSettingsStart = "{/* Exam Settings */}";
const examSettingsMatch = step1Block.substring(step1Block.indexOf(examSettingsStart));
const examSettingsParts = examSettingsMatch.split('</div>\n                  </div>\n                )}');
const examSettings = examSettingsParts[0].trim();

// Now build the new Step 1 using step2Block's logic
let newStep1 = step2Block.replace(
    "{isExam && step === 2 && (() => {",
    "{/* ========== STEP 1 FOR EXAMS: Basic Info + Question Sets ========== */}\n                {isExam && step === 1 && (() => {"
);

// Inject BasicDetails into newStep1
newStep1 = newStep1.replace(
    '<div className="space-y-6">',
    `<div className="max-w-3xl mx-auto space-y-6">\n                      ${basicDetails}`
);

// Remove the back button from newStep1
newStep1 = newStep1.replace(
    /\{\/\* Back button \*\/\}[\s\S]*?<\/button>/,
    ""
);

// Delete the old Step 2 header from the string
newStep1 = newStep1.replace(step2Start + '\n', '');


// Build the new Step 2
const newStep2 = `{/* ========== STEP 2 FOR EXAMS: Exam Settings ========== */}
                {isExam && step === 2 && (
                  <div className="max-w-3xl mx-auto space-y-6">
                    ${examSettings}
                    {/* Back button */}
                    <button onClick={() => setStep(1)}
                      className="flex items-center gap-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                      <ChevronLeft className="w-4 h-4" /> Back to Exam Details & Sets
                    </button>
                  </div>
                )}
`;

// Replace in content
let finalContent = content.replace(step1Block, newStep1 + '\n                ');
finalContent = finalContent.replace(step2Block, newStep2 + '\n                ');

fs.writeFileSync('PracticalForm.tsx', finalContent);
console.log("Successfully replaced blocks");

