/** Metadata carried alongside a registered asset id (not stored in the GLB). */
export interface AssetMetadata {
  label?: string
  /** Longest bounding-box dimension after normalization. See `loadModel`. */
  targetSize?: number
  groundIt?: boolean
  yaw?: number
}

/** Registry entry: static URL + optional load-time metadata. */
export interface AssetRecord {
  url: string
  metadata: AssetMetadata
}

/** Lifecycle phase surfaced to the HUD and placeholder logic. */
export type AssetLoadPhase = 'idle' | 'loading' | 'loaded' | 'error'
