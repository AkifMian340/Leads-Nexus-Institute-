// 100% procedural Web Audio API sound synthesis for Leads AI 3D Game (zero external audio files)

class ProceduralAudioSynth {
  private ctx: AudioContext | null = null;
  public muted = false;

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(next: boolean) {
    this.muted = next;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    volume = 0.12,
    delay = 0,
    endFreq?: number
  ) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  public playLaneShift() {
    this.playTone(260, 0.08, 'triangle', 0.07, 0, 390);
  }

  public playJump() {
    this.playTone(220, 0.18, 'sine', 0.1, 0, 520);
  }

  public playPickupChime(combo = 1) {
    const pitchBoost = Math.min(combo, 6) * 45;
    this.playTone(523.25 + pitchBoost, 0.12, 'triangle', 0.11, 0);
    this.playTone(659.25 + pitchBoost, 0.16, 'sine', 0.11, 0.06);
  }

  public playShieldChime() {
    this.playTone(440, 0.14, 'sine', 0.1, 0);
    this.playTone(554.37, 0.14, 'sine', 0.1, 0.07);
    this.playTone(880, 0.24, 'triangle', 0.11, 0.14);
  }

  public playCollisionHit() {
    this.playTone(150, 0.26, 'sawtooth', 0.16, 0, 48);
    this.playTone(95, 0.28, 'square', 0.1, 0.02, 36);
  }

  public playLevelUp() {
    this.playTone(392, 0.12, 'triangle', 0.1, 0);
    this.playTone(523.25, 0.12, 'triangle', 0.1, 0.09);
    this.playTone(659.25, 0.14, 'triangle', 0.11, 0.18);
    this.playTone(783.99, 0.28, 'sine', 0.12, 0.27);
  }

  public playVictoryFanfare() {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      this.playTone(freq, 0.24, 'triangle', 0.12, i * 0.1);
    });
  }
}

export const gameAudio = new ProceduralAudioSynth();
