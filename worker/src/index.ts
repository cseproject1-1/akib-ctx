import { Hono } from 'hono';
import { cors } from 'hono/cors';

type Bindings = {
    GEMINI_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('*', cors({
    origin: '*',
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['POST', 'GET', 'OPTIONS'],
}));

// 1. urlMetadata
app.post('/api/urlMetadata', async (c) => {
    const { url } = await c.req.json();
    if (!url || typeof url !== 'string') {
        return c.json({ error: 'url is required' }, 400);
    }

    try {
        const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (CtxNoteBot/1.0)' } });
        const text = await response.text();
        const titleMatch = text.match(/<title>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1] : new URL(url).hostname;

        return c.json({
            title,
            description: null,
            image: null,
            favicon: `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=64`,
            domain: new URL(url).hostname
        });
    } catch (e) {
        return c.json({ title: new URL(url).hostname, domain: new URL(url).hostname });
    }
});

// 2. aiStudy
app.post('/api/aiStudy', async (c) => {
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
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("Gemini Error:", errText);
            return c.json({ error: "AI service error", details: errText }, 500);
        }

        const result: any = await response.json();
        const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (textResponse) {
            return c.json({ data: JSON.parse(textResponse) });
        }
        return c.json({ error: "No output returned" }, 500);
    } catch (e: any) {
        return c.json({ error: e.message || "Unknown error" }, 500);
    }
});

export default app;
