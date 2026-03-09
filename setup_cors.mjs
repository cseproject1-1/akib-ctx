import { S3Client, PutBucketCorsCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

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

async function setupCORS() {
    const s3 = new S3Client({
        region: "auto",
        endpoint: env['VITE_R2_ENDPOINT'],
        credentials: {
            accessKeyId: env['VITE_R2_ACCESS_KEY_ID'],
            secretAccessKey: env['VITE_R2_SECRET_ACCESS_KEY'],
        },
    });

    const corsParams = {
        Bucket: env['VITE_R2_BUCKET_NAME'],
        CORSConfiguration: {
            CORSRules: [
                {
                    AllowedHeaders: ["*"],
                    AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
                    AllowedOrigins: ["*"],
                    ExposeHeaders: [],
                    MaxAgeSeconds: 3000
                }
            ]
        }
    };

    try {
        console.log("Setting up CORS for bucket:", env['VITE_R2_BUCKET_NAME']);
        await s3.send(new PutBucketCorsCommand(corsParams));
        console.log("CORS configured successfully.");
    } catch (err) {
        console.error("Failed to configure CORS:", err.message);
    }
}

setupCORS();
