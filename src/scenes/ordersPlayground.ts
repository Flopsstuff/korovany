import {
  type AbstractMesh,
  type AbstractEngine,
  Color3,
  Engine,
  HemisphericLight,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from '@babylonjs/core'
import { resizeEngineToDisplay } from '../engine'
import {
  DEFAULT_SOLDIER_PARAMS,
  issueSquadOrder,
  type CommandEntity,
  type SoldierOrder,
  type SoldierOrderContext,
} from '../game/ai'
import { type Damageable } from '../game/combat'
import { FACTION_IDS } from '../game/faction'
import { FixedStepLoop, type System } from '../game/loop'
import { SoldierEnemy } from './soldierEnemy'

export interface OrdersPlaygroundOptions {
  /** Engine factory — inject a headless `NullEngine` in tests. */
  createEngine?: (canvas: HTMLCanvasElement) => AbstractEngine
}

export interface OrdersPlayground {
  readonly engine: AbstractEngine
  readonly scene: Scene
  readonly commander: System
  readonly soldiers: readonly SoldierEnemy[]
  readonly target: Damageable
  readonly currentOrders: ReadonlyMap<string, SoldierOrder>
  /** Advance one simulation+render frame. Shared by the render loop and tests. */
  step(dt: number): void
  dispose(): void
}

function defaultEngineFactory(canvas: HTMLCanvasElement): Engine {
  return new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true }, true)
}

class MovingCommander implements System {
  readonly mesh: AbstractMesh
  private elapsed = 0

  constructor(scene: Scene) {
    this.mesh = MeshBuilder.CreateSphere('commander', { diameter: 0.8 }, scene)
    this.mesh.position = new Vector3(-5, 0.9, 0)
    const mat = new StandardMaterial('commanderMat', scene)
    mat.diffuseColor = new Color3(0.2, 0.45, 0.95)
    this.mesh.material = mat
  }

  update(dt: number): void {
    this.elapsed += dt
    this.mesh.position.x = Math.cos(this.elapsed * 0.45) * 4
    this.mesh.position.z = Math.sin(this.elapsed * 0.45) * 4
  }

  dispose(): void {
    this.mesh.dispose()
  }
}

class TrainingTarget implements Damageable {
  readonly mesh: AbstractMesh
  private hp = DEFAULT_SOLDIER_PARAMS.maxHp * 3

  constructor(scene: Scene) {
    this.mesh = MeshBuilder.CreateCapsule('ordered-target', { radius: 0.45, height: 1.8 }, scene)
    this.mesh.position = new Vector3(8, 0.9, 0)
    const mat = new StandardMaterial('orderedTargetMat', scene)
    mat.diffuseColor = new Color3(0.7, 0.15, 0.12)
    this.mesh.material = mat
  }

  get position() {
    return { x: this.mesh.position.x, y: this.mesh.position.y, z: this.mesh.position.z }
  }

  takeDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount)
    if (this.hp === 0) this.mesh.setEnabled(false)
  }

  isDead(): boolean {
    return this.hp === 0
  }

  dispose(): void {
    this.mesh.dispose()
  }
}

export function createOrdersPlayground(
  canvas: HTMLCanvasElement,
  options: OrdersPlaygroundOptions = {},
): OrdersPlayground {
  const { createEngine = defaultEngineFactory } = options

  const engine = createEngine(canvas)
  const scene = new Scene(engine)
  new HemisphericLight('light', new Vector3(0, 1, 0), scene)

  const ground = MeshBuilder.CreateGround('ground', { width: 80, height: 80 }, scene)
  const groundMat = new StandardMaterial('groundMat', scene)
  groundMat.diffuseColor = new Color3(0.22, 0.34, 0.24)
  ground.material = groundMat
  ground.isPickable = true

  const commander = new MovingCommander(scene)
  const target = new TrainingTarget(scene)

  const commanderEntity: CommandEntity = {
    id: 'commander',
    factionId: FACTION_IDS.Empire,
  }
  const recipientEntities: CommandEntity[] = [
    { id: 'guard-a', factionId: FACTION_IDS.Empire, commanderId: commanderEntity.id },
    { id: 'guard-b', factionId: FACTION_IDS.Empire, commanderId: commanderEntity.id },
  ]
  const targetEntity: CommandEntity = {
    id: 'target',
    factionId: FACTION_IDS.Villain,
  }

  const orders = new Map<string, SoldierOrder>()

  function issue(order: Parameters<typeof issueSquadOrder>[0]['order']): void {
    const result = issueSquadOrder({
      commander: commanderEntity,
      recipients: recipientEntities,
      order,
      potentialTargets: [targetEntity],
    })
    for (const accepted of result.accepted) orders.set(accepted.recipientId, accepted)
  }

  issue({ type: 'follow' })

  const soldiers = recipientEntities.map((entity, index) => {
    const spawn = new Vector3(-7, 0.9, index === 0 ? -2 : 2)
    return new SoldierEnemy(scene, {
      spawn,
      glbUrl: null,
      getPlayerPos: () => new Vector3(100, 0.9, 100),
      onAttackPlayer: () => undefined,
      getOrderContext: (): SoldierOrderContext => {
        const order = orders.get(entity.id) ?? null
        return {
          order,
          leaderPos: commander.mesh.position,
          targetPos: target.isDead() ? undefined : target.position,
          targetAlive: !target.isDead(),
        }
      },
      onAttackOrderTarget: (damage) => target.takeDamage(damage),
    })
  })

  let elapsed = 0
  let scriptPhase: 'follow' | 'move-to' | 'attack-target' = 'follow'
  const loop = new FixedStepLoop({ world: undefined, dt: 1 / 60 })
  loop.scheduler.register(commander)
  for (const soldier of soldiers) loop.scheduler.register(soldier)

  const frame = (dt: number) => {
    elapsed += dt
    if (elapsed > 5 && scriptPhase === 'follow') {
      scriptPhase = 'move-to'
      issue({ type: 'move-to', destination: { x: 1, y: 0.9, z: 6 } })
    }
    if (elapsed > 10 && scriptPhase === 'move-to') {
      scriptPhase = 'attack-target'
      issue({ type: 'attack-target', targetId: targetEntity.id })
    }

    loop.advance(dt)
    scene.render()
  }

  engine.runRenderLoop(() => frame(engine.getDeltaTime() / 1000))

  const onResize = () => resizeEngineToDisplay(engine, window.devicePixelRatio)
  onResize()
  window.addEventListener('resize', onResize)

  let disposed = false
  const handle: OrdersPlayground = {
    engine,
    scene,
    commander,
    soldiers,
    target,
    currentOrders: orders,
    step: frame,
    dispose() {
      if (disposed) return
      disposed = true
      window.removeEventListener('resize', onResize)
      engine.stopRenderLoop()
      commander.dispose()
      for (const soldier of soldiers) soldier.dispose()
      target.dispose()
      scene.dispose()
      engine.dispose()
    },
  }

  if (import.meta.env.DEV) {
    ;(globalThis as Record<string, unknown>).__korovanyOrdersPlayground = handle
  }

  return handle
}
