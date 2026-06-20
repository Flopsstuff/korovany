// Public barrel for the character controller.
//
// The pure movement math (`./movement`) is engine-agnostic and unit-tested with
// Babylon's headless NullEngine; the `CharacterController` binds it to a capsule
// mesh, the input intent, and the follow camera, and runs as a loop `System`.

export {
  DEFAULT_MOVEMENT_PARAMS,
  createMovementState,
  stepMovement,
  type MovementInput,
  type MovementParams,
  type MovementState,
} from './movement'
export {
  CharacterController,
  type CharacterControllerOptions,
} from './characterController'
