import { PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { r2 } from './client';
import { auth, WORKER_URL } from '@/lib/firebase/client';

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

async function getAuthHeaders() {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const token = await user.getIdToken();
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
    };
}

export async function uploadCanvasFile(
    workspaceId: string,
    file: File,
    onProgress?: (pct: number) => void,
): Promise<{ url: string; path: string }> {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');

    // File size limit (50MB)
    const MAX_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
        throw new Error(`File too large (max 50MB)`);
    }

    // Allowed MIME types (mirrors frontend ALLOWED_EXTENSIONS in FileAttachmentNode.tsx)
    const ALLOWED_TYPES = [
        'image/', 'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument',
        'application/vnd.ms-powerpoint', 'application/vnd.ms-excel',
        'text/csv', 'text/plain', 'text/html', 'text/markdown', 'text/xml',
        'application/json', 'application/xml',
        'video/', 'audio/',
    ];
    const isAllowed = ALLOWED_TYPES.some(t => file.type.startsWith(t) || file.type === t);
    // Also allow by extension for files with blank/octet-stream type
    const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
    const ALLOWED_EXTENSIONS = ['txt', 'html', 'htm', 'md', 'csv', 'json', 'xml', 'log'];
    const isAllowedByExt = ALLOWED_EXTENSIONS.includes(fileExt);
    if (!isAllowed && !isAllowedByExt && file.type !== '') {
        throw new Error(`File type "${file.type}" is not allowed`);
    }

    // Compress images before upload
    let processedFile = file;
    if (file.type.startsWith('image/')) {
        onProgress?.(5);
        processedFile = await compressImage(file, 1920, 0.8);
    }

    const ext = processedFile.name.split('.').pop() || 'bin';
    const path = `${user.uid}/${workspaceId}/${crypto.randomUUID()}.${ext}`;

    onProgress?.(20);

    // 1. Get presigned URL from Worker
    const headers = await getAuthHeaders();
    const presignRes = await fetch(`${WORKER_URL}/api/presign`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ key: path, contentType: processedFile.type }),
    });

    if (!presignRes.ok) {
        const err = await presignRes.text();
        throw new Error(`Failed to get presigned URL: ${err}`);
    }

    const { url: presignedUrl } = await presignRes.json();

    onProgress?.(40);

    // 2. Upload directly to R2 using presigned URL
    const uploadRes = await fetch(presignedUrl, {
        method: 'PUT',
        headers: { 'Content-Type': processedFile.type },
        body: processedFile,
    });

    if (!uploadRes.ok) {
        throw new Error(`Upload failed: ${uploadRes.statusText}`);
    }

    onProgress?.(90);

    const publicUrlBase = import.meta.env.VITE_R2_PUBLIC_URL || '';
    const url = `${publicUrlBase.replace(/\/$/, '')}/${path}`;

    onProgress?.(100);

    return { url, path };
}

export async function deleteCanvasFile(path: string) {
    const headers = await getAuthHeaders();
    const res = await fetch(`${WORKER_URL}/api/deleteFiles`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ keys: [path] }),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Delete failed: ${err}`);
    }
}

export async function deleteWorkspaceFiles(workspaceId: string) {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    
    let isTruncated = true;
    let continuationToken: string | undefined = undefined;

    while (isTruncated) {
      const headers = await getAuthHeaders();
      const listUrl = new URL(`${WORKER_URL}/api/listWorkspaceFiles`);
      listUrl.searchParams.set('workspaceId', workspaceId);
      if (continuationToken) listUrl.searchParams.set('token', continuationToken);

      const listRes = await fetch(listUrl.toString(), { headers });
      if (!listRes.ok) {
          const err = await listRes.text();
          throw new Error(`List failed: ${err}`);
      }

      const { files, isTruncated: truncated, nextContinuationToken } = await listRes.json();

      if (files && files.length > 0) {
          const deleteRes = await fetch(`${WORKER_URL}/api/deleteFiles`, {
              method: 'POST',
              headers: await getAuthHeaders(),
              body: JSON.stringify({ keys: files }),
          });
          if (!deleteRes.ok) {
              const err = await deleteRes.text();
              throw new Error(`Bulk delete failed: ${err}`);
          }
      }

      isTruncated = truncated || false;
      continuationToken = nextContinuationToken;
    }
  } catch (err) {
    console.error('Error deleting workspace files:', err);
    throw err;
  }
}

export async function deleteUserFiles(userId: string) {
    // Note: deleteUserFiles is likely an admin operation or handled differently.
    // For now, we'll keep it as a placeholder or implement if needed.
    console.warn('deleteUserFiles called on client - this should be a worker/admin operation');
}

export async function getAdminStorageStats() {
    // This should also be moved to an admin-only worker endpoint
    console.warn('getAdminStorageStats called on client - moving to worker-only suggested');
    return { totalBytes: 0, totalFiles: 0, workspaceMap: {} };
}
