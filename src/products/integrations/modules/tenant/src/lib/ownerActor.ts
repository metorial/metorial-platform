export let ownerActorSelect = {
  select: {
    id: true,
    type: true,
    name: true,
    instanceConsumer: { select: { consumer: { select: { id: true } } } }
  }
} as const;
