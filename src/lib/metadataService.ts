
import { WORKER_URL } from './firebase/client';

export interface LinkMetadata {
  title?: string;
  description?: string;
  image?: string;
  url: string;
  icon?: string;
}

const METADATA_CACHE = new Map<string, LinkMetadata>();

export async function fetchLinkMetadata(url: string): Promise<LinkMetadata> {
  if (METADATA_CACHE.has(url)) return METADATA_CACHE.get(url)!;

  try {
    const response = await fetch(`${WORKER_URL}/api/metadata?url=${encodeURIComponent(url)}`);
    if (!response.ok) throw new Error('Failed to fetch metadata');

    const data = await response.json();
    const metadata: LinkMetadata = {
      url,
      title: data.title,
      description: data.description,
      image: data.image,
      icon: data.icon,
    };

    METADATA_CACHE.set(url, metadata);
    return metadata;
  } catch (err) {
    console.error('Metadata fetch error:', err);
    return { url };
  }
}
