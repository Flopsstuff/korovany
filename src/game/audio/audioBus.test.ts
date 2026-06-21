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
  gain = { gain: { value: -1 }, connect: vi.fn() }
  sources: {
    buffer: unknown
    connectedTo: unknown
    started: boolean
    stopped: boolean
    loop: boolean
  }[] = []

  resume = vi.fn(async () => {
    this.state = 'running'
  })
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
      stopped: false,
      loop: false as boolean,
      connect(target: unknown) {
        src.connectedTo = target
      },
      start() {
        src.started = true
      },
      stop() {
        src.stopped = true
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

describe('ambience', () => {
  it('startAmbience plays a single looped, master-routed forest source', () => {
    const { bus, ctx } = makeBus()
    bus.startAmbience()
    expect(bus.isAmbiencePlaying()).toBe(true)
    expect(ctx.sources).toHaveLength(1)
    const src = ctx.sources[0]
    expect(src.buffer).not.toBeNull()
    expect(src.loop).toBe(true)
    expect(src.connectedTo).toBe(ctx.gain)
    expect(src.started).toBe(true)
  })

  it('stopAmbience stops the source and clears playing state', () => {
    const { bus, ctx } = makeBus()
    bus.startAmbience()
    bus.stopAmbience()
    expect(bus.isAmbiencePlaying()).toBe(false)
    expect(ctx.sources[0].stopped).toBe(true)
  })

  it('startAmbience is idempotent (one source while already looping)', () => {
    const { bus, ctx } = makeBus()
    bus.startAmbience()
    bus.startAmbience()
    expect(ctx.sources).toHaveLength(1)
  })

  it('stays silent (no source) while the context is suspended', () => {
    const { bus, ctx } = makeBus({ state: 'suspended' })
    bus.startAmbience()
    expect(bus.isAmbiencePlaying()).toBe(false)
    expect(ctx.sources).toHaveLength(0)
  })
})

describe('footsteps', () => {
  it('playFootstep plays a footstep sound immediately', () => {
    const { bus, ctx } = makeBus()
    bus.playFootstep()
    expect(ctx.sources).toHaveLength(1)
    expect(ctx.sources[0].buffer).not.toBeNull()
  })

  it('checkFootstep fires once when moving past the threshold while grounded', () => {
    const { bus, ctx } = makeBus()
    bus.checkFootstep(true, { x: 0, y: 0, z: 0 }, null, 1 / 60) // seed, no step
    expect(ctx.sources).toHaveLength(0)
    bus.checkFootstep(true, { x: 0.5, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 1 / 60)
    expect(ctx.sources).toHaveLength(1)
  })

  it('checkFootstep does not fire while airborne', () => {
    const { bus, ctx } = makeBus()
    bus.checkFootstep(false, { x: 0.5, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 1 / 60)
    expect(ctx.sources).toHaveLength(0)
  })

  it('checkFootstep does not fire below the movement threshold', () => {
    const { bus, ctx } = makeBus()
    bus.checkFootstep(true, { x: 0.001, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 1 / 60)
    expect(ctx.sources).toHaveLength(0)
  })

  it('checkFootstep enforces the cooldown, then fires again once it elapses', () => {
    const { bus, ctx } = makeBus()
    const move = (last: number, next: number, dt: number) =>
      bus.checkFootstep(true, { x: next, y: 0, z: 0 }, { x: last, y: 0, z: 0 }, dt)
    move(0, 0.5, 1 / 60) // first step
    expect(ctx.sources).toHaveLength(1)
    move(0.5, 1.0, 1 / 60) // immediately after — within cooldown, suppressed
    expect(ctx.sources).toHaveLength(1)
    move(1.0, 1.5, 0.5) // 0.5s later — past the 0.4s cooldown
    expect(ctx.sources).toHaveLength(2)
  })
})
