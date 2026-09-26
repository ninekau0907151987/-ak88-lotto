
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function seedAgent() {
  const apiKey = 'AK88-AGENT01-DEMO';
  const agentData = {
    name: 'Agent Official 01',
    username: 'agent01',
    password: 'password123',
    location: 'Bangkok',
    apiKey: apiKey,
    sharePercentage: 80,
    commissionRate: 5,
    creditLimit: 1000000,
    status: 'active',
    createdAt: new Date().toISOString()
  };

  try {
    const docRef = await addDoc(collection(db, 'agents'), agentData);
    console.log('Agent created successfully with ID:', docRef.id);
    console.log('Agent Code (API Key):', apiKey);
  } catch (e) {
    console.error('Error adding agent:', e);
  }
}

seedAgent();
