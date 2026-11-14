import type { KeyError } from '../../prisma/generated/client';

export let keyProviderErrorPresenter = (error: KeyError) => ({
  object: 'nebula#key_provider_error',
  id: error.id,
  day: error.day,
  operation: error.operation,
  code: error.code,
  count: error.count,
  sampleMessage: error.sampleMessage,
  firstSeenAt: error.firstSeenAt,
  lastSeenAt: error.lastSeenAt
});
