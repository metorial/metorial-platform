import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/accessPolicy', () => ({
  consumerAccessPolicyService: {
    grantAccess: vi.fn()
  }
}));

vi.mock('../src/services/consumerAccess', () => ({
  consumerAccessService: {
    createConsumerAccess: vi.fn()
  }
}));

vi.mock('../src/services/consumerIntegration', () => ({
  consumerIntegrationService: {
    upsertConsumerToken: vi.fn(),
    upsertConsumerIntegrationEndpoint: vi.fn(),
    upsertConsumerIntegration: vi.fn()
  }
}));

import { grantConsumerOwnedMagicMcpEndpointAccess } from '../src/lib/magicMcpEndpointAccess';
import { grantConsumerOwnedMagicMcpServerAccess } from '../src/lib/magicMcpServerAccess';
import { grantConsumerOwnedMagicMcpTokenAccess } from '../src/lib/magicMcpTokenAccess';
import { consumerAccessPolicyService } from '../src/services/consumerAccess/accessPolicy';
import { consumerAccessService } from '../src/services/consumerAccess/consumerAccess';
import { consumerIntegrationService } from '../src/services/consumerEntities/consumerIntegration';

describe('magic MCP consumer-owned grants', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upserts the consumer token before granting token access', async () => {
    await grantConsumerOwnedMagicMcpTokenAccess({
      organization: {} as any,
      consumerProfile: {
        oid: 11n,
        instanceOid: 12n,
        consumerOid: 13n,
        personalConsumerGroupOid: 14n
      },
      magicMcpToken: {
        oid: 21n,
        instanceOid: 22n
      }
    });

    expect(consumerIntegrationService.upsertConsumerToken).toHaveBeenCalledWith({
      consumerProfile: expect.objectContaining({
        oid: 11n
      }),
      magicMcpToken: expect.objectContaining({
        oid: 21n
      })
    });
    expect(consumerAccessPolicyService.grantAccess).toHaveBeenCalled();
  });

  it('upserts the consumer endpoint before granting endpoint access', async () => {
    await grantConsumerOwnedMagicMcpEndpointAccess({
      organization: {} as any,
      consumerProfile: {
        oid: 31n,
        instanceOid: 32n,
        consumerOid: 33n,
        personalConsumerGroupOid: 34n
      },
      magicMcpEndpoint: {
        oid: 41n,
        instanceOid: 42n
      }
    });

    expect(consumerIntegrationService.upsertConsumerIntegrationEndpoint).toHaveBeenCalledWith({
      consumerProfile: expect.objectContaining({
        oid: 31n
      }),
      magicMcpEndpoint: expect.objectContaining({
        oid: 41n
      }),
      isManaged: false
    });
    expect(consumerAccessPolicyService.grantAccess).toHaveBeenCalled();
  });

  it('creates consumer access and upserts the integration for servers', async () => {
    await grantConsumerOwnedMagicMcpServerAccess({
      organization: {} as any,
      consumerProfile: {
        oid: 51n,
        instanceOid: 52n,
        consumerOid: 53n,
        surface: {
          oid: 54n
        },
        personalConsumerGroup: {
          oid: 55n
        }
      } as any,
      magicMcpServer: {
        oid: 61n,
        instanceOid: 62n
      } as any
    });

    expect(consumerAccessService.createConsumerAccess).toHaveBeenCalledWith({
      organization: expect.anything(),
      consumerSurface: {
        oid: 54n
      },
      consumerGroup: {
        oid: 55n
      },
      access: {
        type: 'magic_mcp_server',
        magicMcpServer: {
          oid: 61n,
          instanceOid: 62n
        }
      }
    });
    expect(consumerIntegrationService.upsertConsumerIntegration).toHaveBeenCalledWith({
      consumerProfile: expect.objectContaining({
        oid: 51n
      }),
      magicMcpServer: expect.objectContaining({
        oid: 61n
      }),
      isManaged: false
    });
  });
});
