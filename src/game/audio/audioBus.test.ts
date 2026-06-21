import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AudioBus, AUDIO_STORAGE_KEY } from './audioBus'

/** Minimal in-memory Storage double. */
function fakeStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => Array.from(map.keys())[i] ?? null,
    removeItem: (k) => map.delete(k),
    setItem: (k, v) => map.set(k, v),
  }
}

/** Records the nodes/sources a bus creates so tests can assert routing. */
class FakeContext {
  state: AudioContextState = 'running'
  sampleRate = 44100
  destination = { id: 'destination' }
  resume = vi.fn(async () => {
    this.state = 'running'
  })
  gain = { gain: { value: -1 }, connect: vi.fn() }
  sources: { buffer: unknown; connectedTo: unknown; started: boolean }[] = []
  createGain() {
    return this.gain
  }
  createBuffer(_ch: number, length: number, _sr: number) {
    const data = new Float32Array(length)
    return { getChannelData: () => data }
  }
  createBufferSource() {
    const src = {
      buffer: null as unknown,
      connectedTo: null as unknown,
      started: false,
      connect(target: unknown) {
        src.connectedTo = target
      },
      start() {
        src.started = true
      },
    }
    this.sources.push(src)
    return src
  }
}

function makeBus(overrides: { state?: AudioContextState } = {}) {
  const ctx = new FakeContext()
  if (overrides.state) ctx.state = overrides.state
  const storage = fakeStorage()
  const bus = new AudioBus({ createContext: () => ctx as unknown as AudioContext, storage })
  return { bus, ctx, storage }
}

describe('AudioBus', () => {
  beforeEach(() => vi.clearAllMocks())

  it('defaults to unmuted at 0.7 volume', () => {
    const { bus } = makeBus()
    expect(bus.isMuted()).toBe(false)
    expect(bus.getVolume()).toBe(0.7)
  })

  it('plays a sound: builds a source, routes it through master gain, starts it', () => {
    const { bus, ctx } = makeBus()
    bus.play('hit')
    expect(ctx.sources).toHaveLength(1)
    const src = ctx.sources[0]
    expect(src.buffer).not.toBeNull()
    expect(src.connectedTo).toBe(ctx.gain)
    expect(src.started).toBe(true)
    // master gain is wired to the destination
    expect(ctx.gain.connect).toHaveBeenCalledWith(ctx.destination)
  })

  it('caches the decoded buffer per sound name', () => {
    const { bus, ctx } = makeBus()
    const spy = vi.spyOn(ctx, 'createBuffer')
    bus.play('hit')
    bus.play('hit')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(ctx.sources).toHaveLength(2)
  })

  it('does not play while muted', () => {
    const { bus, ctx } = makeBus()
    bus.setMuted(true)
    bus.play('hit')
    expect(ctx.sources).toHaveLength(0)
  })

  it('stays silent while the context is suspended (pre-gesture)', () => {
    const { bus, ctx } = makeBus({ state: 'suspended' })
    bus.play('hit')
    expect(ctx.sources).toHaveLength(0)
  })

  it('unlock() resumes a suspended context', async () => {
    const { bus, ctx } = makeBus({ state: 'suspended' })
    await bus.unlock()
    expect(ctx.resume).toHaveBeenCalledOnce()
    expect(ctx.state).toBe('running')
  })

  it('applies mute/volume to the master gain', () => {
    const { bus, ctx } = makeBus()
    bus.play('hit') // forces context/master creation
    bus.setVolume(0.5)
    expect(ctx.gain.gain.value).toBe(0.5)
    bus.setMuted(true)
    expect(ctx.gain.gain.value).toBe(0)
    bus.setMuted(false)
    expect(ctx.gain.gain.value).toBe(0.5)
  })

  it('clamps volume to [0, 1]', () => {
    const { bus } = makeBus()
    bus.setVolume(5)
    expect(bus.getVolume()).toBe(1)
    bus.setVolume(-3)
    expect(bus.getVolume()).toBe(0)
  })

  it('persists settings and reloads them in a new bus', () => {
    const { bus, storage } = makeBus()
    bus.setMuted(true)
    bus.setVolume(0.25)
    expect(JSON.parse(storage.getItem(AUDIO_STORAGE_KEY) as string)).toEqual({
      muted: true,
      volume: 0.25,
    })
    const revived = new AudioBus({
      createContext: () => new FakeContext() as unknown as AudioContext,
      storage,
    })
    expect(revived.isMuted()).toBe(true)
    expect(revived.getVolume()).toBe(0.25)
  })

  it('notifies subscribers on change and stops after unsubscribe', () => {
    const { bus } = makeBus()
    const seen: boolean[] = []
    const off = bus.subscribe((s) => seen.push(s.muted))
    bus.setMuted(true)
    bus.setMuted(false)
    off()
    bus.setMuted(true)
    expect(seen).toEqual([true, false])
  })

  it('stays silent (no throw) when Web Audio is unavailable', () => {
    const bus = new AudioBus({
      createContext: () => {
        throw new Error('no Web Audio')
      },
      storage: fakeStorage(),
    })
    expect(() => bus.play('hit')).not.toThrow()
  })
})
