import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

// Parse .env.local manually
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
for (const line of envContent.split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
        let key = match[1].trim();
        let val = match[2].trim();
        if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1);
        }
        env[key] = val;
    }
}

console.log("Loaded Keys:", Object.keys(env));

async function testFirebase() {
    const apiKey = env['VITE_FIREBASE_API_KEY'];
    if (!apiKey) return { success: false, message: 'Missing VITE_FIREBASE_API_KEY' };
    try {
        const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'test@example.com', password: 'password', returnSecureToken: true })
        });
        const data = await res.json();
        if (data.error && data.error.message === 'API_KEY_INVALID') {
            return { success: false, message: 'Firebase API Key is Invalid.' };
        }
        return { success: true, message: 'Firebase API Key is Valid (or returned expected auth error).' };
    } catch (e) {
        return { success: false, message: `Firebase Error: ${e.message}` }
    }
}

async function testR2() {
    if (!env['VITE_R2_ENDPOINT'] || !env['VITE_R2_ACCESS_KEY_ID'] || !env['VITE_R2_SECRET_ACCESS_KEY']) {
        return { success: false, message: 'Missing R2 environment variables' };
    }
    const s3 = new S3Client({
        region: "auto",
        endpoint: env['VITE_R2_ENDPOINT'],
        credentials: {
            accessKeyId: env['VITE_R2_ACCESS_KEY_ID'],
            secretAccessKey: env['VITE_R2_SECRET_ACCESS_KEY'],
        },
    });

    try {
        const cmd = new ListObjectsV2Command({ Bucket: env['VITE_R2_BUCKET_NAME'], MaxKeys: 1 });
        await s3.send(cmd);
        return { success: true, message: 'R2 API Keys are Valid (Bucket access successful).' };
    } catch (err) {
        return { success: false, message: `R2 API Keys are Invalid or no access: ${err.message}` };
    }
}

async function testWorker() {
    const workerUrl = env['VITE_WORKER_URL'];
    if (!workerUrl) return { success: false, message: 'Missing VITE_WORKER_URL' };
    try {
        const res = await fetch(workerUrl);
        if (res.ok || res.status === 404 || res.status === 405 || res.status === 401) {
            return { success: true, message: `Worker URL is reachable (Status: ${res.status}).` };
        }
        return { success: false, message: `Worker returned unexpected status: ${res.status}.` };
    } catch (err) {
        return { success: false, message: `Worker URL is not reachable: ${err.message}` };
    }
}

async function main() {
    console.log("=== API KEY VERIFICATION ===");
    const fbResult = await testFirebase();
    console.log("Firebase:", fbResult.message);

    const r2Result = await testR2();
    console.log("R2:", r2Result.message);

    const workerResult = await testWorker();
    console.log("Worker:", workerResult.message);
}

main().catch(console.error);
