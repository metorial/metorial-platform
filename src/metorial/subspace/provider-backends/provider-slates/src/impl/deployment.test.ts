import { describe, expect, it } from 'vitest';
import { buildSlateProviderConfigUpdateRequest } from './configUpdate';

describe('provider-slates config update forwarding', () => {
  it('binds tenant, backing instance, patch omission, and generation exactly', () => {
    expect(
      buildSlateProviderConfigUpdateRequest({
        tenantId: 'tenant-a',
        slateInstanceId: 'slate-instance-a',
        patch: { set: { endpoint: 'next' }, remove: ['secret'] },
        expectedGeneration: 7
      })
    ).toEqual({
      tenantId: 'tenant-a',
      slateInstanceId: 'slate-instance-a',
      patch: { set: { endpoint: 'next' }, remove: ['secret'] },
      expectedGeneration: 7
    });
  });
});
