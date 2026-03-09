import { S3Client } from '@aws-sdk/client-s3';

export const r2 = new S3Client({
    region: 'auto',
    endpoint: import.meta.env.VITE_R2_ENDPOINT,
    credentials: {
        accessKeyId: import.meta.env.VITE_R2_ACCESS_KEY_ID || '',
        secretAccessKey: import.meta.env.VITE_R2_SECRET_ACCESS_KEY || '',
    },
});
