import {
  Check,
  Copy,
  Download,
  FileAudio,
  MessageSquarePlus,
  Mic,
  Square,
  Trash2,
  Upload,
} from 'lucide-react';
import { ChangeEvent, useEffect, useRef, useState } from 'react';

interface LeadsAITranscriberProps {
  onSendToChat: (transcriptText: string) => void;
}

export function LeadsAITranscriber({ onSendToChat }: LeadsAITranscriberProps) {
  const [recording, setRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [sourceLabel, setSourceLabel] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const timerRef = useRef<number | null>(null);
  const animRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const stopVisualizerAndStream = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (animRef.current !== null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  };

  useEffect(() => {
    return () => {
      stopVisualizerAndStream();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const renderFrame = () => {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);

      const width = canvas.width;
      const height = canvas.height;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, width, height);

      const barCount = 40;
      const step = Math.max(1, Math.floor(bufferLength / barCount));
      const barWidth = width / barCount - 3;

      for (let i = 0; i < barCount; i++) {
        const value = dataArray[i * step] ?? 0;
        const barHeight = Math.max(4, (value / 255) * (height - 16));
        const x = i * (barWidth + 3) + 1.5;
        const y = (height - barHeight) / 2;
        ctx.fillStyle = value > 140 ? '#38bdf8' : '#2563eb';
        ctx.fillRect(x, y, barWidth, barHeight);
      }

      animRef.current = requestAnimationFrame(renderFrame);
    };

    animRef.current = requestAnimationFrame(renderFrame);
  };

  const transcribeBlob = async (blob: Blob, label: string, mimeType: string) => {
    setError(null);
    setTranscribing(true);
    setSourceLabel(label);

    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(blob);
    });

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read audio data.'));
        reader.readAsDataURL(blob);
      });

      const res = await fetch('/api/leads-ai/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audioBase64: base64,
          mimeType: mimeType || 'audio/webm',
        }),
      });
      const data = (await res.json()) as { transcript?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Transcription request failed.');
      }
      setTranscript(data.transcript || '(No speech detected in audio.)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transcribe audio.');
    } finally {
      setTranscribing(false);
    }
  };

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;
        source.connect(analyser);
        audioCtxRef.current = audioCtx;
        analyserRef.current = analyser;
      }

      const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType: preferredMime });
      chunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        stopVisualizerAndStream();
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (blob.size > 200) {
          void transcribeBlob(blob, 'Microphone Recording', 'audio/webm');
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setElapsedSec(0);
      setRecording(true);
      timerRef.current = window.setInterval(() => {
        setElapsedSec((s) => s + 1);
      }, 1000);
      drawWaveform();
    } catch {
      stopVisualizerAndStream();
      setError('Microphone access is blocked or unavailable in this browser.');
      setRecording(false);
    }
  };

  const stopRecording = () => {
    setRecording(false);
    mediaRecorderRef.current?.stop();
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 18 * 1024 * 1024) {
      setError('Audio file is too large (max 18 MB).');
      return;
    }
    void transcribeBlob(file, file.name, file.type || 'audio/mp3');
    e.target.value = '';
  };

  const formatDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const handleCopy = async () => {
    if (!transcript) return;
    await navigator.clipboard.writeText(transcript);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    if (!transcript) return;
    const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads-ai-transcript-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const wordCount = transcript.trim() ? transcript.trim().split(/\s+/).length : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Left: Capture & Upload Controls */}
      <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-6 flex flex-col justify-between gap-6">
        <div>
          <h2 className="text-base font-bold text-slate-950">Audio Capture &amp; Upload</h2>
          <p className="mt-1 text-xs text-slate-600">
            Record lectures, student voice notes, or upload audio files for instant transcription via
            <span className="font-mono text-slate-800"> gemini-3.5-transcribe</span>.
          </p>

          {/* Waveform Monitor */}
          <div className="mt-5 overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
            <canvas
              ref={canvasRef}
              width={400}
              height={110}
              className="block h-28 w-full"
            />
            <div className="flex items-center justify-between border-t border-slate-800 px-4 py-2 text-xs">
              <span className="font-medium text-slate-300">
                {recording ? 'Recording live microphone...' : 'Microphone standby'}
              </span>
              <span className="font-mono font-semibold tabular-nums text-sky-400">
                {formatDuration(elapsedSec)}
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {!recording ? (
              <button
                type="button"
                onClick={() => void startRecording()}
                disabled={transcribing}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                <Mic className="h-4 w-4" />
                <span>Start Microphone Recording</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={stopRecording}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
              >
                <Square className="h-4 w-4 fill-current" />
                <span>Stop &amp; Transcribe ({formatDuration(elapsedSec)})</span>
              </button>
            )}

            <label className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-100">
              <Upload className="h-4 w-4 text-slate-600" />
              <span>Upload Audio File (.mp3, .wav, .webm, .m4a)</span>
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileUpload}
                disabled={recording || transcribing}
                className="hidden"
              />
            </label>
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800">
              {error}
            </div>
          )}
        </div>

        {audioUrl && (
          <div className="border-t border-slate-100 pt-4">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-slate-600">
              <FileAudio className="h-3.5 w-3.5 text-blue-700" />
              <span className="truncate">{sourceLabel}</span>
            </div>
            <audio src={audioUrl} controls className="w-full h-9" />
          </div>
        )}
      </div>

      {/* Right: Transcript Output */}
      <div className="lg:col-span-3 rounded-xl border border-slate-200 bg-white p-6 flex flex-col">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-base font-bold text-slate-950">Transcript Output</h2>
            <p className="text-xs text-slate-500 font-mono tabular-nums mt-0.5">
              {wordCount} words · {transcript.length} characters
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void handleCopy()}
              disabled={!transcript}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadTxt}
              disabled={!transcript}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export .txt</span>
            </button>
            <button
              type="button"
              onClick={() => onSendToChat(`Please summarize and explain this transcript:\n\n${transcript}`)}
              disabled={!transcript}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
            >
              <MessageSquarePlus className="h-3.5 w-3.5" />
              <span>Ask Leads AI</span>
            </button>
            {transcript && (
              <button
                type="button"
                onClick={() => setTranscript('')}
                aria-label="Clear transcript"
                className="rounded-lg border border-rose-200 p-1.5 text-rose-700 hover:bg-rose-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="relative mt-4 flex-1">
          {transcribing ? (
            <div className="flex h-full min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-blue-700" />
              <p className="mt-3 text-sm font-medium text-slate-700">
                Transcribing audio with Leads AI...
              </p>
            </div>
          ) : (
            <textarea
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="Record from your microphone or upload an audio clip to generate an accurate transcript here..."
              className="h-full min-h-[280px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm leading-relaxed text-slate-800 focus:border-blue-700 focus:bg-white focus:outline-none"
            />
          )}
        </div>
      </div>
    </div>
  );
}
