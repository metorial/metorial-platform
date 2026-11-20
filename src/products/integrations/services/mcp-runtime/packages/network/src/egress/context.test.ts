import { describe, expect, it } from 'vitest';
import { createEgressContext } from './context';

describe('createEgressContext', () => {
  it('attributes traffic to the Function Bay tenant', () => {
    let egress = createEgressContext({
      tenant: { identifier: 'tenant-a', functionBayTenantId: 'fbtn_1' },
      serverInstanceConfiguration: { enclaveId: 'enc_1', egressPolicy: { entries: [] } }
    });

    expect(egress).toEqual({
      tenantId: 'fbtn_1',
      enclaveId: 'enc_1',
      egressPolicy: { entries: [] }
    });
  });

  it('falls back to the identifier for tenants not linked yet', () => {
    let egress = createEgressContext({
      tenant: { identifier: 'tenant-a', functionBayTenantId: null }
    });

    expect(egress).toEqual({ tenantId: 'tenant-a', enclaveId: undefined, egressPolicy: null });
  });
});
