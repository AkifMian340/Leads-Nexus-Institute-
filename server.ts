import 'dotenv/config';
import { GoogleGenAI } from '@google/genai';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured. Please check Settings > Secrets in AI Studio.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface ChatHistoryTurn {
  role: 'user' | 'model';
  text: string;
}

interface GroundingSource {
  title: string;
  uri: string;
}

const LEADS_AI_SYSTEM_INSTRUCTION = `You are Leads AI, the official AI Assistant and Tutor for Leads Nexus Institute — a computer diploma institute offering 5 core diploma courses:
1. Office Management (MS Office, Excel automation, document workflows, business communication)
2. Graphic Designing (Adobe Photoshop, Illustrator, CorelDRAW, visual branding, print & social design)
3. Digital Marketing (SEO, social media campaigns, Google Ads, analytics, content strategy)
4. Web Development (HTML5, CSS3, JavaScript, TypeScript, React, backend fundamentals)
5. AI Tutor (Prompt engineering, AI productivity workflows, automation, applied generative tools)

Be clear, concise, practical, and encouraging for students, teachers, parents, and administrators. When Google Search grounding provides live web data, incorporate accurate facts and cite clearly.`;

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  // Leads AI Chat with Google Search Grounding (gemini-4-hydrogen)
  app.post('/api/leads-ai/chat', async (req: Request, res: Response) => {
    try {
      const {
        prompt,
        history = [],
        useSearch = true,
        userRole = 'student',
        courseContext = '',
      } = req.body as {
        prompt?: string;
        history?: ChatHistoryTurn[];
        useSearch?: boolean;
        userRole?: string;
        courseContext?: string;
      };

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        res.status(400).json({ error: 'Please enter a prompt for Leads AI.' });
        return;
      }

      const ai = getGeminiClient();

      const contents = [
        ...history
          .filter((h) => h && (h.role === 'user' || h.role === 'model') && typeof h.text === 'string' && h.text.trim())
          .slice(-12)
          .map((h) => ({
            role: h.role,
            parts: [{ text: h.text }],
          })),
        {
          role: 'user',
          parts: [{ text: prompt.trim() }],
        },
      ];

      const roleHint = `Current user portal role: ${userRole}.${
        courseContext ? ` Course focus: ${courseContext}.` : ''
      }`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction: `${LEADS_AI_SYSTEM_INSTRUCTION}\n${roleHint}`,
          ...(useSearch ? { tools: [{ googleSearch: {} }] } : {}),
        },
      });

      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const seenUris = new Set<string>();
      const sources: GroundingSource[] = [];

      for (const chunk of chunks) {
        const web = (chunk as { web?: { uri?: string; title?: string } }).web;
        if (web?.uri && !seenUris.has(web.uri)) {
          seenUris.add(web.uri);
          sources.push({
            title: web.title || web.uri,
            uri: web.uri,
          });
        }
      }

      const webSearchQueries =
        response.candidates?.[0]?.groundingMetadata?.webSearchQueries ?? [];

      res.json({
        text: response.text ?? 'No response generated.',
        sources,
        webSearchQueries,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Leads AI request failed.';
      console.error('[Leads AI /chat error]:', err);
      res.status(500).json({ error: message });
    }
  });

  // Leads AI Audio Transcription (gemini-3.5-transcribe)
  app.post('/api/leads-ai/transcribe', async (req: Request, res: Response) => {
    try {
      const { audioBase64, mimeType = 'audio/webm', instruction } = req.body as {
        audioBase64?: string;
        mimeType?: string;
        instruction?: string;
      };

      if (!audioBase64 || typeof audioBase64 !== 'string') {
        res.status(400).json({ error: 'No audio payload received.' });
        return;
      }

      const cleanBase64 = audioBase64.includes(',')
        ? audioBase64.split(',')[1]
        : audioBase64;

      const ai = getGeminiClient();

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType,
                data: cleanBase64,
              },
            },
            {
              text:
                instruction?.trim() ||
                'Transcribe this audio accurately with proper punctuation and capitalization.',
            },
          ],
        },
      });

      res.json({
        transcript: (response.text ?? '').trim(),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Audio transcription failed.';
      console.error('[Leads AI /transcribe error]:', err);
      res.status(500).json({ error: message });
    }
  });

  // Mount Vite middleware in dev or serve static dist in production
  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Leads Nexus Institute server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
