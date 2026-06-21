/**
 * Tiny raw-Web-Audio wrapper — the game's single audio output.
 *
 * Boring by design: no audio library, one lazily-created `AudioContext`, one
 * master `GainNode` for mute/volume, and a `play(name)` that fans a cached
 * `AudioBuffer` (synthesized via {@link sfx}) out to the speakers. Browsers block
 * autoplay until a user gesture, so the context is created/resumed only from
 * {@link AudioBus.unlock} — call it from the first click/keypress.
 *
 * Mute + volume persist to a single `localStorage` key (`korovany-audio`); a UI
 * control writes through `setMuted`/`setVolume` and re-renders off `subscribe`.
 *
 * The `AudioContext` factory and `Storage` are injectable so the bus unit-tests
 * with a stubbed Web Audio API — jsdom has no real one. See `docs/guide/audio.md`.
 */
import { renderSfx, type SfxName } from './sfx'

/** Persisted, user-controllable audio settings. */
export interface AudioSettings {
  muted: boolean
  /** Master volume in [0, 1]. */
  volume: number
}

/** Minimal world-space position used for footstep movement detection. */
export interface Vec3 {
  x: number
  y: number
  z: number
}

/** Distance (world units) a grounded player must move before a step can fire. */
const FOOTSTEP_MOVE_THRESHOLD = 0.01
/** Minimum seconds between footstep sounds. */
const FOOTSTEP_COOLDOWN = 0.4

export interface AudioBusOptions {
  /** Builds the `AudioContext`. Defaults to the browser global. */
  createContext?: () => AudioContext
  /** Where mute/volume persist. Defaults to `window.localStorage`. */
  storage?: Storage | null
}

/** localStorage key holding `{ muted, volume }` (documented in README + audio.md). */
export const AUDIO_STORAGE_KEY = 'korovany-audio'

const DEFAULT_SETTINGS: AudioSettings = { muted: false, volume: 0.7 }

function readSettings(storage: Storage | null): AudioSettings {
  if (!storage) return { ...DEFAULT_SETTINGS }
  try {
    const raw = storage.getItem(AUDIO_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SETTINGS }
    const parsed = JSON.parse(raw) as Partial<AudioSettings>
    return {
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULT_SETTINGS.muted,
      volume:
        typeof parsed.volume === 'number' && parsed.volume >= 0 && parsed.volume <= 1
          ? parsed.volume
          : DEFAULT_SETTINGS.volume,
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

function defaultContextFactory(): AudioContext {
  const Ctor =
    (globalThis as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ??
    (globalThis as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) throw new Error('Web Audio API is not available in this environment')
  return new Ctor()
}

export class AudioBus {
  private readonly createContext: () => AudioContext
  private readonly storage: Storage | null
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private readonly buffers = new Map<SfxName, AudioBuffer>()
  private readonly listeners = new Set<(s: AudioSettings) => void>()
  private settings: AudioSettings
  // Footstep timing in seconds, advanced by checkFootstep() via the frame dt so
  // the cooldown is frame-rate independent and deterministic in tests.
  private stepClock = 0
  private lastStepAt = -Infinity
  // Looped forest ambience source; null while stopped.
  private ambienceSource: AudioBufferSourceNode | null = null

  constructor(options: AudioBusOptions = {}) {
    this.createContext = options.createContext ?? defaultContextFactory
    this.storage =
      options.storage !== undefined
        ? options.storage
        : typeof window !== 'undefined'
          ? window.localStorage
          : null
    this.settings = readSettings(this.storage)
  }

  /** Current mute state. */
  isMuted(): boolean {
    return this.settings.muted
  }

  /** Current master volume in [0, 1]. */
  getVolume(): number {
    return this.settings.volume
  }

  /** Subscribe to settings changes (for the UI control). Returns an unsubscribe. */
  subscribe(fn: (s: AudioSettings) => void): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  setMuted(muted: boolean): void {
    this.settings = { ...this.settings, muted }
    this.applyGain()
    this.persist()
    this.emit()
  }

  setVolume(volume: number): void {
    const clamped = Math.min(1, Math.max(0, volume))
    this.settings = { ...this.settings, volume: clamped }
    this.applyGain()
    this.persist()
    this.emit()
  }

  /**
   * Create/resume the `AudioContext`. Must be called from a user gesture or the
   * browser leaves it `suspended` (and logs an autoplay warning). Idempotent.
   */
  async unlock(): Promise<void> {
    let ctx: AudioContext
    try {
      ctx = this.ensure()
    } catch {
      return // no Web Audio (e.g. jsdom) — nothing to unlock.
    }
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume()
      } catch {
        // A failed resume just leaves us silent; never throw into game code.
      }
    }
  }

  /** Play a named SFX. No-op while muted or before the context exists/unlocks. */
  play(name: SfxName): void {
    if (this.settings.muted) return
    let ctx: AudioContext
    try {
      ctx = this.ensure()
    } catch {
      return // no Web Audio here (e.g. server/test without a stub) — stay silent.
    }
    // Some browsers leave the context suspended; a hit before the first gesture
    // simply produces no sound rather than an error.
    if (ctx.state === 'suspended') return
    const source = ctx.createBufferSource()
    source.buffer = this.bufferFor(ctx, name)
    source.connect(this.master as GainNode)
    source.start()
  }

  /**
   * Advance footstep timing by `dt` seconds and play a step when the player has
   * moved far enough while grounded and the cooldown has elapsed. Call once per
   * frame from the game loop. A `null` `lastPos` (first frame) only seeds timing.
   */
  checkFootstep(grounded: boolean, pos: Vec3, lastPos: Vec3 | null, dt: number): void {
    this.stepClock += dt
    if (!grounded || lastPos === null) return
    const dx = pos.x - lastPos.x
    const dy = pos.y - lastPos.y
    const dz = pos.z - lastPos.z
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz)
    if (dist > FOOTSTEP_MOVE_THRESHOLD && this.stepClock - this.lastStepAt >= FOOTSTEP_COOLDOWN) {
      this.play('footstep')
      this.lastStepAt = this.stepClock
    }
  }

  /** Play a single footstep now, bypassing movement/cooldown gating. */
  playFootstep(): void {
    this.play('footstep')
    this.lastStepAt = this.stepClock
  }

  /**
   * Start the looped forest ambience. Idempotent; a no-op while muted-silent is
   * not enforced here (the master gain handles mute), but it stays silent until
   * the context is unlocked. No-op if already playing or the context is missing.
   */
  startAmbience(): void {
    if (this.ambienceSource) return
    let ctx: AudioContext
    try {
      ctx = this.ensure()
    } catch {
      return // no Web Audio here — nothing to loop.
    }
    if (ctx.state === 'suspended') return // wait for unlock()
    const source = ctx.createBufferSource()
    source.buffer = this.bufferFor(ctx, 'forestAmbience')
    source.loop = true
    source.connect(this.master as GainNode)
    source.start()
    this.ambienceSource = source
  }

  /** Stop the forest ambience if playing. Idempotent. */
  stopAmbience(): void {
    if (!this.ambienceSource) return
    try {
      this.ambienceSource.stop()
    } catch {
      // Already stopped / never started — nothing to do.
    }
    this.ambienceSource = null
  }

  /** True while the forest ambience loop is active. */
  isAmbiencePlaying(): boolean {
    return this.ambienceSource !== null
  }

  private ensure(): AudioContext {
    if (this.ctx) return this.ctx
    const ctx = this.createContext()
    const master = ctx.createGain()
    master.connect(ctx.destination)
    this.ctx = ctx
    this.master = master
    this.applyGain()
    return ctx
  }

  private bufferFor(ctx: AudioContext, name: SfxName): AudioBuffer {
    const cached = this.buffers.get(name)
    if (cached) return cached
    const pcm = renderSfx(name, ctx.sampleRate)
    const buffer = ctx.createBuffer(1, pcm.length, ctx.sampleRate)
    buffer.getChannelData(0).set(pcm)
    this.buffers.set(name, buffer)
    return buffer
  }

  private applyGain(): void {
    if (!this.master) return
    this.master.gain.value = this.settings.muted ? 0 : this.settings.volume
  }

  private persist(): void {
    if (!this.storage) return
    try {
      this.storage.setItem(AUDIO_STORAGE_KEY, JSON.stringify(this.settings))
    } catch {
      // Private-mode / quota failures must not break audio.
    }
  }

  private emit(): void {
    const snapshot = { ...this.settings }
    for (const fn of this.listeners) fn(snapshot)
  }
}

/** Shared game-wide audio bus. */
export const audioBus = new AudioBus()
