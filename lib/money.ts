export function toCents(input: string | number | null | undefined): number {
  if (input === null || input === undefined || input === '') return 0
  const n = typeof input === 'number' ? input : parseFloat(String(input).replace(/[$,]/g, '').trim())
  if (!isFinite(n)) return 0
  return Math.round(n * 100)
}

export function fromCents(cents: number): string {
  const v = (cents / 100).toFixed(2)
  return `$${v}`
}
