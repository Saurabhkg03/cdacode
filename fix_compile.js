const fs = require('fs');

// 1. app/api/contests/generate/route.ts
let content = fs.readFileSync('app/api/contests/generate/route.ts', 'utf8');
content = content.replace(/branch: data\.branch \|\| branch/g, "section: data.section || branch");
content = content.replace(/const br = \(q\.branch \|\| ''\)\.toLowerCase\(\);/g, "const sec = (q.section || '').toLowerCase();");
content = content.replace(/return br === branch\.toLowerCase\(\) \|\| br === 'general' \|\| br === 'ga' \|\| br === 'all';/g, "return sec === branch.toLowerCase() || sec === 'general' || sec === 'ga' || sec === 'all';");
content = content.replace(/return sub\.includes\('aptitude'\) \|\| sub\.includes\('verbal'\) \|\| sub\.includes\('reasoning'\) \|\| br === 'general' \|\| br === 'ga';/g, "return sec === 'general' || sec === 'ga';");
content = content.replace(/\(q\.branch\?\.toLowerCase\(\) === branch\.toLowerCase\(\) \|\| q\.branch === 'all' \|\| !q\.branch\)/g, "(q.section?.toLowerCase() === branch.toLowerCase() || q.section === 'all' || !q.section)");
content = content.replace(/branch: branch,/g, "section: branch,");
content = content.replace(/title: `GATE \$\{branch\.toUpperCase\(\)\} \$\{isAdminContest \? 'Live Competition' : 'Practice Contest'\} \(Real\)`/g, "title: `C-CAT ${branch.toUpperCase()} ${isAdminContest ? 'Live Competition' : 'Practice Contest'} (Real)`");
fs.writeFileSync('app/api/contests/generate/route.ts', content);

// 2. app/contests/[contestId]/leaderboard/page.tsx
content = fs.readFileSync('app/contests/[contestId]/leaderboard/page.tsx', 'utf8');
content = content.replace(/contest\.branch/g, 'contest.section');
fs.writeFileSync('app/contests/[contestId]/leaderboard/page.tsx', content);

// 3. app/contests/[contestId]/page.tsx
content = fs.readFileSync('app/contests/[contestId]/page.tsx', 'utf8');
content = content.replace(/contest\.targetSubjects/g, 'contest.targetSections');
fs.writeFileSync('app/contests/[contestId]/page.tsx', content);

// 4. app/contests/page.tsx
content = fs.readFileSync('app/contests/page.tsx', 'utf8');
content = content.replace(/contest\.branch/g, 'contest.section');
fs.writeFileSync('app/contests/page.tsx', content);

// 5. app/exam/[contestId]/live/page.tsx
content = fs.readFileSync('app/exam/[contestId]/live/page.tsx', 'utf8');
content = content.replace(/natAnswer: '',/g, '');
fs.writeFileSync('app/exam/[contestId]/live/page.tsx', content);

// 6. app/exam/[contestId]/result/page.tsx
content = fs.readFileSync('app/exam/[contestId]/result/page.tsx', 'utf8');
content = content.replace(/contest\.branch/g, 'contest.section');
content = content.replace(/<p className="font-mono mt-1 text-zinc-900 dark:text-white">\s*\{resp\.natAnswer \|\| 'None'\}\s*<\/p>/g, '');
content = content.replace(/const isCorrectOption = q\.question_type === 'nat'.*/g, 'const isCorrectOption = false; // ');
content = content.replace(/resp\.natAnswer >= q\.nat_answer_min && resp\.natAnswer <= q\.nat_answer_max/g, 'false');
content = content.replace(/q\.question_type === 'nat'/g, 'false');
fs.writeFileSync('app/exam/[contestId]/result/page.tsx', content);

// 7. app/HomeClient.tsx
content = fs.readFileSync('app/HomeClient.tsx', 'utf8');
content = content.replace(/branchStreakData/g, 'sectionStreakData');
fs.writeFileSync('app/HomeClient.tsx', content);

// 8. app/leaderboard/page.tsx
content = fs.readFileSync('app/leaderboard/page.tsx', 'utf8');
content = content.replace(/branchStats/g, 'sectionStats');
content = content.replace(/branchRatings/g, 'sectionRatings');
fs.writeFileSync('app/leaderboard/page.tsx', content);

// 9. app/profile/[username]/ProfileClient.tsx
content = fs.readFileSync('app/profile/[username]/ProfileClient.tsx', 'utf8');
content = content.replace(/branchStats/g, 'sectionStats');
content = content.replace(/branchActivityCalendar/g, 'sectionActivityCalendar');
content = content.replace(/branchStreakData/g, 'sectionStreakData');
content = content.replace(/branchRatings/g, 'sectionRatings');
content = content.replace(/highestBranchRatings/g, 'highestSectionRatings');
content = content.replace(/branchRatingHistory/g, 'sectionRatingHistory');
fs.writeFileSync('app/profile/[username]/ProfileClient.tsx', content);
