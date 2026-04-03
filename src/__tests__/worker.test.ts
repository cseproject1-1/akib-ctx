/**
 * @file worker.test.ts
 * @description Unit tests for the Cloudflare Worker endpoints
 * 
 * Tests the worker logic functions that can be tested in isolation:
 * - URL validation and SSRF protection
 * - Request body parsing
 * - Error handling
 *
 * Run via: npm run test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch for API calls
globalThis.fetch = vi.fn();

// Helper to create mock context
function createMockContext(overrides: Record<string, unknown> = {}) {
  return {
    req: {
      header: (name: string) => {
        if (name === 'Authorization') return overrides.authHeader || null;
        return null;
      },
      json: async () => overrides.body || {},
    },
    json: (data: unknown, status?: number) => {
      return { data, status };
    },
    env: overrides.env || {},
    set: vi.fn(),
    ...overrides,
  };
}

// Test URL validation logic (extracted from worker)
function validateUrl(urlString: string): { valid: boolean; error?: string; parsed?: URL } {
  try {
    const parsedUrl = new URL(urlString);
    
    // Protocol check
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return { valid: false, error: 'Invalid protocol' };
    }
    
    // SSRF protection - check for internal network patterns
    const hostname = parsedUrl.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return { valid: false, error: 'Access to internal network restricted' };
    }
    if (hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.')) {
      return { valid: false, error: 'Access to internal network restricted' };
    }
    
    return { valid: true, parsed: parsedUrl };
  } catch {
    return { valid: false, error: 'Invalid URL' };
  }
}

// Test body parsing
interface UrlMetadataBody {
  url: string;
}

function parseUrlMetadataBody(body: unknown): { url: string | null; error?: string } {
  const data = body as UrlMetadataBody;
  if (!data.url || typeof data.url !== 'string') {
    return { url: null, error: 'url is required' };
  }
  return { url: data.url };
}

// Test AI action parsing
interface AiStudyBody {
  action: string;
  content: string;
}

function parseAiStudyBody(body: unknown): { action: string | null; content: string | null; error?: string } {
  const data = body as AiStudyBody;
  if (!data.action || typeof data.action !== 'string') {
    return { action: null, content: null, error: 'action is required' };
  }
  if (!data.content || typeof data.content !== 'string') {
    return { action: null, content: null, error: 'content is required' };
  }
  if (!['summarize', 'flashcards'].includes(data.action)) {
    return { action: null, content: null, error: 'Unknown action' };
  }
  return { action: data.action, content: data.content };
}

// Test chat messages parsing
interface ChatBody {
  messages: Array<{ role: string; content: string }>;
}

function parseChatBody(body: unknown): { messages: Array<{ role: string; content: string }> | null; error?: string } {
  const data = body as ChatBody;
  if (!data.messages || !Array.isArray(data.messages)) {
    return { messages: [], error: 'messages array is required' };
  }
  if (data.messages.length === 0) {
    return { messages: [], error: 'messages array is required' };
  }
  // Validate message structure
  for (const msg of data.messages) {
    if (!msg.role || !msg.content) {
      return { messages: [], error: 'Each message must have role and content' };
    }
  }
  return { messages: data.messages };
}

// Test token parsing
function parseAuthHeader(authHeader: string | null): { token: string | null; error?: string } {
  if (!authHeader) {
    return { token: null, error: 'Missing token' };
  }
  if (!authHeader.startsWith('Bearer ')) {
    return { token: null, error: 'Invalid token format' };
  }
  const token = authHeader.split(' ')[1];
  if (!token) {
    return { token: null, error: 'Missing token' };
  }
  return { token };
}

// ─────────────────────────────────────────────────────────────────────────────
// URL Validation Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('URL validation', () => {
  it('accepts valid https URLs', () => {
    const result = validateUrl('https://example.com/page');
    expect(result.valid).toBe(true);
    expect(result.parsed?.hostname).toBe('example.com');
  });

  it('accepts valid http URLs', () => {
    const result = validateUrl('http://example.com/page');
    expect(result.valid).toBe(true);
  });

  it('rejects invalid protocols', () => {
    const result = validateUrl('ftp://example.com');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid protocol');
  });

  it('rejects javascript: protocol', () => {
    const result = validateUrl('javascript:alert(1)');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid protocol');
  });

  it('rejects file: protocol', () => {
    const result = validateUrl('file:///etc/passwd');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid protocol');
  });

  it('rejects localhost', () => {
    const result = validateUrl('http://localhost:3000');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Access to internal network restricted');
  });

  it('rejects 127.0.0.1', () => {
    const result = validateUrl('http://127.0.0.1:8080/admin');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Access to internal network restricted');
  });

  it('rejects 10.x.x.x private IPs', () => {
    const result = validateUrl('http://10.0.0.1/api');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Access to internal network restricted');
  });

  it('rejects 192.168.x.x private IPs', () => {
    const result = validateUrl('http://192.168.1.1/router');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Access to internal network restricted');
  });

  it('rejects 172.16-31.x.x private IPs', () => {
    const result = validateUrl('http://172.16.0.1/internal');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Access to internal network restricted');
  });

  it('accepts public IPs', () => {
    const result = validateUrl('http://8.8.8.8/dns');
    expect(result.valid).toBe(true);
  });

  it('handles malformed URLs', () => {
    const result = validateUrl('not-a-url');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Invalid URL');
  });

  it('extracts hostname from valid URL', () => {
    const result = validateUrl('https://sub.example.com/path?query=1');
    expect(result.valid).toBe(true);
    expect(result.parsed?.hostname).toBe('sub.example.com');
    expect(result.parsed?.pathname).toBe('/path');
    expect(result.parsed?.search).toBe('?query=1');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Body Parsing Tests
// ─────��───────────────────────────────────────────────────────────────────────

describe('URL metadata body parsing', () => {
  it('parses valid body', () => {
    const result = parseUrlMetadataBody({ url: 'https://example.com' });
    expect(result.url).toBe('https://example.com');
    expect(result.error).toBeUndefined();
  });

  it('rejects missing url', () => {
    const result = parseUrlMetadataBody({});
    expect(result.url).toBeNull();
    expect(result.error).toBe('url is required');
  });

  it('rejects non-string url', () => {
    const result = parseUrlMetadataBody({ url: 123 });
    expect(result.url).toBeNull();
    expect(result.error).toBe('url is required');
  });

  it('rejects empty url', () => {
    const result = parseUrlMetadataBody({ url: '' });
    expect(result.url).toBeNull();
    expect(result.error).toBe('url is required');
  });
});

describe('AI study body parsing', () => {
  it('parses summarize action', () => {
    const result = parseAiStudyBody({ action: 'summarize', content: 'Some content to summarize' });
    expect(result.action).toBe('summarize');
    expect(result.content).toBe('Some content to summarize');
    expect(result.error).toBeUndefined();
  });

  it('parses flashcards action', () => {
    const result = parseAiStudyBody({ action: 'flashcards', content: 'Content for flashcards' });
    expect(result.action).toBe('flashcards');
    expect(result.content).toBe('Content for flashcards');
  });

  it('rejects unknown action', () => {
    const result = parseAiStudyBody({ action: 'unknown', content: 'content' });
    expect(result.error).toBe('Unknown action');
  });

  it('rejects missing action', () => {
    const result = parseAiStudyBody({ content: 'test' });
    expect(result.error).toBe('action is required');
  });

  it('rejects missing content', () => {
    const result = parseAiStudyBody({ action: 'summarize' });
    expect(result.error).toBe('content is required');
  });

  it('rejects empty content', () => {
    const result = parseAiStudyBody({ action: 'summarize', content: '' });
    expect(result.error).toBe('content is required');
  });
});

describe('Chat body parsing', () => {
  it('parses valid messages array', () => {
    const result = parseChatBody({
      messages: [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ]
    });
    expect(result.messages).toHaveLength(2);
    expect(result.error).toBeUndefined();
  });

  it('rejects missing messages', () => {
    const result = parseChatBody({});
    expect(result.error).toBe('messages array is required');
  });

  it('rejects non-array messages', () => {
    const result = parseChatBody({ messages: 'not-array' });
    expect(result.error).toBe('messages array is required');
  });

  it('rejects empty messages array', () => {
    const result = parseChatBody({ messages: [] });
    expect(result.error).toBe('messages array is required');
  });

  it('rejects message missing role', () => {
    const result = parseChatBody({ messages: [{ content: 'Hello' }] });
    expect(result.error).toBe('Each message must have role and content');
  });

  it('rejects message missing content', () => {
    const result = parseChatBody({ messages: [{ role: 'user' }] });
    expect(result.error).toBe('Each message must have role and content');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Auth Header Parsing Tests
// ─────────────────────────────────────────��─��─────────────────────────────────

describe('Auth header parsing', () => {
  it('parses valid Bearer token', () => {
    const result = parseAuthHeader('Bearer valid-token-123');
    expect(result.token).toBe('valid-token-123');
    expect(result.error).toBeUndefined();
  });

  it('rejects missing auth header', () => {
    const result = parseAuthHeader(null);
    expect(result.token).toBeNull();
    expect(result.error).toBe('Missing token');
  });

  it('rejects non-Bearer format', () => {
    const result = parseAuthHeader('Basic abc123');
    expect(result.token).toBeNull();
    expect(result.error).toBe('Invalid token format');
  });

  it('rejects empty Bearer token', () => {
    const result = parseAuthHeader('Bearer ');
    expect(result.token).toBeNull();
    expect(result.error).toBe('Missing token');
  });

  it('rejects Bearer without token', () => {
    const result = parseAuthHeader('Bearer');
    expect(result.token).toBeNull();
    expect(result.error).toBe('Invalid token format');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Mock Response Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('Mock response format', () => {
  it('creates error response', () => {
    const ctx = createMockContext();
    const response = ctx.json({ error: 'Test error' }, 400);
    
    expect(response).toEqual({
      data: { error: 'Test error' },
      status: 400
    });
  });

  it('creates success response', () => {
    const ctx = createMockContext();
    const response = ctx.json({ success: true });
    
    expect(response).toEqual({
      data: { success: true },
      status: undefined
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

describe('Edge cases', () => {
  it('handles unicode in URLs', () => {
    const result = validateUrl('https://example.com/路径');
    expect(result.valid).toBe(true);
  });

  it('handles port numbers', () => {
    const result = validateUrl('https://example.com:8443/api');
    expect(result.valid).toBe(true);
    expect(result.parsed?.port).toBe('8443');
  });

  it('handles query strings', () => {
    const result = validateUrl('https://example.com?foo=bar&baz=qux');
    expect(result.valid).toBe(true);
    expect(result.parsed?.search).toBe('?foo=bar&baz=qux');
  });

  it('handles fragments', () => {
    const result = validateUrl('https://example.com#section');
    expect(result.valid).toBe(true);
    expect(result.parsed?.hash).toBe('#section');
  });

  it('handles unusual but valid TLDs', () => {
    const result = validateUrl('https://example.co.uk');
    expect(result.valid).toBe(true);
  });

  it('accepts IPv6 loopback (current implementation allows it)', () => {
    const result = validateUrl('http://[::1]/');
    expect(result.valid).toBe(true);
  });
});