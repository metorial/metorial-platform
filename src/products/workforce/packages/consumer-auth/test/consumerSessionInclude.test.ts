import { describe, expect, it, vi } from 'vitest';

vi.mock('@metorial/db', () => ({ db: {} }));

vi.mock('@metorial/config', () => ({
  getConfig: () => ({ encryptionSecret: 'test-secret' })
}));

vi.mock('@mtsrc/auth-core-client-internal', () => ({
  createAresInternalClient: vi.fn()
}));

vi.mock('@metorial/module-resource-actor', () => ({
  resourceActorService: { ensureConsumerProfileActor: vi.fn() }
}));

import { consumerSessionInclude } from '../src/index';

describe('consumerSessionInclude', () => {
  it('loads the organization actor so consumer sessions resolve to the consumer as owner', () => {
    expect(consumerSessionInclude.consumerProfile.include.organizationActor).toBe(true);
  });
});
