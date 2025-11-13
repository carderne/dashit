const prefix = 'Invariant failed'

export function hasValue(value: unknown): boolean {
  if (typeof value === 'undefined' || value === null) {
    return false
  }
  return true
}

export function invariant(
  condition: unknown,
  message?: string | (() => string),
): asserts condition {
  // Note we're using our own definition of truthy...
  if (condition === true || hasValue(condition)) {
    return
  }
  const provided: string | undefined = typeof message === 'function' ? message() : message
  const value: string = provided ? `${prefix}: ${provided}` : prefix
  const fullError = new Error(value)
  throw fullError
}
