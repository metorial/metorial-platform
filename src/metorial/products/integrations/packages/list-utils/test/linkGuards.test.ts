import { beforeEach, describe, expect, it, vi } from 'vitest';

let integrationInstanceProviderFindFirst = vi.hoisted(() => vi.fn());
let identityCredentialFindFirst = vi.hoisted(() => vi.fn());

vi.mock('@metorial-subspace/db', () => ({
  db: {
    integrationInstanceProvider: {
      findFirst: integrationInstanceProviderFindFirst
    },
    identityCredential: {
      findFirst: identityCredentialFindFirst
    },
    integrationInstance: {
      findFirst: vi.fn()
    },
    integrationInstanceGroup: {
      findFirst: vi.fn()
    },
    identityActor: {},
    magicMcpServerBacking: {
      findFirst: vi.fn()
    },
    magicMcpEndpointBacking: {
      findFirst: vi.fn()
    }
  }
}));

import {
  assertNoActiveIdentityCredentialConfigLink,
  assertNoActiveIntegrationInstanceProviderConfigLink
} from '../src/linkGuards';

describe('linkGuards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks provider config archive when linked to an active integration instance provider', async () => {
    integrationInstanceProviderFindFirst.mockResolvedValueOnce({
      id: 'iip_1',
      name: 'Provider A',
      integrationInstance: {
        id: 'ii_1',
        name: 'Instance A'
      }
    });

    await expect(
      assertNoActiveIntegrationInstanceProviderConfigLink({
        tenant: { oid: 1n } as any,
        solution: { oid: 1 } as any,
        environment: { oid: 1n } as any,
        configOid: 10n,
        resourceId: 'cfg_1'
      })
    ).rejects.toThrow('provider_config_integration_instance_provider_archive_not_allowed');
  });

  it('blocks provider config archive when linked to an active identity credential', async () => {
    identityCredentialFindFirst.mockResolvedValueOnce({
      id: 'ic_1',
      identity: {
        id: 'id_1',
        name: 'Identity A'
      }
    });

    await expect(
      assertNoActiveIdentityCredentialConfigLink({
        tenant: { oid: 1n } as any,
        solution: { oid: 1 } as any,
        environment: { oid: 1n } as any,
        configOid: 10n,
        resourceId: 'cfg_1'
      })
    ).rejects.toThrow('provider_config_identity_credential_archive_not_allowed');
  });
});
