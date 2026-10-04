import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import * as fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('firebase-adminsdk.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function run() {
  const ccatRef = db.collection('ccat_questions');
  const snap = await ccatRef.get();
  
  const batch = db.batch();
  let count = 0;
  
  // Sort docs by numeric value in ID or just arbitrarily to assign a sequence
  const docs = snap.docs.sort((a, b) => a.id.localeCompare(b.id));

  // Determine starting index
  let maxIndex = 0;
  for (const doc of docs) {
    const data = doc.data();
    if (typeof data.qIndex === 'number' && data.qIndex > maxIndex) {
      maxIndex = data.qIndex;
    }
  }

  console.log(`Max existing qIndex: ${maxIndex}`);

  // We assign qIndex sequentially ONLY to those that lack it.
  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i];
    const data = doc.data();
    
    let needsUpdate = false;
    const updateData: any = {};

    if (typeof data.qIndex !== 'number') {
      maxIndex++;
      updateData.qIndex = maxIndex;
      needsUpdate = true;
    }
    
    if (!data.createdAt) {
      updateData.createdAt = new Date(Date.now() - (1000 * 60 * 60 * 24 * 30)).toISOString(); // fake old date
      needsUpdate = true;
    }

    if (needsUpdate) {
      batch.update(doc.ref, updateData);
      count++;
    }

    if (count > 0 && count % 500 === 0) {
      await batch.commit();
      console.log(`Committed ${count} updates`);
    }
  }

  if (count % 500 !== 0) {
    await batch.commit();
    console.log(`Committed ${count} updates (final)`);
  }

  console.log('Done!');
}

run().catch(console.error);
