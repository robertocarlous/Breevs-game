"use client";

import { useRef, useCallback, useEffect } from "react";

let sharedCtx: AudioContext | null = null;
let bgMusicInstance: BgMusic | null = null;
let bgMusicStarted = false;
let unlockListenerAttached = false;

// ── AudioContext ──────────────────────────────────────────────────────────────
async function getCtx(): Promise<AudioContext | null> {
  if (typeof window === "undefined") return null;
  try {
    if (!sharedCtx || sharedCtx.state === "closed") {
      sharedCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (sharedCtx.state === "suspended") await sharedCtx.resume();
    return sharedCtx.state === "running" ? sharedCtx : null;
  } catch { return null; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function osc(ctx: AudioContext, dest: AudioNode, freq: number, type: OscillatorType,
             t: number, dur: number, vol = 0.3, endFreq?: number) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (endFreq != null) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur * 0.9);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.01);
}

function noise(ctx: AudioContext, dur: number, env?: (i: number, n: number) => number) {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (env ? env(i, d.length) : 1);
  return buf;
}

function playNoise(ctx: AudioContext, dest: AudioNode, dur: number, vol: number,
                  t: number, filterType: BiquadFilterType, filterFreq: number, Q = 1,
                  env?: (i: number, n: number) => number) {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx, dur, env);
  const f = ctx.createBiquadFilter();
  f.type = filterType; f.frequency.value = filterFreq; f.Q.value = Q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(f); f.connect(g); g.connect(dest);
  src.start(t); src.stop(t + dur);
}

// ── Background music (120 BPM lounge/casino groove) ─────────────────────────
class BgMusic {
  private ctx: AudioContext;
  private master: GainNode;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private alive = true;

  constructor(ctx: AudioContext, vol = 0.06) {
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = vol;
    this.master.connect(ctx.destination);
  }

  start() { this.chunk(this.ctx.currentTime + 0.05); }

  private chunk(t0: number) {
    if (!this.alive) return;
    const ctx = this.ctx; const m = this.master;
    const bpm = 120; const b = 60 / bpm; const bars = 4; const bar = b * 4;

    for (let bar_ = 0; bar_ < bars; bar_++) {
      const bs = t0 + bar_ * bar;

      // Kick on 1 & 3
      [0, 2].forEach(i => osc(ctx, m, 80, "sine", bs + i * b, 0.35, 0.9, 32));

      // Snare on 2 & 4
      [1, 3].forEach(i => playNoise(ctx, m, 0.12, 0.3, bs + i * b, "highpass", 1600, 2));

      // Hi-hat 8ths
      for (let h = 0; h < 8; h++) {
        const vol = h % 2 === 0 ? 0.18 : 0.07;
        playNoise(ctx, m, 0.05, vol, bs + h * b * 0.5, "highpass", 10000, 1);
      }

      // Bass: simple pattern A E A G
      const bass = [55, 41.2, 55, 49];
      bass.forEach((f, i) => osc(ctx, m, f, "sawtooth", bs + i * b, b * 0.7, 0.22));

      // Rhodes-like chord stabs (beats 1.5 and 3.5)
      const chordNotes = [[261.6, 329.6, 392], [220, 277.2, 329.6]];
      [0.5, 2.5].forEach((beat, ci) => {
        chordNotes[ci].forEach(f => osc(ctx, m, f, "sine", bs + beat * b, 0.3, 0.05));
      });
    }

    const next = t0 + bars * bar;
    const delay = Math.max(0, (next - ctx.currentTime - 0.3) * 1000);
    const id = setTimeout(() => this.chunk(next), delay);
    this.timers.push(id);
  }

  setVolume(v: number) {
    this.master.gain.linearRampToValueAtTime(v, this.ctx.currentTime + 0.4);
  }

  stop() {
    this.alive = false;
    this.timers.forEach(clearTimeout);
    this.timers = [];
    this.master.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
  }
}

// ── Unlock helper ─────────────────────────────────────────────────────────────
function scheduleOnInteraction(fn: () => void) {
  if (unlockListenerAttached) return;
  unlockListenerAttached = true;
  const run = () => { unlockListenerAttached = false; fn(); };
  document.addEventListener("click",      run, { once: true, capture: true });
  document.addEventListener("touchend",   run, { once: true, capture: true });
  document.addEventListener("keydown",    run, { once: true, capture: true });
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useAudioManager() {
  const mutedRef = useRef(false);

  // ─── Music ─────────────────────────────────────────────────────────────────
  const startMusicNow = useCallback(async () => {
    if (bgMusicStarted || mutedRef.current) return;
    const ctx = await getCtx();
    if (!ctx) return;
    if (!bgMusicInstance) bgMusicInstance = new BgMusic(ctx, 0.06);
    bgMusicInstance.start();
    bgMusicStarted = true;
  }, []);

  const startMusic = useCallback(() => {
    if (bgMusicStarted || mutedRef.current) return;
    scheduleOnInteraction(() => startMusicNow());
  }, [startMusicNow]);

  const stopMusic = useCallback(() => {
    bgMusicInstance?.stop();
    bgMusicInstance = null;
    bgMusicStarted = false;
  }, []);

  const toggleMute = useCallback((): boolean => {
    mutedRef.current = !mutedRef.current;
    if (mutedRef.current) {
      bgMusicInstance?.setVolume(0);
    } else {
      if (!bgMusicStarted) startMusicNow();
      else bgMusicInstance?.setVolume(0.06);
    }
    return mutedRef.current;
  }, [startMusicNow]);

  const isMuted = useCallback(() => mutedRef.current, []);

  // ─── Spin: fast mechanical ratchet click ──────────────────────────────────
  const playSpinSound = useCallback(async () => {
    const ctx = await getCtx();
    if (!ctx || mutedRef.current) return;
    const t = ctx.currentTime;

    // Metal click at the start
    playNoise(ctx, ctx.destination, 0.08, 0.5, t, "bandpass", 3500, 8);

    // Rapid ticking clicks (ratchet effect)
    for (let i = 0; i < 12; i++) {
      const tick = t + 0.04 + i * 0.055;
      playNoise(ctx, ctx.destination, 0.03, 0.25 - i * 0.015, tick, "bandpass", 4000, 10);
    }

    // Whirring tone — pitch drops as wheel slows
    osc(ctx, ctx.destination, 600, "sawtooth", t, 0.7, 0.12, 80);

    // Low mechanical rumble
    osc(ctx, ctx.destination, 55, "sine", t, 0.5, 0.15);
  }, []);

  // ─── Join: bright positive chime ─────────────────────────────────────────
  const playJoinSound = useCallback(async () => {
    const ctx = await getCtx();
    if (!ctx || mutedRef.current) return;
    const t = ctx.currentTime;

    // Ascending chime: C E G C
    [[523, 0], [659, 0.1], [784, 0.2], [1047, 0.32]].forEach(([f, dt]) => {
      osc(ctx, ctx.destination, f as number, "sine", t + (dt as number), 0.35, 0.22);
    });

    // Soft sparkle shimmer
    osc(ctx, ctx.destination, 2093, "sine", t + 0.32, 0.4, 0.06);

    // Confirm bass note
    osc(ctx, ctx.destination, 130, "sine", t, 0.25, 0.18);
  }, []);

  // ─── Elimination: dramatic tension hit ───────────────────────────────────
  const playEliminationSound = useCallback(async () => {
    const ctx = await getCtx();
    if (!ctx || mutedRef.current) return;
    const t = ctx.currentTime;

    // Gunshot-style low thud
    osc(ctx, ctx.destination, 120, "sine", t, 0.4, 1.0, 20);

    // Descending minor chord stabs
    [[220, 0], [174.6, 0.06], [146.8, 0.13]].forEach(([f, dt]) => {
      osc(ctx, ctx.destination, f as number, "sawtooth", t + (dt as number), 0.6, 0.3);
    });

    // High-pitched elimination sting (like a bullet ricochet)
    osc(ctx, ctx.destination, 2500, "sine", t, 0.15, 0.18, 400);

    // Noise burst (the "shot")
    playNoise(ctx, ctx.destination, 0.15, 0.6, t, "highpass", 2500, 1);

    // Reverberant tail
    osc(ctx, ctx.destination, 60, "sine", t + 0.1, 0.8, 0.15, 35);
  }, []);

  // ─── Win: triumphant fanfare ──────────────────────────────────────────────
  const playWinSound = useCallback(async () => {
    const ctx = await getCtx();
    if (!ctx || mutedRef.current) return;
    const t = ctx.currentTime;

    // Fanfare melody: C G C E G C (ascending triumphant)
    const melody: [number, number, number][] = [
      [523, 0,    0.15],
      [523, 0.16, 0.15],
      [784, 0.32, 0.22],
      [659, 0.55, 0.15],
      [784, 0.71, 0.15],
      [1047,0.87, 0.55],
    ];
    melody.forEach(([f, dt, dur]) => {
      osc(ctx, ctx.destination, f, "square",   t + dt, dur, 0.28);
      osc(ctx, ctx.destination, f, "sine",     t + dt, dur, 0.12);
    });

    // Harmony (3rd below)
    melody.forEach(([f, dt, dur]) => {
      osc(ctx, ctx.destination, f * 0.794, "sine", t + dt, dur, 0.08);
    });

    // Bass foundation
    osc(ctx, ctx.destination, 130, "sine", t,    0.4, 0.6, 65);
    osc(ctx, ctx.destination, 196, "sine", t+0.5, 0.9, 0.5, 65);

    // Crowd cheer — bandpass noise envelope
    const cheerSrc = ctx.createBufferSource();
    cheerSrc.buffer = noise(ctx, 2.5, (i, n) => {
      const rise = Math.min(i / (n * 0.06), 1);
      const fall = Math.exp(-((i - n * 0.06) / (n * 0.6)));
      return rise * fall;
    });
    const bpf = ctx.createBiquadFilter();
    bpf.type = "bandpass"; bpf.frequency.value = 700; bpf.Q.value = 0.3;
    const cg = ctx.createGain(); cg.gain.value = 0.5;
    cheerSrc.connect(bpf); bpf.connect(cg); cg.connect(ctx.destination);
    cheerSrc.start(t + 0.4); cheerSrc.stop(t + 2.9);

    // Shimmer sparkle at the peak
    for (let i = 0; i < 6; i++) {
      osc(ctx, ctx.destination, 1200 + i * 300, "sine", t + 0.87 + i * 0.04, 0.25, 0.04);
    }
  }, []);

  useEffect(() => () => { stopMusic(); }, [stopMusic]);

  return {
    startMusic, stopMusic, toggleMute, isMuted,
    playSpinSound, playJoinSound, playEliminationSound, playWinSound,
  };
}
