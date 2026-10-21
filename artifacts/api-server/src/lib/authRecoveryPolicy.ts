export function publicAuthUser<T extends { passwordHash: unknown; passwordResetToken: unknown; passwordResetExpires: unknown; adminNotes: unknown }>(user: T) {
  const { passwordHash, passwordResetToken, passwordResetExpires, adminNotes, ...publicUser } = user;
  return publicUser;
}
export function isMagicLinkUsable(
  record: { usedAt: Date | null; expiresAt: Date; createdAt: Date },
  user: { pausedAt: Date | null; passwordChangedAt: Date | null },
  now = new Date(),
): boolean {
  const expires = record.expiresAt.getTime();
  const created = record.createdAt.getTime();
  const current = now.getTime();
  if (record.usedAt !== null || user.pausedAt !== null) return false;
  if (![expires, created, current].every(Number.isFinite) || expires <= current) return false;
  if (user.passwordChangedAt) {
    const changed = user.passwordChangedAt.getTime();
    if (!Number.isFinite(changed) || created < changed) return false;
  }
  return true;
}
