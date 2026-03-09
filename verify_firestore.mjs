import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { getFirestore, collection, query, where, orderBy, getDocs, doc, setDoc } from "firebase/firestore";
import fs from "fs";
import path from "path";

// 1. Load env vars
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
        let key = match[1].trim();
        let val = match[2].trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        env[key] = val;
    }
}

// 2. Initialize Firebase
const firebaseConfig = {
    apiKey: env['VITE_FIREBASE_API_KEY'],
    authDomain: env['VITE_FIREBASE_AUTH_DOMAIN'],
    projectId: env['VITE_FIREBASE_PROJECT_ID'],
    storageBucket: env['VITE_FIREBASE_STORAGE_BUCKET'],
    messagingSenderId: env['VITE_FIREBASE_MESSAGING_SENDER_ID'],
    appId: env['VITE_FIREBASE_APP_ID']
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

async function verify() {
    console.log("=== STARTING FIRESTORE VERIFICATION ===");
    try {
        const email = "mm.adnanakaib@gmail.com";
        const password = "admin1234";

        let user;
        try {
            console.log(`Attempting to login as ${email}...`);
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            user = userCredential.user;
        } catch (e) {
            if (e.code === 'auth/user-not-found' || e.code === 'auth/invalid-credential') {
                console.log("Account missing/invalid, attempting to create...");
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                user = userCredential.user;
            } else {
                throw e;
            }
        }

        console.log(`✅ Success! Authenticated as: ${user.uid} (${user.email})`);

        // Try to create a workspace
        console.log("\nAttempting to write a test workspace...");
        const wsRef = doc(collection(db, "workspaces"));
        const wsData = {
            id: wsRef.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            name: "Verification Test WS",
            color: "#000000",
            is_public: false,
            parent_workspace_id: null,
            user_id: user.uid
        };
        await setDoc(wsRef, wsData);
        console.log(`✅ Success! Created workspace ${wsRef.id}`);

        // Try the composite query
        console.log("\nAttempting to run the dashboard composite query (Testing indexes)...");
        const q = query(
            collection(db, 'workspaces'),
            where('user_id', '==', user.uid),
            orderBy('updated_at', 'desc')
        );
        const snapshot = await getDocs(q);
        console.log(`✅ Success! Retrieved ${snapshot.size} workspaces using the composite index.`);

        console.log("\n=== ALL TESTS PASSED ===");
        process.exit(0);

    } catch (error) {
        console.error("\n❌ ERROR DURING VERIFICATION:");
        console.error(error.message);
        process.exit(1);
    }
}

verify();
