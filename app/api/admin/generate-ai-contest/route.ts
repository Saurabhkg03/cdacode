import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebaseAdmin';
import admin from 'firebase-admin';
import { Contest, Question, Section } from '@/types/exam';

export const maxDuration = 300; // Allow 5 minutes maximum for generation

const AI_PROMPT_TEMPLATE = `
You are an expert examiner for CDAC C-CAT (India). 
Generate {COUNT} HIGH QUALITY questions for the C-CAT exam.
Difficulty Level: {DIFFICULTY}
Mode/Subject: {SUBJECT}

CRITICAL RULES:
1. Format output STRICTLY as a JSON Array of objects.
2. The "options" array MUST have EXACTLY 4 options.
3. The "correct_option" MUST exactly match the id (A, B, C, or D) of the correct option.
4. "marks" MUST be 3 and "negative_marks" MUST be 1.
5. Provide a short "explanation" for the correct answer.
6. The "title" MUST be a LeetCode-style short title (max 3-4 words) describing the problem, e.g., "Two Sum", "Max Subarray", "Pointer Arithmetic", "SQL Join".
7. If the question contains code, format the code properly using Markdown code blocks (e.g. \`\`\`c ... \`\`\`) inside the "question_html" and "explanation" fields so it renders beautifully. Use <br> for newlines in text if needed, but for code prefer markdown formatting.
8. NEVER include markdown backticks around the JSON output itself. Just the raw array.

JSON format:
[
  {
    "title": "Short Leetcode-style Title",
    "question_html": "Question text here... <br> \`\`\`c\nint main() { return 0; }\n\`\`\`",
    "options": [
      { "id": "A", "label": "A", "text_html": "Option 1" },
      { "id": "B", "label": "B", "text_html": "Option 2" },
      { "id": "C", "label": "C", "text_html": "Option 3" },
      { "id": "D", "label": "D", "text_html": "Option 4" }
    ],
    "difficulty": "{DIFFICULTY}",
    "verified": true
  }
]

Please generate exactly {COUNT} questions now. Remember, only output valid JSON!
`;

const encoder = new TextEncoder();

export async function POST(req: NextRequest) {
    try {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        
        const token = authHeader.split('Bearer ')[1];
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(token);
        } catch (e) {
            return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
        }

        const body = await req.json();
        const { model, mode, branch, customSubject, customCount, contestTitle, difficulty, isPublic, isRated, uid } = body;

        if (!process.env.GROQ_API_KEY) {
            return NextResponse.json({ error: 'GROQ_API_KEY is not configured on the server.' }, { status: 500 });
        }

        const stream = new ReadableStream({
            async start(controller) {
                const sendUpdate = (log: string) => {
                    controller.enqueue(encoder.encode(JSON.stringify({ log }) + '\n'));
                };

                const sendSuccess = (data: any) => {
                    controller.enqueue(encoder.encode(JSON.stringify({ status: 'success', ...data }) + '\n'));
                    controller.close();
                };

                const sendError = (error: string) => {
                    controller.enqueue(encoder.encode(JSON.stringify({ error }) + '\n'));
                    controller.close();
                };

                try {
                    if (!adminDb) {
                        throw new Error("Firebase Admin DB not initialized");
                    }

                    // 1. Determine requirements
                    let subjectStr = '';
                    let totalCount = 0;
                    let targetBranch = '';

                    if (mode === 'section-a') {
                        subjectStr = 'English, Quantitative Aptitude, Reasoning, Computer Fundamentals';
                        totalCount = 50;
                        targetBranch = 'ga'; // Generic / Section A
                    } else if (mode === 'section-b') {
                        subjectStr = 'C Programming, Data Structures, OOP (C++), Operating Systems, Networking, Big Data & AI';
                        totalCount = 50;
                        targetBranch = 'cse';
                    } else if (mode === 'section-c') {
                        subjectStr = 'Computer Architecture, Digital Electronics, Microprocessors';
                        totalCount = 50;
                        targetBranch = 'ece';
                    } else if (mode === 'custom') {
                        subjectStr = customSubject;
                        totalCount = customCount;
                        targetBranch = 'cse'; // Default generic
                    } else if (mode === 'full-exam') {
                        // For full exam, we would need 150 Qs. 
                        // To avoid timeout, we might have to batch, but for now we'll do 50 Qs as a demo full exam or single prompt.
                        subjectStr = 'Full C-CAT Syllabus (A, B, C)';
                        totalCount = 150; // VERY aggressive for a single LLM prompt, likely will truncate. 
                        targetBranch = 'cse';
                    }

                    const BATCH_SIZE = 10;
                    let parsedQuestions: any[] = [];
                    
                    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

                    sendUpdate(`[AI] Preparing prompt for ${totalCount} questions on ${subjectStr}...`);
                    
                    for (let i = 0; i < totalCount; i += BATCH_SIZE) {
                        const batchCount = Math.min(BATCH_SIZE, totalCount - i);
                        sendUpdate(`[AI] Generating batch ${Math.floor(i/BATCH_SIZE) + 1} (${batchCount} questions)...`);
                        
                        const prompt = AI_PROMPT_TEMPLATE
                            .replace(/{COUNT}/g, batchCount.toString())
                            .replace(/{SUBJECT}/g, subjectStr)
                            .replace(/{DIFFICULTY}/g, difficulty);

                        let retries = 3;
                        let success = false;

                        while (retries > 0 && !success) {
                            try {
                                const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
                                    },
                                    body: JSON.stringify({
                                        model: model,
                                        messages: [
                                            { role: 'system', content: 'You are an API that outputs strictly raw valid JSON arrays.' },
                                            { role: 'user', content: prompt }
                                        ],
                                        temperature: 0.7,
                                        max_tokens: 3000,
                                    })
                                });

                                if (!groqRes.ok) {
                                    const err = await groqRes.text();
                                    if (groqRes.status === 429) {
                                        sendUpdate(`[AI] Rate limit hit. Waiting 15 seconds before retry... (${retries} retries left)`);
                                        await sleep(15000);
                                        retries--;
                                        continue;
                                    }
                                    throw new Error(`Groq API Error: ${groqRes.status} - ${err}`);
                                }

                                const groqData = await groqRes.json();
                                let rawOutput = groqData.choices?.[0]?.message?.content || '[]';
                                
                                rawOutput = rawOutput.replace(/^\`\`\`json/m, '').replace(/\`\`\`$/m, '').trim();

                                let batchParsed: any[] = [];
                                try {
                                    batchParsed = JSON.parse(rawOutput);
                                } catch (e) {
                                    throw new Error("Failed to parse LLM output as JSON for this batch.");
                                }

                                if (!Array.isArray(batchParsed)) {
                                    throw new Error("LLM did not return an array.");
                                }

                                parsedQuestions.push(...batchParsed);
                                sendUpdate(`[AI] Batch success! Generated ${batchParsed.length} questions.`);
                                success = true;

                                // Prevent immediate rate limit hit on next batch
                                if (i + BATCH_SIZE < totalCount) {
                                    await sleep(5000); 
                                }

                            } catch (error: any) {
                                if (retries === 1) throw error; // Re-throw on last attempt
                                sendUpdate(`[AI] Batch error: ${error.message}. Retrying...`);
                                await sleep(5000);
                                retries--;
                            }
                        }
                    }

                    sendUpdate(`[AI] Successfully generated and parsed a total of ${parsedQuestions.length} questions!`);

                    // 3. Seed to DB
                    sendUpdate(`[DB] Seeding generated questions into 'ccat_questions'...`);
                    
                    const batch = adminDb.batch();
                    const newQuestions: Question[] = [];
                    const qCol = adminDb.collection('ccat_questions');
                    const timestamp = new Date().toISOString();

                    let globalQIndex = 1;
                    parsedQuestions.forEach((qData) => {
                        const newDocRef = qCol.doc();
                        
                        const qObj: any = {
                            id: newDocRef.id,
                            title: qData.title || 'AI Generated Question',
                            question_html: qData.question_html || '',
                            options: (qData.options || []).map((opt: any) => ({
                                label: opt.id || opt.label || '',
                                text_html: opt.text || opt.text_html || '',
                                is_correct: String(opt.id || opt.label).trim().toLowerCase() === String(qData.correct_option).trim().toLowerCase()
                            })),
                            explanation_html: qData.explanation || 'No explanation provided.',
                            subject: qData.subject || subjectStr,
                            topic: qData.topic || 'General',
                            question_type: 'mcq',
                            marks: qData.marks || 3,
                            negative_marks: qData.negative_marks || 1,
                            difficulty: difficulty,
                            verified: true,
                            createdAt: timestamp,
                            updatedAt: timestamp,
                            qIndex: globalQIndex++
                        };
                        
                        batch.set(newDocRef, qObj);
                        newQuestions.push({ ...qObj, section: mode });
                    });

                    await batch.commit();
                    sendUpdate(`[DB] Saved ${newQuestions.length} questions to Firestore.`);

                    // Update Global Metadata Count (Rough estimation to avoid transaction bottleneck)
                    try {
                        const globalMetaRef = adminDb.collection('ccat_metadata').doc('global');
                        const docSnap = await globalMetaRef.get();
                        const currentCount = docSnap.exists ? (docSnap.data()?.questionCount || 0) : 0;
                        await globalMetaRef.set({ questionCount: currentCount + newQuestions.length }, { merge: true });
                    } catch (e) {
                        sendUpdate(`[DB] Warning: Could not update global metadata count.`);
                    }

                    // 4. Create Contest
                    sendUpdate(`[Contest] Constructing Contest Object...`);
                    const newContestId = `${Date.now()}-ai-${targetBranch}`;
                    
                    const sections: Section[] = [
                        { name: mode === 'custom' ? customSubject : mode.toUpperCase(), questions: newQuestions }
                    ];

                    const totalMarks = newQuestions.reduce((sum, q) => sum + (Number(q.marks) || 1), 0);

                    const contestObj: Contest = {
                        id: newContestId,
                        title: contestTitle || `AI Generated Contest (${newQuestions.length} Qs)`,
                        type: 'mock',
                        section: targetBranch,
                        branch: branch || 'ece',
                        createdBy: uid || 'AI Generator',
                        isPublic: isPublic,
                        isRated: isRated,
                        difficulty: difficulty,
                        durationMinutes: newQuestions.length > 50 ? 120 : 60,
                        totalMarks: totalMarks,
                        sections: sections,
                        description: `Automatically generated via ${model} LLM. Subject: ${subjectStr}.`,
                        examMode: mode,
                        targetSections: [subjectStr]
                    };

                    await adminDb.collection('contests').doc(newContestId).set(contestObj);
                    
                    sendSuccess({
                        contestId: newContestId,
                        questionsGenerated: newQuestions.length
                    });

                } catch (err: any) {
                    console.error("AI Generation Error:", err);
                    sendError(err.message || 'An unknown error occurred during AI generation');
                }
            }
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'application/json',
                'Transfer-Encoding': 'chunked',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error: any) {
        console.error("Endpoint Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
