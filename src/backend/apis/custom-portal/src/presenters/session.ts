export let presentSession = (d: {
  session: {
    id: string;
    createdAt: Date;
    expiresAt: Date;
    lastUsedAt: Date | null;
  };
}) => ({
  object: 'consumer.session' as const,
  id: d.session.id,
  created_at: d.session.createdAt,
  expires_at: d.session.expiresAt,
  last_used_at: d.session.lastUsedAt
});
