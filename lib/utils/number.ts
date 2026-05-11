export function toNumber(value: unknown, fallbackValue: number): number {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallbackValue
}

export function toOpacity(value: unknown, fallbackValue: number): number {
  const numericValue = toNumber(value, fallbackValue)
  if (numericValue < 0) {
    return 0
  }

  if (numericValue > 1) {
    return 1
  }

  return numericValue
}
