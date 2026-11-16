/**
 * View-model helpers for project screens. Keep display derivations out of JSX.
 */

export function formatProjectUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString();
}

export function formatProjectUpdatedAtLong(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}
