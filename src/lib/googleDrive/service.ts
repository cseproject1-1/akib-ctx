// Google Drive integration service for read-only file access
// This uses the browser-friendly Google Identity Services library

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink: string;
  webContentLink?: string;
  size?: number;
  modifiedTime?: string;
}

/**
 * Check if Google Drive integration is configured
 */
export function isGoogleDriveConfigured(): boolean {
  return !!import.meta.env.VITE_GOOGLE_CLIENT_ID;
}

/**
 * Get the authorization URL for Google Drive OAuth using Google Identity Services
 */
export function getGoogleDriveAuthUrl(): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
  const redirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI || `${window.location.origin}/auth/google/callback`;
  
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'token',
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    include_granted_scopes: 'true',
    state: 'ctxnote_drive_integration'
  });
  
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Parse the access token from the URL hash (OAuth implicit flow)
 */
export function getAccessTokenFromUrl(): string | null {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);
  return params.get('access_token');
}

/**
 * List files from Google Drive using the REST API
 */
export async function listGoogleDriveFiles(accessToken: string): Promise<GoogleDriveFile[]> {
  try {
    const response = await fetch(
      'https://www.googleapis.com/drive/v3/files?fields=files(id,name,mimeType,webViewLink,webContentLink,size,modifiedTime)&q=trashed=false',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Google Drive API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.files || [];
  } catch (error) {
    console.error('Error listing Google Drive files:', error);
    throw error;
  }
}

/**
 * Get a file's metadata from Google Drive
 */
export async function getGoogleDriveFileMetadata(accessToken: string, fileId: string): Promise<GoogleDriveFile> {
  try {
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,webViewLink,webContentLink,size,modifiedTime`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      }
    );
    
    if (!response.ok) {
      throw new Error(`Google Drive API error: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting Google Drive file metadata:', error);
    throw error;
  }
}

/**
 * Get a file's direct download URL from Google Drive
 */
export async function getGoogleDriveFileUrl(accessToken: string, fileId: string): Promise<string> {
  try {
    const metadata = await getGoogleDriveFileMetadata(accessToken, fileId);
    // Prefer direct download link if available
    return metadata.webContentLink || metadata.webViewLink || '';
  } catch (error) {
    console.error('Error getting Google Drive file URL:', error);
    throw error;
  }
}