import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function checkAgent() {
  const agentId = 'agent-1234-id';
  try {
    const snap = await getDoc(doc(db, 'agents', agentId));
    if (snap.exists()) {
      console.log('Agent 1234 exists:', snap.data());
    } else {
      console.log('Agent 1234 does not exist');
    }
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkAgent();
