const fs = require('fs');

let content = fs.readFileSync('src/data/sampleQuestions.ts', 'utf8');
content = content.replace(/branch: "/g, 'section: "');
content = content.replace(/nat_answer_min: .*,/g, '');
content = content.replace(/nat_answer_max: .*,/g, '');
content = content.replace(/question_type: "nat",/g, 'question_type: "mcq",\n        options: [\n            { label: "A", text_html: "Option A", is_correct: true },\n            { label: "B", text_html: "Option B", is_correct: false }\n        ],');
fs.writeFileSync('src/data/sampleQuestions.ts', content);
