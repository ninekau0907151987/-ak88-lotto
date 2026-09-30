import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);

async function seedAgent() {
  const agentId = 'agent-1234-id';
  const agentData = {
    name: 'เอเย่นต์ 1234 (ทดสอบ)',
    username: '1234',
    password: '1234',
    apiKey: '1234',
    creditLimit: 1000000,
    sharePercentage: 80,
    commissionRate: 5,
    status: 'active',
    createdAt: new Date().toISOString()
  };

  try {
    await setDoc(doc(db, 'agents', agentId), agentData);
    console.log('Successfully seeded agent 1234');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding agent:', error);
    process.exit(1);
  }
}

seedAgent();
