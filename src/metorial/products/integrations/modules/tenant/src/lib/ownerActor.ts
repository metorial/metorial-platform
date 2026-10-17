export let ownerActorSelect = {
  select: {
    id: true,
    type: true,
    instanceConsumer: { select: { consumer: { select: { id: true } } } }
  }
} as const;
