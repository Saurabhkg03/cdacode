import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
    console.error("Missing Firebase Admin credentials in environment");
    process.exit(1);
}

if (!getApps().length) {
    initializeApp({
        credential: cert({
            projectId,
            clientEmail,
            privateKey
        })
    });
}

const db = getFirestore();

async function run() {
    console.log("Rebuilding ccat_metadata/global...");
    const snapshot = await db.collection('ccat_questions').get();
    
    let actualCount = 0;
    const questionIds: string[] = [];
    const subjects = new Set<string>();
    const topics = new Set<string>();
    const subjectCounts: Record<string, number> = {};
    const questionTypeCounts: Record<string, number> = {};

    snapshot.forEach(doc => {
        actualCount++;
        questionIds.push(doc.id);
        const data = doc.data();
        
        const subj = data.subject || "General";
        const topic = data.topic || "General";
        const qtype = data.question_type || "mcq";

        subjects.add(subj);
        topics.add(topic);

        subjectCounts[subj] = (subjectCounts[subj] || 0) + 1;
        questionTypeCounts[qtype] = (questionTypeCounts[qtype] || 0) + 1;
    });

    await db.collection('ccat_metadata').doc('global').set({
        questionCount: actualCount,
        allQuestionIds: questionIds,
        subjects: Array.from(subjects),
        topics: Array.from(topics),
        subjectCounts,
        questionTypeCounts,
        lastUpdated: new Date().toISOString()
    }, { merge: true });

    console.log(`Rebuilt metadata! Found ${actualCount} questions, ${subjects.size} subjects.`);
}

run().catch(console.error);
