export interface HealthState {
  current: number
  max: number
}

export function createHealth(max: number): HealthState {
  return { current: max, max }
}

export function isAlive(state: HealthState): boolean {
  return state.current > 0
}

export function applyDamage(state: HealthState, amount: number): HealthState {
  const next = Math.max(0, state.current - amount)
  return { ...state, current: next }
}

export function healDamage(state: HealthState, amount: number): HealthState {
  const next = Math.min(state.max, state.current + amount)
  return { ...state, current: next }
}
