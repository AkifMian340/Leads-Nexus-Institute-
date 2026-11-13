import { Box, Cpu, Gamepad2, Globe, Mic } from 'lucide-react';
import { useState } from 'react';
import { UserRole } from '../../types/institute';
import { LeadsAIChat } from './LeadsAIChat';
import { LeadsAIGame } from './LeadsAIGame';
import { LeadsAIThreeScene } from './LeadsAIThreeScene';
import { LeadsAITranscriber } from './LeadsAITranscriber';

type LeadsAIMode = 'chat' | 'transcribe' | 'three' | 'game';

interface LeadsAIHubProps {
  userRole: UserRole;
  userName: string;
}

export function LeadsAIHub({ userRole, userName }: LeadsAIHubProps) {
  const [mode, setMode] = useState<LeadsAIMode>('chat');
  const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null);

  const tabs: Array<{ id: LeadsAIMode; label: string; icon: typeof Globe; sub: string }> = [
    { id: 'chat', label: 'AI Chat & Search', icon: Globe, sub: 'Google Search Grounding' },
    { id: 'transcribe', label: 'Audio Transcriber', icon: Mic, sub: 'Speech-to-Text' },
    { id: 'three', label: '3D Studio Lab', icon: Box, sub: 'Interactive Three.js' },
    { id: 'game', label: '3D Cyber Game', icon: Gamepad2, sub: 'Nexus Data Surge' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-700">
            <Cpu className="h-3.5 w-3.5" />
            <span>Leads Nexus Institute · Intelligent Workspace</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Leads AI</h1>
          <p className="mt-1 text-sm text-slate-600">
            Live Google Search grounded tutoring, microphone audio transcription, interactive 3D
            models, and a 3D arcade simulation.
          </p>
        </div>

        <div className="inline-flex flex-wrap rounded-xl border border-slate-200 bg-white p-1 gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = mode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMode(tab.id)}
                className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-slate-950 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {mode === 'chat' && (
        <LeadsAIChat
          userRole={userRole}
          userName={userName}
          queuedPrompt={queuedPrompt}
          onConsumeQueuedPrompt={() => setQueuedPrompt(null)}
        />
      )}

      {mode === 'transcribe' && (
        <LeadsAITranscriber
          onSendToChat={(transcriptText) => {
            setQueuedPrompt(transcriptText);
            setMode('chat');
          }}
        />
      )}

      {mode === 'three' && <LeadsAIThreeScene />}

      {mode === 'game' && <LeadsAIGame />}
    </div>
  );
}
