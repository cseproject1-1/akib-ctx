import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import bcrypt from 'bcryptjs';


type Bindings = {
    GEMINI_API_KEY: string;
    FIREBASE_PROJECT_ID: string;
    R2_ACCESS_KEY_ID: string;
    R2_SECRET_ACCESS_KEY: string;
    R2_ENDPOINT: string;
    R2_BUCKET_NAME: string;
};

type Variables = {
    user: any;
};

const app = new Hono<{ Bindings: Bindings, Variables: Variables }>();

// Remote JWKS for Firebase ID Token verification
const JWKS = createRemoteJWKSet(
    new URL('https://www.googleapis.com/robot/v1/metadata/jwk/securetoken@system.gserviceaccount.com')
);
// Allowed origins and wildcard patterns
const ALLOWED_ORIGINS = [
    'https://ctxnote.app',
    'https://www.akib-ctx.pro.bd',
    'https://akib-ctx.pro.bd',
    'https://cn.akib-ctx.qzz.io',
];

const ALLOWED_PATTERNS = [
    /\.vercel\.app$/,
    /\.akib\.qzz\.io$/,
    /\.pro\.bd$/,
    /\.akib-ctx\.qzz\.io$/,
];

// Relaxed CORS middleware to allow all origins
app.use('*', cors({
    origin: '*',
    allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    allowMethods: ['POST', 'GET', 'OPTIONS', 'PUT', 'DELETE'],
    exposeHeaders: ['Content-Length', 'X-R2-Request-Id'],
    maxAge: 86400, // Cache preflight results for 24 hours
    credentials: false,
}));

// Auth Middleware
const authMiddleware = async (c: any, next: any) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Unauthorized: Missing token' }, 401);
    }

    const token = authHeader.split(' ')[1];
    try {
        const { payload } = await jwtVerify(token, JWKS, {
            issuer: `https://securetoken.google.com/${c.env.FIREBASE_PROJECT_ID}`,
            audience: c.env.FIREBASE_PROJECT_ID,
        });
        c.set('user', payload);
        await next();
    } catch (e: any) {
        console.error('Auth Error:', e.message);
        return c.json({ error: 'Unauthorized: Invalid token' }, 401);
    }
};

const getS3Client = (env: Bindings) => new S3Client({
    region: 'auto',
    endpoint: env.R2_ENDPOINT,
    credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
});

// 1. urlMetadata (with SSRF protection)
app.post('/api/urlMetadata', authMiddleware, async (c) => {
    const { url } = await c.req.json();
    if (!url || typeof url !== 'string') {
        return c.json({ error: 'url is required' }, 400);
    }

    try {
        const parsedUrl = new URL(url);
        // SSRF Protection: allow only http/https and reject private/reserved IPs
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return c.json({ error: 'Invalid protocol' }, 400);
        }

        // Basic check for common private IP patterns (more robust in production via network-level controls or edge libraries)
        const hostname = parsedUrl.hostname.toLowerCase();
        if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('10.') || hostname.startsWith('192.168.') || hostname.startsWith('172.')) {
             return c.json({ error: 'Access to internal network restricted' }, 400);
        }

        const response = await fetch(url, { 
            headers: { 'User-Agent': 'Mozilla/5.0 (CtxNoteBot/1.0)' },
            redirect: 'follow'
        });
        const text = await response.text();
        const titleMatch = text.match(/<title>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1] : parsedUrl.hostname;

        return c.json({
            title,
            description: null,
            image: null,
            favicon: `https://www.google.com/s2/favicons?domain=${parsedUrl.hostname}&sz=64`,
            domain: parsedUrl.hostname
        });
    } catch (e) {
        try {
            return c.json({ title: new URL(url).hostname, domain: new URL(url).hostname });
        } catch {
            return c.json({ error: 'Invalid URL' }, 400);
        }
    }
});

// 2. aiStudy
app.post('/api/aiStudy', authMiddleware, async (c) => {
    const { action, content } = await c.req.json();
    const GEMINI_API_KEY = c.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return c.json({ error: "GEMINI_API_KEY is not configured" }, 500);

    let systemPrompt = "";
    if (action === "summarize") {
        systemPrompt = "You are a study assistant. Return a JSON object with 'title' (string) and 'bullets' (array of strings). Extract 4-8 key points from the following content:";
    } else if (action === "flashcards") {
        systemPrompt = "You are a study assistant. Return a JSON object with 'flashcards' (array of {question: string, answer: string}). Generate 3-6 flashcards from the following content:";
    } else {
        return c.json({ error: "Unknown action" }, 400);
    }

    const payload = {
        contents: [{
            parts: [{ text: `${systemPrompt}\n\n${content}` }]
        }],
        generationConfig: {
            response_mime_type: "application/json",
        }
    };

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "x-goog-api-key": GEMINI_API_KEY
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Gemini Error:", errText);
            return c.json({ error: "AI service error" }, 500);
        }

        const result: any = await response.json();
        const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (textResponse) {
            try {
                // Ensure we handle potential markdown code blocks if the model ignores the mime_type instruction
                const cleanText = textResponse.replace(/^```json\n?|\n?```$/g, '').trim();
                return c.json({ data: JSON.parse(cleanText) });
            } catch (e: any) {
                console.error("AI JSON Parse Error:", e.message, "Content:", textResponse);
                return c.json({ error: "AI returned invalid JSON format", details: e.message }, 500);
            }
        }
        return c.json({ error: "No output returned from AI" }, 500);
    } catch (e: any) {
        return c.json({ error: e.message || "Unknown error" }, 500);
    }
});


// 4. scrape
app.post('/api/scrape', authMiddleware, async (c) => {
    const { title, url, content } = await c.req.json();
    const GEMINI_API_KEY = c.env.GEMINI_API_KEY;

    if (!content) {
        return c.json({ title: title || 'Error', summary: 'No content provided to summarize.' });
    }

    if (!GEMINI_API_KEY) {
        return c.json({ title, summary: content.substring(0, 1000) + '...' });
    }

    try {
        const prompt = `You are a researcher. Summarize the following web page content into a concise Markdown note. Focus on key information and takeaways. 
        Source: ${url}
        Title: ${title}
        
        Content: ${content.substring(0, 4000)}`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-goog-api-key': GEMINI_API_KEY
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data: any = await response.json();
        const summary = data.candidates?.[0]?.content?.parts?.[0]?.text || content.substring(0, 1000);

        return c.json({ title, summary });
    } catch (err) {
        return c.json({ title, summary: content.substring(0, 1000) });
    }
});

// 5. verifyPassword (B6: Move hash verification to worker)
app.post('/api/verifyWorkspacePassword', authMiddleware, async (c) => {
    try {
        const { password, hash } = await c.req.json();
        if (!password || !hash) {
            return c.json({ error: 'password and hash are required' }, 400);
        }

        const isValid = await bcrypt.compare(password, hash);
        return c.json({ isValid });
    } catch (e: any) {
        console.error('Password Verification Error:', e.message);
        return c.json({ error: 'Internal server error' }, 500);
    }
});

// 6. R2 Operations
app.post('/api/presign', authMiddleware, async (c) => {
    const { key, contentType } = await c.req.json();
    if (!key) return c.json({ error: 'key is required' }, 400);

    const client = getS3Client(c.env);
    const command = new PutObjectCommand({
        Bucket: c.env.R2_BUCKET_NAME,
        Key: key,
        ContentType: contentType,
    });

    try {
        const url = await getSignedUrl(client, command, { expiresIn: 3600 });
        return c.json({ url });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

app.post('/api/deleteFiles', authMiddleware, async (c) => {
    const { keys } = await c.req.json();
    const user = c.get('user');
    const userPrefix = `${user.sub}/`;

    if (!Array.isArray(keys)) return c.json({ error: 'keys array is required' }, 400);

    // Security: Only allow deletion of files belonging to the authenticated user
    const authorizedKeys = keys.filter((key: string) => key.startsWith(userPrefix));

    if (authorizedKeys.length === 0 && keys.length > 0) {
        return c.json({ error: 'Unauthorized: Cannot delete files from another user' }, 403);
    }

    const client = getS3Client(c.env);
    const results = await Promise.all(authorizedKeys.map(async (key: string) => {
        try {
            await client.send(new DeleteObjectCommand({
                Bucket: c.env.R2_BUCKET_NAME,
                Key: key,
            }));
            return { key, success: true };
        } catch (e: any) {
            return { key, success: false, error: e.message };
        }
    }));

    return c.json({ results });
});

app.get('/api/listWorkspaceFiles', authMiddleware, async (c) => {
    const workspaceId = c.req.query('workspaceId');
    const user = c.get('user');
    if (!workspaceId) return c.json({ error: 'workspaceId is required' }, 400);

    const client = getS3Client(c.env);
    const prefix = `${user.sub || user.user_id}/${workspaceId}/`;

    try {
        const command = new ListObjectsV2Command({
            Bucket: c.env.R2_BUCKET_NAME,
            Prefix: prefix,
            ContinuationToken: c.req.query('token'),
        });

        const response = await client.send(command);
        return c.json({ 
            files: (response.Contents || []).map(item => item.Key),
            isTruncated: response.IsTruncated,
            nextContinuationToken: response.NextContinuationToken
        });
    } catch (e: any) {
        return c.json({ error: e.message }, 500);
    }
});

// 3. chat (general AI assistant)
app.post('/api/chat', authMiddleware, async (c) => {
    const { messages } = await c.req.json();
    const GEMINI_API_KEY = c.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) return c.json({ error: "GEMINI_API_KEY is not configured" }, 500);

    if (!messages || !Array.isArray(messages)) {
        return c.json({ error: "messages array is required" }, 400);
    }

    // Convert OpenAI-style messages to Gemini-style contents
    // messages: [{role: 'system'|'user'|'assistant', content: string}]
    // Gemini: [{role: 'user'|'model', parts: [{text: string}]}]
    
    let systemInstruction = "";
    const contents = [];

    for (const msg of messages) {
        if (msg.role === 'system') {
            systemInstruction += msg.content + "\n";
        } else {
            contents.push({
                role: msg.role === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content }]
            });
        }
    }

    const payload = {
        contents,
        system_instruction: systemInstruction ? {
            parts: [{ text: systemInstruction.trim() }]
        } : undefined,
        generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.7,
        }
    };

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "x-goog-api-key": GEMINI_API_KEY
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Gemini Error:", errText);
            return c.json({ error: "AI service error" }, 500);
        }

        const data = await response.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        
        return c.json({ response: text });
    } catch (e: any) {
        console.error("Worker Error:", e.message);
        return c.json({ error: "Internal server error" }, 500);
    }
});

export default app;
