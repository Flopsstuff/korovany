import { MeshBuilder, type Mesh, type Scene } from '@babylonjs/core'

/** Simple box shown while a streamed GLB is loading or after a load error. */
export function createPlaceholderBox(scene: Scene, name: string): Mesh {
  return MeshBuilder.CreateBox(
    `placeholder:${name}`,
    { size: 1, updatable: false },
    scene,
  )
}
