/** Returns display name with fallback to username */
export function resolveDisplayName(user: { displayName?: string | null; username?: string } | null | undefined): string {
  if (!user) return 'Unknown';
  return user.displayName?.trim() || user.username || 'Unknown';
}

/** Returns @username format */
export function formatUsername(username: string | null | undefined): string {
  return username ? `@${username}` : '';
}

/** Returns first character initial for avatar */
export function getUserInitial(user: { displayName?: string | null; username?: string } | null | undefined): string {
  return resolveDisplayName(user)[0]?.toUpperCase() ?? 'U';
}
