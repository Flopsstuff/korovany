// Public barrel for the input system. Consumers (scenes, game loop, settings UI)
// import from here; the pure model (intent/bindings) stays free of DOM/Babylon
// and is independently unit-testable.

export { defaultBindings, actionForCode, rebind, type KeyBindings } from './bindings'
export {
  createInputState,
  inputReducer,
  toIntent,
  type Intent,
  type InputAction,
  type InputEvent,
  type InputState,
} from './intent'
export {
  createInputController,
  type InputController,
  type InputControllerOptions,
} from './domAdapter'
