import { beforeEach, describe, expect, it, vi } from 'vitest';

let { tx, revokeAccessForConsumerAccessMock, PrismaClientKnownRequestError } = vi.hoisted(
  () => {
    class PrismaClientKnownRequestError extends Error {
      code: string;

      constructor(code: string) {
        super(code);
        this.code = code;
      }
    }

    return {
      tx: {
        consumerAccess: {
          delete: vi.fn()
        }
      },
      revokeAccessForConsumerAccessMock: vi.fn(),
      PrismaClientKnownRequestError
    };
  }
);

vi.mock('@metorial/db', () => ({
  db: {},
  ID: {
    generateId: vi.fn()
  },
  Prisma: {
    PrismaClientKnownRequestError
  },
  withTransaction: vi.fn(async (fn: any) => await fn(tx))
}));

vi.mock('../src/services/consumerAccess/accessPolicy', () => ({
  consumerAccessPolicyService: {
    grantAccess: vi.fn(),
    revokeAccessForConsumerAccess: revokeAccessForConsumerAccessMock
  }
}));

import { consumerAccessService } from '../src/services/consumerAccess/consumerAccess';

describe('consumer access service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('revokes policies when delete is retried after the row is already gone', async () => {
    let organization = { id: 'org-1' };
    let consumerAccess = {
      id: 'access-1',
      oid: 1n,
      type: 'provider_template',
      consumerGroup: { accessTagOid: 2n },
      providerTemplate: { oid: 3n },
      magicMcpServer: null,
      skill: null,
      skillTemplate: null,
      skillGroup: null,
      skillMarketplace: null,
      listing: null
    };

    tx.consumerAccess.delete.mockRejectedValue(new PrismaClientKnownRequestError('P2025'));

    await consumerAccessService.deleteConsumerAccess({
      organization: organization as any,
      consumerAccess: consumerAccess as any
    });

    expect(revokeAccessForConsumerAccessMock).toHaveBeenCalledWith({
      organization,
      consumerAccess
    });
  });
});
