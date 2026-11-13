import {
  ArrowUpRight,
  Cpu,
  Globe,
  Mic,
  MicOff,
  RotateCcw,
  Send,
} from 'lucide-react';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { UserRole } from '../../types/institute';

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface LeadsChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  sources?: GroundingSource[];
  queries?: string[];
  timestamp: string;
}

interface LeadsAIChatProps {
  userRole: UserRole;
  userName: string;
  queuedPrompt?: string | null;
  onConsumeQueuedPrompt?: () => void;
}

const COURSE_OPTIONS = [
  'All Diploma Courses',
  'Office Management',
  'Graphic Designing',
  'Digital Marketing',
  'Web Development',
  'AI Tutor',
];

const STARTER_PROMPTS = [
  'Build a 4-week study plan for our Web Development diploma track',
  'Search the latest 2026 trends in Digital Marketing & SEO',
  'Explain VLOOKUP vs XLOOKUP in Excel for Office Management',
  'What typography and color hierarchy rules apply in Graphic Designing?',
];

export function LeadsAIChat({
  userRole,
  userName,
  queuedPrompt,
  onConsumeQueuedPrompt,
}: LeadsAIChatProps) {
  const [messages, setMessages] = useState<LeadsChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: `Hello ${userName}. I am Leads AI, your Leads Nexus Institute assistant powered by live Google Search grounding. Ask any question about Office Management, Graphic Designing, Digital Marketing, Web Development, AI Tutor, or live web topics.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [courseFocus, setCourseFocus] = useState(COURSE_OPTIONS[0]);
  const [useSearch, setUseSearch] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Voice recording inside chat composer
  const [isRecording, setIsRecording] = useState(false);
  const [transcribingMic, setTranscribingMic] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const listEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (queuedPrompt && queuedPrompt.trim()) {
      setInput(queuedPrompt);
      onConsumeQueuedPrompt?.();
    }
  }, [queuedPrompt, onConsumeQueuedPrompt]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const sendMessage = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || loading) return;

    setError(null);
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsg: LeadsChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: nowTime,
    };

    const historyForApi = messages
      .filter((m) => m.id !== 'welcome')
      .map((m) => ({ role: m.role, text: m.text }));

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/leads-ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmed,
          history: historyForApi,
          useSearch,
          userRole,
          courseContext: courseFocus === 'All Diploma Courses' ? '' : courseFocus,
        }),
      });

      const data = (await res.json()) as {
        text?: string;
        sources?: GroundingSource[];
        webSearchQueries?: string[];
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || 'Failed to get response from Leads AI.');
      }

      const modelMsg: LeadsChatMessage = {
        id: `m_${Date.now()}`,
        role: 'model',
        text: data.text || 'No response returned.',
        sources: data.sources || [],
        queries: data.webSearchQueries || [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, modelMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach Leads AI.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const toggleVoiceInput = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      return;
    }

    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType: preferredMime });
      audioChunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size < 400) return;

        setTranscribingMic(true);
        try {
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('Failed to read recorded audio.'));
            reader.readAsDataURL(blob);
          });

          const res = await fetch('/api/leads-ai/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64,
              mimeType: 'audio/webm',
            }),
          });
          const data = (await res.json()) as { transcript?: string; error?: string };
          if (!res.ok) {
            throw new Error(data.error || 'Voice transcription failed.');
          }
          if (data.transcript) {
            setInput((prev) => (prev ? `${prev} ${data.transcript}` : data.transcript!));
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Microphone transcription failed.');
        } finally {
          setTranscribingMic(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setError('Microphone access was blocked or unavailable in this browser.');
      setIsRecording(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden flex flex-col h-[640px]">
      {/* Toolbar */}
      <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-950 text-white">
            <Cpu className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-950">Leads AI Assistant</div>
            <div className="text-xs text-slate-500">
              Gemini 4 Hydrogen · Real-Time Search Grounding &amp; Voice Prompting
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={courseFocus}
            onChange={(e) => setCourseFocus(e.target.value)}
            aria-label="Course context"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 focus:border-blue-700 focus:outline-none"
          >
            {COURSE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setUseSearch((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
              useSearch
                ? 'border-blue-700 bg-blue-50 text-blue-800'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>Google Search: {useSearch ? 'On' : 'Off'}</span>
          </button>

          <button
            type="button"
            onClick={() =>
              setMessages([
                {
                  id: 'welcome_reset',
                  role: 'model',
                  text: `Conversation cleared. Ask Leads AI anything about Leads Nexus Institute or current web topics.`,
                  timestamp: new Date().toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  }),
                },
              ])
            }
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* Quick Starter Row */}
      <div className="border-b border-slate-100 bg-white px-5 py-2.5 flex items-center gap-2 overflow-x-auto">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 shrink-0">
          Prompts
        </span>
        {STARTER_PROMPTS.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => void sendMessage(q)}
            disabled={loading}
            className="shrink-0 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-800 transition-colors disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 bg-slate-50/40">
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] sm:max-w-[76%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                  isUser
                    ? 'bg-slate-950 text-white'
                    : 'border border-slate-200 bg-white text-slate-800'
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-4 text-[11px]">
                  <span className={`font-semibold ${isUser ? 'text-slate-300' : 'text-blue-700'}`}>
                    {isUser ? userName : 'Leads AI'}
                  </span>
                  <span className={`font-mono tabular-nums ${isUser ? 'text-slate-400' : 'text-slate-400'}`}>
                    {msg.timestamp}
                  </span>
                </div>

                <div className="whitespace-pre-wrap">{msg.text}</div>

                {/* Grounded Google Search Sources */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="mt-3 border-t border-slate-100 pt-2.5">
                    <div className="text-[11px] font-semibold text-slate-500 flex items-center gap-1.5 mb-1.5">
                      <Globe className="h-3 w-3 text-blue-700" />
                      <span>Google Search Sources ({msg.sources.length})</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {msg.sources.slice(0, 6).map((src, idx) => (
                        <a
                          key={`${src.uri}_${idx}`}
                          href={src.uri}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 max-w-[260px]"
                        >
                          <span className="truncate">{src.title}</span>
                          <ArrowUpRight className="h-3 w-3 shrink-0" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex justify-start">
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-medium text-slate-600 flex items-center gap-2.5">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-700" />
              <span>
                Leads AI is {useSearch ? 'searching Google and ' : ''}composing an answer...
              </span>
            </div>
          </div>
        )}
        <div ref={listEndRef} />
      </div>

      {/* Error Notice */}
      {error && (
        <div className="border-t border-rose-200 bg-rose-50 px-5 py-2 text-xs font-medium text-rose-800">
          {error}
        </div>
      )}

      {/* Composer */}
      <form
        onSubmit={handleSubmit}
        className="border-t border-slate-200 bg-white px-4 py-3 flex items-center gap-2.5"
      >
        <button
          type="button"
          onClick={() => void toggleVoiceInput()}
          disabled={loading || transcribingMic}
          title={isRecording ? 'Stop voice recording' : 'Speak prompt via microphone'}
          className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-colors ${
            isRecording
              ? 'border-rose-600 bg-rose-600 text-white'
              : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
          } disabled:opacity-50`}
        >
          {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          <span className="hidden sm:inline">
            {transcribingMic ? 'Transcribing...' : isRecording ? 'Stop Mic' : 'Voice'}
          </span>
        </button>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isRecording
              ? 'Listening... click Stop Mic when finished speaking'
              : `Ask Leads AI (${courseFocus})...`
          }
          className="h-10 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:bg-white focus:outline-none"
        />

        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-blue-700 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-800 disabled:opacity-50"
        >
          <Send className="h-3.5 w-3.5" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
}
