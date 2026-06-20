#!/usr/bin/env node
/**
 * smoke_load_glb.mjs — headless smoke test for a GLB against Babylon's NullEngine.
 *
 * Proves a generated asset actually imports through the same glTF plugin the app
 * uses (`@babylonjs/loaders/glTF`) and reports its tri count + bounding box, so
 * we verify the file is usable rather than trusting "the Meshy task SUCCEEDED".
 *
 * Usage: node smoke_load_glb.mjs <path-to.glb> [<path-to.glb> ...]
 * Exit code is non-zero if any model fails to load.
 */
import '@babylonjs/loaders/glTF/index.js'
import { NullEngine, Scene, SceneLoader, Vector3 } from '@babylonjs/core'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

async function smoke(path) {
  const engine = new NullEngine()
  const scene = new Scene(engine)
  const data = readFileSync(path)
  const base64 = 'data:model/gltf-binary;base64,' + data.toString('base64')
  const result = await SceneLoader.ImportMeshAsync('', '', base64, scene, null, '.glb')
  let tris = 0
  let verts = 0
  const min = new Vector3(Infinity, Infinity, Infinity)
  const max = new Vector3(-Infinity, -Infinity, -Infinity)
  for (const m of result.meshes) {
    const ic = m.getTotalIndices()
    if (ic > 0) tris += ic / 3
    verts += m.getTotalVertices()
    const bb = m.getBoundingInfo?.()?.boundingBox
    if (bb) {
      const lo = bb.minimumWorld
      const hi = bb.maximumWorld
      min.minimizeInPlace(lo)
      max.maximizeInPlace(hi)
    }
  }
  const ext = max.subtract(min)
  engine.dispose()
  return {
    file: basename(path),
    meshes: result.meshes.length,
    tris: Math.round(tris),
    verts,
    materials: result.meshes.flatMap((m) => (m.material ? [m.material.name] : [])),
    bbox: { x: +ext.x.toFixed(3), y: +ext.y.toFixed(3), z: +ext.z.toFixed(3) },
  }
}

const paths = process.argv.slice(2)
if (paths.length === 0) {
  console.error('usage: node smoke_load_glb.mjs <file.glb> [...]')
  process.exit(2)
}
let failed = false
for (const p of paths) {
  try {
    const r = await smoke(p)
    console.log(JSON.stringify(r, null, 2))
    if (r.tris === 0) {
      console.error(`FAIL ${r.file}: loaded 0 triangles`)
      failed = true
    }
  } catch (e) {
    console.error(`FAIL ${p}: ${e?.message ?? e}`)
    failed = true
  }
}
process.exit(failed ? 1 : 0)
