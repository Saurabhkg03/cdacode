const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = [...walk('app/api'), ...walk('src')];

let totalChanges = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // replacements
    content = content.replace(/questions_\$\{branch\}/g, 'ccat_questions');
    content = content.replace(/C-CAT \$\{branch\.toUpperCase\(\)\}/g, 'C-CAT BDA');
    content = content.replace(/\$\{branch\.toUpperCase\(\)\} Custom Test/g, 'BDA Custom Test');
    content = content.replace(/questions_ece/g, 'ccat_questions');
    content = content.replace(/questions_cse/g, 'ccat_questions');
    content = content.replace(/branchRatings: \{ cse: 1500 \}/g, 'branchRatings: { bda: 1500 }');
    content = content.replace(/highestBranchRatings: \{ cse: 1500 \}/g, 'highestBranchRatings: { bda: 1500 }');
    content = content.replace(/branch: 'cse'/g, "branch: 'bda'");
    content = content.replace(/\|\| 'ece'/g, "|| 'bda'");
    content = content.replace(/targetBranch = 'cse'/g, "targetBranch = 'bda'");
    content = content.replace(/targetBranch = 'ece'/g, "targetBranch = 'bda'");
    content = content.replace(/\['ece', 'cse', 'me', 'ce', 'ee'\]/g, "['bda']");
    content = content.replace(/\['ece', 'cse', 'me', 'ee', 'in'\]/g, "['bda']");
    content = content.replace(/branchRatings\.ece/g, "branchRatings.bda");

    // PromptConfigModal.tsx specific
    if (file.includes('PromptConfigModal.tsx')) {
        content = content.replace(/ECE\nCSE\nMechanical\nCDAC\nGATE-ECE\nGATE-CSE/g, 'BDA\nDBDA\nDAC\nCDAC\nC-CAT BDA');
        content = content.replace(/gate_ece_001/g, 'bda_001');
    }

    // JsonImportModal.tsx specific
    if (file.includes('JsonImportModal.tsx')) {
        content = content.replace(/tags: q\.tags \|\| \[branch, subject, topic, `GATE \$\{year\}`\]\.filter\(Boolean\)/g, 'tags: q.tags || [branch, subject, topic].filter(Boolean)');
    }

    // sampleQuestions.ts specific
    if (file.includes('sampleQuestions.ts')) {
        content = content.replace(/gate_2024_cse_/g, 'bda_sample_');
        content = content.replace(/gate_2024_ece_/g, 'bda_sample_');
        content = content.replace(/gate_2024_ga_/g, 'bda_sample_ga_');
        content = content.replace(/gate_2024_me_/g, 'bda_sample_me_');
        content = content.replace(/section: "cse"/g, 'section: "bda"');
        content = content.replace(/section: "ece"/g, 'section: "bda"');
        content = content.replace(/section: "general"/g, 'section: "bda"');
        content = content.replace(/section: "me"/g, 'section: "bda"');
    }

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        totalChanges++;
        console.log('Updated: ' + file);
    }
});

console.log('Total files updated: ' + totalChanges);
