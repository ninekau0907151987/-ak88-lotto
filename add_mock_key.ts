import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore";
import fs from "fs";

const configPath = './firebase-applet-config.json';
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function addKey() {
  try {
    const randomString = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const newKey = `ak88_live_${randomString}`;
    
    await addDoc(collection(db, 'api_keys'), {
      name: 'เว็บพันธมิตร (จำลองโดย AI)',
      key: newKey,
      createdAt: new Date(),
      status: 'active',
      lastUsed: null
    });
    console.log("Successfully added mock API key");
    process.exit(0);
  } catch (error) {
    console.error("Error adding key:", error);
    process.exit(1);
  }
}

addKey();
