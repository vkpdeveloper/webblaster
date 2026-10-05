// Chiptune-style sound effects, synthesized with Web Audio. No audio files ship with the extension.

export type ShotSound = 'blaster' | 'smg' | 'shotgun' | 'rocket';

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private jetGain: GainNode | null = null;
  private laserOsc: OscillatorNode | null = null;
  private laserGain: GainNode | null = null;
  private last = new Map<string, number>();

  constructor(private enabled: boolean) {}

  /** Must be called from a user gesture before anything is audible. */
  resume(): void {
    if (!this.ctx) {
      const ctx = new AudioContext();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.enabled ? 0.32 : 0;
      this.master.connect(ctx.destination);
      const len = ctx.sampleRate;
      this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.startLoops();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(on ? 0.32 : 0, this.ctx.currentTime, 0.02);
  }

  close(): void {
    void this.ctx?.close();
    this.ctx = null;
  }

  shot(kind: ShotSound): void {
    if (!this.ready() || !this.throttle(`shot-${kind}`, 35)) return;
    switch (kind) {
      case 'blaster':
        this.tone('square', 880, 220, 0.09, 0.22);
        break;
      case 'smg':
        this.tone('square', 640, 300, 0.05, 0.14);
        this.noise(0.04, 0.12, 3000, 'highpass');
        break;
      case 'shotgun':
        this.noise(0.22, 0.4, 1800, 'lowpass', 300);
        this.tone('square', 180, 60, 0.12, 0.2);
        break;
      case 'rocket':
        this.noise(0.35, 0.25, 900, 'bandpass', 300);
        this.tone('sawtooth', 220, 90, 0.25, 0.12);
        break;
    }
  }

  hit(): void {
    if (!this.ready() || !this.throttle('hit', 45)) return;
    this.noise(0.05, 0.1, 2400, 'bandpass', 900);
  }

  boom(radius: number): void {
    if (!this.ready() || !this.throttle('boom', 40)) return;
    const big = Math.min(1, radius / 20);
    this.noise(0.5 + big * 0.5, 0.55, 1400, 'lowpass', 120);
    this.tone('sine', 110, 30, 0.4 + big * 0.3, 0.5);
  }

  crumble(count: number): void {
    if (!this.ready() || !this.throttle('crumble', 60)) return;
    this.noise(0.18 + Math.min(0.3, count * 0.03), 0.3, 900, 'lowpass', 150);
    this.tone('square', 160, 50, 0.1, 0.1);
  }

  enemyShot(): void {
    if (!this.ready() || !this.throttle('eshot', 60)) return;
    this.tone('square', 420, 180, 0.07, 0.08);
  }

  enemyDie(): void {
    if (!this.ready() || !this.throttle('edie', 50)) return;
    this.noise(0.25, 0.3, 1800, 'lowpass', 200);
    this.tone('square', 300, 60, 0.22, 0.12);
  }

  playerDie(): void {
    if (!this.ready()) return;
    [660, 520, 400, 300, 220, 160].forEach((f, i) => this.tone('square', f, f * 0.9, 0.09, 0.16, i * 0.07));
    this.noise(0.5, 0.35, 1200, 'lowpass', 100);
  }

  respawn(): void {
    if (!this.ready()) return;
    [392, 523, 659, 784].forEach((f, i) => this.tone('triangle', f, f, 0.08, 0.14, i * 0.05));
  }

  jump(): void {
    if (!this.ready()) return;
    this.tone('square', 260, 520, 0.12, 0.14);
  }

  flip(): void {
    if (!this.ready()) return;
    this.tone('square', 400, 900, 0.16, 0.12);
  }

  bounce(): void {
    if (!this.ready() || !this.throttle('bounce', 80)) return;
    this.tone('triangle', 520, 380, 0.05, 0.12);
  }

  select(): void {
    if (!this.ready()) return;
    this.tone('square', 990, 990, 0.05, 0.1);
  }

  milestone(): void {
    if (!this.ready()) return;
    [523, 659, 784, 1047].forEach((f, i) => this.tone('square', f, f, 0.1, 0.16, i * 0.08));
  }

  win(): void {
    if (!this.ready()) return;
    [523, 523, 784, 784, 1047, 988, 1047].forEach((f, i) => this.tone('square', f, f, 0.12, 0.18, i * 0.11));
  }

  /** Dhol for the sidekick's dance: a deep thump on the beat, a dry slap off it. */
  dhol(strong: boolean): void {
    if (!this.ready()) return;
    if (strong) this.tone('sine', 140, 55, 0.22, 0.5);
    else this.noise(0.05, 0.14, 3200, 'bandpass', 2200);
  }

  /** One plucked note of a tumbi riff. */
  tumbi(freq: number): void {
    if (!this.ready()) return;
    this.tone('square', freq, freq * 0.97, 0.09, 0.05);
  }

  jet(on: boolean): void {
    if (this.jetGain && this.ctx) this.jetGain.gain.setTargetAtTime(on ? 0.18 : 0, this.ctx.currentTime, 0.03);
  }

  laser(on: boolean): void {
    if (!this.laserGain || !this.laserOsc || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.laserGain.gain.setTargetAtTime(on ? 0.07 : 0, t, 0.02);
    if (on) this.laserOsc.frequency.setValueAtTime(140 + Math.random() * 40, t);
  }

  private ready(): boolean {
    return !!this.ctx && this.enabled;
  }

  private throttle(key: string, ms: number): boolean {
    const now = performance.now();
    if (now - (this.last.get(key) ?? 0) < ms) return false;
    this.last.set(key, now);
    return true;
  }

  private startLoops(): void {
    const ctx = this.ctx!;
    const jet = ctx.createBufferSource();
    jet.buffer = this.noiseBuf;
    jet.loop = true;
    const jetFilter = ctx.createBiquadFilter();
    jetFilter.type = 'lowpass';
    jetFilter.frequency.value = 700;
    this.jetGain = ctx.createGain();
    this.jetGain.gain.value = 0;
    jet.connect(jetFilter).connect(this.jetGain).connect(this.master!);
    jet.start();

    this.laserOsc = ctx.createOscillator();
    this.laserOsc.type = 'sawtooth';
    this.laserOsc.frequency.value = 150;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 30;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 40;
    lfo.connect(lfoGain).connect(this.laserOsc.frequency);
    this.laserGain = ctx.createGain();
    this.laserGain.gain.value = 0;
    this.laserOsc.connect(this.laserGain).connect(this.master!);
    this.laserOsc.start();
    lfo.start();
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, freq: number, type: BiquadFilterType, freqEnd?: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, t);
    if (freqEnd) filter.frequency.exponentialRampToValueAtTime(freqEnd, t + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(this.master!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }
}
