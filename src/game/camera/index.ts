// Public barrel for the third-person camera rig.
//
// The orbit/boom math (`./boom`) is pure and NullEngine-free; `ThirdPersonCamera`
// wraps Babylon's `ArcRotateCamera`, drives it from the input look deltas, and
// applies a collision-aware boom against scene geometry.

export {
  DEFAULT_CAMERA_PARAMS,
  applyLook,
  clampBoomRadius,
  type CameraOrbit,
  type CameraParams,
} from './boom'
export {
  ThirdPersonCamera,
  cameraForwardXZ,
  type ThirdPersonCameraOptions,
} from './thirdPersonCamera'
