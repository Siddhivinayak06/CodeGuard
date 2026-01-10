import { Monaco } from "@monaco-editor/react";

// Helper type for Monaco
type ITextModel = any;
type Position = any;

// --- Python Snippets & Keywords ---
const pythonKeywords = [
    "def", "class", "import", "from", "if", "elif", "else", "while", "for", "in",
    "try", "except", "finally", "with", "as", "lambda", "return", "yield", "print",
    "True", "False", "None", "and", "or", "not", "is", "break", "continue", "pass",
    "raise", "global", "nonlocal", "assert", "del", "async", "await"
];

const pythonSnippets = [
    {
        label: "def",
        documentation: "Function definition",
        insertText: "def ${1:function_name}(${2:args}):\n\t${3:pass}"
    },
    {
        label: "if",
        documentation: "If statement",
        insertText: "if ${1:condition}:\n\t${2:pass}"
    },
    {
        label: "for",
        documentation: "For loop",
        insertText: "for ${1:item} in ${2:iterable}:\n\t${3:pass}"
    },
    {
        label: "class",
        documentation: "Class definition",
        insertText: "class ${1:ClassName}:\n\tdef __init__(self, ${2:args}):\n\t\t${3:pass}"
    },
    {
        label: "print",
        documentation: "Print to console",
        insertText: "print(${1:object})"
    },
    {
        label: "main",
        documentation: "Main block",
        insertText: "if __name__ == \"__main__\":\n\t${1:main()}"
    },
    {
        label: "try",
        documentation: "Try-except block",
        insertText: "try:\n\t${1:pass}\nexcept ${2:Exception} as ${3:e}:\n\t${4:pass}"
    }
];

// --- C/C++ Keywords & Snippets ---
const cppKeywords = [
    "int", "char", "float", "double", "bool", "void", "auto", "const", "static",
    "struct", "class", "enum", "union", "if", "else", "for", "while", "do",
    "switch", "case", "default", "break", "continue", "return", "try", "catch",
    "throw", "new", "delete", "public", "protected", "private", "namespace",
    "using", "template", "typename", "include", "define", "ifdef", "ifndef", "endif"
];

const cppSnippets = [
    {
        label: "main",
        documentation: "Main function",
        insertText: "int main() {\n\t${1:// code}\n\treturn 0;\n}"
    },
    {
        label: "include <stdio.h>",
        documentation: "Standard I/O header",
        insertText: "#include <stdio.h>"
    },
    {
        label: "include <iostream>",
        documentation: "C++ I/O stream",
        insertText: "#include <iostream>\nusing namespace std;"
    },
    {
        label: "for",
        documentation: "For loop",
        insertText: "for (int ${1:i} = 0; ${1:i} < ${2:count}; ++${1:i}) {\n\t${3:// code}\n}"
    },
    {
        label: "cout",
        documentation: "Print to standard output (C++)",
        insertText: "cout << ${1:\"Hello\"} << endl;"
    },
    {
        label: "printf",
        documentation: "Print to standard output (C)",
        insertText: "printf(\"${1:%s}\", ${2:args});"
    },
    {
        label: "class",
        documentation: "Class definition",
        insertText: "class ${1:ClassName} {\npublic:\n\t${1:ClassName}() {\n\t}\n};"
    }
];

// --- Java Keywords & Snippets ---
const javaKeywords = [
    "public", "private", "protected", "static", "final", "void", "int", "double",
    "boolean", "char", "float", "long", "byte", "short", "class", "interface",
    "enum", "extends", "implements", "new", "this", "super", "return", "if", "else",
    "for", "while", "do", "switch", "case", "break", "continue", "try", "catch",
    "finally", "throw", "throws", "package", "import", "abstract", "synchronized"
];

const javaSnippets = [
    {
        label: "main",
        documentation: "Main method",
        insertText: "public static void main(String[] args) {\n\t${1:// code}\n}"
    },
    {
        label: "sout",
        documentation: "Print to stdout",
        insertText: "System.out.println(${1:\"Hello\"});"
    },
    {
        label: "class",
        documentation: "Class definition",
        insertText: "public class ${1:ClassName} {\n\tpublic ${1:ClassName}() {\n\t}\n}"
    },
    {
        label: "for",
        documentation: "For loop",
        insertText: "for (int ${1:i} = 0; ${1:i} < ${2:count}; ${1:i}++) {\n\t${3:// code}\n}"
    },
    {
        label: "try",
        documentation: "Try-catch block",
        insertText: "try {\n\t${1:// code}\n} catch (Exception e) {\n\te.printStackTrace();\n}"
    }
];

// --- Registration Logic ---

const isRegistered = {
    python: false,
    c: false,
    cpp: false,
    java: false
};

export function registerCompletionProviders(monaco: Monaco) {
    // Helper to create completion item
    const createItem = (label: string, kind: any, insertText: string, documentation?: string) => ({
        label,
        kind,
        insertText,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        documentation: documentation || label,
        range: undefined as any // Monaco handles range automatically if undefined
    });

    const createKeywordItem = (keyword: string) => ({
        label: keyword,
        kind: monaco.languages.CompletionItemKind.Keyword,
        insertText: keyword,
        range: undefined as any
    });

    // --- Python Provider ---
    if (!isRegistered.python) {
        monaco.languages.registerCompletionItemProvider("python", {
            provideCompletionItems: (model: ITextModel, position: Position) => {
                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn
                };

                const keywordItems = pythonKeywords.map(createKeywordItem);
                const snippetItems = pythonSnippets.map(s => createItem(s.label, monaco.languages.CompletionItemKind.Snippet, s.insertText, s.documentation));

                return {
                    suggestions: [...keywordItems, ...snippetItems].map(item => ({ ...item, range }))
                };
            }
        });
        isRegistered.python = true;
    }

    // --- C Provider ---
    if (!isRegistered.c) {
        monaco.languages.registerCompletionItemProvider("c", {
            provideCompletionItems: (model: ITextModel, position: Position) => {
                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn
                };

                const keywordItems = cppKeywords.map(createKeywordItem);
                const snippetItems = cppSnippets.map(s => createItem(s.label, monaco.languages.CompletionItemKind.Snippet, s.insertText, s.documentation));

                return {
                    suggestions: [...keywordItems, ...snippetItems].map(item => ({ ...item, range }))
                };
            }
        });
        isRegistered.c = true;
    }

    // --- C++ Provider ---
    if (!isRegistered.cpp) {
        monaco.languages.registerCompletionItemProvider("cpp", {
            provideCompletionItems: (model: ITextModel, position: Position) => {
                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn
                };

                const keywordItems = cppKeywords.map(createKeywordItem);
                const snippetItems = cppSnippets.map(s => createItem(s.label, monaco.languages.CompletionItemKind.Snippet, s.insertText, s.documentation));

                return {
                    suggestions: [...keywordItems, ...snippetItems].map(item => ({ ...item, range }))
                };
            }
        });
        isRegistered.cpp = true;
    }

    // --- Java Provider ---
    if (!isRegistered.java) {
        monaco.languages.registerCompletionItemProvider("java", {
            provideCompletionItems: (model: ITextModel, position: Position) => {
                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn
                };

                const keywordItems = javaKeywords.map(createKeywordItem);
                const snippetItems = javaSnippets.map(s => createItem(s.label, monaco.languages.CompletionItemKind.Snippet, s.insertText, s.documentation));

                return {
                    suggestions: [...keywordItems, ...snippetItems].map(item => ({ ...item, range }))
                };
            }
        });
        isRegistered.java = true;
    }
}
