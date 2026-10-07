// Chiptune-style sound effects, synthesized with Web Audio. No audio files ship with the extension.

export type ShotSound = 'blaster' | 'smg' | 'shotgun' | 'rocket';

const VOLUME = 0.42;
/** Major pentatonic steps, so a rising combo always sounds like a tune. */
const PENTA = [0, 2, 4, 7, 9];
/** A little random pitch on every repeat keeps rapid fire from sounding like a machine. */
const vary = (f: number, amount = 0.07) => f * (1 + (Math.random() * 2 - 1) * amount);

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private jetGain: GainNode | null = null;
  private laserOsc: OscillatorNode | null = null;
  private laserGain: GainNode | null = null;
  private rageGain: GainNode | null = null;
  private last = new Map<string, number>();
  private song: AudioBuffer | null = null;
  private songOut: { src: AudioBufferSourceNode; gain: GainNode; start: number } | null = null;

  constructor(private enabled: boolean) {}

  /** Must be called from a user gesture before anything is audible. */
  resume(): void {
    if (!this.ctx) {
      const ctx = new AudioContext();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.enabled ? VOLUME : 0;
      // A fast limiter, so a pile of explosions hits hard instead of clipping.
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -16;
      limiter.knee.value = 8;
      limiter.ratio.value = 10;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.18;
      this.master.connect(limiter).connect(ctx.destination);
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
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(on ? VOLUME : 0, this.ctx.currentTime, 0.02);
  }

  close(): void {
    void this.ctx?.close();
    this.ctx = null;
    this.songOut = null;
  }

  shot(kind: ShotSound): void {
    if (!this.ready() || !this.throttle(`shot-${kind}`, 35)) return;
    // Each shot is a bright crack on top of a short low thump, so it has body as well as bite.
    switch (kind) {
      case 'blaster':
        this.tone('square', vary(880), 200, 0.09, 0.2);
        this.tone('sine', 150, 45, 0.08, 0.35);
        break;
      case 'smg':
        this.tone('square', vary(640, 0.1), 280, 0.05, 0.13);
        this.noise(0.04, 0.12, vary(3200), 'highpass');
        this.tone('sine', vary(130), 50, 0.05, 0.25);
        break;
      case 'shotgun':
        this.noise(0.28, 0.45, 2200, 'lowpass', 250);
        this.tone('square', vary(180), 55, 0.14, 0.2);
        this.tone('sine', 110, 32, 0.22, 0.55);
        break;
      case 'rocket':
        this.noise(0.4, 0.28, vary(900), 'bandpass', 250);
        this.tone('sawtooth', vary(220), 80, 0.28, 0.12);
        this.tone('sine', 90, 35, 0.2, 0.4);
        break;
    }
  }

  hit(): void {
    if (!this.ready() || !this.throttle('hit', 45)) return;
    this.noise(0.05, 0.12, vary(2400, 0.2), 'bandpass', 900);
  }

  /** An explosion in three layers: a sharp crack, a crunchy body and a long sub-bass tail. */
  boom(radius: number): void {
    if (!this.ready() || !this.throttle('boom', 40)) return;
    const big = Math.min(1, radius / 20);
    this.noise(0.07, 0.5, vary(5000, 0.2), 'highpass');
    this.noise(0.5 + big * 0.6, 0.6, vary(1600), 'lowpass', 90);
    this.tone('sine', vary(95), 24, 0.5 + big * 0.5, 0.8);
    this.tone('triangle', vary(60), 28, 0.3 + big * 0.3, 0.35);
  }

  /** Bits of the page raining down after a hit. */
  crunch(cells: number): void {
    if (!this.ready() || !this.throttle('crunch', 70)) return;
    const n = Math.min(1, cells / 400);
    this.noise(0.06 + n * 0.12, 0.08 + n * 0.14, vary(1400, 0.4), 'bandpass', 500);
  }

  /** A spent shell casing tinkling on the floor. */
  shell(): void {
    if (!this.ready() || !this.throttle('shell', 45)) return;
    const f = vary(3000, 0.25);
    this.tone('triangle', f, f * 0.94, 0.05, 0.05);
  }

  /** Crosshair hit marker: a crisp tick that says "that one landed". */
  hitMarker(kill: boolean): void {
    if (!this.ready() || !this.throttle('marker', 30)) return;
    this.tone('square', kill ? 1760 : 1320, kill ? 1760 : 1300, 0.035, 0.06);
  }

  /** One rising note per combo step, climbing a pentatonic scale. */
  combo(n: number): void {
    if (!this.ready() || !this.throttle('combo', 45)) return;
    // Climb two octaves, then keep cycling the top one so long chains stay musical (and audible).
    const step = n <= 15 ? n - 1 : 5 + ((n - 6) % 10);
    const semis = 12 * Math.floor(step / PENTA.length) + PENTA[step % PENTA.length];
    const f = 523 * 2 ** (semis / 12);
    this.tone('square', f, f, 0.06, 0.07);
    this.tone('triangle', f * 2, f * 2, 0.08, 0.05);
  }

  /** A short fanfare when the combo reaches a new tier. */
  tier(level: number): void {
    if (!this.ready()) return;
    const root = 523 * 2 ** (level / 12);
    [1, 1.26, 1.5, 2].forEach((m, i) => this.tone('square', root * m, root * m, 0.09, 0.14, i * 0.05));
    this.tone('sine', 130, 40, 0.3, 0.4);
  }

  /** Rage mode: a power-up sweep, then a growling drone underneath everything until it runs out. */
  rage(on: boolean): void {
    this.rageDrone(on);
    if (!this.ready()) return;
    if (on) {
      this.tone('sawtooth', 110, 880, 0.6, 0.18);
      this.tone('square', 220, 1760, 0.6, 0.08);
      this.noise(0.9, 0.35, 300, 'lowpass', 3000);
    } else {
      this.tone('sawtooth', 660, 110, 0.5, 0.12);
    }
  }

  rageDrone(on: boolean): void {
    if (this.rageGain && this.ctx) this.rageGain.gain.setTargetAtTime(on ? 0.09 : 0, this.ctx.currentTime, on ? 0.2 : 0.1);
  }

  rageReady(): void {
    if (!this.ready()) return;
    [392, 494, 587, 784, 988].forEach((f, i) => this.tone('square', f, f, 0.07, 0.13, i * 0.045));
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
    this.noise(0.3, 0.35, vary(1800), 'lowpass', 160);
    this.tone('square', vary(300), 60, 0.22, 0.12);
    this.tone('sine', 120, 35, 0.25, 0.45);
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

  /** Fetch and decode a song for `music()`. Leaves `hasSong` false if the file is missing or unreadable. */
  async loadSong(url: string): Promise<void> {
    try {
      const res = await fetch(url);
      if (res.ok) this.song = await new OfflineAudioContext(2, 1, 44100).decodeAudioData(await res.arrayBuffer());
    } catch {
      this.song = null;
    }
  }

  get hasSong(): boolean {
    return !!this.song;
  }

  /** Loop the loaded song from the top, or fade it out. */
  music(on: boolean): void {
    if (on && !this.songOut && this.song && this.ready()) {
      const ctx = this.ctx!;
      const src = ctx.createBufferSource();
      src.buffer = this.song;
      src.loop = true;
      const gain = ctx.createGain();
      src.connect(gain).connect(this.master!);
      src.start();
      this.songOut = { src, gain, start: ctx.currentTime };
    } else if (!on && this.songOut && this.ctx) {
      const t = this.ctx.currentTime;
      this.songOut.gain.gain.setTargetAtTime(0, t, 0.08);
      this.songOut.src.stop(t + 0.4);
      this.songOut = null;
    }
  }

  /** Seconds into the song as it's heard, or null when it isn't playing. */
  musicTime(): number | null {
    if (!this.songOut || !this.song || this.ctx?.state !== 'running') return null;
    const t = this.ctx.currentTime - this.songOut.start - (this.ctx.outputLatency || 0);
    return Math.max(0, t) % this.song.duration;
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

    // Rage drone: two detuned saws through a pulsing low-pass.
    this.rageGain = ctx.createGain();
    this.rageGain.gain.value = 0;
    const rageFilter = ctx.createBiquadFilter();
    rageFilter.type = 'lowpass';
    rageFilter.frequency.value = 500;
    rageFilter.Q.value = 6;
    const pulse = ctx.createOscillator();
    pulse.frequency.value = 4;
    const pulseDepth = ctx.createGain();
    pulseDepth.gain.value = 350;
    pulse.connect(pulseDepth).connect(rageFilter.frequency);
    for (const f of [55, 55.7]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.connect(rageFilter);
      o.start();
    }
    rageFilter.connect(this.rageGain).connect(this.master!);
    pulse.start();
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
