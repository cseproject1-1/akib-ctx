import { S3Client } from '@aws-sdk/client-s3';

// R2 configuration from environment variables
// Note: We no longer include ACCESS_KEY or SECRET_KEY here to prevent exposure in the client bundle.
// Uploads and other sensitive operations are now handled via presigned URLs or the Cloudflare Worker.
export const r2 = new S3Client({
    region: 'auto',
    endpoint: import.meta.env.VITE_R2_ENDPOINT,
    credentials: {
        accessKeyId: 'NOT_REQUIRED_ON_CLIENT',
        secretAccessKey: 'NOT_REQUIRED_ON_CLIENT',
    },
});
