"use client";

import { useState, useEffect } from 'react';
import { X, Copy, Edit2, CheckCircle, Save } from 'lucide-react';

interface PromptConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const DEFAULT_PROMPT = `# Universal Question Bank JSON Schema

Generate a question bank as a **JSON array of question objects**.

The schema must remain **exactly the same regardless of subject, branch, course, or topic**. Only the actual question content, subject, topic, tags, options, and answers should change.

The output must be valid JSON and directly usable with:

\`\`\`python
json.loads(data)
\`\`\`

Do not add any fields that are not specified below, and do not remove any required fields.

---

## Question Object Schema

Every question must follow this structure:

\`\`\`json
{
  "question_html": "",
  "question_text": "",
  "subject": "",
  "topic": "",
  "year": "",
  "branch": "",
  "question_label": "",
  "options": [],
  "question_type": "",
  "nat_answer_min": null,
  "nat_answer_max": null,
  "explanation_redirect_url": null,
  "explanation_html": "",
  "explanation_text": "",
  "question_images": [],
  "explanation_images": [],
  "tags": [],
  "question_id": ""
}
\`\`\`

---

## Field Definitions

### 1. \`question_html\`

**Type:** String

Contains the complete question formatted using HTML.

Use HTML when formatting improves readability.

Examples:

\`\`\`html
<p>What is the output of the following program?</p>
\`\`\`

For code:

\`\`\`html
<pre><code>print("Hello World")</code></pre>
\`\`\`

For inline code:

\`\`\`html
<p>Which function is used with <code>GROUP BY</code>?</p>
\`\`\`

For mathematical expressions, preserve the required mathematical notation/LaTeX format if applicable.

This field should contain the **complete formatted version of the question**.

---

### 2. \`question_text\`

**Type:** String

Plain-text version of \`question_html\`.

It must contain the same information as \`question_html\`, but without HTML formatting.

Do not remove important:

* code
* equations
* values
* conditions
* examples
* constraints

---

### 3. \`subject\`

**Type:** String

The broad academic subject.

Examples:

\`\`\`text
C Programming
Python
Java
SQL
DBMS
Data Structures
Operating Systems
Computer Networks
Statistics
Machine Learning
Big Data
Hadoop
Spark
Artificial Intelligence
Digital Electronics
Communication Systems
Engineering Mathematics
\`\`\`

The value depends on the question being generated.

---

### 4. \`topic\`

**Type:** String

The specific topic/concept being tested.

Examples:

\`\`\`text
Pointers
Arrays
OOP
Inheritance
SQL Joins
Window Functions
Normalization
Process Scheduling
TCP/IP
Probability
Regression
Clustering
\`\`\`

The topic should be more specific than \`subject\`.

---

### 5. \`year\`

**Type:** String

The year associated with the question.

Examples:

\`\`\`json
"year": "2026"
\`\`\`

If the question is a newly generated practice question rather than an actual previous-year question, use the requested generation year.

Always store the year as a string.

Do not falsely claim that a generated question appeared in an actual examination.

---

### 6. \`branch\`

**Type:** String

The academic programme, branch, course, or examination category for which the question is intended.

Examples:

\`\`\`text
DBDA
DAC
BDA
DBDA
DAC
CDAC
C-CAT BDA
\`\`\`

Use the value specified by the user.

---

### 7. \`question_label\`

**Type:** String

Human-readable question number/label.

Examples:

\`\`\`text
Question 1
Question 2
Question 3
\`\`\`

If generating questions starting from question 51:

\`\`\`text
Question 51
Question 52
Question 53
\`\`\`

Maintain sequential numbering according to the requested starting number. (Note: The admin import tool will automatically append the correct sequential index based on existing database questions).

---

### 8. \`options\`

**Type:** Array of Objects

Contains answer choices for MCQ and MSQ questions.

Each option must have exactly these fields:

\`\`\`json
{
  "label": "A",
  "text_html": "",
  "text": "",
  "is_correct": false
}
\`\`\`

#### \`label\`

Usually:

\`\`\`text
A
B
C
D
\`\`\`

Use additional labels such as E when the question requires more than four options.

#### \`text_html\`

HTML-formatted option text.

#### \`text\`

Plain-text version of the option.

#### \`is_correct\`

Boolean:

\`\`\`json
true
\`\`\`

or

\`\`\`json
false
\`\`\`

For MCQ:

* Exactly **one** option must be correct.

For MSQ:

* **Two or more** options may be correct.

For NAT:

\`\`\`json
"options": []
\`\`\`

---

### 9. \`question_type\`

**Type:** String

Allowed values:

\`\`\`text
mcq
msq
nat
\`\`\`

#### MCQ

Multiple Choice Question.

Exactly one correct answer.

#### MSQ

Multiple Select Question.

More than one answer may be correct.

#### NAT

Numerical Answer Type.

The answer is represented using \`nat_answer_min\` and \`nat_answer_max\`.

---

### 10. \`nat_answer_min\`

**Type:** String or Null

Used only for NAT questions.

Example:

\`\`\`json
"nat_answer_min": "10"
\`\`\`

For MCQ/MSQ:

\`\`\`json
"nat_answer_min": null
\`\`\`

---

### 11. \`nat_answer_max\`

**Type:** String or Null

Used only for NAT questions.

For an exact answer:

\`\`\`json
"nat_answer_min": "25",
"nat_answer_max": "25"
\`\`\`

For an acceptable range:

\`\`\`json
"nat_answer_min": "24.5",
"nat_answer_max": "25.5"
\`\`\`

For MCQ/MSQ:

\`\`\`json
"nat_answer_max": null
\`\`\`

---

### 12. \`explanation_redirect_url\`

**Type:** String or Null

Optional URL pointing to an external explanation.

If there is no external explanation:

\`\`\`json
"explanation_redirect_url": null
\`\`\`

Never invent URLs.

---

### 13. \`explanation_html\`

**Type:** String

Complete explanation/solution formatted using HTML.

The explanation should teach the concept rather than simply state the answer.

For example:

\`\`\`html
<p><strong>Explanation:</strong> The correct answer is <strong>B</strong> because...</p>
\`\`\`

For numerical/problem-solving questions, include the important calculation steps.

For programming questions, explain the relevant execution logic.

For theoretical questions, explain the underlying concept.

---

### 14. \`explanation_text\`

**Type:** String

Plain-text equivalent of \`explanation_html\`.

It should contain the same substantive information without HTML formatting.

---

### 15. \`question_images\`

**Type:** Array

Contains metadata for images associated with the question.

If there are no images:

\`\`\`json
"question_images": []
\`\`\`

If images are provided:

\`\`\`json
"question_images": [
  {
    "original_url": "https://example.com/image.png",
    "local_path": "images/question_001.png",
    "filename": "question_001.png"
  }
]
\`\`\`

Do not invent image URLs or file paths.

---

### 16. \`explanation_images\`

**Type:** Array

Same structure as \`question_images\`.

If there are no explanation images:

\`\`\`json
"explanation_images": []
\`\`\`

Otherwise:

\`\`\`json
"explanation_images": [
  {
    "original_url": "https://example.com/solution.png",
    "local_path": "images/solution_001.png",
    "filename": "solution_001.png"
  }
]
\`\`\`

---

### 17. \`tags\`

**Type:** Array of Strings

Contains relevant searchable keywords.

Example:

\`\`\`json
"tags": [
  "DBDA",
  "Python",
  "OOP",
  "Inheritance"
]
\`\`\`

Tags should generally include:

1. Programme/branch
2. Subject
3. Topic
4. Important concepts

Do not add irrelevant tags.

---

### 18. \`question_id\`

**Type:** String

Unique identifier for every question.

It must never be duplicated.

Recommended format:

\`\`\`text
<branch>_<subject>_<number>
\`\`\`

Examples:

\`\`\`text
dbda_python_001
dbda_sql_001
dbda_dbms_001
bda_001
dac_java_001
\`\`\`

If the subject contains spaces, use a consistent normalized form.

---

# Question Type Rules

## MCQ

\`\`\`json
"question_type": "mcq"
\`\`\`

Requirements:

* Normally 4 options.
* Exactly one option has \`"is_correct": true\`.
* All other options have \`"is_correct": false\`.
* \`nat_answer_min\` must be \`null\`.
* \`nat_answer_max\` must be \`null\`.

---

## MSQ

\`\`\`json
"question_type": "msq"
\`\`\`

Requirements:

* Normally 4 options.
* At least two options should be correct.
* More than one option can have \`"is_correct": true\`.
* \`nat_answer_min\` must be \`null\`.
* \`nat_answer_max\` must be \`null\`.

---

## NAT

\`\`\`json
"question_type": "nat"
\`\`\`

Requirements:

* \`options\` must be an empty array.
* \`nat_answer_min\` must contain the minimum accepted answer.
* \`nat_answer_max\` must contain the maximum accepted answer.
* The question must contain enough information to calculate the numerical answer.

Example:

\`\`\`json
{
  "options": [],
  "question_type": "nat",
  "nat_answer_min": "10",
  "nat_answer_max": "10"
}
\`\`\`

---

# HTML Rules

Use HTML only inside fields intended for HTML.

Common formatting:

\`\`\`html
<p>Question text</p>
\`\`\`

\`\`\`html
<strong>Important</strong>
\`\`\`

\`\`\`html
<code>variable</code>
\`\`\`

\`\`\`html
<pre><code>code here</code></pre>
\`\`\`

Escape characters where necessary so the entire output remains valid JSON.

For example:

\`\`\`text
>
\`\`\`

inside an HTML string should be represented appropriately as:

\`\`\`text
&gt;
\`\`\`

Do not place Markdown formatting inside HTML fields.

---

# Content Quality Rules

Questions must be:

* Academically correct
* Unambiguous
* Relevant to the specified subject
* Appropriate for the specified branch/course
* Non-repetitive
* Appropriate to the requested difficulty
* Technically accurate
* Self-contained

Do not create questions that depend on missing information.

Do not create ambiguous MCQs where multiple answers could reasonably be considered correct.

For programming questions, ensure the code is syntactically valid unless the question specifically asks the student to identify an error.

For numerical questions, verify the calculation before generating the answer.

For theoretical questions, ensure the explanation accurately represents the concept.

---

# Difficulty Distribution

When generating a batch, support:

\`\`\`text
Basic
Intermediate
Advanced
Mixed
\`\`\`

If \`Mixed\` is requested, distribute difficulty rather than making every question basic.

A typical 25-question mixed batch can contain approximately:

* 5 Basic
* 12 Intermediate
* 8 Advanced

The exact distribution can vary depending on the subject.

---

# Avoid Repetition

Do not generate multiple questions that test exactly the same fact.

Instead, vary question styles:

* Conceptual questions
* Code/output questions
* Query-writing questions
* Numerical problems
* Scenario-based questions
* Error identification
* Application-based questions
* Comparison questions
* Multi-concept questions

Questions can test the same broad topic but should require different reasoning.

---

# Important Data Integrity Rules

Before returning the JSON, verify:

1. The output is a valid JSON array.
2. Every question has all required fields.
3. No unexpected fields have been added.
4. Every \`question_id\` is unique.
5. \`question_label\` numbering is correct.
6. \`question_html\` and \`question_text\` contain equivalent content.
7. \`explanation_html\` and \`explanation_text\` contain equivalent content.
8. Every MCQ has exactly one correct option.
9. Every MSQ has multiple correct options.
10. Every NAT has an empty options array.
11. MCQ/MSQ questions have \`null\` NAT fields.
12. NAT questions have valid numerical ranges.
13. No URLs have been fabricated.
14. No image metadata has been fabricated.
15. All answers have been verified.
16. All explanations agree with the marked answers.
17. The JSON contains no comments.
18. The JSON contains no Markdown outside the array.

---

# Generation Parameters

When generating a question bank, use these parameters:

**Programme/Branch:** \`[BRANCH]\`

**Subject:** \`[SUBJECT]\`

**Topics:** \`[TOPICS]\`

**Number of Questions:** \`[NUMBER]\`

**Starting Question Number:** \`[STARTING_NUMBER]\`

**Difficulty:** \`[BASIC / INTERMEDIATE / ADVANCED / MIXED]\`

**Question Types:** \`[MCQ / MSQ / NAT / MIXED]\`

**Year:** \`[YEAR]\`

Generate the requested questions while keeping the **exact universal schema above**.

Return **ONLY the JSON array**.`;

export default function PromptConfigModal({ isOpen, onClose }: PromptConfigModalProps) {
    const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
    const [isEditing, setIsEditing] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        // Load custom prompt from localStorage if it exists
        const saved = localStorage.getItem('admin_generation_prompt');
        if (saved) {
            setPrompt(saved);
        }
    }, []);

    const handleSave = () => {
        localStorage.setItem('admin_generation_prompt', prompt);
        setIsEditing(false);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(prompt);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleReset = () => {
        if (window.confirm('Reset to default prompt? This will erase your custom changes.')) {
            setPrompt(DEFAULT_PROMPT);
            localStorage.removeItem('admin_generation_prompt');
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-zinc-950 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden border border-gray-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-zinc-800">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                        <Copy className="w-5 h-5 text-indigo-500" />
                        AI Generation Prompt
                    </h2>
                    <div className="flex items-center gap-2">
                        {!isEditing ? (
                            <>
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="px-3 py-1.5 flex items-center gap-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-sm font-medium rounded-lg transition-colors"
                                >
                                    <Edit2 className="w-4 h-4" /> Edit
                                </button>
                                <button
                                    onClick={handleCopy}
                                    className="px-3 py-1.5 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
                                >
                                    {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                                    {copied ? 'Copied!' : 'Copy to Clipboard'}
                                </button>
                            </>
                        ) : (
                            <>
                                <button
                                    onClick={handleReset}
                                    className="px-3 py-1.5 text-sm font-medium text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                >
                                    Reset Default
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="px-3 py-1.5 flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
                                >
                                    <Save className="w-4 h-4" /> Save
                                </button>
                            </>
                        )}
                        <button
                            onClick={onClose}
                            className="ml-2 p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-hidden p-4 bg-gray-50 dark:bg-zinc-900 flex flex-col">
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        Copy this prompt and provide it to any LLM (like ChatGPT, Claude, or Gemini) to generate valid questions.
                    </p>
                    
                    {isEditing ? (
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            className="w-full h-full p-4 font-mono text-sm border border-indigo-300 dark:border-indigo-800 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white dark:bg-zinc-950 text-gray-900 dark:text-gray-100 resize-none shadow-inner"
                            placeholder="Enter your custom JSON schema prompt here..."
                        />
                    ) : (
                        <div className="w-full h-full p-4 font-mono text-sm border border-gray-200 dark:border-zinc-800 rounded-lg overflow-y-auto bg-white dark:bg-zinc-950 text-gray-800 dark:text-gray-300 whitespace-pre-wrap shadow-inner relative">
                            {prompt}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
