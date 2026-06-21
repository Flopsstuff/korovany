/**
 * Procedural SFX synthesis — pure, dependency-free PCM generation.
 *
 * Why synthesis instead of bundled sample files: it is the most boring,
 * lowest-budget option for a serverless browser game. Zero binary payload (no
 * Git LFS, no network fetch on build), zero third-party licensing risk (we
 * author every waveform, so each clip is unambiguously CC0-equivalent), and the
 * output is fully deterministic — these functions take only a sample rate and
 * return raw `Float32Array` PCM, so they unit-test without any `AudioContext`.
 *
 * The {@link audioBus} turns a clip into a real `AudioBuffer` at first play; if
 * we ever want recorded CC0 samples instead, only the buffer source swaps — the
 * bus, wiring, and event subscriptions stay put. See `docs/guide/audio.md`.
 */

/** A single synth voice layered into a clip. */
export interface ToneSpec {
  /** Start frequency in Hz. */
  freq: number
  /** Clip length in seconds. */
  duration: number
  /** Oscillator shape. `noise` ignores `freq`/`freqEnd`. */
  type?: 'sine' | 'square' | 'triangle' | 'saw' | 'noise'
  /** Peak linear amplitude (pre-mix). */
  gain?: number
  /** Linear attack ramp length in seconds. */
  attack?: number
  /** Exponential decay time constant in seconds (smaller = snappier). */
  decay?: number
  /** Optional linear pitch glide target in Hz (e.g. a falling "death" tone). */
  freqEnd?: number
}

/** Deterministic PRNG (mulberry32) so synthesized noise is test-stable. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function sample(type: NonNullable<ToneSpec['type']>, phase: number, rng: () => number): number {
  switch (type) {
    case 'sine':
      return Math.sin(phase)
    case 'square':
      return Math.sin(phase) >= 0 ? 1 : -1
    case 'triangle':
      return (2 / Math.PI) * Math.asin(Math.sin(phase))
    case 'saw': {
      const t = (phase / (2 * Math.PI)) % 1
      return 2 * t - 1
    }
    case 'noise':
      return rng() * 2 - 1
  }
}

/** Render one voice to mono PCM. */
export function renderTone(spec: ToneSpec, sampleRate: number): Float32Array {
  const { freq, duration, type = 'sine', gain = 1, attack = 0.002, decay = duration / 3, freqEnd } =
    spec
  const length = Math.max(1, Math.floor(duration * sampleRate))
  const out = new Float32Array(length)
  const rng = mulberry32(0x9e3779b9 ^ Math.round(freq))
  let phase = 0
  for (let i = 0; i < length; i++) {
    const t = i / sampleRate
    const f = freqEnd === undefined ? freq : freq + (freqEnd - freq) * (i / length)
    phase += (2 * Math.PI * f) / sampleRate
    // Linear attack, then exponential decay toward zero.
    const env =
      t < attack ? t / attack : Math.exp(-(t - attack) / Math.max(decay, 1e-4))
    out[i] = sample(type, phase, rng) * gain * env
  }
  return out
}

/** Sum several voices into one clip, soft-clamped to [-1, 1]. */
export function mix(layers: Float32Array[]): Float32Array {
  const length = layers.reduce((max, l) => Math.max(max, l.length), 0)
  const out = new Float32Array(length)
  for (const layer of layers) {
    for (let i = 0; i < layer.length; i++) out[i] += layer[i]
  }
  for (let i = 0; i < length; i++) {
    // tanh soft clip keeps peaks musical instead of harsh digital clipping.
    out[i] = Math.tanh(out[i])
  }
  return out
}

/** Render a clip from a stack of voices that play together from t=0. */
export function renderClip(specs: ToneSpec[], sampleRate: number): Float32Array {
  return mix(specs.map((s) => renderTone(s, sampleRate)))
}
