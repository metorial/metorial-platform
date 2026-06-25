import { unauthorizedError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type { Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { env } from '../env';
import { getId } from '../id';
import { apiKeys } from '../keys';

let include = {
  tenant: true
};

class readerTokenServiceImpl {
  async createReaderToken(d: {
    input: {
      name: string;
      expiresAt?: Date;
      tenant: Tenant;
    };
  }) {
    return await db.readerToken.create({
      data: {
        ...getId('readerToken'),
        status: 'active',

        name: d.input.name,

        secret: apiKeys
          .create({
            type: 'reader_token',
            config: { url: env.url.SERVICE_PUBLIC_URL }
          })
          .toString(),

        tenantOid: d.input.tenant?.oid,

        expiresAt: d.input.expiresAt
      },
      include
    });
  }

  async authenticateWithReaderToken(d: { secret: string }) {
    let token = await db.readerToken.findUnique({
      where: {
        secret: d.secret,
        status: 'active',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }]
      },
      include: {
        tenant: true
      }
    });
    if (!token) {
      return {
        status: 'error' as const,
        error: unauthorizedError({
          message: 'The provided Slates token is invalid or has expired.'
        })
      };
    }

    return {
      status: 'success' as const,
      token,
      tenant: token.tenant ?? undefined
    };
  }
}

export let readerTokenService = Service.create(
  'readerTokenService',
  () => new readerTokenServiceImpl()
).build();
