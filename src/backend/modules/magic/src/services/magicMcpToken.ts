import { Context } from '@metorial/context';
import {
  db,
  ID,
  Instance,
  MagicMcpToken,
  MagicMcpTokenStatus,
  Organization,
  OrganizationActor
} from '@metorial/db';
import { notFoundError, preconditionFailedError, ServiceError } from '@metorial/error';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';

let include = {};

class MagicMcpTokenImpl {
  async getMagicMcpTokenById(d: { instance: Instance; magicMcpTokenId: string }) {
    let magicMcpToken = await db.magicMcpToken.findFirst({
      where: {
        instanceOid: d.instance.oid,
        id: d.magicMcpTokenId
      },
      include
    });
    if (!magicMcpToken) throw new ServiceError(notFoundError('magic_mcp.token'));

    return magicMcpToken;
  }

  async getManyMagicMcpTokens(d: { magicMcpTokenId: string[]; instance: Instance }) {
    if (d.magicMcpTokenId.length === 0) return [];

    return await db.magicMcpToken.findMany({
      where: {
        id: { in: d.magicMcpTokenId },
        instanceOid: d.instance.oid
      },
      include
    });
  }

  async createMagicMcpToken(d: {
    organization: Organization;
    performedBy: OrganizationActor;
    instance: Instance;
    context: Context;

    input: {
      name?: string;
      description?: string;
      metadata?: Record<string, any>;
    };
  }) {
    return await db.magicMcpToken.create({
      data: {
        id: await ID.generateId('magicMcpToken'),
        secret: await ID.generateId('magicMcpToken_ClientSecret'),
        status: 'active',
        instanceOid: d.instance.oid,
        name: d.input.name,
        description: d.input.description,
        metadata: d.input.metadata || {}
      },
      include
    });
  }

  async deletedMagicMcpToken(d: { token: MagicMcpToken }) {
    if (d.token.status === 'deleted') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'The server magic MCP token is already deleted'
        })
      );
    }

    return await db.magicMcpToken.update({
      where: { id: d.token.id },
      data: { status: 'deleted', deletedAt: new Date() },
      include
    });
  }

  async updateMagicMcpToken(d: {
    token: MagicMcpToken;
    input: {
      name?: string | null;
      description?: string | null;
      metadata?: Record<string, any> | null;
    };
  }) {
    if (d.token.status === 'deleted') {
      throw new ServiceError(
        preconditionFailedError({
          message: 'The server magic MCP token is deleted'
        })
      );
    }

    return await db.magicMcpToken.update({
      where: { id: d.token.id },
      data: {
        name: d.input.name === undefined ? d.token.name : d.input.name,
        description:
          d.input.description === undefined ? d.token.description : d.input.description,
        metadata: d.input.metadata === undefined ? d.token.metadata : d.input.metadata
      },
      include
    });
  }

  async listMagicMcpTokens(d: { instance: Instance; status?: MagicMcpTokenStatus[] }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.magicMcpToken.findMany({
            ...opts,
            where: {
              instanceOid: d.instance.oid,

              AND: [d.status ? { status: { in: d.status } } : { not: 'archived' }].filter(
                Boolean
              )
            },
            include
          })
      )
    );
  }
}

export let magicMcpTokenService = Service.create(
  'magicMcpToken',
  () => new MagicMcpTokenImpl()
).build();
