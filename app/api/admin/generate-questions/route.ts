import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { adminLimiter } from '@/lib/rateLimit';
import { GoogleGenAI, Type, Schema } from '@google/genai';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
    try {
        const decoded = await requireAdmin(req);

        // Rate limiting for admin endpoints
        const { success } = await adminLimiter.limit(decoded.uid);
        if (!success) {
            return NextResponse.json({ success: false, error: 'Too Many Requests' }, { status: 429 });
        }

        const body = await req.json();
        const { subject, modelName, count, customPrompt, referenceBooks, section } = body;

        if (!subject || !modelName || !count) {
            return NextResponse.json({ success: false, error: 'Missing required fields: subject, modelName, or count.' }, { status: 400 });
        }

        const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ success: false, error: 'Gemini API Key is not configured on the server.' }, { status: 500 });
        }

        const app = await initAdmin();
        if (!app) {
            return NextResponse.json({ success: false, error: 'Firebase Admin not configured' }, { status: 500 });
        }
        const db = app.firestore();

        // 1. Configure Google Gen AI SDK
        const ai = new GoogleGenAI({ apiKey });

        // 2. Define the exact response schema using the SDK's Type enums
        const optionSchema: Schema = {
            type: Type.OBJECT,
            properties: {
                label: { type: Type.STRING },
                text_html: { type: Type.STRING },
                is_correct: { type: Type.BOOLEAN }
            },
            required: ["label", "text_html", "is_correct"]
        };

        const questionSchema: Schema = {
            type: Type.ARRAY,
            description: "List of generated multiple choice questions",
            items: {
                type: Type.OBJECT,
                properties: {
                    question_text: { type: Type.STRING },
                    question_html: { type: Type.STRING },
                    subject: { type: Type.STRING },
                    topic: { type: Type.STRING },
                    year: { type: Type.STRING },
                    branch: { type: Type.STRING },
                    question_label: { type: Type.STRING },
                    question_type: { type: Type.STRING },
                    options: {
                        type: Type.ARRAY,
                        items: optionSchema
                    },
                    explanation_text: { type: Type.STRING },
                    explanation_html: { type: Type.STRING },
                    tags: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING }
                    }
                },
                required: [
                    "question_text", "question_html", "subject", "topic", "year", "branch", 
                    "question_label", "question_type", "options", "explanation_text", 
                    "explanation_html", "tags"
                ]
            }
        };

        const systemInstruction = `You are a highly advanced C-DAC C-CAT exam compilation AI agent. Your task is to generate exactly ${count} multiple-choice questions for the subject: "${subject}".

CRITICAL CONSTRAINTS:
1. Every item must be a classic MCQ containing EXACTLY 4 options (labeled A, B, C, D).
2. Exactly ONE option must be marked as correct ("is_correct": true), and three must be false.
3. You must provide a clean, readable text value in "question_text" and an HTML wrapped equivalent in "question_html" (use <code>, <pre>, or formatting if snippet logic is involved). Do the same for options and explanations.
4. "question_type" must strictly be "mcq".
5. The "branch" attribute must act as the Section delimiter. Categorize it explicitly as "${section || "Section A"}".
6. Adhere strictly to this additional custom administrative tuning directive: ${customPrompt || 'None'}
${referenceBooks && referenceBooks.length > 0 ? `7. BASE YOUR CONTENT STRICTLY ON THESE OFFICIAL REFERENCE BOOKS: ${referenceBooks.join(', ')}` : ''}

Output your result strictly as a clean JSON array adhering to the requested generation schema structural definitions. Do not wrap in markdown markdown blocks like \`\`\`json.`;

        // 3. Call the Gemini API with Structured Outputs
        let generatedQuestions = [];
        try {
            const response = await ai.models.generateContent({
                model: modelName,
                contents: "Generate the questions.",
                config: {
                    systemInstruction: systemInstruction,
                    responseMimeType: "application/json",
                    responseSchema: questionSchema,
                    temperature: 0.7,
                }
            });

            if (!response.text) {
                 throw new Error("Gemini returned an empty response.");
            }

            // Parse the returned JSON
            const jsonText = response.text.replace(/```json/g, '').replace(/```/g, '').trim();
            generatedQuestions = JSON.parse(jsonText);
            
            if (!Array.isArray(generatedQuestions)) {
                throw new Error("Parsed JSON is not an array.");
            }
        } catch (error: any) {
            console.error("Gemini Generation Error:", error);
            return NextResponse.json({ success: false, error: `Failed to generate questions: ${error.message}` }, { status: 500 });
        }

        // 4. Seeding into Database transactionally
        const batch = db.batch();
        const collectionRef = db.collection('ccat_questions');
        const metadataRef = db.collection('ccat_metadata').doc('global');
        
        const questionIds: string[] = [];
        let actualCount = 0;

        for (const q of generatedQuestions) {
            const newDocRef = collectionRef.doc();
            
            // Format question to match expected DB schema closely
            const formattedQuestion = {
                id: newDocRef.id,
                title: q.question_text || "Untitled Question",
                subject: q.subject,
                topic: q.topic || "General",
                question_html: q.question_html,
                explanation_html: q.explanation_html,
                options: q.options,
                question_type: 'mcq',
                branch: q.branch || section || "Section A",
                year: q.year || new Date().getFullYear().toString(),
                tags: q.tags || [subject],
                verified: true, // Auto-verified since admin generated it
                createdAt: new Date().toISOString(),
                addedBy: decoded.uid,
                attempts: 0,
                accuracy: 0,
                // Assign numerical randomizer for O(1) random fetching
                randomId: Math.floor(Math.random() * 1000000)
            };

            batch.set(newDocRef, formattedQuestion);
            questionIds.push(newDocRef.id);
            actualCount++;
        }

        // Setup atomic metadata update
        batch.set(metadataRef, {
            questionCount: FieldValue.increment(actualCount),
            allQuestionIds: FieldValue.arrayUnion(...questionIds),
            subjectCounts: {
                [subject]: FieldValue.increment(actualCount)
            },
            questionTypeCounts: {
                'mcq': FieldValue.increment(actualCount)
            }
        }, { merge: true });

        // Commit the transaction
        await batch.commit();

        return NextResponse.json({ 
            success: true, 
            message: `Successfully generated and seeded ${actualCount} questions.`,
            count: actualCount
        }, { status: 200 });

    } catch (e: any) {
        console.error("Error in generate-questions:", e);
        return NextResponse.json({ success: false, error: e.message || 'Internal Server Error' }, { status: 500 });
    }
}
