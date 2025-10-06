import { Context } from '@metorial/context';
import {
  db,
  ID,
  Instance,
  MagicMcpToken,
  Organization,
  OrganizationActor
} from '@metorial/db';
import { notFoundError, preconditionFailedError, ServiceError } from '@metorial/error';
import { createLock } from '@metorial/lock';
import { organizationActorService } from '@metorial/module-organization';
import { Paginator } from '@metorial/pagination';
import { Service } from '@metorial/service';
import { subDays } from 'date-fns';

let include = {};

let autoCreateLock = createLock({
  name: 'mgc/tkn/acrk'
});

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
    context?: Context;

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

  async listMagicMcpTokens(d: { instance: Instance }) {
    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        let getRes = async () =>
          await await db.magicMcpToken.findMany({
            ...opts,
            where: {
              instanceOid: d.instance.oid,

              OR: [{ deletedAt: null }, { deletedAt: { gt: subDays(new Date(), 3) } }]
            },
            include
          });

        let res = await getRes();

        if (res.length == 0) {
          res = await autoCreateLock.usingLock(d.instance.id, async () => {
            let existingSevers = await db.magicMcpToken.count({
              where: { instanceOid: d.instance.oid }
            });

            if (existingSevers == 0) {
              let org = await db.organization.findFirstOrThrow({
                where: { oid: d.instance.organizationOid }
              });

              await this.createMagicMcpToken({
                organization: org,
                performedBy: await organizationActorService.getSystemActor({
                  organization: org
                }),
                instance: d.instance,
                input: {
                  name: 'Default Token',
                  description: 'This token was automatically created for you.'
                }
              });
            }

            return await getRes();
          });
        }

        return res;
      })
    );
  }
}

export let magicMcpTokenService = Service.create(
  'magicMcpToken',
  () => new MagicMcpTokenImpl()
).build();
