import { PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { r2 } from './client';
import { auth } from '@/lib/firebase/client';

/**
 * Compress an image file using canvas.
 * Returns a compressed Blob (WebP if supported, else JPEG) with max dimension and quality control.
 */
export function compressImage(
    file: File,
    maxDimension = 1920,
    quality = 0.8,
): Promise<File> {
    return new Promise((resolve, reject) => {
        // Skip non-image files
        if (!file.type.startsWith('image/')) {
            resolve(file);
            return;
        }

        // Skip SVGs and GIFs (can't compress meaningfully)
        if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
            resolve(file);
            return;
        }

        const img = new Image();
        const url = URL.createObjectURL(file);

        img.onload = () => {
            URL.revokeObjectURL(url);

            let { width, height } = img;

            // Scale down if exceeds max dimension
            if (width > maxDimension || height > maxDimension) {
                const ratio = Math.min(maxDimension / width, maxDimension / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(file);
                return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            // Try WebP first, fall back to JPEG
            const outputType = 'image/webp';

            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        resolve(file);
                        return;
                    }

                    // Only use compressed version if it's actually smaller
                    if (blob.size >= file.size) {
                        resolve(file);
                        return;
                    }

                    const ext = outputType === 'image/webp' ? 'webp' : 'jpg';
                    const baseName = file.name.replace(/\.[^.]+$/, '');
                    const compressed = new File([blob], `${baseName}.${ext}`, {
                        type: outputType,
                        lastModified: Date.now(),
                    });
                    resolve(compressed);
                },
                outputType,
                quality,
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            resolve(file); // Fall back to original on error
        };

        img.src = url;
    });
}

export async function uploadCanvasFile(
    workspaceId: string,
    file: File,
    onProgress?: (pct: number) => void,
): Promise<{ url: string; path: string }> {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    // Compress images before upload
    let processedFile = file;
    if (file.type.startsWith('image/')) {
        onProgress?.(5);
        processedFile = await compressImage(file, 1920, 0.8);
    }

    const ext = processedFile.name.split('.').pop() || 'bin';
    const path = `${user.uid}/${workspaceId}/${crypto.randomUUID()}.${ext}`;

    onProgress?.(20);

    const bucket = import.meta.env.VITE_R2_BUCKET_NAME || 'ctxnote';

    // Convert File to Uint8Array to prevent "readableStream.getReader is not a function" AWS SDK browser error
    const arrayBuffer = await processedFile.arrayBuffer();
    const bodyText = new Uint8Array(arrayBuffer);

    const command = new PutObjectCommand({
        Bucket: bucket,
        Key: path,
        Body: bodyText,
        ContentType: processedFile.type,
    });

    await r2.send(command);

    onProgress?.(90);

    const publicUrlBase = import.meta.env.VITE_R2_PUBLIC_URL || '';
    const url = `${publicUrlBase.replace(/\/$/, '')}/${path}`;

    onProgress?.(100);

    return { url, path };
}

export async function deleteCanvasFile(path: string) {
    const bucket = import.meta.env.VITE_R2_BUCKET_NAME || 'ctxnote';
    const command = new DeleteObjectCommand({
        Bucket: bucket,
        Key: path,
    });
    await r2.send(command);
}

export async function deleteWorkspaceFiles(workspaceId: string) {
  try {
    const bucket = import.meta.env.VITE_R2_BUCKET_NAME || 'ctxnote';
    const listCommand = new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: `workspaces/${workspaceId}/`,
    });

    const listResponse = await r2.send(listCommand);
    const objects = listResponse.Contents || [];

    if (objects.length === 0) return;

    for (const obj of objects) {
      if (obj.Key) {
        await deleteCanvasFile(obj.Key);
      }
    }
  } catch (err) {
    console.error('Error deleting workspace files:', err);
    throw err;
  }
}

export async function deleteUserFiles(userId: string) {
    const bucket = import.meta.env.VITE_R2_BUCKET_NAME || 'ctxnote';
    let isTruncated = true;
    let continuationToken: string | undefined = undefined;

    while (isTruncated) {
        const listCommand = new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: `${userId}/`,
            ContinuationToken: continuationToken,
        });

        const response = await r2.send(listCommand);

        const deletePromises = (response.Contents || [])
            .map(item => r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: item.Key })));

        await Promise.all(deletePromises);

        isTruncated = response.IsTruncated || false;
        continuationToken = response.NextContinuationToken;
    }
}

export async function getAdminStorageStats() {
    const bucket = import.meta.env.VITE_R2_BUCKET_NAME || 'ctxnote';
    let isTruncated = true;
    let continuationToken: string | undefined = undefined;

    let totalBytes = 0;
    let totalFiles = 0;
    const workspaceMap: Record<string, { bytes: number; count: number }> = {};

    while (isTruncated) {
        const command = new ListObjectsV2Command({
            Bucket: bucket,
            ContinuationToken: continuationToken,
        });

        const response = await r2.send(command);

        for (const item of response.Contents || []) {
            const size = item.Size || 0;
            const key = item.Key || '';

            totalBytes += size;
            totalFiles += 1;

            // Key format expects: userId/workspaceId/fileId.ext
            const parts = key.split('/');
            if (parts.length >= 3) {
                const workspaceId = parts[1];
                if (!workspaceMap[workspaceId]) {
                    workspaceMap[workspaceId] = { bytes: 0, count: 0 };
                }
                workspaceMap[workspaceId].bytes += size;
                workspaceMap[workspaceId].count += 1;
            }
        }

        isTruncated = response.IsTruncated || false;
        continuationToken = response.NextContinuationToken;
    }

    return { totalBytes, totalFiles, workspaceMap };
}
