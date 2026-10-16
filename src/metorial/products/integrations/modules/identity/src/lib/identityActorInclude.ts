export let identityActorInclude = {
  agent: true,
  defaultIdentity: { select: { id: true } },
  instanceConsumer: { select: { consumer: { select: { id: true } } } }
} as const;
