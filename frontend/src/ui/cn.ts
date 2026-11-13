/**
 * Tiny class-name joiner. Falsy values are dropped so conditional classes
 * read cleanly: `cn("base", active && "active")`.
 */
export function cn(...values: readonly (string | false | null | undefined)[]): string {
  return values.filter(Boolean).join(" ");
}
