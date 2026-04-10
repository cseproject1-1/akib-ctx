/**
 * Utility functions for extracting metadata and embed URLs from common platforms.
 */

export interface EmbedConfig {
  type: 'youtube' | 'vimeo' | 'twitter' | 'figma' | 'codepen' | 'loom' | 'spotify' | 'soundcloud' | 'notion' | 'google-docs' | 'google-maps' | 'tiktok' | 'unknown';
  embedUrl: string;
}

/**
 * Returns an embed-friendly URL if the site is a known provider.
 */
export function getEmbedConfig(url: string): EmbedConfig | null {
  if (!url) return null;

  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${ytMatch[1]}?rel=0` };

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return { type: 'vimeo', embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}` };

  // TikTok
  const tiktokMatch = url.match(/tiktok\.com\/.*video\/(\d+)/);
  if (tiktokMatch) return { type: 'tiktok', embedUrl: `https://www.tiktok.com/embed/v2/${tiktokMatch[1]}` };

  // Loom
  const loomMatch = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  if (loomMatch) return { type: 'loom', embedUrl: `https://www.loom.com/embed/${loomMatch[1]}` };

  // Spotify
  const spotifyMatch = url.match(/open\.spotify\.com\/(track|album|playlist|episode|show)\/([a-zA-Z0-9]+)/);
  if (spotifyMatch) return { type: 'spotify', embedUrl: `https://open.spotify.com/embed/${spotifyMatch[1]}/${spotifyMatch[2]}` };

  // Figma
  if (/figma\.com\/(file|design|proto)\//.test(url)) {
    return { type: 'figma', embedUrl: `https://www.figma.com/embed?embed_host=lovable&url=${encodeURIComponent(url)}` };
  }

  // CodePen
  const codepenMatch = url.match(/codepen\.io\/([^/]+)\/pen\/([^/?]+)/);
  if (codepenMatch) return { type: 'codepen', embedUrl: `https://codepen.io/${codepenMatch[1]}/embed/${codepenMatch[2]}?default-tab=result` };

  // Google Maps
  if (/google\.(com|[a-z]{2,3})\/maps/.test(url) || /maps\.app\.goo\.gl/.test(url) || /goo\.gl\/maps/.test(url)) {
    return { type: 'google-maps', embedUrl: url.includes('/embed') ? url : `https://maps.google.com/maps?q=${encodeURIComponent(url)}&output=embed` };
  }

  // Google Docs
  if (/docs\.google\.com\/(document|spreadsheets|presentation)\/d\//.test(url)) {
    let embedUrl = url;
    if (url.includes('/edit')) embedUrl = url.replace(/\/edit.*$/, '/preview');
    else if (!url.includes('/preview') && !url.includes('/embed')) embedUrl = url.replace(/\/?$/, '/preview');
    return { type: 'google-docs', embedUrl };
  }

  // SoundCloud
  if (/soundcloud\.com\/[^/]+\/[^/]+/.test(url)) {
    return { type: 'soundcloud', embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=true` };
  }

  return null;
}

/** Sites known to block framing via CSP/frame-ancestors */
export const RESTRICTED_SITES = [
  'claude.ai',
  'chat.qwen.ai',
  'chatgpt.com',
  'openai.com',
  'perplexity.ai',
  'github.com',
  'twitter.com',
  'x.com',
  'facebook.com',
  'instagram.com',
  'linkedin.com'
];

export function isRestrictedSite(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return RESTRICTED_SITES.some(site => hostname === site || hostname.endsWith('.' + site));
  } catch {
    return false;
  }
}
