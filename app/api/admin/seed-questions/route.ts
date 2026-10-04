import { NextRequest, NextResponse } from 'next/server';
import { initAdmin } from '@/lib/firebaseAdmin';
import { requireAdmin } from '@/lib/adminAuth';
import { adminLimiter } from '@/lib/rateLimit';
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
        const { subject, section, questions } = body;

        if (!subject || !section || !questions || !Array.isArray(questions)) {
            return NextResponse.json({ success: false, error: 'Missing required fields or invalid questions array.' }, { status: 400 });
        }

        const app = await initAdmin();
        if (!app) {
            return NextResponse.json({ success: false, error: 'Firebase Admin not configured' }, { status: 500 });
        }
        const db = app.firestore();

        // Seeding into Database transactionally
        const batch = db.batch();
        const collectionRef = db.collection('ccat_questions');
        const metadataRef = db.collection('ccat_metadata').doc('global');
        
        const questionIds: string[] = [];
        let actualCount = 0;

        for (const q of questions) {
            const docId = q.question_id || collectionRef.doc().id;
            const newDocRef = collectionRef.doc(docId);
            
            // Format question to match expected DB schema closely
            const formattedQuestion = {
                id: newDocRef.id,
                title: q.question_label || q.title || q.question_text || "Untitled Question",
                question_text: q.question_text || "",
                question_html: q.question_html || "",
                subject: q.subject || subject,
                topic: q.topic || "General",
                options: q.options || [],
                question_type: q.question_type || 'mcq',
                explanation_html: q.explanation_html || "",
                explanation_text: q.explanation_text || "",
                tags: q.tags || [subject],
                
                // Retain fallbacks for backward compatibility
                branch: "bda",
                year: new Date().getFullYear().toString(),
                
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

        if (actualCount === 0) {
            return NextResponse.json({ success: false, error: 'No valid questions found to seed.' }, { status: 400 });
        }

        // Setup atomic metadata update
        batch.set(metadataRef, {
            questionCount: FieldValue.increment(actualCount),
            allQuestionIds: FieldValue.arrayUnion(...questionIds),
            subjects: FieldValue.arrayUnion(subject),
            topics: FieldValue.arrayUnion(...questions.map((q: any) => q.topic || "General")),
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
            message: `Successfully seeded ${actualCount} questions.`,
            count: actualCount
        }, { status: 200 });

    } catch (e: any) {
        console.error("Error in seed-questions:", e);
        return NextResponse.json({ success: false, error: e.message || 'Internal Server Error' }, { status: 500 });
    }
}
