export function capitalize(text: string): string {
  const res = text
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
  return res
}
