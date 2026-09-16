export let deliveryStorageKey = {
  attemptDetails: (attempt: { id: string }) => `attempts/${attempt.id}/details`
};
